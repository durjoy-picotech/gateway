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
        // Add EXCHANGE to the enum values for transaction_type
        DB::statement("ALTER TABLE transactions MODIFY COLUMN transaction_type ENUM('PAY_IN', 'PAY_OUT', 'TOP_UP', 'SETTLEMENT', 'ADJUSTMENT', 'REFUND', 'EXCHANGE')");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove EXCHANGE from the enum values for transaction_type
        DB::statement("ALTER TABLE transactions MODIFY COLUMN transaction_type ENUM('PAY_IN', 'PAY_OUT', 'TOP_UP', 'SETTLEMENT', 'ADJUSTMENT', 'REFUND')");
    }
};
