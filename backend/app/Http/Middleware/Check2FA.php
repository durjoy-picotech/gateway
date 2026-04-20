<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Support\Facades\Log;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Tymon\JWTAuth\Facades\JWTAuth;

class Check2FA
{
    /**
     * Handle an incoming request.
     */
    public function handle(Request $request, Closure $next): mixed
    {
        $user = $request->user();
        Log::info(session()->all());
        $securitySettings = DB::table('security_settings')
            ->where('key', 'enforce_2fa')
            ->first();
        // Example: check if 2FA is enabled
        if ($user && $user->two_factor_enabled == 0 && $securitySettings && $securitySettings->value=='true') {
            return response()->json([
                'success' => false,
                'data' => [
                    $securitySettings->key => $securitySettings->value,
                ],
                'message' => 'Two-factor authentication is not enabled for your account.',
            ], 403);
        }

        return $next($request);
    }
}
