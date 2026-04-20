<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Currency extends Model
{
    protected $fillable = [
        'code',
        'name',
        'symbol',
        'type',
        'precision',
        'enabled',
        'exchange_rate',
        'last_updated'
    ];

    protected $casts = [
        'enabled' => 'boolean',
        'exchange_rate' => 'decimal:8',
        'last_updated' => 'datetime'
    ];

    /**
     * Scope for enabled currencies.
     */
    public function scopeEnabled($query)
    {
        return $query->where('enabled', true);
    }

    /**
     * Scope for fiat currencies.
     */
    public function scopeFiat($query)
    {
        return $query->where('type', 'fiat');
    }

    /**
     * Scope for crypto currencies.
     */
    public function scopeCrypto($query)
    {
        return $query->where('type', 'crypto');
    }

    /**
     * Get formatted currency symbol.
     */
    public function getFormattedSymbolAttribute()
    {
        return $this->symbol ?? $this->code;
    }

    /**
     * Check if currency rate is stale.
     */
    public function isRateStale($minutes = 60)
    {
        if (!$this->last_updated) {
            return true;
        }

        return $this->last_updated->addMinutes($minutes)->isPast();
    }

    /**
     * Update exchange rate.
     */
    public function updateExchangeRate($rate)
    {
        $this->update([
            'exchange_rate' => $rate,
            'last_updated' => now()
        ]);
    }

    /**
     * Convert amount to this currency.
     */
    public function convertAmount($amount, $fromCurrency, $finalExchangeRate = null)
    {
        if ($finalExchangeRate !== null) {
            return $amount * $finalExchangeRate;
        }

        if (!$this->exchange_rate || !$fromCurrency->exchange_rate) {
            return $amount; // Return original amount if rates not available
        }

        // Get base exchange rate (to_currency rate / from_currency rate)
        $baseRate = $this->exchange_rate / $fromCurrency->exchange_rate;

        // Apply markup based on currency pair
        $markupPercentage = 0;

        // Check if from_currency is USD (base currency)
        if ($fromCurrency->code === 'USD') {
            // Subtract markup when converting from USD
            $fxRate = CurrencyFxRate::where('from_currency', $fromCurrency->code)
                                   ->where('to_currency', $this->code)
                                   ->first();
            if ($fxRate) {
                $markupPercentage = -$fxRate->bps / 100; // Negative for subtraction
            }
        } elseif ($this->code === 'USD') {
            // Add markup when converting to USD
            $fxRate = CurrencyFxRate::where('from_currency', $fromCurrency->code)
                                   ->where('to_currency', $this->code)
                                   ->first();
            if ($fxRate) {
                $markupPercentage = $fxRate->bps / 100; // Positive for addition
            }
        }

        // Apply markup to exchange rate
        $finalRate = $baseRate * (1 + $markupPercentage);

        // Convert amount
        return $amount * $finalRate;
    }

    /**
     * Format amount with currency symbol.
     */
    public function formatAmount($amount)
    {
        $formatted = number_format($amount, $this->precision);
        return $this->symbol ? $this->symbol . $formatted : $formatted . ' ' . $this->code;
    }
}
