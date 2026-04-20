<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Models\Currency;

class Provider extends Model
{
    protected $fillable = [
        'provider_id',
        'partner_id',
        'name',
        'alias',
        'channel_name',
        'channel_route',
        'settlement',
        'supported_variants',
        'health_status',
        'status',
        'response_time',
        'success_rate',
        'fee_percentage',
        'fixed_amount',
        'currency_id',
        'type',
        'gateway',
        'gateway_info',
        'provider_wallet_id',
    ];

    protected $casts = [
        'supported_variants' => 'array',
        'response_time' => 'integer',
        'success_rate' => 'decimal:2',
        'fee_percentage' => 'decimal:2',
        'fixed_amount' => 'decimal:2'
    ];

    /**
     * Get the partner associated with the provider.
     */
    public function partner()
    {
        return $this->belongsTo(Partner::class, 'partner_id', 'partner_id');
    }

    /**
     * Get the currency associated with the provider.
     */
    public function currency()
    {
        return $this->belongsTo(Currency::class);
    }

    public function providerWallet()
    {
        return $this->belongsTo(ProviderWallet::class, 'provider_wallet_id', 'id');
    }

    public function userProviderFee()
    {
        return $this->hasMany(userProviderFee::class, 'provider_id', 'provider_id');
    }
}
