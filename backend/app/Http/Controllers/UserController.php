<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserSetting;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Events\SendMail;

class UserController extends Controller
{
    /**
     * List users with pagination and filtering.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'page' => 'integer|min:1',
            'limit' => 'integer|min:1|max:100',
            'role' => 'string|in:SUPER_ADMIN,PARTNER,AGENT,MERCHANT',
            'status' => 'string',
            'search' => 'string|nullable'
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

        $query = User::query();

        // Apply filters
        if ($request->has('role')) {
            $query->where('role', $request->role);
        }

        if ($request->has('search') && !empty($request->search)) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 20);

        $users = $query->paginate($limit, ['*'], 'page', $page);

        return response()->json([
            'success' => true,
            'data' => [
                'users' => $users->items(),
                'pagination' => [
                    'page' => $users->currentPage(),
                    'limit' => $users->perPage(),
                    'total' => $users->total(),
                    'pages' => $users->lastPage()
                ]
            ]
        ]);
    }

    /**
     * Create new user.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'role' => 'required|string|in:SUPER_ADMIN,PARTNER,AGENT,MERCHANT',
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'phone' => 'nullable|string|max:20',
            'timezone' => 'string|max:50',
            'password' => 'required|string|min:8',
            'partner_id' => 'nullable|string',
            'agent_id' => 'nullable|string',
            'adFee' => 'nullable|numeric|min:0|max:100'

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

        $user = User::create([
            'user_id' => Str::uuid(),
            'role' => $request->role,
            'name' => $request->name,
            'email' => $request->email,
            'phone' => $request->phone,
            'timezone' => $request->timezone ?? 'UTC',
            'password' => Hash::make($request->password),
            'two_factor_enabled' => false,
            'partner_id' => $request->partner_id,
            'agent_id' => $request->agent_id,
            'adFee' => $request->adFee,

        ]);

        // Send notification
        NotificationService::userCreated($user);

        return response()->json([
            'success' => true,
            'message' => 'User created successfully',
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
                'adFee' => $request->adFee,

            ]
        ], 201);
    }

    /**
     * Get user details by ID.
     */
    public function show($id)
    {
        $user = User::where('user_id', $id)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => 'User not found'
                ]
            ], 404);
        }

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
                'agent_id' => $user->agent_id
            ]
        ]);
    }

    /**
     * Update user information.
     */
    public function update(Request $request, $id)
    {
        $user = User::where('user_id', $id)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => 'User not found'
                ]
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'string|max:255',
            'email' => 'email|unique:users,email,' . $user->id,
            'phone' => 'nullable|string|max:20',
            'timezone' => 'string|max:50',
            'two_factor_enabled' => 'boolean',
            'adFee' => 'nullable|numeric|min:0|max:100'
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
        $user->update($request->only(['name', 'email', 'phone', 'timezone', 'two_factor_enabled', 'adFee']));
        $about = "";
        if ($request->email && $request->email !== $oldEmail) {
            $about = "Your email has been changed from {$oldEmail} to {$user->email}.";
        } else {
            $about = "Your account information has been updated.";
        }
        $emailTemplate = get_Templates('security');
        $notification = get_notifications('security_alerts');
        if ($emailTemplate && $notification === true) {
            $regTemp = str_replace('user_name', $user->name, $emailTemplate->body);
            $regTemp = str_replace('about', $about, $regTemp);
            SendMail::dispatch($user->email, $emailTemplate->subject, $regTemp);
        }

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully',
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
                'adFee' => $user->adFee,

            ]
        ]);
    }

    /**
     * Delete user account.
     */
    public function destroy($id)
    {
        $user = User::where('user_id', $id)->first();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'USER_NOT_FOUND',
                    'message' => 'User not found'
                ]
            ], 404);
        }

        $user->delete();

        return response()->json([
            'success' => true,
            'message' => 'User deleted successfully'
        ]);
    }

    /**
     * Get user settings.
     */
    public function getSettings(Request $request)
    {
        $user = $request->user();

        $settings = $user->settings ?? new UserSetting(['user_id' => $user->user_id, 'settings' => []]);

        return response()->json([
            'success' => true,
            'data' => [
                'settings' => $settings->settings ?? []
            ]
        ]);
    }

    public function appSettings(Request $request)
    {
        try {
            $settings = UserSetting::all();

            return response()->json([
                'success' => true,
                'data' => [
                    'settings' => $settings
                ]
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to load app settings', ['error' => $e->getMessage()]);
            return response()->json([
                'success' => false,
                'error' => [
                    'message' => 'Failed to fetch settings',
                    'details' => $e->getMessage(),
                ]
            ], 500);
        }
    }



    /**
     * Update user settings.
     */
    public function updateSettings(Request $request)
    {
        \Log::info('Update settings request', [
            'headers' => $request->headers->all(),
            'method' => $request->method(),
            'user' => $request->user()
        ]);

        $user = $request->user();

        if (!$user) {
            \Log::error('User not authenticated for settings update', [
                'token' => $request->bearerToken(),
                'headers' => $request->headers->all()
            ]);
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'User not authenticated'
                ]
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'settings' => 'required|array'
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

        $settings = UserSetting::updateOrCreate(
            ['user_id' => $user->user_id],
            ['settings' => $request->settings]
        );



        return response()->json([
            'success' => true,
            'message' => 'Settings updated successfully',
            'data' => [
                'settings' => $settings->settings
            ]
        ]);
    }

    /**
     * Update application settings with file uploads
     */
    public function updateAppSettings(Request $request)
    {
        \Log::info('Update app settings request', [
            'user' => $request->user(),
            'app_name' => $request->app_name,
            'has_app_logo' => $request->hasFile('app_logo'),
            'has_favicon' => $request->hasFile('favicon')
        ]);

        $user = $request->user();

        if (!$user) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'UNAUTHENTICATED',
                    'message' => 'User not authenticated'
                ]
            ], 401);
        }

        $validator = Validator::make($request->all(), [
            'app_name' => 'required|string|max:255',
            'app_logo' => 'nullable|image|mimes:jpeg,png,jpg,gif,svg|max:2048',
            'favicon' => 'nullable|image|mimes:ico,png|max:1024',
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
            // Get current settings
            $userSettings = UserSetting::where('user_id', $user->user_id)->first();
            $currentSettings = $userSettings ? $userSettings->settings : [];
            $currentAppSettings = $currentSettings['appSettings'] ?? [];

            // Handle app logo upload
            if ($request->hasFile('app_logo')) {
                $appLogo = $request->file('app_logo');

                // Delete old logo if exists
                if (!empty($currentAppSettings['app_logo']) && Storage::exists('public/' . $currentAppSettings['app_logo'])) {
                    Storage::delete('public/' . $currentAppSettings['app_logo']);
                }

                // Store new logo
                $logoPath = $appLogo->store('app-settings', 'public');
                $currentAppSettings['app_logo'] = $logoPath;
            }

            // Handle favicon upload
            if ($request->hasFile('favicon')) {
                $favicon = $request->file('favicon');

                // Delete old favicon if exists
                if (!empty($currentAppSettings['favicon']) && Storage::exists('public/' . $currentAppSettings['favicon'])) {
                    Storage::delete('public/' . $currentAppSettings['favicon']);
                }

                // Store new favicon
                $faviconPath = $favicon->store('app-settings', 'public');
                $currentAppSettings['favicon'] = $faviconPath;
            }

            // Update app name
            $currentAppSettings['app_name'] = $request->app_name;

            // Merge with existing settings
            $updatedSettings = array_merge($currentSettings, [
                'appSettings' => $currentAppSettings
            ]);

            // Save to database
            UserSetting::updateOrCreate(
                ['user_id' => $user->user_id],
                ['settings' => $updatedSettings]
            );

            return response()->json([
                'success' => true,
                'message' => 'Application settings updated successfully',
                'data' => $currentAppSettings
            ]);
        } catch (\Exception $e) {
            \Log::error('Failed to update app settings', [
                'user_id' => $user->user_id,
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'SERVER_ERROR',
                    'message' => 'Failed to update application settings: ' . $e->getMessage()
                ]
            ], 500);
        }
    }
}
