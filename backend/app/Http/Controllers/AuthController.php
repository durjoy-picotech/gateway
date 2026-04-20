<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Tymon\JWTAuth\Facades\JWTAuth;
use Tymon\JWTAuth\Exceptions\JWTException;
use PragmaRX\Google2FALaravel\Facade as Google2FA;
use Illuminate\Support\Facades\DB;
use App\Events\SendMail;
use Illuminate\Support\Facades\Log;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string',
            'remember_me' => 'boolean'
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

        $security_failed_login_Settings = DB::table('security_settings')
            ->where('key', 'failed_login_lockout')
            ->first();

        $maxAttempts = $security_failed_login_Settings ? (int)$security_failed_login_Settings->value : 5;

        $user = User::where('email', $request->email)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_CREDENTIALS',
                    'message' => 'Invalid credentials'
                ]
            ], 400);
        }

        // Check if user is locked out
        if ($user->status == 'INACTIVE') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'ACCOUNT_BAN',
                    'message' => 'Your account has been locked due to multiple failed login attempts.'
                ]
            ], 403);
        }

        try {
            $credentials = $request->only('email', 'password');
            if (!$token = JWTAuth::attempt($credentials)) {
                // Increment failed login attempts
                $user->increment('failed_logins');

                // Lock account if max attempts reached
                if ($user->failed_logins >= $maxAttempts) {
                    $user->update([
                        'status' => 'INACTIVE', // or configurable
                        'failed_logins' => 0, // reset counter after lockout
                    ]);
                }

                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'INVALID_CREDENTIALS',
                        'message' => 'Invalid credentials'
                    ]
                ], 400);
            }
        } catch (JWTException $e) {
            Log::info($e);
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'TOKEN_GENERATION_FAILED',
                    'message' => 'Could not create token'
                ]
            ], 500);
        }

        // Reset failed login count on successful login
        $user->update(['failed_logins' => 0]);

        // Handle 2FA
        if ($user->two_factor_enabled == 1) {
            if(!$request->otp){
                return response()->json([
                    'success' => true,
                    'data' => [
                        'two_factor_enabled' => true,
                        'email' => $request->email,
                        'password' => $request->password,
                    ]
                ]);
            }

            $valid = Google2FA::verifyKey($user->two_factor_secret, $request->otp);
            if (!$valid) {
                $codes = json_decode($user->two_factor_recovery_codes, true);
                if (in_array($request->otp, $codes)) {
                    $updatedCodes = array_values(array_diff($codes, [$request->otp]));
                    $user->update(['two_factor_recovery_codes' => json_encode($updatedCodes)]);
                } else {
                    return response()->json([
                        'success' => false,
                        'message' => 'Invalid OTP code'
                    ], 422);
                }
            }
        }

        $user = Auth::user();
        return response()->json([
            'success' => true,
            'data' => [
                'user' => [
                    'user_id' => $user->user_id,
                    'role' => $user->role,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'timezone' => $user->timezone,
                    'two_factor_enabled' => $user->two_factor_enabled,
                    'created_at' => $user->created_at->toISOString(),
                    'partner_id' => $user->partner_id,
                    'agent_id' => $user->agent_id,
                    'merchant_id' => $user->merchant_id,
                    'recovery_email' => $user->recovery_email,
                ],
                'token' => $token,
                'refresh_token' => JWTAuth::fromUser($user),
                'expires_in' => (int) config('jwt.ttl') * 60
            ]
        ]);
    }

    /**
     * Refresh JWT token using refresh token.
     */
    public function refresh(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'refresh_token' => 'required|string'
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

        try {
            $token = JWTAuth::refresh($request->refresh_token);
            return response()->json([
                'success' => true,
                'data' => [
                    'token' => $token,
                    'refresh_token' => JWTAuth::refresh($token),
                    'expires_in' => config('jwt.ttl') * 60
                ]
            ]);
        } catch (JWTException $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_REFRESH_TOKEN',
                    'message' => 'Invalid refresh token'
                ]
            ], 401);
        }
    }

    /**
     * Invalidate current session.
     */
    public function logout(Request $request)
    {
        try {
            JWTAuth::invalidate(JWTAuth::getToken());
            return response()->json([
                'success' => true,
                'message' => 'Logged out successfully'
            ]);
        } catch (JWTException $e) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'LOGOUT_FAILED',
                    'message' => 'Could not logout'
                ]
            ], 500);
        }
    }

    /**
     * Get current user profile information.
     */
    public function profile(Request $request)
    {
        $user = Auth::user();

        return response()->json([
            'success' => true,
            'data' => [
                'user_id' => $user->user_id,
                'role' => $user->role,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'timezone' => $user->timezone,
                'two_factor_enabled' => $user->two_factor_enabled,
                'created_at' => $user->created_at->toISOString(),
                'partner_id' => $user->partner_id,
                'agent_id' => $user->agent_id,
                'merchant_id' => $user->merchant_id
            ]
        ]);
    }

    /**
     * Update current user profile information.
     */
    public function updateProfile(Request $request)
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'name' => 'string|max:255',
            'email' => 'email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:20',
            'timezone' => 'string|max:50'
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
        $oldEmail = $user->email;
        $user->update($request->only(['name', 'email', 'phone', 'timezone']));
        $about = "";
        if ($request->email && $request->email !== $oldEmail) {
            $about = "Your email has been changed from {$oldEmail} to {$user->email}.";
            $emailTemplate = get_Templates('security');
            $notification = get_notifications('security_alerts');
            if ($emailTemplate && $notification === true) {
                $regTemp = str_replace('user_name', $user->name, $emailTemplate->body);
                $regTemp = str_replace('about', $about, $regTemp);
                SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
            }
        }
        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'data' => [
                'user_id' => $user->user_id,
                'role' => $user->role,
                'name' => $user->name,
                'email' => $user->email,
                'phone' => $user->phone,
                'timezone' => $user->timezone,
                'two_factor_enabled' => $user->two_factor_enabled,
                'created_at' => $user->created_at->toISOString(),
                'partner_id' => $user->partner_id,
                'agent_id' => $user->agent_id,
                'merchant_id' => $user->merchant_id
            ]
        ]);
    }

    /**
     * Change current user password.
     */
    public function changePassword(Request $request)
    {
        $user = Auth::user();

        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'new_password' => 'required|string|min:8'
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

        if (!Hash::check($request->current_password, $user->password)) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'INVALID_CURRENT_PASSWORD',
                    'message' => 'Current password is incorrect'
                ]
            ], 400);
        }

        $user->update([
            'password' => Hash::make($request->new_password)
        ]);
        $about = "Your account password has been changed successfully. If this wasn't you, please secure your account immediately.";
        $emailTemplate = get_Templates('security');
        $notification = get_notifications('security_alerts');
        if ($emailTemplate && $notification === true) {
            $regTemp = str_replace('user_name', $user->name, $emailTemplate->body);
            $regTemp = str_replace('about', $about, $regTemp);
            SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
        }
        return response()->json([
            'success' => true,
            'message' => 'Password changed successfully'
        ]);
    }

    /**
     * Delete current user account.
     */
    public function deleteAccount(Request $request)
    {
        $user = Auth::user();

        // Soft delete or hard delete based on requirements
        // For now, we'll do a soft delete
        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'Account deleted successfully'
        ]);
    }
}
