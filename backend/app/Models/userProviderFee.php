<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class userProviderFee extends Model
{
    protected $fillable = [
        'user_provider_fees_id',
        'partner_id',
        'agent_id',
        'merchant_id',
        'provider_id',
        'user_type',
        'fee_percentage',
        'fixed_amount',
        'add_fee_percentage',
        'add_fixed_amount',
        'new_fee_percentage',
        'new_fixed_amount',
    ];
}
