<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Models\WalletTransaction;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Models\Partner;
use App\Models\Agent;
use App\Models\CurrencyFxRate;
use App\Models\Merchant;
use Illuminate\Database\Schema\IndexDefinition;
use Ramsey\Uuid\Builder\DegradedUuidBuilder;
use Symfony\Component\HttpKernel\HttpCache\Store;

class WalletController extends Controller
{
    /**
     * Get user's wallet balance.
     */
    public function getBalance(Request $request)
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'currency' => 'nullable|string'
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

        $currency = $request->currency ?? 'USD';

        // Get or create wallet for the user
        $wallet = Wallet::firstOrCreate(
            ['user_id' => $user->user_id, 'currency' => $currency],
            ['balance' => 0, 'status' => 'ACTIVE']
        );

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->user_id,
                'role' => $user->role,
                'currency' => $wallet->currency,
                'balance' => (float) ($wallet->balance + $wallet->held_balance),
                'held_balance' => (float) $wallet->held_balance,
                'available_balance' => (float) ($wallet->balance),
                // 'available_balance' => (float) ($wallet->balance - $wallet->held_balance),
                'status' => $wallet->status,
                'last_updated' => $wallet->updated_at->toISOString()
            ]
        ]);
    }

    /**
     * Get all user wallets.
     */
    public function getWallets(Request $request)
    {
        $user = Auth::user();

        $wallets = Wallet::where('user_id', $user->user_id)->get();

        $walletData = $wallets->map(function ($wallet) {
            return [
                'id' => $wallet->id,
                'currency' => $wallet->currency,
                'balance' => (float) ($wallet->balance + $wallet->held_balance),
                'held_balance' => (float) $wallet->held_balance,
                'available_balance' => (float) ($wallet->balance),
                // 'available_balance' => (float) ($wallet->balance - $wallet->held_balance),
                'status' => $wallet->status,
                'created_at' => $wallet->created_at->toISOString(),
                'last_updated' => $wallet->updated_at->toISOString()
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->user_id,
                'role' => $user->role,
                'wallets' => $walletData
            ]
        ]);
    }

    /**
     * Get available currencies for wallet creation.
     */
    public function getAvailableCurrencies(Request $request)
    {
        $user = Auth::user();

        // Get all enabled currencies
        $allCurrencies = Currency::enabled()->orderBy('code');

        // Get user's existing wallets
        $userWallets = Wallet::where('user_id', $user->user_id)
            ->pluck('currency')
            ->toArray();

        if ($user) {
            if ($user->role == 'PARTNER') {
                $partner = Partner::where('partner_id',$user->partner_id)->first();
                $enabled_currencies = $partner->enabled_currencies;
                $allCurrencies = $allCurrencies->whereIn('code',$enabled_currencies);
            }elseif($user->role == 'AGENT'){
                $agent = Agent::where('agent_id',$user->agent_id)->first();
                $enabled_currencies = $agent->enabled_currencies;
                $allCurrencies = $allCurrencies->whereIn('code',$enabled_currencies);
            }elseif($user->role == 'MERCHANT'){
                $merchant = Merchant::where('merchant_id',$user->merchant_id)->first();
                $enabled_currencies = $merchant->enabled_currencies;
                $allCurrencies = $allCurrencies->whereIn('code',$enabled_currencies);
            }
        }
        $allCurrencies = $allCurrencies->get();
        $availableCurrencies = $allCurrencies->filter(function ($currency) use ($userWallets) {
            return !in_array($currency->code, $userWallets);
        })->map(function ($currency) {
            return [
                'code' => $currency->code,
                'name' => $currency->name,
                'symbol' => $currency->symbol,
                'type' => $currency->type,
                'precision' => $currency->precision
            ];
        })->values();

        return response()->json([
            'success' => true,
            'data' => [
                'available_currencies' => $availableCurrencies,
                'existing_wallets_count' => count($userWallets)
            ]
        ]);
    }

    /**
     * Exchange currency between wallets.
     */
    public function exchange(Request $request)
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'from_currency' => 'required|string',
            'to_currency' => 'required|string|different:from_currency',
            'amount' => 'required|numeric|min:0.01',
            'notes' => 'nullable|string|max:255'
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

        $fromCurrency = strtoupper($request->from_currency);
        $toCurrency = strtoupper($request->to_currency);
        $amount = $request->amount;

        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
            ], 404);
        }

        if ($user && $user->role === 'SUPER_ADMIN') {
            return response()->json([
                'success' => false,
                'message' => 'You can not do this Action',
            ], 404);
        }

        // Get user's wallets
        $fromWallet = Wallet::where('user_id', $user->user_id)
            ->where('currency', $fromCurrency)
            ->first();

        $toWallet = Wallet::where('user_id', $user->user_id)
            ->where('currency', $toCurrency)
            ->first();
        if ($fromWallet->balance < $amount) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'WALLET_ERROR_FOUND',
                    'message' => "You don't have that much in your balance"
                ]
            ], 404);
        }
        if (!$fromWallet) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'WALLET_NOT_FOUND',
                    'message' => "You don't have a {$fromCurrency} wallet"
                ]
            ], 404);
        }

        if (!$toWallet) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'WALLET_NOT_FOUND',
                    'message' => "You don't have a {$toCurrency} wallet"
                ]
            ], 404);
        }

        // Check sufficient balance
        $availableBalance = $fromWallet->balance - $fromWallet->held_balance;

        // Get currency models
        $fromCurrencyModel = Currency::where('code', $fromCurrency)->first();
        $toCurrencyModel = Currency::where('code', $toCurrency)->first();

        if (!$fromCurrencyModel || !$toCurrencyModel) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'EXCHANGE_RATE_UNAVAILABLE',
                    'message' => 'Unable to get exchange rate at this time'
                ]
            ], 503);
        }

        // Calculate final exchange rate with markup
        if ($fromCurrencyModel->code !== 'USD' && $toCurrencyModel->code !== 'USD') {
            // Convert through USD: from -> USD -> to
            $usdModel = Currency::where('code', 'USD')->first();
            if (!$usdModel) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'EXCHANGE_RATE_UNAVAILABLE',
                        'message' => 'Unable to get USD exchange rate'
                    ]
                ], 503);
            }

            // First leg: from -> USD
            $fromToUsdRate = $usdModel->exchange_rate / $fromCurrencyModel->exchange_rate;
            $fromToUsdMarkup = 0;
            $fxRateFromToUsd = CurrencyFxRate::where('from_currency', $fromCurrencyModel->code)
                                             ->where('to_currency', 'USD')
                                             ->first();
            if ($fxRateFromToUsd) {
                $fromToUsdMarkup = $fxRateFromToUsd->bps / 100; // Add markup for converting to USD
            }
            $finalFromToUsdRate = $fromToUsdRate * (1 + $fromToUsdMarkup);

            // Second leg: USD -> to
            $usdToToRate = $toCurrencyModel->exchange_rate / $usdModel->exchange_rate;
            $usdToToMarkup = 0;
            $fxRateUsdToTo = CurrencyFxRate::where('from_currency', 'USD')
                                           ->where('to_currency', $toCurrencyModel->code)
                                           ->first();
            if ($fxRateUsdToTo) {
                $usdToToMarkup = -$fxRateUsdToTo->bps / 100; // Subtract markup for converting from USD
            }
            $finalUsdToToRate = $usdToToRate * (1 + $usdToToMarkup);

            // Combined rate
            $finalExchangeRate = $finalFromToUsdRate * $finalUsdToToRate;
            $convertedAmount = $toCurrencyModel->convertAmount($request->amount, $fromCurrencyModel, $finalExchangeRate);
            $markupRate = ($fromToUsdMarkup + $usdToToMarkup) * 100;
        } else {
            // Direct conversion involving USD
            $baseRate = $toCurrencyModel->exchange_rate / $fromCurrencyModel->exchange_rate;
            $markupPercentage = 0;

            // Check if from_currency is USD (base currency)
            if ($fromCurrencyModel->code === 'USD') {
                // Subtract markup when converting from USD
                $fxRate = CurrencyFxRate::where('from_currency', $fromCurrencyModel->code)
                                       ->where('to_currency', $toCurrencyModel->code)
                                       ->first();
                if ($fxRate) {
                    $markupPercentage = -$fxRate->bps / 100; // Negative for subtraction
                }
            } elseif ($toCurrencyModel->code === 'USD') {
                // Add markup when converting to USD
                $fxRate = CurrencyFxRate::where('from_currency', $fromCurrencyModel->code)
                                       ->where('to_currency', $toCurrencyModel->code)
                                       ->first();
                if ($fxRate) {
                    $markupPercentage = $fxRate->bps / 100; // Positive for addition
                }
            }

            $finalExchangeRate = $baseRate * (1 + $markupPercentage);
            $convertedAmount = $toCurrencyModel->convertAmount($request->amount, $fromCurrencyModel, $finalExchangeRate);
            $markupRate = $markupPercentage * 100;
        }

        $exchangeRate = $finalExchangeRate;
        $toAmount = $convertedAmount;
        $grandExchangeRate = $request->amount / $toAmount;


        DB::beginTransaction();
        try {
            // Determine merchant_id, agent_id, partner_id based on user role
            $merchantId = null;
            $agentId = null;
            $partnerId = null;

            if ($user->role === 'MERCHANT') {
                $merchantId = $user->merchant_id;
                $merchant = Merchant::where('merchant_id', $merchantId)->first();
                if ($merchant) {
                    $agentId = $merchant->agent_id;
                    $agent = Agent::where('agent_id', $agentId)->first();
                    if ($agent) {
                        $partnerId = $agent->partner_id;
                    }
                }
            } elseif ($user->role === 'AGENT') {
                $agentId = $user->agent_id;
                $agent = Agent::where('agent_id', $agentId)->first();
                if ($agent) {
                    $partnerId = $agent->partner_id;
                }
            } elseif ($user->role === 'PARTNER') {
                $partnerId = $user->partner_id;
            }

            // Create transaction record
            $txnId = 'EXC_' . Str::upper(Str::random(16));
            $transaction = Transaction::create([
                'txn_id' => $txnId,
                'user_id' => $user->user_id,
                'amount' => $amount,
                'currency' => $fromCurrency,
                'channel_type' => 'EWALLET',
                'transaction_type' => 'EXCHANGE',
                'status' => 'SUCCESS',
                'metadata' => [
                    'from_currency' => $fromCurrency,
                    'to_currency' => $toCurrency,
                    'from_amount' => $amount,
                    'to_amount' => $toAmount,
                    'exchange_rate' => $exchangeRate,
                    'markup_rate' => $markupRate,
                    'from_wallet_id' => $fromWallet->id,
                    'to_wallet_id' => $toWallet->id
                ],
                'processed_at' => now(),
                'completed_at' => now()
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

            // Create wallet transaction record
            $walletTransaction = WalletTransaction::create([
                'user_id' => $user->user_id,
                'from_wallet_id' => $fromWallet->id,
                'to_wallet_id' => $toWallet->id,
                'from_currency' => $fromCurrency,
                'to_currency' => $toCurrency,
                'from_amount' => $amount,
                'to_amount' => $toAmount,
                'exchange_rate' => $grandExchangeRate,
                'markup_rate' => $markupRate,
                'status' => 'COMPLETED',
                'notes' => $request->notes,
                'processed_at' => now()
            ]);

            // Update wallet balances
            $fromWallet->decrement('balance', $amount);
            $toWallet->increment('balance', $toAmount);

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'Currency exchange completed successfully',
                'data' => [
                    'transaction_id' => $walletTransaction->transaction_id,
                    'from_currency' => $fromCurrency,
                    'to_currency' => $toCurrency,
                    'exchanged_amount' => $amount,
                    'received_amount' => round($toAmount, 2),
                    'exchange_rate' => round($exchangeRate, 6),
                    'from_wallet_balance' => $fromWallet->fresh()->balance,
                    'to_wallet_balance' => $toWallet->fresh()->balance,
                    'processed_at' => $walletTransaction->processed_at->toISOString()
                ]
            ]);

        } catch (\Exception $e) {
            DB::rollBack();

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'EXCHANGE_FAILED',
                    'message' => 'Exchange failed: ' . $e->getMessage()
                ]
            ], 500);
        }
    }

    /**
     * Get all wallets for SUPER_ADMIN (admin view).
     */
    public function getAllWallets(Request $request)
    {
        $user = Auth::user();

        // Only SUPER_ADMIN can access this endpoint
        if ($user->role !== 'SUPER_ADMIN') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'ACCESS_DENIED',
                    'message' => 'Access denied. SUPER_ADMIN role required.'
                ]
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'user_id' => 'string',
            'currency' => 'string',
            'status' => 'string|in:ACTIVE,FROZEN,SUSPENDED',
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

        $query = Wallet::with(['user:id,user_id,name,email,role']);

        if ($request->has('user_id')) {
            $query->where('user_id', $request->user_id);
        }

        if ($request->has('currency')) {
            $query->where('currency', strtoupper($request->currency));
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 50);

        $wallets = $query->paginate($limit, ['*'], 'page', $page);

        $walletData = $wallets->map(function ($wallet) {
            return [
                'id' => $wallet->id,
                'user' => [
                    'user_id' => $wallet->user->user_id,
                    'name' => $wallet->user->name,
                    'email' => $wallet->user->email,
                    'role' => $wallet->user->role
                ],
                'currency' => $wallet->currency,
                'symbol' => $wallet->currencList->symbol,
                'balance' => (float) $wallet->balance,
                'held_balance' => (float) $wallet->held_balance,
                'available_balance' => (float) ($wallet->balance - $wallet->held_balance),
                'status' => $wallet->status,
                'created_at' => $wallet->created_at->toISOString(),
                'updated_at' => $wallet->updated_at->toISOString()
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'wallets' => $walletData,
                'pagination' => [
                    'page' => $wallets->currentPage(),
                    'limit' => $wallets->perPage(),
                    'total' => $wallets->total(),
                    'pages' => $wallets->lastPage()
                ]
            ]
        ]);
    }

    /**
     * Initiate wallet topup.
     */
    public function topup(Request $request)
    {
        $user = Auth::user();

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

        // Create topup transaction
        $txnId = 'TOP_' . Str::upper(Str::random(16));

        $transaction = Transaction::create([
            'txn_id' => $txnId,
            'merchant_id' => null, // No merchant for user topup
            'amount' => $amount,
            'currency' => $currency,
            'channel_type' => 'CARD', // Dummy value for topup
            'transaction_type' => 'TOP_UP',
            'status' => 'PENDING',
            'metadata' => [
                'user_id' => $user->user_id,
                'wallet_id' => $wallet->id
            ]
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Topup initiated successfully',
            'data' => [
                'txn_id' => $transaction->txn_id,
                'amount' => (float) $transaction->amount,
                'currency' => $transaction->currency,
                'status' => $transaction->status
            ]
        ], 201);
    }

    /**
     * Get wallet details and transaction ledger for SUPER_ADMIN.
     */
    public function getWalletDetails($walletId, Request $request)
    {
        $user = Auth::user();

        // Only SUPER_ADMIN can access this endpoint
        if ($user->role !== 'SUPER_ADMIN') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'ACCESS_DENIED',
                    'message' => 'Access denied. SUPER_ADMIN role required.'
                ]
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'page' => 'integer|min:1',
            'limit' => 'integer|min:1|max:100',
            'date_from' => 'date',
            'date_to' => 'date|after_or_equal:date_from'
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

        $wallet = Wallet::with(['user:id,user_id,name,email,role'])->find($walletId);

        if (!$wallet) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'WALLET_NOT_FOUND',
                    'message' => 'Wallet not found'
                ]
            ], 404);
        }

        // Get transaction history
        $query = WalletTransaction::where(function ($q) use ($walletId) {
            $q->where('from_wallet_id', $walletId)
              ->orWhere('to_wallet_id', $walletId);
        });

        if ($request->has('date_from')) {
            $query->where('created_at', '>=', $request->date_from . ' 00:00:00');
        }

        if ($request->has('date_to')) {
            $query->where('created_at', '<=', $request->date_to . ' 23:59:59');
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 50);

        $transactions = $query->orderBy('created_at', 'desc')
            ->paginate($limit, ['*'], 'page', $page);

        $transactionData = $transactions->map(function ($transaction) use ($walletId) {
            $isFromWallet = $transaction->from_wallet_id == $walletId;
            $isToWallet = $transaction->to_wallet_id == $walletId;

            return [
                'transaction_id' => $transaction->transaction_id,
                'type' => $isFromWallet && $isToWallet ? 'INTERNAL' : ($isFromWallet ? 'DEBIT' : 'CREDIT'),
                'amount' => $isFromWallet ? -$transaction->from_amount : $transaction->to_amount,
                'currency' => $isFromWallet ? $transaction->from_currency : $transaction->to_currency,
                'counterparty_currency' => $isFromWallet ? $transaction->to_currency : $transaction->from_currency,
                'counterparty_amount' => $isFromWallet ? $transaction->to_amount : $transaction->from_amount,
                'exchange_rate' => (float) $transaction->exchange_rate,
                'markup_rate' => $transaction->markup_rate ? (float) $transaction->markup_rate : null,
                'fee' => (float) $transaction->fee,
                'status' => $transaction->status,
                'notes' => $transaction->notes,
                'processed_at' => $transaction->processed_at?->toISOString(),
                'created_at' => $transaction->created_at->toISOString()
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'wallet' => [
                    'id' => $wallet->id,
                    'user' => [
                        'user_id' => $wallet->user->user_id,
                        'name' => $wallet->user->name,
                        'email' => $wallet->user->email,
                        'role' => $wallet->user->role
                    ],
                    'currency' => $wallet->currency,
                    'balance' => (float) $wallet->balance,
                    'held_balance' => (float) $wallet->held_balance,
                    'available_balance' => (float) ($wallet->balance - $wallet->held_balance),
                    'status' => $wallet->status,
                    'created_at' => $wallet->created_at->toISOString(),
                    'updated_at' => $wallet->updated_at->toISOString()
                ],
                'ledger' => [
                    'transactions' => $transactionData,
                    'pagination' => [
                        'page' => $transactions->currentPage(),
                        'limit' => $transactions->perPage(),
                        'total' => $transactions->total(),
                        'pages' => $transactions->lastPage()
                    ]
                ]
            ]
        ]);
    }

    public function getAllWalletsByusers(Request $request)
    {
        $user = Auth::user();

        $query = Wallet::with(['user:id,user_id,name,email,role']);

        if ($user->role !== 'SUPER_ADMIN') {
            if ($request->has('user_id')) {
                $query->where('user_id', $request->user_id);
            }
        }


        $wallets = $query->get();

        return response()->json([
            'success' => true,
            'data' => [
                'wallets' => $wallets,
            ]
        ]);
    }
}





// crete

// public function requestStore(Request $request)
// {
//     $request->validate([
//         'email' => 'required|email',
//         'currency' => 'required|string',
//         'amount' => 'required|numeric|min:1',
//     ]);

//     $sender = auth()->user();
//     $receiver = User::where('email', $request->email)->first();

//     if (!$receiver) {
//         return response()->json([
//             'success' => false,
//             'message' => 'Receiver not found'
//         ]);
//     }

//     if ($sender->id === $receiver->id) {
//         return response()->json([
//             'success' => false,
//             'message' => 'Cannot request yourself'
//         ]);
//     }

//     $req = PaymentRequest::create([
//         'sender_id' => $sender->id,
//         'receiver_id' => $receiver->id,
//         'currency' => strtoupper($request->currency),
//         'amount' => $request->amount,
//         'status' => 'pending'
//     ]);

//     return response()->json([
//         'success' => true,
//         'message' => 'Request sent',
//         'data' => $req
//     ]);
// }


// Index



// use App\Models\Request as PaymentRequest;

// public function requestIndex()
// {
//     $user = auth()->user();

//     $requests = PaymentRequest::with(['sender', 'receiver'])
//         ->where('sender_id', $user->id)
//         ->orWhere('receiver_id', $user->id)
//         ->latest()
//         ->get();

//     return response()->json([
//         'success' => true,
//         'data' => $requests
//     ]);
// }



// <a
// public function acceptRequest($id)
// {
//     $user = auth()->user();

//     $request = PaymentRequest::findOrFail($id);

//     if ($request->receiver_id !== $user->id) {
//         return response()->json(['message' => 'Unauthorized'], 403);
//     }

//     if ($request->status !== 'pending') {
//         return response()->json(['message' => 'Already processed']);
//     }

//     $senderWallet = Wallet::where('user_id', $request->sender_id)
//         ->where('currency', $request->currency)
//         ->first();

//     $receiverWallet = Wallet::where('user_id', $request->receiver_id)
//         ->where('currency', $request->currency)
//         ->first();

//     if ($receiverWallet->balance < $request->amount) {
//         return response()->json([
//             'message' => 'Insufficient balance'
//         ], 400);
//     }

//     // 💸 deduct
//     $receiverWallet->decrement('balance', $request->amount);

//     // 💰 add
//     $senderWallet->increment('balance', $request->amount);

//     // 🔥 optional: Transfer table তেও save করতে পারো
//     Transfer::create([
//         'sender_id' => $request->sender_id,
//         'receiver_id' => $request->receiver_id,
//         'currency' => $request->currency,
//         'amount' => $request->amount,
//         'fee' => 0,
//     ]);

//     $request->status = 'accepted';
//     $request->save();

//     return response()->json(['success' => true]);
// }



// r
// public function rejectRequest($id)
// {
//     $user = auth()->user();

//     $request = PaymentRequest::findOrFail($id);

//     if ($request->receiver_id !== $user->id) {
//         return response()->json(['message' => 'Unauthorized'], 403);
//     }

//     $request->status = 'rejected';
//     $request->save();

//     return response()->json(['success' => true]);
// }


// Deg

// Route::middleware('auth:api')->group(function () {

//     // ✅ Direct Transfer
//     Route::apiResource('transfers', TransferController::class)->only(['index', 'store']);

//     // ✅ Request System
//     Route::get('requests', [TransferController::class, 'requestIndex']);
//     Route::post('requests', [TransferController::class, 'requestStore']);
//     Route::post('requests/{id}/accept', [TransferController::class, 'acceptRequest']);
//     Route::post('requests/{id}/reject', [TransferController::class, 'rejectRequest']);
// });
