// Admin Dashboard: kiểm tra đăng nhập + quyền (máy chủ quyết định qua is_admin), định tuyến theo #hash.
import { supabase } from "./supabase.js";
import { $, el, rpc, explain } from "./admin-core.js";
import { showUsers } from "./admin-users.js";
import { showOverview, showAdmins, showStats, showLogs } from "./admin-more.js";
import { showReports } from "./admin-reports.js";

const gate = $("gate");
const VIEWS = {
    overview: ["Tổng quan", "Tình hình hệ thống Connect.", showOverview],
    users: ["Tìm kiếm tài khoản", "Tra cứu theo email, tên hoặc ID. Dữ liệu hồ sơ chỉ gồm thông tin công khai.", showUsers],
    admins: ["Phân quyền Admin", "Danh sách quản trị viên và vai trò.", showAdmins],
    locked: ["Tài khoản bị khóa", "Xem và mở khóa các tài khoản đang bị khóa.", (r, c) => showUsers(r, c, { lockedOnly: true })],
    reports: ["Báo cáo nội dung", "Hàng đợi báo cáo từ người dùng.", showReports],
    stats: ["Thống kê hệ thống", "Số liệu tổng hợp, không chứa dữ liệu cá nhân.", showStats],
    logs: ["Nhật ký hoạt động", "Mọi thao tác quản trị quan trọng đều được ghi lại.", showLogs]
};
const ctx = { userId: null, role: null, refresh: loadStats };

function denied(html) { gate.replaceChildren(); gate.append(...html); }

async function loadStats() {
    try {
        const [s] = await rpc("admin_overview");
        $("stTotal").textContent = s.total_users; $("stNew").textContent = `+${s.new_7d} trong 7 ngày`;
        $("stActive").textContent = s.active_users; $("stVerified").textContent = s.verified_users;
        $("stVerPct").textContent = s.total_users ? `${Math.round(s.verified_users * 100 / s.total_users)}% tổng số` : "";
        $("stLocked").textContent = s.locked_users; $("stAdmins").textContent = `${s.admin_count} quản trị viên`;
    } catch (e) { console.error(e); }
}

function route() {
    const key = VIEWS[location.hash.slice(1)] ? location.hash.slice(1) : "overview";
    const [title, sub, render] = VIEWS[key];
    $("viewTitle").textContent = title; $("viewSub").textContent = sub; document.title = `${title} | Connect Admin`;
    document.querySelectorAll(".adm-nav a").forEach(a => {
        if (a.getAttribute("href") === "#" + key) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current");
    });
    const view = $("view"); view.replaceChildren(); $("side").classList.remove("is-open");
    render(view, ctx);
}

async function init() {
    const { data } = await supabase.auth.getUser();
    if (!data?.user) { const a = el("a", "", "đăng nhập"); a.href = "login.html"; denied(["Vui lòng ", a, " để tiếp tục."]); return; }
    let role;
    try { role = await rpc("admin_my_role"); } catch (e) { denied([e.message]); return; }
    if (!role) { denied(["Bạn không có quyền truy cập trang này."]); return; }
    ctx.userId = data.user.id; ctx.role = role;
    $("meName").textContent = data.user.email; $("meRole").textContent = role === "owner" ? "Owner" : "Admin";
    gate.hidden = true; $("adminApp").hidden = false;
    $("menuBtn").addEventListener("click", () => $("side").classList.toggle("is-open"));
    window.addEventListener("hashchange", route);
    loadStats(); route();
}
init().catch(e => { console.error(e); denied([explain(e)]); });
