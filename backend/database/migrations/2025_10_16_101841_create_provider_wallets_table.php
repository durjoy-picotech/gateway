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
        Schema::create('provider_wallets', function (Blueprint $table) {
            $table->id();
            $table->string('provider_id');
            $table->decimal('balance', 15, 2)->default(0);
            $table->string('currency')->default('USD');
            $table->enum('status', ['ACTIVE', 'FROZEN', 'SUSPENDED'])->default('ACTIVE');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('provider_wallets');
    }
};
