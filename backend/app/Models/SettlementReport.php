<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SettlementReport extends Model
{
    protected $fillable = [
        'report_id',
        'scope_type',
        'scope_id',
        'period_start',
        'period_end',
        'total_settlements',
        'total_amount',
        'currency',
        'avg_settlement_time_hours',
        'on_time_percentage',
        'delayed_settlements',
        'failed_settlements',
        'fx_margin_earned'
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'total_amount' => 'decimal:2',
        'avg_settlement_time_hours' => 'decimal:2',
        'on_time_percentage' => 'decimal:2',
        'fx_margin_earned' => 'decimal:2'
    ];

    /**
     * Scope for reports by scope.
     */
    public function scopeForScope($query, $scopeType, $scopeId = null)
    {
        return $query->where('scope_type', $scopeType)
                    ->when($scopeId, fn($q) => $q->where('scope_id', $scopeId));
    }

    /**
     * Scope for reports within a date range.
     */
    public function scopeInDateRange($query, $startDate, $endDate)
    {
        return $query->where('period_start', '>=', $startDate)
                    ->where('period_end', '<=', $endDate);
    }
}
