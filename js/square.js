import { supabase } from "./supabase.js";
import { SIGNS } from "./zodiac.js";
import { effectForText, playTextEffect, stopEffects } from "./effects.js";
import { reportContent, blockMomentAuthor, blockThreadGuest, openBlockedDialog } from "./safety.js";
const $ = id => document.getElementById(id);
const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };
const W1 = ["Mây", "Gió", "Sao", "Trăng", "Nắng", "Sương", "Lá", "Biển"], W2 = ["lặng lẽ", "dịu dàng", "mơ màng", "tò mò", "ấm áp", "bình yên"];
let user, alias, tagFilter = "", file = null, rec = null, recTimer = null, dm = null, dmTimer = null;

function makeAlias(uid) { let h = 0; for (const c of uid) h = (h * 31 + c.charCodeAt(0)) >>> 0; return `${W1[h % 8]} ${W2[(h >> 3) % 6]} #${h % 1000}`; }
const parseTags = body => [...new Set((body.match(/#[\p{L}\p{N}_]{2,30}/gu) || []).map(t => t.slice(1).toLocaleLowerCase("vi-VN")))].slice(0, 5);
const ago = d => { const m = Math.floor((Date.now() - new Date(d)) / 60000); return m < 1 ? "vừa xong" : m < 60 ? `${m} phút trước` : m < 1440 ? `${Math.floor(m / 60)} giờ trước` : new Date(d).toLocaleDateString("vi-VN"); };
const kindOf = type => type.startsWith("image/") ? "image" : type.startsWith("video/") ? "video" : "audio";

async function upload(blob, type) {
    const ext = ({ "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "video/mp4": "mp4", "video/webm": "webm", "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "m4a", "audio/mpeg": "mp3" })[type.split(";")[0]] || "bin";
    const path = `${crypto.randomUUID()}.${ext}`; // không chứa id người dùng
    const { error } = await supabase.storage.from("moments").upload(path, blob, { contentType: type.split(";")[0] });
    if (error) throw (/row-level security|violates/i.test(error.message) ? new Error("Bạn đã đạt giới hạn tải lên (20 tệp/24 giờ) hoặc tệp không hợp lệ.") : error);
    return supabase.storage.from("moments").getPublicUrl(path).data.publicUrl;
}
function setMedia(f, label) { file = f; $("mediaInfo").textContent = f ? label : ""; }

$("momentFile").addEventListener("change", e => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 10 * 1024 * 1024) { $("postMessage").textContent = "Tệp tối đa 10 MB."; return; }
    setMedia(f, "Đã chọn: " + f.name);
});
$("recBtn").addEventListener("click", async () => {
    if (rec) { rec.stop(); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const chunks = []; rec = new MediaRecorder(stream);
        rec.ondataavailable = e => chunks.push(e.data);
        rec.onstop = () => {
            clearTimeout(recTimer); stream.getTracks().forEach(t => t.stop());
            const type = rec.mimeType || "audio/webm"; rec = null; $("recBtn").textContent = "🎙️ Ghi âm";
            setMedia(new File(chunks, "voice", { type }), "Đã ghi âm xong");
        };
        rec.start(); $("recBtn").textContent = "⏹ Dừng (tối đa 60s)"; recTimer = setTimeout(() => rec?.stop(), 60000);
    } catch { $("postMessage").textContent = "Không truy cập được micro. Hãy cho phép quyền micro."; }
});

$("postBtn").addEventListener("click", async () => {
    const body = $("momentBody").value.trim();
    if (!body && !file) { $("postMessage").textContent = "Hãy viết gì đó hoặc thêm tệp."; return; }
    $("postBtn").disabled = true; $("postMessage").textContent = "Đang đăng...";
    try {
        const row = { author_id: user.id, alias, body, tags: parseTags(body) };
        if (file) { row.media_url = await upload(file, file.type); row.media_kind = kindOf(file.type); }
        const { error } = await supabase.from("moments").insert(row);
        if (error) throw error;
        $("momentBody").value = ""; $("momentFile").value = ""; setMedia(null); $("postMessage").textContent = "Đã đăng!";
        loadFeed(); loadTrending();
    } catch (e) { console.error(e); $("postMessage").textContent = "Đăng thất bại: " + e.message; }
    $("postBtn").disabled = false;
});

function renderMoment(m) {
    const c = el("article", "moment");
    const h = el("header", null, null, c); el("strong", null, m.alias, h); el("span", null, ago(m.created_at), h);
    if (m.body) el("p", "moment-body", m.body, c);
    if (m.media_url?.startsWith("https://")) {
        const t = { image: "img", video: "video", audio: "audio" }[m.media_kind];
        if (t) { const x = el(t, null, null, c); x.src = m.media_url; if (t !== "img") x.controls = true; else x.loading = "lazy"; }
    }
    const tags = el("div", "sq-tags", null, c);
    (m.tags || []).forEach(t => { const b = el("button", "tag-chip", "#" + t, tags); b.type = "button"; b.onclick = () => setTag(t); });
    const act = el("div", "moment-actions", null, c);
    const like = el("button", m.liked_by_me ? "on" : "", `${m.liked_by_me ? "❤️" : "🤍"} ${m.like_count}`, act);
    let liked = m.liked_by_me, n = Number(m.like_count);
    like.onclick = async () => {
        const { error } = liked ? await supabase.from("moment_likes").delete().eq("moment_id", m.id).eq("user_id", user.id) : await supabase.from("moment_likes").insert({ moment_id: m.id, user_id: user.id });
        if (error) return; liked = !liked; n += liked ? 1 : -1; like.className = liked ? "on" : ""; like.textContent = `${liked ? "❤️" : "🤍"} ${n}`;
    };
    const cmBtn = el("button", "", `💬 ${m.comment_count}`, act); const box = el("div", "cm", null, c); box.hidden = true;
    cmBtn.onclick = () => { box.hidden = !box.hidden; if (!box.hidden) loadComments(m, box); };
    if (m.is_mine) { const del = el("button", "", "🗑 Xóa", act); del.onclick = async () => { if (confirm("Xóa bài viết này?") && !(await supabase.from("moments").delete().eq("id", m.id)).error) c.remove(); }; }
    else {
        const b = el("button", "", "✉️ Nhắn tin kín", act); b.onclick = () => openThread(m);
        const rep = el("button", "", "⚑ Báo cáo", act); rep.onclick = () => reportContent("moment", m.id, "Báo cáo bài viết");
        const blk = el("button", "", "🚫 Chặn", act); blk.onclick = async () => { if (await blockMomentAuthor(m.id)) c.remove(); };
    }
    return c;
}
async function loadComments(m, box) {
    box.replaceChildren(el("p", null, "Đang tải..."));
    const { data, error } = await supabase.from("comments_feed").select("*").eq("moment_id", m.id).order("created_at");
    box.replaceChildren();
    if (error) { el("p", null, "Không tải được bình luận.", box); return; }
    data.forEach(c => {
        const p = el("p", null, null, box); el("strong", null, c.alias + ": ", p); p.append(c.body);
        if (!c.is_mine) { const r = el("button", "safety-link", "Báo cáo", p); r.type = "button"; r.onclick = () => reportContent("moment_comment", c.id, "Báo cáo bình luận"); }
    });
    const row = el("div", "sq-row", null, box), inp = el("input", null, null, row); inp.maxLength = 300; inp.placeholder = "Viết bình luận...";
    const send = el("button", "", "Gửi", row); send.type = "button";
    send.onclick = async () => {
        const body = inp.value.trim(); if (!body) return;
        const { error } = await supabase.from("moment_comments").insert({ moment_id: m.id, author_id: user.id, alias, body });
        if (!error) loadComments(m, box);
    };
}

async function loadFeed() {
    let q = supabase.from("moments_feed").select("*").order("created_at", { ascending: false }).limit(50);
    if (tagFilter) q = q.contains("tags", [tagFilter]);
    const { data, error } = await q;
    $("feed").replaceChildren();
    if (error) { console.error(error); el("p", "empty-message", "Không tải được bài viết. Hãy kiểm tra schema Supabase.", $("feed")); return; }
    if (!data.length) { el("p", "empty-message", tagFilter ? `Chưa có bài nào với #${tagFilter}.` : "Chưa có bài viết nào. Hãy là người đầu tiên!", $("feed")); return; }
    data.forEach(m => $("feed").appendChild(renderMoment(m)));
}
function setTag(t) { tagFilter = t.replace(/^#/, "").trim().toLocaleLowerCase("vi-VN"); $("tagSearch").value = tagFilter; loadFeed(); loadTrending(); }
async function loadTrending() {
    const { data } = await supabase.from("moments_feed").select("tags").order("created_at", { ascending: false }).limit(200);
    const count = {}; (data || []).forEach(r => (r.tags || []).forEach(t => count[t] = (count[t] || 0) + 1));
    $("trending").replaceChildren();
    if (tagFilter) { const b = el("button", "tag-chip on", `#${tagFilter} ✕`, $("trending")); b.onclick = () => setTag(""); }
    if (Object.keys(count).length < 6) SIGNS.forEach(s => { const k = s.n.toLocaleLowerCase("vi-VN").replace(/ /g, "_"); count[k] = count[k] || 0; }); // gợi ý thẻ theo 12 cung
    Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([t, n]) => { if (t === tagFilter) return; const b = el("button", "tag-chip", `#${t}${n ? " · " + n : ""}`, $("trending")); b.onclick = () => setTag(t); });
}
$("tagGo").onclick = () => setTag($("tagSearch").value);
$("tagSearch").addEventListener("keydown", e => { if (e.key === "Enter") setTag($("tagSearch").value); });

// ---- Tin nhắn kín ----
async function openThread(m) {
    let { data: t } = await supabase.from("moment_threads").select("id").eq("moment_id", m.id).eq("guest_id", user.id).maybeSingle();
    if (!t) { const r = await supabase.from("moment_threads").insert({ moment_id: m.id, guest_id: user.id }).select("id").single(); if (r.error) { alert("Không mở được tin nhắn: " + r.error.message); return; } t = r.data; }
    showDm(t.id, false, `Nhắn cho ${m.alias}`);
}
function showDm(threadId, isAuthor, title) {
    dm = { threadId, isAuthor, lastId: null }; $("dmTitle").textContent = title;
    $("dmBlock")?.remove();
    if (isAuthor) { // chủ bài chặn người lạ đang nhắn (không lộ danh tính)
        const b = el("button", "safety-link", "🚫 Chặn người này"); b.id = "dmBlock"; b.type = "button";
        b.onclick = async () => { if (await blockThreadGuest(threadId)) $("dmDialog").close(); };
        $("dmTitle").after(b);
    }
    $("dmDialog").showModal(); refreshDm();
    clearInterval(dmTimer); dmTimer = setInterval(refreshDm, 5000);
}
async function refreshDm() {
    if (!dm) return;
    const { data } = await supabase.from("moment_messages").select("id, from_author, body").eq("thread_id", dm.threadId).order("id");
    if (!dm) return;
    const rows = data || [];
    if (dm.lastId != null) { // tin nhắn MỚI từ người kia có từ khóa đặc biệt → thả biểu tượng cảm xúc
        const hit = rows.find(x => Number(x.id) > dm.lastId && x.from_author !== dm.isAuthor && effectForText(x.body));
        if (hit) playTextEffect(hit.body);
    }
    if (rows.length) dm.lastId = Number(rows[rows.length - 1].id); else if (dm.lastId == null) dm.lastId = 0;
    $("dmLog").replaceChildren(); rows.forEach(x => el("div", "dm-msg" + (x.from_author === dm.isAuthor ? " me" : ""), x.body, $("dmLog")));
    $("dmLog").scrollTop = 1e6;
}
$("dmSend").onclick = async () => {
    const body = $("dmInput").value.trim(); if (!body || !dm) return;
    const { error } = await supabase.from("moment_messages").insert({ thread_id: dm.threadId, from_author: dm.isAuthor, body });
    if (!error) { $("dmInput").value = ""; playTextEffect(body); refreshDm(); } else alert("Gửi thất bại: " + error.message);
};
$("dmClose").onclick = () => $("dmDialog").close();
$("blockedBtn")?.addEventListener("click", openBlockedDialog);
$("dmDialog").addEventListener("close", () => { clearInterval(dmTimer); dm = null; stopEffects(); });
async function loadInbox() {
    const { data: th } = await supabase.from("moment_threads").select("id, moment_id, guest_id, created_at").order("created_at", { ascending: false }).limit(30);
    if (!th?.length) return;
    const { data: ms } = await supabase.from("moments_feed").select("id, alias, body, is_mine").in("id", th.map(t => t.moment_id));
    $("inbox").hidden = false; $("inboxList").replaceChildren();
    th.forEach(t => {
        const m = (ms || []).find(x => x.id === t.moment_id); if (!m) return;
        const isAuthor = m.is_mine, snippet = (m.body || "(bài có tệp đính kèm)").slice(0, 40);
        const b = el("button", null, `${isAuthor ? "Ai đó nhắn về bài của bạn" : "Bạn nhắn " + m.alias}: “${snippet}”`, $("inboxList"));
        b.onclick = () => showDm(t.id, isAuthor, isAuthor ? "Người lạ đang nhắn bạn" : `Nhắn cho ${m.alias}`);
    });
}

(async () => {
    const { data } = await supabase.auth.getUser(); user = data?.user;
    if (!user) { $("guestNotice").hidden = false; return; }
    alias = makeAlias(user.id); $("sqApp").hidden = false;
    loadFeed(); loadTrending(); loadInbox();
})();
