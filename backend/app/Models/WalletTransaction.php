<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class WalletTransaction extends Model
{
    protected $fillable = [
        'transaction_id',
        'user_id',
        'from_wallet_id',
        'to_wallet_id',
        'from_currency',
        'to_currency',
        'from_amount',
        'to_amount',
        'exchange_rate',
        'markup_rate',
        'fee',
        'status',
        'notes',
        'metadata',
        'processed_at'
    ];

    protected $casts = [
        'from_amount' => 'decimal:2',
        'to_amount' => 'decimal:2',
        'exchange_rate' => 'decimal:6',
        'markup_rate' => 'decimal:6',
        'fee' => 'decimal:2',
        'metadata' => 'array',
        'processed_at' => 'datetime'
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->transaction_id)) {
                $model->transaction_id = 'WXT_' . strtoupper(Str::random(12));
            }
        });
    }

    /**
     * Get the user that owns the transaction.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id', 'user_id');
    }

    /**
     * Get the from wallet.
     */
    public function fromWallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'from_wallet_id');
    }

    /**
     * Get the to wallet.
     */
    public function toWallet(): BelongsTo
    {
        return $this->belongsTo(Wallet::class, 'to_wallet_id');
    }

    /**
     * Scope for completed transactions.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'COMPLETED');
    }

    /**
     * Scope for pending transactions.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'PENDING');
    }

    /**
     * Scope for failed transactions.
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'FAILED');
    }

    /**
     * Mark transaction as completed.
     */
    public function markCompleted()
    {
        $this->update([
            'status' => 'COMPLETED',
            'processed_at' => now()
        ]);
    }

    /**
     * Mark transaction as failed.
     */
    public function markFailed($reason = null)
    {
        $metadata = $this->metadata ?? [];
        if ($reason) {
            $metadata['failure_reason'] = $reason;
        }

        $this->update([
            'status' => 'FAILED',
            'metadata' => $metadata,
            'processed_at' => now()
        ]);
    }
}
