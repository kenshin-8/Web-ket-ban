// Vòng tròn 12 cung: bấm vào một ký hiệu để mở cửa sổ thông tin ở giữa màn hình (không chuyển trang)
import { ZODIAC_INFO } from "./zodiac-info.js";

const wheel = document.querySelector(".zodiac-wheel");
if (wheel) {
    const SECTIONS = [
        ["✨", "Tính cách và điểm nổi bật", "trait"],
        ["💗", "Tình yêu và các mối quan hệ", "love"],
        ["🌱", "Học tập và công việc", "work"],
        ["🌙", "Lời khuyên dành cho cung này", "advice"]
    ];
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };

    // Dựng cửa sổ (gắn vào <body> để luôn nằm giữa màn hình)
    const overlay = el("div", "zm-overlay", null, document.body);
    overlay.hidden = true;
    const dialog = el("div", "zm-dialog", null, overlay);
    dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true"); dialog.setAttribute("aria-labelledby", "zmTitle"); dialog.tabIndex = -1;
    const closeBtn = el("button", "zm-close", "✕", dialog); closeBtn.type = "button"; closeBtn.setAttribute("aria-label", "Đóng");
    const head = el("header", "zm-head", null, dialog);
    const glyph = el("div", "zm-glyph", null, head);
    const titles = el("div", null, null, head);
    const title = el("h2", null, null, titles); title.id = "zmTitle";
    const meta = el("p", "zm-meta", null, titles);
    const body = el("div", "zm-body", null, dialog);
    const rows = SECTIONS.map(([icon, label]) => {
        const s = el("section", "zm-sec", null, body);
        const h = el("h3", null, null, s); el("span", null, icon, h); h.append(" " + label);
        return el("p", null, null, s);
    });
    el("p", "zm-note", "Nội dung mang tính tham khảo và giải trí.", dialog);

    let lastFocus = null;
    const open = (name, trigger) => {
        const d = ZODIAC_INFO[name]; if (!d) return;
        lastFocus = trigger;
        glyph.textContent = d.g; title.textContent = name; meta.textContent = `${d.range} · Cung ${d.el}`;
        SECTIONS.forEach(([, , key], i) => { rows[i].textContent = d[key]; });
        body.scrollTop = 0;
        overlay.hidden = false;
        requestAnimationFrame(() => overlay.classList.add("show"));
        document.body.classList.add("zm-open");
        wheel.classList.add("paused"); // giữ nguyên vị trí vòng tròn khi đang mở
        dialog.focus();
    };
    const close = () => {
        overlay.classList.remove("show");
        document.body.classList.remove("zm-open");
        wheel.classList.remove("paused");
        setTimeout(() => { overlay.hidden = true; }, 200);
        lastFocus?.focus();
    };

    wheel.addEventListener("click", e => {
        const b = e.target.closest(".zw-btn");
        if (b) open(b.dataset.sign, b);
    });
    closeBtn.addEventListener("click", close);
    overlay.addEventListener("click", e => { if (e.target === overlay) close(); });
    document.addEventListener("keydown", e => {
        if (overlay.hidden) return;
        if (e.key === "Escape") close();
        if (e.key === "Tab") { // giữ focus trong cửa sổ
            e.preventDefault(); (document.activeElement === closeBtn ? dialog : closeBtn).focus();
        }
    });
}
