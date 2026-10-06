const root = document.documentElement;
const themeBtn = document.getElementById("theme");
const menu = document.getElementById("menu");

// Tema claro/oscuro (respeta preferencia del sistema y recuerda la elección)
const saved = (() => { try { return localStorage.getItem("theme"); } catch { return null; } })();
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
root.dataset.theme = saved || (prefersDark ? "dark" : "light");

themeBtn.addEventListener("click", () => {
  const next = root.dataset.theme === "dark" ? "light" : "dark";
  root.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
});

// Barra superior: más opaca y con sombra cuando se baja la página
const nav = document.querySelector(".nav");
const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 10);
window.addEventListener("scroll", onScroll, { passive: true });
onScroll();

// La foto de perfil no ofrece "abrir imagen en otra pestaña" con clic derecho
const avatar = document.querySelector(".avatar");
if (avatar) avatar.addEventListener("contextmenu", (e) => e.preventDefault());

// Menú móvil
document.getElementById("burger").addEventListener("click", () => menu.classList.toggle("open"));
menu.addEventListener("click", (e) => { if (e.target.tagName === "A") menu.classList.remove("open"); });

// Animación de entrada al hacer scroll
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("visible"); io.unobserve(e.target); }
  });
}, { threshold: 0.12 });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

// Enlace activo en el menú según la sección visible
const links = [...menu.querySelectorAll("a")];
const spy = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) {
      links.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + e.target.id));
    }
  });
}, { rootMargin: "-45% 0px -50% 0px" });
document.querySelectorAll("main section[id]").forEach((s) => spy.observe(s));

document.getElementById("year").textContent = new Date().getFullYear();
