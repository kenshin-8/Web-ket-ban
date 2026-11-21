/* Connect — Nhắn tin và gọi thoại 1-1 cho cặp đã ghép đôi.
   - Tin nhắn dùng bảng direct_messages có sẵn (quyền gửi/đọc xử lý bởi RLS trong supabase/migrations/018_match_chat.sql).
   - Cuộc gọi: hàng `match_calls` (đổ chuông qua Realtime, chỉ hai người đọc được) + tín hiệu WebRTC
     trao đổi qua kênh broadcast mang tên là mã cuộc gọi (uuid khó đoán, chỉ hai người biết).
   - Chỉ gọi thoại một-một. Dùng STUN công cộng; mạng NAT đối xứng có thể cần máy chủ TURN. */
import { supabase } from "./supabase.js";

const ICE = [{ urls: "stun:stun.l.google.com:19302" }];
const RING_TIMEOUT_MS = 45000, SEND_COOLDOWN_MS = 800;
let me = null, started = false, call = null, chatWith = null, lastSend = 0, ringCtx = null, ringTimer = null, dmChannel = null, callChannel = null;
const names = new Map();
const $ = id => document.getElementById(id);
const el = (tag, cls, text, parent) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; parent?.appendChild(e); return e; };

/* ---------- tiện ích ---------- */
async function nameOf(id) {
  if (names.has(id)) return names.get(id);
  let n = "Người ghép đôi";
  try { const { data } = await supabase.from("profiles").select("display_name").eq("id", id).maybeSingle(); if (data?.display_name) n = data.display_name; } catch { /* dùng tên mặc định */ }
  names.set(id, n); return n;
}
const hhmm = iso => { const d = new Date(iso); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
function toast(text, actionLabel, onAction) {
  const t = el("div", "mc-toast"); t.setAttribute("role", "status");
  el("span", null, text, t);
  if (actionLabel) { const b = el("button", "mc-btn", actionLabel, t); b.type = "button"; b.onclick = () => { t.remove(); onAction?.(); }; }
  const x = el("button", "mc-btn mc-ghost", "✕", t); x.type = "button"; x.setAttribute("aria-label", "Đóng"); x.onclick = () => t.remove();
  document.body.appendChild(t); setTimeout(() => t.isConnected && t.remove(), 9000);
}

/* ---------- ghép đôi: ai đã Soul Like hai chiều ---------- */
export async function loadMatchedIds(userId) {
  const [{ data: mine }, { data: theirs }] = await Promise.all([
    supabase.from("soul_likes").select("to_user_id").eq("from_user_id", userId),
    supabase.from("soul_likes").select("from_user_id").eq("to_user_id", userId)
  ]);
  const liked = new Set((mine || []).map(r => r.to_user_id));
  return new Set((theirs || []).map(r => r.from_user_id).filter(id => liked.has(id)));
}
export function addMatchActions(parent, person) {
  if (!parent || !person?.id || parent.querySelector(".mc-actions")) return;
  names.set(person.id, person.name || "Người ghép đôi");
  const box = el("div", "mc-actions", null, parent);
  const chat = el("button", "mc-btn", "💬 Nhắn tin", box); chat.type = "button"; chat.onclick = () => openChat(person);
  const ring = el("button", "mc-btn", "📞 Gọi thoại", box); ring.type = "button"; ring.onclick = () => startCall(person);
}

/* ---------- giao diện chung ---------- */
function ensureUi() {
  if ($("mcChat")) return;
  if (!document.querySelector('link[data-mc-css]')) {
    const l = document.createElement("link"); l.rel = "stylesheet"; l.href = new URL("../css/match-chat.css", import.meta.url).href; l.dataset.mcCss = "1"; document.head.appendChild(l);
  }
  const chat = el("section", "mc-chat", null, document.body); chat.id = "mcChat"; chat.hidden = true; chat.setAttribute("role", "dialog"); chat.setAttribute("aria-label", "Tin nhắn riêng");
  const head = el("header", "mc-head", null, chat);
  el("strong", null, "", head).id = "mcChatName";
  const callBtn = el("button", "mc-btn", "📞", head); callBtn.id = "mcChatCall"; callBtn.type = "button"; callBtn.setAttribute("aria-label", "Gọi thoại");
  const close = el("button", "mc-btn mc-ghost", "✕", head); close.id = "mcChatClose"; close.type = "button"; close.setAttribute("aria-label", "Đóng cuộc trò chuyện");
  const log = el("div", "mc-log", null, chat); log.id = "mcLog"; log.setAttribute("role", "log"); log.setAttribute("aria-live", "polite");
  const form = el("form", "mc-form", null, chat); form.id = "mcForm"; form.autocomplete = "off";
  const input = el("input", null, null, form); input.id = "mcInput"; input.maxLength = 1000; input.placeholder = "Nhập tin nhắn..."; input.setAttribute("aria-label", "Tin nhắn");
  const send = el("button", "mc-btn mc-primary", "Gửi", form); send.type = "submit";
  el("p", "mc-note", "", chat).id = "mcNote";
  close.onclick = closeChat;
  callBtn.onclick = () => chatWith && startCall(chatWith);
  form.addEventListener("submit", e => { e.preventDefault(); sendMessage(); });
  chat.addEventListener("keydown", e => { if (e.key === "Escape") closeChat(); });

  const cp = el("section", "mc-call", null, document.body); cp.id = "mcCall"; cp.hidden = true; cp.setAttribute("role", "alertdialog"); cp.setAttribute("aria-label", "Cuộc gọi thoại");
  el("small", null, "CUỘC GỌI THOẠI", cp);
  el("strong", "mc-call-name", "", cp).id = "mcCallName";
  const st = el("p", "mc-call-status", "", cp); st.id = "mcCallStatus"; st.setAttribute("aria-live", "assertive");
  const row = el("div", "mc-call-row", null, cp);
  const acc = el("button", "mc-btn mc-primary", "📞 Nghe", row); acc.id = "mcAccept"; acc.type = "button";
  const dec = el("button", "mc-btn mc-danger", "Từ chối", row); dec.id = "mcDecline"; dec.type = "button";
  const mute = el("button", "mc-btn", "🎙️ Tắt mic", row); mute.id = "mcMute"; mute.type = "button"; mute.setAttribute("aria-pressed", "false");
  const hang = el("button", "mc-btn mc-danger", "Kết thúc", row); hang.id = "mcHang"; hang.type = "button";
  const audio = el("audio", null, null, cp); audio.id = "mcRemote"; audio.autoplay = true;
  acc.onclick = acceptIncoming; dec.onclick = () => hangUp("decline"); hang.onclick = () => hangUp();
  mute.onclick = () => {
    if (!call?.stream) return; const on = mute.getAttribute("aria-pressed") !== "true";
    call.stream.getAudioTracks().forEach(t => { t.enabled = !on; });
    mute.setAttribute("aria-pressed", String(on)); mute.textContent = on ? "🔇 Đã tắt mic" : "🎙️ Tắt mic";
  };
}

/* ---------- nhắn tin ---------- */
function appendMessage(m) {
  const log = $("mcLog"); if (!log) return;
  log.querySelector(".mc-empty")?.remove();
  const mine = m.sender_id === me;
  const row = el("div", `mc-msg${mine ? " me" : ""}`, null, log);
  el("span", "mc-bubble", m.body, row);
  el("time", "mc-time", hhmm(m.created_at), row);
  log.scrollTop = log.scrollHeight;
}
export async function openChat(person) {
  if (!me) return;
  ensureUi(); chatWith = { id: person.id, name: person.name || await nameOf(person.id) }; names.set(chatWith.id, chatWith.name);
  $("mcChatName").textContent = chatWith.name; $("mcChat").hidden = false; $("mcNote").textContent = "";
  const log = $("mcLog"); log.replaceChildren(); el("p", "mc-empty", "Đang tải tin nhắn...", log);
  const f = `and(sender_id.eq.${me},recipient_id.eq.${person.id}),and(sender_id.eq.${person.id},recipient_id.eq.${me})`;
  const { data, error } = await supabase.from("direct_messages").select("id,sender_id,body,created_at").or(f).order("created_at", { ascending: false }).limit(60);
  if (chatWith?.id !== person.id) return;
  log.replaceChildren();
  if (error) { el("p", "mc-empty", "Không tải được tin nhắn. Hãy chạy supabase/migrations/018_match_chat.sql.", log); return; }
  if (!data.length) el("p", "mc-empty", "Hãy gửi lời chào đầu tiên 👋", log);
  [...data].reverse().forEach(appendMessage);
  $("mcInput").focus();
}
function closeChat() { if ($("mcChat")) $("mcChat").hidden = true; chatWith = null; }
async function sendMessage() {
  const input = $("mcInput"), body = input.value.trim();
  if (!body || !chatWith) return;
  const now = Date.now(); if (now - lastSend < SEND_COOLDOWN_MS) return; lastSend = now;
  input.disabled = true;
  const { data, error } = await supabase.from("direct_messages").insert({ sender_id: me, recipient_id: chatWith.id, body }).select("id,sender_id,body,created_at").single();
  input.disabled = false; input.focus();
  if (error) { $("mcNote").textContent = "Chưa gửi được: có thể hai bạn không còn ghép đôi hoặc đã có người chặn."; return; }
  $("mcNote").textContent = ""; input.value = ""; appendMessage(data);
}
function listenMessages() {
  dmChannel?.unsubscribe?.();
  dmChannel = supabase.channel(`match-dm-${me}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages", filter: `recipient_id=eq.${me}` }, async ({ new: m }) => {
    if (!m) return;
    if (chatWith?.id === m.sender_id && !$("mcChat").hidden) return appendMessage(m);
    const n = await nameOf(m.sender_id);
    toast(`💬 ${n}: ${String(m.body).slice(0, 60)}`, "Mở", () => openChat({ id: m.sender_id, name: n }));
  }).subscribe();
}

/* ---------- gọi thoại ---------- */
function setCallUi({ name, status, incoming = false, active = false }) {
  ensureUi(); $("mcCall").hidden = false;
  if (name != null) $("mcCallName").textContent = name;
  $("mcCallStatus").textContent = status;
  $("mcAccept").hidden = !incoming; $("mcDecline").hidden = !incoming;
  $("mcMute").hidden = incoming; $("mcHang").hidden = incoming;
  $("mcMute").setAttribute("aria-pressed", "false"); $("mcMute").textContent = "🎙️ Tắt mic";
  if (active) $("mcHang").focus(); else if (incoming) $("mcAccept").focus();
}
function ring(on) {
  clearInterval(ringTimer); ringTimer = null;
  if (!on) return;
  const beep = () => {
    try {
      ringCtx ||= new (window.AudioContext || window.webkitAudioContext)();
      [0, 0.35].forEach(d => { const o = ringCtx.createOscillator(), g = ringCtx.createGain(); o.frequency.value = 880; g.gain.value = 0.08; o.connect(g).connect(ringCtx.destination); o.start(ringCtx.currentTime + d); o.stop(ringCtx.currentTime + d + 0.22); });
    } catch { /* chưa được phép phát âm thanh */ }
  };
  beep(); ringTimer = setInterval(beep, 1800);
}
async function getMic() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error("Trình duyệt cần HTTPS hoặc localhost để dùng micro.");
  return navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
}
function joinSignal(id, onReady) {
  callChannel = supabase.channel(`match-call-${id}`, { config: { broadcast: { self: false } } });
  callChannel.on("broadcast", { event: "signal" }, ({ payload }) => handleSignal(payload));
  callChannel.subscribe(state => { if (state === "SUBSCRIBED") onReady?.(); });
}
const sendSignal = payload => callChannel?.send({ type: "broadcast", event: "signal", payload: { ...payload, from: me } });

function makePeer() {
  const pc = new RTCPeerConnection({ iceServers: ICE });
  call.pc = pc; call.pendingIce = [];
  call.stream.getAudioTracks().forEach(t => pc.addTrack(t, call.stream));
  pc.onicecandidate = e => { if (e.candidate) sendSignal({ type: "ice", data: e.candidate.toJSON() }); };
  pc.ontrack = e => { const a = $("mcRemote"); a.srcObject = e.streams[0]; a.play?.().catch(() => {}); };
  pc.onconnectionstatechange = () => {
    if (!call || call.pc !== pc) return;
    if (pc.connectionState === "connected") { call.since ||= Date.now(); ring(false); clearTimeout(call.ringTimeout); startTimer(); }
    else if (pc.connectionState === "failed") { supabase.rpc("respond_match_call", { p_id: call.id, p_action: "end" }).then(() => {}, () => {}); endLocal("Mất kết nối. Mạng của hai bạn có thể cần máy chủ TURN."); }
    else if (pc.connectionState === "disconnected") setTimeout(() => { if (call?.pc === pc && pc.connectionState === "disconnected") hangUp(); }, 8000);
  };
  return pc;
}
function startTimer() {
  clearInterval(call.tick);
  const paint = () => { const s = Math.floor((Date.now() - call.since) / 1000); $("mcCallStatus").textContent = `Đang trò chuyện · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
  paint(); call.tick = setInterval(paint, 1000);
}
async function flushIce() { const q = call.pendingIce.splice(0); for (const c of q) { try { await call.pc.addIceCandidate(c); } catch { /* bỏ qua */ } } }
async function handleSignal(p) {
  if (!call || !p || p.from !== call.other.id) return;
  try {
    if (p.type === "ready" && call.role === "caller" && !call.pc) {
      const pc = makePeer(); const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      sendSignal({ type: "offer", data: { type: offer.type, sdp: offer.sdp } });
    } else if (p.type === "offer" && call.role === "callee") {
      const pc = call.pc || makePeer(); await pc.setRemoteDescription(p.data); await flushIce();
      const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
      sendSignal({ type: "answer", data: { type: answer.type, sdp: answer.sdp } });
    } else if (p.type === "answer" && call.role === "caller" && call.pc) {
      await call.pc.setRemoteDescription(p.data); await flushIce();
    } else if (p.type === "ice" && p.data) {
      if (call.pc?.remoteDescription) await call.pc.addIceCandidate(p.data); else call.pendingIce?.push(p.data);
    }
  } catch (e) { console.warn("Tín hiệu cuộc gọi lỗi:", e); }
}
function cleanupCall(message) {
  ring(false);
  if (call) {
    clearInterval(call.tick); clearTimeout(call.ringTimeout);
    try { call.stream?.getTracks().forEach(t => t.stop()); } catch { /* bỏ qua */ }
    try { call.pc?.close(); } catch { /* bỏ qua */ }
  }
  if (callChannel) { supabase.removeChannel(callChannel); callChannel = null; }
  call = null;
  if ($("mcRemote")) $("mcRemote").srcObject = null;
  if (message && $("mcCall")) { setCallUi({ status: message }); setTimeout(() => { if (!call && $("mcCall")) $("mcCall").hidden = true; }, 2500); }
  else if ($("mcCall")) $("mcCall").hidden = true;
}
const endLocal = message => cleanupCall(message);

export async function startCall(person) {
  if (!me || call) { if (call) toast("Bạn đang trong một cuộc gọi khác."); return; }
  ensureUi();
  const name = person.name || await nameOf(person.id);
  let stream; try { stream = await getMic(); } catch (e) { toast("Không dùng được micro: " + (e.message || "bị từ chối quyền.")); return; }
  const { data: id, error } = await supabase.rpc("start_match_call", { p_callee: person.id });
  if (error) { stream.getTracks().forEach(t => t.stop()); toast(error.message); return; }
  call = { id, other: { id: person.id, name }, role: "caller", stream, pc: null };
  setCallUi({ name, status: "Đang gọi...", active: true }); ring(true);
  joinSignal(id);
  call.ringTimeout = setTimeout(async () => { if (call?.id === id && !call.pc?.remoteDescription) { await supabase.rpc("respond_match_call", { p_id: id, p_action: "missed" }); await supabase.rpc("respond_match_call", { p_id: id, p_action: "end" }); cleanupCall(`${name} không nghe máy.`); } }, RING_TIMEOUT_MS);
}
async function incoming(row) {
  if (call) { await supabase.rpc("respond_match_call", { p_id: row.id, p_action: "decline" }); return; } // đang bận
  const name = await nameOf(row.caller_id);
  call = { id: row.id, other: { id: row.caller_id, name }, role: "callee", stream: null, pc: null };
  setCallUi({ name, status: "Cuộc gọi thoại đến...", incoming: true }); ring(true);
  if (document.hidden && "Notification" in window && Notification.permission === "granted") new Notification("Connect", { body: `${name} đang gọi cho bạn`, tag: "connect-call" });
  call.ringTimeout = setTimeout(() => { if (call?.id === row.id && !call.stream) cleanupCall("Đã bỏ lỡ cuộc gọi."); }, 55000);
}
async function acceptIncoming() {
  if (!call || call.role !== "callee" || call.stream) return;
  const c = call;
  try { c.stream = await getMic(); } catch (e) { toast("Không dùng được micro: " + (e.message || "bị từ chối quyền.")); return hangUp("decline"); }
  const { error } = await supabase.rpc("respond_match_call", { p_id: c.id, p_action: "accept" });
  if (error) { toast(error.message); return cleanupCall(); }
  ring(false); clearTimeout(c.ringTimeout);
  setCallUi({ status: "Đang kết nối...", active: true });
  joinSignal(c.id, () => sendSignal({ type: "ready" }));
}
async function hangUp(action) {
  if (!call) return;
  const c = call;
  // Gửi cả "cancel" và "end": hàm máy chủ chỉ áp dụng hành động hợp với trạng thái hiện tại,
  // nên không để cuộc gọi kẹt ở "accepted" nếu người nghe vừa bấm nghe đúng lúc dập máy.
  const acts = action ? [action] : (c.role === "caller" ? ["cancel", "end"] : ["end"]);
  try { for (const a of acts) await supabase.rpc("respond_match_call", { p_id: c.id, p_action: a }); } catch { /* bỏ qua */ }
  cleanupCall();
}
function onCallRow(row) {
  if (!call || row?.id !== call.id) return;
  if (["declined", "cancelled", "missed", "ended"].includes(row.status)) {
    const msg = row.status === "declined" ? `${call.other.name} đã từ chối.` : row.status === "ended" ? "Cuộc gọi đã kết thúc." : row.status === "missed" ? "Đã bỏ lỡ cuộc gọi." : "Người gọi đã hủy.";
    cleanupCall(msg);
  }
}
function listenCalls() {
  supabase.channel(`match-calls-${me}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_calls", filter: `callee_id=eq.${me}` }, ({ new: r }) => { if (r?.status === "ringing") incoming(r); })
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "match_calls", filter: `callee_id=eq.${me}` }, ({ new: r }) => onCallRow(r))
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "match_calls", filter: `caller_id=eq.${me}` }, ({ new: r }) => onCallRow(r))
    .subscribe();
  // Cuộc gọi đang đổ chuông khi vừa mở/tải lại trang
  supabase.from("match_calls").select("id,caller_id,status,created_at").eq("callee_id", me).eq("status", "ringing").gt("created_at", new Date(Date.now() - 45000).toISOString()).limit(1)
    .then(({ data }) => { if (data?.[0]) incoming(data[0]); }, () => {});
}

export function initMatchChat(userId) {
  if (started || !userId) return; started = true; me = userId;
  // Cố gắng báo máy chủ khi đóng tab giữa cuộc gọi để không kẹt trạng thái "bận".
  window.addEventListener("pagehide", () => { if (call) supabase.rpc("respond_match_call", { p_id: call.id, p_action: call.role === "caller" ? "cancel" : "end" }).then(() => {}, () => {}); });
  ensureUi(); listenMessages(); listenCalls();
}
