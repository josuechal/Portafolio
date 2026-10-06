<?php

use App\Http\Controllers\Admin\UserController;
use App\Http\Controllers\AuthController;
use App\Http\Middleware\EnsureAdmin;
use Illuminate\Support\Facades\Route;

// Públicas, con límite de 5 intentos por minuto (por IP)
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
Route::post('/activate', [AuthController::class, 'activate'])->middleware('throttle:5,1');

// Requieren sesión (token de Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/logout', [AuthController::class, 'logout']);

    // Solo el administrador
    Route::middleware([EnsureAdmin::class, 'throttle:60,1'])->prefix('admin')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
        Route::post('/users', [UserController::class, 'store']);
        Route::post('/users/{user}/reset', [UserController::class, 'reset']);
        Route::patch('/users/{user}', [UserController::class, 'update']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
    });
});
