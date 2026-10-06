// Conexión con Supabase. Estos dos datos se copian desde:
// Supabase > Project Settings > API  ("Project URL" y la clave "anon public" / "publishable").
// La clave publishable es PÚBLICA por diseño: la protección real está en las reglas de la base de datos (setup.sql).
// NUNCA pongas aquí la clave "service_role" ni "secret".
window.APP_CONFIG = {
  SUPABASE_URL: "https://yhrfkydkuhpxactzujul.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_NXVi_ajGi8GXHMEhzkViqg_vz0KjnRH",
};
