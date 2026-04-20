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
        Schema::create('merchants', function (Blueprint $table) {
            $table->id();
            $table->string('merchant_id')->unique();
            $table->string('agent_id');
            $table->string('name');
            $table->string('default_currency')->default('USD');
            $table->json('enabled_currencies')->nullable();
            $table->text('settlement_terms')->nullable();
            $table->enum('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED'])->default('ACTIVE');
            $table->enum('kyb_status', ['PENDING', 'APPROVED', 'REJECTED'])->default('PENDING');
            $table->text('kyb_review_notes')->nullable();
            $table->timestamps();

            $table->foreign('agent_id')->references('agent_id')->on('agents');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('merchants');
    }
};
