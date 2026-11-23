// Tiện ích dùng chung cho trang quản trị. Mọi quyền được kiểm tra ở máy chủ (RPC is_admin); đây chỉ là giao diện.
import { supabase } from "./supabase.js";

export const $ = id => document.getElementById(id);
export const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };
export const fmtDate = (v, time = false) => v ? new Date(v).toLocaleString("vi-VN", time ? { dateStyle: "short", timeStyle: "short" } : { dateStyle: "medium" }) : "—";
export const badge = (text, tone, parent) => el("span", `badge ${tone || ""}`, text, parent);

// Thông báo lỗi từ máy chủ (mã P0001) là câu tiếng Việt do chính các hàm SQL viết; lỗi khác chỉ hiện thông báo chung.
export function explain(error) {
    const msg = error?.message || "";
    if (error?.code === "P0001" && msg) return msg;
    if (/function .* does not exist|schema cache/i.test(msg)) return "Chưa có hàm quản trị. Hãy chạy migration 012 và 020 trong supabase/migrations.";
    return "Có lỗi xảy ra. Vui lòng thử lại.";
}

export async function rpc(name, args) {
    const { data, error } = await supabase.rpc(name, args);
    if (error) { console.error(name, error); throw new Error(explain(error)); }
    return data;
}

let toastTimer;
export function toast(text, isError = false) {
    document.querySelector(".adm-toast")?.remove();
    const t = el("div", `adm-toast${isError ? " is-error" : ""}`, text, document.body);
    t.setAttribute("role", isError ? "alert" : "status");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.remove(), 5000);
}

// Hộp thoại xác nhận cho thao tác quan trọng. Trả về { reason } khi xác nhận, hoặc null khi hủy.
export function confirmDialog({ title, body, confirmLabel = "Xác nhận", danger = false, reasonLabel = "" }) {
    const dlg = $("dlg");
    dlg.replaceChildren();
    const box = el("div", "inner", null, dlg);
    el("h3", "", title, box);
    el("p", "adm-note", body, box);
    let ta;
    if (reasonLabel) { ta = el("textarea", "", "", box); ta.placeholder = reasonLabel; ta.maxLength = 300; ta.setAttribute("aria-label", reasonLabel); }
    const row = el("div", "row", null, box);
    const cancel = el("button", "adm-btn", "Hủy", row); cancel.type = "button";
    const ok = el("button", `adm-btn ${danger ? "is-danger" : "is-primary"}`, confirmLabel, row); ok.type = "button";
    return new Promise(resolve => {
        let result = null;
        cancel.onclick = () => dlg.close();
        ok.onclick = () => {
            if (ta && ta.value.trim().length < 3) { ta.focus(); ta.style.borderColor = "var(--bad)"; return; }
            result = { reason: ta ? ta.value.trim() : "" }; dlg.close();
        };
        dlg.onclose = () => resolve(result);
        dlg.showModal();
    });
}

export function pager(parent, { total, offset, limit }, go) {
    const bar = el("div", "adm-pager", null, parent);
    const from = total ? offset + 1 : 0, to = Math.min(offset + limit, total);
    el("span", "", `${from}–${to} / ${total}`, bar);
    const btns = el("div", "", null, bar);
    const prev = el("button", "adm-btn", "← Trước", btns); prev.type = "button"; prev.disabled = offset <= 0; prev.onclick = () => go(Math.max(0, offset - limit));
    btns.append(" ");
    const next = el("button", "adm-btn", "Sau →", btns); next.type = "button"; next.disabled = offset + limit >= total; next.onclick = () => go(offset + limit);
}
