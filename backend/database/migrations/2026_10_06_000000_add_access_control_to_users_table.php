<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Un usuario "pendiente" es un correo autorizado que aún no activó su acceso: no tiene contraseña.
            $table->string('name')->nullable()->change();
            $table->string('password')->nullable()->change();

            $table->string('role', 10)->default('user')->after('email');   // admin | user
            $table->boolean('is_active')->default(true)->after('role');
            $table->string('activation_code_hash')->nullable();            // huella del código, nunca el código
            $table->timestamp('activation_expires_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['role', 'is_active', 'activation_code_hash', 'activation_expires_at']);
        });
    }
};
