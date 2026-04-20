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
        Schema::create('agents', function (Blueprint $table) {
            $table->id();
            $table->string('agent_id')->unique();
            $table->string('partner_id');
            $table->string('parent_agent_id')->nullable();
            $table->string('name');
            $table->string('default_currency')->default('USD');
            $table->boolean('allowed_sub_agents')->default(true);
            $table->enum('status', ['ACTIVE', 'INACTIVE', 'SUSPENDED'])->default('ACTIVE');
            $table->timestamps();

            $table->foreign('partner_id')->references('partner_id')->on('partners');
            // $table->foreign('parent_agent_id')->references('agent_id')->on('agents'); // Commented out for now
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('agents');
    }
};
