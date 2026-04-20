<?php

use App\Http\Controllers\MerchantApiController;
use Illuminate\Support\Facades\Route;

Route::get('/balance/V2', [MerchantApiController::class, 'balance']);
Route::post('/pay/V2', [MerchantApiController::class, 'pay']);
Route::post('/defray/V2', [MerchantApiController::class, 'defray']);
Route::post('/defray/queryV2', [MerchantApiController::class, 'query']);
Route::post('/callback', [MerchantApiController::class, 'callback']); // Assuming callback URL




//TODO::Manage Payment Webhook
Route::get('success/return/{trxId?}', [MerchantApiController::class, 'successReturnUrl'])->name('success.url');
Route::any('webhook', [MerchantApiController::class, 'webhookUrl'])->name('webhook.url');
