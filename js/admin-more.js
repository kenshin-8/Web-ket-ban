// Tổng quan, phân quyền Admin, thống kê hệ thống và nhật ký hoạt động.
import { el, fmtDate, badge, rpc, toast, confirmDialog, pager } from "./admin-core.js";

const ACTION = { lock: ["Khóa tài khoản", "bad"], unlock: ["Mở khóa", "ok"], grant_admin: ["Cấp quyền Admin", "gold"], revoke_admin: ["Gỡ quyền Admin", "warn"], view_user: ["Xem chi tiết", ""], content: ["Kiểm duyệt nội dung", ""] };

function logTable(parent, rows) {
    if (!rows.length) { el("p", "adm-empty", "Chưa có hoạt động nào.", parent); return; }
    const wrap = el("div", "adm-tablewrap", null, parent), table = el("table", "adm-table", null, wrap);
    const hr = el("tr", "", null, el("thead", "", null, table));
    ["Thời gian", "Quản trị viên", "Thao tác", "Đối tượng", "Chi tiết"].forEach(h => el("th", "", h, hr));
    const tb = el("tbody", "", null, table);
    rows.forEach(r => {
        const tr = el("tr", "", null, tb); const [label, tone] = ACTION[r.action] || [r.action, ""];
        el("td", "", fmtDate(r.created_at, true), tr); el("td", "mail", r.admin_email || "—", tr);
        badge(label, tone, el("td", "", null, tr)); el("td", "mail", r.target_email || "—", tr); el("td", "mail", r.details || "—", tr);
    });
}

export async function showOverview(root) {
    const card = el("section", "adm-card", null, root); el("h2", "", "Hoạt động quản trị gần đây", card);
    try { logTable(card, (await rpc("admin_activity_list", { p_action: "all", p_limit: 8, p_offset: 0 })).filter(r => r.action !== "view_user")); }
    catch (e) { el("p", "adm-empty", e.message, card); }
    const tips = el("section", "adm-card", null, root); el("h2", "", "Bảo mật quản trị", tips);
    ["Quyền được kiểm tra ở máy chủ cho mọi thao tác; ẩn nút trên giao diện không thay thế việc đó.", "Mật khẩu người dùng không bao giờ được hiển thị. Service Role Key không được dùng trong trình duyệt.", "Khóa, mở khóa, phân quyền và việc xem chi tiết tài khoản đều được ghi vào nhật ký."].forEach(t => el("p", "adm-note", "✦ " + t, tips));
}

export async function showAdmins(root, ctx) {
    const card = el("section", "adm-card", null, root);
    el("p", "adm-note", ctx.role === "owner" ? "Để cấp quyền, mở tài khoản trong mục Tìm kiếm tài khoản và chọn Cấp quyền Admin. Chỉ tài khoản đã xác minh email mới được cấp." : "Chỉ owner mới cấp hoặc gỡ được quyền quản trị.", card);
    let rows; try { rows = await rpc("admin_list_admins"); } catch (e) { el("p", "adm-empty", e.message, card); return; }
    const wrap = el("div", "adm-tablewrap", null, card), table = el("table", "adm-table", null, wrap);
    const hr = el("tr", "", null, el("thead", "", null, table));
    ["Quản trị viên", "Vai trò", "Từ ngày", "Cấp bởi", ""].forEach(h => el("th", "", h, hr));
    const tb = el("tbody", "", null, table);
    rows.forEach(r => {
        const tr = el("tr", "", null, tb), c1 = el("td", "mail", null, tr);
        el("strong", "", r.display_name || "(chưa có tên)", c1); el("small", "", r.email, c1);
        badge(r.role === "owner" ? "Owner" : "Admin", "gold", el("td", "", null, tr));
        el("td", "", fmtDate(r.created_at), tr); el("td", "mail", r.granted_by_email || "—", tr);
        const c5 = el("td", "", null, tr);
        if (ctx.role === "owner" && r.role !== "owner" && r.user_id !== ctx.userId) {
            const b = el("button", "adm-btn is-danger", "Gỡ quyền", c5); b.type = "button";
            b.onclick = async () => {
                if (!await confirmDialog({ title: "Gỡ quyền quản trị?", body: `${r.email} sẽ không còn truy cập được trang quản trị.`, confirmLabel: "Gỡ quyền", danger: true })) return;
                try { await rpc("admin_set_admin_role", { p_user_id: r.user_id, p_make_admin: false }); toast("Đã gỡ quyền quản trị."); ctx.refresh(); root.replaceChildren(); showAdmins(root, ctx); } catch (e) { toast(e.message, true); }
            };
        }
    });
}

export async function showStats(root) {
    let s; try { s = await rpc("admin_stats", { p_days: 30 }); } catch (e) { el("p", "adm-empty", e.message, root); return; }
    const t = s.totals, pct = n => t.total ? Math.round(n * 100 / t.total) : 0;
    const split = el("div", "adm-split", null, root);
    [["Đăng ký mới (30 ngày)", t.new_30d, null], ["Hoạt động 7 ngày", t.active_7d, pct(t.active_7d)], ["Hoạt động 30 ngày", t.active_30d, pct(t.active_30d)], ["Đã xác minh email", t.verified, pct(t.verified)]].forEach(([label, n, p]) => {
        const c = el("div", "adm-card", null, split); el("span", "adm-note", label, c); el("strong", "", String(n), c).style.cssText = "display:block;font:800 28px Manrope,sans-serif";
        if (p != null) { el("div", "adm-meter", null, c).appendChild(el("i")).style.width = p + "%"; el("small", "adm-note", `${p}% tổng người dùng`, c); }
    });
    const card = el("section", "adm-card", null, root); el("h2", "", "Đăng ký mới theo ngày (30 ngày gần nhất)", card);
    const max = Math.max(1, ...s.signups.map(d => d.count)), bars = el("div", "adm-bars", null, card);
    bars.setAttribute("role", "img"); bars.setAttribute("aria-label", `Biểu đồ đăng ký mới theo ngày, cao nhất ${max} tài khoản/ngày`);
    s.signups.forEach(d => { const b = el("div", "adm-bar", null, bars); b.style.height = Math.max(2, d.count / max * 100) + "%"; b.title = `${fmtDate(d.day)}: ${d.count}`; });
    const ax = el("div", "adm-axis", null, card); el("span", "", fmtDate(s.signups[0]?.day), ax); el("span", "", fmtDate(s.signups.at(-1)?.day), ax);
}

export async function showLogs(root) {
    const bar = el("div", "adm-toolbar", null, root), sel = el("select", "", null, bar); sel.setAttribute("aria-label", "Lọc thao tác");
    [["all", "Tất cả thao tác"], ["lock", "Khóa tài khoản"], ["unlock", "Mở khóa"], ["grant_admin", "Cấp quyền Admin"], ["revoke_admin", "Gỡ quyền Admin"], ["view_user", "Xem chi tiết"], ["content", "Kiểm duyệt nội dung"]].forEach(([v, t]) => { el("option", "", t, sel).value = v; });
    const out = el("div", "", null, root); let offset = 0; const LIMIT = 30;
    async function load() {
        out.replaceChildren(el("p", "adm-empty", "Đang tải..."));
        try {
            const rows = await rpc("admin_activity_list", { p_action: sel.value, p_limit: LIMIT, p_offset: offset });
            out.replaceChildren(); logTable(out, rows);
            if (rows.length) pager(out, { total: Number(rows[0].total_count), offset, limit: LIMIT }, o => { offset = o; load(); });
        } catch (e) { out.replaceChildren(el("p", "adm-empty", e.message)); }
    }
    sel.addEventListener("change", () => { offset = 0; load(); }); load();
}
