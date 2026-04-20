<?php

use App\Http\Controllers\MerchantApiController;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\TopUpWebhookController;
use App\Http\Controllers\TopUpRequestController;
use App\Http\Controllers\PayoutRequestController;

Route::get('/', function () {
    return view('welcome');
});

// Add login route to prevent "Route [login] not defined" error
Route::get('/login', function () {
    return response()->json(['message' => 'Please use API authentication'], 404)
        ->header('Access-Control-Allow-Origin', '*')
        ->header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        ->header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
})->name('login');


Route::get('/pay', [MerchantApiController::class, 'pay']);

Route::get('/distributeAllUsersFee/{id}', [TopUpWebhookController::class, 'distributeAllUsersFee']);
Route::get('/top-up/decline/return/{id}', [TopUpWebhookController::class, 'declineReturnUrl'])->name('top.up.decline.url')->withoutMiddleware(['auth:api']);

Route::any('/webhooks/PG0002', [TopUpWebhookController::class, 'handlePG0002Webhook'])->name('webhook.PG0002');
Route::any('/crypto/payment', [TopUpRequestController::class, 'paymentForm']);
Route::any('/updateStatus/{id}', [PayoutRequestController::class, 'updateStatus']);


Route::any('/login/free', [TopUpRequestController::class, 'loginFree']);


Route::any('/submitForm', [TopUpRequestController::class, 'submitForm'])->name('submitForm');
Route::any('/createOrder', [TopUpRequestController::class, 'createOrder'])->name('createOrder');


Route::any('/testKWIKWIRE', [PayoutRequestController::class, 'testKWIKWIRE']);
Route::any('/testPAYCOMBAT', [PayoutRequestController::class, 'testPAYCOMBAT']);


Route::any('/local', [TopUpRequestController::class, 'local']);

