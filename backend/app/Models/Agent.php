<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Agent extends Model
{
    protected $fillable = [
        'agent_id',
        'partner_id',
        'parent_agent_id',
        'name',
        'default_currency',
        'allowed_sub_agents',
        'status',
        'enabled_providers',
        'enabled_currencies',
        'adFee',
        
    ];

    protected $casts = [
        'allowed_sub_agents' => 'boolean',
        'enabled_providers' => 'array',
        'enabled_currencies' => 'array',
    ];

    /**
     * Get the partner that owns the agent.
     */
    public function partner(): BelongsTo
    {
        return $this->belongsTo(Partner::class, 'partner_id', 'partner_id');
    }

    /**
     * Get the parent agent.
     */
    public function parentAgent(): BelongsTo
    {
        return $this->belongsTo(Agent::class, 'parent_agent_id', 'agent_id');
    }

    /**
     * Get the sub agents for the agent.
     */
    public function subAgents(): HasMany
    {
        return $this->hasMany(Agent::class, 'parent_agent_id', 'agent_id');
    }

    /**
     * Get the user for the agent.
     */
    public function user(): HasOne
    {
        return $this->hasOne(User::class, 'agent_id', 'agent_id');
    }

    /**
     * Get the merchants for the agent.
     */
    public function merchants(): HasMany
    {
        return $this->hasMany(Merchant::class, 'agent_id', 'agent_id');
    }

    public function userProviderFee(): HasMany
    {
        return $this->hasMany(userProviderFee::class, 'agent_id', 'agent_id');
    }
}
