<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    private const TOKEN_HOURS = 8;

    /** Inicio de sesión: solo para usuarios autorizados y activados. */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:120'],
            'password' => ['required', 'string', 'max:128'],
        ]);

        $user = User::where('email', Str::lower($data['email']))->first();

        // Se calcula siempre una comprobación, exista o no el usuario, para que el
        // tiempo de respuesta no delate qué correos están autorizados.
        $valid = Hash::check($data['password'], $user?->password ?? Hash::make('relleno'));

        if (! $user || ! $user->password || ! $user->is_active || ! $valid) {
            return response()->json(['message' => 'Correo o contraseña incorrectos.'], 401);
        }

        return $this->issueToken($user);
    }

    /** Activación del primer acceso con el código que entregó el administrador. */
    public function activate(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:120'],
            'code' => ['required', 'string', 'max:16'],
            'password' => ['required', 'string', 'max:128', Password::min(6)],
        ]);

        $user = User::where('email', Str::lower($data['email']))->whereNull('password')->first();

        $valid = $user
            && $user->is_active
            && $user->activation_code_hash
            && $user->activation_expires_at?->isFuture()
            && Hash::check(Str::upper(trim($data['code'])), $user->activation_code_hash);

        if (! $valid) {
            return response()->json(['message' => 'Correo o código no válidos, o el código expiró.'], 422);
        }

        $user->forceFill([
            'password' => $data['password'],
            'activation_code_hash' => null,       // el código ya no se puede reutilizar
            'activation_expires_at' => null,
        ])->save();

        return $this->issueToken($user);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['user' => $this->payload($request->user())]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada.']);
    }

    private function issueToken(User $user): JsonResponse
    {
        $user->tokens()->delete();   // una sola sesión activa por usuario

        $token = $user->createToken('web', ['*'], now()->addHours(self::TOKEN_HOURS))->plainTextToken;

        return response()->json(['token' => $token, 'user' => $this->payload($user)]);
    }

    private function payload(User $user): array
    {
        return ['email' => $user->email, 'role' => $user->role];
    }
}
