<?php

namespace App\Services;

use App\Models\Currency;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Cache;

class FxService
{
    protected $baseUrl;
    protected $apiKey;

    public function __construct()
    {
        $this->baseUrl = config('services.alphavantage.base_url', 'https://www.alphavantage.co');
        $this->apiKey = config('services.alphavantage.api_key');
    }

    /**
     * Get exchange rate from Alpha Vantage API.
     */
    public function getExchangeRate($fromCurrency, $toCurrency)
    {
        // Check cache first
        $cacheKey = "fx_rate_{$fromCurrency}_{$toCurrency}";
        $cachedRate = Cache::get($cacheKey);

        if ($cachedRate) {
            return $cachedRate;
        }

        try {
            $response = Http::timeout(30)->get("{$this->baseUrl}/query", [
                'function' => 'CURRENCY_EXCHANGE_RATE',
                'from_currency' => $fromCurrency,
                'to_currency' => $toCurrency,
                'apikey' => $this->apiKey
            ]);

            if ($response->successful()) {
                $data = $response->json();

                if (isset($data['Realtime Currency Exchange Rate']['5. Exchange Rate'])) {
                    $rate = (float) $data['Realtime Currency Exchange Rate']['5. Exchange Rate'];

                    // Cache for 5 minutes
                    Cache::put($cacheKey, $rate, now()->addMinutes(5));

                    return $rate;
                }
            }

            Log::warning('Alpha Vantage API error', [
                'from' => $fromCurrency,
                'to' => $toCurrency,
                'response' => $response->body()
            ]);

        } catch (\Exception $e) {
            Log::error('Alpha Vantage API exception', [
                'from' => $fromCurrency,
                'to' => $toCurrency,
                'error' => $e->getMessage()
            ]);
        }

        return null;
    }

    /**
     * Get exchange rate with markup applied.
     */
    public function getExchangeRateWithMarkup($fromCurrency, $toCurrency, $userScopeType = null, $userScopeId = null)
    {
        $baseRate = $this->getExchangeRate($fromCurrency, $toCurrency);

        if (!$baseRate) {
            return null;
        }

        // Get applicable FX policy
        $policy = $this->getApplicableFxPolicy($userScopeType, $userScopeId);

        if (!$policy || !$policy->enabled) {
            return $baseRate;
        }

        // Apply markup
        $markupRate = 1 + ($policy->markup_bps / 10000); // Convert bps to decimal
        $markedUpRate = $baseRate * $markupRate;

        // Apply fixed spread if configured
        if ($policy->fixed_spread > 0) {
            $markedUpRate -= $policy->fixed_spread;
        }

        return max($markedUpRate, 0); // Ensure rate doesn't go negative
    }

    /**
     * Get applicable FX policy for user.
     */
    protected function getApplicableFxPolicy($scopeType = null, $scopeId = null)
    {
        if (!$scopeType || !$scopeId) {
            return null;
        }

        // Try user-specific policy first
        $policy = null;

        if ($policy) {
            return $policy;
        }

        // Fall back to SUPER_ADMIN policy
        return null;
    }

    /**
     * Convert amount with markup.
     */
    public function convertAmountWithMarkup($amount, $fromCurrency, $toCurrency, $userScopeType = null, $userScopeId = null)
    {
        $rate = $this->getExchangeRateWithMarkup($fromCurrency, $toCurrency, $userScopeType, $userScopeId);

        if (!$rate) {
            return null;
        }

        return $amount * $rate;
    }

    /**
     * Refresh all currency rates from Alpha Vantage.
     */
    public function refreshAllRates()
    {
        $currencies = Currency::enabled()->where('type', 'fiat')->get();
        $updatedCount = 0;

        foreach ($currencies as $currency) {
            if ($currency->code === 'USD') {
                // USD is base currency
                $currency->updateExchangeRate(1.0);
                $updatedCount++;
                continue;
            }

            $rate = $this->getExchangeRate('USD', $currency->code);

            if ($rate) {
                $currency->updateExchangeRate($rate);
                $updatedCount++;
            }
        }

        return $updatedCount;
    }

    /**
     * Check if rate is stale.
     */
    public function isRateStale($fromCurrency, $toCurrency, $minutes = 5)
    {
        $cacheKey = "fx_rate_{$fromCurrency}_{$toCurrency}";
        $cachedAt = Cache::get("{$cacheKey}_timestamp");

        if (!$cachedAt) {
            return true;
        }

        return now()->diffInMinutes($cachedAt) > $minutes;
    }
}
