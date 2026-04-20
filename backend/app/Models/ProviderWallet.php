<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ProviderWallet extends Model
{
    protected $fillable = [
        'provider_id',
        'balance',
        'currency',
        'status',
    ];

    protected function casts(): array
    {
        return [
            'balance' => 'decimal:2',
            'held_balance' => 'decimal:2',
        ];
    }

    public function provider(): BelongsTo
    {
        return $this->belongsTo(Provider::class, 'provider_id', 'provider_id');
    }
}
