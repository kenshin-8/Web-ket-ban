import { supabase } from "./supabase.js";
const registerForm = document.getElementById("registerForm");
if (registerForm) {
    registerForm.addEventListener("submit", async event => {
        event.preventDefault();
        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirmPassword = document.getElementById("confirmPassword").value;
        const message = document.getElementById("registerMessage");
        const button = document.getElementById("registerBtn");
        if (username.length < 3 || username.length > 30) { message.textContent = "Tên tài khoản cần từ 3 đến 30 ký tự."; return; }
        if (password.length < 8) { message.textContent = "Mật khẩu cần ít nhất 8 ký tự."; return; }
        if (password !== confirmPassword) { message.textContent = "Hai mật khẩu không khớp."; return; }
        button.disabled = true; button.textContent = "Đang tạo tài khoản..."; message.textContent = "";
        try {
            const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: `${window.location.origin}/login.html` } });
            if (error) throw error;
            message.textContent = data.session ? "Tạo tài khoản thành công!" : "Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản.";
            registerForm.reset();
        } catch (error) { message.textContent = "Không thể đăng ký: " + error.message; }
        finally { button.disabled = false; button.textContent = "Tạo tài khoản"; }
    });
}
const loginForm = document.getElementById("loginForm");
if (loginForm) {
    loginForm.addEventListener("submit", async event => {
        event.preventDefault();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const message = document.getElementById("loginMessage");
        const button = document.getElementById("loginBtn");
        button.disabled = true; button.textContent = "Đang đăng nhập..."; message.textContent = "";
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            const { data: s } = await supabase.auth.getUser();
            const { data: pr } = s?.user ? await supabase.from("profiles").select("planet").eq("id", s.user.id).maybeSingle() : { data: null };
            window.location.href = pr?.planet ? "index.html" : "quiz.html";
        } catch (error) { message.textContent = "Đăng nhập thất bại: " + error.message; }
        finally { button.disabled = false; button.textContent = "Đăng nhập"; }
    });
}
export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) { alert("Đăng xuất thất bại: " + error.message); return; }
    window.location.href = "login.html";
}
