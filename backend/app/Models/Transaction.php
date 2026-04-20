<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Transaction extends Model
{
    protected $fillable = [
        'txn_id',
        'token_id',
        'reference_id',
        'merchant_id',
        'amount',
        'currency',
        'channel_type',
        'transaction_type',
        'customer_email',
        'status',
        'provider_alias',
        'fx_rate',
        'fee_breakdown',
        'estimated_cost',
        'routing_strategy',
        'routing_reason',
        'metadata',
        'recipient_details',
        'processed_at',
        'completed_at',
        'failure_reason',
        'channel_id',
        'agent_id',
        'partner_id',
        'fee_details',
        'wallet_balance',
        'total_fee',
        'provider_id',
        'superadmin_id',
        'top_up_request_id',
        'adjustment_type',
        'user_id',
        'for',
        'settlement',
        'fee_type',
        'fee_from',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'fx_rate' => 'decimal:6',
        'estimated_cost' => 'decimal:2',
        'fee_breakdown' => 'array',
        'metadata' => 'array',
        'recipient_details' => 'array',
        'processed_at' => 'datetime',
        'completed_at' => 'datetime'
    ];

    /**
     * Get the merchant that owns the transaction.
     */
    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_id', 'merchant_id');
    }

    /**
     * Scope for pay in transactions.
     */
    public function scopePayIns($query)
    {
        return $query->where('transaction_type', 'PAY_IN');
    }

    /**
     * Scope for pay out transactions.
     */
    public function scopePayOuts($query)
    {
        return $query->where('transaction_type', 'PAY_OUT');
    }

    /**
     * Scope for top up transactions.
     */
    public function scopeTopUps($query)
    {
        return $query->where('transaction_type', 'TOP_UP');
    }

    /**
     * Scope for settlement transactions.
     */
    public function scopeSettlements($query)
    {
        return $query->where('transaction_type', 'SETTLEMENT');
    }

    /**
     * Scope for adjustment transactions.
     */
    public function scopeAdjustments($query)
    {
        return $query->where('transaction_type', 'ADJUSTMENT');
    }

    /**
     * Scope for refund transactions.
     */
    public function scopeRefunds($query)
    {
        return $query->where('transaction_type', 'REFUND');
    }

    /**
     * Scope for successful transactions.
     */
    public function scopeSuccessful($query)
    {
        return $query->where('status', 'SUCCESS');
    }

    /**
     * Scope for pending transactions.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'PENDING');
    }

    public function channel(): BelongsTo
    {
        return $this->belongsTo(Channel::class, 'channel_id');
    }
    public function provider()
    {
        return $this->belongsTo(Provider::class, 'provider_id', 'provider_id');
    }
    public function partner()
    {
        return $this->belongsTo(Partner::class, 'partner_id', 'partner_id');
    }

    public function agent()
    {
        return $this->belongsTo(Agent::class, 'agent_id', 'agent_id');
    }
}
