<?php

namespace App\Http\Controllers;

use App\Models\Merchant;
use App\Models\Transaction;
use App\Models\userProviderFee;
use GuzzleHttp\Client;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Models\Agent;
use App\Models\Partner;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Settlement;
use App\Models\ProviderWallet;
use App\Models\TopUpRequest;
use App\Models\PayoutRequest;
use Carbon\Carbon;
use Illuminate\Support\Str;
use App\Events\SendMail;
class MerchantApiController extends Controller
{
    /**
     * Balance query endpoint.
     */
    public function balance(Request $request)
    {
        $validator = Validator::make($request->all(), [
            // 'version' => 'required|string',
            // 'signType' => 'required|in:MD5,RSA',
            'merchantNo' => 'required|string',
            'currency' => 'required|string',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => -1,
                'msg' => 'Validation error',
                'detail' => []
            ]);
        }

        $merchant = Merchant::where('api_key', $request->merchantNo)->first();
        if (!$merchant) {
            return response()->json([
                'code' => -1,
                'msg' => 'Merchant not found',
                'detail' => []
            ]);
        }


        // Get actual wallet balance
        $user = $merchant->user;
        if (!$user) {
            return response()->json([
                'code' => -1,
                'msg' => 'Merchant user not found',
                'detail' => []
            ]);
        }

        $wallet = $user->wallets()->where('currency', $request->currency ?? 'USD')->first();
        $balance = $wallet ? $wallet->balance : 0;

        $detail = [
            'D0Balance' => number_format($balance, 2, '.', ''),
            'D0Freeze' => '0.00', // TODO: Implement frozen balance if needed
            'QCBalance' => number_format($balance, 2, '.', '') // Assuming same as D0 for now
        ];

        return response()->json([
            'code' => 0,
            'msg' => '',
            'detail' => $detail
        ]);
    }
    public function successReturnUrl($trxId){

        $transaction=Transaction::where('txn_id', $trxId)->first();

        if(!$transaction){
            return redirect()->to('https://google.com');
        }


        $metaData=$transaction->metadata?(object)$transaction->metadata:'';
        if(!$metaData->returnUrl){
            $rtnUrl=$metaData->returnUrl.'?txn='.$transaction->txn_id;
            return redirect()->to($rtnUrl);
        }


        return redirect()->to('https://google.com');

    }
    public function webhookUrl(Request $request)
    {

        $requestData = $request->all();
        $requestData=$requestData?json_decode($requestData):'';

        if(!$requestData || !isset($requestData->id)){
            return;
        }

        $transaction=Transaction::where('result_id', $requestData->id)->where('amount', $requestData->amount)->first();
        $topUpRequest = TopUpRequest::where('top_up_request_id', $transaction->top_up_request_id)->first();
        if (!$topUpRequest) {
            return;
        }
        $user = User::where('user_id', $topUpRequest->user_id)->first();
        if (!$user) {
            return;
        }
        $wallet = Wallet::where('user_id', $user->user_id)
            ->where('currency', $topUpRequest->currency)
            ->first();

        if (!$wallet) {
            return;
        }
        $provider = Provider::where('provider_id', $topUpRequest->provider_id)
            ->where('status', 'active')
            ->first();

        if (!$provider) {
            return;
        }
        $merchant=Merchant::where('merchant_id', $transaction->merchant_id)->where('status', 'ACTIVE')->first();
        if(!$merchant || !$merchant->agent_id){
            return;
        }

        $agent=Agent::where('agent_id', $merchant->agent_id)->where('status', 'ACTIVE')->first();
        if(!$agent){
            return;
        }

        $partner=Partner::where('partner_id', $agent->partner_id)->where('status', 'ACTIVE')->first();
        if(!$partner){
            return;
        }

        $superAdmin=User::where('role', 'SUPER_ADMIN')->first();
        if(!$superAdmin){
            return;
        }


        $partnerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)->where('provider_id',$transaction->provider_id)->first();
        $agentFee=userProviderFee::where('user_type', 'AGENT')->where('agent_id', $agent->agent_id)->where('provider_id',$transaction->provider_id)->first();
        $merchantFee=userProviderFee::where('user_type', 'MARCHENT')->where('merchant_id', $merchant->merchant_id)->where('provider_id',$transaction->provider_id)->first();


        //TODO::Percentage Fee
        $partnerPercentageFee=0;
        $agentPercentageFee=0;
        $merchantPercentageFee=0;
        //Partner
        if($partnerFee && $partnerFee->new_fee_percentage){
            $partnerPercentageFee=$partnerFee->new_fee_percentage;
        }
        //Agent
        if($agentFee && $agentFee->new_fee_percentage){
            $agentPercentageFee=$agentFee->new_fee_percentage;
        }
        //Merchant
        if($merchantFee && $merchantFee->new_fee_percentage){
            $merchantPercentageFee=$merchantFee->new_fee_percentage;
        }

        //TODO::Flat Fee
        $partnerFlatFee=0;
        $agentFlatFee=0;
        $merchantFlatFee=0;
        //Partner
        if($partnerFee && $partnerFee->new_fixed_amount){
            $partnerFlatFee=$partnerFee->new_fixed_amount;
        }
        //Agent
        if($agentFee && $agentFee->new_fixed_amount){
            $agentFlatFee=$agentFee->new_fixed_amount;
        }
        //Merchant
        if($merchantFee && $merchantFee->new_fixed_amount){
            $merchantFlatFee=$merchantFee->new_fixed_amount;
        }

        $finalPercentageFee= $partnerPercentageFee + $agentPercentageFee + $merchantPercentageFee;
        $finalFixFee=$partnerFlatFee + $agentFlatFee + $merchantFlatFee;


        $percentageFeeAmount=($transaction->amount * $finalPercentageFee) / 100;
        $grandFeeAmount=$finalFixFee + $percentageFeeAmount;
        $amountAfterFeeDuduct=$transaction->amount - $grandFeeAmount;


        $metaData=$transaction->metadata?(object)$transaction->metadata:'';

        if(isset($metaData->noticeUrl)){
            $webhookClientData=[

                  "id"=> $transaction->txn_id,
                    "created"=> $transaction->created_at->format('d-m-y H:M'),
                    "state"=> "COMPLETED",
                    "internalState"=> "COMPLETED",
                    "paymentMethod"=> "BASIC_CARD",
                    "paymentMethodDetails"=>$requestData->paymentMethodDetails,
                    "amount"=> $transaction->amount,
                    "currency"=>$transaction->currency
            ];

            try {
                $client = new Client(['verify'=>false]);
                $response = $client->post($metaData->noticeUrl, [
                    'json' => $webhookClientData
                ]);
            } catch (\Exception $ex) {

            }

        }

        // if ($provider->settlement === 'T+0') {
            if ($agent->parent_agent_id) {
                $this->merchantDistributionFeeForAgentParent($merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin);
            }else{
                $this->merchantDistributionFee($merchant,$merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin);
            }

            $wallet->balance += $topUpRequest->amount;
            $wallet->save();

            $topUpRequest->payment_status = 'paid';
            $topUpRequest->status = 'approved';
            $topUpRequest->save();

            $transaction->status = 'SUCCESS';
            $transaction->provider_id = $topUpRequest->provider_id;
            $transaction->save();

            $providerWallet = ProviderWallet::firstOrNew([
                'provider_id' => $topUpRequest->provider_id,
                'currency' => $topUpRequest->currency,
            ]);

            $providerWallet->balance = ($providerWallet->balance ?? 0) + $topUpRequest->total_amount;
            $providerWallet->save();


            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
            if ($emailTemplate && $notification === true) {
                $regTemp = str_replace('user_name', $user->name, $emailTemplate->body);
                $regTemp = str_replace('status', $transaction->status, $regTemp);
                $regTemp = str_replace('data', $transaction->created_at, $regTemp);
                $regTemp = str_replace('type', $transaction->transaction_type, $regTemp);
                $regTemp = str_replace('amount', $transaction->amount, $regTemp);
                $regTemp = str_replace('currency', $transaction->currency, $regTemp);
                SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
            }
            Log::info('PAY-IN-WEBHOOK: Instant (T+0) settlement processed', [
                'transaction_id' => $transaction->id,
                'wallet_balance' => $wallet->balance
            ]);
        // } else {
        //     $time = Carbon::now();

        //     if ($provider->settlement === 'T+1') {
        //         $time->addDay();
        //     } elseif ($provider->settlement === 'T+2') {
        //         $time->addDays(2);
        //     } elseif ($provider->settlement === 'T+3') {
        //         $time->addDays(3);
        //     }

        //     $settlement = Settlement::create([
        //         'settlement_id' => Str::uuid(),
        //         'partner_id' => $topUpRequest->partner_id,
        //         'agent_id' => $topUpRequest->agent_id,
        //         'merchant_id' => $topUpRequest->merchant_id,
        //         'settlement_date' => $time,
        //         'cutoff_time' => '',
        //         'total_amount' => $topUpRequest->total_amount,
        //         'net_amount' => $topUpRequest->total_amount,
        //         'currency' => $topUpRequest->currency,
        //         'status' => 'PENDING',
        //         'fee_amount' => $topUpRequest->total_amount - $topUpRequest->amount,
        //         'request_id' => $topUpRequest->top_up_request_id,
        //         'user_type' => $topUpRequest->user_type,
        //         'transaction_type' => 'PAYIN',
        //         'settlement_type' => $provider->settlement,
        //     ]);

        //     $topUpRequest->status = 'pending';
        //     $topUpRequest->save();

        //     $emailTemplate = get_Templates('settlement');
        //     $notification = get_notifications('settlement_notifications');
        //     if ($emailTemplate && $notification === true) {
        //         $regTemp = str_replace('status', $settlement->status, $emailTemplate->body);
        //         $regTemp = str_replace('data', $settlement->updated_at, $regTemp);
        //         $regTemp = str_replace('type', $settlement->transaction_type, $regTemp);
        //         $regTemp = str_replace('amount', $settlement->net_amount, $regTemp);
        //         $regTemp = str_replace('currency', $settlement->currency, $regTemp);
        //         SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
        //     }
        //     Log::info('PAY-IN-WEBHOOK: Delayed settlement created', [
        //         'settlement_type' => $provider->settlement,
        //         'date' => $time
        //     ]);
        // }


        // $this->merchantDistributionFee($merchant,$merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin);


        //Balance Add On Super Admin
        // $this->partnerWebhook($transaction, $superAdmin, $amountAfterFeeDuduct, $partnerPercentageFee, $partnerFlatFee);

        //Balance Add Partner
        // $this->agentWebhook($transaction, $partner, $amountAfterFeeDuduct, $agentPercentageFee, $agentFlatFee);

        //Balance Add Agent
        // $this->merchantWebhook($transaction, $agent, $amountAfterFeeDuduct, $merchantPercentageFee, $merchantFlatFee);


        return 'SUCCESS';

    }

    private function merchantDistributionFee($merchant,$merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin){
        try {
            $agentWallet = Wallet::where('user_id', $agent->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
            $merchantGrandFeeAmount = (($transaction->amount * $merchantPercentageFee) / 100) + $merchantFlatFee;

            $agentTotalFeeAmount = (($merchantGrandFeeAmount * $agentPercentageFee) / 100) + $agentFlatFee;

            $partnerTotalFeeAmount = (($agentTotalFeeAmount * $partnerPercentageFee) / 100) + $partnerFlatFee;

            $agentGet = $merchantGrandFeeAmount - $agentTotalFeeAmount;
            $partnerGet = $agentTotalFeeAmount - $partnerTotalFeeAmount;
            $adminGet = $partnerTotalFeeAmount;

            $settlement = Settlement::where('request_id',$transaction->top_up_request_id)->first();
            $createdTransactionIds = [];

            if ($agentWallet) {
                $oldAgentWalletBalance = $agentWallet->balance;
                $agentWallet->balance = $oldAgentWalletBalance + $agentGet;
                $agentWallet->save();
                //Post Wallet Post Balance
                $postAgentBalance = [
                    'p_balance' => $oldAgentWalletBalance,
                    'n_balance' => $agentWallet->balance
                ];

                //Fee Details
                $allAgentFee = [
                    'percentage_fee' => $merchantPercentageFee,
                    'fix_fee' => $merchantFlatFee
                ];

                $transactionAgent = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'agent_id' => $agent->agent_id,
                    'user_id' => $agent->user_id,
                    'for' => 'AGENT',
                    'amount' => $agentGet,
                    'currency' => $transaction->currency,
                    'channel_type' => $transaction->channel_type,
                    'transaction_type' => $transaction->transaction_type,
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAgentFee),
                    'wallet_balance' => json_encode($postAgentBalance),
                    // 'total_fee' => $merchantGrandFeeAmount
                    'fee_type' => 'PAY IN',
                ]);
                if ($emailTemplate && $notification === true) {
                    $regTemp = str_replace('user_name', $agent->user->name, $emailTemplate->body);
                    $regTemp = str_replace('status', $transactionAgent->status, $regTemp);
                    $regTemp = str_replace('data', $transactionAgent->created_at, $regTemp);
                    $regTemp = str_replace('type', $transactionAgent->transaction_type, $regTemp);
                    $regTemp = str_replace('amount', $transactionAgent->amount, $regTemp);
                    $regTemp = str_replace('currency', $transactionAgent->currency, $regTemp);
                    SendMail::dispatch($agent->user->email, $emailTemplate->subject, $regTemp);
                }
                $createdTransactionIds[] = $transactionAgent->txn_id;
            }
            if ($partnerWallet) {
                $oldPartnerWalletBalance = $partnerWallet->balance;
                $partnerWallet->balance = $oldPartnerWalletBalance + $partnerGet;
                $partnerWallet->save();
                //Post Wallet Post Balance
                $postPartnerBalance = [
                    'p_balance' => $oldPartnerWalletBalance,
                    'n_balance' => $partnerWallet->balance
                ];

                //Fee Details
                $allPartnerFee = [
                    'percentage_fee' => $agentPercentageFee,
                    'fix_fee' => $agentFlatFee
                ];

                $transactionPartner = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'partner_id' => $partner->partner_id,
                    'user_id' => $partner->user_id,
                    'for' => 'PARTNER',
                    'amount' => $partnerGet,
                    'currency' => $transaction->currency,
                    'channel_type' => $transaction->channel_type,
                    'transaction_type' => $transaction->transaction_type,
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allPartnerFee),
                    'wallet_balance' => json_encode($postPartnerBalance),
                    // 'total_fee' => $agentTotalFeeAmount
                    'fee_type' => 'PAY IN',
                ]);
                if ($emailTemplate && $notification === true) {
                    $regTemp = str_replace('user_name', $partner->user->name, $emailTemplate->body);
                    $regTemp = str_replace('status', $transactionPartner->status, $regTemp);
                    $regTemp = str_replace('data', $transactionPartner->created_at, $regTemp);
                    $regTemp = str_replace('type', $transactionPartner->transaction_type, $regTemp);
                    $regTemp = str_replace('amount', $transactionPartner->amount, $regTemp);
                    $regTemp = str_replace('currency', $transactionPartner->currency, $regTemp);
                    SendMail::dispatch($partner->user->email, $emailTemplate->subject, $regTemp);
                }
                $createdTransactionIds[] = $transactionPartner->txn_id;
            }
            if ($superAdminWallet) {
                $oldAdminWalletBalance = $superAdminWallet->balance;
                $superAdminWallet->balance = $oldAdminWalletBalance + $adminGet;
                $superAdminWallet->save();
                //Post Wallet Post Balance
                $postAdminBalance = [
                    'p_balance' => $oldAdminWalletBalance,
                    'n_balance' => $superAdminWallet->balance
                ];

                //Fee Details
                $allAdminFee = [
                    'percentage_fee' => $partnerPercentageFee,
                    'fix_fee' => $partnerFlatFee
                ];
                $transactionAdmin = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'superadmin_id' => $superAdmin->user_id,
                    'user_id' => $superAdmin->user_id,
                    'for' => 'SUPER_ADMIN',
                    'amount' => $adminGet,
                    'currency' => $transaction->currency,
                    'channel_type' => $transaction->channel_type,
                    'transaction_type' => $transaction->transaction_type,
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAdminFee),
                    'wallet_balance' => json_encode($postAdminBalance),
                    // 'total_fee' => $partnerTotalFeeAmount
                    'fee_type' => 'PAY IN',
                ]);
                if ($emailTemplate && $notification === true) {
                    $regTemp = str_replace('user_name', $superAdmin->name, $emailTemplate->body);
                    $regTemp = str_replace('status', $transactionAdmin->status, $regTemp);
                    $regTemp = str_replace('data', $transactionAdmin->created_at, $regTemp);
                    $regTemp = str_replace('type', $transactionAdmin->transaction_type, $regTemp);
                    $regTemp = str_replace('amount', $transactionAdmin->amount, $regTemp);
                    $regTemp = str_replace('currency', $transactionAdmin->currency, $regTemp);
                    SendMail::dispatch($superAdmin->email, $emailTemplate->subject, $regTemp);
                }
                $createdTransactionIds[] = $transactionAdmin->txn_id;
            }
            if ($settlement && count($createdTransactionIds) > 0) {
                $settlement->transaction_count = ($settlement->transaction_count ?? 0) + count($createdTransactionIds);

                $existingIds = $settlement->transaction_ids ?? [];
                $settlement->transaction_ids = array_merge($existingIds, $createdTransactionIds);

                $settlement->processed_at = now();
                $settlement->save();

                // Link new transactions to settlement
                Transaction::whereIn('txn_id', $createdTransactionIds)
                    ->update(['settlement' => $settlement->settlement_id]);
            }
        } catch (\Exception $ex) {
            Log::info('Merchant webhook error');
        }
    }
    private function merchantDistributionFeeForAgentParent($merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin){
        try {
            $agentWallet = Wallet::where('user_id', $agent->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
            $createdTransactionIds = [];

            $merchantGrandFeeAmount = (($transaction->amount * $merchantPercentageFee) / 100) + $merchantFlatFee;

            $agentTotalFeeAmount = (($transaction->amount * $agentPercentageFee) / 100) + $agentFlatFee;

            $partnerTotalFeeAmount = (($transaction->amount * $partnerPercentageFee) / 100) + $partnerFlatFee;

            $parentAgents = [];
            $currentAgent = $agent;
            $base_amount_used = $agentTotalFeeAmount;
            $amont = $transaction->amount;

            while ($currentAgent && $currentAgent->parent_agent_id) {
                $parent = Agent::where('agent_id', $currentAgent->parent_agent_id)
                    ->where('status', 'ACTIVE')
                    ->first();

                if (!$parent) {
                    break;
                }

                $parentFee = userProviderFee::where('user_type', 'AGENT')
                    ->where('agent_id', $parent->agent_id)
                    ->where('provider_id', $transaction->provider_id)
                    ->first();

                $percentage = $parentFee->new_fee_percentage;
                $flat = $parentFee->new_fixed_amount;

                // Calculate based on the *previous level’s* fee
                $parentFeeAmount = (($amont * $percentage) / 100) + $flat;

                $parentAgents[] = [
                    'user_id' => $parent->user->user_id,
                    'name' => $parent->user->name,
                    'email' => $parent->user->email,
                    'agent_id' => $parent->agent_id,
                    'agent' => $parent->name,
                    'fee' => [
                    'new_fee_percentage' => $parentFee->new_fee_percentage,
                    'new_fixed_amount' => $parentFee->new_fixed_amount,
                    ],
                    'calculated_fee_amount' => $parentFeeAmount,
                    'base_amount_used' => $base_amount_used,
                    'amont' => $amont,
                    'defferent' => $base_amount_used - $parentFeeAmount,
                ];

                // Update base for the next parent
                $base_amount_used = $parentFeeAmount;

                $currentAgent = $parent;
            }


        $totalCalculatedFee = collect($parentAgents)->sum('defferent');


            if ($agentWallet) {
                $agentGet = $agentTotalFeeAmount - $parentAgents[0]['calculated_fee_amount'] ?? 0;
                $oldAgentWalletBalance = $agentWallet->balance;
                $agentWallet->balance = $oldAgentWalletBalance + $agentGet;
                $agentWallet->save();
                $postAgentBalance = [
                    'p_balance' => $oldAgentWalletBalance,
                    'n_balance' => $agentWallet->balance
                ];

                //Fee Details
                $allAgentFee = [
                    'percentage_fee' => $merchantPercentageFee,
                    'fix_fee' => $merchantFlatFee
                ];

                $transactionAgent = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'agent_id' => $agent->agent_id,
                    'user_id' => $agent->user_id,
                    'provider_id' => $transaction->provider_id,
                    'for' => 'AGENT',
                    'amount' => $agentGet,
                    'currency' => $transaction->currency,
                    'channel_type' => $transaction->channel_type,
                    'transaction_type' => $transaction->transaction_type,
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAgentFee),
                    'wallet_balance' => json_encode($postAgentBalance),
                ]);
                if ($emailTemplate && $notification === true) {
                    $regTemp = str_replace('user_name', $agent->user->name, $emailTemplate->body);
                    $regTemp = str_replace('status', $transactionAgent->status, $regTemp);
                    $regTemp = str_replace('data', $transactionAgent->created_at, $regTemp);
                    $regTemp = str_replace('type', $transactionAgent->transaction_type, $regTemp);
                    $regTemp = str_replace('amount', $transactionAgent->amount, $regTemp);
                    $regTemp = str_replace('currency', $transactionAgent->currency, $regTemp);
                    SendMail::dispatch($agent->user->email, $emailTemplate->subject, $regTemp);
                }
                $createdTransactionIds[] = $transactionAgent->txn_id;
            }

            foreach ($parentAgents as $parentAgent) {
                $agentWallet = Wallet::where('user_id', $parentAgent['user_id'])->where('status', 'ACTIVE')
                    ->where('currency', $transaction->currency)->first();
                if ($agentWallet) {
                    $agentGet = $parentAgent['defferent'];
                    $oldAgentWalletBalance = $agentWallet->balance;
                    $agentWallet->balance = $oldAgentWalletBalance + $agentGet;
                    $agentWallet->save();
                    $postAgentBalance = [
                        'p_balance' => $oldAgentWalletBalance,
                        'n_balance' => $agentWallet->balance
                    ];

                    //Fee Details
                    $allAgentFee = [
                        'percentage_fee' => $parentAgent['fee']['new_fee_percentage'],
                        'fix_fee' => $parentAgent['fee']['new_fixed_amount']
                    ];

                    $transactionAgent = Transaction::create([
                        'txn_id' => uniqid('TXN_'),
                        'agent_id' => $parentAgent['agent_id'],
                        'user_id' => $parentAgent['user_id'],
                        'provider_id' => $transaction->provider_id,
                        'for' => 'AGENT',
                        'amount' => $agentGet,
                        'currency' => $transaction->currency,
                        'channel_type' => $transaction->channel_type,
                        'transaction_type' => $transaction->transaction_type,
                        'status' => 'SUCCESS',
                        'fee_details' => json_encode($allAgentFee),
                        'wallet_balance' => json_encode($postAgentBalance),
                        'fee_type' => 'PAY IN',
                    ]);
                    if ($emailTemplate && $notification === true) {
                        $regTemp = str_replace('user_name', $parentAgent['name'], $emailTemplate->body);
                        $regTemp = str_replace('status', $transactionAgent->status, $regTemp);
                        $regTemp = str_replace('data', $transactionAgent->created_at, $regTemp);
                        $regTemp = str_replace('type', $transactionAgent->transaction_type, $regTemp);
                        $regTemp = str_replace('amount', $transactionAgent->amount, $regTemp);
                        $regTemp = str_replace('currency', $transactionAgent->currency, $regTemp);
                        SendMail::dispatch($parentAgent['email'], $emailTemplate->subject, $regTemp);
                    }
                    $createdTransactionIds[] = $transactionAgent->txn_id;
                }
            }


            $partnerGet = ($agentTotalFeeAmount - $totalCalculatedFee) - $partnerTotalFeeAmount;
            $adminGet = $partnerTotalFeeAmount;

            $settlement = Settlement::where('request_id',$transaction->top_up_request_id)->first();

            if ($partnerWallet) {
                $oldPartnerWalletBalance = $partnerWallet->balance;
                $partnerWallet->balance = $oldPartnerWalletBalance + $partnerGet;
                $partnerWallet->save();
                //Post Wallet Post Balance
                $postPartnerBalance = [
                    'p_balance' => $oldPartnerWalletBalance,
                    'n_balance' => $partnerWallet->balance
                ];

                //Fee Details
                $allPartnerFee = [
                    'percentage_fee' => $agentPercentageFee,
                    'fix_fee' => $agentFlatFee
                ];

                $transactionPartner = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'partner_id' => $partner->partner_id,
                    'user_id' => $partner->user_id,
                    'provider_id' => $transaction->provider_id,
                    'for' => 'PARTNER',
                    'amount' => $partnerGet,
                    'currency' => $transaction->currency,
                    'channel_type' => $transaction->channel_type,
                    'transaction_type' => $transaction->transaction_type,
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allPartnerFee),
                    'wallet_balance' => json_encode($postPartnerBalance),
                    'fee_type' => 'PAY IN',
                ]);
                if ($emailTemplate && $notification === true) {
                    $regTemp = str_replace('user_name', $partner->user->name, $emailTemplate->body);
                    $regTemp = str_replace('status', $transactionPartner->status, $regTemp);
                    $regTemp = str_replace('data', $transactionPartner->created_at, $regTemp);
                    $regTemp = str_replace('type', $transactionPartner->transaction_type, $regTemp);
                    $regTemp = str_replace('amount', $transactionPartner->amount, $regTemp);
                    $regTemp = str_replace('currency', $transactionPartner->currency, $regTemp);
                    SendMail::dispatch($partner->user->email, $emailTemplate->subject, $regTemp);
                }
                $createdTransactionIds[] = $transactionPartner->txn_id;
            }
            if ($superAdminWallet) {
                $oldAdminWalletBalance = $superAdminWallet->balance;
                $superAdminWallet->balance = $oldAdminWalletBalance + $adminGet;
                $superAdminWallet->save();
                //Post Wallet Post Balance
                $postAdminBalance = [
                    'p_balance' => $oldAdminWalletBalance,
                    'n_balance' => $superAdminWallet->balance
                ];

                //Fee Details
                $allAdminFee = [
                    'percentage_fee' => $partnerPercentageFee,
                    'fix_fee' => $partnerFlatFee
                ];
                $transactionAdmin = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'superadmin_id' => $superAdmin->user_id,
                    'user_id' => $superAdmin->user_id,
                    'provider_id' => $transaction->provider_id,
                    'for' => 'SUPER_ADMIN',
                    'amount' => $adminGet,
                    'currency' => $transaction->currency,
                    'channel_type' => $transaction->channel_type,
                    'transaction_type' => $transaction->transaction_type,
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAdminFee),
                    'wallet_balance' => json_encode($postAdminBalance),
                    'fee_type' => 'PAY IN',
                ]);
                if ($emailTemplate && $notification === true) {
                    $regTemp = str_replace('user_name', $superAdmin->name, $emailTemplate->body);
                    $regTemp = str_replace('status', $transactionAdmin->status, $regTemp);
                    $regTemp = str_replace('data', $transactionAdmin->created_at, $regTemp);
                    $regTemp = str_replace('type', $transactionAdmin->transaction_type, $regTemp);
                    $regTemp = str_replace('amount', $transactionAdmin->amount, $regTemp);
                    $regTemp = str_replace('currency', $transactionAdmin->currency, $regTemp);
                    SendMail::dispatch($superAdmin->email, $emailTemplate->subject, $regTemp);
                }
                $createdTransactionIds[] = $transactionAdmin->txn_id;
            }
            if ($settlement && count($createdTransactionIds) > 0) {
                $settlement->transaction_count = ($settlement->transaction_count ?? 0) + count($createdTransactionIds);

                $existingIds = $settlement->transaction_ids ?? [];
                $settlement->transaction_ids = array_merge($existingIds, $createdTransactionIds);

                $settlement->processed_at = now();
                $settlement->save();

                // Link new transactions to settlement
                Transaction::whereIn('txn_id', $createdTransactionIds)
                    ->update(['settlement' => $settlement->settlement_id]);
            }
        } catch (\Exception $ex) {
            Log::info('Merchant webhook error');
        }
    }

        //TODO::Agent Transaction
    public function partnerWebhook($transaction, $superAdmin, $amountAfterFeeDuduct, $partnerPercentageFee, $partnerFlatFee)
    {
        try {
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();


            if ($superAdmin && $superAdminWallet) {


                $percentageFeeAmount = ($transaction->amount * $partnerPercentageFee) / 100;
                $totalFeeAmount = $percentageFeeAmount + $partnerFlatFee;
                $grandAmount=$transaction->amount - $totalFeeAmount;


                $oldWalletBalance = $superAdminWallet->balance;
                $superAdminWallet->balance = $oldWalletBalance + $totalFeeAmount;
                $superAdminWallet->save();

                //Post Wallet Post Balance
                $postBalance = [
                    'p_balance' => $oldWalletBalance,
                    'n_balance' => $superAdminWallet->balance
                ];

                //Fee Details
                $allFee = [
                    'percentage_fee' => $partnerPercentageFee,
                    'fix_fee' => $partnerFlatFee
                ];



                $transaction = Transaction::create([
                    'txn_id' => uniqid('txn_'),
                    'superadmin_id' => $superAdmin->user_id,
                    'amount' => $amountAfterFeeDuduct,
                    'currency' => $transaction->currency,
                    'channel_type' => 'CARD',
                    'transaction_type' => 'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allFee),
                    'wallet_balance' => json_encode($postBalance),
                    'total_fee' => $totalFeeAmount
                ]);
            }

        } catch (\Exception $ex) {
            Log::info('Merchant webhook error');
        }
    }




    //TODO::Merchant Fee
    public function merchantWebhook($transaction, $agent, $amountAfterFeeDuduct, $merchantFlatFee, $merchantPercentageFee)
    {

        try {
            $agentWallet = Wallet::where('user_id', $agent->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            if ($agent && $agentWallet) {

                $oldWalletBalance = $agentWallet->balance;

                $agentWallet->balance = $oldWalletBalance + $amountAfterFeeDuduct;
                $agentWallet->save();

                //Post Wallet Post Balance
                $postBalance = [
                    'p_balance' => $oldWalletBalance,
                    'n_balance' => $agentWallet->balance
                ];

                //Fee Details
                $allFee = [
                    'percentage_fee' => $merchantPercentageFee,
                    'fix_fee' => $merchantFlatFee
                ];

                $percentageFeeAmount = ($transaction->amount * $merchantPercentageFee) / 100;
                $grandFeeAmount = $percentageFeeAmount + $merchantFlatFee;


                $transaction = Transaction::create([
                    'txn_id' => uniqid('txn_'),
                    'agent_id' => $agent->merchant_id,
                    'amount' => $amountAfterFeeDuduct,
                    'currency' => 'USD',
                    'channel_type' => 'CARD',
                    'transaction_type' => 'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allFee),
                    'wallet_balance' => json_encode($postBalance),
                    'total_fee' => $grandFeeAmount
                ]);
            }

        } catch (\Exception $ex) {
            Log::info('Merchant webhook error');
        }
    }



    //TODO::Agent Transaction
    public function agentWebhook($transaction, $partner, $amountAfterFeeDuduct, $agentPercentageFee, $agentFlatFee)
    {

        try {
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            if ($partner && $partnerWallet) {


                $percentageFeeAmount = ($transaction->amount * $agentPercentageFee) / 100;
                $totalFeeAmount = $percentageFeeAmount + $agentFlatFee;
                $grandAmount=$transaction->amount - $totalFeeAmount;


                $oldWalletBalance = $partnerWallet->balance;
                $partnerWallet->balance = $oldWalletBalance + $totalFeeAmount;
                $partnerWallet->save();

                //Post Wallet Post Balance
                $postBalance = [
                    'p_balance' => $oldWalletBalance,
                    'n_balance' => $partnerWallet->balance
                ];

                //Fee Details
                $allFee = [
                    'percentage_fee' => $agentPercentageFee,
                    'fix_fee' => $agentFlatFee
                ];



                $transaction = Transaction::create([
                    'txn_id' => uniqid('txn_'),
                    'partner_id' => $partner->agent_id,
                    'amount' => $amountAfterFeeDuduct,
                    'currency' => $transaction->currency,
                    'channel_type' => 'CARD',
                    'transaction_type' => 'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allFee),
                    'wallet_balance' => json_encode($postBalance),
                    'total_fee' => $totalFeeAmount
                ]);
            }

        } catch (\Exception $ex) {
            Log::info('Merchant webhook error');
        }
    }


    /**
     * Payment endpoint.
     */
    public function pay(Request $request)
    {

        $validator = Validator::make($request->all(), [
            // 'version' => 'required|string',
            // 'signType' => 'required|in:MD5,RSA',
            'merchantNo' => 'required|string',
            // 'date' => 'required|string',
            'channleType' => 'required|string',
            // 'sign' => 'required|string',
            'noticeUrl' => 'required|url',
            'orderNo' => 'required|string|max:36',
            'bizAmt' => 'required|numeric|min:0',
            // 'bankCode' => 'nullable|string',
            // 'accName' => 'nullable|string',
            // 'cardNo' => 'nullable|string',
            'phone' => 'nullable|string',
            'returnUrl' => 'nullable|url',
            'customNo' => 'nullable|string',
            'customName' => 'nullable|string',
            'notes' => 'nullable|string',
            // 'cardAccountType' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => -1,
                'msg' => 'Validation error',
                'detail' => []
            ]);
        }

        $merchant = Merchant::where('api_key', $request->merchantNo)->first();
        if (!$merchant) {
            return response()->json([
                'code' => -1,
                'msg' => 'Merchant not found',
                'detail' => []
            ]);
        }

        $agent = Agent::where('agent_id', $merchant->agent_id)->first();
        if (!$agent) {
            return response()->json([
                'code' => -1,
                'msg' => 'Agent not found',
                'detail' => []
            ]);
        }
        $partner = Partner::where('partner_id', $agent->partner_id)->first();
        if (!$partner) {
            return response()->json([
                'code' => -1,
                'msg' => 'Partner not found',
                'detail' => []
            ]);
        }

        $user = User::where('merchant_id',$merchant->merchant_id)->first();
        if (!$user) {
            return response()->json([
                'code' => -1,
                'msg' => 'User not found',
                'detail' => []
            ]);
        }

        // $userProvider=userProviderFee::where('merchant_id', $merchant->merchant_id)->where('user_type', 'MERCHANT')->pluck('provider_id');

        // if($userProvider->isEmpty()){
        //     return response()->json([
        //         'code' => -1,
        //         'msg' => 'Something went wrong',
        //         'detail' => []
        //     ]);
        // }
        $userProvider=$merchant->enabled_providers;

        $userProviderCollection = collect($userProvider);
        if($userProviderCollection->isEmpty()){
            return response()->json([
                'code' => -1,
                'msg' => 'Something went wrong',
                'detail' => []
            ]);
        }

        $provider=Provider::whereIn('provider_id', $userProvider)
                            ->where('gateway', '!=', 'OFFLINE')
                            ->where('type','PAYIN')->first();

        if(!$provider || $provider->gateway === 'OFFLINE' || !$provider->gateway_info){
            return response()->json([
                'code' => -1,
                'msg' => 'Something went wrong',
                'detail' => []
            ]);
        }

        $wallet = Wallet::where('user_id', $user->user_id)
            ->where('currency', $provider->currency->code)
            ->first();

        if (!$wallet) {
            return response()->json([
                'code' => -1,
                'msg' => 'Wallet not found',
                'detail' => []
            ]);
        }

        $gatewayInfo=$provider->gateway_info?(object)json_decode($provider->gateway_info, true):'';

        //TODO::Defind Blank Veriable
        $apiUrl=null;
        $header=null;


        if($provider->gateway=='PAYADMIN' && isset($gatewayInfo->api_key) || isset($gatewayInfo->endpoint)){
            $header=[
                'Authorization' => 'Bearer '.$gatewayInfo->api_key,
                'accept' => 'application/json',
                'content-type' => 'application/json',
            ];
            $apiUrl=$gatewayInfo->endpoint;
        }

        if ($provider->gateway=='PAYADMIN') {
            if(!$header || !$apiUrl){
                return response()->json([
                    'code' => -1,
                    'msg' => 'Something went wrong',
                    'detail' => []
                ]);
            }
        }

        $topUpRequest = TopUpRequest::create([
            'top_up_request_id' => Str::uuid(),
            'user_id' =>  $user->user_id,
            'partner_id' =>  $user->partner_id,
            'agent_id' => $user->agent_id,
            'merchant_id' => $user->merchant_id,
            'wallet_id' => $wallet->id,
            'user_type' => $user->role,
            'payment_status' => 'unpaid',
            'status' => 'pending',
            'amount' => $request->bizAmt,
            'currency' => $provider->currency->code,
        ]);
        $user_provider_fees = userProviderFee::where('provider_id', $provider->provider_id)
            ->where(function ($query) use ($user) {
                $query->where('user_type', $user->role);

                if ($user->role == 'MERCHANT') {
                    $query->where('merchant_id', $user->merchant_id);
                } elseif ($user->role == 'AGENT') {
                    $query->where('agent_id', $user->agent_id);
                } elseif ($user->role == 'PARTNER') {
                    $query->where('partner_id', $user->partner_id);
                }
            })
            ->first();
        $total_amount =  $topUpRequest->amount + ($topUpRequest->amount * $user_provider_fees->new_fee_percentage / 100) + $user_provider_fees->new_fixed_amount;
        $topUpRequest->provider_id = $provider->provider_id;
        $topUpRequest->payment_method = $provider->gateway;
        $topUpRequest->total_amount = $total_amount;

        if ($provider->partner_id) {
            $topUpRequest->request_for = 'PARTNER';
        }else{
            $topUpRequest->request_for = 'SUPER_ADMIN';
        }

        if ($provider->gateway == 'OFFLINE') {
            $topUpRequest->transaction_id = $request->txn_id;
        }

        $topUpRequest->save();

        // Create transaction
        $transaction = Transaction::create([
            'txn_id' => uniqid('txn_'),
            'merchant_id' => $merchant->merchant_id,
            'agent_id' => $agent->agent_id,
            'partner_id' => $partner->partner_id,
            'amount' => $request->bizAmt,
            'currency' => $topUpRequest->currency, // Use USD as default
            'channel_type' => $request->channleType,
            'transaction_type' => 'PAY_IN',
            'status' => 'PENDING',
            'provider_id' => $provider->provider_id,
            'metadata' => $request->all(),
            'top_up_request_id' => $topUpRequest->top_up_request_id,
            'total_fee' => ($topUpRequest->amount * $provider->new_fee_percentage / 100) + $provider->new_fixed_amount,
        ]);


        $emailTemplate = get_Templates('transaction');
        $notification = get_notifications('transaction_alerts');
        if ($emailTemplate && $notification === true) {
            $regTemp = str_replace('user_name', $user->name, $emailTemplate->body);
            $regTemp = str_replace('status', $transaction->status, $regTemp);
            $regTemp = str_replace('data', $transaction->created_at, $regTemp);
            $regTemp = str_replace('type', $transaction->transaction_type, $regTemp);
            $regTemp = str_replace('amount', $transaction->amount, $regTemp);
            $regTemp = str_replace('currency', $transaction->currency, $regTemp);
            SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
        }
        $updateDatatxn_id = [];

        if ($user->role === 'MERCHANT') {
            $updateDatatxn_id['merchant_id'] = $user->merchant_id;
        } elseif ($user->role === 'AGENT') {
            $updateDatatxn_id['agent_id'] = $user->agent_id;
        } elseif ($user->role === 'PARTNER') {
            $updateDatatxn_id['partner_id'] = $user->partner_id;
        }
        if (!empty($updateDatatxn_id)) {
            $transaction->update($updateDatatxn_id);
        }

        $detail = [];

        //Payment API
        $successReturnUrl = route('success.url', $transaction->txn_id);
        // $webhookUrl='https://webhook.site/f9e39526-3f25-4554-af84-04d765b3aa1c';
        $webhookUrl = route('webhook.url');


        if ($provider->gateway == 'PAYADMIT') {
            $params_body = [
                'paymentType' => 'DEPOSIT',
                'paymentMethod' => 'BASIC_CARD',
                'amount' => $transaction->amount + ($topUpRequest->amount * $provider->new_fee_percentage / 100) + $provider->new_fixed_amount,
                'currency' => $transaction->currency,
                'successReturnUrl' => $successReturnUrl,
                'webhookUrl' => $webhookUrl,
            ];


            $client = new Client(['verify' => false]);
            $response = $client->request('POST', $apiUrl, [
                'headers' => $header,
                'json' => $params_body
            ]);

            $response = $response->getBody()->getContents();
            $response = $response ? json_decode($response, true) : [];


            if (!isset($response['result']) || !isset($response['result']['id'])) {
                return response()->json([
                    'code' => -1,
                    'msg' => 'Something went wrong',
                    'detail' => []
                ]);
            }


            $transaction->result_id = $response['result']['id'];
            $transaction->save();

            if (!isset($response['result']['redirectUrl'])) {
                return response()->json([
                    'code' => -1,
                    'msg' => 'Something went wrong',
                    'detail' => []
                ]);
            }

            $detail = [
                'PayURL' => $response['result']['redirectUrl'],
                'noteNo' => $transaction->txn_id,
                'status' => 'PENDING',
                'createdAt' => $transaction->created_at->format('Y.m.d H:i:s')
            ];
        }


        // Pay-ALCHEMYPAY
        if ($provider->gateway == 'ALCHEMYPAY') {
            $httpMethod = 'GET';
            $requestPath = '/index/rampPageBuy'; // For OnRamp THCdLrzqoC3xKHfHHDBJP8geKxHBEekgNx
            $timestamp = strval(round(microtime(true) * 1000));
            $appId = $gatewayInfo->app_ID;
            $appSecret = $gatewayInfo->app_secret;
            $endpoint = $gatewayInfo->endpoint ?? "https://ramptest.alchemypay.org?";
            $paramsToSign = [
                'crypto' => $provider->currency->code,
                'network' => $gatewayInfo->network ?? 'TRX',
                'showTable' => 'buy',
                'fiat' => $transaction->currency,
                'fiatAmount' => $transaction->amount,
                'merchantOrderNo' => $transaction->txn_id,
                'timestamp' => $timestamp,
                'appId' => $appId,
                'redirectUrl' => $request->returnUrl,
                'address' => $gatewayInfo->address
            ];
            $rawDataToSign = $this->getStringToSign($paramsToSign);
            $requestPathWithQuery = $requestPath . '?' . $rawDataToSign;
            $signature = $this->generateSignature($timestamp, $httpMethod, $requestPathWithQuery, $appSecret);
            $finalUrl = $endpoint . $rawDataToSign . "&sign=" . $signature;
            $detail = [
                'PayURL' => $finalUrl,
                'noteNo' => $transaction->txn_id,
                'status' => 'PENDING',
                'createdAt' => $transaction->created_at->format('Y.m.d H:i:s')
            ];
            Log::info($detail);
        }

        return response()->json([
            'code' => 0,
            'msg' => '',
            'detail' => $detail
        ]);
    }

    /**
     * Defray (payout) endpoint.
     */
    public function defray(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'version' => 'required|string',
            'signType' => 'required|in:MD5,RSA',
            'merchantNo' => 'required|string',
            'date' => 'required|string',
            'channleType' => 'required|string',
            'sign' => 'required|string',
            'orderNo' => 'required|string|max:36',
            'bizAmt' => 'required|numeric|min:0',
            'customName' => 'nullable|string',
            'accName' => 'required|string',
            'acctNo' => 'nullable|string',
            'cardAccountType' => 'nullable|string',
            'noticeUrl' => 'nullable|url',
            'country' => 'nullable|string',
            'phone' => 'nullable|string',
            'notes' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => -1,
                'msg' => 'Validation error',
                'detail' => []
            ]);
        }

        $merchant = Merchant::where('api_key', $request->merchantNo)->first();
        if (!$merchant) {
            return response()->json([
                'code' => -1,
                'msg' => 'Merchant not found',
                'detail' => []
            ]);
        }
        $user = User::where('merchant_id',$merchant->merchant_id)->first();
        if (!$user) {
            return response()->json([
                'code' => -1,
                'msg' => 'User not found',
                'detail' => []
            ]);
        }
        $agent = Agent::where('agent_id', $merchant->agent_id)->first();
        if (!$agent) {
            return response()->json([
                'code' => -1,
                'msg' => 'Agent not found',
                'detail' => []
            ]);
        }
        $partner = Partner::where('partner_id', $agent->partner_id)->first();
        if (!$partner) {
            return response()->json([
                'code' => -1,
                'msg' => 'Partner not found',
                'detail' => []
            ]);
        }

        // $userProvider=userProviderFee::where('merchant_id', $merchant->merchant_id)->where('user_type', 'MERCHANT')->pluck('provider_id');
        $userProvider=$merchant->enabled_providers;

        $userProviderCollection = collect($userProvider);
        if($userProviderCollection->isEmpty()){
            return response()->json([
                'code' => -1,
                'msg' => 'Something went wrong',
                'detail' => []
            ]);
        }

        $provider=Provider::whereIn('provider_id', $userProvider)
        ->where('gateway', '!=', 'OFFLINE')
        ->where('type','PAYOUT')->first();

        if(!$provider || $provider->gateway === 'OFFLINE' || !$provider->gateway_info){
            return response()->json([
                'code' => -1,
                'msg' => 'Something went wrong',
                'detail' => []
            ]);
        }

        $wallet = Wallet::where('user_id', $user->user_id)
            ->where('currency', $provider->currency->code)
            ->first();

        if (!$wallet) {
            return response()->json([
                'code' => -1,
                'msg' => 'Wallet not found',
                'detail' => []
            ]);
        }
        if ($wallet->balance <= $request->bizAmt) {
            return response()->json([
                'code' => -1,
                'msg' => "You don't have that much in your balance",
                'detail' => []
            ]);
        }

        $others = [];

        if ($provider->gateway === 'PAYCOMBAT') {

            $others = [
                'purpose_code'          => 'SELF',
                'first_name'          => $request->customName,
                'payout_method_name'    => $request->cardAccountType,
                'account_number'    => $request->acctNo,
                'country'    => $request->country ?? 'UK',
            ];
        } elseif ($provider->gateway === 'KWIKWIRE') {

            $others = [
                'card_type'   => $request->cardAccountType,
                'card_number' => $request->acctNo,
                'expire_date' => $request->date,
                'card_name'   => $request->accName,
                'phone'       => $request->phone,
                'email'       => $user->email,
            ];
        }

        if ($user->role == 'MERCHANT') {
            $provider_fee = userProviderFee::where('user_type', 'MERCHANT')
            ->where('provider_id', $provider->provider_id)
            ->where('merchant_id', $user->merchant_id)->first();
        }
        $percentage_fee = ($provider_fee->new_fee_percentage * $request->amount) / 100;
        $grandFeeAmount = $provider_fee->new_fixed_amount + $percentage_fee;

        $payout = PayoutRequest::create([
            'user_id' => $user->user_id,
            'amount'  => $request->bizAmt,
            'fee_amount'  => $grandFeeAmount,
            'currency' => $provider->currency,
            'gateway' => $provider->alias,
            'provider_id' => $provider->provider_id,
            'comment' => $request->notes ?? null,
            'others'  => json_encode($others),
            'status'  => 'pending',
        ]);
        // Create payout transaction
        $transaction = Transaction::create([
            'txn_id' => uniqid('payout_'),
            'merchant_id' => $merchant->merchant_id,
            'agent_id' => $agent->agent_id,
            'partner_id' => $partner->partner_id,
            'amount' => $request->bizAmt,
            'currency' => 'CNY',
            'channel_type' => $request->channleType,
            'transaction_type' => 'PAYOUT',
            'status' => 'PENDING',
            'recipient_details' => [
                'accName' => $request->accName,
                'acctNo' => $request->acctNo,
            ],
            'metadata' => $request->all()
        ]);

        $wallet->balance = $wallet->balance - $request->amount;
        $wallet->held_balance = $wallet->held_balance + $request->amount;
        $wallet->save();

        if ($provider->settlement == 'T+0') {
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
            if ($emailTemplate && $notification === true) {
                $regTemp = str_replace('user_name', $user->name, $emailTemplate->body);
                $regTemp = str_replace('status', $transaction->status, $regTemp);
                $regTemp = str_replace('data', $transaction->created_at, $regTemp);
                $regTemp = str_replace('type', $transaction->transaction_type, $regTemp);
                $regTemp = str_replace('amount', $transaction->amount, $regTemp);
                $regTemp = str_replace('currency', $transaction->currency, $regTemp);
                SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
            }
            if ($provider->gateway === 'PAYCOMBAT') {
                $gatewayInfo=$provider->gateway_info?(object)json_decode($provider->gateway_info, true):'';
                $personal_access_token = $gatewayInfo->api_key;
                $signatureKey = $gatewayInfo->api_secret;
                $client = new Client();
                $others = json_decode($payout->others, true);

                $payout_beneficiary_param = [
                    "individual" => [
                        "first_name" => $others['first_name']
                    ],
                    "account_number" => $others['account_number'],
                ];
                $dataPaycombat = [
                    "payout_beneficiary_param" => $payout_beneficiary_param,
                    "sender_amount" => $payout->amount,
                    "sender_currency" => $payout->currency,
                    "sender_country" => $others['country'] ?? '',
                    "beneficiary_amount" => $payout->amount,
                    "beneficiary_currency" => $payout->currency,
                    "payout_method_name" => $others['payout_method_name'] ?? '',
                    "order_id" => $payout->id,
                    "purpose_code" => $others['purpose_code'] ?? ''
                ];
                $jsonEncodedData = json_encode($dataPaycombat, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
                $signature = hash_hmac('sha256', $jsonEncodedData, $signatureKey);

                $headers = [
                    'X-token' => $personal_access_token,
                    'signature' => $signature,
                    'Content-Type' => 'application/json'
                ];
                try {
                    $res = $client->post('https://api.paycombat.com/api/v1/payout/create-payout', [
                        'headers' => $headers,
                        'json' => $dataPaycombat
                    ]);

                    $responseData = json_decode($res->getBody()->getContents(), true);
                    Log::info('PayCombat Payout Response', $responseData);
                } catch (\Exception $e) {
                    return $e;
                    return response()->json([
                        'code' => -1,
                        'msg' => 'Something went wrong',
                        'detail' => []
                    ]);
                }
            } elseif ($provider->gateway === 'KWIKWIRE') {

                $others = json_decode($payout->others, true);
                try {

                    if (!$provider || !$provider->gateway_info) {
                        return response()->json([
                            'code' => -1,
                            'msg' => 'Provider or gateway info missing',
                            'detail' => []
                        ]);
                    }

                    $gatewayInfo = json_decode($provider->gateway_info);

                    if (!$gatewayInfo || !isset($gatewayInfo->private_key)) {
                        return response()->json([
                            'code' => -1,
                            'msg' => 'Invalid gateway info',
                            'detail' => []
                        ]);
                    }

                    if (!$others) {
                        return response()->json([
                            'code' => -1,
                            'msg' => 'Invalid payout data',
                            'detail' => []
                        ]);
                    }

                    $percentageFee  = $provider_fee->new_fee_percentage;
                    $fixedFee       = $provider_fee->new_fixed_amount;

                    $totalFee = ($provider->amount * $percentageFee / 100) + $fixedFee;
                    $giveAmount = $provider->amount - $totalFee;

                    $client = new Client();

                    $response = $client->post('https://kwikwire.net/api/users/transactions', [
                        'headers' => [
                            'Accept'        => 'application/json',
                            'Content-Type'  => 'application/json',
                            'Authorization' => 'Bearer ' .$gatewayInfo->private_key,
                        ],
                        'json' => [
                            'payment_method'    => 'custom_bank_account',
                            'transaction_type'  => 'withdrawals',
                            'payment_info' => [
                                'name' => $others['name'],
                                'address' => $others['address'],
                                'city' => $others['city'],
                                'zip' => $others['zip'],
                                'country' => $others['country'],
                                'phone' => $others['phone'],
                                'holder_name' => $others['holder_name'],
                                'account_number' => $others['account_number'],
                                'routing_number' => $others['routing_number'],
                                'additional_information' => $others['additional_information'],
                            ],
                            'balance' => [
                                'credit' => (string) $giveAmount,
                                'credit_currency' => $others['currency']
                            ]
                        ]
                    ]);

                    $result = json_decode($response->getBody(), true);

                    return response()->json([
                        'code' => 0,
                        'msg' => 'Success',
                        'detail' => [$result]
                    ]);

                } catch (\GuzzleHttp\Exception\ClientException $e) {
                    return response()->json([
                        'code' => -1,
                        'msg' => 'API error',
                        'detail' => [json_decode($e->getResponse()->getBody()->getContents(), true)]
                    ]);

                } catch (\Exception $e) {
                    return response()->json([
                        'code' => -1,
                        'msg' => '$e->getMessage()',
                        'detail' => []
                    ]);
                }
            }
        }else {
            $time = Carbon::now();

            if ($provider->settlement == 'T+1') {
                $time = $time->copy()->addDay();
            } elseif ($provider->settlement == 'T+2') {
                $time = $time->copy()->addDays(2);
            } elseif ($provider->settlement == 'T+3') {
                $time = $time->copy()->addDays(3);
            }
            $settlement = Settlement::create([
                'settlement_id' => Str::uuid(),
                'partner_id' => $user->partner_id,
                'agent_id' => $user->agent_id,
                'merchant_id' => $user->merchant_id,
                'settlement_date' => $time,
                'cutoff_time' => '',
                'total_amount' => $payout->amount,
                'net_amount' => $payout->amount,
                'currency' => $payout->currency,
                'status' => 'PENDING',
                'fee_amount' => $payout->fee_amount,
                'request_id' => $payout->id,
                'user_type' => $user->role,
                'transaction_type' => 'PAYOUT',
                'settlement_type' => $provider->settlement,
            ]);

            $payout->status = 'pending';
            $payout->save();

            $emailTemplate = get_Templates('settlement');
            $notification = get_notifications('settlement_notifications');
            if ($emailTemplate && $notification === true) {
                $regTemp = str_replace('status', $settlement->status, $emailTemplate->body);
                $regTemp = str_replace('data', $settlement->updated_at, $regTemp);
                $regTemp = str_replace('type', $settlement->transaction_type, $regTemp);
                $regTemp = str_replace('amount', $settlement->net_amount, $regTemp);
                $regTemp = str_replace('currency', $settlement->currency, $regTemp);
                SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
            }
        }

        return response()->json([
            'code' => 0,
            'msg' => '',
            'detail' => []
        ]);
    }

    /**
     * Transaction query endpoint.
     */
    public function query(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'version' => 'required|string',
            'signType' => 'required|in:MD5,RSA',
            'merchantNo' => 'required|string',
            'date' => 'required|string',
            'sign' => 'required|string',
            'orderNo' => 'required|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'code' => -1,
                'msg' => 'Validation error',
                'detail' => []
            ]);
        }

        $merchant = Merchant::where('api_key', $request->merchantNo)->first();
        if (!$merchant) {
            return response()->json([
                'code' => -1,
                'msg' => 'Merchant not found',
                'detail' => []
            ]);
        }


        $transaction = Transaction::where('txn_id', $request->orderNo)
            ->where('merchant_id', $merchant->merchant_id)
            ->first();

        if (!$transaction) {
            return response()->json([
                'code' => -1,
                'msg' => 'Transaction not found',
                'detail' => []
            ]);
        }

        $status = $transaction->status == 'SUCCESS' ? 1 : ($transaction->status == 'PENDING' ? 0 : 2);

        $detail = [
            'orderNo' => $transaction->txn_id,
            'bizAmt' => $transaction->amount,
            'status' => $status,
            'remark' => $transaction->failure_reason ?? ''
        ];

        return response()->json([
            'code' => 0,
            'msg' => '',
            'detail' => $detail
        ]);
    }

    /**
     * Asynchronous callback endpoint for merchant notifications.
     */
    public function callback(Request $request)
    {
        $data = $request->all();

        // Find transaction
        $transaction = Transaction::where('txn_id', $data['orderNo'] ?? $data['txn_id'])->first();
        if ($transaction) {
            $status = isset($data['status']) ?
                ($data['status'] == 1 ? 'SUCCESS' : ($data['status'] == 2 ? 'FAILED' : 'PENDING')) :
                $transaction->status;

            $transaction->update([
                'status' => $status,
                'processed_at' => now()
            ]);

            // If payment was successful and not already processed, process it
            if ($status === 'SUCCESS' && !$transaction->processed_at) {
                $this->processSuccessfulPayment($transaction);
            }
        }

        return response('SUCCESS');
    }

    /**
     * Process successful payment (extracted for reuse)
     */
    private function processSuccessfulPayment(Transaction $transaction)
    {
        $feeService = app(\App\Services\FeeService::class);
        $feeService->calculateAndDistributeFees($transaction);

        // Add net amount to merchant wallet
        $merchant = $transaction->merchant;
        $user = $merchant->user;
        if ($user) {
            $wallet = $user->wallets()->where('currency', $transaction->currency)->first();
            if (!$wallet) {
                $wallet = \App\Models\Wallet::create([
                    'user_id' => $user->user_id,
                    'balance' => 0,
                    'currency' => $transaction->currency
                ]);
            }

            $netAmount = $transaction->amount - ($transaction->estimated_cost ?? 0);
            $wallet->increment('balance', $netAmount);
        }
    }


    // Generate HMAC SHA256 signature
    private function generateSignature($timestamp, $httpMethod, $requestPath, $secretKey)
    {
        $signatureString = $timestamp . $httpMethod . $requestPath;

        $signature = base64_encode(hash_hmac('sha256', $signatureString, $secretKey, true));

        return urlencode($signature);
    }

    // Sort parameters and build query string
    private function getStringToSign($params)
    {
        ksort($params);
        $s2s = '';
        foreach ($params as $k => $v) {
            if (is_array($v)) continue;
            else if (!empty($v)) $s2s .= "{$k}={$v}&";
        }
        return rtrim($s2s, '&');
    }
}
