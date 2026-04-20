<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CurrencyFxRate extends Model
{
    protected $fillable = [
        'from_currency',
        'to_currency',
        'bps'
    ];

    protected $casts = [
        'bps' => 'decimal:2'
    ];
}
