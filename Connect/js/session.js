import { supabase } from "./supabase.js";
import { logout } from "./auth.js";
const authArea = document.getElementById("authArea");

async function updateAuthUI() {
    if (!authArea) return;
    const { data, error } = await supabase.auth.getUser();
    authArea.replaceChildren();
    if (error) console.error("Không thể kiểm tra phiên đăng nhập:", error.message);
    if (data?.user) {
        const name = String(data.user.user_metadata?.username || data.user.email || "Bạn");
        const label = document.createElement("span");
        label.className = "welcome-user";
        label.title = `Xin chào, ${name}`;
        const dot = document.createElement("span");
        dot.className = "user-dot";
        dot.textContent = name.trim().charAt(0).toLocaleUpperCase("vi-VN");
        const text = document.createElement("span");
        text.className = "user-name";
        text.textContent = name;
        label.append(dot, text);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "logout-btn";
        button.textContent = "Đăng xuất";
        button.addEventListener("click", logout);
        authArea.append(label, button);
    } else {
        const login = document.createElement("a");
        login.href = "login.html";
        login.textContent = "Đăng nhập";
        login.className = "auth-link";
        const register = document.createElement("a");
        register.href = "register.html";
        register.textContent = "Đăng ký";
        register.className = "auth-link auth-link-primary";
        authArea.append(login, register);
    }
}
updateAuthUI();
supabase.auth.onAuthStateChange(() => updateAuthUI());
