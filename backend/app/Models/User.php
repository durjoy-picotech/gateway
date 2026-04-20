<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Tymon\JWTAuth\Contracts\JWTSubject;

class User extends Authenticatable implements JWTSubject
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'user_id',
        'role',
        'name',
        'email',
        'phone',
        'timezone',
        'two_factor_enabled',
        'password',
        'partner_id',
        'agent_id',
        'merchant_id',
        'two_factor_secret',
        'two_factor_recovery_codes',
        'recovery_email',
        'failed_logins',
        'status',
        'adFee'
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'two_factor_enabled' => 'boolean',
        ];
    }

    /**
     * Get the identifier that will be stored in the subject claim of the JWT.
     *
     * @return mixed
     */
    public function getJWTIdentifier()
    {
        return $this->getKey();
    }

    /**
     * Return a key value array, containing any custom claims to be added to the JWT.
     *
     * @return array
     */
    public function getJWTCustomClaims()
    {
        return [];
    }

    public function settings(): HasOne
    {
        return $this->hasOne(UserSetting::class, 'user_id', 'user_id');
    }

    public function partner()
    {
        return $this->belongsTo(Partner::class, 'partner_id', 'partner_id');
    }

    public function agent()
    {
        return $this->belongsTo(Agent::class, 'agent_id', 'agent_id');
    }

    public function merchant()
    {
        return $this->belongsTo(Merchant::class, 'merchant_id', 'merchant_id');
    }

    public function wallets()
    {
        return $this->hasMany(Wallet::class, 'user_id', 'user_id');
    }




    public function parentUser()
    {
        return $this->agent ?? $this->partner;
    }

    // ===============================
    // CHILD RELATIONS
    // ===============================

    // Partner → Agents
    public function agents()
    {
        return $this->hasMany(User::class, 'partner_id', 'user_id')
            ->where('role', 'AGENT');
    }

    // Agent → Merchants
    public function merchants()
    {
        return $this->hasMany(User::class, 'agent_id', 'user_id')
            ->where('role', 'MERCHANT');
    }

}
