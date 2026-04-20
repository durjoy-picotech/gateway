<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\PartnerController;
use App\Http\Controllers\AgentController;
use App\Http\Controllers\MerchantController;
use App\Http\Controllers\TransactionController;
use App\Http\Controllers\SettlementController;
use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\NotificationController;
use App\Http\Controllers\CurrencyController;
use App\Http\Controllers\WalletController;
use App\Http\Controllers\ProviderController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\SecurityController;
use App\Http\Controllers\PayoutRequestController;
use App\Http\Controllers\TopUpRequestController;
use App\Http\Controllers\TopUpWebhookController;
use App\Http\Controllers\SettingsController;
use App\Http\Controllers\TransferController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/user', function (Request $request) {
    return $request->user();
})->middleware('auth:sanctum');


Route::get('application/settings', [UserController::class, 'appSettings']);


// Authentication routes
Route::prefix('auth')->group(function () {
    Route::post('login', [AuthController::class, 'login']);
    Route::post('refresh', [AuthController::class, 'refresh']);
    Route::middleware(['auth:api', 'check2FA'])->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('profile', [AuthController::class, 'profile']);
        Route::put('profile', [AuthController::class, 'updateProfile']);
        Route::put('change-password', [AuthController::class, 'changePassword']);
        Route::delete('account', [AuthController::class, 'deleteAccount']);
    });
});

// User management routes
Route::middleware(['auth:api', 'check2FA'])->group(function () {
    Route::get('users/settings', [UserController::class, 'getSettings']);
    Route::put('users/settings', [UserController::class, 'updateSettings']);
    Route::post('/users/settings/app', [UserController::class, 'updateAppSettings']);
    Route::apiResource('users', UserController::class);
});

// Partner management routes
Route::middleware(['auth:api', 'check2FA'])->group(function () {
    Route::apiResource('partners', PartnerController::class);
    Route::get('partner/me', [PartnerController::class, 'getMyPartner']);
});

// Agent management routes
Route::middleware(['auth:api', 'check2FA'])->group(function () {
    Route::apiResource('agents', AgentController::class);
});

// Merchant management routes
Route::middleware(['auth:api', 'check2FA'])->group(function () {
    Route::apiResource('merchants', MerchantController::class);
    Route::get('merchant/key', [MerchantController::class, 'generateApiKey']);
});

// Transaction processing routes
Route::middleware(['auth:api'])->group(function () {
    Route::apiResource('transactions', TransactionController::class)->only(['index', 'show']);
});

// Wallet routes
Route::middleware(['auth:api', 'check2FA'])->group(function () {
    Route::get('wallet/balance', [WalletController::class, 'getBalance']);
    Route::get('wallet/wallets', [WalletController::class, 'getWallets']);
    Route::get('wallet/available-currencies', [WalletController::class, 'getAvailableCurrencies']);
    Route::post('wallet/exchange', [WalletController::class, 'exchange']);
    Route::post('wallet/topup', [WalletController::class, 'topup']);
});

Route::get('wallets-by-user', [WalletController::class, 'getAllWalletsByusers'])->middleware('auth:api');

// Admin wallet routes (SUPER_ADMIN only)
Route::middleware('auth:api')->group(function () {
    Route::get('admin/wallets', [WalletController::class, 'getAllWallets']);
    Route::get('admin/wallets/{walletId}', [WalletController::class, 'getWalletDetails']);

    // SUPER_ADMIN only routes
    Route::middleware('super_admin')->group(function () {
        Route::get('admin/wallets', [WalletController::class, 'getAllWallets']);
        Route::get('admin/wallets/{walletId}', [WalletController::class, 'getWalletDetails']);
    });
});

// Settlement management routes
Route::middleware('auth:api')->group(function () {
    Route::apiResource('settlements', SettlementController::class)->only(['index', 'show', 'store']);
    Route::put('settlements/{id}/status', [SettlementController::class, 'updateStatus']);
});

Route::middleware('auth:api')->group(function () {
    Route::apiResource('transfers', TransferController::class)->only(['index', 'store']);
    // Route::apiResource('requests', TransferController::class)->only(['requestIndex', 'requestStore']);

    Route::get('requests', [TransferController::class, 'requestIndex']);
    Route::post('requests', [TransferController::class, 'requestStore']);
    Route::post('requests/{id}/accept', [TransferController::class, 'acceptRequest']);
    Route::post('requests/{id}/reject', [TransferController::class, 'rejectRequest']);


    Route::get('/banks', [TransferController::class, 'bankIndex']);
    Route::post('/banks', [TransferController::class, 'bankstore']);

    Route::post('/wallet-to-bank', [TransferController::class, 'walletToBank']);
    Route::post('/bank-to-bank', [TransferController::class, 'bankToBank']);
    Route::post('/wallet-to-walletToMySelf', [TransferController::class, 'walletToMySelf']);
});



// Analytics & reporting routes
Route::middleware('auth:api')->group(function () {
    Route::get('analytics/dashboard', [AnalyticsController::class, 'dashboard']);
    Route::get('analytics/export', [AnalyticsController::class, 'export']);
    Route::get('dashboard', [AnalyticsController::class, 'getDashboard']);
});

// Reports routes
Route::middleware('auth:api')->group(function () {
    Route::get('reports', [ReportController::class, 'index']);
    Route::post('reports/generate', [ReportController::class, 'generate']);
    Route::get('reports/{id}/download', [ReportController::class, 'download']);
    Route::delete('reports/{id}', [ReportController::class, 'delete']);
});

// Notifications routes
Route::middleware(['auth:api', 'check2FA'])->group(function () {
    Route::get('notifications', [NotificationController::class, 'index']);
    Route::put('notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::put('notifications/read-all', [NotificationController::class, 'markAllAsRead']);
    Route::delete('notifications/{id}', [NotificationController::class, 'destroy']);
});


// Currency & FX management routes
Route::middleware('auth:api')->group(function () {
    Route::apiResource('currencies', CurrencyController::class)->only(['index', 'store', 'update']);
    Route::delete('currencies/{code}', [CurrencyController::class, 'destroy']);
    Route::put('currencies/{code}/enable', [CurrencyController::class, 'toggleEnabled']);
    Route::get('fx/rates', [CurrencyController::class, 'getFxRates']);
    Route::post('fx/rates/refresh', [CurrencyController::class, 'refreshFxRates']);
    Route::get('fx/fetch-rate', [CurrencyController::class, 'fetchExchangeRate']);
    Route::post('fx/convert', [CurrencyController::class, 'convertCurrency']);
    Route::put('currency/fx/update', [CurrencyController::class, 'updateCurrencyFx']);
});


// Provider management routes
Route::middleware('auth:api')->group(function () {
    Route::apiResource('providers', ProviderController::class);

    // Partner provider management routes
    Route::get('partner/providers', [ProviderController::class, 'getMyProvider']);
    Route::post('partner/providers', [ProviderController::class, 'upsertMyProvider']);

    //Provider Transactions
    Route::get('provider/transaction', [ProviderController::class, 'getProviderCurrencyWallet']);

    Route::put('providers/{id}/adjustment', [ProviderController::class, 'updateProviderAdjustment']);
});


Route::get('security/settings', [SecurityController::class, 'getSecuritySettings']);

// Security management routes
Route::middleware(['auth:api'])->group(function () {
    // Security Overview
    Route::get('security/overview', [SecurityController::class, 'getSecurityOverview']);

    // Security Events
    Route::get('security/events', [SecurityController::class, 'getSecurityEvents']);

    // 2FA Management
    Route::post('security/2fa/generate', [SecurityController::class, 'generate2FA']);
    Route::post('security/2fa/enable', [SecurityController::class, 'enable2FA']);
    Route::post('security/2fa/disable', [SecurityController::class, 'disable2FA']);
    Route::post('security/recovery-codes', [SecurityController::class, 'recoveryCodes']);

    // Security Settings
    Route::put('security/settings/{key}', [SecurityController::class, 'updateSecuritySetting']);
    Route::put('security/recover-email/{key}', [SecurityController::class, 'updateRecoveryEmail']);
});

Route::middleware('auth:api')->group(function () {
    // User
    Route::post('/payouts', [PayoutRequestController::class, 'store']);
    Route::get('/payouts', [PayoutRequestController::class, 'index']);

    Route::put('/payouts/{id}', [PayoutRequestController::class, 'updateStatus']);

    Route::get('/revenues', [TransactionController::class, 'revenue'])->withoutMiddleware(['auth:api']);
    Route::get('/exchanges', [TransactionController::class, 'exchanges'])->withoutMiddleware(['auth:api']);
    Route::get('/revenue-by-wallet', [TransactionController::class, 'revenueByWallet'])->withoutMiddleware(['auth:api']);

    // Public payment routes
    Route::get('payment/{txnId}', [TransactionController::class, 'getPaymentData'])->withoutMiddleware(['auth:api']);

    Route::post('payment/{txnId}/process', [TransactionController::class, 'processPayment'])->withoutMiddleware(['auth:api']);

    Route::get('/top-up/request', [TopUpRequestController::class, 'index'])->withoutMiddleware(['auth:api']);
    Route::get('/partner/top-up/request', [TopUpRequestController::class, 'indexPartner'])->withoutMiddleware(['auth:api']);
    Route::put('/top-up/{id}', [TopUpRequestController::class, 'updateStatus'])->withoutMiddleware(['auth:api']);
    Route::get('/top-up/process', [TopUpRequestController::class, 'payNow'])->withoutMiddleware(['auth:api']);
    Route::post('/top-up/request', [TopUpRequestController::class, 'topup'])->withoutMiddleware(['auth:api']);
    Route::post('/top-up/payment', [TopUpRequestController::class, 'payment'])->withoutMiddleware(['auth:api']);
});

Route::get('/top-up/success/return', [TopUpWebhookController::class, 'successReturnUrl'])->name('top.up.success.url')->withoutMiddleware(['auth:api']);
Route::any('/top-up/webhook/return', [TopUpWebhookController::class, 'webhookUrl'])->name('top.up.webhook.url')->withoutMiddleware(['auth:api']);


Route::post('/smtp/settings', [SettingsController::class, 'updateSMTP'])->withoutMiddleware(['auth:api']);
Route::get('/settings', [SettingsController::class, 'settings'])->withoutMiddleware(['auth:api']);

Route::post('/update/template', [SettingsController::class, 'updateTemplate'])->withoutMiddleware(['auth:api']);
// Route::post('/profile/update', [SettingsController::class, 'updateProfile'])->withoutMiddleware(['auth:api']);



Route::any('/createOrder', [TopUpRequestController::class, 'createOrder'])->name('createOrder');
Route::any('/paymentForm', [TopUpRequestController::class, 'paymentForm']);
