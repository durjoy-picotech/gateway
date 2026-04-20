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
            $table->string('total_fee')->nullable();
            $table->text('fee_details')->nullable();
            $table->text('wallet_balance')->nullable();
        });

    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {

        Schema::table('transactions', function (Blueprint $table) {
            $table->dropColumn('total_fee');
            $table->dropColumn('fee_details');
            $table->dropColumn('wallet_balance');
        });

    }
};
