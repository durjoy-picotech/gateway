<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('top_up_requests', function (Blueprint $table) {
            $table->id();
            $table->string('user_id');
            $table->string('top_up_request_id');
            $table->decimal('amount', 15, 2);
            $table->decimal('total_amount')->default(0);
            $table->string('currency');
            $table->string('partner_id')->nullable();
            $table->string('agent_id')->nullable();
            $table->string('merchant_id')->nullable();
            $table->string('user_type');
            $table->string('payment_method')->nullable();
            $table->string('wallet_id');
            $table->string('provider_id')->nullable();
            $table->string('transaction_id')->nullable();
            $table->enum('payment_status', ['paid', 'unpaid'])->default('unpaid');
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->string('request_for')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('top_up_requests');
    }
};
