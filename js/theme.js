const themeToggle = document.getElementById("themeToggle");
let currentTheme = localStorage.getItem("theme") || "light";
document.documentElement.setAttribute("data-theme", currentTheme);
function updateThemeButton() {
    if (!themeToggle) return;
    themeToggle.textContent = currentTheme === "dark" ? "☀️" : "🌙";
}
updateThemeButton();
if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        currentTheme = currentTheme === "light" ? "dark" : "light";
        document.documentElement.setAttribute("data-theme", currentTheme);
        localStorage.setItem("theme", currentTheme);
        updateThemeButton();
    });
}
