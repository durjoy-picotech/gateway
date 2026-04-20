<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use App\Models\CurrencyFxRate;
use App\Models\User;
use App\Models\Wallet;
use App\Services\FxService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Http;

class CurrencyController extends Controller
{
    /**
     * List available currencies.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'search' => 'string|max:255',
            'type' => 'string|in:fiat,crypto',
            'enabled' => 'boolean',
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

        $query = Currency::query()->orderByDesc('created_at');

        // Search functionality
        if ($request->has('search') && !empty($request->search)) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('code', 'LIKE', '%' . $searchTerm . '%')
                    ->orWhere('name', 'LIKE', '%' . $searchTerm . '%')
                    ->orWhere('symbol', 'LIKE', '%' . $searchTerm . '%');
            });
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        if ($request->has('enabled')) {
            $query->where('enabled', $request->boolean('enabled'));
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 50); // Default to 50 for better performance

        $currencies = $query->orderBy('code')->paginate($limit, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => [
                'currencies' => $currencies->items(),
                'pagination' => [
                    'page' => $currencies->currentPage(),
                    'limit' => $currencies->perPage(),
                    'total' => $currencies->total(),
                    'pages' => $currencies->lastPage()
                ]
            ]
        ]);
    }

    /**
     * Add new currency.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'code' => 'required|string|unique:currencies,code',
            'name' => 'required|string|max:255',
            'symbol' => 'nullable|string|max:10',
            'type' => 'required|string|in:fiat,crypto',
            'precision' => 'integer|min:0|max:8',
            'exchange_rate' => 'numeric|min:0'
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

        $currency = Currency::create([
            'code' => strtoupper($request->code),
            'name' => $request->name,
            'symbol' => $request->symbol,
            'type' => $request->type,
            'precision' => $request->precision ?? 2,
            'exchange_rate' => $request->exchange_rate,
            'last_updated' => $request->exchange_rate ? now() : null
        ]);

        // Auto-create wallets for all SUPER_ADMIN users
        $superAdmins = User::where('role', 'SUPER_ADMIN')->get();
        foreach ($superAdmins as $superAdmin) {
            Wallet::firstOrCreate(
                [
                    'user_id' => $superAdmin->user_id,
                    'currency' => $currency->code
                ],
                [
                    'balance' => 0,
                    'held_balance' => 0,
                    'status' => 'ACTIVE'
                ]
            );
        }

        return response()->json([
            'success' => true,
            'message' => 'Currency created successfully',
            'data' => [
                'code' => $currency->code,
                'name' => $currency->name,
                'symbol' => $currency->symbol,
                'type' => $currency->type,
                'precision' => $currency->precision,
                'enabled' => $currency->enabled,
                'exchange_rate' => $currency->exchange_rate,
                'last_updated' => $currency->last_updated?->toISOString()
            ]
        ], 201);
    }

    /**
     * Update currency.
     */
    public function update(Request $request, $code)
    {
        $currency = Currency::where('code', strtoupper($code))->first();

        if (!$currency) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CURRENCY_NOT_FOUND',
                    'message' => 'Currency not found'
                ]
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'string|max:255',
            'symbol' => 'nullable|string|max:10',
            'type' => 'string|in:fiat,crypto',
            'precision' => 'integer|min:0|max:8',
            'exchange_rate' => 'numeric|min:0'
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

        $updateData = [];
        if ($request->has('name')) $updateData['name'] = $request->name;
        if ($request->has('symbol')) $updateData['symbol'] = $request->symbol;
        if ($request->has('type')) $updateData['type'] = $request->type;
        if ($request->has('precision')) $updateData['precision'] = $request->precision;
        if ($request->has('exchange_rate')) {
            $updateData['exchange_rate'] = $request->exchange_rate;
            $updateData['last_updated'] = now();
        }

        $currency->update($updateData);

        return response()->json([
            'success' => true,
            'message' => 'Currency updated successfully',
            'data' => [
                'code' => $currency->code,
                'name' => $currency->name,
                'symbol' => $currency->symbol,
                'type' => $currency->type,
                'precision' => $currency->precision,
                'enabled' => $currency->enabled,
                'exchange_rate' => $currency->exchange_rate,
                'last_updated' => $currency->last_updated?->toISOString()
            ]
        ]);
    }

    /**
     * Delete currency.
     */
    public function destroy($code)
    {
        $currency = Currency::where('code', strtoupper($code))->first();

        if (!$currency) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CURRENCY_NOT_FOUND',
                    'message' => 'Currency not found'
                ]
            ], 404);
        }

        // Check if currency is being used in transactions or wallets
        $transactionCount = \App\Models\Transaction::where('currency', $currency->code)->count();
        $walletCount = \App\Models\Wallet::where('currency', $currency->code)->count();

        if ($transactionCount > 0 || $walletCount > 0) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CURRENCY_IN_USE',
                    'message' => 'Cannot delete currency that is being used in transactions or wallets'
                ]
            ], 400);
        }

        $currency->delete();

        return response()->json([
            'success' => true,
            'message' => 'Currency deleted successfully'
        ]);
    }

    /**
     * Enable/disable currency.
     */
    public function toggleEnabled($code)
    {
        $currency = Currency::where('code', strtoupper($code))->first();

        if (!$currency) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CURRENCY_NOT_FOUND',
                    'message' => 'Currency not found'
                ]
            ], 404);
        }

        $currency->update(['enabled' => !$currency->enabled]);

        return response()->json([
            'success' => true,
            'message' => 'Currency ' . ($currency->enabled ? 'enabled' : 'disabled') . ' successfully'
        ]);
    }

    /**
     * Get current FX rates.
     */
    public function getFxRates(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'from_currency' => 'string',
            'to_currency' => 'string',
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

        $query = Currency::enabled()->whereNotNull('exchange_rate');

        if ($request->has('from_currency')) {
            $query->where('code', strtoupper($request->from_currency));
        }

        if ($request->has('to_currency')) {
            $query->where('code', strtoupper($request->to_currency));
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 10);

        $currencies = $query->orderBy('code')->paginate($limit, ['*'], 'page', $page);


        $fxRates = [];
        foreach ($currencies->items() as $currency) {
            $currencyfxRate = CurrencyFxRate::where('to_currency', $currency->code)->first();
            $fxRates[] = [
                'fx_id' => 'fx_' . $currency->code,
                'from_currency' => 'USD', // Base currency
                'to_currency' => $currency->code,
                'source' => 'MARKET',
                'raw_rate' => $currency->exchange_rate,
                'final_rate' => $currency->exchange_rate - ($currency->exchange_rate * ($currencyfxRate ? $currencyfxRate->bps : 0) / 100),
                'markup_bps' => $currencyfxRate ? $currencyfxRate->bps : 0,
                'rounding_mode' => 'BANKERS',
                'scale' => 6,
                'created_at' => $currency->last_updated?->toISOString() ?? now()->toISOString()
            ];
        }

        return response()->json([
            'success' => true,
            'data' => [
                'fx_rates' => $fxRates,
                'pagination' => [
                    'page' => $currencies->currentPage(),
                    'limit' => $currencies->perPage(),
                    'total' => $currencies->total(),
                    'pages' => $currencies->lastPage()
                ],
                'base_currency' => 'USD',
                'last_updated' => now()->toISOString()
            ]
        ]);
    }

    /**
     * Refresh FX rates from external sources.
     */
    public function refreshFxRates(Request $request)
    {
        try {
            // This is a placeholder implementation
            // In a real implementation, you would call external FX APIs
            $updatedCount = $this->fetchAndUpdateRates();

            return response()->json([
                'success' => true,
                'message' => "FX rates refreshed successfully. Updated {$updatedCount} currencies.",
                'last_updated' => now()->toISOString()
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'FX_REFRESH_FAILED',
                    'message' => 'Failed to refresh FX rates: ' . $e->getMessage()
                ]
            ], 500);
        }
    }

    /**
     * Fetch and update FX rates from external APIs.
     */
    private function fetchAndUpdateRates()
    {
        $fxService = app(FxService::class);
        return $fxService->refreshAllRates();
    }


    /**
     * Fetch exchange rate from external API (AlphaVantage).
     */
    public function fetchExchangeRate(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'from_currency' => 'required|string',
            'to_currency' => 'string'
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
        $toCurrency = strtoupper($request->to_currency ?: 'USD');

        try {
            $apiKey = config('services.alphavantage.api_key');
            $baseUrl = config('services.alphavantage.base_url', 'https://www.alphavantage.co');

            if (!$apiKey) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'API_KEY_MISSING',
                        'message' => 'AlphaVantage API key not configured'
                    ]
                ], 500);
            }

            $response = Http::get("{$baseUrl}/query", [
                'function' => 'CURRENCY_EXCHANGE_RATE',
                'from_currency' => $fromCurrency,
                'to_currency' => $toCurrency,
                'apikey' => $apiKey
            ]);

            if (!$response->successful()) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'EXTERNAL_API_ERROR',
                        'message' => 'Failed to fetch exchange rate from external API'
                    ]
                ], 500);
            }

            $data = $response->json();

            if (!isset($data['Realtime Currency Exchange Rate'])) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'INVALID_API_RESPONSE',
                        'message' => 'Invalid response from exchange rate API'
                    ]
                ], 500);
            }

            $exchangeRate = $data['Realtime Currency Exchange Rate']['5. Exchange Rate'];
            $lastRefreshed = $data['Realtime Currency Exchange Rate']['6. Last Refreshed'];

            return response()->json([
                'success' => true,
                'data' => [
                    'from_currency' => $fromCurrency,
                    'to_currency' => $toCurrency,
                    'exchange_rate' => (float) $exchangeRate,
                    'last_refreshed' => $lastRefreshed
                ]
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'FETCH_ERROR',
                    'message' => 'Error fetching exchange rate: ' . $e->getMessage()
                ]
            ], 500);
        }
    }

    /**
     * Convert currency amount.
     */
    public function convertCurrency(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'amount' => 'required|numeric|min:0',
            'from_currency' => 'required|string',
            'to_currency' => 'required|string'
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

        $fromCurrency = Currency::enabled()->where('code', strtoupper($request->from_currency))->first();
        $toCurrency = Currency::enabled()->where('code', strtoupper($request->to_currency))->first();

        if (!$fromCurrency || !$toCurrency) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'CURRENCY_NOT_FOUND',
                    'message' => 'One or both currencies not found or disabled'
                ]
            ], 404);
        }

        // Calculate final exchange rate with markup
        if ($fromCurrency->code !== 'USD' && $toCurrency->code !== 'USD') {
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
            $fromToUsdRate = $usdModel->exchange_rate / $fromCurrency->exchange_rate;
            $fromToUsdMarkup = 0;
            $fxRateFromToUsd = CurrencyFxRate::where('from_currency', $fromCurrency->code)
                ->where('to_currency', 'USD')
                ->first();
            if ($fxRateFromToUsd) {
                $fromToUsdMarkup = $fxRateFromToUsd->bps / 100; // Add markup for converting to USD
            }
            $finalFromToUsdRate = $fromToUsdRate * (1 + $fromToUsdMarkup);

            // Second leg: USD -> to
            $usdToToRate = $toCurrency->exchange_rate / $usdModel->exchange_rate;
            $usdToToMarkup = 0;
            $fxRateUsdToTo = CurrencyFxRate::where('from_currency', 'USD')
                ->where('to_currency', $toCurrency->code)
                ->first();
            if ($fxRateUsdToTo) {
                $usdToToMarkup = -$fxRateUsdToTo->bps / 100; // Subtract markup for converting from USD
            }
            $finalUsdToToRate = $usdToToRate * (1 + $usdToToMarkup);

            // Combined rate
            $finalExchangeRate = $finalFromToUsdRate * $finalUsdToToRate;
            $convertedAmount = $toCurrency->convertAmount($request->amount, $fromCurrency, $finalExchangeRate);
        } else {
            // Direct conversion involving USD
            $baseRate = $toCurrency->exchange_rate / $fromCurrency->exchange_rate;
            $markupPercentage = 0;

            // Check if from_currency is USD (base currency)
            if ($fromCurrency->code === 'USD') {
                // Subtract markup when converting from USD
                $fxRate = CurrencyFxRate::where('from_currency', $fromCurrency->code)
                    ->where('to_currency', $toCurrency->code)
                    ->first();
                if ($fxRate) {
                    $markupPercentage = -$fxRate->bps / 100; // Negative for subtraction
                }
            } elseif ($toCurrency->code === 'USD') {
                // Add markup when converting to USD
                $fxRate = CurrencyFxRate::where('from_currency', $fromCurrency->code)
                    ->where('to_currency', $toCurrency->code)
                    ->first();
                if ($fxRate) {
                    $markupPercentage = $fxRate->bps / 100; // Positive for addition
                }
            }

            $finalExchangeRate = $baseRate * (1 + $markupPercentage);
            $convertedAmount = $toCurrency->convertAmount($request->amount, $fromCurrency, $finalExchangeRate);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'original_amount' => $request->amount,
                'converted_amount' => round($convertedAmount, $toCurrency->precision),
                'from_currency' => $fromCurrency->code,
                'to_currency' => $toCurrency->code,
                'exchange_rate' => $finalExchangeRate,
                'formatted_result' => $toCurrency->formatAmount($convertedAmount)
            ]
        ]);
    }



    public function updateCurrencyFx(Request $request)
    {


        $validator = Validator::make($request->all(), [
            'bps' => 'required|numeric|min:0',
            'from_currency' => 'required|string',
            'to_currency' => 'required|string'
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

        $fxRate = CurrencyFxRate::where('from_currency', $request->from_currency)->where('to_currency', $request->to_currency)->first();

        if (!$fxRate) {

            $fxRate = new CurrencyFxRate();
            $fxRate->from_currency = $request->from_currency;
            $fxRate->to_currency = $request->to_currency;
            $fxRate->bps = $request->bps;
            $fxRate->save();
        } else {
            $fxRate->bps = $request->bps;
            $fxRate->save();
        }

        return response()->json([
            'success' => true,
            'data' => ['bps' => $fxRate->bps]
        ]);
    }
}
