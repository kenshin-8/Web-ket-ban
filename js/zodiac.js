// Dữ liệu 12 cung hoàng đạo + bộ tìm cung theo ngày sinh (chạy hoàn toàn ở trình duyệt)
export const SIGNS = [
    { n: "Ma Kết", g: "♑", from: [12, 22], range: "22/12 – 19/1", el: "Đất", t: "Kiên trì, có tham vọng và kỷ luật." },
    { n: "Bảo Bình", g: "♒", from: [1, 20], range: "20/1 – 18/2", el: "Khí", t: "Độc lập, sáng tạo, yêu tự do." },
    { n: "Song Ngư", g: "♓", from: [2, 19], range: "19/2 – 20/3", el: "Nước", t: "Mơ mộng, giàu cảm xúc và đồng cảm." },
    { n: "Bạch Dương", g: "♈", from: [3, 21], range: "21/3 – 19/4", el: "Lửa", t: "Nhiệt huyết, dám nghĩ dám làm." },
    { n: "Kim Ngưu", g: "♉", from: [4, 20], range: "20/4 – 20/5", el: "Đất", t: "Điềm đạm, đáng tin, yêu cái đẹp." },
    { n: "Song Tử", g: "♊", from: [5, 21], range: "21/5 – 20/6", el: "Khí", t: "Hoạt bát, tò mò, giỏi giao tiếp." },
    { n: "Cự Giải", g: "♋", from: [6, 21], range: "21/6 – 22/7", el: "Nước", t: "Ấm áp, quan tâm, gắn bó gia đình." },
    { n: "Sư Tử", g: "♌", from: [7, 23], range: "23/7 – 22/8", el: "Lửa", t: "Tự tin, hào phóng, tỏa sáng." },
    { n: "Xử Nữ", g: "♍", from: [8, 23], range: "23/8 – 22/9", el: "Đất", t: "Tỉ mỉ, chu đáo, thích hoàn thiện." },
    { n: "Thiên Bình", g: "♎", from: [9, 23], range: "23/9 – 22/10", el: "Khí", t: "Hài hòa, công bằng, biết thấu hiểu." },
    { n: "Thiên Yết", g: "♏", from: [10, 23], range: "23/10 – 21/11", el: "Nước", t: "Sâu sắc, bí ẩn, đam mê mãnh liệt." },
    { n: "Nhân Mã", g: "♐", from: [11, 22], range: "22/11 – 21/12", el: "Lửa", t: "Lạc quan, thích khám phá và chân thật." }
];
export const signByName = name => SIGNS.find(s => s.n === name) || null;
/** Trả về cung theo tháng (1-12) và ngày. */
export function signOf(month, day) {
    const v = month * 100 + day;
    let best = null, bestStart = -1;
    SIGNS.forEach(s => { const st = s.from[0] * 100 + s.from[1]; if (st <= v && st > bestStart) { best = s; bestStart = st; } });
    return best || SIGNS[0]; // trước 20/1: vẫn là Ma Kết
}
const grid = typeof document !== "undefined" ? document.getElementById("zodiacGrid") : null;
if (grid) {
    const today = new Date(), todaySign = signOf(today.getMonth() + 1, today.getDate());
    const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };
    const order = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2].map(i => SIGNS[i]); // Bạch Dương → Song Ngư
    const cards = new Map();
    order.forEach(s => {
        const c = el("article", "zd-card", null, grid);
        el("div", "zd-glyph", s.g, c); el("h3", null, s.n, c); el("small", null, s.range, c); el("span", "zd-el", "Cung " + s.el, c); el("p", null, s.t, c);
        cards.set(s.n, c);
    });
    document.getElementById("zdToday").textContent = `Hôm nay Mặt Trời đang ở cung ${todaySign.g} ${todaySign.n}.`;
    const input = document.getElementById("zdBirth"), out = document.getElementById("zdResult");
    const find = () => {
        cards.forEach(c => c.classList.remove("me"));
        if (!input.value) { out.textContent = ""; return; }
        const [, m, d] = input.value.split("-").map(Number);
        const s = signOf(m, d); cards.get(s.n).classList.add("me");
        out.textContent = `Bạn thuộc cung ${s.g} ${s.n} (${s.el}). ${s.t}`;
    };
    input.addEventListener("change", find);
}
