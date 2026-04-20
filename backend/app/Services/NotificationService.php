<?php

namespace App\Services;

use App\Models\Notification;
use App\Models\User;
use Illuminate\Support\Facades\Log;

class NotificationService
{
    /**
     * Send notification to a specific user.
     */
    public static function sendToUser($userId, $type, $title, $message, $data = null, $channels = ['IN_APP'], $priority = 'NORMAL', $expiresAt = null)
    {
        try {
            $notification = Notification::create([
                'notification_id' => 'NOTIF_' . strtoupper(uniqid()),
                'user_id' => $userId,
                'type' => $type,
                'title' => $title,
                'message' => $message,
                'data' => $data,
                'channels' => $channels,
                'priority' => $priority,
                'expires_at' => $expiresAt
            ]);

            // Trigger sending via channels
            \App\Http\Controllers\NotificationController::sendNotification($notification);

            Log::info("Notification sent to user {$userId}: {$type} - {$title}");

            return $notification;
        } catch (\Exception $e) {
            Log::error("Failed to send notification to user {$userId}: " . $e->getMessage());
            return null;
        }
    }

    /**
     * Send notification to multiple users.
     */
    public static function sendToUsers(array $userIds, $type, $title, $message, $data = null, $channels = ['IN_APP'], $priority = 'NORMAL', $expiresAt = null)
    {
        $notifications = [];
        foreach ($userIds as $userId) {
            $notification = self::sendToUser($userId, $type, $title, $message, $data, $channels, $priority, $expiresAt);
            if ($notification) {
                $notifications[] = $notification;
            }
        }
        return $notifications;
    }

    /**
     * Send notification to users by role.
     */
    public static function sendToRole($role, $type, $title, $message, $data = null, $channels = ['IN_APP'], $priority = 'NORMAL', $expiresAt = null)
    {
        $users = User::where('role', $role)->get();
        $userIds = $users->pluck('user_id')->toArray();
        return self::sendToUsers($userIds, $type, $title, $message, $data, $channels, $priority, $expiresAt);
    }

    /**
     * Send notification to partner users only (not agents).
     */
    public static function sendToPartner($partnerId, $type, $title, $message, $data = null, $channels = ['IN_APP'], $priority = 'NORMAL', $expiresAt = null)
    {
        $users = User::where('partner_id', $partnerId)->where('role', 'PARTNER')->get();
        $userIds = $users->pluck('user_id')->toArray();
        return self::sendToUsers($userIds, $type, $title, $message, $data, $channels, $priority, $expiresAt);
    }

    /**
     * Send notification to agent users only (not merchants).
     */
    public static function sendToAgent($agentId, $type, $title, $message, $data = null, $channels = ['IN_APP'], $priority = 'NORMAL', $expiresAt = null)
    {
        $users = User::where('agent_id', $agentId)->where('role', 'AGENT')->get();
        $userIds = $users->pluck('user_id')->toArray();
        return self::sendToUsers($userIds, $type, $title, $message, $data, $channels, $priority, $expiresAt);
    }

    /**
     * Send notification to merchant users only (not other merchants under same agent).
     */
    public static function sendToMerchant($merchantId, $type, $title, $message, $data = null, $channels = ['IN_APP'], $priority = 'NORMAL', $expiresAt = null)
    {
        $users = User::where('merchant_id', $merchantId)->where('role', 'MERCHANT')->get();
        $userIds = $users->pluck('user_id')->toArray();
        return self::sendToUsers($userIds, $type, $title, $message, $data, $channels, $priority, $expiresAt);
    }

    // ===== SPECIFIC NOTIFICATION TYPES =====

    /**
     * Notify about agent creation.
     */
    public static function agentCreated($agent, $createdBy = null)
    {
        $title = 'New Agent Created';
        $message = "Agent '{$agent->name}' has been successfully created.";
        $data = [
            'agent_id' => $agent->agent_id,
            'agent_name' => $agent->name,
            'partner_id' => $agent->partner_id
        ];

        // Notify only the partner user who owns this agent, not other agents
        self::sendToPartner($agent->partner_id, 'AGENT_CREATED', $title, $message, $data);

        // Notify super admins
        self::sendToRole('SUPER_ADMIN', 'AGENT_CREATED', $title, $message, $data);
    }

    /**
     * Notify about agent status update.
     */
    public static function agentStatusUpdated($agent, $oldStatus, $newStatus)
    {
        $title = 'Agent Status Updated';
        $message = "Agent '{$agent->name}' status changed from {$oldStatus} to {$newStatus}.";
        $data = [
            'agent_id' => $agent->agent_id,
            'agent_name' => $agent->name,
            'old_status' => $oldStatus,
            'new_status' => $newStatus
        ];

        // Notify only the partner user who owns this agent, not other agents
        self::sendToPartner($agent->partner_id, 'AGENT_STATUS_UPDATED', $title, $message, $data);
        self::sendToRole('SUPER_ADMIN', 'AGENT_STATUS_UPDATED', $title, $message, $data);
    }

    /**
     * Notify about merchant creation.
     */
    public static function merchantCreated($merchant, $createdBy = null)
    {
        $title = 'New Merchant Onboarded';
        $message = "Merchant '{$merchant->name}' has been successfully onboarded.";
        $data = [
            'merchant_id' => $merchant->merchant_id,
            'merchant_name' => $merchant->name,
            'agent_id' => $merchant->agent_id
        ];

        // Notify only the agent user who owns this merchant, not other agents
        self::sendToAgent($merchant->agent_id, 'MERCHANT_CREATED', $title, $message, $data);
        self::sendToRole('SUPER_ADMIN', 'MERCHANT_CREATED', $title, $message, $data);
    }

    /**
     * Notify about merchant KYB status update.
     */
    public static function merchantKYBUpdated($merchant, $oldStatus, $newStatus)
    {
        $title = 'Merchant KYB Status Updated';
        $message = "Merchant '{$merchant->name}' KYB status changed from {$oldStatus} to {$newStatus}.";
        $data = [
            'merchant_id' => $merchant->merchant_id,
            'merchant_name' => $merchant->name,
            'old_kyb_status' => $oldStatus,
            'new_kyb_status' => $newStatus
        ];

        // Notify only the agent user who owns this merchant, not other agents
        self::sendToAgent($merchant->agent_id, 'MERCHANT_KYB_UPDATED', $title, $message, $data);
        self::sendToRole('SUPER_ADMIN', 'MERCHANT_KYB_UPDATED', $title, $message, $data);
    }

    /**
     * Notify about transaction status update.
     */
    public static function transactionStatusUpdated($transaction, $oldStatus, $newStatus)
    {
        $title = 'Transaction Status Updated';
        $message = "Transaction {$transaction->txn_id} status changed from {$oldStatus} to {$newStatus}.";
        $data = [
            'txn_id' => $transaction->txn_id,
            'amount' => $transaction->amount,
            'currency' => $transaction->currency,
            'old_status' => $oldStatus,
            'new_status' => $newStatus
        ];

        // Send to the specific user who owns the transaction, not all merchant users
        if ($transaction->user_id) {
            self::sendToUser($transaction->user_id, 'TRANSACTION_STATUS_UPDATED', $title, $message, $data);
        }
    }

    /**
     * Notify about settlement completion.
     */
    public static function settlementCompleted($settlement)
    {
        $title = 'Settlement Completed';
        $message = "Settlement for merchant '{$settlement->merchant->name}' has been completed. Amount: {$settlement->net_amount} {$settlement->currency}";
        $data = [
            'settlement_id' => $settlement->settlement_id,
            'merchant_id' => $settlement->merchant_id,
            'merchant_name' => $settlement->merchant->name,
            'amount' => $settlement->net_amount,
            'currency' => $settlement->currency
        ];

        self::sendToMerchant($settlement->merchant_id, 'SETTLEMENT_COMPLETED', $title, $message, $data);
        self::sendToAgent($settlement->merchant->agent_id, 'SETTLEMENT_COMPLETED', $title, $message, $data);
    }

    /**
     * Notify about settlement failure.
     */
    public static function settlementFailed($settlement, $reason = null)
    {
        $title = 'Settlement Failed';
        $message = "Settlement for merchant '{$settlement->merchant->name}' has failed.";
        if ($reason) {
            $message .= " Reason: {$reason}";
        }
        $data = [
            'settlement_id' => $settlement->settlement_id,
            'merchant_id' => $settlement->merchant_id,
            'merchant_name' => $settlement->merchant->name,
            'failure_reason' => $reason
        ];

        self::sendToMerchant($settlement->merchant_id, 'SETTLEMENT_FAILED', $title, $message, $data, ['IN_APP'], 'HIGH');
        self::sendToAgent($settlement->merchant->agent_id, 'SETTLEMENT_FAILED', $title, $message, $data, ['IN_APP'], 'HIGH');
        self::sendToRole('SUPER_ADMIN', 'SETTLEMENT_FAILED', $title, $message, $data, ['IN_APP'], 'HIGH');
    }

    /**
     * Notify about partner creation.
     */
    public static function partnerCreated($partner)
    {
        $title = 'New Partner Onboarded';
        $message = "Partner '{$partner->name}' has been successfully onboarded.";
        $data = [
            'partner_id' => $partner->partner_id,
            'partner_name' => $partner->name
        ];

        self::sendToRole('SUPER_ADMIN', 'PARTNER_CREATED', $title, $message, $data);
    }

    /**
     * Notify about user creation.
     */
    public static function userCreated($user)
    {
        $title = 'New User Created';
        $message = "User '{$user->name}' ({$user->role}) has been created.";
        $data = [
            'user_id' => $user->user_id,
            'user_name' => $user->name,
            'user_role' => $user->role
        ];

        // Notify based on role hierarchy
        switch ($user->role) {
            case 'PARTNER':
                self::sendToRole('SUPER_ADMIN', 'USER_CREATED', $title, $message, $data);
                break;
            case 'AGENT':
                self::sendToPartner($user->partner_id, 'USER_CREATED', $title, $message, $data);
                break;
            case 'MERCHANT':
                self::sendToAgent($user->agent_id, 'USER_CREATED', $title, $message, $data);
                break;
        }
    }

    /**
     * Notify about security events.
     */
    public static function securityAlert($type, $message, $data = null, $priority = 'HIGH')
    {
        $title = 'Security Alert';
        $data = array_merge($data ?? [], ['alert_type' => $type]);

        self::sendToRole('SUPER_ADMIN', 'SECURITY_ALERT', $title, $message, $data, ['IN_APP', 'EMAIL'], $priority);
    }

    /**
     * Notify about system alerts.
     */
    public static function systemAlert($type, $message, $data = null, $priority = 'NORMAL')
    {
        $title = 'System Alert';
        $data = array_merge($data ?? [], ['alert_type' => $type]);

        self::sendToRole('SUPER_ADMIN', 'SYSTEM_ALERT', $title, $message, $data, ['IN_APP'], $priority);
    }
}