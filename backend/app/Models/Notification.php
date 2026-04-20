<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'notification_id',
        'user_id',
        'type',
        'title',
        'message',
        'data',
        'read',
        'read_at',
        'sent_at',
        'delivery_status',
        'delivery_attempts',
        'channels',
        'priority',
        'expires_at'
    ];

    protected $casts = [
        'data' => 'array',
        'read' => 'boolean',
        'read_at' => 'datetime',
        'sent_at' => 'datetime',
        'channels' => 'array',
        'expires_at' => 'datetime'
    ];

    /**
     * Scope for unread notifications.
     */
    public function scopeUnread($query)
    {
        return $query->where('read', false);
    }

    /**
     * Scope for read notifications.
     */
    public function scopeRead($query)
    {
        return $query->where('read', true);
    }

    /**
     * Scope for notifications by type.
     */
    public function scopeOfType($query, $type)
    {
        return $query->where('type', $type);
    }

    /**
     * Scope for notifications by priority.
     */
    public function scopeByPriority($query, $priority)
    {
        return $query->where('priority', $priority);
    }

    /**
     * Scope for notifications by delivery status.
     */
    public function scopeByDeliveryStatus($query, $status)
    {
        return $query->where('delivery_status', $status);
    }

    /**
     * Scope for expired notifications.
     */
    public function scopeExpired($query)
    {
        return $query->where('expires_at', '<', now());
    }

    /**
     * Scope for active (non-expired) notifications.
     */
    public function scopeActive($query)
    {
        return $query->where(function ($q) {
            $q->whereNull('expires_at')
              ->orWhere('expires_at', '>', now());
        });
    }

    /**
     * Mark notification as read.
     */
    public function markAsRead()
    {
        if (!$this->read) {
            $this->update([
                'read' => true,
                'read_at' => now()
            ]);
        }
    }

    /**
     * Mark notification as sent.
     */
    public function markAsSent()
    {
        $this->update([
            'sent_at' => now(),
            'delivery_status' => 'SENT'
        ]);
    }

    /**
     * Mark notification as delivered.
     */
    public function markAsDelivered()
    {
        $this->update([
            'delivery_status' => 'DELIVERED'
        ]);
    }

    /**
     * Mark notification as failed.
     */
    public function markAsFailed()
    {
        $this->update([
            'delivery_status' => 'FAILED',
            'delivery_attempts' => $this->delivery_attempts + 1
        ]);
    }

    /**
     * Check if notification is expired.
     */
    public function isExpired()
    {
        return $this->expires_at && $this->expires_at->isPast();
    }
}
