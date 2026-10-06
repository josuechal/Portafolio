// Dirección de la API de Laravel (sin barra final).
// En tu PC (Live Server / localhost) usa la API local; en la página publicada usa el túnel de Tailscale.
// Si cambias la dirección pública, cámbiala también en `connect-src` de la política CSP de login.html.
const isLocal = ["localhost", "127.0.0.1"].includes(window.location.hostname);

window.APP_CONFIG = {
  API_URL: isLocal
    ? "http://127.0.0.1:8000/api"
    : "https://uti00dk-pp0469.tail817163.ts.net/api",
};
