// Contador anónimo de visitas: una por persona y día.
// Solo guarda un identificador aleatorio de este navegador (sin IP, sin nombre, sin correo).
(() => {
  "use strict";

  const { configured, session, sb } = window.JC;
  const ID_KEY = "jc_vid";
  const DAY_KEY = "jc_vday";

  try {
    // No contar: sin configuración, con "No rastrear" activado, ni las visitas del propio administrador
    if (!configured || navigator.doNotTrack === "1" || session.get()) return;

    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" });
    if (localStorage.getItem(DAY_KEY) === today) return;   // ya contada hoy

    let id = localStorage.getItem(ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(ID_KEY, id);
    }

    sb("/rest/v1/visits", {
      method: "POST",
      body: { visitor_id: id, path: location.pathname.slice(0, 100) },
      headers: { Prefer: "return=minimal" },
    }).then((r) => {
      // 409 = la base ya tenía a esta persona hoy (restricción única): cuenta como hecho
      if (r.ok || r.status === 409) localStorage.setItem(DAY_KEY, today);
    });
  } catch { /* sin almacenamiento: simplemente no se cuenta */ }
})();
