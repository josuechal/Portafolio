(() => {
  "use strict";

  const API = String((window.APP_CONFIG && window.APP_CONFIG.API_URL) || "").replace(/\/$/, "");
  const TOKEN_KEY = "jc_token_v2";
  const MIN_LENGTH = 6;   // largo mínimo de la contraseña (el servidor valida lo mismo)

  const $ = (id) => document.getElementById(id);
  const el = {
    card: $("card"), eyebrow: $("eyebrow"), title: $("title"), subtitle: $("subtitle"),
    form: $("form"), email: $("email"), code: $("code"), codeWrap: $("codeWrap"),
    password: $("password"), passwordLabel: $("passwordLabel"), toggle: $("toggle"),
    meterWrap: $("meterWrap"), meter: $("meter"), confirmWrap: $("confirmWrap"), confirm: $("confirm"),
    msg: $("msg"), submit: $("submit"), extra: $("extra"), switchMode: $("switchMode"),
    session: $("session"), sessionInfo: $("sessionInfo"), logout: $("logout"), note: $("note"),
    admin: $("admin"), inviteForm: $("inviteForm"), inviteEmail: $("inviteEmail"), adminMsg: $("adminMsg"),
    codeBox: $("codeBox"), codeFor: $("codeFor"), codeValue: $("codeValue"), codeCopy: $("codeCopy"),
    userList: $("userList"),
  };

  /* ---------- Token (sessionStorage: se borra al cerrar la pestaña) ---------- */
  const token = {
    get() { try { return sessionStorage.getItem(TOKEN_KEY); } catch { return null; } },
    set(v) { try { sessionStorage.setItem(TOKEN_KEY, v); } catch { /* sin acceso */ } },
    clear() { try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* sin acceso */ } },
  };

  /* ---------- Llamadas a la API ---------- */
  async function api(path, { method = "GET", body } = {}) {
    const headers = { Accept: "application/json" };
    if (body) headers["Content-Type"] = "application/json";
    const t = token.get();
    if (t) headers.Authorization = `Bearer ${t}`;

    let res;
    try {
      res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
    } catch {
      return { ok: false, status: 0, data: null };
    }
    let data = null;
    try { data = await res.json(); } catch { /* sin cuerpo JSON */ }
    return { ok: res.ok, status: res.status, data };
  }

  function errorText(r, fallback) {
    if (r.status === 0) return "No se pudo conectar con el servidor.";
    if (r.status === 429) return "Demasiados intentos. Espera un minuto.";
    if (r.status === 401 || r.status === 403) return r.data?.message || fallback;
    if (r.status === 422) {
      const first = r.data?.errors && Object.values(r.data.errors)[0];
      return (Array.isArray(first) ? first[0] : null) || r.data?.message || fallback;
    }
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

  /* ---------- Modos: entrar / activar acceso ---------- */
  let mode = "login";

  function setMode(next) {
    mode = next;
    const act = mode === "activate";
    el.eyebrow.textContent = act ? "Primer acceso" : "Acceso";
    el.title.textContent = act ? "Activar acceso" : "Iniciar sesión";
    el.subtitle.textContent = act
      ? "Usa el código que te dio el administrador y crea tu contraseña."
      : "Solo para correos autorizados.";
    el.submit.textContent = act ? "Activar acceso" : "Entrar";
    el.switchMode.textContent = act ? "Ya tengo cuenta, iniciar sesión" : "Tengo un código de activación";
    el.passwordLabel.textContent = act ? "Crea tu contraseña" : "Contraseña";
    el.password.autocomplete = act ? "new-password" : "current-password";
    el.codeWrap.hidden = el.confirmWrap.hidden = el.meterWrap.hidden = !act;
    el.code.required = act;
    el.password.value = el.confirm.value = el.code.value = "";
    el.meter.dataset.level = "0";
    say(el.msg, "");
  }

  /* ---------- Sesión ---------- */
  function showLoggedOut() {
    token.clear();
    el.form.hidden = el.extra.hidden = false;
    el.session.hidden = el.admin.hidden = true;
    el.note.hidden = false;
    el.card.classList.remove("wide");
    setMode("login");
  }

  function showLoggedIn(user) {
    el.form.hidden = el.extra.hidden = true;
    el.session.hidden = false;
    el.note.hidden = true;
    el.eyebrow.textContent = "Bienvenido";
    el.title.textContent = "Sesión iniciada";
    el.subtitle.textContent = "";

    el.sessionInfo.textContent = "";
    const b = document.createElement("b");
    b.textContent = user.email;
    el.sessionInfo.append("Has ingresado como ", b, user.role === "admin" ? " (administrador)." : ".");

    const admin = user.role === "admin";
    el.admin.hidden = !admin;
    el.card.classList.toggle("wide", admin);
    if (admin) loadUsers();
  }

  /* ---------- Formulario principal ---------- */
  el.password.addEventListener("input", () => {
    if (mode !== "activate") return;
    el.meter.dataset.level = String(el.password.value ? Math.max(strength(el.password.value), 1) : 0);
  });

  el.toggle.addEventListener("click", () => {
    const show = el.password.type === "password";
    el.password.type = show ? "text" : "password";
    el.toggle.textContent = show ? "Ocultar" : "Mostrar";
    el.toggle.setAttribute("aria-pressed", String(show));
    el.toggle.setAttribute("aria-label", show ? "Ocultar contraseña" : "Mostrar contraseña");
  });

  el.switchMode.addEventListener("click", () => setMode(mode === "login" ? "activate" : "login"));

  let busy = false;
  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    const email = el.email.value.trim().toLowerCase();
    const pw = el.password.value;
    if (!el.email.checkValidity() || !pw) return say(el.msg, "Completa tu correo y contraseña.", "error");

    let request;
    if (mode === "activate") {
      const code = el.code.value.trim();
      if (!code) return say(el.msg, "Escribe el código de activación.", "error");
      if (pw.length < MIN_LENGTH) return say(el.msg, `La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`, "error");
      if (pw.toLowerCase().includes(email.split("@")[0])) return say(el.msg, "La contraseña no debe contener tu correo.", "error");
      if (pw !== el.confirm.value) return say(el.msg, "Las contraseñas no coinciden.", "error");
      request = () => api("/activate", { method: "POST", body: { email, code, password: pw } });
    } else {
      request = () => api("/login", { method: "POST", body: { email, password: pw } });
    }

    busy = true;
    el.submit.disabled = true;
    say(el.msg, "Verificando…");
    try {
      const r = await request();
      if (r.ok && r.data?.token) {
        token.set(r.data.token);
        showLoggedIn(r.data.user);
      } else {
        say(el.msg, errorText(r, "Correo o contraseña incorrectos."), "error");
      }
    } finally {
      el.password.value = el.confirm.value = "";   // no dejar la contraseña en el campo
      busy = false;
      el.submit.disabled = false;
    }
  });

  el.logout.addEventListener("click", async () => {
    await api("/logout", { method: "POST" });
    showLoggedOut();
  });

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
    } catch { /* el usuario puede copiarlo a mano */ }
  });

  async function loadUsers() {
    const r = await api("/admin/users");
    if (r.status === 401) return showLoggedOut();
    if (!r.ok) return say(el.adminMsg, errorText(r, "No se pudo cargar la lista."), "error");
    renderUsers(r.data.data);
  }

  function statusOf(u) {
    if (u.role === "admin") return ["Admin", "admin"];
    if (!u.is_active) return ["Desactivado", "off"];
    if (u.pending) return ["Pendiente", "pending"];
    return ["Activo", "on"];
  }

  function actionButton(label, onClick, danger = false) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mini" + (danger ? " danger" : "");
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
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
          actionButton("Restablecer", async () => {
            if (!confirm(`Se cerrará la sesión de ${u.email}, se borrará su contraseña y se generará un código nuevo. ¿Continuar?`)) return;
            const r = await api(`/admin/users/${u.id}/reset`, { method: "POST" });
            if (r.ok) { showCode(u.email, r.data.code); say(el.adminMsg, ""); loadUsers(); }
            else say(el.adminMsg, errorText(r, "No se pudo restablecer."), "error");
          }),
          actionButton(u.is_active ? "Desactivar" : "Activar", async () => {
            const r = await api(`/admin/users/${u.id}`, { method: "PATCH", body: { is_active: !u.is_active } });
            if (r.ok) loadUsers(); else say(el.adminMsg, errorText(r, "No se pudo actualizar."), "error");
          }),
          actionButton("Eliminar", async () => {
            if (!confirm(`¿Eliminar el acceso de ${u.email}?`)) return;
            const r = await api(`/admin/users/${u.id}`, { method: "DELETE" });
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

    const r = await api("/admin/users", { method: "POST", body: { email } });
    if (r.ok) {
      el.inviteEmail.value = "";
      say(el.adminMsg, "Correo autorizado.", "ok");
      showCode(r.data.user.email, r.data.code);
      loadUsers();
    } else {
      say(el.adminMsg, errorText(r, "No se pudo autorizar el correo."), "error");
    }
  });

  /* ---------- Inicio ---------- */
  async function init() {
    if (!API) {
      el.form.hidden = el.extra.hidden = true;
      el.title.textContent = "No disponible";
      el.subtitle.textContent = "Falta configurar API_URL en config.js.";
      return;
    }
    if (token.get()) {
      const r = await api("/me");
      if (r.ok) return showLoggedIn(r.data.user);
    }
    showLoggedOut();
  }

  init();
})();
