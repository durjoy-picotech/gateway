<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Merchant;
use App\Models\Partner;
use App\Models\ProviderWallet;
use App\Models\Settlement;
use App\Models\TopUpRequest;
use App\Models\Transaction;
use App\Models\User;
use App\Models\userProviderFee;
use App\Models\Provider;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Carbon\Carbon;
use App\Events\SendMail;
use Illuminate\Support\Str;
class TopUpWebhookController extends Controller
{

    public function successReturnUrl(Request $request)
    {
        $txnId = $request->input('txnId') ?? $request->input('trxId');
        $transaction=Transaction::where('txn_id', $txnId)->first();

        if(!$transaction){
            Log::info('PAY-IN-PAYADMIN-WEBHOOK-ERRPR');
            return;
        }

        $metaData = $transaction->metadata ? json_decode($transaction->metadata) : null;
        if($metaData->returnUrl){
            $rtnUrl=$metaData->returnUrl.'?txn='.$transaction->txn_id;
            return redirect()->to($rtnUrl);
        }

        return 'SUCCESS';
    }

    public function declineReturnUrl($id)
    {
        if(!$id){
            return;
        }

        $transaction=Transaction::where('txn_id', $id)->first();

        $topUpRequest = TopUpRequest::where('top_up_request_id', $transaction->top_up_request_id)->first();
        if(!$topUpRequest){
            Log::info('PAY-IN-PAYADMIN-WEBHOOK-ERRPR');
            return;
        }
        $user = User::where('user_id',$topUpRequest->user_id)->first();
        if(!$user){
            Log::info('PAY-IN-PAYADMIN-WEBHOOK-ERRPR');
            return;
        }
        $topUpRequest->status = 'cancelled';
        $topUpRequest->save();


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

        $metadata = json_decode($transaction->metadata);
        if ($metadata->returnUrl) {
            return redirect()->to($metadata->returnUrl);
        }else{
            return redirect()->to('https://google.com');
        }
        return 'SUCCESS';
    }

    public function handlePG0002Webhook(Request $request)
    {
        $requestData = $request->all();

        $requestData=$requestData?json_decode($requestData):'';

        if(!$requestData || !isset($requestData->orderNo)){
            return;
        }

        $topUpRequest = TopUpRequest::where('top_up_request_id', $requestData->merchantOrderNo)->first();
        if (!$topUpRequest) {
            Log::warning('PAY-IN-WEBHOOK: TopUpRequest not found', ['transaction_id' => $transaction->id]);
            return;
        }
        $user = User::where('user_id', $topUpRequest->user_id)->first();
        if (!$user) {
            Log::warning('PAY-IN-WEBHOOK: User not found', ['user_id' => $topUpRequest->user_id]);
            return;
        }
        $wallet = Wallet::where('user_id', $user->user_id)
            ->where('currency', $topUpRequest->currency)
            ->first();

        if (!$wallet) {
            Log::warning('PAY-IN-WEBHOOK: Wallet not found', ['user_id' => $user->user_id]);
            return;
        }
        $provider = Provider::where('provider_id', $topUpRequest->provider_id)
            ->where('status', 'active')
            ->first();

        if (!$provider) {
            Log::warning('PAY-IN-WEBHOOK: Provider not found', ['provider_id' => $topUpRequest->provider_id]);
            return;
        }
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

        $total_fee =  ($requestData->cryptoAmountInUSDT * $user_provider_fees->new_fee_percentage / 100) + $user_provider_fees->new_fixed_amount;
        $total_amount_get =  $requestData->cryptoAmountInUSDT - $total_fee;

        $transaction = Transaction::create([
            'txn_id' => uniqid('txn_'),
            'merchant_id' => $user->merchant_id,
            'agent_id' => $user->agent_id,
            'partner_id' => $user->partner_id,
            'provider_id' => $topUpRequest->provider_id,
            'amount' => $requestData->cryptoAmountInUSDT,
            'currency' => $topUpRequest->currency,
            'channel_type' => 'CARD',
            'transaction_type' => 'PAY_IN',
            'status' => 'PENDING',
            'top_up_request_id' => $topUpRequest->top_up_request_id,
            'metadata' => json_encode([
                'requestData' => $requestData,
                'orderNo' => $requestData->orderNo
            ]),
        ]);
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

        if (!$transaction) {
            Log::warning('PAY-IN-WEBHOOK: Transaction not found', ['top_up_request_id' => $requestData->merchantOrderNo]);
            return;
        }

        if ($requestData->status === 'FINISHED' || $requestData->status === 'PAY_SUCCESS') {
            // if ($provider->settlement === 'T+0') {
                $this->distributeAllUsersFee($transaction->id);

                $wallet->balance += $total_amount_get;
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
            //         'total_amount' => $requestData->cryptoAmountInUSDT,
            //         'net_amount' => $requestData->cryptoAmountInUSDT,
            //         'currency' => $topUpRequest->currency,
            //         'status' => 'PENDING',
            //         'fee_amount' => $total_fee,
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
        }elseif($requestData->status === 'PAY_FAIL'){
            $topUpRequest->status = 'rejected';
            $topUpRequest->save();

            $transaction->status = 'FAILED';
            $transaction->save();

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
        }

        return 'SUCCESS';
    }
    public function webhookUrl(Request $request)
    {

        $requestData = $request->all();
        $requestData=$requestData?json_decode($requestData):'';

        if (!$requestData || !isset($requestData->id)) {
            Log::warning('PAY-IN-WEBHOOK: Invalid or missing ID in payload');
            return;
        }

        $transaction = Transaction::where('result_id', $requestData->id)
            ->first();

        if (!$transaction) {
            Log::warning('PAY-IN-WEBHOOK: Transaction not found', ['id' => $requestData->id]);
            return;
        }

        $topUpRequest = TopUpRequest::where('top_up_request_id', $transaction->top_up_request_id)->first();
        if (!$topUpRequest) {
            Log::warning('PAY-IN-WEBHOOK: TopUpRequest not found', ['transaction_id' => $transaction->id]);
            return;
        }

        $user = User::where('user_id', $topUpRequest->user_id)->first();
        if (!$user) {
            Log::warning('PAY-IN-WEBHOOK: User not found', ['user_id' => $topUpRequest->user_id]);
            return;
        }

        $wallet = Wallet::where('user_id', $user->user_id)
            ->where('currency', $topUpRequest->currency)
            ->first();

        if (!$wallet) {
            Log::warning('PAY-IN-WEBHOOK: Wallet not found', ['user_id' => $user->user_id]);
            return;
        }

        $provider = Provider::where('provider_id', $topUpRequest->provider_id)
            ->where('status', 'active')
            ->first();

        if (!$provider) {
            Log::warning('PAY-IN-WEBHOOK: Provider not found', ['provider_id' => $topUpRequest->provider_id]);
            return;
        }

        // if ($provider->settlement === 'T+0') {
            $this->distributeAllUsersFee($transaction->id);

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
        return 'SUCCESS';
    }

    public function distributeAllUsersFee($transaction_id){

        $transaction = Transaction::where('id', $transaction_id)->first();


        //TODO:: Make Sure for this transaction is a payout or payin
        $topUpRequest = TopUpRequest::where('top_up_request_id', $transaction->top_up_request_id)->first();
        if(!$topUpRequest){
            Log::info('PAY-IN-PAYADMIN-WEBHOOK-ERRPR');
            return;
        }

        $provider = Provider::where('provider_id', $topUpRequest->provider_id)
            ->where('status', 'active')
            ->first();

        if (!$provider) {
            Log::info('PAY-IN-PAYADMIN-WEBHOOK-PROVIDER-NOT-FOUND');
            return;
        }
        if ($provider->partner_id && $topUpRequest->request_for === 'PARTNER') {
            if($topUpRequest->user_type == 'MERCHANT'){
                //TODO::Provider Charge
                $merchant=Merchant::where('merchant_id', $topUpRequest->merchant_id)->where('status', 'ACTIVE')->first();
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
                $partnerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)->where('provider_id',$topUpRequest->provider_id)->first();
                $agentFee=userProviderFee::where('user_type', 'AGENT')->where('agent_id', $agent->agent_id)->where('provider_id',$topUpRequest->provider_id)->first();
                $merchantFee=userProviderFee::where('user_type', 'MERCHANT')->where('merchant_id', $merchant->merchant_id)->where('provider_id',$topUpRequest->provider_id)->first();
                //TODO::Percentage Fee
                $agentPercentageFee=0;
                $merchantPercentageFee=0;
                $partnerPercentageFee=0;
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

                if ($agent->parent_agent_id) {
                    $this->merchantDistributionFeeForAgentParentPartner($merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner);
                }else{
                    $this->merchantDistributionFeeForPartner($merchant,$merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$transaction,$agent,$partner);
                }
            }
            elseif($topUpRequest->user_type == 'AGENT'){

                $agent=Agent::where('agent_id', $topUpRequest->agent_id)->where('status', 'ACTIVE')->first();
                if(!$agent){
                    return;
                }
                $partner=Partner::where('partner_id', $agent->partner_id)->where('status', 'ACTIVE')->first();
                if(!$partner){
                    return;
                }
                $partnerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)->where('provider_id',$topUpRequest->provider_id)->first();
                $agentFee=userProviderFee::where('user_type', 'AGENT')->where('agent_id', $agent->agent_id)->where('provider_id',$topUpRequest->provider_id)->first();
                //TODO::Percentage Fee
                $agentPercentageFee=0;
                $partnerPercentageFee=0;
                //Agent
                if($agentFee && $agentFee->new_fee_percentage){
                    $agentPercentageFee=$agentFee->new_fee_percentage;
                }
                //Partner
                if($partnerFee && $partnerFee->new_fee_percentage){
                    $partnerPercentageFee=$partnerFee->new_fee_percentage;
                }
                //TODO::Flat Fee
                $agentFlatFee=0;
                $partnerFlatFee=0;
                //Agent
                if($agentFee && $agentFee->new_fixed_amount){
                    $agentFlatFee=$agentFee->new_fixed_amount;
                }
                //Partner
                if($partnerFee && $partnerFee->new_fixed_amount){
                    $partnerFlatFee=$partnerFee->new_fixed_amount;
                }
                if ($agent->parent_agent_id) {
                    $this->agentDistributionFeeForAgentParentPartner($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner);
                }else{
                    $this->agentDistributionFeeForPartner($agent,$agentPercentageFee, $agentFlatFee,$transaction,$partner);
                }
            }
        }else{
            if($topUpRequest->user_type == 'MERCHANT'){
                //TODO::Provider Charge
                $merchant=Merchant::where('merchant_id', $topUpRequest->merchant_id)->where('status', 'ACTIVE')->first();
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
                $partnerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)->where('provider_id',$topUpRequest->provider_id)->first();
                $agentFee=userProviderFee::where('user_type', 'AGENT')->where('agent_id', $agent->agent_id)->where('provider_id',$topUpRequest->provider_id)->first();
                $merchantFee=userProviderFee::where('user_type', 'MERCHANT')->where('merchant_id', $merchant->merchant_id)->where('provider_id',$topUpRequest->provider_id)->first();
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

                if ($agent->parent_agent_id) {
                   $this->merchantDistributionFeeForAgentParent($merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin);
                }else{
                    $this->merchantDistributionFee($merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin);
                }
            }else if($topUpRequest->user_type == 'AGENT'){


                $agent=Agent::where('agent_id', $topUpRequest->agent_id)->where('status', 'ACTIVE')->first();
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
                $partnerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)->where('provider_id',$topUpRequest->provider_id)->first();
                $agentFee=userProviderFee::where('user_type', 'AGENT')->where('agent_id', $agent->agent_id)->where('provider_id',$topUpRequest->provider_id)->first();
                //TODO::Percentage Fee
                $partnerPercentageFee=0;
                $agentPercentageFee=0;
                //Partner
                if($partnerFee && $partnerFee->new_fee_percentage){
                    $partnerPercentageFee=$partnerFee->new_fee_percentage;
                }
                //Agent
                if($agentFee && $agentFee->new_fee_percentage){
                    $agentPercentageFee=$agentFee->new_fee_percentage;
                }
                //TODO::Flat Fee
                $partnerFlatFee=0;
                $agentFlatFee=0;
                //Partner
                if($partnerFee && $partnerFee->new_fixed_amount){
                    $partnerFlatFee=$partnerFee->new_fixed_amount;
                }
                //Agent
                if($agentFee && $agentFee->new_fixed_amount){
                    $agentFlatFee=$agentFee->new_fixed_amount;
                }


                $finalPercentageFee= $partnerPercentageFee + $agentPercentageFee;
                $finalFixFee=$partnerFlatFee + $agentFlatFee;

                $percentageFeeAmount=($transaction->amount * $finalPercentageFee) / 100;
                $grandFeeAmount=$finalFixFee + $percentageFeeAmount;
                $amountAfterFeeDuduct=$transaction->amount - $grandFeeAmount;

                if ($agent->parent_agent_id) {
                    $this->agentDistributionFeeForAgentParent($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin);
                }else{
                    $this->agentDistributionFee($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin);
                }
            }else if($topUpRequest->user_type == 'PARTNER'){


                $partner=Partner::where('partner_id', $topUpRequest->partner_id)->where('status', 'ACTIVE')->first();
                if(!$partner){
                    return;
                }
                $superAdmin=User::where('role', 'SUPER_ADMIN')->first();
                if(!$superAdmin){
                    return;
                }
                $partnerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)->where('provider_id',$topUpRequest->provider_id)->first();
                //TODO::Percentage Fee
                $partnerPercentageFee=0;
                //Partner
                if($partnerFee && $partnerFee->new_fee_percentage){
                    $partnerPercentageFee=$partnerFee->new_fee_percentage;
                }
                //TODO::Flat Fee
                $partnerFlatFee=0;
                //Partner
                if($partnerFee && $partnerFee->new_fixed_amount){
                    $partnerFlatFee=$partnerFee->new_fixed_amount;
                }


                $finalPercentageFee= $partnerPercentageFee;
                $finalFixFee=$partnerFlatFee;

                $percentageFeeAmount=($transaction->amount * $finalPercentageFee) / 100;
                $grandFeeAmount=$finalFixFee + $percentageFeeAmount;
                $amountAfterFeeDuduct=$transaction->amount - $grandFeeAmount;

                $this->adminDistributionFee($partnerPercentageFee, $partnerFlatFee,$transaction,$partner,$superAdmin);
            }
        }

    }

    private function merchantDistributionFee($merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin){
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
                    'user_id' => $agent->user->user_id,
                    'provider_id' => $transaction->provider_id,
                    'for' => 'AGENT',
                    'amount' => $agentGet,
                    'currency' => $transaction->currency,
                    'channel_type' => $transaction->channel_type,
                    'transaction_type' => $transaction->transaction_type,
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAgentFee),
                    'wallet_balance' => json_encode($postAgentBalance),
                    // 'total_fee' => $merchantGrandFeeAmount,
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
                    'user_id' => $partner->user->user_id,
                    'provider_id' => $transaction->provider_id,
                    'for' => 'PARTNER',
                    'amount' => $partnerGet,
                    'currency' => $transaction->currency,
                    'channel_type' => $transaction->channel_type,
                    'transaction_type' => $transaction->transaction_type,
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allPartnerFee),
                    'wallet_balance' => json_encode($postPartnerBalance),
                    // 'total_fee' => $agentTotalFeeAmount,
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
                    // 'total_fee' => $partnerTotalFeeAmount,
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
    private function agentDistributionFee($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin){
        try {
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');

            $agentTotalFeeAmount = (($transaction->amount * $agentPercentageFee) / 100) + $agentFlatFee;

            $partnerTotalFeeAmount = (($agentTotalFeeAmount * $partnerPercentageFee) / 100) + $partnerFlatFee;

            $partnerGet = $agentTotalFeeAmount - $partnerTotalFeeAmount;
            $adminGet = $partnerTotalFeeAmount;

            $settlement = Settlement::where('request_id',$transaction->top_up_request_id)->first();

            $createdTransactionIds = [];
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
                    // 'total_fee' => $agentTotalFeeAmount,
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
                    // 'total_fee' => $partnerTotalFeeAmount,
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
    private function adminDistributionFee($partnerPercentageFee, $partnerFlatFee,$transaction,$partner,$superAdmin){
        try {
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
            $partnerTotalFeeAmount = (($transaction->amount * $partnerPercentageFee) / 100) + $partnerFlatFee;

            $adminGet = $partnerTotalFeeAmount;

            $settlement = Settlement::where('request_id',$transaction->top_up_request_id)->first();

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
                $transaction = Transaction::create([
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
                    // 'total_fee' => $partnerTotalFeeAmount,
                    'fee_type' => 'PAY IN',
                ]);
                if ($emailTemplate && $notification === true) {
                    $regTemp = str_replace('user_name', $superAdmin->name, $emailTemplate->body);
                    $regTemp = str_replace('status', $transaction->status, $regTemp);
                    $regTemp = str_replace('data', $transaction->created_at, $regTemp);
                    $regTemp = str_replace('type', $transaction->transaction_type, $regTemp);
                    $regTemp = str_replace('amount', $transaction->amount, $regTemp);
                    $regTemp = str_replace('currency', $transaction->currency, $regTemp);
                    SendMail::dispatch($superAdmin->email, $emailTemplate->subject, $regTemp);
                }
                if ($settlement) {
                    $settlement->transaction_count = ($settlement->transaction_count ?? 0) + 1;

                    $transactionIds = $settlement->transaction_ids ?? [];
                    $transactionIds[] = $transaction->txn_id;
                    $settlement->transaction_ids = $transactionIds;

                    $settlement->processed_at = now();
                    $settlement->save();

                    $transaction->settlement =  $settlement->settlement_id;
                    $transaction->save();
                }
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
    private function agentDistributionFeeForAgentParent($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner,$superAdmin){
        try {
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $createdTransactionIds = [];
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');

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
                    // 'total_fee' => $partnerTotalFeeAmount,
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
    private function merchantDistributionFeeForAgentParentPartner($merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner){
        try {
            $agentWallet = Wallet::where('user_id', $agent->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $createdTransactionIds = [];
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
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


            $partnerGet = ($agentTotalFeeAmount - $totalCalculatedFee);

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
    private function agentDistributionFeeForAgentParentPartner($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$transaction,$agent,$partner){
        try {
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $createdTransactionIds = [];
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');

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


            $partnerGet = ($agentTotalFeeAmount - $totalCalculatedFee);

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

    private function merchantDistributionFeeForPartner($merchant,$merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$transaction,$agent,$partner){
        try {
            $agentWallet = Wallet::where('user_id', $agent->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
            $merchantGrandFeeAmount = (($transaction->amount * $merchantPercentageFee) / 100) + $merchantFlatFee;

            $agentTotalFeeAmount = (($merchantGrandFeeAmount * $agentPercentageFee) / 100) + $agentFlatFee;


            $agentGet = $merchantGrandFeeAmount - $agentTotalFeeAmount;
            $partnerGet = $agentTotalFeeAmount;

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
                    'provider_id' => $transaction->provider_id,
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
                    'provider_id' => $transaction->provider_id,
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
    private function agentDistributionFeeForPartner($agent,$agentPercentageFee,$agentFlatFee,$transaction,$partner){
        try {
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $transaction->currency)->first();
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');

            $agentTotalFeeAmount = (($transaction->amount * $agentPercentageFee) / 100) + $agentFlatFee;


            $partnerGet = $agentTotalFeeAmount;

            $settlement = Settlement::where('request_id',$transaction->top_up_request_id)->first();

            $createdTransactionIds = [];
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

}
