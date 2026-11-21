import { supabase } from "./supabase.js";

const VERIFY_REDIRECT = `${window.location.origin}${window.location.pathname.replace(/[^/]*$/, "")}login.html?verified=1`;
const RESEND_COOLDOWN = 60;

/* Khối "xác minh email": thông báo + nút gửi lại thư (có đếm ngược chống spam). */
function showVerifyPanel(anchor, email) {
    let panel = anchor.parentElement.querySelector(".auth-verify");
    if (!panel) {
        panel = document.createElement("div");
        panel.className = "auth-verify";
        panel.setAttribute("role", "status");
        anchor.insertAdjacentElement("afterend", panel);
    }
    panel.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = "Cần xác minh email";
    const text = document.createElement("p");
    text.textContent = `Chúng mình đã gửi thư xác minh tới ${email}. Hãy mở thư (kiểm tra cả mục Spam) và bấm vào liên kết để kích hoạt tài khoản, rồi quay lại đăng nhập.`;
    const resend = document.createElement("button");
    resend.type = "button";
    resend.className = "auth-resend";
    panel.append(title, text, resend);

    let remaining = 0, timer = null;
    const paint = () => {
        resend.disabled = remaining > 0;
        resend.textContent = remaining > 0 ? `Gửi lại thư sau ${remaining}s` : "Gửi lại thư xác minh";
    };
    const startCooldown = () => {
        remaining = RESEND_COOLDOWN; paint();
        clearInterval(timer);
        timer = setInterval(() => { remaining -= 1; paint(); if (remaining <= 0) clearInterval(timer); }, 1000);
    };
    resend.addEventListener("click", async () => {
        resend.disabled = true; resend.textContent = "Đang gửi...";
        try {
            const { error } = await supabase.auth.resend({ type: "signup", email, options: { emailRedirectTo: VERIFY_REDIRECT } });
            if (error) throw error;
            text.textContent = `Đã gửi lại thư xác minh tới ${email}.`;
            startCooldown();
        } catch (error) {
            text.textContent = "Không gửi lại được: " + (error.message || "Lỗi kết nối. Hãy thử lại.");
            remaining = 0;
            paint();
        }
    });
    startCooldown();
}
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
            const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username }, emailRedirectTo: VERIFY_REDIRECT } });
            if (error) throw error;
            // Supabase trả về user với identities rỗng khi email đã được đăng ký (chống dò email).
            if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
                message.textContent = "Email này đã được đăng ký. Hãy đăng nhập, hoặc dùng email khác.";
                return;
            }
            if (data.session) {
                // Dự án Supabase đang TẮT "Confirm email": không để người dùng vào khi chưa xác minh.
                await supabase.auth.signOut();
                console.warn("Supabase chưa bật 'Confirm email' (Authentication → Sign In / Providers → Email). Hãy bật để bắt buộc xác minh.");
                message.textContent = "Hệ thống chưa bật xác minh email nên chưa thể tạo tài khoản. Vui lòng liên hệ quản trị viên.";
                return;
            }
            message.textContent = "Đăng ký thành công! Bước cuối: xác minh email của bạn.";
            showVerifyPanel(message, email);
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
            const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
            if (!signIn.user?.email_confirmed_at) {
                await supabase.auth.signOut();
                message.textContent = "Tài khoản chưa được xác minh email.";
                showVerifyPanel(message, email);
                return;
            }
            const { data: s } = await supabase.auth.getUser();
            const { data: pr } = s?.user ? await supabase.from("profiles").select("planet").eq("id", s.user.id).maybeSingle() : { data: null };
            window.location.href = pr?.planet ? "index.html" : "quiz.html";
        } catch (error) {
            if (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message || "")) {
                message.textContent = "Tài khoản chưa được xác minh email.";
                showVerifyPanel(message, email);
            } else if (error.code === "invalid_credentials" || /invalid login/i.test(error.message || "")) {
                message.textContent = "Đăng nhập thất bại: email hoặc mật khẩu không đúng.";
            } else {
                message.textContent = "Đăng nhập thất bại: " + error.message;
            }
        }
        finally { button.disabled = false; button.textContent = "Đăng nhập"; }
    });
}
export async function logout() {
    const { error } = await supabase.auth.signOut();
    if (error) { alert("Đăng xuất thất bại: " + error.message); return; }
    window.location.href = "login.html";
}

// Sau khi bấm liên kết trong thư xác minh, người dùng được đưa về login.html?verified=1
if (loginForm && new URLSearchParams(window.location.search).get("verified") === "1") {
    const message = document.getElementById("loginMessage");
    supabase.auth.getSession().then(async ({ data, error }) => {
        if (error) throw error;
        if (data.session?.user?.email_confirmed_at) {
            message.textContent = "Email đã được xác minh. Đang chuyển vào Connect...";
            const { data: profile, error: profileError } = await supabase
                .from("profiles").select("planet").eq("id", data.session.user.id).maybeSingle();
            if (profileError) console.warn("Không đọc được hồ sơ sau xác minh email:", profileError);
            const destination = profile?.planet ? "index.html" : "quiz.html";
            window.setTimeout(() => { window.location.href = destination; }, 900);
        } else {
            message.textContent = "Email đã được xác minh. Hãy đăng nhập để bắt đầu.";
        }
    }).catch(error => {
        console.warn("Không kiểm tra được phiên sau xác minh email:", error);
        message.textContent = "Email đã được xác minh. Hãy đăng nhập để bắt đầu.";
    });
}

if (loginForm && new URLSearchParams(window.location.search).get("needverify") === "1") {
    document.getElementById("loginMessage").textContent = "Vui lòng xác minh email trước khi sử dụng Connect. Hãy kiểm tra hộp thư của bạn.";
}
