// Hàng đợi báo cáo nội dung. Thao tác xử lý đi qua RPC admin_resolve_content (kiểm tra is_admin ở máy chủ).
import { el, rpc, toast, confirmDialog } from "./admin-core.js";

const TYPE_LABEL = { moment: "Bài ở Quảng trường", moment_comment: "Bình luận ở Quảng trường", community_post: "Bài cộng đồng", community_comment: "Bình luận cộng đồng", profile: "Hồ sơ", profile_post: "Bài trên hồ sơ" };
const REASON_LABEL = { spam: "Spam", harassment: "Quấy rối", sexual: "Nhạy cảm", violence: "Bạo lực", privacy: "Lộ thông tin", other: "Khác" };
const STATE_LABEL = { hidden: "Đang ẩn", gone: "Đã bị xóa" };
const HIDE_RESTORE = [["hide", "Ẩn", true], ["restore", "Khôi phục", false], ["dismiss", "Bỏ qua", false]];
const ACTIONS = { moment: HIDE_RESTORE, moment_comment: HIDE_RESTORE, community_post: [["remove", "Xóa bài", true], ["dismiss", "Bỏ qua", false]], community_comment: [["remove", "Xóa bình luận", true], ["dismiss", "Bỏ qua", false]], profile_post: [["remove", "Xóa bài", true], ["dismiss", "Bỏ qua", false]], profile: [["unlist", "Gỡ khỏi danh sách công khai", true], ["dismiss", "Bỏ qua", false]] };
const CONFIRM = { remove: "Xóa vĩnh viễn nội dung này? Không thể hoàn tác.", unlist: "Gỡ hồ sơ này khỏi danh sách công khai?" };

export function showReports(root, ctx) {
    const bar = el("div", "adm-toolbar", null, root), sel = el("select", "", null, bar); sel.setAttribute("aria-label", "Trạng thái báo cáo");
    [["open", "Đang chờ xử lý"], ["actioned", "Đã xử lý"], ["dismissed", "Đã bỏ qua"]].forEach(([v, t]) => { el("option", "", t, sel).value = v; });
    const reload = el("button", "adm-btn", "Tải lại", bar); reload.type = "button";
    el("p", "adm-note", "Chỉ hiển thị nội dung bị báo cáo. Danh tính tác giả bài ẩn danh không được tiết lộ.", root);
    const list = el("div", "admin-list", null, root);

    async function load() {
        list.replaceChildren(el("p", "adm-empty", "Đang tải..."));
        let rows; try { rows = await rpc("admin_report_queue", { p_status: sel.value, p_limit: 50 }); } catch (e) { list.replaceChildren(el("p", "adm-empty", e.message)); return; }
        list.replaceChildren();
        if (!rows.length) { el("p", "adm-empty", sel.value === "open" ? "Không có báo cáo nào đang chờ. 🎉" : "Chưa có mục nào.", list); return; }
        rows.forEach(r => list.appendChild(card(r)));
    }
    function card(row) {
        const c = el("article", "admin-card"), head = el("div", "admin-card-head", null, c);
        el("span", "admin-type", TYPE_LABEL[row.content_type] || row.content_type, head);
        el("span", "admin-badge is-count", `${row.report_count} báo cáo`, head);
        (row.reasons || []).forEach(x => el("span", "admin-badge", REASON_LABEL[x] || x, head));
        if (STATE_LABEL[row.content_state]) el("span", "admin-badge", STATE_LABEL[row.content_state], head);
        const p = el("p", "admin-preview", row.preview || "(không còn nội dung)", c); if (!row.preview) p.classList.add("is-empty");
        if (row.details?.length) { const ul = el("ul", "admin-details", null, c); row.details.forEach(d => el("li", "", d, ul)); }
        const actions = el("div", "admin-actions", null, c), gone = row.content_state === "gone";
        (ACTIONS[row.content_type] || [["dismiss", "Bỏ qua", false]]).forEach(([action, label, danger]) => {
            if (gone && action !== "dismiss") return;
            if (sel.value !== "open" && action === "dismiss") return;
            if (action === "hide" && row.content_state === "hidden") return;
            if (action === "restore" && row.content_state !== "hidden") return;
            const b = el("button", danger ? "is-danger" : "", label, actions); b.type = "button";
            b.onclick = async () => {
                if (CONFIRM[action] && !await confirmDialog({ title: "Xác nhận thao tác", body: CONFIRM[action], confirmLabel: label, danger: true })) return;
                actions.querySelectorAll("button").forEach(x => { x.disabled = true; });
                try { await rpc("admin_resolve_content", { p_content_type: row.content_type, p_content_id: row.content_id, p_action: action }); toast("Đã xử lý."); load(); }
                catch (e) { toast(e.message, true); actions.querySelectorAll("button").forEach(x => { x.disabled = false; }); }
            };
        });
        return c;
    }
    sel.onchange = load; reload.onclick = load; load();
}
