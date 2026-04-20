<?php

namespace App\Http\Controllers;

use App\Models\Partner;
use App\Models\userProviderFee;
use App\Models\User;
use App\Models\UserSetting;
use App\Models\Wallet;
use App\Models\Merchant;
use App\Models\Transaction;
use App\Models\Agent;
use App\Models\Currency;
use App\Models\Provider;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Log;

class PartnerController extends Controller
{
    /**
     * List partners with pagination and filtering.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
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

        $query = Partner::with('userProviderFee')->orderByDesc('created_at');

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 20);

        $partners = $query->paginate($limit, ['*'], 'page', $page);

        $partners->getCollection()->transform(function ($partner) {
            return [
                'partner_id' => $partner->partner_id,
                'name' => $partner->name,
                'email' => $partner->user->email,
                'domain_branding' => $partner->domain_branding,
                'default_currency' => $partner->default_currency,
                'enabled_currencies' => $partner->enabled_currencies,
                'enabled_providers' => $partner->enabled_providers,
                'settlement_policy' => $partner->settlement_policy,
                'reserve_policy' => $partner->reserve_policy,
                'kyc_policy' => $partner->kyc_policy,
                'can_create_own_bank' => $partner->can_create_own_bank,
                'created_at' => $partner->created_at->toISOString(),
                'status' => $partner->status,
                'userProviderFee' => $partner->userProviderFee,
                'adFee' => $partner->adFee
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'partners' => $partners->items(),
                'pagination' => [
                    'page' => $partners->currentPage(),
                    'limit' => $partners->perPage(),
                    'total' => $partners->total(),
                    'pages' => $partners->lastPage()
                ]
            ]
        ]);
    }

    /**
     * Create new partner.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'domain_branding' => 'nullable|string|max:255',
            // 'default_currency' => 'string',
            'enabled_currencies' => 'nullable|array',
            'enabled_providers' => 'nullable|array',
            'settlement_policy' => 'nullable|array',
            'reserve_policy' => 'nullable|array',
            'kyc_policy' => 'boolean',
            'can_create_own_bank' => 'boolean',
            // 'adFee' => 'nullable|numeric|min:0|max:100'

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
        // Get all currencies associated with the selected providers
        $providerCurrencyIds = Provider::whereIn('provider_id', $request->enabled_providers)
            ->pluck('currency_id'); // IDs of currencies linked to selected providers

        $validCurrencies = Currency::whereIn('id', $providerCurrencyIds)
            ->pluck('code') // currency codes
            ->toArray();

        // Filter request currencies: remove null, empty, and those not linked to selected providers
        $filteredCurrencies = array_filter($request->enabled_currencies, function ($currency) use ($validCurrencies) {
            return $currency !== null && $currency !== '' && in_array($currency, $validCurrencies);
        });

        // Optional: remove duplicates
        $filteredCurrencies = array_unique($filteredCurrencies);

        $request['enabled_currencies'] = $filteredCurrencies;
        $request['default_currency'] = $filteredCurrencies[0];







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


        $partner = Partner::create([
            'partner_id' => Str::uuid(),
            'name' => $request->name,
            'domain_branding' => $request->domain_branding,
            'default_currency' => $request->default_currency,
            'enabled_currencies' => $request->enabled_currencies,
            'enabled_providers' => $request->enabled_providers,
            'settlement_policy' => $request->settlement_policy,
            'reserve_policy' => $request->reserve_policy,
            'kyc_policy' => $request->kyc_policy ?? false,
            'can_create_own_bank' => $request->can_create_own_bank ?? false,
            'adFee' => $feePercent

        ]);

        // Create user for the partner
        $user = User::create([
            'user_id' => Str::uuid(),
            'role' => 'PARTNER',
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'partner_id' => $partner->partner_id,
            'timezone' => 'UTC',
            'two_factor_enabled' => false,
            'adFee' => $feePercent

        ]);
        foreach ($partner->enabled_currencies as $currency) {
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
                    'partner_id' => $partner->partner_id,
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
        NotificationService::partnerCreated($partner);

        return response()->json([
            'success' => true,
            'message' => 'Partner created successfully',
            'data' => [
                'partner_id' => $partner->partner_id,
                'name' => $partner->name,
                'domain_branding' => $partner->domain_branding,
                'default_currency' => $partner->default_currency,
                'enabled_currencies' => $partner->enabled_currencies,
                'settlement_policy' => $partner->settlement_policy,
                'reserve_policy' => $partner->reserve_policy,
                'kyc_policy' => $partner->kyc_policy,
                'can_create_own_bank' => $partner->can_create_own_bank,
                'created_at' => $partner->created_at->toISOString(),
                'status' => $partner->status,
                'adFee' => $request->adFee

            ]
        ], 201);
    }

    /**
     * Get partner details by ID.
     */
    public function show($id)
    {
        $partner = Partner::where('partner_id', $id)->first();

        if (!$partner) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PARTNER_NOT_FOUND',
                    'message' => 'Partner not found'
                ]
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'partner_id' => $partner->partner_id,
                'name' => $partner->name,
                'domain_branding' => $partner->domain_branding,
                'default_currency' => $partner->default_currency,
                'enabled_currencies' => $partner->enabled_currencies,
                'enabled_providers' => $partner->enabled_providers,
                'settlement_policy' => $partner->settlement_policy,
                'reserve_policy' => $partner->reserve_policy,
                'kyc_policy' => $partner->kyc_policy,
                'can_create_own_bank' => $partner->can_create_own_bank,
                'created_at' => $partner->created_at->toISOString(),
                'status' => $partner->status,
                'adFee' => $partner->adFee
            ]
        ]);
    }

    /**
     * Update partner information.
     */
    public function update(Request $request, $id)
    {
        $partner = Partner::where('partner_id', $id)->first();

        if (!$partner) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PARTNER_NOT_FOUND',
                    'message' => 'Partner not found'
                ]
            ], 404);
        }
        $user = User::where('partner_id', $partner->partner_id)->first();
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
            'domain_branding' => 'nullable|string|max:255',
            // 'default_currency' => 'string',
            'enabled_currencies' => 'nullable|array',
            'enabled_providers' => 'nullable|array',
            'settlement_policy' => 'nullable|array',
            'reserve_policy' => 'nullable|array',
            'kyc_policy' => 'boolean',
            'can_create_own_bank' => 'boolean',
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

        $oldCurrencies = $partner->enabled_currencies;
        $newCurrencies = $request->enabled_currencies;

        $removedCurrencies = array_diff($oldCurrencies, $newCurrencies);

        Log::info('Removed currencies:', $removedCurrencies);
        if ($removedCurrencies) {
            $transactions = Transaction::where('partner_id', $partner->partner_id)
                ->whereIn('currency', $removedCurrencies)
                ->get();
            Log::info($transactions);

            if ($transactions->isEmpty()) {
                Wallet::where('user_id', $partner->user->user_id)
                    ->whereIn('currency', $removedCurrencies)
                    ->delete();

                $agents = Agent::where('partner_id', $partner->partner_id)->get();
                Log::info($agents);

                foreach ($agents as $agent) {
                    Wallet::where('user_id', $agent->user->user_id)
                        ->whereIn('currency', $removedCurrencies)
                        ->delete();

                    $agent->enabled_currencies = array_values(
                        array_diff($agent->enabled_currencies, $removedCurrencies)
                    );
                    $agent->save();

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
        $partner->update($request->only([
            'name',
            'domain_branding',
            'default_currency',
            'enabled_currencies',
            'settlement_policy',
            'reserve_policy',
            'kyc_policy',
            'can_create_own_bank',
            'status',
            'enabled_providers',
            'adFee'
        ]));

        //         protected $fillable = [
        //     ...
        //     'adFee'
        // ];


        $user->update([
            'name' => $request->name,
            'email' => $request->email,
            'adFee' => $request->adFee,
        ]);




        foreach ($partner->enabled_currencies as $currency) {
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
                $userProviderFee = userProviderFee::where('user_type', 'PARTNER')->where('partner_id', $partner->partner_id)
                    ->where('provider_id', $providersFee['provider_id'])
                    ->first();
                if ($userProviderFee) {
                    $userProviderFee->update([
                        'fee_percentage' => $providersFee['fee_percentage'],
                        'fixed_amount' => $providersFee['fixed_amount'],
                        'add_fee_percentage' => $providersFee['new_fee_percentage'],
                        'add_fixed_amount' => $providersFee['new_fixed_amount'],
                        'new_fee_percentage' => $providersFee['fee_percentage'] + $providersFee['new_fee_percentage'],
                        'new_fixed_amount' => $providersFee['fixed_amount'] + $providersFee['new_fixed_amount'],
                    ]);
                } else {
                    userProviderFee::create([
                        'user_provider_fees_id' => Str::uuid(),
                        'partner_id' => $partner->partner_id,
                        'provider_id' => $providersFee['provider_id'],
                        'user_type' => 'PARTNER',
                        'fee_percentage' => $providersFee['fee_percentage'],
                        'fixed_amount' => $providersFee['fixed_amount'],
                        'add_fee_percentage' => $providersFee['new_fee_percentage'],
                        'add_fixed_amount' => $providersFee['new_fixed_amount'],
                        'new_fee_percentage' =>  $providersFee['fee_percentage'] + $providersFee['new_fee_percentage'],
                        'new_fixed_amount' => $providersFee['fixed_amount'] + $providersFee['new_fixed_amount'],
                    ]);
                }
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Partner updated successfully',
            'data' => [
                'partner_id' => $partner->partner_id,
                'name' => $partner->name,
                'domain_branding' => $partner->domain_branding,
                'default_currency' => $partner->default_currency,
                'enabled_currencies' => $partner->enabled_currencies,
                'enabled_providers' => $partner->enabled_providers,
                'settlement_policy' => $partner->settlement_policy,
                'reserve_policy' => $partner->reserve_policy,
                'kyc_policy' => $partner->kyc_policy,
                'can_create_own_bank' => $partner->can_create_own_bank,
                'created_at' => $partner->created_at->toISOString(),
                'status' => $partner->status,
                'adFee' => $partner->adFee
            ]
        ]);
    }

    /**
     * Delete partner.
     */
    public function destroy($id)
    {
        $partner = Partner::where('partner_id', $id)->first();

        if (!$partner) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PARTNER_NOT_FOUND',
                    'message' => 'Partner not found'
                ]
            ], 404);
        }

        // Check if partner has agents
        if ($partner->agents()->count() > 0) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PARTNER_HAS_AGENTS',
                    'message' => 'Cannot delete partner with associated agents'
                ]
            ], 400);
        }
        $partner->userProviderFee()->delete();
        $partner->delete();

        return response()->json([
            'success' => true,
            'message' => 'Partner deleted successfully'
        ]);
    }

    /**
     * Get current partner's data.
     */
    public function getMyPartner(Request $request)
    {
        $user = Auth::user();

        if ($user->role !== 'PARTNER') {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'UNAUTHORIZED',
                    'message' => 'Only partners can access this endpoint'
                ]
            ], 403);
        }

        $partner = Partner::where('partner_id', $user->partner_id)->first();

        if (!$partner) {
            // Return null data instead of error to handle missing partner records gracefully
            return response()->json([
                'success' => true,
                'data' => null
            ]);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'partner_id' => $partner->partner_id,
                'name' => $partner->name,
                'domain_branding' => $partner->domain_branding,
                'default_currency' => $partner->default_currency,
                'enabled_currencies' => $partner->enabled_currencies,
                'settlement_policy' => $partner->settlement_policy,
                'reserve_policy' => $partner->reserve_policy,
                'kyc_policy' => $partner->kyc_policy,
                'can_create_own_bank' => $partner->can_create_own_bank,
                'created_at' => $partner->created_at->toISOString(),
                'status' => $partner->status,
                'adFee' => $partner->adFee
            ]
        ]);
    }
}
