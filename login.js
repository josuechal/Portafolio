(() => {
  "use strict";

  const { configured, session, sb, errorText, say, accessRole, signOut } = window.JC;

  const $ = (id) => document.getElementById(id);
  const el = {
    card: $("card"), eyebrow: $("eyebrow"), title: $("title"), subtitle: $("subtitle"),
    form: $("form"), email: $("email"), password: $("password"), toggle: $("toggle"),
    msg: $("msg"), submit: $("submit"), note: $("note"),
    session: $("session"), sessionInfo: $("sessionInfo"), logout: $("logout"),
  };

  const PANEL = "panel.html";
  let sessionTimer = null;

  /* ---------- Estado: sesión cerrada / abierta ---------- */
  function showLoggedOut(message = "", type = "") {
    session.clear();
    clearTimeout(sessionTimer);
    el.form.hidden = el.note.hidden = false;
    el.session.hidden = true;
    el.eyebrow.textContent = "Acceso";
    el.title.textContent = "Iniciar sesión";
    el.subtitle.textContent = "Ingresa con tu correo y tu código de acceso.";
    el.password.value = "";
    say(el.msg, message, type);
  }

  // Los usuarios con código ven este aviso; el administrador es llevado a su panel
  function showLoggedIn({ email, exp }) {
    el.form.hidden = el.note.hidden = true;
    el.session.hidden = false;
    el.eyebrow.textContent = "Bienvenido";
    el.title.textContent = "Sesión iniciada";
    el.subtitle.textContent = "";

    el.sessionInfo.textContent = "";
    const b = document.createElement("b");
    b.textContent = email;
    el.sessionInfo.append("Has ingresado como ", b, ".");

    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(() => showLoggedOut("Tu sesión expiró. Inicia sesión de nuevo.", "error"), Math.max(exp - Date.now(), 0));
  }

  async function enter(s, role) {
    if (role === "admin") return location.assign(PANEL);
    showLoggedIn(s);
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
        await signOut();
        return say(el.msg, "Tu acceso no está autorizado o fue desactivado. Habla con el administrador.", "error");
      }
      await enter(s, role);
    } finally {
      el.password.value = "";   // no dejar el código en el campo
      busy = false;
      el.submit.disabled = false;
    }
  });

  el.logout.addEventListener("click", async () => {
    await signOut();
    showLoggedOut();
  });

  /* ---------- Inicio ---------- */
  async function init() {
    if (!configured) {
      el.form.hidden = true;
      el.title.textContent = "No disponible";
      el.subtitle.textContent = "Falta configurar SUPABASE_URL y SUPABASE_ANON_KEY en config.js.";
      return;
    }
    const s = session.get();
    if (s) {
      const role = await accessRole();
      if (role) return enter(s, role);
    }
    showLoggedOut();
  }

  init();
})();
