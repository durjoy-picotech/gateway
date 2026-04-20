<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Merchant;
use App\Models\Partner;
use App\Models\Settlement;
use App\Models\User;
use App\Models\userProviderFee;
use App\Models\Wallet;
use Illuminate\Support\Facades\Log;
use App\Models\PayoutRequest;
use App\Models\Transaction;
use App\Events\SendMail;
class PayOutWebhookController extends Controller
{
    public function distributeAllUsersFee($id)
    {
        $payout = PayoutRequest::where('id',$id)->first();
        if(!$payout){
            Log::info('PAY-OUT-ERRPR');
            return;
        }
        $user = User::where('user_id',$payout->user_id)->first();
        if(!$user){
            Log::info('PAY-OUT-USER-ERRPR');
            return;
        }

        if ($user->role == 'MERCHANT') {

            $merchant=Merchant::where('merchant_id', $user->merchant_id)->where('status', 'ACTIVE')->first();
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

            $partnerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)->where('provider_id',$payout->provider_id)->first();
            $agentFee=userProviderFee::where('user_type', 'AGENT')->where('agent_id', $agent->agent_id)->where('provider_id',$payout->provider_id)->first();
            $merchantFee=userProviderFee::where('user_type', 'MERCHANT')->where('merchant_id', $merchant->merchant_id)->where('provider_id',$payout->provider_id)->first();

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
                $this->merchantDistributionFeeForAgentParent($merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$payout,$merchant,$agent,$partner,$superAdmin);
            }else{
                $this->merchantDistributionFee($merchant,$merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$payout,$agent,$partner,$superAdmin);
            }
        } else if($user->role == 'AGENT'){

            $agent=Agent::where('agent_id', $user->agent_id)->where('status', 'ACTIVE')->first();
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
            $partnerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)->where('provider_id',$payout->provider_id)->first();
            $agentFee=userProviderFee::where('user_type', 'AGENT')->where('agent_id', $agent->agent_id)->where('provider_id',$payout->provider_id)->first();
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

            $percentageFeeAmount=($payout->amount * $finalPercentageFee) / 100;
            $grandFeeAmount=$finalFixFee + $percentageFeeAmount;
            

            if ($agent->parent_agent_id) {
                $this->agentDistributionFeeForAgentParent($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$payout,$agent,$partner,$superAdmin);
            }else{
                $this->agentDistributionFee($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$payout,$agent,$partner,$superAdmin);
            }

        }
        else if($user->role == 'PARTNER'){

            $partner=Partner::where('partner_id', $user->partner_id)->where('status', 'ACTIVE')->first();
            if(!$partner){
                return;
            }
            $superAdmin=User::where('role', 'SUPER_ADMIN')->first();
            if(!$superAdmin){
                return;
            }
            $partnerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)->where('provider_id',$payout->provider_id)->first();
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

            $percentageFeeAmount=($payout->amount * $finalPercentageFee) / 100;

            $this->adminDistributionFee($partnerPercentageFee, $partnerFlatFee,$payout,$partner,$superAdmin);


            
        }

        
        
    }
    private function merchantDistributionFee($merchant,$merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$payout,$agent,$partner,$superAdmin){
        try {
            $merchantWallet = Wallet::where('user_id', $merchant->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $agentWallet = Wallet::where('user_id', $agent->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();

            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');

            $merchantGrandFeeAmount = (($payout->amount * $merchantPercentageFee) / 100) + $merchantFlatFee;

            $agentTotalFeeAmount = (($merchantGrandFeeAmount * $agentPercentageFee) / 100) + $agentFlatFee;

            $partnerTotalFeeAmount = (($agentTotalFeeAmount * $partnerPercentageFee) / 100) + $partnerFlatFee;


            $agentGet = $merchantGrandFeeAmount - $agentTotalFeeAmount;
            $partnerGet = $agentTotalFeeAmount - $partnerTotalFeeAmount;
            $adminGet = $partnerTotalFeeAmount;
            $settlement = Settlement::where('request_id',$payout->id)->first();
            $createdTransactionIds = [];
            if ($merchantWallet) {
                $oldMerchantWalletBalance = $merchantWallet->balance;
                $payOutAmount = $payout->amount;
                // $merchantWallet->balance = $oldMerchantWalletBalance - $payOutAmount;
                // $merchantWallet->save();
                //Post Wallet Post Balance
                $postAgentBalance = [
                    'p_balance' => $oldMerchantWalletBalance,
                    'n_balance' => $merchantWallet->balance
                ];

                //Fee Details
                $allAgentFee = [
                    'percentage_fee' => $merchantPercentageFee,
                    'fix_fee' => $merchantFlatFee
                ];

                $transactionMerchant = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'merchant_id' => $merchant->merchant_id,
                    'user_id' => $merchant->user_id,
                    'amount' => $payout->amount,
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_OUT',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAgentFee),
                    'wallet_balance' => json_encode($postAgentBalance),
                    'total_fee' => $merchantGrandFeeAmount
                ]);
                $createdTransactionIds[] = $transactionMerchant->txn_id;
            }
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
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAgentFee),
                    'wallet_balance' => json_encode($postAgentBalance),
                    // 'total_fee' => $merchantGrandFeeAmount
                    'fee_type' => 'PAY OUT',
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
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allPartnerFee),
                    'wallet_balance' => json_encode($postPartnerBalance),
                    // 'total_fee' => $agentTotalFeeAmount
                    'fee_type' => 'PAY OUT',
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
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAdminFee),
                    'wallet_balance' => json_encode($postAdminBalance),
                    // 'total_fee' => $partnerTotalFeeAmount
                    'fee_type' => 'PAY OUT',
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

                Transaction::whereIn('txn_id', $createdTransactionIds)
                    ->update(['settlement' => $settlement->settlement_id]);
            }
        } catch (\Exception $ex) {
            Log::info($ex);
        }
    }
    private function agentDistributionFee($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$payout,$agent,$partner,$superAdmin){
        try {
            $agentWallet = Wallet::where('user_id', $agent->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();

            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
            $agentTotalFeeAmount = (($payout->amount * $agentPercentageFee) / 100) + $agentFlatFee;

            $partnerTotalFeeAmount = (($agentTotalFeeAmount * $partnerPercentageFee) / 100) + $partnerFlatFee;


            $partnerGet = $agentTotalFeeAmount - $partnerTotalFeeAmount;
            $adminGet = $partnerTotalFeeAmount;
            $settlement = Settlement::where('request_id',$payout->id)->first();
            $createdTransactionIds = [];
            if ($agentWallet) {
                $oldAgentWalletBalance = $agentWallet->balance;
                $payOutAmount = $payout->amount;
                // $agentWallet->balance = $oldAgentWalletBalance - $payOutAmount;
                // $agentWallet->save();
                //Post Wallet Post Balance
                $postAgentBalance = [
                    'p_balance' => $oldAgentWalletBalance,
                    'n_balance' => $agentWallet->balance
                ];

                //Fee Details
                $allAgentFee = [
                    'percentage_fee' => $agentPercentageFee,
                    'fix_fee' => $agentFlatFee
                ];

                $transactionAgent = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'agent_id' => $agent->agent_id,
                    'user_id' => $agent->user_id,
                    'amount' => $payout->amount,
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_OUT',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAgentFee),
                    'wallet_balance' => json_encode($postAgentBalance),
                    'total_fee' => $agentTotalFeeAmount
                ]);
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
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allPartnerFee),
                    'wallet_balance' => json_encode($postPartnerBalance),
                    // 'total_fee' => $agentTotalFeeAmount
                    'fee_type' => 'PAY OUT',
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
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAdminFee),
                    'wallet_balance' => json_encode($postAdminBalance),
                    // 'total_fee' => $partnerTotalFeeAmount
                    'fee_type' => 'PAY OUT',
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

                Transaction::whereIn('txn_id', $createdTransactionIds)
                    ->update(['settlement' => $settlement->settlement_id]);
            }
        } catch (\Exception $ex) {
            Log::info($ex);
        }
    }
    private function adminDistributionFee($partnerPercentageFee, $partnerFlatFee,$payout,$partner,$superAdmin){
        try {
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
            $partnerTotalFeeAmount = (($payout->amount * $partnerPercentageFee) / 100) + $partnerFlatFee;


            $adminGet = $partnerTotalFeeAmount;
            $settlement = Settlement::where('request_id',$payout->id)->first();
            $createdTransactionIds = [];

            if ($partnerWallet) {
                $oldPartnerWalletBalance = $partnerWallet->balance;
                $payOutAmount = $payout->amount;
                // $partnerWallet->balance = $oldPartnerWalletBalance - $payOutAmount;
                // $partnerWallet->save();
                //Post Wallet Post Balance
                $postPartnerBalance = [
                    'p_balance' => $oldPartnerWalletBalance,
                    'n_balance' => $partnerWallet->balance
                ];

                //Fee Details
                $allPartnerFee = [
                    'percentage_fee' => $partnerPercentageFee,
                    'fix_fee' => $partnerFlatFee
                ];

                $transactionPartner = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'partner_id' => $partner->partner_id,
                    'user_id' => $partner->user_id,
                    'amount' => $payout->amount,
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_OUT',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allPartnerFee),
                    'wallet_balance' => json_encode($postPartnerBalance),
                    'total_fee' => $partnerTotalFeeAmount
                ]);
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
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAdminFee),
                    'wallet_balance' => json_encode($postAdminBalance),
                    // 'total_fee' => $partnerTotalFeeAmount
                    'fee_type' => 'PAY OUT',
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

                Transaction::whereIn('txn_id', $createdTransactionIds)
                    ->update(['settlement' => $settlement->settlement_id]);
            }
        } catch (\Exception $ex) {
            Log::info($ex);
        }
    }
    private function merchantDistributionFeeForAgentParent($merchantPercentageFee,$merchantFlatFee,$agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$payout,$merchant,$agent,$partner,$superAdmin){
        try {
            $merchantWallet = Wallet::where('user_id', $merchant->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $agentWallet = Wallet::where('user_id', $agent->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');
            $createdTransactionIds = [];

            $merchantGrandFeeAmount = (($payout->amount * $merchantPercentageFee) / 100) + $merchantFlatFee;

            $agentTotalFeeAmount = (($payout->amount * $agentPercentageFee) / 100) + $agentFlatFee;

            $partnerTotalFeeAmount = (($payout->amount * $partnerPercentageFee) / 100) + $partnerFlatFee;

            $parentAgents = [];
            $currentAgent = $agent;
            $base_amount_used = $agentTotalFeeAmount;
            $amont = $payout->amount;

            while ($currentAgent && $currentAgent->parent_agent_id) {
                $parent = Agent::where('agent_id', $currentAgent->parent_agent_id)
                    ->where('status', 'ACTIVE')
                    ->first();

                if (!$parent) {
                    break;
                }

                $parentFee = userProviderFee::where('user_type', 'AGENT')
                    ->where('agent_id', $parent->agent_id)
                    ->where('provider_id', $payout->provider_id)
                    ->first();

                $percentage = $parentFee->new_fee_percentage;
                $flat = $parentFee->new_fixed_amount;

                // Calculate based on the *previous level’s* fee
                $parentFeeAmount = (($amont * $percentage) / 100) + $flat;

                $parentAgents[] = [
                    'user_id' => $parent->user->user_id,
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


        $totalCalculatedFee = collect($parentAgents)->sum('calculated_fee_amount');


            if ($merchantWallet) {
                $oldMerchantWalletBalance = $merchantWallet->balance;
                $payOutAmount = $payout->amount;
                // $merchantWallet->balance = $oldMerchantWalletBalance - $payOutAmount;
                // $merchantWallet->save();
                //Post Wallet Post Balance
                $postAgentBalance = [
                    'p_balance' => $oldMerchantWalletBalance,
                    'n_balance' => $merchantWallet->balance
                ];

                //Fee Details
                $allAgentFee = [
                    'percentage_fee' => $merchantPercentageFee,
                    'fix_fee' => $merchantFlatFee
                ];

                $transactionMerchant = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'merchant_id' => $merchant->merchant_id,
                    'user_id' => $merchant->user_id,
                    'amount' => $payout->amount,
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_OUT',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAgentFee),
                    'wallet_balance' => json_encode($postAgentBalance),
                    'total_fee' => $merchantGrandFeeAmount
                ]);
                $createdTransactionIds[] = $transactionMerchant->txn_id;
            }
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
                    'provider_id' => $payout->provider_id,
                    'for' => 'AGENT',
                    'amount' => $agentGet,
                    'currency' => $payout->currency,
                    'channel_type' => 'CARD',
                    'transaction_type' => 'PAY_IN',
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
                    ->where('currency', $payout->currency)->first();
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
                        'provider_id' => $payout->provider_id,
                        'for' => 'AGENT',
                        'amount' => $agentGet,
                        'currency' => $payout->currency,
                        'channel_type' => 'CARD',
                        'transaction_type' => 'PAY_IN',
                        'status' => 'SUCCESS',
                        'fee_details' => json_encode($allAgentFee),
                        'wallet_balance' => json_encode($postAgentBalance),
                        'fee_type' => 'PAY OUT',
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


            $partnerGet = ($agentTotalFeeAmount - $partnerTotalFeeAmount) - $partnerTotalFeeAmount;
            $adminGet = $partnerTotalFeeAmount;

            $settlement = Settlement::where('request_id',$payout->top_up_request_id)->first();

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
                    'provider_id' => $payout->provider_id,
                    'for' => 'PARTNER',
                    'amount' => $partnerGet,
                    'currency' => $payout->currency,
                    'channel_type' => 'CARD',
                    'transaction_type' => 'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allPartnerFee),
                    'wallet_balance' => json_encode($postPartnerBalance),
                    'fee_type' => 'PAY OUT',
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
                    'provider_id' => $payout->provider_id,
                    'for' => 'SUPER_ADMIN',
                    'amount' => $adminGet,
                    'currency' => $payout->currency,
                    'channel_type' => 'CARD',
                    'transaction_type' => 'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAdminFee),
                    'wallet_balance' => json_encode($postAdminBalance),
                    'fee_type' => 'PAY OUT',
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
            Log::info($ex);
        }
    }
    private function agentDistributionFeeForAgentParent($agentPercentageFee, $agentFlatFee,$partnerPercentageFee, $partnerFlatFee,$payout,$agent,$partner,$superAdmin){
        try {
            $agentWallet = Wallet::where('user_id', $agent->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $partnerWallet = Wallet::where('user_id', $partner->user->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $superAdminWallet = Wallet::where('user_id', $superAdmin->user_id)->where('status', 'ACTIVE')
                ->where('currency', $payout->currency)->first();
            $createdTransactionIds = [];

            $emailTemplate = get_Templates('transaction');
            $notification = get_notifications('transaction_alerts');

            $agentTotalFeeAmount = (($payout->amount * $agentPercentageFee) / 100) + $agentFlatFee;

            $partnerTotalFeeAmount = (($payout->amount * $partnerPercentageFee) / 100) + $partnerFlatFee;

            $parentAgents = [];
            $currentAgent = $agent;
            $base_amount_used = $agentTotalFeeAmount;
            $amont = $payout->amount;

            while ($currentAgent && $currentAgent->parent_agent_id) {
                $parent = Agent::where('agent_id', $currentAgent->parent_agent_id)
                    ->where('status', 'ACTIVE')
                    ->first();

                if (!$parent) {
                    break;
                }

                $parentFee = userProviderFee::where('user_type', 'AGENT')
                    ->where('agent_id', $parent->agent_id)
                    ->where('provider_id', $payout->provider_id)
                    ->first();

                $percentage = $parentFee->new_fee_percentage;
                $flat = $parentFee->new_fixed_amount;

                // Calculate based on the *previous level’s* fee
                $parentFeeAmount = (($amont * $percentage) / 100) + $flat;

                $parentAgents[] = [
                    'user_id' => $parent->user->user_id,
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


            $totalCalculatedFee = collect($parentAgents)->sum('calculated_fee_amount');

            foreach ($parentAgents as $parentAgent) {
                $agentWallet = Wallet::where('user_id', $parentAgent['user_id'])->where('status', 'ACTIVE')
                    ->where('currency', $payout->currency)->first();
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
                        'provider_id' => $payout->provider_id,
                        'for' => 'AGENT',
                        'amount' => $agentGet,
                        'currency' => $payout->currency,
                        'channel_type' => 'CARD',
                        'transaction_type' => 'PAY_IN',
                        'status' => 'SUCCESS',
                        'fee_details' => json_encode($allAgentFee),
                        'wallet_balance' => json_encode($postAgentBalance),
                        'fee_type' => 'PAY OUT',
                    ]);
                    $createdTransactionIds[] = $transactionAgent->txn_id;
                }
            }


            $partnerGet = ($agentTotalFeeAmount - $partnerTotalFeeAmount) - $partnerTotalFeeAmount;
            $adminGet = $partnerTotalFeeAmount;

            $settlement = Settlement::where('request_id',$payout->id)->first();

            if ($agentWallet) {
                $oldAgentWalletBalance = $agentWallet->balance;
                $payOutAmount = $payout->amount;
                // $agentWallet->balance = $oldAgentWalletBalance - $payOutAmount;
                // $agentWallet->save();
                //Post Wallet Post Balance
                $postAgentBalance = [
                    'p_balance' => $oldAgentWalletBalance,
                    'n_balance' => $agentWallet->balance
                ];

                //Fee Details
                $allAgentFee = [
                    'percentage_fee' => $agentPercentageFee,
                    'fix_fee' => $agentFlatFee
                ];

                $transactionAgent = Transaction::create([
                    'txn_id' => uniqid('TXN_'),
                    'agent_id' => $agent->agent_id,
                    'user_id' => $agent->user_id,
                    'amount' => $payout->amount,
                    'currency' => $payout->currency,
                    'provider_id' => $payout->provider_id,
                    'channel_type' => 'CARD',
                    'transaction_type' =>'PAY_OUT',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAgentFee),
                    'wallet_balance' => json_encode($postAgentBalance),
                    'total_fee' => $agentTotalFeeAmount
                ]);
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
                    'provider_id' => $payout->provider_id,
                    'for' => 'PARTNER',
                    'amount' => $partnerGet,
                    'currency' => $payout->currency,
                    'channel_type' => 'CARD',
                    'transaction_type' => 'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allPartnerFee),
                    'wallet_balance' => json_encode($postPartnerBalance),
                    'fee_type' => 'PAY OUT',
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
                    'provider_id' => $payout->provider_id,
                    'for' => 'SUPER_ADMIN',
                    'amount' => $adminGet,
                    'currency' => $payout->currency,
                    'channel_type' => 'CARD',
                    'transaction_type' => 'PAY_IN',
                    'status' => 'SUCCESS',
                    'fee_details' => json_encode($allAdminFee),
                    'wallet_balance' => json_encode($postAdminBalance),
                    // 'total_fee' => $partnerTotalFeeAmount,
                    'fee_type' => 'PAY OUT',
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
            Log::info($ex);
        }
    }
}
