<?php

namespace App\Http\Controllers;

use App\Models\Currency;
use App\Models\Provider;
use App\Models\Partner;
use App\Models\Transaction;
use App\Models\userProviderFee;
use App\Models\Wallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use App\Models\ProviderWallet;
use Illuminate\Container\Attributes\Log;

class ProviderController extends Controller
{
    /**
     * List providers with filtering.
     */
    public function index(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'page' => 'integer|min:1',
            'limit' => 'integer|min:1|max:100',
            'health_status' => 'string|in:HEALTHY,DEGRADED,DOWN',
            'status' => 'string|in:active,inactive,down',
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
        $user = Auth::user();

        $query = Provider::with('providerWallet', 'userProviderFee')->orderByDesc('created_at');

        if ($user->role === 'SUPER_ADMIN') {
            $query->whereNull('partner_id');
        }

        if ($request->has('health_status')) {
            $query->where('health_status', $request->health_status);
        }

        // Enhanced search functionality
        if ($request->has('search') && !empty($request->search)) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', '%' . $searchTerm . '%')
                    ->orWhere('alias', 'like', '%' . $searchTerm . '%')
                    ->orWhereJsonContains('supported_variants', $searchTerm)
                    ->orWhere('health_status', 'like', '%' . $searchTerm . '%');
            });
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 20);

        $providers = $query->paginate($limit, ['*'], 'page', $page);

        $providers->getCollection()->transform(function ($provider) {
            return [
                'provider_id' => $provider->provider_id,
                'partner_id' => $provider->partner_id,
                'name' => $provider->name,
                'alias' => $provider->alias,
                'channel_name' => $provider->channel_name,
                'channel_route' => $provider->channel_route,
                'settlement' => $provider->settlement,
                'supported_variants' => $provider->supported_variants,
                'health_status' => $provider->health_status,
                'status' => $provider->status,
                'response_time' => $provider->response_time,
                'success_rate' => $provider->success_rate,
                'fee_percentage' => $provider->fee_percentage,
                'fixed_amount' => $provider->fixed_amount,
                'currency_id' => $provider->currency_id,
                'type' => $provider->type,
                'gateway' => $provider->gateway,
                'gateway_info' => $provider->gateway_info ? json_decode($provider->gateway_info) : '',
                'currency' => $provider->currency ? [
                    'id' => $provider->currency->id,
                    'code' => $provider->currency->code,
                    'name' => $provider->currency->name,
                    'symbol' => $provider->currency->symbol
                ] : null,
                'partner' => $provider->partner ? [
                    'partner_id' => $provider->partner->partner_id,
                    'name' => $provider->partner->name
                ] : null,
                'created_at' => $provider->created_at->toISOString(),
                'providerWallet' => $provider->providerWallet,
                'userProviderFee' => $provider->userProviderFee,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'providers' => $providers->items(),
                'pagination' => [
                    'page' => $providers->currentPage(),
                    'limit' => $providers->perPage(),
                    'total' => $providers->total(),
                    'pages' => $providers->lastPage()
                ]
            ]
        ]);
    }

    /**
     * Create new provider.
     */
    public function store(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'alias' => 'required|string|max:255|unique:providers,alias',
            'channel_name' => 'nullable|string|max:255',
            'settlement' => 'nullable|string|max:255',
            'channel_route' => 'nullable|string|max:255|unique:providers,channel_route',
            'supported_variants' => 'required|array|min:1',
            'supported_variants.*' => 'string',
            'health_status' => 'string|in:HEALTHY,DEGRADED,DOWN',
            'status' => 'string|in:active,inactive,down',
            'fee_percentage' => 'nullable|numeric|min:0|max:100',
            'fixed_amount' => 'nullable|numeric|min:0',
            'currency_id' => 'nullable|exists:currencies,id'
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

        $user = Auth::user();
        $partnerId = $request->partner_id;

        if ($request->gateway == 'PG0001') {
            $request['gateway'] = 'PAYADMIT';
            $gatewayInfo = $request->gateway_info;
            if (is_object($gatewayInfo)) {
                $gatewayInfo = (array) $gatewayInfo;
            }
            if (isset($gatewayInfo['environment']) && $gatewayInfo['environment'] === 'development') {
                $gatewayInfo['endpoint'] = 'https://app-demo.payadmit.com/api/v1/payments';
            } else {
                $gatewayInfo['endpoint'] = 'https://app.payadmit.com/api/v1/payments';
            }
            $request['gateway_info'] = $gatewayInfo;
        } elseif ($request->gateway == 'PG0002') {
            $request['gateway'] = 'PAYCOMBAT';
        } elseif ($request->gateway == 'PG0003') {
            $request['gateway'] = 'KWIKWIRE';
        } elseif ($request->gateway == 'PG0004') {
            $request['gateway'] = 'OFFLINE';
        } elseif ($request->gateway == 'PG0005') {
            $request['gateway'] = 'ALCHEMYPAY';
        } elseif ($request->gateway == 'PG0006') {
            $request['gateway'] = 'LOCAL';
            $gatewayInfo = $request->gateway_info;
            if (is_object($gatewayInfo)) {
                $gatewayInfo = (array) $gatewayInfo;
            }
            if (isset($gatewayInfo['environment']) && $gatewayInfo['environment'] === 'development') {
                $gatewayInfo['endpoint'] = 'https://ramptest.alchemypay.org?';
            } else {
                $gatewayInfo['endpoint'] = 'https://ramp.alchemypay.org?';
            }
            $request['gateway_info'] = $gatewayInfo;
        }
        // If partner_id is provided, check if it's the user's partner and they have permission
        $partner = '';
        if ($partnerId) {
            if ($user->role !== 'PARTNER' || $user->partner_id !== $partnerId) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'UNAUTHORIZED',
                        'message' => 'You can only create providers for your own partner account'
                    ]
                ], 403);
            }

            $partner = Partner::where('partner_id', $partnerId)->first();
            if (!$partner || !$partner->can_create_own_bank) {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'FORBIDDEN',
                        'message' => 'Your partner account does not have permission to create providers'
                    ]
                ], 403);
            }
        } else {
            // Only SUPER_ADMIN can create providers without partner_id
            if ($user->role !== 'SUPER_ADMIN') {
                return response()->json([
                    'success' => false,
                    'error' => [
                        'code' => 'UNAUTHORIZED',
                        'message' => 'Only administrators can create global providers'
                    ]
                ], 403);
            }
        }

        if ($request->gateway_info) {
            $request['gateway_info'] = json_encode($request->gateway_info);
        }

        $provider = Provider::create([
            'provider_id' => Str::uuid(),
            'partner_id' => $partnerId,
            'name' => $request->name,
            'alias' => $request->alias,
            'channel_name' => $request->channel_name,
            'channel_route' => $request->channel_route,
            'settlement' => $request->settlement ?? 'T+0',
            'supported_variants' => $request->supported_variants,
            'health_status' => $request->health_status ?? 'HEALTHY',
            'status' => $request->status,
            'response_time' => rand(100, 500), // Random response time for demo
            'success_rate' => rand(9500, 9999) / 100, // Random success rate between 95-99.99%
            'fee_percentage' => $request->fee_percentage,
            'fixed_amount' => $request->fixed_amount,
            'currency_id' => $request->currency_id,
            'type' => $request->type,
            'gateway' => $request->gateway,
            'gateway_info' => $request->gateway_info,
        ]);

        if ($partner && $user->role == 'PARTNER') {
            $enabledProviders = $partner->enabled_providers ?? [];
            if (!is_array($enabledProviders)) {
                $enabledProviders = json_decode($enabledProviders, true) ?? [];
            }

            $enabledProviders[] = $provider->provider_id;
            $partner->enabled_providers = $enabledProviders;
            $partner->save();
            userProviderFee::create([
                'user_provider_fees_id' => Str::uuid(),
                'partner_id' => $partner->partner_id,
                'provider_id' => $provider->provider_id,
                'user_type' => $user->role,
                'fee_percentage' => 0,
                'fixed_amount' => 0,
                'add_fee_percentage' => $provider->fee_percentage,
                'add_fixed_amount' => $provider->fixed_amount,
                'new_fee_percentage' =>  $provider->fee_percentage,
                'new_fixed_amount' =>  $provider->fixed_amount,
            ]);
        }

        if ($request->currency_id) {
            $currency = Currency::where('id', $request->currency_id)->first();

            if ($currency) {
                $existingWallet = Wallet::where('user_id', $user->user_id)
                    ->where('currency', $currency->code)
                    ->first();
                if (!$existingWallet) {
                    Wallet::create([
                        'user_id' => $user->user_id,
                        'currency' => $currency->code,
                        'balance' => 0,
                        'held_balance' => 0,
                        'status' => 'ACTIVE'
                    ]);
                }

                $existingProviderWallet = ProviderWallet::where('provider_id', $provider->provider_id)
                    ->where('currency', $currency->code)
                    ->first();
                if (!$existingProviderWallet) {
                    $providerWallet = ProviderWallet::create([
                        'provider_id' => $provider->provider_id,
                        'currency' => $currency->code,
                        'balance' => 0,
                        'status' => 'ACTIVE'
                    ]);

                    $provider->provider_wallet_id = $providerWallet->id;
                    $provider->save();
                }
            }
        }



        return response()->json([
            'success' => true,
            'message' => 'Provider created successfully',
            'data' => [
                'provider_id' => $provider->provider_id,
                'partner_id' => $provider->partner_id,
                'name' => $provider->name,
                'alias' => $provider->alias,
                'channel_name' => $provider->channel_name,
                'channel_route' => $provider->channel_route,
                'settlement' => $provider->settlement,
                'supported_variants' => $provider->supported_variants,
                'health_status' => $provider->health_status,
                'status' => $provider->status,
                'response_time' => $provider->response_time,
                'success_rate' => $provider->success_rate,
                'fee_percentage' => $provider->fee_percentage,
                'fixed_amount' => $provider->fixed_amount,
                'currency_id' => $provider->currency_id,
                'type' => $provider->type,
                'gateway' => $provider->gateway,
                'gateway_info' => $provider->gateway_info ? json_decode($provider->gateway_info) : '',
                'currency' => $provider->currency ? [
                    'id' => $provider->currency->id,
                    'code' => $provider->currency->code,
                    'name' => $provider->currency->name,
                    'symbol' => $provider->currency->symbol
                ] : null,
                'partner' => $provider->partner ? [
                    'partner_id' => $provider->partner->partner_id,
                    'name' => $provider->partner->name
                ] : null,
                'created_at' => $provider->created_at->toISOString()
            ]
        ], 201);
    }

    /**
     * Get provider details by ID.
     */
    public function show($id)
    {
        $provider = Provider::where('provider_id', $id)->first();

        if (!$provider) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PROVIDER_NOT_FOUND',
                    'message' => 'Provider not found'
                ]
            ], 404);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'provider_id' => $provider->provider_id,
                'gateway_info' => $provider->gateway_info,
                'name' => $provider->name,
                'alias' => $provider->alias,
                'supported_variants' => $provider->supported_variants,
                'health_status' => $provider->health_status,
                'status' => $provider->status,
                'response_time' => $provider->response_time,
                'success_rate' => $provider->success_rate,
                'created_at' => $provider->created_at->toISOString()
            ]
        ]);
    }

    /**
     * Update provider information.
     */
    public function update(Request $request, $id)
    {
        $provider = Provider::where('provider_id', $id)->first();

        if (!$provider) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PROVIDER_NOT_FOUND',
                    'message' => 'Provider not found'
                ]
            ], 404);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'string|max:255',
            'alias' => 'string|max:255|unique:providers,alias,' . $provider->id,
            'channel_name' => 'nullable|string|max:255',
            'settlement' => 'nullable|string|max:255',
            'channel_route' => 'nullable|string|max:255|unique:providers,channel_route,' . $provider->id,
            'supported_variants' => 'array|min:1',
            'supported_variants.*' => 'string',
            'health_status' => 'string|in:HEALTHY,DEGRADED,DOWN',
            'status' => 'string|in:active,inactive,down',
            'fee_percentage' => 'nullable|numeric|min:0|max:100',
            'fixed_amount' => 'nullable|numeric|min:0',
            'currency_id' => 'nullable|exists:currencies,id'
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

        if ($request->gateway == 'PG0001') {
            $request['gateway'] = 'PAYADMIT';

            $gatewayInfo = $request->gateway_info;
            if (is_object($gatewayInfo)) {
                $gatewayInfo = (array) $gatewayInfo;
            }
            if (isset($gatewayInfo['environment']) && $gatewayInfo['environment'] === 'development') {
                $gatewayInfo['endpoint'] = 'https://app-demo.payadmit.com/api/v1/payments';
            } else {
                $gatewayInfo['endpoint'] = 'https://app.payadmit.com/api/v1/payments';
            }
            $request['gateway_info'] = $gatewayInfo;
        } elseif ($request->gateway == 'PG0002') {
            $request['gateway'] = 'PAYCOMBAT';
        } elseif ($request->gateway == 'PG0003') {
            $request['gateway'] = 'KWIKWIRE';
        } elseif ($request->gateway == 'PG0004') {
            $request['gateway'] = 'OFFLINE';
        } elseif ($request->gateway == 'PG0005') {
            $request['gateway'] = 'ALCHEMYPAY';
            $gatewayInfo = $request->gateway_info;
            if (is_object($gatewayInfo)) {
                $gatewayInfo = (array) $gatewayInfo;
            }
            if (isset($gatewayInfo['environment']) && $gatewayInfo['environment'] === 'development') {
                $gatewayInfo['endpoint'] = 'https://ramptest.alchemypay.org?';
            } else {
                $gatewayInfo['endpoint'] = 'https://ramp.alchemypay.org?';
            }
            $request['gateway_info'] = $gatewayInfo;
        }

        if ($provider->partner_id) {
            $request['gateway'] = 'OFFLINE';
        }

        if ($request->gateway_info) {
            $request['gateway_info'] = json_encode($request->gateway_info);
        }

        if ($request->currency_id) {
            $currency = Currency::where('id', $request->currency_id)->first();

            if ($currency) {
                $existingProviderWallet = ProviderWallet::where('provider_id', $provider->provider_id)
                    ->where('currency', $currency->code)
                    ->first();
                $providerTranstions = Transaction::where('provider_id', $provider->provider_id)->first();
                if (!$existingProviderWallet) {
                    if (!$providerTranstions) {
                        $providerWallet = ProviderWallet::create([
                            'provider_id' => $provider->provider_id,
                            'currency' => $currency->code,
                            'balance' => 0,
                            'status' => 'ACTIVE'
                        ]);
                        $provider->provider_wallet_id = $providerWallet->id;
                        $provider->save();
                    } else {
                        return response()->json([
                            'success' => false,
                            'error' => [
                                'code' => 'PROVIDER_WALLET_ERROR',
                                'message' => 'You are not allowed to change the currency.'
                            ]
                        ], 404);
                    }
                }
            }
        }

        $provider->update($request->only(['name', 'alias', 'channel_name', 'channel_route', 'settlement', 'supported_variants', 'health_status', 'status', 'fee_percentage', 'fixed_amount', 'currency_id', 'type', 'gateway', 'gateway_info']));

        return response()->json([
            'success' => true,
            'message' => 'Provider updated successfully',
            'data' => [
                'provider_id' => $provider->provider_id,
                'name' => $provider->name,
                'alias' => $provider->alias,
                'channel_name' => $provider->channel_name,
                'settlement' => $provider->settlement,
                'channel_route' => $provider->channel_route,
                'supported_variants' => $provider->supported_variants,
                'health_status' => $provider->health_status,
                'status' => $provider->status,
                'response_time' => $provider->response_time,
                'success_rate' => $provider->success_rate,
                'type' => $provider->type,
                'gateway' => $provider->gateway,
                'gateway_info' => json_decode($provider->gateway_info),
                'created_at' => $provider->created_at->toISOString()
            ]
        ]);
    }

    /**
     * Delete provider.
     */
    public function destroy($id)
    {
        $provider = Provider::where('provider_id', $id)->first();

        if (!$provider) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PROVIDER_NOT_FOUND',
                    'message' => 'Provider not found'
                ]
            ], 404);
        }

        ProviderWallet::where('provider_id', $provider->provider_id)->delete();

        $provider->delete();

        return response()->json([
            'success' => true,
            'message' => 'Provider deleted successfully'
        ]);
    }

    /**
     * Get partner's own provider.
     */
    public function getMyProvider(Request $request)
    {
        $validator = Validator::make($request->all(), [
            'page' => 'integer|min:1',
            'limit' => 'integer|min:1|max:100',
            'health_status' => 'string|in:HEALTHY,DEGRADED,DOWN',
            'status' => 'string|in:active,inactive,down',
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
        $user = Auth::user();

        $query = Provider::with('providerWallet', 'userProviderFee')->where('partner_id', $user->partner_id)->orderByDesc('created_at');

        // Enhanced search functionality
        if ($request->has('search') && !empty($request->search)) {
            $searchTerm = $request->search;
            $query->where(function ($q) use ($searchTerm) {
                $q->where('name', 'like', '%' . $searchTerm . '%')
                    ->orWhere('alias', 'like', '%' . $searchTerm . '%')
                    ->orWhereJsonContains('supported_variants', $searchTerm)
                    ->orWhere('health_status', 'like', '%' . $searchTerm . '%');
            });
        }

        $page = $request->get('page', 1);
        $limit = $request->get('limit', 20);

        $providers = $query->paginate($limit, ['*'], 'page', $page);

        $providers->getCollection()->transform(function ($provider) {
            return [
                'provider_id' => $provider->provider_id,
                'partner_id' => $provider->partner_id,
                'name' => $provider->name,
                'alias' => $provider->alias,
                'channel_name' => $provider->channel_name,
                'channel_route' => $provider->channel_route,
                'settlement' => $provider->settlement,
                'supported_variants' => $provider->supported_variants,
                'health_status' => $provider->health_status,
                'status' => $provider->status,
                'response_time' => $provider->response_time,
                'success_rate' => $provider->success_rate,
                'fee_percentage' => $provider->fee_percentage,
                'fixed_amount' => $provider->fixed_amount,
                'currency_id' => $provider->currency_id,
                'type' => $provider->type,
                'gateway' => $provider->gateway,
                'gateway_info' => $provider->gateway_info ? json_decode($provider->gateway_info) : '',
                'currency' => $provider->currency ? [
                    'id' => $provider->currency->id,
                    'code' => $provider->currency->code,
                    'name' => $provider->currency->name,
                    'symbol' => $provider->currency->symbol
                ] : null,
                'partner' => $provider->partner ? [
                    'partner_id' => $provider->partner->partner_id,
                    'name' => $provider->partner->name
                ] : null,
                'created_at' => $provider->created_at->toISOString(),
                'providerWallet' => $provider->providerWallet,
                'userProviderFee' => $provider->userProviderFee,
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'providers' => $providers->items(),
                'pagination' => [
                    'page' => $providers->currentPage(),
                    'limit' => $providers->perPage(),
                    'total' => $providers->total(),
                    'pages' => $providers->lastPage()
                ]
            ]
        ]);
    }

    /**
     * Create or update partner's own provider.
     */
    public function upsertMyProvider(Request $request)
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

        if (!$partner || !$partner->can_create_own_bank) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'FORBIDDEN',
                    'message' => 'Your partner account does not have permission to manage providers'
                ]
            ], 403);
        }

        $validator = Validator::make($request->all(), [
            'name' => 'required|string|max:255',
            'alias' => 'required|string|max:255',
            'channel_name' => 'nullable|string|max:255',
            'settlement' => 'nullable|string|max:255',
            'channel_route' => 'nullable|string|max:255|unique:providers,channel_route',
            'supported_variants' => 'required|array|min:1',
            'supported_variants.*' => 'string',
            'fee_percentage' => 'nullable|numeric|min:0|max:100',
            'fixed_amount' => 'nullable|numeric|min:0',
            'currency_id' => 'nullable|exists:currencies,id'
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

        $existingProvider = Provider::where('partner_id', $user->partner_id)->first();

        if ($existingProvider) {
            // Update existing provider
            $existingProvider->update([
                'name' => $request->name,
                'alias' => $request->alias,
                'channel_name' => $request->channel_name,
                'channel_route' => $request->channel_route,
                'settlement' => $request->settlement,
                'supported_variants' => $request->supported_variants,
                'fee_percentage' => $request->fee_percentage,
                'fixed_amount' => $request->fixed_amount,
                'currency_id' => $request->currency_id,
                'gateway_info' => $request->details,
            ]);

            $provider = $existingProvider;
            $message = 'Provider updated successfully';
        } else {
            // Create new provider
            $provider = Provider::create([
                'provider_id' => Str::uuid(),
                'partner_id' => $user->partner_id,
                'name' => $request->name,
                'alias' => $request->alias,
                'channel_name' => $request->channel_name,
                'channel_route' => $request->channel_route,
                'settlement' => $request->settlement,
                'supported_variants' => $request->supported_variants,
                'health_status' => 'HEALTHY',
                'response_time' => rand(100, 500),
                'success_rate' => rand(9500, 9999) / 100,
                'fee_percentage' => $request->fee_percentage,
                'fixed_amount' => $request->fixed_amount,
                'currency_id' => $request->currency_id,
                'gateway_info' => $request->details,
                'type' => 'PAYIN',
                'gateway' => 'OFFLINE',
            ]);

            $enabledProviders = $partner->enabled_providers ?? [];
            if (!is_array($enabledProviders)) {
                $enabledProviders = json_decode($enabledProviders, true) ?? [];
            }

            $enabledProviders[] = $provider->provider_id;
            $partner->enabled_providers = $enabledProviders;
            $partner->save();
            $message = 'Provider created successfully';
        }

        return response()->json([
            'success' => true,
            'message' => $message,
            'data' => [
                'provider_id' => $provider->provider_id,
                'partner_id' => $provider->partner_id,
                'name' => $provider->name,
                'alias' => $provider->alias,
                'channel_name' => $provider->channel_name,
                'channel_route' => $provider->channel_route,
                'settlement' => $provider->settlement,
                'supported_variants' => $provider->supported_variants,
                'health_status' => $provider->health_status,
                'response_time' => $provider->response_time,
                'success_rate' => $provider->success_rate,
                'fee_percentage' => $provider->fee_percentage,
                'fixed_amount' => $provider->fixed_amount,
                'currency_id' => $provider->currency_id,
                'currency' => $provider->currency ? [
                    'id' => $provider->currency->id,
                    'code' => $provider->currency->code,
                    'name' => $provider->currency->name,
                    'symbol' => $provider->currency->symbol
                ] : null,
                'created_at' => $provider->created_at->toISOString()
            ]
        ], $existingProvider ? 200 : 201);
    }

    public function getProviderCurrencyWallet(Request $request)
    {


        $validator = Validator::make($request->all(), [
            'status' => 'string|in:PENDING,SUCCESS,FAILED,CANCELLED',
            'date_from' => 'date',
            'date_to' => 'date',
            'provider_id' => 'required',
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

        $provider = Provider::with('providerWallet', 'userProviderFee')->where('provider_id', $request->provider_id)->first();

        if (!$provider) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => '-1',
                    'message' => 'Invalid Provider Information'
                ]
            ], 400);
        }



        $query = Transaction::with(['merchant'])->where('provider_id', $provider->provider_id);


        if ($request->has('status')) {
            $query->where('status', $request->status);
        }

        if ($request->has('date_from')) {
            $query->whereDate('created_at', '>=', $request->date_from);
        }

        if ($request->has('date_to')) {
            $query->whereDate('created_at', '<=', $request->date_to);
        }



        $page = $request->get('page', 1);
        $limit = $request->get('limit', 100);

        $transactions = $query->paginate($limit, ['*'], 'page', $page);

        $transactions->getCollection()->transform(function ($transaction) use ($provider) {
            return [
                'txn_id' => $transaction->txn_id,
                'merchant_id' => $transaction->merchant_id,
                'amount' => (float) $transaction->amount,
                'currency' => $transaction->currency,
                'transaction_type' => $transaction->transaction_type,
                'status' => $transaction->status,
                'provider_alias' => $provider->name,
                'estimated_cost' => $transaction->estimated_cost ? (float) $transaction->estimated_cost : null,
                'routing_strategy' => $transaction->routing_strategy,
                'created_at' => $transaction->created_at->toISOString(),
                'processed_at' => $transaction->processed_at?->toISOString(),
            ];
        });

        return response()->json([
            'success' => true,
            'data' => [
                'transactions' => $transactions->items(),
                'providerWallet' => $provider->providerWallet,
                'userProviderFee' => $provider->userProviderFee,
                'pagination' => [
                    'page' => $transactions->currentPage(),
                    'limit' => $transactions->perPage(),
                    'total' => $transactions->total(),
                    'pages' => $transactions->lastPage()
                ]
            ]
        ]);
    }


    public function updateProviderAdjustment(Request $request, $id)
    {
        $provider = Provider::where('provider_id', $id)->first();

        if (!$provider) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PROVIDER_NOT_FOUND',
                    'message' => 'Provider not found'
                ]
            ], 404);
        }

        $providerWallet = ProviderWallet::where('provider_id', $provider->provider_id)->first();

        if (!$providerWallet) {
            return response()->json([
                'success' => false,
                'error' => [
                    'code' => 'PROVIDER_WALLET_NOT_FOUND',
                    'message' => 'Provider Wallet not found'
                ]
            ], 404);
        }

        if ($request->type == 'add') {
            $providerWallet->balance = $providerWallet->balance + $request->amount;
        } elseif ($request->type == 'subtract') {
            $providerWallet->balance = $providerWallet->balance - $request->amount;
        }


        $transaction = Transaction::create([
            'txn_id' => uniqid('txn_'),
            'amount' => $request->amount,
            'adjustment_type' => $request->type,
            'currency' => $providerWallet->currency,
            'channel_type' => 'CARD',
            'transaction_type' => 'ADJUSTMENT',
            'status' => 'SUCCESS',
            'provider_id' => $providerWallet->provider_id,
        ]);


        $providerWallet->save();

        return response()->json([
            'success' => true,
            'message' => 'Provider Adjustment successful'
        ]);
    }
}
