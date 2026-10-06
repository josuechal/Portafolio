<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/** Gestión de accesos. Solo el administrador (ver EnsureAdmin). */
class UserController extends Controller
{
    public function index(): JsonResponse
    {
        $users = User::orderBy('role')->orderBy('email')->get()->map(fn (User $u) => $this->row($u));

        return response()->json(['data' => $users]);
    }

    /** Autoriza un correo nuevo. Devuelve el código de activación una sola vez. */
    public function store(Request $request): JsonResponse
    {
        $request->merge(['email' => Str::lower(trim((string) $request->input('email')))]);

        $data = $request->validate([
            'email' => ['required', 'email', 'max:120', 'unique:users,email'],
        ], [
            'email.unique' => 'Ese correo ya está autorizado.',
        ]);

        $user = User::create(['email' => $data['email'], 'role' => 'user', 'is_active' => true]);

        return response()->json(['user' => $this->row($user), 'code' => $user->issueActivationCode()], 201);
    }

    /** Restablece el acceso: borra la contraseña, cierra sesiones y genera un código nuevo. */
    public function reset(User $user): JsonResponse
    {
        $this->guardAdmin($user);

        $user->forceFill(['password' => null])->save();
        $user->tokens()->delete();

        return response()->json(['user' => $this->row($user), 'code' => $user->issueActivationCode()]);
    }

    /** Activa o desactiva a un usuario. */
    public function update(Request $request, User $user): JsonResponse
    {
        $this->guardAdmin($user);

        $data = $request->validate(['is_active' => ['required', 'boolean']]);

        $user->update(['is_active' => $data['is_active']]);
        if (! $user->is_active) {
            $user->tokens()->delete();   // lo expulsa de inmediato
        }

        return response()->json(['user' => $this->row($user)]);
    }

    public function destroy(User $user): JsonResponse
    {
        $this->guardAdmin($user);

        $user->tokens()->delete();
        $user->delete();

        return response()->json(['message' => 'Acceso eliminado.']);
    }

    private function guardAdmin(User $user): void
    {
        abort_if($user->isAdmin(), 403, 'No se puede modificar al administrador.');
    }

    private function row(User $u): array
    {
        return [
            'id' => $u->id,
            'email' => $u->email,
            'role' => $u->role,
            'is_active' => $u->is_active,
            'pending' => $u->isPending(),
        ];
    }
}
