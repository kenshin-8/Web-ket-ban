// Trang quản trị báo cáo. Mọi quyền được kiểm tra phía server (is_admin); trang này chỉ là giao diện.
import { supabase } from "./supabase.js";

const $ = id => document.getElementById(id);
const notice = $("adminNotice"), app = $("adminApp"), list = $("reportList");

const TYPE_LABEL = {
    moment: "Bài ở Quảng trường", moment_comment: "Bình luận ở Quảng trường",
    community_post: "Bài cộng đồng", community_comment: "Bình luận cộng đồng",
    profile: "Hồ sơ", profile_post: "Bài trên hồ sơ"
};
const REASON_LABEL = { spam: "Spam", harassment: "Quấy rối", sexual: "Nhạy cảm", violence: "Bạo lực", privacy: "Lộ thông tin", other: "Khác" };
const STATE_LABEL = { hidden: "Đang ẩn", gone: "Đã bị xóa" };
const HIDE_RESTORE = [["hide", "Ẩn", true], ["restore", "Khôi phục", false], ["dismiss", "Bỏ qua", false]];
const ACTIONS = {
    moment: HIDE_RESTORE, moment_comment: HIDE_RESTORE,
    community_post: [["remove", "Xóa bài", true], ["dismiss", "Bỏ qua", false]],
    community_comment: [["remove", "Xóa bình luận", true], ["dismiss", "Bỏ qua", false]],
    profile_post: [["remove", "Xóa bài", true], ["dismiss", "Bỏ qua", false]],
    profile: [["unlist", "Gỡ khỏi danh sách công khai", true], ["dismiss", "Bỏ qua", false]]
};
const CONFIRM = {
    remove: "Xóa vĩnh viễn nội dung này? Không thể hoàn tác.",
    unlist: "Gỡ hồ sơ này khỏi danh sách công khai?"
};

const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };
const message = text => { $("adminMessage").textContent = text || ""; };
const explain = error => /Không có quyền/.test(error?.message || "") ? "Bạn không có quyền quản trị."
    : /function .* does not exist|schema cache/i.test(error?.message || "") ? "Chưa có hàm quản trị. Hãy chạy supabase/migrations/012_admin_moderation.sql."
    : "Có lỗi xảy ra. Vui lòng thử lại.";

function renderCard(row, status) {
    const card = el("article", "admin-card");
    const head = el("div", "admin-card-head", null, card);
    el("span", "admin-type", TYPE_LABEL[row.content_type] || row.content_type, head);
    el("span", "admin-badge is-count", `${row.report_count} báo cáo`, head);
    (row.reasons || []).forEach(r => el("span", "admin-badge", REASON_LABEL[r] || r, head));
    if (STATE_LABEL[row.content_state]) el("span", `admin-badge is-${row.content_state}`, STATE_LABEL[row.content_state], head);

    const preview = el("p", "admin-preview", row.preview || "(không còn nội dung)", card);
    if (!row.preview) preview.classList.add("is-empty");
    if (row.details?.length) {
        const ul = el("ul", "admin-details", null, card);
        row.details.forEach(d => el("li", null, d, ul));
    }

    const actions = el("div", "admin-actions", null, card);
    const gone = row.content_state === "gone";
    (ACTIONS[row.content_type] || [["dismiss", "Bỏ qua", false]]).forEach(([action, label, danger]) => {
        if (gone && action !== "dismiss") return;
        if (status !== "open" && action === "dismiss") return;
        if (action === "hide" && row.content_state === "hidden") return;
        if (action === "restore" && row.content_state !== "hidden") return;
        const b = el("button", danger ? "is-danger" : "", label, actions); b.type = "button";
        b.addEventListener("click", async () => {
            if (CONFIRM[action] && !window.confirm(CONFIRM[action])) return;
            actions.querySelectorAll("button").forEach(x => { x.disabled = true; });
            const { error } = await supabase.rpc("admin_resolve_content", { p_content_type: row.content_type, p_content_id: row.content_id, p_action: action });
            if (error) { console.error(error); message(explain(error)); actions.querySelectorAll("button").forEach(x => { x.disabled = false; }); return; }
            message("Đã xử lý.");
            load();
        });
    });
    return card;
}

async function load() {
    const status = $("statusFilter").value;
    list.replaceChildren();
    $("adminCount").textContent = "";
    const { data, error } = await supabase.rpc("admin_report_queue", { p_status: status, p_limit: 50 });
    if (error) { console.error(error); message(explain(error)); return; }
    const rows = data || [];
    $("adminCount").textContent = rows.length ? `${rows.length} nội dung` : "";
    if (!rows.length) { el("p", "privacy-note", status === "open" ? "Không có báo cáo nào đang chờ. 🎉" : "Chưa có mục nào.", list); return; }
    rows.forEach(row => list.appendChild(renderCard(row, status)));
}

async function init() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) { notice.textContent = ""; const p = el("span", null, "Vui lòng ", notice); const a = el("a", null, "đăng nhập", p); a.href = "login.html"; p.append(" để tiếp tục."); return; }
    const { data: isAdmin, error } = await supabase.rpc("is_admin");
    if (error) { console.error(error); notice.textContent = explain(error); return; }
    if (!isAdmin) { notice.textContent = "Bạn không có quyền truy cập trang này."; return; }
    notice.textContent = "Chỉ hiển thị nội dung bị báo cáo. Danh tính tác giả bài ẩn danh không được tiết lộ.";
    app.hidden = false;
    $("statusFilter").addEventListener("change", () => { message(""); load(); });
    $("reloadBtn").addEventListener("click", () => { message(""); load(); });
    load();
}
init();
