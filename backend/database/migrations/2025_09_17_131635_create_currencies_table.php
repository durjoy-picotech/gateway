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
        Schema::create('currencies', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique(); // ISO 4217 currency code
            $table->string('name');
            $table->string('symbol', 10)->nullable();
            $table->enum('type', ['fiat', 'crypto'])->default('fiat');
            $table->integer('precision')->default(2); // Decimal places
            $table->boolean('enabled')->default(true);
            $table->decimal('exchange_rate', 15, 8)->nullable(); // Rate to base currency
            $table->timestamp('last_updated')->nullable();
            $table->timestamps();

            $table->index(['enabled', 'type']);
            $table->index('last_updated');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('currencies');
    }
};
