// Báo cáo nội dung, chặn người dùng và quản lý danh sách đã chặn (dùng chung cho mọi trang).
import { supabase } from "./supabase.js";

const REASONS = [
    ["spam", "Spam hoặc quảng cáo"],
    ["harassment", "Quấy rối, xúc phạm"],
    ["sexual", "Nội dung nhạy cảm"],
    ["violence", "Bạo lực hoặc đe dọa"],
    ["privacy", "Lộ thông tin cá nhân"],
    ["other", "Lý do khác"]
];

// CSS: css/safety.css được nạp tĩnh trong HTML của các trang dùng module này.

const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };

let toastTimer = null;
export function notify(text) {
    document.querySelector(".safety-toast")?.remove();
    const t = el("div", "safety-toast", text, document.body);
    t.setAttribute("role", "status");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.remove(), 4500);
}

const friendly = error => error?.message && /quá nhanh|quá nhiều/.test(error.message) ? error.message : "Chưa thực hiện được. Vui lòng thử lại sau.";

async function currentUserId() {
    const { data } = await supabase.auth.getUser();
    return data?.user?.id || null;
}

function openDialog(build) {
    return new Promise(resolve => {
        const dialog = el("dialog", "safety-dialog", null, document.body);
        const finish = value => { if (dialog.open) dialog.close(); dialog.remove(); resolve(value); };
        dialog.addEventListener("cancel", e => { e.preventDefault(); finish(null); });
        dialog.addEventListener("click", e => { if (e.target === dialog) finish(null); });
        build(dialog, finish);
        dialog.showModal();
    });
}

function askReason(title) {
    return openDialog((dialog, finish) => {
        el("h2", null, title, dialog);
        el("p", null, "Báo cáo được gửi riêng cho quản trị viên. Người đăng sẽ không biết ai đã báo cáo.", dialog);
        const fs = el("fieldset", "safety-reasons", null, dialog);
        REASONS.forEach(([value, label], i) => {
            const row = el("label", null, null, fs);
            const input = el("input", null, null, row); input.type = "radio"; input.name = "reason"; input.value = value; input.checked = i === 0;
            row.append(label);
        });
        const details = el("textarea", null, null, dialog); details.maxLength = 500; details.placeholder = "Mô tả thêm (không bắt buộc)"; details.setAttribute("aria-label", "Mô tả thêm");
        const actions = el("div", "safety-actions", null, dialog);
        const cancel = el("button", null, "Hủy", actions); cancel.type = "button"; cancel.onclick = () => finish(null);
        const send = el("button", "safety-primary", "Gửi báo cáo", actions); send.type = "button";
        send.onclick = () => finish({ reason: fs.querySelector("input:checked").value, details: details.value.trim() || null });
    });
}

// type: moment | moment_comment | community_post | community_comment | profile | profile_post
export async function reportContent(type, id, label = "Báo cáo nội dung này") {
    const userId = await currentUserId();
    if (!userId) { notify("Hãy đăng nhập để báo cáo."); return false; }
    const choice = await askReason(label);
    if (!choice) return false;
    const { error } = await supabase.from("content_reports").insert({ reporter_id: userId, content_type: type, content_id: String(id), reason: choice.reason, details: choice.details });
    if (error) { notify(error.code === "23505" ? "Bạn đã báo cáo nội dung này rồi. Cảm ơn bạn." : friendly(error)); return error.code === "23505"; }
    notify("Đã gửi báo cáo. Cảm ơn bạn đã giúp cộng đồng an toàn hơn.");
    return true;
}

export async function blockUser(userId, name = "người dùng này") {
    const me = await currentUserId();
    if (!me) { notify("Hãy đăng nhập để chặn."); return false; }
    if (!window.confirm(`Chặn ${name}? Hai bên sẽ không thấy hồ sơ, bài viết hay nhắn tin cho nhau. Bạn có thể bỏ chặn trong "Danh sách đã chặn".`)) return false;
    const { error } = await supabase.from("user_blocks").insert({ blocker_id: me, blocked_id: userId });
    if (error && error.code !== "23505") { notify(friendly(error)); return false; }
    notify("Đã chặn."); return true;
}

export async function blockMomentAuthor(momentId) {
    if (!window.confirm("Chặn người đăng bài này? Bạn sẽ không còn thấy bài của họ và họ cũng không thấy bài của bạn. Danh tính của họ vẫn được giữ ẩn.")) return false;
    const { error } = await supabase.rpc("block_moment_author", { p_moment_id: momentId });
    if (error) { notify(friendly(error)); return false; }
    notify("Đã chặn."); return true;
}

export async function blockThreadGuest(threadId) {
    if (!window.confirm("Chặn người đang nhắn tin này? Họ sẽ không thể nhắn thêm cho bạn.")) return false;
    const { error } = await supabase.rpc("block_thread_guest", { p_thread_id: threadId });
    if (error) { notify(friendly(error)); return false; }
    notify("Đã chặn."); return true;
}

// Dùng để lọc phía client những nơi không đi qua view (ví dụ bảng tin cộng đồng).
export async function getBlockedIds() {
    const me = await currentUserId();
    if (!me) return new Set();
    const { data } = await supabase.from("user_blocks").select("blocked_id").eq("blocker_id", me);
    return new Set((data || []).map(r => r.blocked_id));
}

export async function openBlockedDialog() {
    const { data, error } = await supabase.rpc("my_blocks");
    return openDialog((dialog, finish) => {
        el("h2", null, "Danh sách đã chặn", dialog);
        if (error) el("p", null, "Chưa tải được danh sách. Hãy chắc chắn đã chạy supabase/safety_hardening.sql.", dialog);
        else if (!data?.length) el("p", null, "Bạn chưa chặn ai.", dialog);
        else {
            const ul = el("ul", "safety-block-list", null, dialog);
            data.forEach(row => {
                const li = el("li", null, null, ul);
                const info = el("div", null, null, li);
                el("strong", null, row.source === "anonymous" ? "Người dùng ẩn danh" : (row.display_name || "Thành viên Connect"), info);
                el("small", null, "Chặn ngày " + new Date(row.created_at).toLocaleDateString("vi-VN"), info);
                const b = el("button", "safety-link", "Bỏ chặn", li); b.type = "button";
                b.onclick = async () => {
                    b.disabled = true;
                    const me = await currentUserId();
                    const { error: delError } = await supabase.from("user_blocks").delete().eq("blocker_id", me).eq("blocked_id", row.blocked_id);
                    if (delError) { b.disabled = false; notify(friendly(delError)); return; }
                    li.remove(); notify("Đã bỏ chặn.");
                };
            });
        }
        const actions = el("div", "safety-actions", null, dialog);
        const close = el("button", null, "Đóng", actions); close.type = "button"; close.onclick = () => finish(null);
    });
}

// Tạo nút nhỏ kiểu liên kết.
export function safetyButton(text, onClick, parent) {
    const b = el("button", "safety-link", text, parent); b.type = "button"; b.addEventListener("click", onClick); return b;
}
