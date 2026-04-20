<?php

namespace App\Http\Controllers;

use App\Models\Merchant;
use App\Models\User;
use App\Models\Wallet;
use App\Models\Transaction;
use App\Services\NotificationService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Models\userProviderFee;
use App\Models\Provider;
use App\Models\Currency;
use App\Models\UserSetting;
use Illuminate\Support\Facades\Log;

class MerchantController extends Controller
{
    /**
     * List merchants with filtering.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'agent_id' => 'string',
            'status' => 'string|in:ACTIVE,INACTIVE,SUSPENDED',
            'kyb_status' => 'string|in:PENDING,APPROVED,REJECTED',
            'page' => 'integer|min:1',
            'limit' => 'integer|min:1|max:100'
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

        $query = Merchant::with(['agent', 'userProviderFee'])->orderByDesc('created_at');

        if ($request->has('agent_id')) {
            $query->where('agent_id', $request->agent_id);
        }

        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('kyb_status')) {
            $query->where('kyb_status', $request->kyb_status);
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 20);

        $merchants = $query->paginate($limit, ['*'], 'page', $page);

        $merchants->getCollection()->transform(function ($merchant) {
            return [
                'merchant_id' => $merchant->merchant_id,
                'agent_id' => $merchant->agent_id,
                'name' => $merchant->name,
                'email' => $merchant->user->email,
                'default_currency' => $merchant->default_currency,
                'enabled_providers' => $merchant->enabled_providers,
                'enabled_currencies' => $merchant->enabled_currencies,
                'settlement_terms' => $merchant->settlement_terms,
                'status' => $merchant->status,
                'kyb_status' => $merchant->kyb_status,
                'created_at' => $merchant->created_at->toISOString(),
                'userProviderFee' => $merchant->userProviderFee,
                'agent' => $merchant->agent ? [
                    'agent_id' => $merchant->agent->agent_id,
                    'name' => $merchant->agent->name,
                    'email' => $merchant->agent->user->email
                ] : null,
                'adFee' => $merchant->adFee,

            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'merchants' => $merchants->items(),
                'pagination' => [
                    'page' => $merchants->currentPage(),
                    'limit' => $merchants->perPage(),
                    'total' => $merchants->total(),
                    'pages' => $merchants->lastPage()
                ]
            ]
        ]);
    }

    /**
     * Create new merchant.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'agent_id' => 'required|string|exists:agents,agent_id',
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            // 'default_currency' => 'string',
            'enabled_currencies' => 'nullable|array',
            'settlement_terms' => 'nullable|string',
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

        // $admin = User::table('users')->where('role', 'SUPER_ADMIN')->first();
        // $admin = User::where('role', 'SUPER_ADMIN')->first();
        // $feePercent = 0;
        // // $adminFee = UserSetting::where('user_id', $admin->user_id)->value('settings');
        // if ($admin) {
        //     $adminFee = UserSetting::where('user_id', $admin->user_id)
        //         ->value('settings');
        //     if ($adminFee) {
        //         $data = $adminFee;
        //         $fee = $data['appearance']['fee'];
        //         $feePercent = floatval($fee);
        //     }
        // } 

        $admin = User::where('role', 'SUPER_ADMIN')->first();
        // dd($admin);
        $feePercent = 0;

        if ($admin) {
            $adminFee = UserSetting::where('user_id', $admin->user_id)->value('settings');
            if ($adminFee) {
                $data = $adminFee;
                $fee = $data['appearance']['fee'];
                $feePercent = floatval($fee);
            }
        }




        $merchant = Merchant::create([
            'merchant_id' => Str::uuid(),
            'agent_id' => $request->agent_id,
            'name' => $request->name,
            'default_currency' => $request->default_currency,
            'enabled_currencies' => $request->enabled_currencies,
            'enabled_providers' => $request->enabled_providers,
            'settlement_terms' => $request->settlement_terms,
            'adFee' => $feePercent
        ]);

        // Get agent to retrieve partner_id
        $agent = \App\Models\Agent::where('agent_id', $request->agent_id)->first();

        // Create user for the merchant
        $user = User::create([
            'user_id' => Str::uuid(),
            'role' => 'MERCHANT',
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'partner_id' => $agent->partner_id,
            'agent_id' => $request->agent_id,
            'merchant_id' => $merchant->merchant_id,
            'timezone' => 'UTC',
            'two_factor_enabled' => false,
            'adFee' => $feePercent,

        ]);
        foreach ($merchant->enabled_currencies as $currency) {
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
                    'merchant_id' => $merchant->merchant_id,
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
        NotificationService::merchantCreated($merchant);

        return response()->json([
            'success' => true,
            'message' => 'Merchant created successfully',
            'data' => [
                'merchant_id' => $merchant->merchant_id,
                'agent_id' => $merchant->agent_id,
                'name' => $merchant->name,
                'default_currency' => $merchant->default_currency,
                'enabled_currencies' => $merchant->enabled_currencies,
                'enabled_providers' => $merchant->enabled_providers,
                'settlement_terms' => $merchant->settlement_terms,
                'status' => $merchant->status,
                'kyb_status' => $merchant->kyb_status,
                'created_at' => $merchant->created_at->toISOString(),
                'adFee' =>  $merchant->adFee,

            ]
        ], 201);
    }

    /**
     * Get merchant details by ID.
     */
    public function show($id)
    {
        $merchant = Merchant::with('agent')->where('merchant_id', $id)->first();

        if (!$merchant) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'MERCHANT_NOT_FOUND',
                    'message' => 'Merchant not found'
                ]
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'merchant_id' => $merchant->merchant_id,
                'agent_id' => $merchant->agent_id,
                'name' => $merchant->name,
                'default_currency' => $merchant->default_currency,
                'enabled_currencies' => $merchant->enabled_currencies,
                'enabled_providers' => $merchant->enabled_providers,
                'settlement_terms' => $merchant->settlement_terms,
                'status' => $merchant->status,
                'kyb_status' => $merchant->kyb_status,
                'kyb_review_notes' => $merchant->kyb_review_notes,
                'created_at' => $merchant->created_at->toISOString(),
                'agent' => $merchant->agent ? [
                    'agent_id' => $merchant->agent->agent_id,
                    'name' => $merchant->agent->name
                ] : null,
                'adFee' =>  $merchant->adFee,

            ]
        ]);
    }

    /**
     * Update merchant information.
     */
    public function update(Request $request, $id)
    {
        $merchant = Merchant::where('merchant_id', $id)->first();

        if (!$merchant) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'MERCHANT_NOT_FOUND',
                    'message' => 'Merchant not found'
                ]
            ], 404);
        }
        $user = User::where('merchant_id', $merchant->merchant_id)->first();
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
            'enabled_currencies' => 'nullable|array',
            'settlement_terms' => 'nullable|string',
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

        $oldCurrencies = $merchant->enabled_currencies;
        $newCurrencies = $request->enabled_currencies;

        $removedCurrencies = array_diff($oldCurrencies, $newCurrencies);
        Log::info('Removed currencies:', $removedCurrencies);

        if ($removedCurrencies) {
            $transactions = Transaction::where('merchant_id', $merchant->merchant_id)
                ->whereIn('currency', $removedCurrencies)
                ->get();
            Log::info($transactions);
            if ($transactions->isEmpty()) {
                Wallet::where('user_id', $merchant->user->user_id)
                    ->whereIn('currency', $removedCurrencies)
                    ->delete();
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
        $merchant->update($request->only([
            'name',
            'default_currency',
            'enabled_currencies',
            'settlement_terms',
            'status',
            'kyb_status',
            'enabled_providers',
            'adFee'
        ]));

        $user->update([
            'name' => $request->name ,
            'email' => $request->email ,
            'adFee' => $request->adFee 
        ]);



        foreach ($merchant->enabled_currencies as $currency) {
            $wallet = Wallet::where('user_id', $user->user_id)->where('currency', $currency)->first();
            if (!$wallet && $currency) {
                Wallet::create([
                    'user_id' => $user->user_id,
                    'balance' => 0,
                    'currency' => $currency,
                    'status' => 'ACTIVE',
                    // 'adFee' => $adFee,

                ]);
            }
        }
        if ($request->providersFees && $request->providersFees > 0) {
            foreach ($request->providersFees as $providersFee) {
                $userProviderFee = userProviderFee::where('user_type', 'MERCHANT')->where('merchant_id', $merchant->merchant_id)
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
                        'merchant_id' => $merchant->merchant_id,
                        'provider_id' => $providersFee['provider_id'],
                        'user_type' => 'MERCHANT',
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

        return response()->json([
            'success' => true,
            'message' => 'Merchant updated successfully',
            'data' => [
                'merchant_id' => $merchant->merchant_id,
                'agent_id' => $merchant->agent_id,
                'name' => $merchant->name,
                'default_currency' => $merchant->default_currency,
                'enabled_providers' => $merchant->enabled_providers,
                'enabled_currencies' => $merchant->enabled_currencies,
                'settlement_terms' => $merchant->settlement_terms,
                'status' => $merchant->status,
                'kyb_status' => $merchant->kyb_status,
                'created_at' => $merchant->created_at->toISOString(),
                'adFee' => $merchant->adFee,

            ]
        ]);
    }

    /**
     * Delete merchant.
     */
    public function destroy($id)
    {
        $merchant = Merchant::where('merchant_id', $id)->first();

        if (!$merchant) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'MERCHANT_NOT_FOUND',
                    'message' => 'Merchant not found'
                ]
            ], 404);
        }

        // Check if merchant has transactions
        if ($merchant->transactions()->count() > 0) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'MERCHANT_HAS_TRANSACTIONS',
                    'message' => 'Cannot delete merchant with transaction history'
                ]
            ], 400);
        }

        $merchant->userProviderFee()->delete();

        $merchant->delete();

        return response()->json([
            'success' => true,
            'message' => 'Merchant deleted successfully'
        ]);
    }

    public function generateApiKey(Request $request)
    {


        $merchant = Merchant::with('agent')->where('merchant_id', $request->merchant_id)->first();

        if (!$merchant) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'MERCHANT_NOT_FOUND',
                    'message' => 'Merchant not found'
                ]
            ], 404);
        }


        if (!$merchant->api_key) {
            $apiKey = Str::random(60);
            $merchant->api_key = $apiKey;
            $merchant->save();
        }


        return response()->json(
            [
                'success' => true,
                'data' => ['api_key' => $merchant->api_key]
            ]
        );
    }
}
