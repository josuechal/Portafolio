<?php

namespace Database\Seeders;

use App\Models\User;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /** Crea (o actualiza) la cuenta de administrador con los datos del archivo .env */
    public function run(): void
    {
        $email = env('ADMIN_EMAIL');
        $password = env('ADMIN_PASSWORD');

        if (! $email || ! $password) {
            $this->command->error('Define ADMIN_EMAIL y ADMIN_PASSWORD en el archivo .env antes de ejecutar el seeder.');

            return;
        }

        User::updateOrCreate(
            ['email' => strtolower($email)],
            ['password' => $password, 'role' => 'admin', 'is_active' => true],
        );

        $this->command->info("Administrador listo: {$email}");
    }
}
