(() => {
  "use strict";

  const cfg = window.APP_CONFIG || {};
  const BASE = String(cfg.SUPABASE_URL || "").replace(/\/$/, "");
  const ANON = String(cfg.SUPABASE_ANON_KEY || "");
  const SESSION_KEY = "jc_sb_session_v1";

  const $ = (id) => document.getElementById(id);
  const el = {
    card: $("card"), eyebrow: $("eyebrow"), title: $("title"), subtitle: $("subtitle"),
    form: $("form"), email: $("email"), password: $("password"), toggle: $("toggle"),
    msg: $("msg"), submit: $("submit"), note: $("note"),
    session: $("session"), sessionInfo: $("sessionInfo"), logout: $("logout"),
    admin: $("admin"), inviteForm: $("inviteForm"), inviteEmail: $("inviteEmail"), inviteBtn: $("inviteBtn"),
    adminMsg: $("adminMsg"), codeBox: $("codeBox"), codeFor: $("codeFor"), codeValue: $("codeValue"),
    codeCopy: $("codeCopy"), userList: $("userList"),
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

  // Acciones del administrador (crear, renovar código, activar/desactivar, eliminar)
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

  /* ---------- Estado: sesión cerrada / abierta ---------- */
  let sessionTimer = null;

  function showLoggedOut(message = "", type = "") {
    session.clear();
    clearTimeout(sessionTimer);
    el.form.hidden = el.note.hidden = false;
    el.session.hidden = el.admin.hidden = el.codeBox.hidden = true;
    el.card.classList.remove("wide");
    el.eyebrow.textContent = "Acceso";
    el.title.textContent = "Iniciar sesión";
    el.subtitle.textContent = "Ingresa con tu correo y tu código de acceso.";
    el.password.value = "";
    say(el.msg, message, type);
  }

  function showLoggedIn({ email, role, exp }) {
    el.form.hidden = el.note.hidden = true;
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

  async function accessRole() {
    const acc = await sb("/rest/v1/rpc/my_access", { method: "POST", body: {} });
    return acc.ok && Array.isArray(acc.data) && acc.data[0]?.role;
  }

  /* ---------- Inicio de sesión ---------- */
  el.toggle.addEventListener("click", () => {
    const show = el.password.type === "password";
    el.password.type = show ? "text" : "password";
    el.toggle.textContent = show ? "Ocultar" : "Mostrar";
    el.toggle.setAttribute("aria-pressed", String(show));
    el.toggle.setAttribute("aria-label", show ? "Ocultar" : "Mostrar");
  });

  let busy = false;
  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    const email = el.email.value.trim().toLowerCase();
    const pw = el.password.value.trim();
    if (!el.email.checkValidity() || !email || !pw) return say(el.msg, "Escribe tu correo y tu código de acceso.", "error");

    busy = true;
    el.submit.disabled = true;
    say(el.msg, "Verificando…");
    try {
      const r = await sb("/auth/v1/token?grant_type=password", { method: "POST", body: { email, password: pw } });
      if (!r.ok || !r.data?.access_token) return say(el.msg, errorText(r, "Correo o código incorrectos."), "error");

      const s = { access_token: r.data.access_token, email, exp: Date.now() + (r.data.expires_in || 3600) * 1000 };
      session.set(s);

      // Aunque el código sea correcto, el correo debe seguir autorizado y activo
      const role = await accessRole();
      if (!role) {
        await logout();
        return say(el.msg, "Tu acceso no está autorizado o fue desactivado. Habla con el administrador.", "error");
      }
      showLoggedIn({ ...s, role });
    } finally {
      el.password.value = "";   // no dejar el código en el campo
      busy = false;
      el.submit.disabled = false;
    }
  });

  el.logout.addEventListener("click", logout);

  /* ---------- Panel del administrador ---------- */
  function showCode(email, code) {
    el.codeFor.textContent = email;
    el.codeValue.textContent = code;
    el.codeBox.hidden = false;
  }

  el.codeCopy.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(el.codeValue.textContent);
      el.codeCopy.textContent = "Copiado";
      setTimeout(() => { el.codeCopy.textContent = "Copiar"; }, 1500);
    } catch { /* se puede copiar a mano */ }
  });

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

  async function run(request, okMessage, fallback) {
    const r = await request();
    if (r.ok) {
      say(el.adminMsg, okMessage, okMessage ? "ok" : "");
      loadUsers();
    } else {
      say(el.adminMsg, errorText(r, fallback), "error");
    }
    return r;
  }

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
          actionButton("Nuevo código", async () => {
            if (!confirm(`Se anulará el código anterior de ${u.email} y se generará uno nuevo. ¿Continuar?`)) return;
            const r = await run(() => manage("reset", u.email), "", "No se pudo generar el código.");
            if (r.ok) showCode(u.email, r.data.code);
          }),
          actionButton(u.is_active ? "Desactivar" : "Activar", () =>
            run(() => manage("set_active", u.email, { active: !u.is_active }), "", "No se pudo actualizar.")),
          actionButton("Eliminar", () => {
            if (!confirm(`¿Eliminar el acceso de ${u.email}? Se borrará su cuenta.`)) return;
            return run(() => manage("delete", u.email), "", "No se pudo eliminar.");
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

    el.inviteBtn.disabled = true;
    try {
      const r = await run(() => manage("create", email), `${email} autorizado. Entrégale el código de abajo.`, "No se pudo autorizar el correo.");
      if (r.ok) { el.inviteEmail.value = ""; showCode(email, r.data.code); }
    } finally {
      el.inviteBtn.disabled = false;
    }
  });

  /* ---------- Inicio ---------- */
  async function init() {
    if (!BASE || !ANON) {
      el.form.hidden = true;
      el.title.textContent = "No disponible";
      el.subtitle.textContent = "Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en config.js.";
      return;
    }
    const s = session.get();
    if (s) {
      const role = await accessRole();
      if (role) return showLoggedIn({ ...s, role });
    }
    showLoggedOut();
  }

  init();
})();
