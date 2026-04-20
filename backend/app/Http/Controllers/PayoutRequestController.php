<?php

namespace App\Http\Controllers;

use App\Models\Transaction;
use App\Models\userProviderFee;
use Illuminate\Http\Request;
use App\Models\PayoutRequest;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Settlement;
use App\Models\ProviderWallet;
use GuzzleHttp\Client;
use Illuminate\Support\Str;
use Carbon\Carbon;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;
use App\Events\SendMail;
use Illuminate\Auth\Events\Verified;
use Illuminate\Container\Attributes\Log as AttributesLog;
use Illuminate\Support\Facades\Http;
class PayoutRequestController extends Controller
{

    public function index(Request $request)
    {
        $page = $request->query('page', 1);
        $limit = $request->query('limit', 10);

        $user = User::where('user_id', $request->user_id)->first();
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }
        if ($user->role !== 'SUPER_ADMIN') {
            $payouts = PayoutRequest::with('user', 'provider')->where('user_id', $request->user_id)
                ->orderBy('created_at', 'desc')
                ->paginate($limit, ['*'], 'page', $page);

        } else {
            $payouts = PayoutRequest::with('user', 'provider')->orderBy('created_at', 'desc')
                ->paginate($limit, ['*'], 'page', $page);

        }

        return response()->json([
            'success' => true,
            'data' => [
                'payouts' => $payouts->items(),
                'pagination' => [
                    'page' => $payouts->currentPage(),
                    'limit' => $payouts->perPage(),
                    'total' => $payouts->total(),
                    'last_page' => $payouts->lastPage(),
                ],
            ],
        ]);
    }

    public function store(Request $request)
    {
        try {
            $user = User::where('user_id', $request->user_id)->first();
            if (!$user) {
                return response()->json([
                    'success' => false,
                    'message' => 'User not found.',
                ], 404);
            }

            $oldPayoutRequest = PayoutRequest::where('user_id', $user->user_id)
                ->where('provider_id', $request->provider_id)
                ->where('status', 'pending')
                ->where('created_at', '>=', now()->subSeconds(30))
                ->first();

            if ($oldPayoutRequest) {
                return response()->json([
                    'success' => false,
                    'message' => 'You have already requested a payout. Please wait a few seconds before requesting again.',
                ], 429);
            }

            $wallet = Wallet::where('user_id', $user->user_id)->where('currency', $request->currency)->first();
            if (!$wallet) {
                return response()->json([
                    'success' => false,
                    'message' => 'Wallet not found.',
                ], 404);
            }

            // Optional: Uncomment if you want to check balance
            if ($wallet->balance <= $request->amount) {
                return response()->json([
                    'success' => false,
                    'message' => "You don't have that much in your balance",
                ], 400);
            }
            $provider = Provider::where('provider_id', $request->provider_id)->first();
            if (!$provider) {
                return response()->json([
                    'success' => false,
                    'message' => 'Provider not found.',
                ], 429);
            }
            $gatewayInfo=$provider->gateway_info?(object)json_decode($provider->gateway_info, true):'';

            $others = [];

            if ($request->gateway === 'PAYCOMBAT') {
                $request->validate([
                    'amount'         => 'required|numeric|min:1',
                    'method'         => 'required|string',
                    'country'        => 'required|string',
                    'currency'       => 'required|string',
                    'account_number' => 'required|string',
                    'comment'        => 'nullable|string',
                ]);

                $others = [
                    'purpose_code'          => 'SELF',
                    'first_name'          => $user->name,
                    'payout_method_name'    => $request->method,
                    'account_number'    => $request->account_number,
                    'country'    => $request->country,
                ];
            } elseif ($request->gateway === 'KWIKWIRE') {
                $request->validate([
                    'amount'                => 'required|numeric',
                    'currency'              => 'required|string',
                    'country'               => 'required|string',
                    'phone'                 => 'required|string',
                    'holder_name'           => 'required|string',
                    'account_number'        => 'required|numeric',
                    'routing_number'        => 'required|numeric',
                ]);
                $max = $gatewayInfo->max;
                $min = $gatewayInfo->min;
                if ($max && $request->amount > $max) {
                    return response()->json([
                        'success' => false,
                        'message' => "Max amount is $max",
                    ], 429);
                }
                else if ($min && $request->amount < $min) {
                    return response()->json([
                        'success' => false,
                        'message' => "Min amount is $min",
                    ], 429);
                }
                $others = [
                    'name'                  => $user->name,
                    'amount'                => $request->amount,
                    'currency'              => $request->currency,
                    'country'               => $request->country,
                    'phone'                 => $request->phone,
                    'holder_name'           => $request->holder_name,
                    'account_number'        => $request->account_number,
                    'routing_number'        => $request->routing_number,
                    'address'               => $request->address,
                    'city'                  => $request->city,
                    'zip'                   => $request->zip,
                    'additional_information'=> $request->additional_information,
                ];
            } elseif ($request->gateway === 'OFFLINE') {
                $request->validate([
                    'amount'       => 'required|numeric',
                    'currency'     => 'required|string',
                    'details'      => 'nullable|string',
                ]);
                $others = [
                    'details'   => $request->details,
                ];
            }



            if ($user->role == 'MERCHANT') {
                $provider_fee = userProviderFee::where('user_type', 'MERCHANT')->where('merchant_id', $user->merchant_id)->first();
            } else if ($user->role == 'AGENT') {
                $provider_fee = userProviderFee::where('user_type', 'AGENT')->where('agent_id', $user->agent_id)->first();
            } else if ($user->role == 'PARTNER') {
                $provider_fee = userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $user->partner_id)->first();
            }

            $percentage_fee = ($provider_fee->new_fee_percentage * $request->amount) / 100;
            $grandFeeAmount = $provider_fee->new_fixed_amount + $percentage_fee;


            $payout = PayoutRequest::create([
                'user_id' => $user->user_id,
                'amount'  => $request->amount,
                'fee_amount'  => $grandFeeAmount,
                'currency' => $request->currency,
                'gateway' => $provider->alias,
                'provider_id' => $provider->provider_id,
                'comment' => $request->comment ?? null,
                'others'  => json_encode($others),
                'status'  => 'pending',
            ]);

            $wallet->balance = $wallet->balance - $request->amount;
            $wallet->held_balance = $wallet->held_balance + $request->amount;
            $wallet->save();
            if ($provider->settlement == 'T+0' && $provider->gateway !== 'OFFLINE') {
                if ($provider->gateway === 'PAYCOMBAT') {
                    $this->PAYCOMBAT($payout);
                } elseif ($provider->gateway === 'KWIKWIRE') {
                    $response = $this->KWIKWIRE($payout);

                    if (!$response['status']) {
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

                    $wallet->held_balance = $wallet->held_balance - $payout->amount;
                    $wallet->save();

                    $payout->status = 'approved';
                    $payout->comment = $response['data'];
                    $payout->save();
                    return response()->json([
                        'success' => true,
                        'message' => 'Payout successful.',
                        'data'    => $response['data'],
                    ]);
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
                'success' => true,
                'message' => 'Payout request submitted successfully.',
                'data'    => $payout,
            ]);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return response()->json([
                'success' => false,
                'message' => 'Validation failed',
                'errors'  => $e->errors(),
            ], 422);
        } catch (\Exception $e) {
            Log::info($e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'An error occurred while submitting payout request',
                'error'   => $e->getMessage(),
            ], 500);
        }
    }

    public function updateStatus(Request $request, $id)
    {
        $payout = PayoutRequest::where('id',$id)->first();
        $settlement = Settlement::where('request_id', $payout->id)->first();
        $provider = Provider::where('provider_id', $request->provider_id)->first();
        if (!$settlement && $request->status !== 'approved') {
            $payout->status = $request->status;
            $payout->save();
            return response()->json([
                'success' => true,
                'message' => 'Settlement status updated successfully'
            ]);
        }
        if (!$settlement) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'SETTLEMENT_NOT_FOUND',
                    'message' => 'Settlement not found'
                ]
            ], 404);
        }
        if (!$provider) {
            return response()->json([
                'success' => false,
                'message' => 'Provider not found.',
            ], 429);
        }
        if (!$payout) {
            return response()->json([
                'success' => false,
                'message' => 'Request not found.',
            ], 429);
        }
        $validator = Validator::make($request->all(), [
            'status' => 'required|in:approved,rejected',
            'failure_reason' => 'nullable|string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Invalid input data',
                    'details' => $validator->errors()
                ]
            ], 400);
        }

        if ($request->status === 'approved') {
            $updateData['processed_at'] = now();
        }


        if ($settlement->user_type=='MERCHANT') {
            $user = User::where('role', 'MERCHANT')->where('merchant_id', $settlement->merchant_id)->first();
        } else if ($settlement->user_type=='AGENT') {
            $user = User::where('role', 'AGENT')->where('agent_id', $settlement->agent_id)->first();
        } else if ($settlement->user_type=='PARTNER') {
            $user = User::where('role', 'PARTNER')->where('partner_id', $settlement->partner_id)->first();
        }
        if(!$user){
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => '-1',
                    'message' => 'Invalid User',
                    'details' => $validator->errors()
                ]
            ], 400);
        }

        if ($request->status === 'approved') {
            if($settlement->transaction_type == 'PAYOUT'){
                if ($payout && $user) {
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
                    }
                    if ($provider->gateway === 'KWIKWIRE') {
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
            }
        }elseif($request->status === 'rejected'){
            if($settlement->transaction_type == 'PAYOUT'){

                if ($payout) {
                    $wallet = Wallet::where('user_id', $user->user_id)
                            ->where('currency', $payout->currency)
                            ->first();

                    $wallet->balance = $wallet->balance + $payout->amount;
                    $wallet->held_balance = $wallet->held_balance - $payout->amount;
                    $wallet->save();
                    $transaction = Transaction::create([
                        'txn_id' => 'TXN_' . strtoupper(uniqid()),
                        'user_id' => $user->user_id,
                        'provider_id' => $payout->provider_id,
                        'amount' => $payout->amount,
                        'currency' => $payout->currency,
                        'total_fee' => $payout->fee_amount,
                        'transaction_type' => 'REFUND',
                        'customer_email' => $user->email,
                        'status' => 'SUCCESS',
                        'processed_at' => now(),
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
                    $payout->status = 'rejected';
                    $payout->save();

                    $settlement->status = 'CANCELLED';
                    $settlement->transaction_count = ($settlement->transaction_count ?? 0) + 1;
                    $transactionIds = $settlement->transaction_ids ?? [];
                    $transactionIds[] = $transaction->txn_id;
                    $settlement->transaction_ids = $transactionIds;
                    $settlement->save();
                }else{
                    $settlement->status = 'FAILED';
                    $settlement->failure_reason = 'Pay-Out Request not found';
                    $settlement->save();
                }
            }
        }

        $updateData['processed_at'] = now();
        $settlement->update($updateData);


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

        return response()->json([
            'success' => true,
            'message' => 'Settlement status updated successfully'
        ]);
    }
    private function PAYCOMBAT($data)
    {
        $provider=Provider::where('provider_id', $data->provider_id)->first();
        Log::info($data);
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

        $signature = hash_hmac('sha256', json_encode($dataPaycombat), $signatureKey);

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

    public function testKWIKWIRE()
    {
        $client = new Client();
        $response = $client->post('https://kwikwire.net/api/users/transactions', [
            'headers' => [
                'Accept'        => 'application/json',
                'Content-Type'  => 'application/json',
                'Authorization' => 'Bearer 137|d3QsMXb1GHQD9LbhkgjPFHBA9XCt7y3Q8Q7ICFd7eb4d66e7',
            ],
            'json' => [
                'payment_method' => 'custom_bank_account',
                'transaction_type' => 'withdrawals',
                'payment_info' => [
                    'name' => 'CAIN WOOD',
                    'address' => 'address',
                    'city' => 'city',
                    'zip' => 'zip',
                    'country' => 'AU',
                    'phone' => '0475890118',
                    'holder_name' => 'CAIN WOOD',
                    'account_number' => '39953374',
                    'routing_number' => '063097',
                    'additional_information' => '0475890118'
                ],
                'balance' => [
                    'credit' => '30.04',
                    'credit_currency' => 'AUD'
                ]
            ]
        ]);
        $body = $response->getBody()->getContents();
        dd($body);
    }
    public function testPAYCOMBAT()
    {

        $personal_access_token = 'snd_eyJpdiI6IjEwbU9BNkY4b1RJR08rUDJZYzFBTFE9PSIsInZhbHVlIjoiTHBTNzVOMWc1S2dFR0VhbnR6dzJpdmQrWE5RcWJnam5NeFRhQkFCa3BYakcrd29WUmtmVTB2V3RrMU8vRzZhZiIsIm1hYyI6ImQ4OTBiM2QxNjAyNTRiNjgxMjU1ZWMzMjZmMmQzOThhMDdjNjExMGY1OWY4OTNiMDYyMjY5NWE4N2RlNDE0NGUiLCJ0YWciOiIifQ==';
        $signatureKey = 'snd_4YXuFCLoL2axTO8kOwAS4LgXHVcJTUUq';

        $client = new Client();

        $payout_beneficiary_param = [
            "individual" => [
                "first_name" => 'eka test'
            ],
            "account_number" => "123456789101",
        ];

        $dataPaycombat = [
            "payout_beneficiary_param" => $payout_beneficiary_param,
            "sender_amount" => 100,
            "sender_currency" => 'PHP',
            "sender_country" => 'PHP',
            "beneficiary_amount" => 100,
            "beneficiary_currency" => 'PHP',
            "payout_method_name" =>'ph_bank_robinson_php',
            "order_id" => 'sdadad',
            "purpose_code" => 'SELF'
        ];

        $signature = hash_hmac('sha256', json_encode($dataPaycombat), $signatureKey);

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
            dd($e);
            Log::error('PayCombat API Error: ' . $e->getMessage());
            throw new \Exception('Failed to send payout request to PayCombat API: ' . $e->getMessage());
        }
    }
}
