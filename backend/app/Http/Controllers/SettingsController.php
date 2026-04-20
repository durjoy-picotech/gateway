<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\User;
use App\Models\Setting;
use App\Models\EmailTemplate;
use App\Events\SendMail;

class SettingsController extends Controller
{
    public function settings()
    {
        $user = User::first();
        $settings = Setting::where('admin_id', $user->user_id)->get();
        $emailTemplates = EmailTemplate::where('admin_id', $user->user_id)->get();
        return response()->json([
            'success' => true,
            'data' => [
                'settings' => $settings,
                'emailTemplates' => $emailTemplates,
            ]
        ]);
    }
    public function updateSMTP(Request $request)
    {
        $request->validate([
            'mail_name' => 'required',
            'mail_from' => 'required|email',
            'mail_host' => 'required',
            'mail_port' => 'required|numeric',
            'mail_username' => 'required',
            'mail_password' => 'required',
            'mail_encryption' => 'required',
            'fee' => 'required|numeric',
        ]);

        $user = User::first();
        unset($request['_token']);


        $host = $request->mail_host;
        $port = $request->mail_port;
        $username = $request->mail_username;
        $password = $request->mail_password;
        $config = array(
            'driver' => 'smtp',
            'host' => $host,
            'port' => $port,
            'from' => array('address' => $request->mail_from, 'name' => $request->mail_name),
            'encryption' => $request->mail_encryption,
            'username' => $username,
            'password' => $password,
        );

        foreach ($request->all() as $key => $req) {
            $data = ['name' => $key];
            $setting = Setting::firstOrNew($data);
            $setting->admin_id = $user->user_id;
            $setting->value = $request->$key;
            $setting->save();
        }

        cache()->flush();
        return response()->json([
            'success' => true,
            'data' => ['user' => $user],
            'message' => "Setting updated successfully"
        ]);
    }

    public function updateTemplate(Request $request)
    {
        $request->validate([
            'type' => 'required',
            'subject' => 'required',
            'body' => 'required',
        ]);

        $user = User::first();
        $data = ['type' => $request->type];
        $emailTemplate = EmailTemplate::firstOrNew($data);
        $emailTemplate->admin_id = $user->user_id;
        $emailTemplate->type = $request->type;
        $emailTemplate->subject = $request->subject;
        $emailTemplate->body = $request->body;
        $emailTemplate->save();

        return response()->json([
            'success' => true,
            'data' => ['user' => $user],
            'message' => "Template updated successfully"
        ]);
    }

    public function updateProfile(Request $request)
    {
        $request->validate([
            'name' => 'required|string',
            'email' => 'required|email',
            'phone' => 'nullable|string',
            'fee' => 'nullable|numeric', // user চাইলে দিবে
            'timezone' => 'required|string'
        ]);

        $user = auth()->user();

        $user->name = $request->name;
        $user->email = $request->email;
        $user->phone = $request->phone;
        $user->fee = $request->fee; // null হলে TransferController default use করবে
        $user->timezone = $request->timezone;

        $user->save();

        return response()->json([
            'success' => true,
            'message' => 'Profile updated successfully',
            'data' => $user
        ]);
    }
}
