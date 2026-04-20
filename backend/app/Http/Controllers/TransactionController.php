<?php

namespace App\Http\Controllers;

use App\Models\Merchant;
use App\Models\Transaction;
use App\Models\WalletTransaction;
use App\Models\Provider;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Currency;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
class TransactionController extends Controller
{
    /**
     * List transactions with filtering.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'merchant_id' => 'string',
            'status' => 'string|in:PENDING,SUCCESS,FAILED,CANCELLED',
            // 'channel_type' => 'string|in:CARD,BANK_TRANSFER,EWALLET,QR,CRYPTO',
            'channel_type' => 'string',
            'date_from' => 'date',
            'date_to' => 'date',
            'min_amount' => 'numeric|min:0',
            'max_amount' => 'numeric|min:0',
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

        $query = Transaction::with(['merchant','provider','partner','agent'])->orderBy('created_at', 'desc');
        $user = auth()->user();
        if ($user->role !== 'SUPER_ADMIN') {
            if ($user->role === 'AGENT') {
                $query->where('agent_id', $user->agent_id);
            } elseif ($user->role === 'PARTNER') {
                $query->where('partner_id', $user->partner_id);
            } else {
                $query->where('merchant_id', $user->merchant_id);
            }
        }
        if ($request->has('merchant_id')) {
            $query->where('merchant_id', $request->merchant_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('transaction_type')) {
            $query->where('transaction_type', $request->transaction_type);
        }

        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->has('min_amount')) {
            $query->where('amount', '>=', $request->min_amount);
        }

        if ($request->has('max_amount')) {
            $query->where('amount', '<=', $request->max_amount);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 100);

        $allTxnIds = $query->pluck('txn_id')->toArray();

        $transactions = $query->paginate($limit, ['*'], 'page', $page);

        $transactions->getCollection()->transform(function ($transaction) {
            return [
                'txn_id' => $transaction->txn_id,
                'merchant_id' => $transaction->merchant_id,
                'amount' => (float) $transaction->amount,
                'currency' => $transaction->currency,
                'transaction_type' => $transaction->transaction_type,
                'fee_type' => $transaction->fee_type,
                'status' => $transaction->status,
                'provider_alias' => $transaction->provider?->alias ?? '',
                'merchant' => $transaction->merchant?->user->email ?? '',
                'partner' => $transaction->partner?->user->email ?? '',
                'agent' => $transaction->agent?->user->email ?? '',
                'fx_rate' => (float) $transaction->fx_rate,
                'total_fee' => (float) $transaction->total_fee,
                'fee_breakdown' => $transaction->fee_breakdown,
                'estimated_cost' => $transaction->estimated_cost ? (float) $transaction->estimated_cost : null,
                'routing_strategy' => $transaction->routing_strategy,
                'routing_reason' => $transaction->routing_reason,
                'created_at' => $transaction->created_at->toISOString(),
                'processed_at' => $transaction->processed_at?->toISOString()
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'transactions' => $transactions->items(),
                'allTxnIds' => $allTxnIds,
                'pagination' => [
                    'page' => $transactions->currentPage(),
                    'limit' => $transactions->perPage(),
                    'total' => $transactions->total(),
                    'pages' => $transactions->lastPage()
                ]
            ]
        ]);
    }
    public function exchanges(Request $request)
    {
        $user = User::where('user_id', $request->user_id)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => 'User not found',
                ],
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'date_from' => 'date',
            'date_to' => 'date',
            'min_amount' => 'numeric|min:0',
            'max_amount' => 'numeric|min:0',
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

        $query = WalletTransaction::with(['user'])->orderBy('created_at', 'desc');
        if ($user->role !== 'SUPER_ADMIN') {
            $query->where('user_id', $user->user_id);
        }
        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->has('min_amount')) {
            $query->where('amount', '>=', $request->min_amount);
        }

        if ($request->has('max_amount')) {
            $query->where('amount', '<=', $request->max_amount);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 100);


        $transactions = $query->paginate($limit, ['*'], 'page', $page);

        $transactions->getCollection()->transform(function ($transaction) {
            return [
                'transaction_id' => $transaction->transaction_id,
                'user' => $transaction->user->email,
                'to_amount' => (float) $transaction->to_amount,
                'from_amount' => (float) $transaction->from_amount,
                'from_currency' => $transaction->from_currency,
                'to_currency' => $transaction->to_currency,
                'status' => $transaction->status,
                'exchange_rate' => (float) $transaction->exchange_rate,
                'markup_rate' => (float) $transaction->markup_rate,
                'fee' => (float) $transaction->fee,
                'notes' => $transaction->notes,
                'status' => $transaction->status,
                'metadata' => $transaction->metadata,
                'created_at' => $transaction->created_at->toISOString(),
                'processed_at' => $transaction->processed_at?->toISOString()
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'transactions' => $transactions->items(),
                'pagination' => [
                    'page' => $transactions->currentPage(),
                    'limit' => $transactions->perPage(),
                    'total' => $transactions->total(),
                    'pages' => $transactions->lastPage()
                ]
            ]
        ]);
    }
    public function revenue(Request $request)
    {
        $user = User::where('user_id', $request->user_id)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => 'User not found',
                ],
            ], 404);
        }

        // Base transaction query
        $baseQuery = Transaction::with(['provider'])
            ->orderBy('created_at', 'desc');

        // Role-based filtering
        if ($user->role !== 'SUPER_ADMIN') {
            if ($user->role === 'AGENT') {
                $baseQuery->where('agent_id', $user->agent_id)->where('for', $user->role);
            } elseif ($user->role === 'PARTNER') {
                $baseQuery->where('partner_id', $user->partner_id)->where('for', $user->role);
            } else {
                $baseQuery->where('merchant_id', $user->merchant_id)->where('for', $user->role);
            }
        } else {
            $baseQuery->where('superadmin_id', $user->user_id)->where('for', $user->role);
        }

        if ($request->has('currency')) {
            $baseQuery->where('currency', $request->currency);
        }

        // Clone queries to prevent mutation
        $todayTotal = (clone $baseQuery)
            ->whereBetween('created_at', [now()->startOfDay(), now()->endOfDay()])
            ->sum('amount');

        $monthTotal = (clone $baseQuery)
            ->whereBetween('created_at', [now()->startOfMonth(), now()->endOfMonth()])
            ->sum('amount');

        $yearTotal = (clone $baseQuery)
            ->whereBetween('created_at', [now()->startOfYear(), now()->endOfYear()])
            ->sum('amount');

        $lifetimeTotal = (clone $baseQuery)->sum('amount');

        // Apply filters for transaction list
        if ($request->has('date_from')) {
            $baseQuery->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $baseQuery->whereDate('created_at', '<=', $request->date_to);
        }

        if ($request->has('min_amount')) {
            $baseQuery->where('amount', '>=', $request->min_amount);
        }

        if ($request->has('max_amount')) {
            $baseQuery->where('amount', '<=', $request->max_amount);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 100);

        $transactions = $baseQuery->paginate($limit, ['*'], 'page', $page);
        $transactions->getCollection()->transform(function ($transaction) {
            return [
                'txn_id' => $transaction->txn_id,
                'amount' => (float) $transaction->amount,
                'currency' => $transaction->currency,
                'transaction_type' => $transaction->transaction_type,
                'status' => $transaction->status,
                'provider_alias' => $transaction->provider?->alias ?? '',
                'fx_rate' => (float) $transaction->fx_rate,
                'total_fee' => (float) $transaction->total_fee,
                'fee_breakdown' => $transaction->fee_breakdown,
                'estimated_cost' => $transaction->estimated_cost ? (float) $transaction->estimated_cost : null,
                'routing_strategy' => $transaction->routing_strategy,
                'routing_reason' => $transaction->routing_reason,
                'created_at' => $transaction->created_at->toISOString(),
                'processed_at' => $transaction->processed_at?->toISOString()
            ];
        });
        return response()->json([
            'success' => true,
            'data' => [
                'transactions' => $transactions,
                'today' => $todayTotal,
                'month' => $monthTotal,
                'year' => $yearTotal,
                'lifetime' => $lifetimeTotal,
                'pagination' => [
                    'page' => $transactions->currentPage(),
                    'limit' => $transactions->perPage(),
                    'total' => $transactions->total(),
                    'pages' => $transactions->lastPage()
                ]
            ],
        ]);
    }
    public function revenueByWallet(Request $request)
    {
        $user = User::where('user_id', $request->user_id)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => 'User not found',
                ],
            ], 404);
        }

        $wallets = Wallet::where('user_id', $user->user_id)->get();

        if ($wallets->isEmpty()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'WALLET_NOT_FOUND',
                    'message' => 'No wallets found for this user',
                ],
            ], 404);
        }

        $currencies = $wallets->pluck('currency')->toArray();

        // Base transaction query
        $baseQuery = Transaction::with(['provider'])
            ->orderBy('created_at', 'desc');

        // Role-based filtering
        switch ($user->role) {
            case 'AGENT':
                $baseQuery->where('agent_id', $user->agent_id)->where('for', 'AGENT');
                break;
            case 'PARTNER':
                $baseQuery->where('partner_id', $user->partner_id)->where('for', 'PARTNER');
                break;
            case 'MERCHANT':
                $baseQuery->where('merchant_id', $user->merchant_id)->where('for', 'MERCHANT');
                break;
            case 'SUPER_ADMIN':
                $baseQuery->where('superadmin_id', $user->user_id)->where('for', 'SUPER_ADMIN');
                break;
        }

        $baseQuery->whereIn('currency', $currencies);

        // Calculate total per wallet currency
        $walletTotals = [];
        foreach ($currencies as $currency) {
            $total = (clone $baseQuery)
                ->where('currency', $currency)
                ->sum('amount');
            $walletTotals[$currency] = $total;
        }

        return response()->json([
            'success' => true,
            'data' => [
                'wallets' => $walletTotals,
                'total' => array_sum($walletTotals), // optional: combined total across all currencies
            ],
        ]);
    }
    /**
     * Get payment data for public access (used for checkout pages).
     */
    public function getPaymentData($txnId)
    {
        $transaction = Transaction::where('txn_id', $txnId)->first();

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'TRANSACTION_NOT_FOUND',
                    'message' => 'Transaction not found'
                ]
            ], 404);
        }

        $data = [
            'txn_id' => $transaction->txn_id,
            'amount' => (float) $transaction->amount,
            'currency' => $transaction->currency,
            'transaction_type' => $transaction->transaction_type,
            'status' => $transaction->status,
            'provider_alias' => $transaction->provider_alias,
            'fx_rate' => (float) $transaction->fx_rate,
            'total_fee' => (float) $transaction->total_fee,
            'fee_breakdown' => [
                'gateway_fee' => (float) ($transaction->fee_breakdown['gateway_fee'] ?? 0),
                'processing_fee' => (float) ($transaction->fee_breakdown['processing_fee'] ?? 0)
            ],
            'estimated_cost' => $transaction->estimated_cost ? (float) $transaction->estimated_cost : null,
            'routing_strategy' => $transaction->routing_strategy,
            'routing_reason' => $transaction->routing_reason,
            'metadata' => $transaction->metadata,
            'created_at' => $transaction->created_at->toISOString(),
            'processed_at' => $transaction->processed_at?->toISOString(),
            'failure_reason' => $transaction->failure_reason
        ];

        if ($transaction->transaction_type === 'PAYMENT') {
            $data['merchant_id'] = $transaction->merchant_id;
            $data['channel_type'] = $transaction->channel_type;
            $data['customer_email'] = $transaction->customer_email;
            $data['recipient_details'] = $transaction->recipient_details;
        } elseif ($transaction->transaction_type === 'TOP_UP') {
            // Get providers that support this currency
            $currency = Currency::where('code', $transaction->currency)->first();
            if ($currency) {
                $providers = Provider::where('currency_id', $currency->id)
                    ->where('status', 'active')
                    ->get()
                    ->map(function ($provider) {
                        return [
                            'alias' => $provider->alias,
                            'name' => $provider->name,
                            'channel_name' => $provider->channel_name,
                            'fee_percentage' => (float) $provider->fee_percentage,
                            'fixed_amount' => (float) $provider->fixed_amount
                        ];
                    });

                $data['providers'] = $providers;
            } else {
                $data['providers'] = [];
            }
        }

        // Format the response to match frontend expectations
        $response = [
            'transaction' => [
                'txn_id' => $data['txn_id'],
                'amount' => $data['amount'],
                'currency' => $data['currency'],
                'transaction_type' => $data['transaction_type'] ?? null,
                'channel_type' => $data['channel_type'] ?? null,
            ],
            'providers' => $data['providers'] ?? []
        ];

        return response()->json([
            'success' => true,
            'data' => $response
        ]);
    }

    /**
     * Get transaction details by ID.
     */
    public function show($id)
    {
        $transaction = Transaction::with('merchant')->where('txn_id', $id)->first();

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'TRANSACTION_NOT_FOUND',
                    'message' => 'Transaction not found'
                ]
            ], 404);
        }

        $data = [
            'txn_id' => $transaction->txn_id,
            'amount' => (float) $transaction->amount,
            'currency' => $transaction->currency,
            'transaction_type' => $transaction->transaction_type,
            'status' => $transaction->status,
            'provider_alias' => $transaction->provider_alias,
            'fx_rate' => (float) $transaction->fx_rate,
            'total_fee' => (float) $transaction->total_fee,
            'fee_breakdown' => [
                'gateway_fee' => (float) ($transaction->fee_breakdown['gateway_fee'] ?? 0),
                'processing_fee' => (float) ($transaction->fee_breakdown['processing_fee'] ?? 0)
            ],
            'estimated_cost' => $transaction->estimated_cost ? (float) $transaction->estimated_cost : null,
            'routing_strategy' => $transaction->routing_strategy,
            'routing_reason' => $transaction->routing_reason,
            'metadata' => $transaction->metadata,
            'created_at' => $transaction->created_at->toISOString(),
            'processed_at' => $transaction->processed_at?->toISOString(),
            'failure_reason' => $transaction->failure_reason
        ];

        if ($transaction->transaction_type === 'PAYMENT') {
            $data['merchant_id'] = $transaction->merchant_id;
            $data['channel_type'] = $transaction->channel_type;
            $data['customer_email'] = $transaction->customer_email;
            $data['recipient_details'] = $transaction->recipient_details;
        } elseif ($transaction->transaction_type === 'TOP_UP') {
            // Get providers that support this currency
            $currency = \App\Models\Currency::where('code', $transaction->currency)->first();
            if ($currency) {
                $providers = Provider::where('currency_id', $currency->id)
                    ->where('status', 'active')
                    ->get()
                    ->map(function ($provider) {
                        return [
                            'alias' => $provider->alias,
                            'name' => $provider->name,
                            'channel_name' => $provider->channel_name,
                            'fee_percentage' => (float) $provider->fee_percentage,
                            'fixed_amount' => (float) $provider->fixed_amount
                        ];
                    });

                $data['providers'] = $providers;
            } else {
                $data['providers'] = [];
            }
        }

        // Format the response to match frontend expectations
        $response = [
            'transaction' => [
                'txn_id' => $data['txn_id'],
                'amount' => $data['amount'],
                'currency' => $data['currency'],
                'transaction_type' => $data['transaction_type'] ?? null,
                'channel_type' => $data['channel_type'] ?? null,
            ],
            'providers' => $data['providers'] ?? []
        ];

        return response()->json([
            'success' => true,
            'data' => $response
        ]);
    }

    /**
     * Process payment transaction.
     */
    public function processPayment(Request $request)
    {
        $txnId = $request->route('txnId');
        $providerAlias = $request->provider_alias;

        // Find the transaction
        $transaction = Transaction::where('txn_id', $txnId)->first();

        if (!$transaction) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'TRANSACTION_NOT_FOUND',
                    'message' => 'Transaction not found'
                ]
            ], 404);
        }

        if ($transaction->status !== 'PENDING') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'TRANSACTION_ALREADY_PROCESSED',
                    'message' => 'Transaction has already been processed'
                ]
            ], 400);
        }

        // For TOP_UP transactions
        if ($transaction->transaction_type === 'TOP_UP') {
            // Simulate payment processing
            $transaction->update([
                'status' => 'SUCCESS',
                'provider_alias' => $providerAlias,
                'fx_rate' => 1.0,
                'fee_breakdown' => ['gateway_fee' => 0.0, 'processing_fee' => 0.0],
                'estimated_cost' => $transaction->amount,
                'routing_strategy' => 'direct',
                'routing_reason' => 'Topup payment',
                'processed_at' => now()
            ]);

            // Credit the wallet
            $metadata = $transaction->metadata;
            if (isset($metadata['wallet_id'])) {
                $wallet = \App\Models\Wallet::find($metadata['wallet_id']);
                if ($wallet) {
                    $wallet->increment('balance', $transaction->amount);
                }
            }

            // Send notification
            NotificationService::transactionStatusUpdated($transaction, 'PENDING', 'SUCCESS');

            return response()->json([
                'success' => true,
                'data' => [
                    'txn_id' => $transaction->txn_id,
                    'status' => $transaction->status,
                    'provider_alias' => $transaction->provider_alias,
                    'fx_rate' => (float) $transaction->fx_rate,
                    'fee_breakdown' => [
                        'gateway_fee' => (float) ($transaction->fee_breakdown['gateway_fee'] ?? 0),
                        'processing_fee' => (float) ($transaction->fee_breakdown['processing_fee'] ?? 0)
                    ],
                    'estimated_cost' => $transaction->estimated_cost ? (float) $transaction->estimated_cost : null,
                    'routing_strategy' => $transaction->routing_strategy,
                    'routing_reason' => $transaction->routing_reason
                ]
            ]);
        }

        // For PAYMENT transactions (existing logic)
        $validator = Validator::make($request->all(), [
            'merchant_id' => 'required|string|exists:merchants,merchant_id',
            'amount' => 'required|numeric|min:0.01',
            'currency' => 'required|string',
            'channel_type' => 'required|string|in:CARD,BANK_TRANSFER,EWALLET,QR,CRYPTO',
            'customer_email' => 'nullable|email',
            'metadata' => 'nullable|array'
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

        // Check if merchant is active
        $merchant = Merchant::where('merchant_id', $request->merchant_id)->first();
        if ($merchant->status !== 'ACTIVE') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'MERCHANT_INACTIVE',
                    'message' => 'Merchant is not active'
                ]
            ], 400);
        }

        $txnId = 'TXN_' . Str::upper(Str::random(16));

        // Simulate payment processing (in real implementation, this would integrate with payment providers)
        $transaction = Transaction::create([
            'txn_id' => $txnId,
            'merchant_id' => $request->merchant_id,
            'amount' => $request->amount,
            'currency' => $request->currency,
            'channel_type' => $request->channel_type,
            'transaction_type' => 'PAYMENT',
            'customer_email' => $request->customer_email,
            'status' => 'SUCCESS', // Simulate successful processing
            'metadata' => $request->metadata,
            'provider_alias' => 'demo_provider',
            'fx_rate' => 1.0,
            'fee_breakdown' => ['gateway_fee' => 0.50, 'processing_fee' => 0.25],
            'estimated_cost' => $request->amount + 0.75,
            'routing_strategy' => 'cost_optimized',
            'routing_reason' => 'Best rate available',
            'processed_at' => now()
        ]);

        // Send notification for successful transaction
        NotificationService::transactionStatusUpdated($transaction, 'PENDING', 'SUCCESS');

        return response()->json([
            'success' => true,
            'data' => [
                'txn_id' => $transaction->txn_id,
                'status' => $transaction->status,
                'provider_alias' => $transaction->provider_alias,
                'fx_rate' => (float) $transaction->fx_rate,
                'fee_breakdown' => [
                    'gateway_fee' => (float) ($transaction->fee_breakdown['gateway_fee'] ?? 0),
                    'processing_fee' => (float) ($transaction->fee_breakdown['processing_fee'] ?? 0)
                ],
                'estimated_cost' => $transaction->estimated_cost ? (float) $transaction->estimated_cost : null,
                'routing_strategy' => $transaction->routing_strategy,
                'routing_reason' => $transaction->routing_reason
            ]
        ]);
    }
}
