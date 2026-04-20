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
        Schema::create('security_settings', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique(); // enforce_2fa, session_timeout, etc.
            $table->string('type')->default('boolean'); // boolean, string, integer, json
            $table->text('value')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_system')->default(false); // system settings vs user configurable
            $table->timestamps();

            $table->index('key');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('security_settings');
    }
};
