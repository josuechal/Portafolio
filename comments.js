// Comentarios del portafolio: cualquiera puede escribir; se muestran solo los que aprueba el administrador.
(() => {
  "use strict";

  const { configured, sb, say } = window.JC;

  const $ = (id) => document.getElementById(id);
  const section = $("comentarios");
  if (!section) return;

  const MAX_BODY = 300;
  const COOLDOWN_MS = 60 * 1000;
  const LAST_KEY = "jc_last_comment";

  const el = {
    form: $("cmForm"), name: $("cmName"), body: $("cmBody"), count: $("cmCount"),
    trap: $("cmWebsite"), msg: $("cmMsg"), submit: $("cmSubmit"), list: $("cmList"),
  };

  if (!configured) {
    section.hidden = true;
    return;
  }

  /* ---------- Lista de comentarios aprobados ---------- */
  async function loadList() {
    const r = await sb("/rest/v1/comments?select=name,body,created_at&approved=eq.true&order=created_at.desc&limit=20");
    el.list.replaceChildren();
    if (!r.ok) return;

    if (!r.data.length) {
      const empty = document.createElement("li");
      empty.className = "cm-empty";
      empty.textContent = "Sé la primera persona en comentar.";
      el.list.append(empty);
      return;
    }

    for (const c of r.data) {
      const li = document.createElement("li");
      li.className = "cm-item";

      const head = document.createElement("div");
      head.className = "cm-head";
      const who = document.createElement("b");
      who.textContent = c.name;   // textContent: lo escrito por visitantes nunca se interpreta como HTML
      const when = document.createElement("span");
      when.textContent = new Date(c.created_at).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" });
      head.append(who, when);

      const text = document.createElement("p");
      text.textContent = c.body;

      li.append(head, text);
      el.list.append(li);
    }
  }

  /* ---------- Formulario ---------- */
  el.body.addEventListener("input", () => {
    el.count.textContent = String(el.body.value.length);
  });

  function waitSeconds() {
    try {
      const left = COOLDOWN_MS - (Date.now() - Number(localStorage.getItem(LAST_KEY) || 0));
      return left > 0 ? Math.ceil(left / 1000) : 0;
    } catch { return 0; }
  }

  let busy = false;
  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;

    const name = el.name.value.trim();
    const body = el.body.value.trim();
    if (!name) return say(el.msg, "Escribe tu nombre.", "error");
    if (!body) return say(el.msg, "Escribe tu comentario.", "error");
    if (name.length > 40) return say(el.msg, "El nombre admite hasta 40 caracteres.", "error");
    if (body.length > MAX_BODY) return say(el.msg, `El comentario admite hasta ${MAX_BODY} caracteres.`, "error");

    const wait = waitSeconds();
    if (wait) return say(el.msg, `Espera ${wait} s antes de enviar otro comentario.`, "error");

    busy = true;
    el.submit.disabled = true;
    say(el.msg, "Enviando…");
    try {
      // Campo trampa lleno = es un bot: se finge éxito y no se envía nada
      const r = el.trap.value
        ? { ok: true }
        : await sb("/rest/v1/comments", { method: "POST", body: { name, body }, headers: { Prefer: "return=minimal" } });

      if (r.ok) {
        try { localStorage.setItem(LAST_KEY, String(Date.now())); } catch { /* sin almacenamiento */ }
        el.form.reset();
        el.count.textContent = "0";
        say(el.msg, "¡Gracias! Tu comentario se publicará cuando sea revisado.", "ok");
      } else {
        say(el.msg, r.status === 0 ? "No se pudo conectar. Inténtalo de nuevo." : "No se pudo enviar el comentario. Inténtalo en un minuto.", "error");
      }
    } finally {
      busy = false;
      el.submit.disabled = false;
    }
  });

  loadList();
})();
