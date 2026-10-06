# API de accesos (Laravel + Sanctum)

Estos archivos se copian **sobre un proyecto Laravel nuevo**. No contienen secretos.

## 1. Requisitos
PHP 8.2+ y Composer. En Windows lo más fácil es instalar [Laragon](https://laragon.org/) (trae ambos).

## 2. Crear el proyecto y copiar los archivos
```
composer create-project laravel/laravel api
cd api
php artisan install:api
```
Copia el contenido de esta carpeta `backend/` dentro de `api/`, aceptando reemplazar:
`app/`, `config/cors.php`, `database/` y `routes/api.php`.

## 3. Configurar `.env`
```
APP_ENV=production
APP_DEBUG=false
APP_URL=https://tu-api.ejemplo.com

ADMIN_EMAIL=uti160@atu.gob.pe
ADMIN_PASSWORD=pon-aqui-una-contraseña-larga-y-unica

CORS_ALLOWED_ORIGINS=https://josuechal.github.io,http://127.0.0.1:5500,http://localhost:5500
```
En pruebas locales usa `APP_ENV=local` y `APP_DEBUG=true`.

## 4. Crear tablas y administrador
```
php artisan migrate --seed
```
Después **borra `ADMIN_PASSWORD` del `.env`**: ya quedó guardada cifrada.

## 5. Probar
```
php artisan serve
```
La API queda en `http://127.0.0.1:8000/api`.

## 6. Conectar el sitio
En la raíz del portafolio edita `config.js` (`API_URL`) y la política `Content-Security-Policy`
de `login.html` (`connect-src`) con la misma dirección.

## Publicar la API
Necesita un hosting con PHP y **HTTPS** (hosting compartido con cPanel, un VPS, Railway, Render…).
GitHub Pages usa HTTPS, así que el navegador bloqueará una API en `http://` (salvo `localhost`).

## Cómo funciona
| Acción | Quién | Cómo |
|---|---|---|
| Autorizar un correo | Administrador | `POST /api/admin/users` → devuelve un código de 8 caracteres, una sola vez, válido 48 h |
| Activar el acceso | La persona autorizada | `POST /api/activate` con correo + código + su contraseña |
| Entrar | Usuarios activados | `POST /api/login` (5 intentos por minuto) |
| Restablecer, desactivar, eliminar | Administrador | `/api/admin/users/{id}` |

No existe registro libre: un correo que el administrador no autorizó no puede crear cuenta.
