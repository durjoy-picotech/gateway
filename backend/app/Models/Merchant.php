<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Merchant extends Model
{
    protected $fillable = [
        'merchant_id',
        'agent_id',
        'name',
        'default_currency',
        'enabled_currencies',
        'settlement_terms',
        'status',
        'kyb_status',
        'kyb_review_notes',
        'api_secret',
        'enabled_providers',
        'adFee'
    ];

    protected $casts = [
        'enabled_currencies' => 'array',
        'enabled_providers' => 'array',
    ];

    /**
     * Get the agent that owns the merchant.
     */
    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'agent_id', 'agent_id');
    }

    /**
     * Get the user for the merchant.
     */
    public function user(): HasOne
    {
        return $this->hasOne(User::class, 'merchant_id', 'merchant_id');
    }

    /**
     * Get the transactions for the merchant.
     */
    public function transactions(): HasMany
    {
        return $this->hasMany(Transaction::class, 'merchant_id', 'merchant_id');
    }

    public function userProviderFee(): HasMany
    {
        return $this->hasMany(userProviderFee::class, 'merchant_id', 'merchant_id');
    }
}
