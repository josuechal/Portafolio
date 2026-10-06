// Núcleo compartido: configuración, sesión y llamadas a Supabase.
// Lo usan el login, el panel y las páginas públicas (visitas y comentarios).
(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const ANON = String(cfg.SUPABASE_ANON_KEY || "");
  const SESSION_KEY = "jc_sb_session_v1";

  /* Sesión: sessionStorage, se borra al cerrar la pestaña */
  const session = {
    get() {
      try {
        const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        return s && s.exp > Date.now() ? s : null;
      } catch { return null; }
    },
    set(value) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch { /* sin acceso */ } },
    clear() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* sin acceso */ } },
  };

  /* Llamada genérica a Supabase. Nunca lanza error: devuelve { ok, status, data } */
  async function sb(path, { method = "GET", body, headers = {} } = {}) {
    const h = { apikey: ANON, Accept: "application/json", ...headers };
    const bearer = session.get()?.access_token;
    if (bearer) h.Authorization = `Bearer ${bearer}`;
    if (body !== undefined) h["Content-Type"] = "application/json";

    let res;
    try {
      res = await fetch(BASE + path, { method, headers: h, body: body !== undefined ? JSON.stringify(body) : undefined });
    } catch {
      return { ok: false, status: 0, data: null };
    }
    let data = null;
    try { data = await res.json(); } catch { /* sin cuerpo JSON */ }
    return { ok: res.ok, status: res.status, data };
  }

  /* Acciones del administrador sobre los accesos (crear, nuevo código, activar/desactivar, eliminar) */
  const manage = (action, email, extra = {}) =>
    sb("/functions/v1/manage-access", { method: "POST", body: { action, email, ...extra } });

  function errorText(r, fallback) {
    if (r.status === 0) return "No se pudo conectar con el servidor.";
    if (r.status === 429) return "Demasiados intentos. Espera unos minutos.";
    if (typeof r.data?.error === "string") return r.data.error;
    const code = String(r.data?.error_code || r.data?.code || "");
    if (code === "invalid_credentials") return "Correo o código incorrectos.";
    if (code === "user_banned") return "Tu acceso fue desactivado. Habla con el administrador.";
    return fallback;
  }

  const say = (node, text, type = "") => { node.textContent = text; node.dataset.type = type; };

  /* Rol del usuario con sesión si su correo sigue autorizado y activo (o false) */
  async function accessRole() {
    const r = await sb("/rest/v1/rpc/my_access", { method: "POST", body: {} });
    return r.ok && Array.isArray(r.data) && r.data[0]?.role;
  }

  async function signOut() {
    await sb("/auth/v1/logout", { method: "POST" });
    session.clear();
  }

  window.JC = Object.freeze({ configured: Boolean(BASE && ANON), session, sb, manage, errorText, say, accessRole, signOut });
})();
