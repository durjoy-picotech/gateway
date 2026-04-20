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
        Schema::create('providers', function (Blueprint $table) {
            $table->id();
            $table->string('provider_id')->unique();
            $table->string('name');
            $table->string('alias')->unique();
            $table->json('supported_variants'); // Store as JSON array
            $table->enum('health_status', ['HEALTHY', 'DEGRADED', 'DOWN'])->default('HEALTHY');
            $table->integer('response_time')->default(0); // in milliseconds
            $table->decimal('success_rate', 5, 2)->default(0.00); // percentage with 2 decimal places
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('providers');
    }
};
