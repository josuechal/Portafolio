(() => {
  "use strict";

  const { configured, session, sb, manage, errorText, say, accessRole, signOut } = window.JC;

  const $ = (id) => document.getElementById(id);
  const LOGIN = "login.html";
  const fmt = new Intl.NumberFormat("es-PE");

  /* ---------- Acceso: solo el administrador entra a esta página ---------- */
  const goLogin = () => { location.replace(LOGIN); };

  /* ---------- Secciones de la barra lateral ---------- */
  const tabs = [...document.querySelectorAll(".side-nav button")];
  const loaders = { stats: loadStats, emails: loadEmails, comments: loadComments };

  function show(name) {
    if (!loaders[name]) name = "stats";
    tabs.forEach((t) => t.classList.toggle("active", t.dataset.view === name));
    for (const key of Object.keys(loaders)) $(`view-${key}`).hidden = key !== name;
    history.replaceState(null, "", `#${name}`);
    loaders[name]();
  }
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.view)));

  /* Una sesión vencida o sin permiso saca al usuario del panel */
  function expired(r) {
    if (r.status === 401 || r.status === 403) { session.clear(); goLogin(); return true; }
    return false;
  }

  /* ---------- Estadísticas ---------- */
  let daily = [];
  let range = 30;
  const chartCard = $("chartCard");

  async function loadStats() {
    chartCard.classList.add("loading");   // mantiene el gráfico anterior atenuado mientras recarga
    const r = await sb("/rest/v1/rpc/visit_stats", { method: "POST", body: {} });
    chartCard.classList.remove("loading");
    if (expired(r)) return;
    if (!r.ok) return say($("pageMsg"), "No se pudieron cargar las estadísticas. ¿Ejecutaste setup_panel.sql en Supabase?", "error");
    say($("pageMsg"), "");

    const d = r.data;
    $("k-today").textContent = fmt.format(d.today);
    $("k-7").textContent = fmt.format(d.last7);
    $("k-30").textContent = fmt.format(d.last30);
    $("k-total").textContent = fmt.format(d.unique_total);
    $("k-signed").textContent = fmt.format(d.signed_in);
    daily = d.daily || [];
    drawChart();
  }

  // Escala con números redondos (4 tramos): 0, 1, 2, 3, 4 / 0, 5, 10... / 0, 50, 100...
  function niceScale(max) {
    if (max <= 4) return { top: 4, step: 1 };
    const rough = max / 4;
    const p = 10 ** Math.floor(Math.log10(rough));
    const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= rough);
    return { top: step * 4, step };
  }

  const dayLabel = (iso, long = false) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString("es-PE", long
      ? { weekday: "short", day: "numeric", month: "short" }
      : { day: "numeric", month: "short" });

  function drawChart() {
    const data = daily.slice(-range);
    const max = Math.max(0, ...data.map((p) => p.n));
    const { top, step } = niceScale(max);

    const ticks = $("ticks");
    ticks.replaceChildren();
    for (let v = 0; v <= top; v += step) {
      const t = document.createElement("span");
      t.dataset.v = fmt.format(v);
      t.style.bottom = `${(v / top) * 100}%`;
      ticks.append(t);
    }

    const bars = $("bars");
    bars.replaceChildren();
    for (const p of data) {
      const col = document.createElement("div");
      col.className = "col";
      col.tabIndex = 0;
      col.setAttribute("role", "listitem");
      col.setAttribute("aria-label", `${dayLabel(p.day, true)}: ${p.n} ${p.n === 1 ? "persona" : "personas"}`);
      col.dataset.day = p.day;
      col.dataset.n = String(p.n);

      const bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = `${(p.n / top) * 100}%`;
      col.append(bar);
      bars.append(col);
    }

    // Etiquetas del eje X: solo primera, central y última (no un rótulo por barra)
    const x = $("xaxis");
    x.replaceChildren();
    const picks = data.length ? [data[0], data[Math.floor((data.length - 1) / 2)], data[data.length - 1]] : [];
    for (const p of picks) {
      const s = document.createElement("span");
      s.textContent = dayLabel(p.day);
      x.append(s);
    }

    // Vista en tabla (los mismos datos sin pasar el cursor)
    const body = $("tableBody");
    body.replaceChildren();
    for (const p of [...data].reverse()) {
      const tr = document.createElement("tr");
      const a = document.createElement("td");
      const b = document.createElement("td");
      a.textContent = dayLabel(p.day, true);
      b.textContent = fmt.format(p.n);
      tr.append(a, b);
      body.append(tr);
    }
  }

  // Tooltip: el valor manda, el día acompaña
  const tip = $("tip");
  const plot = $("plot");

  function showTip(col) {
    const n = Number(col.dataset.n);
    tip.replaceChildren();
    const v = document.createElement("b");
    v.textContent = `${fmt.format(n)} ${n === 1 ? "persona" : "personas"}`;
    tip.append(v, dayLabel(col.dataset.day, true));
    tip.hidden = false;

    const pr = plot.getBoundingClientRect();
    const cr = col.getBoundingClientRect();
    const h = col.firstElementChild.getBoundingClientRect().height;
    const left = Math.min(Math.max(cr.left - pr.left + cr.width / 2, 55), pr.width - 55);
    tip.style.left = `${left}px`;
    tip.style.top = `${Math.max(cr.bottom - pr.top - h - 8, 56)}px`;
  }
  const hideTip = () => { tip.hidden = true; };

  $("bars").addEventListener("pointerover", (e) => { const c = e.target.closest(".col"); if (c) showTip(c); });
  $("bars").addEventListener("pointerleave", hideTip);
  $("bars").addEventListener("focusin", (e) => { const c = e.target.closest(".col"); if (c) showTip(c); });
  $("bars").addEventListener("focusout", hideTip);

  document.querySelectorAll(".seg").forEach((b) => b.addEventListener("click", () => {
    range = Number(b.dataset.range);
    document.querySelectorAll(".seg").forEach((s) => {
      const on = s === b;
      s.classList.toggle("active", on);
      s.setAttribute("aria-pressed", String(on));
    });
    drawChart();
  }));

  $("tableToggle").addEventListener("click", (e) => {
    const asTable = $("tableWrap").hidden;
    $("tableWrap").hidden = !asTable;
    $("chart").hidden = asTable;
    e.currentTarget.textContent = asTable ? "Ver gráfico" : "Ver tabla";
    e.currentTarget.setAttribute("aria-pressed", String(asTable));
  });

  /* ---------- Correos autorizados ---------- */
  const codeBox = $("codeBox");

  function showCode(email, code) {
    $("codeFor").textContent = email;
    $("codeValue").textContent = code;
    codeBox.hidden = false;
  }

  $("codeCopy").addEventListener("click", async (e) => {
    try {
      await navigator.clipboard.writeText($("codeValue").textContent);
      e.currentTarget.textContent = "Copiado";
      setTimeout(() => { e.currentTarget.textContent = "Copiar"; }, 1500);
    } catch { /* se puede copiar a mano */ }
  });

  function actionButton(label, onClick, danger = false) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "mini" + (danger ? " danger" : "");
    b.textContent = label;
    b.addEventListener("click", onClick);
    return b;
  }

  function row(mainNodes, badgeText, badgeKind, actions) {
    const li = document.createElement("li");
    const main = document.createElement("div");
    main.className = "row-main";
    main.append(...mainNodes);
    const badge = document.createElement("span");
    badge.className = `badge ${badgeKind}`;
    badge.textContent = badgeText;
    const box = document.createElement("div");
    box.className = "row-actions";
    box.append(...actions);
    li.append(main, badge, box);
    return li;
  }

  async function loadEmails() {
    const r = await sb("/rest/v1/allowed_emails?select=email,role,is_active&order=role.asc,email.asc");
    if (expired(r)) return;
    if (!r.ok) return say($("emailMsg"), "No se pudo cargar la lista.", "error");

    const list = $("emailList");
    list.replaceChildren();
    for (const u of r.data) {
      const admin = u.role === "admin";
      const [label, kind] = admin ? ["Admin", "admin"] : u.is_active ? ["Activo", "on"] : ["Desactivado", "off"];
      const actions = admin ? [] : [
        actionButton("Nuevo código", async () => {
          if (!confirm(`Se anulará el código anterior de ${u.email} y se generará uno nuevo. ¿Continuar?`)) return;
          const res = await manage("reset", u.email);
          if (res.ok) { showCode(u.email, res.data.code); say($("emailMsg"), ""); loadEmails(); }
          else say($("emailMsg"), errorText(res, "No se pudo generar el código."), "error");
        }),
        actionButton(u.is_active ? "Desactivar" : "Activar", async () => {
          const res = await manage("set_active", u.email, { active: !u.is_active });
          if (res.ok) loadEmails(); else say($("emailMsg"), errorText(res, "No se pudo actualizar."), "error");
        }),
        actionButton("Eliminar", async () => {
          if (!confirm(`¿Eliminar el acceso de ${u.email}? Se borrará su cuenta.`)) return;
          const res = await manage("delete", u.email);
          if (res.ok) loadEmails(); else say($("emailMsg"), errorText(res, "No se pudo eliminar."), "error");
        }, true),
      ];
      const name = document.createElement("span");
      name.textContent = u.email;
      list.append(row([name], label, kind, actions));
    }
  }

  $("inviteForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = $("inviteEmail");
    const email = input.value.trim().toLowerCase();
    if (!input.checkValidity() || !email) return say($("emailMsg"), "Escribe un correo válido.", "error");

    $("inviteBtn").disabled = true;
    try {
      const r = await manage("create", email);
      if (r.ok) {
        input.value = "";
        say($("emailMsg"), `${email} autorizado. Entrégale el código de abajo.`, "ok");
        showCode(email, r.data.code);
        loadEmails();
      } else {
        say($("emailMsg"), errorText(r, "No se pudo autorizar el correo."), "error");
      }
    } finally {
      $("inviteBtn").disabled = false;
    }
  });

  /* ---------- Comentarios ---------- */
  function setPending(n) {
    const c = $("pendingCount");
    c.textContent = String(n);
    c.hidden = n === 0;
  }

  async function loadComments() {
    const r = await sb("/rest/v1/comments?select=id,name,body,approved,created_at&order=approved.asc,created_at.desc&limit=200");
    if (expired(r)) return;
    if (!r.ok) return say($("commentMsg"), "No se pudieron cargar los comentarios. ¿Ejecutaste setup_panel.sql en Supabase?", "error");
    say($("commentMsg"), r.data.length ? "" : "Todavía no hay comentarios.");

    const list = $("commentList");
    list.replaceChildren();
    setPending(r.data.filter((c) => !c.approved).length);

    const refresh = () => loadComments();
    const patch = async (id, approved) => {
      const res = await sb(`/rest/v1/comments?id=eq.${id}`, { method: "PATCH", body: { approved }, headers: { Prefer: "return=minimal" } });
      if (res.ok) refresh(); else say($("commentMsg"), errorText(res, "No se pudo actualizar."), "error");
    };

    for (const c of r.data) {
      const name = document.createElement("span");
      name.className = "cm-name";
      name.textContent = c.name;
      const date = document.createElement("span");
      date.className = "cm-date";
      date.textContent = new Date(c.created_at).toLocaleString("es-PE", { dateStyle: "medium", timeStyle: "short" });
      const text = document.createElement("p");
      text.className = "cm-text";
      text.textContent = c.body;   // texto plano, nunca HTML

      const actions = [
        c.approved ? actionButton("Ocultar", () => patch(c.id, false)) : actionButton("Aprobar", () => patch(c.id, true)),
        actionButton("Eliminar", async () => {
          if (!confirm("¿Eliminar este comentario?")) return;
          const res = await sb(`/rest/v1/comments?id=eq.${c.id}`, { method: "DELETE", headers: { Prefer: "return=minimal" } });
          if (res.ok) refresh(); else say($("commentMsg"), errorText(res, "No se pudo eliminar."), "error");
        }, true),
      ];
      list.append(row([name, date, text], c.approved ? "Publicado" : "Pendiente", c.approved ? "on" : "pending", actions));
    }
  }

  /* ---------- Inicio ---------- */
  $("logout").addEventListener("click", async () => {
    await signOut();
    goLogin();
  });

  async function init() {
    if (!configured) return say($("pageMsg"), "Falta configurar config.js.", "error");

    const s = session.get();
    if (!s) return goLogin();
    const role = await accessRole();
    if (role !== "admin") { if (!role) session.clear(); return goLogin(); }

    $("who").textContent = s.email;
    setTimeout(goLogin, Math.max(s.exp - Date.now(), 0));   // al vencer la sesión, vuelve al login

    loadComments();   // actualiza el contador de pendientes de la barra lateral
    show(location.hash.slice(1));
  }

  init();
})();
