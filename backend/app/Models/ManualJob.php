<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ManualJob extends Model
{
    protected $fillable = [
        'job_id',
        'name',
        'type',
        'status',
        'progress',
        'started_at',
        'completed_at',
        'duration_seconds',
        'records_processed',
        'records_failed',
        'error_message',
        'logs',
        'scope_type',
        'scope_id',
        'config'
    ];

    protected $casts = [
        'config' => 'array',
        'logs' => 'array',
        'started_at' => 'datetime',
        'completed_at' => 'datetime',
        'progress' => 'decimal:2'
    ];

    /**
     * Scope for jobs by status.
     */
    public function scopeOfStatus($query, $status)
    {
        return $query->where('status', $status);
    }

    /**
     * Scope for jobs by type.
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope for specific scope.
     */
    public function scopeForScope($query, $scopeType, $scopeId = null)
    {
        return $query->where('scope_type', $scopeType)
                    ->when($scopeId, fn($q) => $q->where('scope_id', $scopeId));
    }

    /**
     * Update job progress.
     */
    public function updateProgress($progress, $recordsProcessed = null, $recordsFailed = null)
    {
        $updateData = ['progress' => $progress];

        if ($recordsProcessed !== null) {
            $updateData['records_processed'] = $recordsProcessed;
        }

        if ($recordsFailed !== null) {
            $updateData['records_failed'] = $recordsFailed;
        }

        $this->update($updateData);
    }

    /**
     * Mark job as started.
     */
    public function markAsStarted()
    {
        $this->update([
            'status' => 'RUNNING',
            'started_at' => now(),
            'progress' => 0
        ]);
    }

    /**
     * Mark job as completed.
     */
    public function markAsCompleted($recordsProcessed = 0, $recordsFailed = 0)
    {
        $this->update([
            'status' => 'COMPLETED',
            'completed_at' => now(),
            'progress' => 100,
            'records_processed' => $recordsProcessed,
            'records_failed' => $recordsFailed,
            'duration_seconds' => $this->started_at ? now()->diffInSeconds($this->started_at) : null
        ]);
    }

    /**
     * Mark job as failed.
     */
    public function markAsFailed($errorMessage = null)
    {
        $this->update([
            'status' => 'FAILED',
            'completed_at' => now(),
            'error_message' => $errorMessage,
            'duration_seconds' => $this->started_at ? now()->diffInSeconds($this->started_at) : null
        ]);
    }

    /**
     * Add log entry.
     */
    public function addLog($message, $level = 'info')
    {
        $logs = $this->logs ?? [];
        $logs[] = [
            'timestamp' => now()->toISOString(),
            'level' => $level,
            'message' => $message
        ];

        $this->update(['logs' => $logs]);
    }
}
