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
        Schema::table('user_provider_fees', function (Blueprint $table) {
            $table->string('add_fee_percentage')->default(0);
            $table->string('add_fixed_amount')->default(0);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('user_provider_fees', function (Blueprint $table) {
            $table->dropColumn(['add_fee_percentage', 'add_fixed_amount']);
        });
    }
};
