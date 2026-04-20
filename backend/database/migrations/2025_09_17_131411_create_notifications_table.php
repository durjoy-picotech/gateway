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
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->string('notification_id')->unique();
            $table->string('user_id'); // Reference to user_id in users table
            $table->string('type'); // e.g., 'transaction_success', 'settlement_ready', 'low_balance'
            $table->string('title');
            $table->text('message');
            $table->json('data')->nullable(); // Additional notification data
            $table->boolean('read')->default(false);
            $table->timestamp('read_at')->nullable();
            $table->timestamp('sent_at')->nullable();
            $table->enum('delivery_status', ['PENDING', 'SENT', 'DELIVERED', 'FAILED'])->default('PENDING');
            $table->integer('delivery_attempts')->default(0);
            $table->json('channels')->nullable(); // ['EMAIL', 'SMS', 'WEBHOOK', 'IN_APP']
            $table->enum('priority', ['LOW', 'NORMAL', 'HIGH', 'URGENT'])->default('NORMAL');
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'read']);
            $table->index(['type', 'created_at']);
            $table->index(['delivery_status', 'sent_at']);
            $table->index('expires_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
