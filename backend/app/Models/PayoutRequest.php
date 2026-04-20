<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayoutRequest extends Model
{
    protected $fillable = [
        'user_id',
        'provider_id',
        'amount',
        'currency',
        'gateway',
        'comment',
        'others',
        'status',
        'fee_amount'
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }
    public function provider()
    {
        return $this->belongsTo(Provider::class, 'provider_id', 'provider_id')->withDefault();
    }
}
