<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Merchant;
use App\Models\Partner;
use App\Models\Settlement;
use App\Models\Transaction;
use App\Models\Wallet;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use App\Models\TopUpRequest;
use App\Models\ProviderWallet;
use App\Models\PayoutRequest;
use App\Events\SendMail;
// 111111111
use Illuminate\Support\Str;
use Carbon\Carbon;

use function Symfony\Component\Clock\now;

class SettlementController extends Controller
{
    /**
     * List settlements with filtering.
     */
    public function index(Request $request)
    {
        $user = auth()->user();

        $validator = Validator::make($request->all(), [
            'status' => 'string|in:PENDING,PROCESSING,COMPLETED,FAILED,CANCELLED',
            'date_from' => 'date',
            'date_to' => 'date',
            'page' => 'integer|min:1',
            'limit' => 'integer|min:1|max:100'
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

        $query = Settlement::with(['partner', 'merchant'])->orderByDesc('created_at');

        if ($user && $user->role !== 'SUPER_ADMIN') {
            if ($request->has('partner_id')) {
                $query->where('partner_id', $request->partner_id);
            }

            if ($request->has('merchant_id')) {
                $query->where('merchant_id', $request->merchant_id);
            }

            if ($request->has('agent_id')) {
                $query->where('agent_id', $request->agent_id);
            }
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date_from')) {
            $query->whereDate('settlement_date', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('settlement_date', '<=', $request->date_to);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 20);

        $settlements = $query->paginate($limit, ['*'], 'page', $page);

        $settlements->getCollection()->transform(function ($settlement) {
            $users = [];

            if ($settlement->user_type == 'MERCHANT') {
                $users = [
                    'merchant_id' => $settlement->merchant->merchant_id,
                    'name' => $settlement->merchant->name,
                    'email' => $settlement->merchant->user->email,
                    'type' => 'Merchant'
                ];
            } else if ($settlement->user_type == 'AGENT') {
                $users = [
                    'merchant_id' => $settlement->agent->agent_id,
                    'name' => $settlement->agent->name,
                    'email' => $settlement->agent->user->email,
                    'type' => 'Agent'
                ];
            } else if ($settlement->user_type == 'PARTNER') {
                $users = [
                    'partner_id' => $settlement->partner->partner_id,
                    'name' => $settlement->partner->name,
                    'email' => $settlement->partner->user->email,
                    'type' => 'Partner'
                ];
            }

            return [
                'settlement_id' => $settlement->settlement_id,
                'partner_id' => $settlement->partner_id,
                'merchant_id' => $settlement->merchant_id,
                'settlement_date' => $settlement->settlement_date->toISOString(),
                'cutoff_time' => $settlement->cutoff_time,
                'total_amount' => $settlement->total_amount,
                'currency' => $settlement->currency,
                'status' => $settlement->status,
                'transaction_count' => $settlement->transaction_count,
                'fee_amount' => $settlement->fee_amount,
                'net_amount' => $settlement->net_amount,
                'details' => $settlement->details,
                'processed_at' => $settlement->processed_at?->toISOString(),
                'created_at' => $settlement->created_at->toISOString(),
                'users' => $users,
                'transaction_type' => $settlement->transaction_type,
                'settlement_type' => $settlement->settlement_type,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'settlements' => $settlements->items(),
                'pagination' => [
                    'page' => $settlements->currentPage(),
                    'limit' => $settlements->perPage(),
                    'total' => $settlements->total(),
                    'pages' => $settlements->lastPage()
                ]
            ]
        ]);
    }


    /**
     * Create Settlement Request (Merchant)
     */
    public function store(Request $request)
    {
        $user = auth()->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'Authentication required',
                ],
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'total_amount' => 'required|numeric|min:1',
            'currency' => 'required|string',
            'transaction_type' => 'required|in:PAYIN,PAYOUT',
            // 'user_type' => 'required|in:MERCHANT,AGENT,PARTNER',
            // 'request_id' => 'required|integer',
        ]);






        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Invalid input data',
                    'details' => $validator->errors(),
                ],
            ], 400);
        }





        $wallet = Wallet::where('user_id', $user->user_id)->where('currency', $request->currency)->first();
        if (!$wallet) {
            return response()->json([
                'success' => false,
                'message' => 'wallet not found.',
            ], 404);
        }

        $time = Carbon::now();


        $settlement = Settlement::create([
            'settlement_id' => Str::uuid(),
            'partner_id' => $user->partner_id,
            'agent_id' => $user->agent_id,
            'merchant_id' => $user->merchant_id,
            'settlement_date' => $time,
            'cutoff_time' => '',
            'total_amount' => $request->total_amount,
            'net_amount' => $request->total_amount,
            'currency' => $request->currency,
            'status' => 'PENDING',
            'fee_amount' => 0,
            'request_id' => $user->user_id,
            'user_type' => $user->role,
            'transaction_type' => 'PAYOUT',
            'settlement_type' => 'TO',
        ]);

        $wallet->held_balance = $wallet->held_balance - $payout->amount;
        $wallet->save();

        $wallet->balance = $wallet->balance + $request->amount;
        $wallet->held_balance = $wallet->held_balance - $request->amount;
        $wallet->save();
        return response()->json([
            'success' => true,
            'data' => $settlement,
        ], 201);
    }








    /**
     * Get settlement details by ID.
     */
    public function show($id)
    {
        $settlement = Settlement::with(['partner', 'merchant'])->where('settlement_id', $id)->first();

        if (!$settlement) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'SETTLEMENT_NOT_FOUND',
                    'message' => 'Settlement not found'
                ]
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'settlement_id' => $settlement->settlement_id,
                'partner_id' => $settlement->partner_id,
                'merchant_id' => $settlement->merchant_id,
                'settlement_date' => $settlement->settlement_date->toISOString(),
                'cutoff_time' => $settlement->cutoff_time,
                'total_amount' => $settlement->total_amount,
                'currency' => $settlement->currency,
                'status' => $settlement->status,
                'transaction_count' => $settlement->transaction_count,
                'fee_amount' => $settlement->fee_amount,
                'net_amount' => $settlement->net_amount,
                'transaction_ids' => $settlement->transaction_ids,
                'processed_at' => $settlement->processed_at?->toISOString(),
                'failure_reason' => $settlement->failure_reason,
                'created_at' => $settlement->created_at->toISOString(),
                'partner' => $settlement->partner ? [
                    'partner_id' => $settlement->partner->partner_id,
                    'name' => $settlement->partner->name
                ] : null,
                'merchant' => $settlement->merchant ? [
                    'merchant_id' => $settlement->merchant->merchant_id,
                    'name' => $settlement->merchant->name
                ] : null
            ]
        ]);
    }




    /**
     * Update settlement status.
     */
    public function updateStatus(Request $request, $id)
    {
        $settlement = Settlement::where('settlement_id', $id)->first();

        if (!$settlement) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'SETTLEMENT_NOT_FOUND',
                    'message' => 'Settlement not found'
                    // 'details' => $validator->errors()

                ]
            ], 404);
        }
        $updateData = [];


        $validator = Validator::make($request->all(), [
            'status' => 'required|string|in:PENDING,PROCESSING,COMPLETED,FAILED,CANCELLED',
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

        if ($request->status === 'COMPLETED') {
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

        if ($request->status === 'COMPLETED') {
            if ($settlement->transaction_type == 'PAYIN') {
                $top_up_request = TopUpRequest::where('top_up_request_id', $settlement->request_id)->first();
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
                        $transaction->settlement =  $settlement->settlement_id;
                        $transaction->save();
                    }
                } else {
                    $settlement->status = 'FAILED';
                    $settlement->failure_reason = 'Top-Up Request not found';
                    $settlement->save();
                }
            } elseif ($settlement->transaction_type == 'PAYOUT') {
                // 111111111
                $settlementUser = User::where('user_id', $settlement->request_id)->first();
                if (!$settlementUser) {
                    // 111111111
                    $payout = PayoutRequest::where('id', $settlement->request_id)->first();
                    if ($payout && $user) {
                        $fees = new PayOutWebhookController();
                        $fees->distributeAllUsersFee($payout->id);
                        $providerWallet = ProviderWallet::where('provider_id', $payout->provider_id)
                            ->where('currency', $payout->currency)
                            ->first();
                        if (!$providerWallet) {
                            $providerWallet = new ProviderWallet();
                            $providerWallet->provider_id = $payout->provider_id;
                            $providerWallet->currency = $payout->currency;
                        }
                        $providerWallet->balance = $providerWallet->balance - $payout->amount;
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
                    } else {
                        $settlement->status = 'FAILED';
                        $settlement->failure_reason = 'Pay-Out Request not found';
                        $settlement->save();
                    }
                } else {
                    $wallet = Wallet::where('user_id', $settlementUser->user_id)
                        ->where('currency', $settlement->currency)
                        ->first();

                    $wallet->held_balance = $wallet->held_balance - $settlement->total_amount;
                    $wallet->save();


                    $settlement->status = 'COMPLETED';
                    $settlement->save();
                }
            }
        } elseif ($request->status === 'CANCELLED') {
            if ($settlement->transaction_type == 'PAYIN') {
                $top_up_request = TopUpRequest::where('top_up_request_id', $settlement->request_id)->first();
                if ($top_up_request) {

                    $top_up_request->status = 'rejected';
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
                        $transaction->settlement =  $settlement->settlement_id;
                        $transaction->save();
                    }
                }
            } elseif ($settlement->transaction_type == 'PAYOUT') {
                $payout = PayoutRequest::where('id', $settlement->request_id)->first();
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
                } else {
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
}
