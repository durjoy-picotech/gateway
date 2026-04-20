<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Settlement extends Model
{
    protected $fillable = [
        'settlement_id',
        'partner_id',
        'agent_id',
        'merchant_id',
        'settlement_date',
        'cutoff_time',
        'total_amount',
        'currency',
        'status',
        'processed_at',
        'failure_reason',
        'transaction_count',
        'fee_amount',
        'net_amount',
        'transaction_ids',
        'details',
        'user_type',
        'request_id',
        'transaction_type',
        'settlement_type',
    ];

    protected $casts = [
        'settlement_date' => 'date',
        'cutoff_time' => 'datetime:H:i:s',
        'total_amount' => 'decimal:2',
        'fee_amount' => 'decimal:2',
        'net_amount' => 'decimal:2',
        'processed_at' => 'datetime',
        'transaction_ids' => 'array'
    ];

    /**
     * Get the partner that owns the settlement.
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class, 'partner_id', 'partner_id');
    }

    /**
     * Get the agent that owns the settlement.
     */
    public function agent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'agent_id', 'agent_id');
    }

    /**
     * Get the merchant that owns the settlement.
     */
    public function merchant(): BelongsTo
    {
        return $this->belongsTo(Merchant::class, 'merchant_id', 'merchant_id');
    }

    /**
     * Scope for completed settlements.
     */
    public function scopeCompleted($query)
    {
        return $query->where('status', 'COMPLETED');
    }

    /**
     * Scope for pending settlements.
     */
    public function scopePending($query)
    {
        return $query->where('status', 'PENDING');
    }

    /**
     * Scope for failed settlements.
     */
    public function scopeFailed($query)
    {
        return $query->where('status', 'FAILED');
    }
}
