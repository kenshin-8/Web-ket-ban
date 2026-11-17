// Dữ liệu & thuật toán Soul Quiz / Soul Match (chạy hoàn toàn ở trình duyệt, không dùng AI bên ngoài)
import { signByName } from "./zodiac.js";
export const PLANETS = {
    aurora: { name: "Aurora", icon: "🌌", desc: "Sáng tạo, giàu trí tưởng tượng, yêu cái đẹp và ý tưởng mới." },
    terra: { name: "Terra", icon: "🌿", desc: "Vững vàng, thực tế, yêu thiên nhiên và những điều giản dị." },
    nova: { name: "Nova", icon: "🚀", desc: "Năng động, thích phiêu lưu, luôn muốn thử điều chưa từng làm." },
    luna: { name: "Luna", icon: "🌙", desc: "Sâu sắc, đồng cảm, thích lắng nghe và những cuộc trò chuyện chân thành." }
};
const KEYS = Object.keys(PLANETS);
const AFFINITY = { "aurora-luna": .85, "aurora-nova": .75, "terra-luna": .75, "terra-nova": .6, "aurora-terra": .6, "luna-nova": .55 };
const q = (text, a, b, c, d) => ({ text, options: [["aurora", a], ["terra", b], ["nova", c], ["luna", d]] });
export const QUESTIONS = [
    q("Cuối tuần lý tưởng của bạn là gì?", "Vẽ, viết hoặc sáng tạo gì đó", "Dạo công viên, nấu ăn tại nhà", "Đi đâu đó thật xa, thử trải nghiệm mới", "Ở nhà đọc sách, nghe nhạc một mình"),
    q("Khi bạn bè gặp chuyện buồn, bạn thường…", "Gợi ý cách nhìn mới mẻ", "Giúp giải quyết việc cụ thể", "Rủ đi chơi cho khuây khỏa", "Ngồi lại lắng nghe thật lâu"),
    q("Điều bạn coi trọng nhất trong một mối quan hệ?", "Cùng nhau tạo ra điều đặc biệt", "Sự tin cậy, ổn định", "Cùng nhau khám phá, không nhàm chán", "Được thấu hiểu thật sự"),
    q("Bạn mô tả bản thân gần nhất với…", "Mơ mộng và độc đáo", "Điềm tĩnh và đáng tin", "Hào hứng và liều lĩnh", "Nhạy cảm và chu đáo"),
    q("Một buổi tối bất ngờ rảnh, bạn chọn…", "Xem triển lãm, phim nghệ thuật", "Một bữa tối ấm cúng với người thân", "Đi cùng nhóm bạn tới nơi mới lạ", "Trò chuyện sâu với một người bạn"),
    q("Bạn muốn cuộc sống của mình trong 5 năm tới…", "Đầy cảm hứng sáng tạo", "Bình yên và vững chãi", "Nhiều chuyến đi, nhiều thử thách", "Gắn kết, ý nghĩa với những người thân thiết")
];
export function scoreAnswers(answers) {
    const scores = Object.fromEntries(KEYS.map(k => [k, 0]));
    answers.forEach(k => { if (k in scores) scores[k]++; });
    const planet = KEYS.reduce((best, k) => scores[k] > scores[best] ? k : best, KEYS[0]);
    return { planet, scores };
}
// Lửa–Khí và Đất–Nước hợp nhau; Lửa–Nước và Khí–Đất dễ xung khắc. (Khóa đã sắp theo thứ tự chữ cái)
const ELEMENT_AFFINITY = { "Khí-Lửa": .9, "Nước-Đất": .9, "Khí-Nước": .6, "Lửa-Đất": .6, "Khí-Đất": .4, "Lửa-Nước": .4 };
export const elementAffinity = (a, b) => a === b ? 1 : (ELEMENT_AFFINITY[[a, b].sort().join("-")] ?? .5);
const cosine = (a, b) => {
    a = a || {}; b = b || {}; // Supabase trả về null, không phải undefined
    const dot = KEYS.reduce((s, k) => s + (a[k] || 0) * (b[k] || 0), 0);
    const n = o => Math.sqrt(KEYS.reduce((s, k) => s + (o[k] || 0) ** 2, 0));
    return n(a) && n(b) ? dot / (n(a) * n(b)) : 0;
};
const norm = list => new Set((list || []).map(x => String(x).trim().toLocaleLowerCase("vi-VN")));
/** Độ tương thích 0–100: 50% vector tính cách, 30% quan hệ giữa hai tinh cầu, 20% sở thích chung. */
export function compat(me, other) {
    const pa = me.planet === other.planet ? 1 : (AFFINITY[[me.planet, other.planet].sort().join("-")] ?? .5);
    const A = norm(me.interests), B = norm(other.interests);
    const inter = [...A].filter(x => B.has(x)).length, union = new Set([...A, ...B]).size;
    const base = cosine(me.soul_scores, other.soul_scores), ji = union ? inter / union : 0;
    const sa = signByName(me.zodiac), sb = signByName(other.zodiac);
    if (!sa || !sb) return Math.round(100 * (.5 * base + .3 * pa + .2 * ji));
    return Math.round(100 * (.4 * base + .25 * pa + .15 * ji + .2 * elementAffinity(sa.el, sb.el)));
}
export function distanceKm(lat1, lng1, lat2, lng2) {
    const r = x => x * Math.PI / 180, dLat = r(lat2 - lat1), dLng = r(lng2 - lng1);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(dLng / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(h));
}
