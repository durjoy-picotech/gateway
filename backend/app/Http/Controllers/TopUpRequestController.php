<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\Currency;
use App\Models\Wallet;
use App\Models\Transaction;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Models\Partner;
use App\Models\Agent;
use App\Models\Merchant;
use App\Models\TopUpRequest;
use App\Models\User;
use App\Models\Provider;
use App\Models\userProviderFee;
use App\Models\ProviderWallet;
use App\Models\Settlement;
use Illuminate\Support\Facades\Log;
use GuzzleHttp\Client;

use Carbon\Carbon;
use App\Events\SendMail;
use FontLib\Table\Type\post;
use GrahamCampbell\ResultType\Success;
use Illuminate\Container\Attributes\Auth;
use Illuminate\Container\Attributes\Log as AttributesLog;
use Illuminate\Support\Facades\Http;
use PhpParser\Builder\Function_;

class TopUpRequestController extends Controller
{
    public function topup(Request $request)
    {
        $user = User::where('user_id', $request->userId)->first();
        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => 'User not found'
                ]
            ], 404);
        }
        $validator = Validator::make($request->all(), [
            'currency' => 'required|string',
            'amount' => 'required|numeric|min:0.01'
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

        $currency = strtoupper($request->currency);
        $amount = $request->amount;

        // Check if user has a wallet for this currency
        $wallet = Wallet::where('user_id', $user->user_id)
            ->where('currency', $currency)
            ->first();

        if (!$wallet) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'WALLET_NOT_FOUND',
                    'message' => "You don't have a {$currency} wallet"
                ]
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'Topup initiated successfully',
            'data' => [
                'amount' => (float) $amount,
                'currency' => $currency,
                'status' => 'pending'
            ]
        ], 201);
    }
    public function payNow(Request $request)
    {
        $data = [
            'amount' => (float) $request->amount,
            'currency' => $request->currency,
        ];

        $user = User::where('user_id', $request->userId)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => 'User not found'
                ]
            ], 404);
        }
        $enabled_providers = [];
        if ($user->role == 'PARTNER') {
            $partner = Partner::where('partner_id', $user->partner_id)->first();
            $enabled_providers = $partner->enabled_providers;
            if (!is_array($enabled_providers)) {
                $enabled_providers = json_decode($enabled_providers ?? '[]', true);
            }
        } elseif ($user->role == 'AGENT') {
            $agent = Agent::where('agent_id', $user->agent_id)->first();
            $enabled_providers = $agent->enabled_providers;
            if (!is_array($enabled_providers)) {
                $enabled_providers = json_decode($enabled_providers ?? '[]', true);
            }
        } elseif ($user->role == 'MERCHANT') {
            $merchant = Merchant::where('merchant_id', $user->merchant_id)->first();
            $enabled_providers = $merchant->enabled_providers;
            if (!is_array($enabled_providers)) {
                $enabled_providers = json_decode($enabled_providers ?? '[]', true);
            }
        }

        $currency = Currency::where('code', $request->currency)->first();
        if ($currency) {
            $user_provider_fees = userProviderFee::whereIn('provider_id', $enabled_providers)
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
                ->get();
            if ($user->role !== 'PARTNER') {
                $providers = Provider::whereIn('provider_id', $enabled_providers)
                    ->where('currency_id', $currency->id)
                    ->where('status', 'active')
                    ->where('type', 'PAYIN')
                    ->get()
                    ->map(function ($provider) use ($user_provider_fees) {
                        // Find matching user fee for this provider
                        $user_fee = $user_provider_fees->firstWhere('provider_id', $provider->provider_id);

                        return [
                            'provider_id' => $provider->provider_id,
                            'alias' => $provider->alias,
                            'name' => $provider->name,
                            'gateway' => $provider->gateway,
                            'type' => $provider->type,
                            'channel_name' => $provider->channel_name,
                            'fee_percentage' => $user_fee ? (float) $user_fee->new_fee_percentage : 0,
                            'fixed_amount' => $user_fee ? (float) $user_fee->new_fixed_amount : 0,
                            'gateway_info' => $provider->gateway_info,
                        ];
                    });
            } else {
                $providers = Provider::whereNull('partner_id')
                    ->whereIn('provider_id', $enabled_providers)
                    ->where('currency_id', $currency->id)
                    ->where('status', 'active')
                    ->where('type', 'PAYIN')
                    ->get()
                    ->map(function ($provider) use ($user_provider_fees) {
                        // Find matching user fee for this provider
                        $user_fee = $user_provider_fees->firstWhere('provider_id', $provider->provider_id);

                        return [
                            'provider_id' => $provider->provider_id,
                            'alias' => $provider->alias,
                            'name' => $provider->name,
                            'gateway' => $provider->gateway,
                            'type' => $provider->type,
                            'channel_name' => $provider->channel_name,
                            'fee_percentage' => $user_fee ? (float) $user_fee->new_fee_percentage : 0,
                            'fixed_amount' => $user_fee ? (float) $user_fee->new_fixed_amount : 0,
                            'gateway_info' => $provider->gateway_info,
                        ];
                    });
            }

            $data['providers'] = $providers;
        } else {
            $data['providers'] = [];
        }

        $toCurrency = $request->currency;
        $fromCurrency = 'USD';
        $amount = (float) $request->amount;
        $exchangeRate = $this->calculateExchangeRate($fromCurrency, $toCurrency, $amount);

        // Format the response to match frontend expectations
        $response = [
            'transaction' => [
                'userId' => $user->user_id,
                'amount' => $data['amount'],
                'currency' => $data['currency'],
                'transaction_type' => 'PAY_IN',
                'channel_type' => $data['channel_type'] ?? null,
            ],
            'providers' => $data['providers'] ?? [],
            'exchangeRate' => $exchangeRate
        ];

        return response()->json([
            'success' => true,
            'data' => $response
        ]);
    }

    private function calculateExchangeRate($fromCurrency, $toCurrency, $amount, callable $callback = null)
    {
        $fromCurrency = strtoupper($fromCurrency);
        $toCurrency = strtoupper($toCurrency);

        $fromExchangeRate = Currency::where('code', $fromCurrency)->value('exchange_rate');
        $toExchangeRate = Currency::where('code', $toCurrency)->value('exchange_rate');

        if (!$fromExchangeRate || !$toExchangeRate) {
            return [
                'success' => false,
                'error' => 'Unable to get exchange rate for one or both currencies'
            ];
        }

        $amountInUSD = $fromExchangeRate;

        $finalAmount = $amountInUSD * $toExchangeRate;

        if ($callback) {
            return $callback($toExchangeRate, $finalAmount);
        }

        return $finalAmount;
    }

    public function payment(Request $request)
    {


        $user = User::where('user_id', $request->user_id)->first();
        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => 'User not found'
                ]
            ], 404);
        }

        $oldTopUpRequest = TopUpRequest::where('user_id', $user->user_id)
            ->where('provider_id', $request->gateway)
            ->where('status', 'pending')
            ->where('created_at', '>=', now()->subSeconds(30))
            ->first();

        if ($oldTopUpRequest) {
            return response()->json([
                'success' => false,
                'message' => 'You have already requested. Please wait a few seconds before requesting again.',
            ], 429);
        }

        $wallet = Wallet::where('user_id', $user->user_id)
            ->where('currency', $request->currency)
            ->first();

        if (!$wallet) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'WALLET_NOT_FOUND',
                    'message' => "You don't have a {$request->currency} wallet"
                ]
            ], 404);
        }

        $topUpRequest = TopUpRequest::create([
            'top_up_request_id' => Str::uuid(),
            'user_id' => $user->user_id,
            'partner_id' => $user->partner_id,
            'agent_id' => $user->agent_id,
            'merchant_id' => $user->merchant_id,
            'wallet_id' => $wallet->id,
            'user_type' => $user->role,
            'payment_status' => 'unpaid',
            'status' => 'pending',
            'amount' => $request->amount,
            'currency' => $request->currency,
        ]);
        $providers = Provider::where('provider_id', $request->gateway)
            ->where('status', 'active')
            ->first();

        if (!$providers) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PROVIDER_NOT_FOUND',
                    'message' => 'Provider not found'
                ]
            ], 404);
        }

        $toCurrency = $request->currency;
        $fromCurrency = 'USD';
        $amount = (float) $request->amount;
        $exchangeRate = $this->calculateExchangeRate($fromCurrency, $toCurrency, $amount);

        $user_provider_fees = userProviderFee::where('provider_id', $providers->provider_id)
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

        if ($providers->gateway === 'ALCHEMYPAY') {
            $total_amount = ($topUpRequest->amount + ($topUpRequest->amount * $user_provider_fees->new_fee_percentage / 100) + $user_provider_fees->new_fixed_amount);
            $total_fee = $this->onRampFee($total_amount, $providers->provider_id);
            $rampFeeUSD = (float) $total_fee['data']['rampFeeInUSD'];
            $networkFee = (float) $total_fee['data']['networkFee'];
            $cryptoNetworkFee = (float) $total_fee['data']['cryptoNetworkFee'];
            $provider_total_fees = $rampFeeUSD + $networkFee + $cryptoNetworkFee;
            $total_amount = $total_amount + $provider_total_fees;
            Log::info($total_amount);
        } else {
            $total_amount = $topUpRequest->amount + ($topUpRequest->amount * $user_provider_fees->new_fee_percentage / 100) + $user_provider_fees->new_fixed_amount;
        }
        $topUpRequest->provider_id = $providers->provider_id;
        $topUpRequest->payment_method = $providers->gateway;
        $topUpRequest->total_amount = $total_amount;

        if ($providers->partner_id) {
            $topUpRequest->request_for = 'PARTNER';
        } else {
            $topUpRequest->request_for = 'SUPER_ADMIN';
        }

        if ($providers->gateway == 'OFFLINE') {
            $topUpRequest->transaction_id = $request->txn_id;
        }






        // $provider = Provider::where('provider_id', $request->provider_id)->first();
        // if ($provider->gateway == 'Local') {
        //     $topUpRequest->transaction_id = $request->txn_id;
        // }

        $topUpRequest->save();


        if ($providers->gateway == 'PAYADMIT') {
            $response = $this->Payadmit($topUpRequest, $request->url);

            if ($response instanceof \Illuminate\Http\JsonResponse) {
                $decoded = $response->getData(true); // get the array version of the JSON

                if (($decoded['code'] ?? -1) !== 0) {
                    $topUpRequest->status = 'cancelled';
                    $topUpRequest->save();
                    return response()->json([
                        'success' => false,
                        'error' => [
                            'code' => 'PROVIDER_ERROR_FOUND',
                            'message' => 'Something went wrong, please try again.'
                        ]
                    ], 404);
                }

                return response()->json([
                    'success' => true,
                    // 'message' => 'Topup Request successfully',
                    'data' => [
                        'txn_id' => $decoded['detail']['txn_id'] ?? null,
                        'PayURL' => $decoded['detail']['PayURL'] ?? null,
                    ]
                ], 201);
            }
        }


        if ($providers->gateway == 'LOCAL') {
            $response = $this->local($topUpRequest, $request->url);
            return response()->json([
                'success' => true,
                'data' => [
                    'txn_id' => $response['id'] ?? null,
                    'PayURL' => $response['url'] ?? null,
                ]
            ], 201);
        }









        if ($providers->gateway == 'ALCHEMYPAY') {
            $response = $this->onRamp($topUpRequest, $request->url);

            if ($response instanceof \Illuminate\Http\JsonResponse) {
                $decoded = $response->getData(true);
                return response()->json([
                    'success' => true,
                    'data' => [
                        'txn_id' => $decoded['detail']['txn_id'] ?? null,
                        'PayURL' => $decoded['detail']['PayURL'] ?? null,
                    ]
                ], 201);
            }
        }

        $transaction = Transaction::create([
            'txn_id' => 'TXN_' . strtoupper(uniqid()),
            'provider_id' => $providers->provider_id,
            'amount' => $topUpRequest->amount,
            'currency' => $topUpRequest->currency,
            'total_fee' => ($topUpRequest->amount * $providers->new_fee_percentage / 100) + $providers->new_fixed_amount,
            'transaction_type' => 'PAY_IN',
            'customer_email' => $user->email,
            'status' => 'PENDING',
            'processed_at' => now(),
            'top_up_request_id' => $topUpRequest->top_up_request_id,
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

        if ($providers->gateway == 'OFFLINE') {
            // $existingSettlement = Settlement::where('request_id', $topUpRequest->top_up_request_id)->first();
            // if ($existingSettlement) {
            //     return response()->json([
            //         'success' => false,
            //         'error' => [
            //             'code' => 'SETTLEMENT_ALREADY_EXISTS',
            //             'message' => 'Settlement already exists for this request.'
            //         ]
            //     ], 409);
            // }
            // $topUpRequest->transaction_id = $request->txn_id;
            $topUpRequest->save();

            $time = Carbon::now();

            if ($providers->settlement == 'T+1') {
                $time = $time->copy()->addDay();
            } elseif ($providers->settlement == 'T+2') {
                $time = $time->copy()->addDays(2);
            } elseif ($providers->settlement == 'T+3') {
                $time = $time->copy()->addDays(3);
            }

            Settlement::create([
                'settlement_id' => Str::uuid(),
                'partner_id' => $topUpRequest->partner_id,
                'agent_id' => $topUpRequest->agent_id,
                'merchant_id' => $topUpRequest->merchant_id,
                'settlement_date' => $time,
                'cutoff_time' => '',
                'total_amount' => $topUpRequest->total_amount,
                'net_amount' => $topUpRequest->total_amount,
                'currency' => $topUpRequest->currency,
                'status' => 'PENDING',
                'fee_amount' => $topUpRequest->total_amount - $topUpRequest->amount,
                'request_id' => $topUpRequest->top_up_request_id,
                'user_type' => $topUpRequest->user_type,
                'transaction_type' => 'PAYIN',
                'settlement_type' => $providers->settlement,
            ]);

            $topUpRequest->status = 'pending';
            $topUpRequest->save();
            // }

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


        return response()->json([
            'success' => true,
            'message' => 'Topup Request successfully',
            'data' => [
                'txn_id' => $transaction->txn_id,
            ]
        ], 201);
    }
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
        if ($user->role == 'SUPER_ADMIN') {
            $topUpRequest = TopUpRequest::with(['user', 'provider'])->orderBy('created_at', 'desc')
                ->where('request_for', 'SUPER_ADMIN')
                ->paginate($limit, ['*'], 'page', $page);
        } else {
            $topUpRequest = TopUpRequest::with(['user', 'provider'])->where('user_id', $request->user_id)
                ->orderBy('created_at', 'desc')
                ->paginate($limit, ['*'], 'page', $page);
            // $payoutMethods = null;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'topUpRequest' => $topUpRequest->items(),
                'pagination' => [
                    'page' => $topUpRequest->currentPage(),
                    'limit' => $topUpRequest->perPage(),
                    'total' => $topUpRequest->total(),
                    'last_page' => $topUpRequest->lastPage(),
                ],
            ],
            // 'payout_methods' => $payoutMethods,
        ]);
    }
    public function indexPartner(Request $request)
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
        $topUpRequest = TopUpRequest::with(['user', 'provider'])
            ->where('partner_id', $user->partner_id)
            ->orderBy('created_at', 'desc')
            ->where('request_for', 'PARTNER')
            ->paginate($limit, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => [
                'topUpRequest' => $topUpRequest->items(),
                'pagination' => [
                    'page' => $topUpRequest->currentPage(),
                    'limit' => $topUpRequest->perPage(),
                    'total' => $topUpRequest->total(),
                    'last_page' => $topUpRequest->lastPage(),
                ],
            ],
            // 'payout_methods' => $payoutMethods,
        ]);
    }
    public function updateStatus(Request $request, $id)
    {
        $top_up_request = TopUpRequest::findOrFail($id);

        $settlement = Settlement::where('request_id', $top_up_request->top_up_request_id)->first();
        if (!$settlement && $request->status !== 'approved') {
            $top_up_request->status = $request->status;
            $top_up_request->save();
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

        $validator = Validator::make($request->all(), [
            'status' => 'required|in:approved,rejected,cancelled',
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


        if ($settlement->user_type == 'MERCHANT') {
            $user = User::where('role', 'MERCHANT')->where('merchant_id', $settlement->merchant_id)->first();
        } else if ($settlement->user_type == 'AGENT') {
            $user = User::where('role', 'AGENT')->where('agent_id', $settlement->agent_id)->first();
        } else if ($settlement->user_type == 'PARTNER') {
            $user = User::where('role', 'PARTNER')->where('partner_id', $settlement->partner_id)->first();
        }
        if (!$user) {
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
            if ($settlement->transaction_type == 'PAYIN') {
                $wallet = Wallet::where('user_id', $user->user_id)
                    ->where('currency', $top_up_request->currency)
                    ->first();
                if ($top_up_request && $user && $wallet) {
                    $wallet->balance = $wallet->balance + $top_up_request->amount;
                    $wallet->save();

                    $top_up_request->payment_status = 'paid';
                    $top_up_request->status = 'approved';
                    $top_up_request->save();

                    $transaction = Transaction::where('top_up_request_id', $top_up_request->top_up_request_id)->first();
                    if ($transaction) {
                        $transaction->status = 'SUCCESS';
                        $transaction->provider_id = $top_up_request->provider_id;
                        $transaction->save();
                    }

                    $providerWallet = ProviderWallet::where('provider_id', $top_up_request->provider_id)
                        ->where('currency', $top_up_request->currency)
                        ->first();
                    if (!$providerWallet) {
                        $providerWallet = new ProviderWallet();
                        $providerWallet->provider_id = $top_up_request->provider_id;
                        $providerWallet->currency = $top_up_request->currency;
                    }

                    $providerWallet->balance += $top_up_request->total_amount;
                    $providerWallet->save();



                    $fees = new TopUpWebhookController();
                    $fees->distributeAllUsersFee($transaction->id);

                    $settlement->status = 'COMPLETED';
                    $settlement->transaction_count = ($settlement->transaction_count ?? 0) + 1;
                    $transactionIds = $settlement->transaction_ids ?? [];
                    $transactionIds[] = $transaction->txn_id;
                    $settlement->transaction_ids = $transactionIds;
                    $settlement->save();
                    if ($transaction) {
                        $transaction->settlement = $settlement->settlement_id;
                        $transaction->save();
                    }
                } else {
                    $settlement->status = 'FAILED';
                    $settlement->failure_reason = 'Top-Up Request not found';
                    $settlement->save();
                }
            }
        } else {
            if ($settlement->transaction_type == 'PAYIN') {
                if ($top_up_request) {

                    $top_up_request->status = $request->status;
                    $top_up_request->save();

                    $transaction = Transaction::where('top_up_request_id', $top_up_request->top_up_request_id)->first();
                    if ($transaction) {
                        $transaction->status = 'CANCELLED';
                        $transaction->provider_id = $top_up_request->provider_id;
                        $transaction->save();
                    }

                    $settlement->status = 'CANCELLED';
                    $settlement->transaction_count = ($settlement->transaction_count ?? 0) + 1;
                    $transactionIds = $settlement->transaction_ids ?? [];
                    $transactionIds[] = $transaction->txn_id;
                    $settlement->transaction_ids = $transactionIds;
                    $settlement->save();
                    if ($transaction) {
                        $transaction->settlement = $settlement->settlement_id;
                        $transaction->save();
                    }
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
    private function Payadmit($data, $returnUrl)
    {
        try {
            $topUpRequest = $data;
            $user = User::where('user_id', $topUpRequest->user_id)->first();

            if ($user->role == 'PARTNER') {
                $partner = Partner::where('partner_id', $user->partner_id)->first();
                if (!$partner) {
                    return response()->json([
                        'code' => -1,
                        'msg' => 'Partner not found',
                        'detail' => []
                    ]);
                }
            } elseif ($user->role == 'AGENT') {
                $agent = Agent::where('agent_id', $user->agent_id)->first();
                if (!$agent) {
                    return response()->json([
                        'code' => -1,
                        'msg' => 'Agent not found',
                        'detail' => []
                    ]);
                }
            } elseif ($user->role == 'MERCHANT') {
                $merchant = Merchant::where('merchant_id', $user->merchant_id)->first();
                if (!$merchant) {
                    return response()->json([
                        'code' => -1,
                        'msg' => 'Merchant not found',
                        'detail' => []
                    ]);
                }
            }


            $userProvider = userProviderFee::where('provider_id', $topUpRequest->provider_id)->first();
            if (!$userProvider) {
                return response()->json([
                    'code' => -1,
                    'msg' => 'Something went wrong',
                    'detail' => []
                ]);
            }

            $provider = Provider::where('provider_id', $userProvider->provider_id)->first();

            if (!$provider || !$provider->gateway_info) {
                return response()->json([
                    'code' => -1,
                    'msg' => 'Something went wrong',
                    'detail' => []
                ]);
            }


            $gatewayInfo = $provider->gateway_info ? (object) json_decode($provider->gateway_info, true) : '';


            // TODO::Defind Blank Veriable
            $apiUrl = null;
            $header = null;

            // asol
            // if ($provider->gateway == 'PAYADMIN' && isset($gatewayInfo->api_key) || isset($gatewayInfo->endpoint)) {
            if (
                $provider->gateway === 'PAYADMIT'
                && isset($gatewayInfo->api_key)
                && isset($gatewayInfo->endpoint)
            ) {


                $header = [
                    'Authorization' => 'Bearer ' . $gatewayInfo->api_key,
                    'accept' => 'application/json',
                    'content-type' => 'application/json',
                ];
                $apiUrl = $gatewayInfo->endpoint;
            }


            if (!$header || !$apiUrl) {
                return response()->json([
                    'code' => -1,
                    'msg' => 'Something went wrong',
                    'detail' => []
                ]);
            }



            // Create transaction
            $transaction = Transaction::create([
                'txn_id' => uniqid('txn_'),
                'merchant_id' => $user->merchant_id,
                'agent_id' => $user->agent_id,
                'partner_id' => $user->partner_id,
                'provider_id' => $topUpRequest->provider_id,
                'amount' => $topUpRequest->amount,
                'currency' => 'USD', // Use USD as default
                'channel_type' => 'CARD',
                'transaction_type' => 'PAY_IN',
                'status' => 'PENDING',
                'top_up_request_id' => $topUpRequest->top_up_request_id,
                'metadata' => json_encode([
                    'topUpRequest' => $topUpRequest,
                    'returnUrl' => $returnUrl
                ]),
            ]);


            $detail = [];

            //Payment API
            $successReturnUrl = route('top.up.success.url', ['txnId' => $transaction->txn_id]);
            // $webhookUrl='https://webhook.site/f9e39526-3f25-4554-af84-04d765b3aa1c';
            $declineReturnUrl = route('top.up.decline.url', $transaction->txn_id);
            $webhookUrl = route('top.up.webhook.url');

            if ($provider->gateway == 'PAYADMIT') {
                $params_body = [
                    'paymentType' => 'DEPOSIT',
                    'paymentMethod' => 'BASIC_CARD',
                    'amount' => $topUpRequest->total_amount,
                    'currency' => $transaction->currency,
                    'successReturnUrl' => $successReturnUrl,
                    'webhookUrl' => $webhookUrl,
                    'declineReturnUrl' => $declineReturnUrl,
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
                $transaction->provider_id = $topUpRequest->provider_id;
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
                    'txn_id' => $transaction->txn_id,
                    'status' => 'PENDING',
                    'createdAt' => $transaction->created_at->format('Y.m.d H:i:s')
                ];
            }

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
            return response()->json([
                'code' => 0,
                'msg' => '',
                'detail' => $detail
            ]);
        } catch (\Exception $e) {
            \Log::error('Payadmit error: ' . $e->getMessage(), [
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'code' => -1,
                'msg' => 'An unexpected error occurred',
                'error' => $e->getMessage(),
                'detail' => []
            ]);
        }
    }








    //  public function localTopUp(Request $request)
    // {
    //     $validator = Validator::make($request->all(), [
    //     ]);
    //     if ($validator->fails()) {
    //         return response()->json([
    //             'success' => false,
    //             'error' => $validator->errors()
    //         ], 422);
    //     }

    //     $result = $this->callLocalSandboxAPI([
    //         'amount' => $request->amount,
    //     ]);

    //     return response()->json($result);
    // }


    // private function callLocalSandboxAPI($params)
    // {
    //     try {
    //         $client = new Client([
    //             'verify' => false,
    //             'timeout' => 30,
    //         ]);
    //         $payload = [
    //             'sbp'      => true,
    //             'country'  => $params['country'] ?? 'xx',
    //             'currency' => $params['currency'] ?? 'USD',
    //             'amount'   => $params['amount'] ?? 0
    //         ];

    //         $response = $client->request('POST', 'https://secure.sandbox.platcore.io/deals/payin', [
    //             'headers' => [
    //                 'accept'       => 'application/json',
    //                 'content-type' => 'application/json',
    //             ],
    //             'json' => $payload,
    //         ]);

    //         $body = $response->getBody()->getContents();
    //         $data = json_decode($body, true);

    //         return [
    //             'success' => true,
    //             'provider_response' => $data,
    //         ];
    //     } catch (\Exception $e) {
    //         return [
    //             'success' => false,
    //             'message' => 'Local gateway request failed',
    //             'error'   => $e->getMessage(),
    //         ];
    //     }
    // }









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
            if (is_array($v))
                continue;
            else if (!empty($v))
                $s2s .= "{$k}={$v}&";
        }
        return rtrim($s2s, '&');
    }

    private function onRamp($data, $returnUrl)
    {

        $provider = Provider::where('provider_id', $data->provider_id)->first();
        $currency = Currency::where('id', $provider->currency_id)->first();

        if (!$provider || !$provider->gateway_info && !$currency) {
            return response()->json([
                'code' => -1,
                'msg' => 'Something went wrong',
                'detail' => []
            ]);
        }


        $gatewayInfo = $provider->gateway_info ? (object) json_decode($provider->gateway_info, true) : '';
        $callbackUrl = route('webhook.PG0002');
        // $callbackUrl = 'https://webhook.site/f9e39526-3f25-4554-af84-04d765b3aa1c';

        $httpMethod = 'GET';
        $requestPath = '/index/rampPageBuy'; // For OnRamp THCdLrzqoC3xKHfHHDBJP8geKxHBEekgNx
        $timestamp = strval(round(microtime(true) * 1000));
        $appId = $gatewayInfo->app_ID;
        $appSecret = $gatewayInfo->app_secret;
        $endpoint = $gatewayInfo->endpoint ?? "https://ramptest.alchemypay.org?";
        $paramsToSign = [
            'crypto' => $currency->code,
            'network' => $gatewayInfo->network ?? 'TRX',
            'showTable' => 'buy',
            'fiat' => 'USD',
            'fiatAmount' => $data->total_amount,
            'merchantOrderNo' => $data->top_up_request_id,
            'timestamp' => $timestamp,
            'appId' => $appId,
            'redirectUrl' => $returnUrl,
            'address' => $gatewayInfo->address,
            'callbackUrl' => $callbackUrl,
        ];

        $rawDataToSign = $this->getStringToSign($paramsToSign);
        $requestPathWithQuery = $requestPath . '?' . $rawDataToSign;

        $signature = $this->generateSignature($timestamp, $httpMethod, $requestPathWithQuery, $appSecret);

        $finalUrl = $endpoint . $rawDataToSign . "&sign=" . $signature;
        $detail = [
            'PayURL' => $finalUrl,
            'txn_id' => $signature,
        ];
        return response()->json([
            'code' => 0,
            'msg' => '',
            'detail' => $detail
        ]);
    }

    public function CRYPTOPAYMENT()
    {
        $appId = "f83Is2y7L425rxl8";
        $secretKey = "5Zp9SmtLWQ4Fh2a1";

        $timestamp = (string) round(microtime(true) * 1000);

        $body = [
            "side" => "BUY",
            "merchantOrderNo" => "11222",
            "amount" => "1000",
            "fiatCurrency" => "USD",
            "cryptoCurrency" => "USDT",
            "depositType" => 2,
            "network" => 'TRX',
            "payWayCode" => '10001',
            "address" => 'THCdLrzqoC3xKHfHHDBJP8geKxHBEekgNx',
        ];

        ksort($body);

        $bodyString = json_encode($body, JSON_UNESCAPED_SLASHES);

        $signString =
            $timestamp .
            "POST" .
            "/open/api/v4/merchant/trade/create" .
            $bodyString;

        $sign = base64_encode(
            hash_hmac('sha256', $signString, $secretKey, true)
        );

        $response = Http::withHeaders([
            'appid' => $appId,
            'timestamp' => $timestamp,
            'sign' => $sign,
            'access-token' => 'ACH9097059721@ACH@m37j4pbjJJx7pXPylUOT0Q==@PAY@XVyNFf4irImxXdolnnfmPjwxki+kRXjm6rzotMi5FdI=@IO@q1WUlavQ71I5d18zwwahHo8QX9bW5wAeJ9KJL455o3hrpVJlS+XMIgJjPGN2p64vWfo+mMTVQuUOhJ7MN85RnA==',
            'Content-Type' => 'application/json',
        ])->post(
            "https://openapi-test.alchemypay.org/open/api/v4/merchant/trade/create",
            $body
        );
        dd($response->json());
        return $response->json();
    }

    private function onRampFee($amount, $provider_id)
    {

        $provider = Provider::where('provider_id', $provider_id)->first();
        $currency = Currency::where('id', $provider->currency_id)->first();
        $user = auth()->user();
        if (!$provider || !$provider->gateway_info && !$currency) {
            return response()->json([
                'code' => -1,
                'msg' => 'Something went wrong',
                'detail' => []
            ]);
        }



        $gatewayInfo = $provider->gateway_info ? (object) json_decode($provider->gateway_info, true) : '';

        $appId = $gatewayInfo->app_ID;
        $secretKey = $gatewayInfo->app_secret;

        $loginFreeRes = $this->loginFree($user->email, $appId, $secretKey);
        if (!isset($loginFreeRes) || !isset($loginFreeRes['data']) || !isset($loginFreeRes['data']['accessToken'])) {
            return response()->json([
                'code' => -1,
                'msg' => 'Something went wrong',
                'detail' => []
            ]);
        }
        $timestamp = (string) round(microtime(true) * 1000);
        $accessToken = $loginFreeRes['data']['accessToken'];
        $body = [
            "crypto" => $currency->code,
            "network" => $gatewayInfo->network ?? 'TRX',
            "fiat" => "USD",
            "amount" => $amount,
            "side" => "BUY",
        ];

        ksort($body);

        $bodyString = json_encode($body, JSON_UNESCAPED_SLASHES);

        $signString =
            $timestamp .
            "POST" .
            "/open/api/v4/merchant/order/quote" .
            $bodyString;

        $sign = base64_encode(
            hash_hmac('sha256', $signString, $secretKey, true)
        );

        $response = Http::withHeaders([
            'appid' => $appId,
            'timestamp' => $timestamp,
            'sign' => $sign,
            'Content-Type' => 'application/json',
        ])->post(
            "https://openapi-test.alchemypay.org/open/api/v4/merchant/order/quote",
            $body
        );

        return $response->json();
    }
    public function loginFree()
    {
        try {
            // $email,$appId,$secretKey
            $timestamp = (string) round(microtime(true) * 1000);
            $email = 'alfa.picotech@gmail.com';
            $appId = 'f83Is2y7L425rxl8';
            $secretKey = '5Zp9SmtLWQ4Fh2a1';
            $body = [
                "email" => $email,
            ];

            ksort($body);

            $bodyString = json_encode($body, JSON_UNESCAPED_SLASHES);

            $signString =
                $timestamp .
                "POST" .
                "/open/api/v4/merchant/getToken" .
                $bodyString;

            $sign = base64_encode(
                hash_hmac('sha256', $signString, $secretKey, true)
            );


            $response = Http::withHeaders([
                'appid' => $appId,
                'timestamp' => $timestamp,
                'sign' => $sign,
                'Content-Type' => 'application/json',
            ])->post(
                "https://openapi-test.alchemypay.org/open/api/v4/merchant/getToken",
                $body
            );
            return $response->json();
        } catch (\Throwable $th) {
            //throw $th;
            return [];
        }
    }

    public function paymentForm()
    {
        $appId = "f83Is2y7L425rxl8";
        $secretKey = "5Zp9SmtLWQ4Fh2a1";
        $timestamp = (string) round(microtime(true) * 1000);

        // GET parameters (must be sorted)
        $query = [
            "fiat" => "USD",
            "payWayCode" => "10001",
            "side" => "BUY",
        ];

        ksort($query); // sort alphabetically

        // Step 1: Build sorted query params string
        $queryString = http_build_query($query, '', '&', PHP_QUERY_RFC3986);

        // Step 2: Build the requestPath WITH sorted query string
        $requestPath = "/open/api/v4/merchant/payment/requiredField" . "?" . $queryString;

        // Step 3: bodyString must be empty for GET
        $bodyString = "";

        // Step 4: Build the signature string
        $signString =
            $timestamp .
            "GET" .
            $requestPath .
            $bodyString;

        // Step 5: Generate signature
        $sign = base64_encode(
            hash_hmac('sha256', $signString, $secretKey, true)
        );

        // Step 6: Send request
        $response = Http::withHeaders([
            'appid' => $appId,
            'timestamp' => $timestamp,
            'sign' => $sign,
        ])->get(
            "https://openapi-test.alchemypay.org" . $requestPath
        );

        $response = $response->json();
        $data['requiredFields'] = $response;
        return view('form', $data);
    }

    public function submitForm(Request $request)
    {
        $appId = "f83Is2y7L425rxl8";
        $secretKey = "5Zp9SmtLWQ4Fh2a1";
        $accessToken = "ACH9097059721@ACH@m37j4pbjJJx7pXPylUOT0Q==@PAY@XVyNFf4irImxXdolnnfmPjwxki+kRXjm6rzotMi5FdI=@IO@q1WUlavQ71I5d18zwwahHo8QX9bW5wAeJ9KJL455o3hrpVJlS+XMIgJjPGN2p64vWfo+mMTVQuUOhJ7MN85RnA==";
        $timestamp = (string) round(microtime(true) * 1000);
        dd($request->all());
        $formData = $request->except('_token');

        // Encrypt form fields
        $encryptedData = [];
        foreach ($formData as $key => $value) {
            $encryptedData[$key] = $this->encryptAES($value, $secretKey);
        }

        $body = [
            "fiat" => "USD",
            "payWayCode" => "10001",
            "side" => "BUY",
            "formData" => $encryptedData,
        ];

        $this->recursiveKsort($body);

        $bodyString = json_encode($body, JSON_UNESCAPED_SLASHES);

        $signString = $timestamp . "POST" . "/open/api/v4/merchant/payment/account/create" . $bodyString;
        $sign = base64_encode(hash_hmac('sha256', $signString, $secretKey, true));
        $response = Http::withHeaders([
            'access-token' => $accessToken,
            'appid' => $appId,
            'timestamp' => $timestamp,
            'sign' => $sign,
            'Content-Type' => 'application/json',
        ])->post("https://openapi-test.alchemypay.org/open/api/v4/merchant/payment/account/create", $body);

        dd($response->json());
    }
    private function encryptAES(string $plainText, string $secretKey): ?string
    {
        try {
            // Java uses the original secretKey bytes (16 bytes)
            $key = substr($secretKey, 0, 16);   // AES-128
            $iv = substr($secretKey, 0, 16);   // first 16 chars as IV

            $encrypted = openssl_encrypt(
                $plainText,
                'AES-128-CBC',
                $key,
                OPENSSL_RAW_DATA,
                $iv
            );

            return base64_encode($encrypted);
        } catch (\Exception $e) {
            \Log::error("AES encrypt error: " . $e->getMessage());
        }

        return null;
    }
    private function recursiveKsort(array &$array)
    {
        ksort($array);
        foreach ($array as &$value) {
            if (is_array($value)) {
                $this->recursiveKsort($value); // call itself recursively
            }
        }
    }


    public function createOrder()
    {

        $appId = "f83Is2y7L425rxl8";
        $secretKey = "5Zp9SmtLWQ4Fh2a1";
        $accessToken = "ACH9097059721@ACH@m37j4pbjJJx7pXPylUOT0Q==@PAY@XVyNFf4irImxXdolnnfmPjwxki+kRXjm6rzotMi5FdI=@IO@q1WUlavQ71I5d18zwwahHo8QX9bW5wAeJ9KJL455o3hrpVJlS+XMIgJjPGN2p64vWfo+mMTVQuUOhJ7MN85RnA==";

        $timestamp = (string) round(microtime(true) * 1000);
        $method = "POST";
        $path = "/open/api/v4/merchant/order/create";

        // ------------------------
        // BODY
        // ------------------------
        $body = [
            "side" => "BUY",
            "merchantOrderNo" => "MO" . time(),
            "amount" => "40",
            "fiatCurrency" => "USD",
            "cryptoCurrency" => "USDT",
            "orderType" => "4",
            "network" => "TRX",
            "payWayCode" => "10001",
            "address" => "TSx82tWNWe5Ns6t3w94Ye3Gt6E5KeHSoP8",
            "userAccountId" => "18621",
            "clientIp" => "103.155.118.133",
            "redirectUrl" => "http://54.252.64.6/dashboard",
            "callbackUrl" => "https://webhook.site/5b3bb4d7-5e4a-470b-a352-08144cbe24e5",
            "extendParams" => [
                "channelCookie" => "dsid_lwsxfy2itw5eln4q7i3rxzanuy",
                "cookie" => "1e0b9ff137de4b939ececb21bc5597ab"
            ]
        ];
        // ------------------------
        // SIGNATURE GENERATION
        // ------------------------

        $cleanBody = $this->removeEmpty($body);

        $sortedBody = $this->sortRecursively($cleanBody);

        $bodyString = json_encode($sortedBody, JSON_UNESCAPED_SLASHES);

        $signString = $timestamp . $method . $path . $bodyString;

        $sign = base64_encode(
            hash_hmac('sha256', $signString, $secretKey, true)
        );


        // ------------------------
        // SEND REQUEST
        // ------------------------
        $response = Http::withHeaders([
            "access-token" => $accessToken,
            "appid" => $appId,
            "timestamp" => $timestamp,
            "sign" => $sign,
            "Content-Type" => "application/json",
        ])->post("https://openapi-test.alchemypay.org$path", $body);
        dd($response->json());
        return $response->json();
    }

    private function removeEmpty($data)
    {
        if (!is_array($data)) {
            return $data;
        }

        $clean = [];
        foreach ($data as $key => $value) {
            if ($value !== null && $value !== "") {
                $clean[$key] = is_array($value)
                    ? $this->removeEmpty($value)
                    : $value;
            }
        }

        return $clean;
    }

    private function sortRecursively($data)
    {
        if (!is_array($data)) {
            return $data;
        }

        ksort($data);

        foreach ($data as $key => $value) {
            if (is_array($value)) {
                $data[$key] = $this->sortRecursively($value);
            }
        }

        return $data;
    }






    private function local($data, $returnUrl)
    {

        try {

            $topUpRequest = $data;
            $user = User::where('user_id', $topUpRequest->user_id)->first();

            if ($user->role == 'PARTNER') {
                $partner = Partner::where('partner_id', $user->partner_id)->first();
                if (!$partner) {
                    return response()->json([
                        'code' => -1,
                        'msg' => 'Partner not found',
                        'detail' => []
                    ]);
                }
            } elseif ($user->role == 'AGENT') {
                $agent = Agent::where('agent_id', $user->agent_id)->first();
                if (!$agent) {
                    return response()->json([
                        'code' => -1,
                        'msg' => 'Agent not found',
                        'detail' => []
                    ]);
                }
            } elseif ($user->role == 'MERCHANT') {
                $merchant = Merchant::where('merchant_id', $user->merchant_id)->first();
                if (!$merchant) {
                    return response()->json([
                        'code' => -1,
                        'msg' => 'Merchant not found',
                        'detail' => []
                    ]);
                }
            }


            $userProvider = userProviderFee::where('provider_id', $topUpRequest->provider_id)->first();
            if (!$userProvider) {
                return response()->json([
                    'code' => -1,
                    'msg' => 'Something went wrong',
                    'detail' => []
                ]);
            }

            $provider = Provider::where('provider_id', $userProvider->provider_id)->first();

            if (!$provider || !$provider->gateway_info) {
                return response()->json([
                    'code' => -1,
                    'msg' => 'Something went wrong',
                    'detail' => []
                ]);
            }


            $gatewayInfo = $provider->gateway_info ? (object) json_decode($provider->gateway_info, true) : '';
            Log::info(['', $gatewayInfo]);

            $account_id = $gatewayInfo->account_id;
            $public_key = $gatewayInfo->public_key;
            $mainURL = $gatewayInfo->endpoint;


            // $mainURL = 'https://secure.easysendglobal.com';

            $headerAuthorization = [
                'accept' => 'application/json',
                'content-type' => 'application/json',
            ];
            $paramsBodyheaderAuthorization = [
                "account_id" => $account_id,
                "public_key" => $public_key
                // "public_key"=>"LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlJQklqQU5CZ2txaGtpRzl3MEJBUUVGQUFPQ0FROEFNSUlCQ2dLQ0FRRUFxS1FLaVJkdlcvZnd0Ry93N25YZwpKNjNNVy8zRGJuRi8wd2ZXVzIzbTFIMXZCSWQ3cUVTd2d5bDVwWWRwY1Y4RjM1cDFkcEhqR0w5Q1NESjhuNHZBCk5sTXdHQTh1UjVWNys2T3E0Q1Z6dkhPd3ZFbE9rbytVTEw0NTFNSlZ1WWxTQXJmaEp1c2RuK1dvTlNidk1LcU8KQUJuUHNNaXFyMVZtbTFMT0N2WjZTQ3kvY0RPanpRTmJwMGloWnJXKzFkSVhtcFhDeEFNcVBMSGhETlphcGFFNwpiQmNTVDZCUklNKzQyZTZvTWZ5RVY1V0l2Sm1LbElJamJFSHdpUjdFeWFkbGUxNE5YeVp4V2R4Y2dmMGFPWmZhCjgraTgzNGk1WjI4RE8yYWEwYnlaMDIxY1U0R1pTTXJuMFhPd1R5QW0xWGZFM2RZVDJnaG1DQkVlcDU1YlcrNUEKbVFJREFRQUIKLS0tLS1FTkQgUFVCTElDIEtFWS0tLS0tCg==",
            ];
            $client = new Client([
                'verify' => false,
                'timeout' => 30,
            ]);

            $responseAuthorization = $client->request('POST', $mainURL . '/auth/token', [
                'headers' => $headerAuthorization,
                'json' => $paramsBodyheaderAuthorization
            ]);

            $responseAuthorization = $responseAuthorization->getBody()->getContents();
            $token = json_decode($responseAuthorization);

            $apiUrl = $mainURL . '/deals/payin/';

            $header = [
                'Authorization' => 'Bearer ' . $token->access_token,
                'accept' => 'application/json',
                'X-Account-ID' => $account_id,
                'content-type' => 'application/json',
            ];

            $body = [
                'amount' => 100,
                "currency" => strtoupper("AUD"),
                "country" => "AU",
                "invoiceId" => "INV_" . time(),
                "clientId" => "CUST_" . uniqid(),
                "successUrl" => $returnUrl,
                "failUrl" => $returnUrl,
                "backUrl" => $returnUrl,
                "clientCard" => "4111********1111",
                "type" => "payid",
            ];

            $client = new Client([
                'timeout' => 30,
                'verify' => false
            ]);
            $response = $client->request('POST', $apiUrl, [
                'headers' => $header,
                'json' => $body
            ]);

            $body = (string) $response->getBody();
            $decoded = json_decode($body, true);

            return $decoded;
        } catch (\Throwable $th) {
            Log::info($th);
        }
    }


    private function formatAmount($amount, $currency)
    {
        $zeroDecimalCurrencies = ['JPY', 'KRW', 'VND', 'CLP', 'ISK'];

        if (in_array(strtoupper($currency), $zeroDecimalCurrencies)) {
            return (int) $amount;
        }

        return (int) round($amount * 100);
        // return round((float) $amount, 2);
    }
}
