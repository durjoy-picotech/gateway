<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TopUpRequest extends Model
{
    protected $fillable = [
        'user_id',
        'top_up_request_id',
        'amount',
        'total_amount',
        'total_amount',
        'currency',
        'partner_id',
        'agent_id',
        'merchant_id',
        'user_type',
        'payment_method',
        'wallet_id',
        'provider_id',
        'transaction_id',
        'payment_status',
        'status',
        'request_for'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
    public function provider()
    {
        return $this->belongsTo(Provider::class, 'provider_id', 'provider_id');
    }
}
