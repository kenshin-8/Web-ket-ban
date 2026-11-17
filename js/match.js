import { supabase } from "./supabase.js";
import { PLANETS, compat, distanceKm } from "./soul.js";
import { createAvatarSvg } from "./avatar-data.js";
import { signByName } from "./zodiac.js";
import { initSoulConnections, createSoulLikeButton, sharedInterests } from "./soul-connection.js";
const $ = id => document.getElementById(id);
const soulList = $("soulList"), nearList = $("nearList"), nearMsg = $("nearMessage");
let me = null, user = null;
const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };

function card(p, badge, note, score = 0) {
    const c = el("article", `member-card${score >= 80 ? " soul-lit" : ""}`);
    c.dataset.memberId = p.id;
    const av = el("div", "member-avatar", null, c);
    if (p.avatar_data) av.appendChild(createAvatarSvg(p.avatar_data, `Avatar của ${p.display_name}`));
    else { av.classList.add("member-avatar-fallback"); av.textContent = (p.display_name || "T").charAt(0).toLocaleUpperCase("vi-VN"); }
    el("h3", "member-name", p.display_name || "Thành viên Connect", c);
    const sg = signByName(p.zodiac);
    if (sg) el("span", "zodiac-badge", `${sg.g} ${sg.n} · Cung ${sg.el}`, c);
    const pl = PLANETS[p.planet];
    if (pl) {
        const orb = el("div", "planet-orb-mini", `${pl.icon} Tinh cầu ${pl.name}`, c);
        orb.title = pl.desc;
    }
    const matchGlow = el("div", "soul-match-glow", null, c);
    el("span", "match-badge", `✦ Độ tương hợp tâm hồn ${badge}`, matchGlow);
    if (note) el("p", "member-city", note, c);
    const common = [...new Set((me?.interests || []).map(x => String(x).trim()))]
        .filter(x => (p.interests || []).some(y => String(y).trim().toLocaleLowerCase("vi-VN") === x.toLocaleLowerCase("vi-VN")));
    const tags = el("div", "member-interests common-interests", null, c);
    if (common.length) {
        el("small", "common-interest-title", "♡ Hai bạn cùng quan tâm", tags);
        common.slice(0, 6).forEach(t => el("span", "interest-tag shared", String(t), tags));
    } else {
        el("small", "common-interest-title", "Khám phá thêm những sở thích của nhau", tags);
    }
    (p.interests || []).filter(t => !common.some(x => x.toLocaleLowerCase("vi-VN") === String(t).toLocaleLowerCase("vi-VN"))).slice(0, 4).forEach(t => el("span", "interest-tag", String(t), tags));
    const actions = el("div", "member-actions", null, c);
    createSoulLikeButton(p.id, score, common, actions);
    return c;
}
const empty = (box, text) => { box.replaceChildren(); el("p", "empty-message", text, box); };

async function loadSoul() {
    const { data, error } = await supabase.from("profiles").select("id, display_name, interests, planet, soul_scores, avatar_data, zodiac").eq("is_visible", true).not("planet", "is", null).neq("id", user.id).limit(200);
    if (error) { console.error(error); return empty(soulList, "Không thể tải gợi ý. Hãy kiểm tra lại cấu hình Supabase."); }
    const ranked = data.map(p => ({ p, score: compat(me, p) })).sort((a, b) => b.score - a.score).slice(0, 12);
    if (!ranked.length) return empty(soulList, "Chưa có thành viên công khai nào đã làm Soul Quiz. Hãy quay lại sau nhé!");
    soulList.replaceChildren(...ranked.map(({ p, score }) => card(p, `${score}%`, null, score)));
}

async function scanNearby() {
    nearMsg.textContent = "Đang lấy vị trí...";
    let pos;
    try { pos = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { timeout: 10000 })); }
    catch { nearMsg.textContent = "Không lấy được vị trí. Hãy cho phép quyền truy cập vị trí trong trình duyệt."; return; }
    const lat = +pos.coords.latitude.toFixed(2), lng = +pos.coords.longitude.toFixed(2); // làm tròn ~1 km, không lưu vị trí chính xác
    const radius = +$("radius").value;
    const { error: upErr } = await supabase.from("user_locations").upsert({ id: user.id, lat, lng, updated_at: new Date().toISOString() });
    if (upErr) { console.error(upErr); nearMsg.textContent = "Không lưu được vị trí: " + upErr.message; return; }
    $("stopShare").hidden = false;
    const { data: locs, error } = await supabase.from("user_locations").select("id, lat, lng").neq("id", user.id).limit(500);
    if (error) { nearMsg.textContent = "Không thể quét: " + error.message; return; }
    const near = locs.map(l => ({ id: l.id, km: distanceKm(lat, lng, l.lat, l.lng) })).filter(l => l.km <= radius);
    if (!near.length) { nearMsg.textContent = ""; return empty(nearList, `Chưa có ai trong bán kính ${radius} km.`); }
    const { data: profs } = await supabase.from("profiles").select("id, display_name, interests, planet, soul_scores, avatar_data, zodiac").eq("is_visible", true).in("id", near.map(n => n.id));
    const rows = (profs || []).map(p => ({ p, km: near.find(n => n.id === p.id).km, score: me.planet ? compat(me, p) : 0 })).sort((a, b) => b.score - a.score || a.km - b.km);
    nearMsg.textContent = "";
    if (!rows.length) return empty(nearList, "Có người ở gần nhưng chưa ai bật hiển thị hồ sơ công khai.");
    nearList.replaceChildren(...rows.map(({ p, km, score }) => card(p, `${score}%`, `Cách bạn khoảng ${km < 1 ? "dưới 1" : Math.round(km)} km`, score)));
}

async function init() {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
    if (!user) { $("guestNotice").hidden = false; return; }
    const { data: prof } = await supabase.from("profiles").select("planet, soul_scores, interests, zodiac").eq("id", user.id).maybeSingle();
    if (!prof?.planet) { $("quizNotice").hidden = false; return; }
    me = prof; initSoulConnections(user.id, me); $("matchApp").hidden = false;
    const pl = PLANETS[me.planet]; $("myPlanet").textContent = `${pl.icon} Tinh cầu ${pl.name}: ${pl.desc}`;
    loadSoul();
    $("scanBtn").addEventListener("click", scanNearby);
    $("stopShare").addEventListener("click", async () => {
        const { error } = await supabase.from("user_locations").delete().eq("id", user.id);
        nearMsg.textContent = error ? "Không xóa được vị trí: " + error.message : "Đã ngừng chia sẻ và xóa vị trí của bạn.";
        if (!error) { $("stopShare").hidden = true; empty(nearList, "Bạn chưa quét."); }
    });
}
init();
