<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use App\Models\User;
use App\Services\NotificationService;
use PragmaRX\Google2FALaravel\Facade as Google2FA;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use App\Events\SendMail;
class SecurityController extends Controller
{
    // Security Overview
    public function getSecurityOverview(Request $request)
    {
        $user = $request->user();

        // Calculate security score based on various factors
        $score = $this->calculateSecurityScore($user);

        // Get recent security events
        $recentEvents = DB::table('security_events')
            ->where('user_id', $user->user_id)
            ->orWhere('user_id', null) // Global events
            ->orderBy('created_at', 'desc')
            ->limit(10)
            ->get();

        return response()->json([
            'success' => true,
            'data' => [
                'security_score' => $score,
                'recent_events' => $recentEvents,
                'security_status' => $this->getSecurityStatus($score)
            ]
        ]);
    }

    // Security Events
    public function getSecurityEvents(Request $request)
    {
        $query = DB::table('security_events');

        if ($request->has('event_type')) {
            $query->where('event_type', $request->event_type);
        }

        if ($request->has('severity')) {
            $query->where('severity', $request->severity);
        }

        $events = $query->orderBy('created_at', 'desc')
            ->paginate($request->get('per_page', 20));

        return response()->json([
            'success' => true,
            'data' => $events
        ]);
    }

    // 2FA Management
    public function generate2FA(Request $request)
    {
        $user = $request->user();

        $secret = Google2FA::generateSecretKey();

        $user->update([
            'two_factor_secret' => $secret,
        ]);

        $qrCodeUrl = Google2FA::getQRCodeUrl(
            config('app.name'),
            $user->email,
            $secret
        );

        return response()->json([
            'success' => true,
            'data' => [
                'secret' => $secret,
                'qr_code_url' => $qrCodeUrl,
            ]
        ]);
    }
    public function enable2FA(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'otp' => 'required|string',
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

        try{

            $user = $request->user();

            $valid = Google2FA::verifyKey($user->two_factor_secret, $request->otp);
            if (!$valid) {
                return response()->json([
                    'success' => false,
                    'message' => 'Invalid OTP code'
                ], 422);
            }

            $user->update([
                'two_factor_enabled' => true
            ]);

            $about = "Two-factor authentication has been enabled on your account.";
            $emailTemplate = get_Templates('security');
            $notification = get_notifications('security_alerts');
            if ($emailTemplate && $notification === true) {
                $regTemp = str_replace('user_name', $user->name, $emailTemplate->body);
                $regTemp = str_replace('about', $about, $regTemp);
                SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
            }
            // Log and notify
            $this->logSecurityEvent('2fa_enabled', 'info', 'Two-factor authentication enabled', $user->user_id);
            NotificationService::securityAlert('2fa_enabled', 'Two-factor authentication has been enabled for your account.', ['user_id' => $user->user_id]);

            return response()->json([
                'success' => true,
                'message' => 'Two-factor authentication enabled successfully'
            ]);
        }catch(\Exception $e){
            return response()->json([
                'success' => false,
                'message' => 'An error occurred while authentication',
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    public function disable2FA(Request $request)
    {
        $user = $request->user();

        $user->update([
            'two_factor_enabled' => false
        ]);
        $about = "Two-factor authentication has been disable on your account.";
        $emailTemplate = get_Templates('security');
        $notification = get_notifications('security_alerts');
        if ($emailTemplate && $notification === true) {
            $regTemp = str_replace('user_name', $user->name, $emailTemplate->body);
            $regTemp = str_replace('about', $about, $regTemp);
            SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
        }
        // Log the event
        $this->logSecurityEvent('2fa_disabled', 'warning', 'Two-factor authentication disabled', $user->user_id);

        // Send notification
        NotificationService::securityAlert('2fa_disabled', 'Two-factor authentication has been disabled for your account.', ['user_id' => $user->user_id], 'HIGH');

        return response()->json([
            'success' => true,
            'message' => 'Two-factor authentication disabled successfully'
        ]);
    }
    public function recoveryCodes(Request $request)
    {
        $user = $request->user();

        // Check if the user already has recovery codes
        if (!empty($user->two_factor_recovery_codes)) {
            $existingCodes = json_decode($user->two_factor_recovery_codes, true);
            return response()->json([
                'success' => true,
                'data' => [
                    'recovery_codes' => $existingCodes,
                    'message' => 'Recovery codes already generated.'
                ]
            ]);
        }

        // Generate 5 random numeric-only 16-digit codes
        $generateCode = collect(range(1, 5))->map(function () {
            return str_pad(random_int(0, 9999999999999999), 16, '0', STR_PAD_LEFT);
        })->toArray();

        // Store as JSON
        $user->update([
            'two_factor_recovery_codes' => json_encode($generateCode),
        ]);

        return response()->json([
            'success' => true,
            'data' => [
                'recovery_codes' => $generateCode,
            ]
        ]);
    }

    // Security Settings
    public function getSecuritySettings(Request $request)
    {
        $settings = DB::table('security_settings')
            ->where('is_system', false)
            ->orWhere('is_system', true)
            ->get()
            ->keyBy('key');

        return response()->json([
            'success' => true,
            'data' => $settings
        ]);
    }

    public function updateSecuritySetting(Request $request, $key)
    {
        $request->validate([
            'value' => 'required'
        ]);

        $setting = DB::table('security_settings')
            ->where('key', $key)
            ->where('is_system', false)
            ->first();

        $action = $setting ? 'update' : 'create';

        DB::table('security_settings')->updateOrInsert(
            [
                'key' => $key,
                'is_system' => false
            ],
            [
                'value' => $request->value,
                'updated_at' => now(),
                'created_at' => $setting ? $setting->created_at : now()
            ]
        );

        $this->logAuditEvent(
            $action,
            'security_setting',
            $key,
            $setting ? null : [],
            ['value' => $request->value],
            $request->user()->user_id
        );
        if ($key === 'session_timeout') {
            $ttl = (int) preg_replace('/\D/', '', $request->value);
            $this->updateEnvVariable('JWT_TTL', $ttl);
        }
        NotificationService::systemAlert(
            'security_setting_updated',
            "Security setting '{$key}' has been {$action}d.",
            ['setting_key' => $key, 'new_value' => $request->value]
        );

        return response()->json([
            'success' => true,
            'data' => ['action' => $action],
            'message' => "Security setting {$action}d successfully"
        ]);
    }
    private function updateEnvVariable($key, $value)
    {
        $envFile = base_path('.env');
        $content = file_get_contents($envFile);

        if (strpos($content, "$key=") !== false) {
            $content = preg_replace("/^$key=.*/m", "$key=$value", $content);
        } else {
            $content .= "\n$key=$value";
        }

        file_put_contents($envFile, $content);

        // Refresh config cache
        \Artisan::call('config:clear');
        \Artisan::call('config:cache');
    }

    // Helper methods
    private function calculateSecurityScore(User $user)
    {
        $score = 0;
        $maxScore = 100;

        // 2FA enabled (20 points)
        if ($user->two_factor_enabled) {
            $score += 20;
        }

        // Password strength (20 points) - simplified check
        if (strlen($user->password) >= 8) {
            $score += 20;
        }

        // Account age (10 points) - newer accounts get fewer points
        $accountAge = $user->created_at->diffInDays(now());
        if ($accountAge > 30) {
            $score += 10;
        }

        // Recent login activity (20 points)
        $recentLogins = DB::table('security_events')
            ->where('user_id', $user->user_id)
            ->where('event_type', 'login')
            ->where('created_at', '>=', now()->subDays(30))
            ->count();

        if ($recentLogins > 0) {
            $score += 20;
        }

        // Security settings configured (30 points)
        $securitySettings = DB::table('security_settings')
            ->whereIn('key', ['enforce_2fa', 'session_timeout', 'audit_log_retention'])
            ->where('value', '!=', 'false')
            ->where('value', '!=', '')
            ->count();

        $score += ($securitySettings / 3) * 30;

        return min($score, $maxScore);
    }

    private function getSecurityStatus($score)
    {
        if ($score >= 80) return 'excellent';
        if ($score >= 60) return 'good';
        if ($score >= 40) return 'fair';
        return 'poor';
    }

    private function logSecurityEvent($eventType, $severity, $description, $userId = null, $metadata = null)
    {
        DB::table('security_events')->insert([
            'event_type' => $eventType,
            'severity' => $severity,
            'description' => $description,
            'user_id' => $userId,
            'ip_address' => request()->ip(),
            'metadata' => json_encode($metadata),
            'created_at' => now(),
            'updated_at' => now()
        ]);
    }

    private function logAuditEvent($action, $resourceType, $resourceId, $oldValues = null, $newValues = null, $userId = null)
    {
        DB::table('audit_logs')->insert([
            'action' => $action,
            'resource_type' => $resourceType,
            'resource_id' => $resourceId,
            'user_id' => $userId,
            'ip_address' => request()->ip(),
            'description' => ucfirst($action) . ' ' . $resourceType . ' ' . $resourceId,
            'old_values' => json_encode($oldValues),
            'new_values' => json_encode($newValues),
            'created_at' => now(),
            'updated_at' => now()
        ]);
    }

    public function updateRecoveryEmail(Request $request, $key)
    {
        $request->validate([
            'value' => 'required|email|unique:users,recovery_email'
        ]);

        $user = $request->user();

        $user->update([
            'recovery_email' => $request->value,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Security setting created or updated successfully'
        ]);
    }
}
