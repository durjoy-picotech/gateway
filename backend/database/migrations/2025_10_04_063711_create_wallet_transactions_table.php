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
        Schema::create('wallet_transactions', function (Blueprint $table) {
            $table->id();
            $table->string('transaction_id')->unique();
            $table->string('user_id');
            $table->unsignedBigInteger('from_wallet_id');
            $table->unsignedBigInteger('to_wallet_id');
            $table->string('from_currency');
            $table->string('to_currency');
            $table->decimal('from_amount', 15, 2);
            $table->decimal('to_amount', 15, 2);
            $table->decimal('exchange_rate', 10, 6);
            $table->decimal('markup_rate', 10, 6)->nullable();
            $table->decimal('fee', 15, 2)->default(0);
            $table->enum('status', ['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED'])->default('PENDING');
            $table->text('notes')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('processed_at')->nullable();
            $table->timestamps();

            $table->foreign('user_id')->references('user_id')->on('users')->onDelete('cascade');
            $table->foreign('from_wallet_id')->references('id')->on('wallets')->onDelete('cascade');
            $table->foreign('to_wallet_id')->references('id')->on('wallets')->onDelete('cascade');

            $table->index(['user_id', 'status']);
            $table->index(['from_currency', 'to_currency']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('wallet_transactions');
    }
};
