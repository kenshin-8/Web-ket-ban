import { supabase, getInitialSession } from "./supabase.js";
import { logout } from "./auth.js";
import { applyAvatar } from "./avatar-data.js";
const authArea = document.getElementById("authArea");

async function renderAuthUI(user) {
    if (!authArea) return;
    authArea.replaceChildren();
    if (user) {
        const name = String(user.user_metadata?.username || user.email?.split("@")[0] || "Bạn");
        const trigger = document.createElement("button");
        trigger.type = "button";
        trigger.className = "account-trigger";
        trigger.setAttribute("aria-haspopup", "true");
        trigger.setAttribute("aria-expanded", "false");
        trigger.setAttribute("aria-controls", "connectAccountMenu");
        trigger.setAttribute("aria-label", `Mở cài đặt tài khoản ${name}`);

        const avatar = document.createElement("span");
        avatar.className = "account-avatar";
        avatar.setAttribute("aria-hidden", "true");
        const fallback = document.createElement("span");
        fallback.className = "account-avatar-fallback";
        fallback.textContent = name.trim().charAt(0).toLocaleUpperCase("vi-VN");
        avatar.append(fallback);
        const label = document.createElement("span");
        label.className = "account-name";
        label.textContent = name;
        const chevron = Object.assign(document.createElement("span"), {className:"account-chevron", textContent:"⌄"});
        chevron.setAttribute("aria-hidden", "true");
        trigger.append(avatar, label, chevron);

        const menu = document.createElement("div");
        menu.className = "account-menu";
        menu.id = "connectAccountMenu";
        menu.hidden = true;
        menu.innerHTML = `<div class="account-menu-head"><strong></strong><span>Quản lý tài khoản Connect</span><small><i></i> Đang hoạt động</small></div>
          <div class="account-menu-section"><span>CÁ NHÂN</span><a href="avatar.html"><span aria-hidden="true">✧</span>Tạo ảnh đại diện</a><a href="profile.html"><span aria-hidden="true">♙</span>Thông tin cá nhân</a></div>
          <div class="account-menu-section"><span>TÙY CHỈNH</span><a href="account-settings.html#preferences"><span aria-hidden="true">☼</span>Ngôn ngữ & thông báo</a></div>
          <div class="account-menu-section"><span>QUYỀN RIÊNG TƯ</span><a href="account-settings.html#privacy"><span aria-hidden="true">◈</span>Dữ liệu & quyền riêng tư</a><a href="account-settings.html#blocked"><span aria-hidden="true">⊘</span>Danh sách chặn</a></div>
          <div class="account-menu-section"><span>TÀI KHOẢN CỦA TÔI</span><a href="account-settings.html#security"><span aria-hidden="true">⌑</span>Mật khẩu & email</a><a href="account-settings.html#delete"><span aria-hidden="true">⚠</span>Xóa tài khoản</a></div>
          <button type="button" class="account-logout"><span aria-hidden="true">↪</span>Đăng xuất</button>`;
        menu.querySelector('.account-menu-head strong').textContent = name;
        const logoutButton = menu.querySelector('.account-logout');
        logoutButton.addEventListener('click', logout);
        trigger.addEventListener('click', () => {
            const open = menu.hidden;
            menu.hidden = !open;
            trigger.setAttribute('aria-expanded', String(open));
            if (open) menu.querySelector('a')?.focus();
        });
        if (!document.documentElement.dataset.accountMenuEvents) {
            document.addEventListener('click', e => {
                const area = document.getElementById('authArea');
                if (area && !area.contains(e.target)) {
                    const currentMenu = area.querySelector('.account-menu');
                    const currentTrigger = area.querySelector('.account-trigger');
                    if (currentMenu) currentMenu.hidden = true;
                    currentTrigger?.setAttribute('aria-expanded', 'false');
                }
            });
            document.addEventListener('keydown', e => {
                if (e.key === 'Escape') {
                    const area = document.getElementById('authArea');
                    const currentMenu = area?.querySelector('.account-menu');
                    const currentTrigger = area?.querySelector('.account-trigger');
                    if (currentMenu && !currentMenu.hidden) { currentMenu.hidden = true; currentTrigger?.setAttribute('aria-expanded', 'false'); currentTrigger?.focus(); }
                }
            });
            document.documentElement.dataset.accountMenuEvents = 'true';
        }
        authArea.append(trigger, menu);
        // Lối vào trang quản trị: chỉ là tiện lợi giao diện; quyền thật được kiểm tra ở máy chủ.
        supabase.rpc('admin_my_role').then(({ data: role }) => {
            if (!role || menu.querySelector('.account-admin-link')) return;
            const link = document.createElement('a');
            link.className = 'account-admin-link'; link.href = 'admin.html';
            link.innerHTML = '<span aria-hidden="true">♛</span>Quản trị Connect';
            menu.querySelector('.account-menu-section')?.before(Object.assign(document.createElement('div'), { className: 'account-menu-section', innerHTML: '<span>QUẢN TRỊ</span>' })) ;
            menu.querySelector('.account-menu-section').appendChild(link);
        }).catch(() => {});

        // Avatar dùng đúng dữ liệu đã lưu trong profiles.avatar_data.
        try {
            const { data, error } = await supabase.from('profiles').select('avatar_data,display_name').eq('id', user.id).maybeSingle();
            if (!error && data?.display_name) {
                label.textContent = data.display_name;
                trigger.setAttribute('aria-label', `Mở cài đặt tài khoản ${data.display_name}`);
                menu.querySelector('.account-menu-head strong').textContent = data.display_name;
            }
            if (!error && data?.avatar_data) {
                const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                svg.setAttribute('viewBox', '0 0 240 240');
                svg.setAttribute('role', 'img');
                svg.setAttribute('aria-label', `Avatar của ${name}`);
                applyAvatar(svg, data.avatar_data);
                avatar.replaceChildren(svg);
            }
        } catch (error) { console.warn('Không tải được Avatar tài khoản:', error); }
    } else {
        const login = document.createElement("a"); login.href = "login.html"; login.textContent = "Đăng nhập"; login.className = "auth-link";
        const register = document.createElement("a"); register.href = "register.html"; register.textContent = "Đăng ký"; register.className = "auth-link auth-link-primary";
        authArea.append(login, register);
    }
}

async function enforceVerified(session) {
    const user = session?.user;
    if (user && !user.email_confirmed_at) {
        await supabase.auth.signOut(); window.location.replace("login.html?needverify=1"); return null;
    }
    return session;
}
getInitialSession().then(enforceVerified).then(session => {
    renderAuthUI(session?.user || null);
    if (session?.user) import("./match-chat.js").then(m => m.initMatchChat(session.user.id)).catch(e => console.warn("match-chat:", e.message));
}).catch(error => { console.error("Không thể khởi tạo phiên đăng nhập:", error.message); renderAuthUI(null); });
supabase.auth.onAuthStateChange((_event, session) => { window.setTimeout(() => renderAuthUI(session?.user || null), 0); });
