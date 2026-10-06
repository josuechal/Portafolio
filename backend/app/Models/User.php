<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    use HasApiTokens, HasFactory, Notifiable;

    protected $fillable = ['email', 'password', 'role', 'is_active'];

    protected $hidden = ['password', 'remember_token', 'activation_code_hash'];

    protected function casts(): array
    {
        return [
            'password' => 'hashed',               // Laravel cifra la contraseña (bcrypt) al guardarla
            'is_active' => 'boolean',
            'activation_expires_at' => 'datetime',
        ];
    }

    public function isAdmin(): bool
    {
        return $this->role === 'admin';
    }

    public function isPending(): bool
    {
        return $this->password === null;
    }

    /**
     * Genera un código de un solo uso (8 caracteres, sin letras confusas) válido 48 h.
     * Se guarda solo su huella; el código en claro se devuelve una única vez al administrador.
     */
    public function issueActivationCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $code = '';
        for ($i = 0; $i < 8; $i++) {
            $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
        }

        $this->forceFill([
            'activation_code_hash' => Hash::make($code),
            'activation_expires_at' => now()->addHours(48),
        ])->save();

        return $code;
    }
}
