<?php

namespace App\Http\Controllers;

use App\Models\Agent;
use App\Models\Merchant;
use App\Models\Wallet;
use App\Models\User;
use App\Models\UserSetting;
use App\Models\Transfer;
use App\Models\Transaction;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Models\userProviderFee;
use App\Models\Currency;
use App\Models\Provider;
use Illuminate\Support\Facades\Log;

class AgentController extends Controller
{
    /**
     * List agents with filtering.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'partner_id' => 'string',
            'page' => 'integer|min:1',
            'limit' => 'integer|min:1|max:100',
            'status' => 'string|in:ACTIVE,INACTIVE,SUSPENDED'
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

        $currentUser = auth()->user();
        $query = Agent::with(['partner', 'userProviderFee'])->orderByDesc('created_at');

        // Filter based on user role
        if ($currentUser->role === 'AGENT') {
            // Agents see only their sub-agents
            $query->where('parent_agent_id', $currentUser->agent_id);
        } elseif ($currentUser->role === 'PARTNER') {
            // Partners see only their direct agents (not sub-agents)
            $query->where('partner_id', $currentUser->partner_id)->whereNull('parent_agent_id');
        }
        // SUPER_ADMIN sees all agents

        if ($request->has('partner_id')) {
            $query->where('partner_id', $request->partner_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 20);

        $agents = $query->paginate($limit, ['*'], 'page', $page);

        $agents->getCollection()->transform(function ($agent) {
            return [
                'agent_id' => $agent->agent_id,
                'partner_id' => $agent->partner_id,
                'parent_agent_id' => $agent->parent_agent_id,
                'name' => $agent->name,
                'email' => $agent->user->email,
                'default_currency' => $agent->default_currency,
                'allowed_sub_agents' => $agent->allowed_sub_agents,
                'status' => $agent->status,
                'enabled_providers' => $agent->enabled_providers,
                'enabled_currencies' => $agent->enabled_currencies,
                'created_at' => $agent->created_at->toISOString(),
                'userProviderFee' => $agent->userProviderFee,
                'partner' => $agent->partner ? [
                    'partner_id' => $agent->partner->partner_id,
                    'name' => $agent->partner->name,
                    'email' => $agent->partner->user->email
                ] : null,
                'adFee' => $agent->adFee,

            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'agents' => $agents->items(),
                'pagination' => [
                    'page' => $agents->currentPage(),
                    'limit' => $agents->perPage(),
                    'total' => $agents->total(),
                    'pages' => $agents->lastPage()
                ]
            ]
        ]);
    }

    /**
     * Create new agent.
     */
    public function store(Request $request)
    {
        $currentUser = auth()->user();

        $partnerId = null;
        $parentAgentId = null;

        if ($currentUser->role === 'AGENT') {
            $partnerId = $currentUser->partner_id;
            $parentAgentId = $currentUser->agent_id;

            // Check if current agent allows sub agents
            $currentAgent = Agent::where('agent_id', $currentUser->agent_id)->first();
            if (!$currentAgent || !$currentAgent->allowed_sub_agents) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'AGENT_NOT_ALLOWED_TO_CREATE_SUB_AGENTS',
                        'message' => 'You are not allowed to create sub agents'
                    ]
                ], 403);
            }

            $validator = Validator::make($request->all(), [
                'name' => 'required|string|max:255',
                'email' => 'required|email|unique:users,email',
                'password' => 'required|string|min:8',
                // 'default_currency' => 'string',
                'allowed_sub_agents' => 'boolean',
                'enabled_providers' => 'nullable|array',
                'enabled_currencies' => 'nullable|array'
            ]);
        } elseif ($currentUser->role === 'PARTNER') {
            $partnerId = $currentUser->partner_id;
            $parentAgentId = $request->parent_agent_id;

            $validator = Validator::make($request->all(), [
                'parent_agent_id' => 'nullable|string|exists:agents,agent_id',
                'name' => 'required|string|max:255',
                'email' => 'required|email|unique:users,email',
                'password' => 'required|string|min:8',
                // 'default_currency' => 'string',
                'allowed_sub_agents' => 'boolean',
                'enabled_providers' => 'nullable|array',
                'enabled_currencies' => 'nullable|array'

            ]);
        } else { // SUPER_ADMIN
            $partnerId = $request->partner_id;
            $parentAgentId = $request->parent_agent_id;

            $validator = Validator::make($request->all(), [
                'partner_id' => 'required|string|exists:partners,partner_id',
                'parent_agent_id' => 'nullable|string|exists:agents,agent_id',
                'name' => 'required|string|max:255',
                'email' => 'required|email|unique:users,email',
                'password' => 'required|string|min:8',
                // 'default_currency' => 'string',
                'allowed_sub_agents' => 'boolean',
                'enabled_providers' => 'nullable|array',
                'enabled_currencies' => 'nullable|array'

            ]);
        }

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

        // Check if parent agent allows sub agents
        if ($parentAgentId) {
            $parentAgent = Agent::where('agent_id', $parentAgentId)->first();
            if (!$parentAgent || !$parentAgent->allowed_sub_agents) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'PARENT_AGENT_NOT_ALLOWED',
                        'message' => 'Parent agent does not allow sub agents'
                    ]
                ], 400);
            }
        }

        // $filtered = [];
        // foreach ($request->enabled_currencies as $currency) {
        //     if ($currency !== null && $currency !== '') {
        //         $filtered[] = $currency;
        //     }
        // }
        $providerCurrencyIds = Provider::whereIn('provider_id', $request->enabled_providers)
            ->pluck('currency_id'); // IDs of currencies linked to selected providers

        $validCurrencies = Currency::whereIn('id', $providerCurrencyIds)
            ->pluck('code')
            ->toArray();

        // Filter request currencies: remove null, empty, and those not linked to selected providers
        $filteredCurrencies = array_filter($request->enabled_currencies, function ($currency) use ($validCurrencies) {
            return $currency !== null && $currency !== '' && in_array($currency, $validCurrencies);
        });

        // Optional: remove duplicates
        $filteredCurrencies = array_unique($filteredCurrencies);
        $request['enabled_currencies'] = $filteredCurrencies;
        $request['default_currency'] = $filteredCurrencies[0];





        // // $admin = User::table('users')->where('role', 'SUPER_ADMIN')->first();
        // $admin = User::where('role', 'SUPER_ADMIN')->first();
        // $feePercent = 2;
        // $adminFee = UserSetting::where('user_id', $admin->user_id)
        //     ->value('settings');
        // if ($adminFee) {
        //     $feePercent = floatval($adminFee['appearance']['fee']);
        // } else {
        //     $feePercent = 2;
        // }


        $admin = User::where('role', 'SUPER_ADMIN')->first();
        $feePercent = 0;

        if ($admin) {
            $adminFee = UserSetting::where('user_id', $admin->user_id)->value('settings');
            if ($adminFee) {
                $data = $adminFee;
                $fee = $data['appearance']['fee'];
                $feePercent = floatval($fee);
            }
        }











        // $admin = User::table('users')->where('role', 'SUPER_ADMIN')->first();
        // $feePercent = 2;
        // if ($sender && isset($sender->adFee) && $sender->adFee !== "" && $sender->adFee !== null) {
        //     $feePercent = floatval($sender->adFee);
        // } else {
        //     if ($admin) {
        //         $adminFee = UserSetting::where('user_id', $admin->user_id)
        //             ->value('settings');
        //         if ($adminFee) {
        //             $data = $adminFee;
        //             $fee = $data['appearance']['fee'];
        //             $feePercent = floatval($fee);
        //         }
        //     }
        // }



        $agent = Agent::create([
            'agent_id' => Str::uuid(),
            'partner_id' => $partnerId,
            'parent_agent_id' => $parentAgentId,
            'name' => $request->name,
            'default_currency' => $request->default_currency ?? 'USD',
            'allowed_sub_agents' => $request->allowed_sub_agents ?? true,
            'enabled_providers' => $request->enabled_providers,
            'enabled_currencies' => $request->enabled_currencies,
            'adFee' => $feePercent
        ]);

        // Create user for the agent
        $user = User::create([
            'user_id' => Str::uuid(),
            'role' => 'AGENT',
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'partner_id' => $partnerId,
            'agent_id' => $agent->agent_id,
            'timezone' => 'UTC',
            'two_factor_enabled' => false,
            'adFee' =>  $feePercent

        ]);
        foreach ($agent->enabled_currencies as $currency) {
            if ($currency) {
                Wallet::create([
                    'user_id' => $user->user_id,
                    'balance' => 0,
                    'currency' => $currency,
                    'status' => 'ACTIVE',
                ]);
            }
        }
        if ($request->providersFees && $request->providersFees > 0) {
            foreach ($request->providersFees as $providersFee) {
                userProviderFee::create([
                    'user_provider_fees_id' => Str::uuid(),
                    'agent_id' => $agent->agent_id,
                    'provider_id' => $providersFee['provider_id'],
                    'user_type' => $user->role,
                    'fee_percentage' => $providersFee['fee_percentage'],
                    'fixed_amount' => $providersFee['fixed_amount'],
                    'add_fee_percentage' => $providersFee['new_fee_percentage'],
                    'add_fixed_amount' => $providersFee['new_fixed_amount'],
                    'new_fee_percentage' => $providersFee['fee_percentage'] + $providersFee['new_fee_percentage'],
                    'new_fixed_amount' => $providersFee['fixed_amount'] + $providersFee['new_fixed_amount'],
                ]);
            }
        }
        // Send notification
        NotificationService::agentCreated($agent);

        return response()->json([
            'success' => true,
            'message' => 'Agent created successfully',
            'data' => [
                'agent_id' => $agent->agent_id,
                'partner_id' => $agent->partner_id,
                'parent_agent_id' => $agent->parent_agent_id,
                'name' => $agent->name,
                'default_currency' => $agent->default_currency,
                'allowed_sub_agents' => $agent->allowed_sub_agents,
                'enabled_providers' => $agent->enabled_providers,
                'enabled_currencies' => $agent->enabled_currencies,
                'status' => $agent->status,
                'created_at' => $agent->created_at->toISOString(),
                'adFee' => $agent->adFee

            ]
        ], 201);
    }

    /**
     * Get agent details by ID.
     */
    public function show($id)
    {
        $agent = Agent::with('partner')->where('agent_id', $id)->first();

        if (!$agent) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'AGENT_NOT_FOUND',
                    'message' => 'Agent not found'
                ]
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'agent_id' => $agent->agent_id,
                'partner_id' => $agent->partner_id,
                'parent_agent_id' => $agent->parent_agent_id,
                'name' => $agent->name,
                'default_currency' => $agent->default_currency,
                'enabled_providers' => $agent->enabled_providers,
                'enabled_currencies' => $agent->enabled_currencies,
                'allowed_sub_agents' => $agent->allowed_sub_agents,
                'status' => $agent->status,
                'created_at' => $agent->created_at->toISOString(),
                'partner' => $agent->partner ? [
                    'partner_id' => $agent->partner->partner_id,
                    'name' => $agent->partner->name
                ] : null,
                'adFee' => $agent->adFee,

            ]
        ]);
    }

    /**
     * Update agent information.
     */
    public function update(Request $request, $id)
    {
        $agent = Agent::where('agent_id', $id)->first();

        if (!$agent) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'AGENT_NOT_FOUND',
                    'message' => 'Agent not found'
                ]
            ], 404);
        }
        $user = User::where('agent_id', $agent->agent_id)->first();
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
            // 'default_currency' => 'string',
            'allowed_sub_agents' => 'boolean',
            'adFee' => 'nullable|numeric|min:0|max:100',

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

        $oldCurrencies = $agent->enabled_currencies;
        $newCurrencies = $request->enabled_currencies;

        $removedCurrencies = array_diff($oldCurrencies, $newCurrencies);
        Log::info('Removed currencies:', $removedCurrencies);

        if ($removedCurrencies) {
            $transactions = Transaction::where('agent_id', $agent->agent_id)
                ->whereIn('currency', $removedCurrencies)
                ->get();
            Log::info($transactions);
            if ($transactions->isEmpty()) {
                Wallet::where('user_id', $agent->user->user_id)
                    ->whereIn('currency', $removedCurrencies)
                    ->delete();

                $merchants = Merchant::where('agent_id', $agent->agent_id)->get();
                Log::info($merchants);

                foreach ($merchants as $merchant) {
                    Wallet::where('user_id', $merchant->user->user_id)
                        ->whereIn('currency', $removedCurrencies)
                        ->delete();

                    $merchant->enabled_currencies = array_values(
                        array_diff($merchant->enabled_currencies, $removedCurrencies)
                    );
                    $merchant->save();
                }
            } else {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'VALIDATION_ERROR',
                        'message' => "You cannot remove enabled currencies with existing transactions.",
                    ]
                ], 400);
            }
        }
        // $filtered = [];
        // foreach ($request->enabled_currencies as $currency) {
        //     if ($currency !== null && $currency !== '') {
        //         $filtered[] = $currency;
        //     }
        // }
        $providerCurrencyIds = Provider::whereIn('provider_id', $request->enabled_providers)
            ->pluck('currency_id'); // IDs of currencies linked to selected providers

        $validCurrencies = Currency::whereIn('id', $providerCurrencyIds)
            ->pluck('code')
            ->toArray();

        // Filter request currencies: remove null, empty, and those not linked to selected providers
        $filteredCurrencies = array_filter($request->enabled_currencies, function ($currency) use ($validCurrencies) {
            return $currency !== null && $currency !== '' && in_array($currency, $validCurrencies);
        });

        // Optional: remove duplicates
        $filteredCurrencies = array_unique($filteredCurrencies);
        $request['enabled_currencies'] = $filteredCurrencies;
        $request['default_currency'] = $filteredCurrencies[0];
        $oldStatus = $agent->status;
        $agent->update($request->only(['name', 'default_currency', 'allowed_sub_agents', 'status', 'enabled_providers', 'enabled_currencies', 'adFee']));

        $user->update([
            'name' => $request->name,
            'email' => $request->email,
            'adFee' => $request->adFee,
        ]);





        foreach ($agent->enabled_currencies as $currency) {
            $wallet = Wallet::where('user_id', $user->user_id)->where('currency', $currency)->first();
            if (!$wallet && $currency) {
                Wallet::create([
                    'user_id' => $user->user_id,
                    'balance' => 0,
                    'currency' => $currency,
                    'status' => 'ACTIVE',
                ]);
            }
        }

        if ($request->providersFees && $request->providersFees > 0) {
            foreach ($request->providersFees as $providersFee) {
                $userProviderFee = userProviderFee::where('user_type', 'AGENT')->where('agent_id', $agent->agent_id)
                    ->where('provider_id', $providersFee['provider_id'])
                    ->first();
                if ($userProviderFee) {
                    $userProviderFee->update([
                        'fee_percentage' => $providersFee['fee_percentage'],
                        'fixed_amount' => $providersFee['fixed_amount'],
                        'add_fee_percentage' => $providersFee['new_fee_percentage'],
                        'add_fixed_amount' => $providersFee['new_fixed_amount'],
                        'new_fee_percentage' => $providersFee['fee_percentage'] + $providersFee['new_fee_percentage'],
                        'new_fixed_amount' =>  $providersFee['fixed_amount'] + $providersFee['new_fixed_amount'],
                    ]);
                } else {
                    userProviderFee::create([
                        'user_provider_fees_id' => Str::uuid(),
                        'agent_id' => $agent->agent_id,
                        'provider_id' => $providersFee['provider_id'],
                        'user_type' => 'AGENT',
                        'fee_percentage' => $providersFee['fee_percentage'],
                        'fixed_amount' => $providersFee['fixed_amount'],
                        'add_fee_percentage' => $providersFee['new_fee_percentage'],
                        'add_fixed_amount' => $providersFee['new_fixed_amount'],
                        'new_fee_percentage' => $providersFee['fee_percentage'] + $providersFee['new_fee_percentage'],
                        'new_fixed_amount' => $providersFee['fixed_amount'] + $providersFee['new_fixed_amount'],
                    ]);
                }
            }
        }

        // Send notification if status changed
        if ($request->has('status') && $oldStatus !== $agent->status) {
            NotificationService::agentStatusUpdated($agent, $oldStatus, $agent->status);
        }

        return response()->json([
            'success' => true,
            'message' => 'Agent updated successfully',
            'data' => [
                'agent_id' => $agent->agent_id,
                'partner_id' => $agent->partner_id,
                'parent_agent_id' => $agent->parent_agent_id,
                'name' => $agent->name,
                'default_currency' => $agent->default_currency,
                'allowed_sub_agents' => $agent->allowed_sub_agents,
                'enabled_providers' => $agent->enabled_providers,
                'enabled_currencies' => $agent->enabled_currencies,
                'status' => $agent->status,
                'created_at' => $agent->created_at->toISOString(),
                'adFee' => $agent->adFee

            ]
        ]);
    }

    /**
     * Delete agent.
     */
    public function destroy($id)
    {
        $agent = Agent::where('agent_id', $id)->first();

        if (!$agent) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'AGENT_NOT_FOUND',
                    'message' => 'Agent not found'
                ]
            ], 404);
        }

        // Check if agent has sub agents
        if ($agent->subAgents()->count() > 0) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'AGENT_HAS_SUB_AGENTS',
                    'message' => 'Cannot delete agent with sub agents'
                ]
            ], 400);
        }

        // Check if agent has merchants
        if ($agent->merchants()->count() > 0) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'AGENT_HAS_MERCHANTS',
                    'message' => 'Cannot delete agent with associated merchants'
                ]
            ], 400);
        }
        $agent->userProviderFee()->delete();
        $agent->delete();

        return response()->json([
            'success' => true,
            'message' => 'Agent deleted successfully'
        ]);
    }
}
