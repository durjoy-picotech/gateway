<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Settlement;
use Illuminate\Support\Facades\Log;
use App\Models\TopUpRequest;
use App\Models\Transaction;
use App\Models\ProviderWallet;
use App\Models\Wallet;
use App\Models\User;
use App\Models\Provider;
use App\Models\userProviderFee;
use App\Models\PayoutRequest;
use Carbon\Carbon;
use App\Http\Controllers\TopUpWebhookController;
use App\Http\Controllers\PayOutWebhookController;
use GuzzleHttp\Client;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Validator;
use App\Events\SendMail;
class SettlementCommand extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'app:settlements';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Command description';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $settlements = Settlement::where('settlement_type', '!=', 'T+0')
                        ->where('status','PENDING')
                        ->orderBy('created_at', 'asc')
                        ->take(50)
                        ->get();

        foreach ($settlements as $settlement) {
            $today = Carbon::today();
            $settlementDate = Carbon::parse($settlement->settlement_date);
            if ($settlementDate <= $today) {
                if ($settlement->transaction_type == 'PAYIN') {
                    $top_up_request = TopUpRequest::where('top_up_request_id',$settlement->request_id)->first();
                    $user = User::where('user_id',$top_up_request->user_id)->first();
                    $wallet = Wallet::where('user_id', $user->user_id)
                            ->where('currency', $top_up_request->currency)
                            ->first();
                    $provider = Provider::where('provider_id', $payout->provider_id)->first();
                    if ($provider->gateway !== 'OFFLINE') {
                        if ($top_up_request && $user && $wallet) {
                            $wallet->balance = $wallet->balance + $top_up_request->amount;
                            $wallet->save();

                            $top_up_request->payment_status = 'paid';
                            $top_up_request->status = 'approved';
                            $top_up_request->save();

                            $transaction = Transaction::where('top_up_request_id',$top_up_request->top_up_request_id)->first();
                            if ($transaction) {
                                $transaction->status = 'SUCCESS';
                                $transaction->provider_id = $top_up_request->provider_id;
                                $transaction->save();
                            }

                            $providerWallet=ProviderWallet::where('provider_id',$top_up_request->provider_id)
                                            ->where('currency', $top_up_request->currency)
                                            ->first();
                            if(!$providerWallet){
                                $providerWallet=new ProviderWallet();
                                $providerWallet->provider_id=$top_up_request->provider_id;
                                $providerWallet->currency=$top_up_request->currency;
                            }

                            $providerWallet->balance += $top_up_request->total_amount;
                            $providerWallet->save();



                            $fees= new TopUpWebhookController();
                            $fees->distributeAllUsersFee($transaction->id);

                            $settlement->status = 'COMPLETED';
                            $settlement->transaction_count = ($settlement->transaction_count ?? 0) + 1;
                            $transactionIds = $settlement->transaction_ids ?? [];
                            $transactionIds[] = $transaction->txn_id;
                            $settlement->transaction_ids = $transactionIds;
                            $settlement->save();
                            if ($transaction) {
                                $transaction->settlement =  $settlement->settlement_id;
                                $transaction->save();
                            }
                        }else{
                            $settlement->status = 'FAILED';
                            $settlement->failure_reason = 'Top-Up Request not found';
                            $settlement->save();
                        }
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
                }elseif($settlement->transaction_type == 'PAYOUT'){
                    $payout = PayoutRequest::where('id',$settlement->request_id)->first();
                    $user = User::where('user_id',$payout->user_id)->first();
                    $provider = Provider::where('provider_id', $payout->provider_id)->first();
                    if ($provider->gateway !== 'OFFLINE') {
                        if ($payout && $user && $provider) {
                            if ($provider->gateway === 'OFFLINE') {
                                $fees= new PayOutWebhookController();
                                $fees->distributeAllUsersFee($payout->id);
                                $providerWallet = ProviderWallet::where('provider_id', $payout->provider_id)
                                                ->where('currency', $payout->currency)
                                                ->first();
                                if (!$providerWallet) {
                                    $providerWallet = new ProviderWallet();
                                    $providerWallet->provider_id = $payout->provider_id;
                                    $providerWallet->currency = $payout->currency;
                                }
                                $providerWallet->balance =  $providerWallet->balance - $payout->amount;
                                $providerWallet->save();

                                $wallet = Wallet::where('user_id', $user->user_id)
                                        ->where('currency', $payout->currency)
                                        ->first();

                                $wallet->held_balance = $wallet->held_balance - $payout->amount;
                                $wallet->save();

                                $payout->status = 'approved';
                                $payout->save();

                                $settlement->status = 'COMPLETED';
                                $settlement->save();
                            }elseif($provider->gateway === 'PAYCOMBAT'){
                                $this->PAYCOMBAT($payout);
                            }
                            elseif ($provider->gateway === 'KWIKWIRE') {
                                $response = $this->KWIKWIRE($payout);

                                if (!$response['status']) {
                                    $settlement->status = 'FAILED';
                                    $settlement->failure_reason = $response['message'];
                                    $settlement->save();
                                    return response()->json([
                                        'success' => false,
                                        'message' => $response['message'],
                                        'data'    => $response['data'],
                                    ], 400);
                                }
                                $fees= new PayOutWebhookController();
                                $fees->distributeAllUsersFee($payout->id);
                                $providerWallet = ProviderWallet::where('provider_id', $payout->provider_id)
                                                ->where('currency', $payout->currency)
                                                ->first();
                                if (!$providerWallet) {
                                    $providerWallet = new ProviderWallet();
                                    $providerWallet->provider_id = $payout->provider_id;
                                    $providerWallet->currency = $payout->currency;
                                }
                                $providerWallet->balance =  $providerWallet->balance - $payout->amount;
                                $providerWallet->save();

                                $wallet = Wallet::where('user_id', $user->user_id)
                                ->where('currency', $payout->currency)
                                ->first();
                                $wallet->held_balance = $wallet->held_balance - $payout->amount;
                                $wallet->save();

                                $payout->status = 'approved';
                                $payout->comment = $response['data'];
                                $payout->save();

                                $settlement->status = 'COMPLETED';
                                $settlement->save();
                            }
                        }else{
                            $settlement->status = 'FAILED';
                            $settlement->failure_reason = 'Pay-Out Request not found';
                            $settlement->save();
                        }
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

                }

            }

        }
        $this->info('Settlement command executed successfully!');
    }
    private function PAYCOMBAT($data)
    {
        $provider=Provider::where('provider_id', $data->provider_id)->first();

        if(!$provider || !$provider->gateway_info){
            return response()->json([
                'code' => -1,
                'msg' => 'Something went wrong',
                'detail' => []
            ]);
        }
        $gatewayInfo=$provider->gateway_info?(object)json_decode($provider->gateway_info, true):'';

        $personal_access_token = $gatewayInfo->api_key;
        $signatureKey = $gatewayInfo->api_secret;

        $client = new Client();
        $others = json_decode($data->others, true);

        $payout_beneficiary_param = [
            "individual" => [
                "first_name" => $others['first_name']
            ],
            "account_number" => $others['account_number'],
        ];

        $dataPaycombat = [
            "payout_beneficiary_param" => $payout_beneficiary_param,
            "sender_amount" => $data->amount,
            "sender_currency" => $data->currency,
            "sender_country" => $others['country'] ?? '',
            "beneficiary_amount" => $data->amount,
            "beneficiary_currency" => $data->currency,
            "payout_method_name" => $others['payout_method_name'] ?? '',
            "order_id" => $data->id,
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
            Log::error('PayCombat API Error: ' . $e->getMessage());
            throw new \Exception('Failed to send payout request to PayCombat API: ' . $e->getMessage());
        }
    }
    private function KWIKWIRE($data)
    {
        try {
            $provider = Provider::where('provider_id', $data->provider_id)->first();
            $user = User::where('user_id',$data->user_id)->first();
            if(!$user){
                return [
                    'status' => false,
                    'message' => 'User not found',
                    'data' => null
                ];
            }
            if (!$provider || !$provider->gateway_info) {
                return [
                    'status' => false,
                    'message' => 'Provider or gateway info missing',
                    'data' => null
                ];
            }

            $gatewayInfo = json_decode($provider->gateway_info);

            if (!$gatewayInfo || !isset($gatewayInfo->private_key)) {
                return [
                    'status' => false,
                    'message' => 'Invalid gateway info',
                    'data' => null
                ];
            }
            $others =  json_decode($data->others, true);

            if (!$others) {
                return [
                    'status' => false,
                    'message' => 'Invalid payout data',
                    'data' => null
                ];
            }

            if ($user->role == 'MERCHANT') {
                $providerFee=userProviderFee::where('user_type', 'MERCHANT')->where('merchant_id', $user->merchant_id)->where('provider_id',$provider->provider_id)->first();
            }elseif($user->role == 'AGENT'){
                $providerFee=userProviderFee::where('user_type', 'AGENT')->where('agent_id', $user->agent_id)->where('provider_id',$provider->provider_id)->first();
            }elseif($user->role == 'PARTNER'){
                $providerFee=userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $user->partner_id)->where('provider_id',$provider->provider_id)->first();
            }

            if (!$providerFee) {
                return [
                    'status' => false,
                    'message' => 'Provider Fee not found',
                    'data' => null
                ];
            }
            $percentageFee  = $providerFee->new_fee_percentage;
            $fixedFee       = $providerFee->new_fixed_amount;

            $totalFee = ($data->amount * $percentageFee / 100) + $fixedFee;
            $giveAmount = $data->amount - $totalFee;

            $client = new Client();
            $response = $client->post('https://kwikwire.net/api/users/transactions', [
                'headers' => [
                    'Accept'        => 'application/json',
                    'Content-Type'  => 'application/json',
                    'Authorization' => 'Bearer '.$gatewayInfo->private_key,
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

            $result = $response->getBody()->getContents();

            return [
                'status' => true,
                'message' => 'Success',
                'data' =>  $result
            ];

        } catch (\Exception $e) {
            Log::info($e);
            return [
                'status' => false,
                'message' => $e->getMessage(),
                'data' => null
            ];
        }
    }
}
