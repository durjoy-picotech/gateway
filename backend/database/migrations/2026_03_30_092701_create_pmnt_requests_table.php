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
        Schema::create('pmnt_requests', function (Blueprint $table) {
            $table->id();

            $table->string('sender_id');
            $table->string('receiver_id');

            $table->string('currency');
            $table->decimal('amount', 15, 2);
            $table->enum('status', ['pending', 'accepted', 'rejected'])->default('pending');

            $table->timestamps();

            
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('pmnt_requests');
    }
};
