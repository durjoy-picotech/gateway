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
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn('transaction_type');
            $table->enum('transaction_type', ['PAY_IN', 'PAY_OUT', 'TOP_UP', 'SETTLEMENT', 'ADJUSTMENT', 'REFUND']);
            $table->string('token_id')->nullable();
            $table->string('reference_id')->nullable();
            $table->timestamp('completed_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn(['token_id', 'reference_id', 'completed_at']);
            $table->dropColumn('transaction_type');
            $table->enum('transaction_type', ['PAYMENT', 'PAYOUT']);
        });
    }
};
