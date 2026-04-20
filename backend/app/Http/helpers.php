<?php
use App\Models\Setting;
use App\Models\User;
use App\Models\UserSetting;
use App\Models\EmailTemplate;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;

if (!function_exists('rd')) {
    /**
     * Return debug data as JSON and stop execution (dd for API)
     *
     * @param mixed $data
     * @param int $status
     * @return \Illuminate\Http\JsonResponse
     */
    function rd($data)
    {
        return response()->json([
            'success' => 'true',
            'data' => $data,
        ], 200);
    }
}
if (!function_exists('get_settings')) {
    /**
     * Retrieve a specific setting value by name (with caching)
     *
     * @param string $name
     * @return mixed
     */
    function get_settings($name)
    {
        // Return from cache if exists
        $value = cache('settings');
        $user = User::first();
        if (!$value) {
            if (Schema::hasTable('settings')) {
                $settings = Setting::where('admin_id', $user->user_id)->get();
                $sortSettings = [];
                foreach ($settings as $setting) {
                    $sortSettings[$setting->name] = $setting->value;
                }
                cache()->remember('settings', 10800, function () use ($sortSettings) {
                    return $sortSettings;
                });
            }
        } else {
            $sortSettings = $value;
        }

        return isset($sortSettings[$name]) ? $sortSettings[$name] : '';
    }
    function get_Templates($type)
    {
        $user = User::first();
        $temp = EmailTemplate::where('type', $type)->where('admin_id', $user->user_id)->first();
        return $temp;
    }
    function get_notifications($type)
    {
        $user = User::first();

        $userSetting = UserSetting::where('user_id', $user->user_id)->first();

        $notifications = $userSetting->settings['notifications'] ?? [];

        return (bool)($notifications[$type] ?? false);
    }


}
