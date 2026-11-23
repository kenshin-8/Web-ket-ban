// Quản lý người dùng: tìm kiếm, lọc, phân trang, xem chi tiết, khóa/mở khóa, phân quyền.
import { $, el, fmtDate, badge, rpc, toast, confirmDialog, pager } from "./admin-core.js";

const LIMIT = 20;

export async function showUsers(root, ctx, { lockedOnly = false } = {}) {
    const state = { q: "", status: lockedOnly ? "locked" : "all", verified: "all", offset: 0 };
    const bar = el("div", "adm-toolbar", null, root);
    const search = el("input", "", "", bar); search.type = "search"; search.placeholder = "Tìm theo email, tên hoặc ID..."; search.maxLength = 100; search.setAttribute("aria-label", "Tìm tài khoản");
    let status;
    if (!lockedOnly) {
        status = el("select", "", null, bar); status.setAttribute("aria-label", "Trạng thái tài khoản");
        [["all", "Mọi trạng thái"], ["active", "Không bị khóa"], ["locked", "Bị khóa"]].forEach(([v, t]) => { el("option", "", t, status).value = v; });
    }
    const ver = el("select", "", null, bar); ver.setAttribute("aria-label", "Xác minh email");
    [["all", "Mọi email"], ["verified", "Đã xác minh"], ["unverified", "Chưa xác minh"]].forEach(([v, t]) => { el("option", "", t, ver).value = v; });
    const out = el("div", "", null, root);

    async function load() {
        out.replaceChildren(el("p", "adm-empty", "Đang tải..."));
        let rows;
        try { rows = await rpc("admin_list_users", { p_search: state.q || null, p_status: state.status, p_verified: state.verified, p_limit: LIMIT, p_offset: state.offset }); }
        catch (e) { out.replaceChildren(el("p", "adm-empty", e.message)); return; }
        out.replaceChildren();
        if (!rows.length) { el("p", "adm-empty", lockedOnly ? "Không có tài khoản nào đang bị khóa." : "Không tìm thấy tài khoản phù hợp.", out); return; }
        const wrap = el("div", "adm-tablewrap", null, out), table = el("table", "adm-table", null, wrap);
        const hr = el("tr", "", null, el("thead", "", null, table));
        ["Tài khoản", "Ngày đăng ký", "Email", "Trạng thái", ""].forEach(h => el("th", "", h, hr));
        const tb = el("tbody", "", null, table);
        rows.forEach(r => {
            const tr = el("tr", "", null, tb);
            const c1 = el("td", "mail", null, tr); el("strong", "", r.display_name || "(chưa có tên)", c1); el("small", "", r.email, c1);
            el("td", "", fmtDate(r.created_at), tr);
            const c3 = el("td", "", null, tr); r.email_confirmed_at ? badge("Đã xác minh", "ok", c3) : badge("Chưa xác minh", "warn", c3);
            const c4 = el("td", "", null, tr);
            r.is_locked ? badge("Bị khóa", "bad", c4) : badge("Hoạt động", "ok", c4);
            if (r.is_admin) badge(r.admin_role === "owner" ? "Owner" : "Admin", "gold", c4);
            const c5 = el("td", "", null, tr), b = el("button", "adm-btn", "Chi tiết", c5); b.type = "button"; b.onclick = () => openDetail(r.user_id, ctx, load);
        });
        pager(out, { total: Number(rows[0].total_count), offset: state.offset, limit: LIMIT }, o => { state.offset = o; load(); });
    }
    let timer;
    search.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => { state.q = search.value.trim(); state.offset = 0; load(); }, 300); });
    status?.addEventListener("change", () => { state.status = status.value; state.offset = 0; load(); });
    ver.addEventListener("change", () => { state.verified = ver.value; state.offset = 0; load(); });
    load();
}

async function openDetail(id, ctx, reload) {
    let u;
    try { u = await rpc("admin_user_detail", { p_user_id: id }); } catch (e) { toast(e.message, true); return; }
    const dlg = $("dlg"); dlg.replaceChildren();
    const box = el("div", "inner", null, dlg);
    el("h3", "", u.display_name || "(chưa có tên hiển thị)", box);
    const tags = el("div", "", null, box);
    u.is_locked ? badge("Bị khóa", "bad", tags) : badge("Hoạt động", "ok", tags);
    u.email_confirmed_at ? badge("Email đã xác minh", "ok", tags) : badge("Email chưa xác minh", "warn", tags);
    if (u.is_admin) badge(u.admin_role === "owner" ? "Owner" : "Admin", "gold", tags);
    if (u.open_reports > 0) badge(`${u.open_reports} báo cáo hồ sơ`, "warn", tags);
    const kv = el("dl", "adm-kv", null, box);
    const add = (k, v) => { el("dt", "", k, kv); el("dd", "", v || "—", kv); };
    add("ID", u.id); add("Email đăng ký", u.email); add("Ngày đăng ký", fmtDate(u.created_at, true));
    add("Đăng nhập gần nhất", fmtDate(u.last_sign_in_at, true)); add("Phương thức", u.provider);
    add("Hồ sơ công khai", u.has_profile ? (u.is_visible ? "Đang hiển thị" : "Đang ẩn") : "Chưa tạo hồ sơ");
    add("Giới thiệu", u.headline); add("Thành phố", u.city); add("Sở thích", (u.interests || []).join(", ")); add("Tiểu sử", u.bio);
    if (u.is_locked) { add("Lý do khóa", u.lock_reason); add("Khóa lúc", fmtDate(u.locked_at, true)); add("Khóa bởi", u.locked_by_email); }
    el("p", "adm-note", "Mật khẩu không bao giờ được hiển thị hoặc truy cập qua trang này.", box);
    const row = el("div", "row", null, box);
    const close = el("button", "adm-btn", "Đóng", row); close.type = "button"; close.onclick = () => dlg.close();
    const self = u.id === ctx.userId;
    if (ctx.role === "owner" && !self && u.admin_role !== "owner") {
        const b = el("button", "adm-btn", u.is_admin ? "Gỡ quyền Admin" : "Cấp quyền Admin", row); b.type = "button";
        b.onclick = async () => {
            dlg.close();
            const ok = await confirmDialog({ title: u.is_admin ? "Gỡ quyền quản trị?" : "Cấp quyền quản trị?", body: `${u.email} sẽ ${u.is_admin ? "mất" : "có"} toàn quyền truy cập trang quản trị.`, confirmLabel: u.is_admin ? "Gỡ quyền" : "Cấp quyền", danger: u.is_admin });
            if (!ok) return;
            try { await rpc("admin_set_admin_role", { p_user_id: u.id, p_make_admin: !u.is_admin }); toast("Đã cập nhật quyền quản trị."); ctx.refresh(); reload(); } catch (e) { toast(e.message, true); }
        };
    }
    if (!self && !(u.is_admin && !u.is_locked)) {
        const b = el("button", `adm-btn ${u.is_locked ? "is-primary" : "is-danger"}`, u.is_locked ? "Mở khóa" : "Khóa tài khoản", row); b.type = "button";
        b.onclick = async () => {
            dlg.close();
            const ok = await confirmDialog(u.is_locked
                ? { title: "Mở khóa tài khoản?", body: `${u.email} sẽ đăng nhập và sử dụng Connect trở lại.`, confirmLabel: "Mở khóa" }
                : { title: "Khóa tài khoản?", body: `${u.email} sẽ bị đăng xuất, không đăng nhập được và hồ sơ bị gỡ khỏi danh sách công khai.`, confirmLabel: "Khóa tài khoản", danger: true, reasonLabel: "Lý do khóa (bắt buộc, ghi vào nhật ký)" });
            if (!ok) return;
            try { await rpc("admin_set_account_lock", { p_user_id: u.id, p_lock: !u.is_locked, p_reason: ok.reason }); toast(u.is_locked ? "Đã mở khóa tài khoản." : "Đã khóa tài khoản."); ctx.refresh(); reload(); } catch (e) { toast(e.message, true); }
        };
    }
    dlg.onclose = null; dlg.showModal();
}
