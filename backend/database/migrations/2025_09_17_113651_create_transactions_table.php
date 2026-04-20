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
        Schema::create('transactions', function (Blueprint $table) {
            $table->id();
            $table->string('txn_id')->unique();
            $table->string('merchant_id');
            $table->decimal('amount', 15, 2);
            $table->string('currency');
            $table->enum('channel_type', ['CARD', 'BANK_TRANSFER', 'EWALLET', 'QR', 'CRYPTO']);
            $table->enum('transaction_type', ['PAYMENT', 'PAYOUT']);
            $table->string('customer_email')->nullable();
            $table->enum('status', ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'])->default('PENDING');
            $table->string('provider_alias')->nullable();
            $table->decimal('fx_rate', 10, 6)->nullable();
            $table->json('fee_breakdown')->nullable();
            $table->decimal('estimated_cost', 15, 2)->nullable();
            $table->string('routing_strategy')->nullable();
            $table->string('routing_reason')->nullable();
            $table->json('metadata')->nullable();
            $table->json('recipient_details')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->timestamps();

            $table->foreign('merchant_id')->references('merchant_id')->on('merchants');
            $table->index(['merchant_id', 'status']);
            $table->index(['channel_type', 'status']);
            $table->index(['created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('transactions');
    }
};
