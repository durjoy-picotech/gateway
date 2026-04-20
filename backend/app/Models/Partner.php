<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Partner extends Model
{
    protected $fillable = [
        'partner_id',
        'name',
        'domain_branding',
        'default_currency',
        'enabled_currencies',
        'enabled_providers',
        'settlement_policy',
        'reserve_policy',
        'kyc_policy',
        'can_create_own_bank',
        'status',
        'adFee'
    ];

    protected $casts = [
        'enabled_currencies' => 'array',
        'enabled_providers' => 'array',
        'settlement_policy' => 'array',
        'reserve_policy' => 'array',
        'kyc_policy' => 'boolean',
        'can_create_own_bank' => 'boolean'
    ];

    /**
     * Get the user for the partner.
     */
    public function user(): HasOne
    {
        return $this->hasOne(User::class, 'partner_id', 'partner_id');
    }

    /**
     * Get the agents for the partner.
     */
    public function agents(): HasMany
    {
        return $this->hasMany(Agent::class, 'partner_id', 'partner_id');
    }

    public function userProviderFee(): HasMany
    {
        return $this->hasMany(userProviderFee::class, 'partner_id', 'partner_id');
    }
}
