<?php

namespace App\Http\Controllers;

use App\Models\Notification;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class NotificationController extends Controller
{
    /**
     * List user notifications.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'page' => 'integer|min:1',
            'limit' => 'integer|min:1|max:100',
            'read' => 'boolean',
            'type' => 'string'
        ]);

        if ($validator->fails()) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'VALIDATION_ERROR',
                    'message' => 'Invalid input data',
                    'details' => $validator->errors()
                ]
            ], 400);
        }

        $user = Auth::user();
        $query = Notification::where('user_id', $user->user_id)->active();

        if ($request->has('read')) {
            $query->where('read', $request->boolean('read'));
        }

        if ($request->has('type')) {
            $query->where('type', $request->type);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 20);

        $notifications = $query->orderBy('created_at', 'desc')
                               ->paginate($limit, ['*'], 'page', $page);

        $notifications->getCollection()->transform(function ($notification) {
            return [
                'notification_id' => $notification->notification_id,
                'type' => $notification->type,
                'title' => $notification->title,
                'message' => $notification->message,
                'data' => $notification->data,
                'read' => $notification->read,
                'read_at' => $notification->read_at?->toISOString(),
                'created_at' => $notification->created_at->toISOString(),
                'priority' => $notification->priority,
                'expires_at' => $notification->expires_at?->toISOString()
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'notifications' => $notifications->items(),
                'pagination' => [
                    'page' => $notifications->currentPage(),
                    'limit' => $notifications->perPage(),
                    'total' => $notifications->total(),
                    'pages' => $notifications->lastPage()
                ]
            ]
        ]);
    }

    /**
     * Mark notification as read.
     */
    public function markAsRead($id)
    {
        $user = Auth::user();
        $notification = Notification::where('notification_id', $id)
                                   ->where('user_id', $user->user_id)
                                   ->first();

        if (!$notification) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'NOTIFICATION_NOT_FOUND',
                    'message' => 'Notification not found'
                ]
            ], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'success' => true,
        ]);
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request)
    {
        $user = Auth::user();

        $updated = Notification::where('user_id', $user->user_id)
                              ->where('read', false)
                              ->update([
                                  'read' => true,
                                  'read_at' => now()
                              ]);

        return response()->json([
            'success' => true,
            'message' => "{$updated} notifications marked as read"
        ]);
    }

    /**
     * Delete notification.
     */
    public function destroy($id)
    {
        $user = Auth::user();
        $notification = Notification::where('notification_id', $id)
                                   ->where('user_id', $user->user_id)
                                   ->first();

        if (!$notification) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'NOTIFICATION_NOT_FOUND',
                    'message' => 'Notification not found'
                ]
            ], 404);
        }

        $notification->delete();

        return response()->json([
            'success' => true,
            'message' => 'Notification deleted successfully'
        ]);
    }

    /**
     * Send notification via specified channels (placeholder for actual implementation).
     */
    public static function sendNotification(Notification $notification)
    {
        // Mark as sent
        $notification->markAsSent();

        // Here you would implement actual sending logic for each channel
        // EMAIL, SMS, WEBHOOK, IN_APP

        foreach ($notification->channels as $channel) {
            switch ($channel) {
                case 'IN_APP':
                    // In-app notification is already created
                    break;
            }
        }

        $notification->markAsDelivered();
    }
}
