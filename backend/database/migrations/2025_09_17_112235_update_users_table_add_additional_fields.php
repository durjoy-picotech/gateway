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
        Schema::table('users', function (Blueprint $table) {
            $table->string('user_id')->unique()->after('id');
            $table->enum('role', ['SUPER_ADMIN', 'PARTNER', 'AGENT', 'MERCHANT'])->after('user_id');
            $table->string('phone')->nullable()->after('email');
            $table->string('timezone')->default('UTC')->after('phone');
            $table->boolean('two_factor_enabled')->default(false)->after('timezone');
            $table->string('partner_id')->nullable()->after('two_factor_enabled');
            $table->string('agent_id')->nullable()->after('partner_id');
            $table->timestamp('email_verified_at')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['user_id', 'role', 'phone', 'timezone', 'two_factor_enabled', 'partner_id', 'agent_id']);
            $table->timestamp('email_verified_at')->nullable(false)->change();
        });
    }
};
