const menuBtn = document.getElementById("menuBtn");
const navLinks = document.getElementById("navLinks");
if (menuBtn && navLinks) {
    menuBtn.addEventListener("click", () => {
        const opened = navLinks.classList.toggle("active");
        menuBtn.setAttribute("aria-expanded", String(opened));
        menuBtn.textContent = opened ? "✕" : "☰";
    });
    navLinks.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
        navLinks.classList.remove("active");
        menuBtn.setAttribute("aria-expanded", "false");
        menuBtn.textContent = "☰";
    }));
}
