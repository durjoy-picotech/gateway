<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Support\Facades\Config;

class MailConfigServiceProvider extends ServiceProvider
{
    /**
     * Register services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap services.
     */
    public function boot(): void
    {
        $config = array(
            'driver' => 'smtp',
            'host' => get_settings('mail_host'),
            'port' => (int)get_settings('mail_port'),
            'from' => array('address' => get_settings('mail_from'), 'name' => get_settings('mail_name')),
            'encryption' => get_settings('mail_encryption'),
            'username' => get_settings('mail_username'),
            'password' => get_settings('mail_password'),
            'sendmail' => '/usr/sbin/sendmail -bs',
            'pretend' => false,
        );
        Config::set('mail', $config);
    }
}
