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
        Schema::create('partners', function (Blueprint $table) {
            $table->id();
            $table->string('partner_id')->unique();
            $table->string('name');
            $table->string('domain_branding')->nullable();
            $table->string('default_currency')->default('USD');
            $table->json('enabled_currencies')->nullable();
            $table->json('settlement_policy')->nullable();
            $table->json('reserve_policy')->nullable();
            $table->boolean('kyc_policy')->default(false);
            $table->enum('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED'])->default('ACTIVE');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('partners');
    }
};
