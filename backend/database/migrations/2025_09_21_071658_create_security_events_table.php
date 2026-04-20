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
        Schema::create('security_events', function (Blueprint $table) {
            $table->id();
            $table->string('event_type'); // login, logout, failed_login, password_change, etc.
            $table->string('severity')->default('info'); // info, warning, error, critical
            $table->text('description');
            $table->string('user_id')->nullable();
            $table->string('ip_address')->nullable();
            $table->json('metadata')->nullable(); // additional data like user agent, location, etc.
            $table->timestamps();

            $table->index(['event_type', 'created_at']);
            $table->index(['user_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('security_events');
    }
};
