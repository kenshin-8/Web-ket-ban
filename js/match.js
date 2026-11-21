import { supabase } from "./supabase.js";
import { PLANETS, compat } from "./soul.js";
import { createAvatarSvg } from "./avatar-data.js";
import { signByName } from "./zodiac.js";
import { initSoulConnections, createSoulLikeButton, sharedInterests } from "./soul-connection.js";
import { loadMatchedIds, addMatchActions } from "./match-chat.js";
const $ = id => document.getElementById(id);
const soulList = $("soulList"), nearList = $("nearList"), nearMsg = $("nearMessage");
let me = null, user = null, matchedIds = new Set();
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
    if (matchedIds.has(p.id)) addMatchActions(actions, { id: p.id, name: p.display_name });
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

/* ---- Quét người ở gần (dùng chung cho nút "Quét gần tôi" và chế độ báo hiệu) ---- */
async function getRoundedPosition() {
    const pos = await new Promise((ok, no) => navigator.geolocation.getCurrentPosition(ok, no, { timeout: 10000, maximumAge: 60000 }));
    // làm tròn ~1 km, không lưu vị trí chính xác
    return { lat: +pos.coords.latitude.toFixed(2), lng: +pos.coords.longitude.toFixed(2) };
}
// Trả về [{p, km, score}] đã sắp xếp. Ném lỗi có thuộc tính .kind = "geo" | "save" | "rpc".
async function fetchNearbyRows(radius) {
    let loc;
    try { loc = await getRoundedPosition(); } catch (e) { e.kind = "geo"; throw e; }
    const { error: upErr } = await supabase.from("user_locations").upsert({ id: user.id, lat: loc.lat, lng: loc.lng, updated_at: new Date().toISOString() });
    if (upErr) { upErr.kind = "save"; throw upErr; }
    $("stopShare").hidden = false;
    // Khoảng cách được tính phía server; trình duyệt chỉ nhận id + nấc khoảng cách, không nhận tọa độ của ai khác.
    const { data: nearRows, error } = await supabase.rpc("nearby_users", { radius_km: radius });
    if (error) { error.kind = "rpc"; throw error; }
    const near = (nearRows || []).map(r => ({ id: r.user_id, km: r.distance_bucket_km }));
    if (!near.length) return { rows: [], hadNear: false };
    const { data: profs } = await supabase.from("profiles").select("id, display_name, interests, planet, soul_scores, avatar_data, zodiac").eq("is_visible", true).in("id", near.map(n => n.id));
    const rows = (profs || []).map(p => ({ p, km: near.find(n => n.id === p.id).km, score: me.planet ? compat(me, p) : 0 })).sort((a, b) => b.score - a.score || a.km - b.km);
    return { rows, hadNear: true };
}
function renderNear(rows, hadNear, radius) {
    nearMsg.textContent = "";
    if (!hadNear) return empty(nearList, `Chưa có ai trong bán kính ${radius} km.`);
    if (!rows.length) return empty(nearList, "Có người ở gần nhưng chưa ai bật hiển thị hồ sơ công khai.");
    nearList.replaceChildren(...rows.map(({ p, km, score }) => card(p, `${score}%`, `Trong vòng ${km} km quanh bạn`, score)));
}
async function scanNearby() {
    nearMsg.textContent = "Đang lấy vị trí...";
    const radius = +$("radius").value;
    try { const { rows, hadNear } = await fetchNearbyRows(radius); renderNear(rows, hadNear, radius); }
    catch (e) {
        console.error(e);
        nearMsg.textContent = e.kind === "geo" ? "Không lấy được vị trí. Hãy cho phép quyền truy cập vị trí trong trình duyệt."
            : e.kind === "save" ? "Không lưu được vị trí: " + e.message : "Không thể quét. Hãy chạy supabase/migrations/010_safety_hardening.sql.";
    }
}

/* ---- Báo hiệu khi có người hợp gu ở gần (tùy chọn, chỉ chạy khi trang này đang mở) ---- */
const ALERT_KEY = "connect.nearbyAlert", SEEN_KEY = "connect.nearbySeen";
const ALERT_MIN_SCORE = 70, ALERT_EVERY_MS = 60000;
let alertTimer = null, alertBusy = false;
const loadSeen = () => {
    try { const o = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"), now = Date.now(); Object.keys(o).forEach(k => { if (now - o[k] > 864e5) delete o[k]; }); return o; }
    catch { return {}; }
};
const saveSeen = o => { try { localStorage.setItem(SEEN_KEY, JSON.stringify(o)); } catch { /* bỏ qua */ } };

function showNearToast(fresh) {
    $("nearToast")?.remove();
    const best = fresh[0];
    const t = el("div", "near-toast"); t.id = "nearToast"; t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
    el("strong", null, fresh.length === 1 ? "✨ Có người hợp gu ở gần bạn" : `✨ Có ${fresh.length} người hợp gu ở gần bạn`, t);
    el("p", null, `Độ tương hợp cao nhất ${best.score}%, trong vòng ${best.km} km.`, t);
    const row = el("div", "near-toast-actions", null, t);
    const view = el("button", "btn", "Xem ngay", row); view.type = "button";
    view.onclick = () => { t.remove(); nearList.scrollIntoView({ behavior: "smooth", block: "start" }); };
    const close = el("button", "btn btn-light", "Đóng", row); close.type = "button"; close.onclick = () => t.remove();
    document.body.appendChild(t);
    window.setTimeout(() => t.isConnected && t.remove(), 15000);
}
async function checkNearbyAlert() {
    if (alertBusy) return; alertBusy = true;
    const radius = +$("radius").value;
    try {
        const { rows, hadNear } = await fetchNearbyRows(radius);
        renderNear(rows, hadNear, radius);
        const seen = loadSeen();
        const fresh = rows.filter(r => r.score >= ALERT_MIN_SCORE && !seen[r.p.id]);
        if (fresh.length) {
            fresh.forEach(r => { seen[r.p.id] = Date.now(); }); saveSeen(seen);
            if (document.hidden && "Notification" in window && Notification.permission === "granted") {
                // Không đưa tên vào thông báo hệ thống để tránh lộ danh tính trên màn hình khóa.
                new Notification("Connect", { body: "Có người hợp gu ở gần bạn. Mở Connect để xem.", tag: "connect-nearby", icon: "images/favicon.png" });
            } else showNearToast(fresh);
        }
    } catch (e) {
        console.warn("Báo hiệu người ở gần:", e.message);
        if (e.kind === "geo") { setAlert(false); nearMsg.textContent = "Đã tắt báo hiệu vì không lấy được vị trí. Hãy cho phép quyền vị trí rồi bật lại."; }
    } finally { alertBusy = false; }
}
function setAlert(on, { persist = true } = {}) {
    $("nearAlert").checked = on;
    if (persist) { try { localStorage.setItem(ALERT_KEY, on ? "1" : "0"); } catch { /* bỏ qua */ } }
    clearInterval(alertTimer); alertTimer = null;
    if (on) { alertTimer = setInterval(checkNearbyAlert, ALERT_EVERY_MS); checkNearbyAlert(); }
}

async function init() {
    const { data } = await supabase.auth.getUser();
    user = data?.user;
    if (!user) { $("guestNotice").hidden = false; return; }
    const { data: prof } = await supabase.from("profiles").select("planet, soul_scores, interests, zodiac").eq("id", user.id).maybeSingle();
    if (!prof?.planet) { $("quizNotice").hidden = false; return; }
    me = prof; initSoulConnections(user.id, me); $("matchApp").hidden = false;
    try { matchedIds = await loadMatchedIds(user.id); } catch { /* chưa có quyền đọc: bỏ qua */ }
    window.addEventListener("soul-matched", e => {
        const { id, name } = e.detail || {}; if (!id) return;
        matchedIds.add(id);
        document.querySelectorAll(`[data-member-id="${CSS.escape(id)}"] .member-actions`).forEach(box => addMatchActions(box, { id, name }));
    });
    const pl = PLANETS[me.planet]; $("myPlanet").textContent = `${pl.icon} Tinh cầu ${pl.name}: ${pl.desc}`;
    loadSoul();
    $("scanBtn").addEventListener("click", scanNearby);
    $("nearAlert").addEventListener("change", e => {
        setAlert(e.target.checked);
        if (e.target.checked && "Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
    });
    $("radius").addEventListener("change", () => { if ($("nearAlert").checked) checkNearbyAlert(); });
    document.addEventListener("visibilitychange", () => { if (!document.hidden && $("nearAlert").checked) checkNearbyAlert(); });
    try { if (localStorage.getItem(ALERT_KEY) === "1") setAlert(true, { persist: false }); } catch { /* bỏ qua */ }
    $("stopShare").addEventListener("click", async () => {
        const { error } = await supabase.from("user_locations").delete().eq("id", user.id);
        nearMsg.textContent = error ? "Không xóa được vị trí: " + error.message : "Đã ngừng chia sẻ và xóa vị trí của bạn.";
        if (!error) { $("stopShare").hidden = true; setAlert(false); empty(nearList, "Bạn chưa quét."); }
    });
}
init();
