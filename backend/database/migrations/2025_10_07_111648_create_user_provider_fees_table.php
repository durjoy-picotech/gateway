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
        Schema::create('user_provider_fees', function (Blueprint $table) {
            $table->id();
            $table->string('user_provider_fees_id')->unique();
            $table->string('partner_id')->nullable();
            $table->string('agent_id')->nullable();
            $table->string('merchant_id')->nullable();
            $table->string('provider_id');
            $table->string('user_type');
            $table->string('fee_percentage');
            $table->string('fixed_amount');
            $table->string('new_fee_percentage')->default(0);
            $table->string('new_fixed_amount')->default(0);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_provider_fees');
    }
};
