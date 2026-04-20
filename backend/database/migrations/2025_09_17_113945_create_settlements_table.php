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
        Schema::create('settlements', function (Blueprint $table) {
            $table->id();
            $table->string('settlement_id')->unique();
            $table->string('partner_id');
            $table->string('merchant_id')->nullable();
            $table->date('settlement_date');
            $table->time('cutoff_time');
            $table->decimal('total_amount', 15, 2);
            $table->string('currency');
            $table->enum('status', ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED'])->default('PENDING');
            $table->timestamp('processed_at')->nullable();
            $table->text('failure_reason')->nullable();
            $table->integer('transaction_count')->default(0);
            $table->decimal('fee_amount', 15, 2)->default(0);
            $table->decimal('net_amount', 15, 2);
            $table->json('transaction_ids')->nullable();
            $table->timestamps();

            $table->foreign('partner_id')->references('partner_id')->on('partners');
            $table->foreign('merchant_id')->references('merchant_id')->on('merchants');
            $table->index(['partner_id', 'status']);
            $table->index(['merchant_id', 'status']);
            $table->index(['settlement_date']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settlements');
    }
};
