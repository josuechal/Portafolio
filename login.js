(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const ANON = String(cfg.SUPABASE_ANON_KEY || "");
  const SESSION_KEY = "jc_sb_session_v1";
  const MIN_LENGTH = 6;   // debe coincidir con "Minimum password length" en Supabase > Authentication

  const $ = (id) => document.getElementById(id);
  const el = {
    card: $("card"), eyebrow: $("eyebrow"), title: $("title"), subtitle: $("subtitle"),
    form: $("form"), emailWrap: $("emailWrap"), email: $("email"),
    password: $("password"), passwordLabel: $("passwordLabel"), toggle: $("toggle"),
    meterWrap: $("meterWrap"), meter: $("meter"), confirmWrap: $("confirmWrap"), confirm: $("confirm"),
    msg: $("msg"), submit: $("submit"), extra: $("extra"), switchMode: $("switchMode"), forgot: $("forgot"),
    session: $("session"), sessionInfo: $("sessionInfo"), logout: $("logout"), note: $("note"),
    admin: $("admin"), inviteForm: $("inviteForm"), inviteEmail: $("inviteEmail"), adminMsg: $("adminMsg"),
    userList: $("userList"),
  };

  /* ---------- Sesión (sessionStorage: se borra al cerrar la pestaña) ---------- */
  const session = {
    get() {
      try {
        const s = JSON.parse(sessionStorage.getItem(SESSION_KEY));
        return s && s.exp > Date.now() ? s : null;
      } catch { return null; }
    },
    set(v) { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(v)); } catch { /* sin acceso */ } },
    clear() { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* sin acceso */ } },
  };

  /* ---------- Llamadas a Supabase ---------- */
  async function sb(path, { method = "GET", body, token, headers = {} } = {}) {
    const h = { apikey: ANON, Accept: "application/json", ...headers };
    const bearer = token || session.get()?.access_token;
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

  function errorText(r, fallback) {
    if (r.status === 0) return "No se pudo conectar con el servidor.";
    if (r.status === 429) return "Demasiados intentos. Espera unos minutos.";
    const code = String(r.data?.error_code || r.data?.code || "");
    if (code === "invalid_credentials") return "Correo o contraseña incorrectos.";
    if (code === "email_not_confirmed") return "Confirma tu correo primero: revisa tu bandeja de entrada.";
    if (code === "weak_password") return `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`;
    if (code === "same_password") return "La nueva contraseña debe ser distinta a la anterior.";
    if (code === "23505") return "Ese correo ya está en la lista.";
    return fallback;
  }

  const say = (node, text, type = "") => { node.textContent = text; node.dataset.type = type; };

  /* ---------- Fortaleza (solo orienta) ---------- */
  function strength(pw) {
    let s = 0;
    if (pw.length >= MIN_LENGTH) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
    return s;
  }

  /* ---------- Modos: login / signup / reset ---------- */
  let mode = "login";
  let resetToken = null;   // token temporal del enlace de «restablecer contraseña»

  function setMode(next, message = "") {
    mode = next;
    const signup = mode === "signup";
    const reset = mode === "reset";
    const needsConfirm = signup || reset;

    el.eyebrow.textContent = reset ? "Seguridad" : signup ? "Primer acceso" : "Acceso";
    el.title.textContent = reset ? "Nueva contraseña" : signup ? "Crear mi acceso" : "Iniciar sesión";
    el.subtitle.textContent = reset
      ? "Elige tu nueva contraseña."
      : signup ? "Usa el correo que autorizó el administrador y crea tu contraseña."
               : "Solo para correos autorizados.";
    el.submit.textContent = reset ? "Guardar contraseña" : signup ? "Crear acceso" : "Entrar";
    el.switchMode.textContent = signup ? "Ya tengo cuenta" : "Crear mi acceso";
    el.passwordLabel.textContent = needsConfirm ? "Contraseña nueva" : "Contraseña";
    el.password.autocomplete = needsConfirm ? "new-password" : "current-password";

    el.emailWrap.hidden = reset;
    el.email.required = !reset;
    el.confirmWrap.hidden = el.meterWrap.hidden = !needsConfirm;
    el.forgot.hidden = el.forgot.previousElementSibling.hidden = needsConfirm;
    el.switchMode.hidden = reset;
    el.password.value = el.confirm.value = "";
    el.meter.dataset.level = "0";
    say(el.msg, message, message ? "ok" : "");
  }

  /* ---------- Estado: sesión cerrada / abierta ---------- */
  let sessionTimer = null;

  function showLoggedOut(message = "", type = "") {
    session.clear();
    clearTimeout(sessionTimer);
    el.form.hidden = el.extra.hidden = el.note.hidden = false;
    el.session.hidden = el.admin.hidden = true;
    el.card.classList.remove("wide");
    setMode("login");
    if (message) say(el.msg, message, type);
  }

  function showLoggedIn({ email, role, exp }) {
    el.form.hidden = el.extra.hidden = el.note.hidden = true;
    el.session.hidden = false;
    el.eyebrow.textContent = "Bienvenido";
    el.title.textContent = "Sesión iniciada";
    el.subtitle.textContent = "";

    el.sessionInfo.textContent = "";
    const b = document.createElement("b");
    b.textContent = email;
    el.sessionInfo.append("Has ingresado como ", b, role === "admin" ? " (administrador)." : ".");

    const admin = role === "admin";
    el.admin.hidden = !admin;
    el.card.classList.toggle("wide", admin);
    if (admin) loadUsers();

    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => showLoggedOut("Tu sesión expiró. Inicia sesión de nuevo.", "error"), Math.max(exp - Date.now(), 0));
  }

  async function logout() {
    await sb("/auth/v1/logout", { method: "POST" });
    showLoggedOut();
  }

  /* ---------- Formulario principal ---------- */
  el.password.addEventListener("input", () => {
    if (mode === "login") return;
    el.meter.dataset.level = String(el.password.value ? Math.max(strength(el.password.value), 1) : 0);
  });

  el.toggle.addEventListener("click", () => {
    const show = el.password.type === "password";
    el.password.type = show ? "text" : "password";
    el.toggle.textContent = show ? "Ocultar" : "Mostrar";
    el.toggle.setAttribute("aria-pressed", String(show));
    el.toggle.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
  });

  el.switchMode.addEventListener("click", () => setMode(mode === "login" ? "signup" : "login"));

  el.forgot.addEventListener("click", async () => {
    const email = el.email.value.trim().toLowerCase();
    if (!el.email.checkValidity() || !email) return say(el.msg, "Escribe tu correo arriba y vuelve a pulsar.", "error");
    const r = await sb(`/auth/v1/recover?redirect_to=${encodeURIComponent(location.origin + location.pathname)}`, { method: "POST", body: { email } });
    if (r.status === 0 || r.status === 429) return say(el.msg, errorText(r, ""), "error");
    // Mismo mensaje exista o no el correo, para no revelar quién tiene acceso
    say(el.msg, "Si el correo está autorizado, recibirás un enlace para elegir una contraseña nueva.", "ok");
  });

  let busy = false;
  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    const email = el.email.value.trim().toLowerCase();
    const pw = el.password.value;

    if (mode !== "reset" && (!el.email.checkValidity() || !email)) return say(el.msg, "Escribe un correo válido.", "error");
    if (!pw) return say(el.msg, "Escribe tu contraseña.", "error");

    if (mode !== "login") {
      if (pw.length < MIN_LENGTH) return say(el.msg, `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`, "error");
      if (mode === "signup" && pw.toLowerCase().includes(email.split("@")[0])) return say(el.msg, "La contraseña no debe contener tu correo.", "error");
      if (pw !== el.confirm.value) return say(el.msg, "Las contraseñas no coinciden.", "error");
    }

    busy = true;
    el.submit.disabled = true;
    say(el.msg, "Verificando…");
    try {
      if (mode === "login") await doLogin(email, pw);
      else if (mode === "signup") await doSignup(email, pw);
      else await doReset(pw);
    } finally {
      el.password.value = el.confirm.value = "";   // no dejar la contraseña en el campo
      busy = false;
      el.submit.disabled = false;
    }
  });

  async function doLogin(email, pw) {
    const r = await sb("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password: pw }, token: null });
    if (!r.ok || !r.data?.access_token) return say(el.msg, errorText(r, "Correo o contraseña incorrectos."), "error");

    const s = { access_token: r.data.access_token, email, exp: Date.now() + (r.data.expires_in || 3600) * 1000 };
    session.set(s);

    // Aunque la contraseña sea correcta, el correo debe seguir autorizado y activo
    const acc = await sb("/rest/v1/rpc/my_access", { method: "POST", body: {} });
    const role = acc.ok && Array.isArray(acc.data) && acc.data[0]?.role;
    if (!role) {
      await logout();
      return say(el.msg, "Tu acceso no está autorizado o fue desactivado. Habla con el administrador.", "error");
    }
    showLoggedIn({ ...s, role });
  }

  async function doSignup(email, pw) {
    const redirect = encodeURIComponent(location.origin + location.pathname);
    const r = await sb(`/auth/v1/signup?redirect_to=${redirect}`, { method: "POST", body: { email, password: pw }, token: null });
    if (r.ok) {
      setMode("login", "Listo. Revisa tu correo y confirma tu cuenta; después inicia sesión aquí.");
      return;
    }
    say(el.msg, errorText(r, "No se pudo crear el acceso. Verifica que el administrador haya autorizado tu correo."), "error");
  }

  async function doReset(pw) {
    const r = await sb("/auth/v1/user", { method: "PUT", body: { password: pw }, token: resetToken });
    resetToken = null;
    if (!r.ok) return say(el.msg, errorText(r, "El enlace expiró. Pide uno nuevo con «Olvidé mi contraseña»."), "error");
    setMode("login", "Contraseña actualizada. Ya puedes iniciar sesión.");
  }

  el.logout.addEventListener("click", logout);

  /* ---------- Panel del administrador ---------- */
  async function loadUsers() {
    const r = await sb("/rest/v1/allowed_emails?select=email,role,is_active&order=role.asc,email.asc");
    if (r.status === 401) return showLoggedOut("Tu sesión expiró. Inicia sesión de nuevo.", "error");
    if (!r.ok) return say(el.adminMsg, "No se pudo cargar la lista.", "error");
    renderUsers(r.data);
  }

  function statusOf(u) {
    if (u.role === "admin") return ["Admin", "admin"];
    return u.is_active ? ["Activo", "on"] : ["Desactivado", "off"];
  }

  function actionButton(label, onClick, danger = false) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mini" + (danger ? " danger" : "");
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  const byEmail = (email) => `?email=eq.${encodeURIComponent(email)}`;

  function renderUsers(users) {
    el.userList.replaceChildren();
    for (const u of users) {
      const [label, kind] = statusOf(u);
      const li = document.createElement("li");

      const mail = document.createElement("span");
      mail.className = "u-mail";
      mail.textContent = u.email;

      const badge = document.createElement("span");
      badge.className = "badge " + kind;
      badge.textContent = label;

      const actions = document.createElement("div");
      actions.className = "u-actions";

      if (u.role !== "admin") {
        actions.append(
          actionButton("Enviar restablecimiento", async () => {
            const r = await sb("/auth/v1/recover", { method: "POST", body: { email: u.email } });
            say(el.adminMsg, r.ok ? `Se envió un enlace de restablecimiento a ${u.email}.` : errorText(r, "No se pudo enviar el correo."), r.ok ? "ok" : "error");
          }),
          actionButton(u.is_active ? "Desactivar" : "Activar", async () => {
            const r = await sb(`/rest/v1/allowed_emails${byEmail(u.email)}`, { method: "PATCH", body: { is_active: !u.is_active }, headers: { Prefer: "return=minimal" } });
            if (r.ok) loadUsers(); else say(el.adminMsg, errorText(r, "No se pudo actualizar."), "error");
          }),
          actionButton("Eliminar", async () => {
            if (!confirm(`¿Quitar a ${u.email} de la lista de accesos?`)) return;
            const r = await sb(`/rest/v1/allowed_emails${byEmail(u.email)}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
            if (r.ok) loadUsers(); else say(el.adminMsg, errorText(r, "No se pudo eliminar."), "error");
          }, true),
        );
      }

      li.append(mail, badge, actions);
      el.userList.append(li);
    }
  }

  el.inviteForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = el.inviteEmail.value.trim().toLowerCase();
    if (!el.inviteEmail.checkValidity() || !email) return say(el.adminMsg, "Escribe un correo válido.", "error");

    const r = await sb("/rest/v1/allowed_emails", { method: "POST", body: { email, role: "user" }, headers: { Prefer: "return=minimal" } });
    if (r.ok) {
      el.inviteEmail.value = "";
      say(el.adminMsg, `${email} autorizado. Avísale que entre a esta página y pulse «Crear mi acceso».`, "ok");
      loadUsers();
    } else {
      say(el.adminMsg, errorText(r, "No se pudo autorizar el correo."), "error");
    }
  });

  /* ---------- Inicio ---------- */
  // Supabase devuelve al usuario a esta página con datos en la parte «#» de la dirección
  function readHash() {
    const raw = location.hash.replace(/^#/, "");
    if (!raw) return null;
    const p = new URLSearchParams(raw);
    history.replaceState(null, "", location.pathname + location.search);   // no dejar el token en la barra
    return { type: p.get("type"), token: p.get("access_token"), error: p.get("error_description") };
  }

  async function init() {
    if (!BASE || !ANON) {
      el.form.hidden = el.extra.hidden = true;
      el.title.textContent = "No disponible";
      el.subtitle.textContent = "Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en config.js.";
      return;
    }

    const h = readHash();
    if (h?.type === "recovery" && h.token) {
      resetToken = h.token;
      return setMode("reset");
    }
    if (h?.error) return showLoggedOut("El enlace no es válido o expiró. Pide uno nuevo.", "error");
    if (h?.type === "signup" || h?.type === "email") return showLoggedOut("Correo confirmado. Ya puedes iniciar sesión.", "ok");

    const s = session.get();
    if (s) {
      const acc = await sb("/rest/v1/rpc/my_access", { method: "POST", body: {} });
      const role = acc.ok && Array.isArray(acc.data) && acc.data[0]?.role;
      if (role) return showLoggedIn({ ...s, role });
    }
    showLoggedOut();
  }

  init();
})();
