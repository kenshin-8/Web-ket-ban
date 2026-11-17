import { supabase } from "./supabase.js";
import { GIFTS, playGift, playTextEffect, showBanner, stopEffects } from "./effects.js";

const $ = id => document.getElementById(id);
const topicInfo = {
  music: { label: "Âm nhạc", emoji: "🎵" },
  games: { label: "Trò chơi", emoji: "🎲" },
  stories: { label: "Kể chuyện", emoji: "📖" },
  chat: { label: "Sở thích", emoji: "💬" }
};
let currentUser = null;
let activeTopic = "all";
let activeRoom = null;
let roomChannel = null;
let localStream = null;
let micEnabled = true;
let audioContext = null;
let processedStream = null;
let micSource = null;
let voiceNodes = null;
let voiceLfo = null;
let soundBus = null;
const peers = new Map();
const remoteStreams = new Map();

async function init() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    $("roomList").innerHTML = '<div class="empty-state">Bạn cần <a href="login.html">đăng nhập</a> để xem và tham gia phòng thoại.</div>';
    $("showCreateBtn").disabled = true;
    return;
  }
  currentUser = data.user;
  await loadRooms();
}

async function loadRooms() {
  const list = $("roomList");
  list.innerHTML = '<div class="empty-state">Đang tải danh sách phòng...</div>';
  const { data, error } = await supabase.from("voice_rooms").select("id,name,topic,description,host_name,host_id,created_at").eq("is_open", true).order("created_at", { ascending: false }).limit(40);
  if (error) {
    list.innerHTML = '<div class="empty-state">Chưa tải được phòng. Hãy chạy phần SQL thiết lập Voice Community trong README.</div>';
    console.error(error);
    return;
  }
  renderRooms(data || []);
}

function renderRooms(rooms) {
  const list = $("roomList");
  const filtered = activeTopic === "all" ? rooms : rooms.filter(r => r.topic === activeTopic);
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">Chưa có phòng nào ở chủ đề này. Bạn có thể tạo phòng mới.</div>';
    return;
  }
  list.replaceChildren();
  filtered.forEach(room => {
    const info = topicInfo[room.topic] || topicInfo.chat;
    const card = document.createElement("article"); card.className = "room-card";
    const top = document.createElement("div"); top.className = "room-card-top";
    const emoji = document.createElement("span"); emoji.className = "room-emoji"; emoji.textContent = info.emoji;
    const count = document.createElement("span"); count.className = "room-count"; count.textContent = "Tối đa 4 người";
    top.append(emoji, count);
    const title = document.createElement("h3"); title.textContent = room.name;
    const desc = document.createElement("p"); desc.textContent = room.description || `Phòng trò chuyện chủ đề ${info.label.toLowerCase()}.`;
    const meta = document.createElement("div"); meta.className = "room-meta";
    const host = document.createElement("span"); host.className = "room-host"; host.textContent = `Tạo bởi ${room.host_name || "Thành viên Connect"}`;
    const join = document.createElement("button"); join.className = "join-btn"; join.type = "button"; join.textContent = "Tham gia";
    join.addEventListener("click", () => joinRoom(room));
    meta.append(host, join); card.append(top, title, desc, meta); list.append(card);
  });
}

$("topicFilters").addEventListener("click", event => {
  const button = event.target.closest("[data-topic]"); if (!button) return;
  activeTopic = button.dataset.topic;
  document.querySelectorAll(".topic-filter").forEach(b => b.classList.toggle("active", b === button));
  loadRooms();
});
$("showCreateBtn").addEventListener("click", () => { $("createModal").hidden = false; });
$("closeCreateBtn").addEventListener("click", () => { $("createModal").hidden = true; });
$("createModal").addEventListener("click", e => { if (e.target === $("createModal")) $("createModal").hidden = true; });

$("createRoomForm").addEventListener("submit", async event => {
  event.preventDefault();
  if (!currentUser) return;
  const button = $("createRoomBtn"); const message = $("createMessage");
  button.disabled = true; message.textContent = "Đang tạo phòng...";
  const name = $("roomName").value.trim();
  const description = $("roomDescription").value.trim();
  const topic = $("roomTopic").value;
  const hostName = currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Thành viên";
  const { data, error } = await supabase.from("voice_rooms").insert({ name, topic, description, host_id: currentUser.id, host_name: hostName }).select().single();
  button.disabled = false;
  if (error) { message.textContent = `Không tạo được phòng: ${error.message}`; return; }
  $("createRoomForm").reset(); $("createModal").hidden = true; message.textContent = "";
  await loadRooms(); await joinRoom(data);
});

async function joinRoom(room) {
  if (activeRoom) return;
  activeRoom = room;
  $("callModal").hidden = false; $("activeRoomName").textContent = room.name; $("callStatus").textContent = "Đang xin quyền sử dụng micro...";
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
  } catch (error) {
    activeRoom = null; $("callModal").hidden = true;
    alert("Không thể bật micro. Hãy cho phép trình duyệt sử dụng micro và thử lại."); return;
  }
  micEnabled = true;
  setupAudioProcessing();
  updateMicButton();
  roomChannel = supabase.channel(`voice-room-${room.id}`, { config: { presence: { key: currentUser.id }, broadcast: { self: false } } });
  roomChannel.on("presence", { event: "sync" }, handlePresenceSync);
  roomChannel.on("broadcast", { event: "signal" }, ({ payload }) => handleSignal(payload));
  roomChannel.on("broadcast", { event: "gift" }, ({ payload }) => handleGift(payload));
  roomChannel.on("broadcast", { event: "chat" }, ({ payload }) => handleChat(payload));
  roomChannel.on("broadcast", { event: "room_closed" }, () => { alert("Chủ phòng đã kết thúc phòng thoại."); leaveRoom(false); });
  const status = await roomChannel.subscribe(async state => {
    if (state === "SUBSCRIBED") {
      await roomChannel.track({ user_id: currentUser.id, name: currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Thành viên", joined_at: new Date().toISOString() });
      $("callStatus").textContent = "Đã vào phòng · Micro đang bật";
      updateParticipants();
    } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
      $("callStatus").textContent = "Kết nối phòng thất bại. Vui lòng thử lại.";
    }
  });
}

async function handlePresenceSync() {
  const state = roomChannel.presenceState();
  const people = Object.entries(state).flatMap(([id, metas]) => metas.map(meta => ({ id, ...meta })));
  people.sort((a, b) => String(a.joined_at || "").localeCompare(String(b.joined_at || "")));
  const admitted = people.slice(0, 4);
  if (people.length > 4 && !admitted.some(person => person.id === currentUser.id)) {
    $("callStatus").textContent = "Phòng đã đủ 4 người. Vui lòng chọn phòng khác.";
    await leaveRoom(false); return;
  }
  const ids = admitted.map(person => person.id).filter(id => id !== currentUser.id);
  for (const peerId of [...peers.keys()]) if (!ids.includes(peerId)) removePeer(peerId);
  updateParticipants();
  for (const peerId of ids) {
    if (currentUser.id.localeCompare(peerId) < 0 && !peers.has(peerId)) await createPeer(peerId, true);
  }
}

async function createPeer(peerId, initiator) {
  if (peers.has(peerId) || !localStream) return peers.get(peerId);
  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  peers.set(peerId, pc);
  const outgoingStream = processedStream || localStream;
  outgoingStream.getAudioTracks().forEach(track => pc.addTrack(track, outgoingStream));
  pc.onicecandidate = event => { if (event.candidate) sendSignal({ to: peerId, candidate: event.candidate.toJSON() }); };
  pc.ontrack = event => {
    const stream = event.streams[0]; remoteStreams.set(peerId, stream);
    let audio = document.getElementById(`remote-${peerId}`);
    if (!audio) { audio = document.createElement("audio"); audio.id = `remote-${peerId}`; audio.autoplay = true; $("remoteAudios").append(audio); }
    audio.srcObject = stream;
  };
  pc.onconnectionstatechange = () => { if (["failed", "closed", "disconnected"].includes(pc.connectionState)) removePeer(peerId); };
  if (initiator) {
    const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
    await sendSignal({ to: peerId, description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
  }
  return pc;
}

async function sendSignal(payload) {
  if (!roomChannel) return;
  await roomChannel.send({ type: "broadcast", event: "signal", payload: { ...payload, from: currentUser.id } });
}

async function handleSignal(payload) {
  if (!payload || payload.to !== currentUser.id || !payload.from) return;
  const pc = await createPeer(payload.from, false);
  try {
    if (payload.description) {
      await pc.setRemoteDescription(payload.description);
      if (payload.description.type === "offer") {
        const answer = await pc.createAnswer(); await pc.setLocalDescription(answer);
        await sendSignal({ to: payload.from, description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      }
    } else if (payload.candidate) await pc.addIceCandidate(payload.candidate);
  } catch (error) { console.error("Lỗi thiết lập kết nối thoại:", error); }
}

function updateParticipants() {
  if (!activeRoom || !roomChannel) return;
  const state = roomChannel.presenceState(); const people = [];
  Object.values(state).flat().forEach(person => people.push(person));
  const list = $("participantList"); list.replaceChildren();
  people.slice(0, 4).forEach(person => {
    const item = document.createElement("div"); item.className = "participant";
    const icon = document.createElement("span"); icon.textContent = "🙂";
    const name = document.createElement("strong"); name.textContent = person.name || "Thành viên";
    item.append(icon, name); list.append(item);
  });
  if (!people.length) { const item = document.createElement("div"); item.className = "participant"; item.textContent = "Đang chờ thành viên..."; list.append(item); }
  updateGiftRecipients();
}

function removePeer(peerId) {
  peers.get(peerId)?.close(); peers.delete(peerId); remoteStreams.delete(peerId);
  document.getElementById(`remote-${peerId}`)?.remove();
}
function setupAudioProcessing() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx || !localStream) return;
  try {
    audioContext = new AudioCtx();
    micSource = audioContext.createMediaStreamSource(localStream);
    const low = audioContext.createBiquadFilter(); low.type = "lowpass"; low.frequency.value = 20000;
    const high = audioContext.createBiquadFilter(); high.type = "highpass"; high.frequency.value = 70;
    const presence = audioContext.createBiquadFilter(); presence.type = "peaking"; presence.frequency.value = 1800; presence.Q.value = 0.8; presence.gain.value = 0;
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -20; compressor.knee.value = 18; compressor.ratio.value = 3; compressor.attack.value = 0.01; compressor.release.value = 0.18;
    const ring = audioContext.createGain(); ring.gain.value = 1;
    const output = audioContext.createGain(); output.gain.value = 1;
    soundBus = audioContext.createGain(); soundBus.gain.value = 0.7;
    micSource.connect(low).connect(high).connect(presence).connect(compressor).connect(ring).connect(output);
    const destination = audioContext.createMediaStreamDestination();
    output.connect(destination);
    soundBus.connect(destination);
    processedStream = destination.stream;
    voiceNodes = { low, high, presence, ring, output };
    applyVoiceEffect($("voiceEffect")?.value || "normal");
  } catch (error) {
    console.warn("Không thể khởi tạo xử lý âm thanh, dùng micro gốc:", error);
    processedStream = null;
  }
}

function applyVoiceEffect(effect) {
  if (!voiceNodes || !audioContext) return;
  const { low, high, presence, ring } = voiceNodes;
  low.frequency.setTargetAtTime(20000, audioContext.currentTime, 0.04);
  high.frequency.setTargetAtTime(70, audioContext.currentTime, 0.04);
  presence.gain.setTargetAtTime(0, audioContext.currentTime, 0.04);
  if (voiceLfo) { try { voiceLfo.stop(); } catch {} voiceLfo.disconnect(); voiceLfo = null; }
  if (effect === "deep") { low.frequency.setTargetAtTime(1150, audioContext.currentTime, 0.08); presence.frequency.value = 230; presence.gain.setTargetAtTime(3, audioContext.currentTime, 0.08); }
  if (effect === "high") { high.frequency.setTargetAtTime(190, audioContext.currentTime, 0.08); presence.frequency.value = 2800; presence.gain.setTargetAtTime(5, audioContext.currentTime, 0.08); }
  if (effect === "cute") { high.frequency.setTargetAtTime(150, audioContext.currentTime, 0.08); presence.frequency.value = 3200; presence.gain.setTargetAtTime(6, audioContext.currentTime, 0.08); low.frequency.setTargetAtTime(8500, audioContext.currentTime, 0.08); }
  if (effect === "robot") {
    // Ring-modulation nhẹ tạo chất giọng robot; không phải pitch-shifter chuyên nghiệp.
    ring.gain.setTargetAtTime(0.52, audioContext.currentTime, 0.05);
    const lfoDepth = audioContext.createGain(); lfoDepth.gain.value = 0.43;
    voiceLfo = audioContext.createOscillator(); voiceLfo.type = "square"; voiceLfo.frequency.value = 32;
    voiceLfo.connect(lfoDepth).connect(ring.gain); voiceLfo.start(); voiceNodes.lfoDepth = lfoDepth;
  } else {
    ring.gain.setTargetAtTime(1, audioContext.currentTime, 0.05);
    if (voiceNodes.lfoDepth) { voiceNodes.lfoDepth.disconnect(); voiceNodes.lfoDepth = null; }
  }
}

function updateMicButton() { $("micBtn").textContent = micEnabled ? "🎙️ Tắt micro" : "🔇 Bật micro"; }
$("voiceEffect")?.addEventListener("change", event => {
  if (!activeRoom) return;
  if (audioContext?.state === "suspended") audioContext.resume();
  applyVoiceEffect(event.target.value);
  $("callStatus").textContent = `Đang dùng hiệu ứng: ${event.target.selectedOptions[0].textContent}`;
});
$("micBtn").addEventListener("click", () => {
  if (!localStream) return;
  micEnabled = !micEnabled;
  if (voiceNodes?.output) voiceNodes.output.gain.setTargetAtTime(micEnabled ? 1 : 0, audioContext.currentTime, 0.025);
  else localStream.getAudioTracks().forEach(track => { track.enabled = micEnabled; });
  updateMicButton();
  $("callStatus").textContent = micEnabled ? "Micro đang bật" : "Micro đã tắt";
});

function playTone(frequency, start, duration, volume = 0.12, type = "sine") {
  const osc = audioContext.createOscillator(), gain = audioContext.createGain();
  osc.type = type; osc.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(soundBus); osc.start(start); osc.stop(start + duration + 0.04);
}
function playNoise(start, duration, volume = 0.16) {
  const length = Math.max(1, Math.floor(audioContext.sampleRate * duration));
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate), data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
  const source = audioContext.createBufferSource(), filter = audioContext.createBiquadFilter(), gain = audioContext.createGain();
  source.buffer = buffer; filter.type = "highpass"; filter.frequency.value = 700;
  gain.gain.setValueAtTime(volume, start); gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  source.connect(filter).connect(gain).connect(soundBus); source.start(start);
}
function playSound(name) {
  if (!audioContext || !soundBus) { $("soundStatus").textContent = "Trình duyệt chưa hỗ trợ phát hiệu ứng âm thanh."; return; }
  if (audioContext.state === "suspended") audioContext.resume();
  const now = audioContext.currentTime + 0.03;
  if (name === "clap") { for (let i = 0; i < 5; i++) playNoise(now + i * 0.11, 0.13, 0.2); }
  if (name === "laugh") { [660, 790, 620, 760, 540].forEach((f, i) => playTone(f, now + i * 0.16, 0.13, 0.09, "triangle")); }
  if (name === "heart") { [0, 0.22, 0.85, 1.07].forEach(t => { playTone(68, now + t, 0.16, 0.22, "sine"); playTone(48, now + t + 0.04, 0.18, 0.12, "sine"); }); }
  if (name === "ambient") {
    const notes = [261.63, 329.63, 392, 329.63];
    notes.forEach((f, i) => playTone(f, now + i * 0.75, 2.7, 0.035, "sine"));
  }
  const labels = { clap: "Đang phát tiếng vỗ tay cho cả phòng.", laugh: "Đang phát tiếng cười cho cả phòng.", heart: "Đang phát nhịp tim cho cả phòng.", ambient: "Đang phát đoạn nhạc nền nhẹ cho cả phòng." };
  $("soundStatus").textContent = labels[name] || "Đã phát âm thanh.";
}
document.querySelectorAll("[data-sound]").forEach(button => button.addEventListener("click", () => {
  if (!activeRoom) return;
  button.disabled = true; playSound(button.dataset.sound);
  setTimeout(() => { button.disabled = false; }, 1200);
}));
/* ---------- Quà tặng ảo & chat phòng (gửi qua kênh Realtime, không lưu vào cơ sở dữ liệu) ---------- */
const GIFT_COOLDOWN_MS = 4000, CHAT_COOLDOWN_MS = 600, MAX_CHAT_LINES = 80;
let giftReadyAt = 0, chatReadyAt = 0;

function presenceList() {
  return roomChannel ? Object.entries(roomChannel.presenceState()).map(([id, metas]) => ({ id, name: metas[0]?.name || "Thành viên" })) : [];
}
function nameOf(id) { return presenceList().find(p => p.id === id)?.name || "Thành viên"; }

function updateGiftRecipients() {
  const select = $("giftTo"); if (!select) return;
  const keep = select.value;
  select.replaceChildren(new Option("Cả phòng", "all"));
  presenceList().filter(p => p.id !== currentUser?.id).forEach(p => select.append(new Option(p.name, p.id)));
  select.value = [...select.options].some(o => o.value === keep) ? keep : "all";
}

function addChatLine(cls, name, text) {
  const log = $("chatLog"); if (!log) return;
  log.querySelector(".chat-empty")?.remove();
  const line = document.createElement("div"); line.className = cls;
  if (name) { const who = document.createElement("strong"); who.textContent = name; line.append(who); }
  line.append(document.createTextNode(text));
  log.append(line);
  while (log.children.length > MAX_CHAT_LINES) log.firstChild.remove();
  log.scrollTop = log.scrollHeight;
}
function resetChat() {
  const log = $("chatLog"); if (!log) return;
  const empty = document.createElement("p"); empty.className = "chat-empty"; empty.textContent = "Chưa có tin nhắn nào.";
  log.replaceChildren(empty);
  if ($("chatInput")) $("chatInput").value = "";
  if ($("giftStatus")) $("giftStatus").textContent = "Quà sẽ hiện hiệu ứng toàn màn hình cho mọi người trong phòng.";
  if ($("giftTo")) $("giftTo").replaceChildren(new Option("Cả phòng", "all"));
  giftReadyAt = 0; chatReadyAt = 0;
}

// Người nhận (và cả người gửi) đều chạy cùng một hàm để thấy hiệu ứng giống nhau.
function handleGift(payload) {
  if (!activeRoom || !payload || typeof payload.from !== "string") return;
  if (typeof payload.gift !== "string" || !Object.hasOwn(GIFTS, payload.gift)) return; // chỉ nhận quà hợp lệ
  const gift = GIFTS[payload.gift];
  const toAll = payload.to === "all" || typeof payload.to !== "string";
  const text = `${gift.icon} ${nameOf(payload.from)} tặng ${gift.label} cho ${toAll ? "cả phòng" : (payload.to === currentUser.id ? "bạn" : nameOf(payload.to))}`;
  addChatLine("chat-sys", null, text);
  showBanner(text);
  playGift(payload.gift);
}
function handleChat(payload) {
  if (!activeRoom || !payload || typeof payload.from !== "string" || typeof payload.text !== "string") return;
  const text = payload.text.trim().slice(0, 200); if (!text) return;
  addChatLine(payload.from === currentUser.id ? "chat-msg me" : "chat-msg", nameOf(payload.from), text);
  playTextEffect(text); // từ khóa đặc biệt → thả biểu tượng cảm xúc
}

document.querySelectorAll("[data-gift]").forEach(button => button.addEventListener("click", async () => {
  if (!activeRoom || !roomChannel) return;
  const now = Date.now();
  if (now < giftReadyAt) { $("giftStatus").textContent = "Chờ một chút rồi tặng quà tiếp nhé."; return; }
  giftReadyAt = now + GIFT_COOLDOWN_MS;
  const payload = { gift: button.dataset.gift, to: $("giftTo").value || "all", from: currentUser.id };
  handleGift(payload);
  document.querySelectorAll("[data-gift]").forEach(b => { b.disabled = true; });
  setTimeout(() => document.querySelectorAll("[data-gift]").forEach(b => { b.disabled = false; }), GIFT_COOLDOWN_MS);
  await roomChannel.send({ type: "broadcast", event: "gift", payload });
}));
$("chatForm")?.addEventListener("submit", async event => {
  event.preventDefault();
  if (!activeRoom || !roomChannel) return;
  const text = $("chatInput").value.trim().slice(0, 200), now = Date.now();
  if (!text || now < chatReadyAt) return;
  chatReadyAt = now + CHAT_COOLDOWN_MS;
  $("chatInput").value = "";
  const payload = { text, from: currentUser.id };
  handleChat(payload);
  await roomChannel.send({ type: "broadcast", event: "chat", payload });
});
$("leaveBtn").addEventListener("click", () => leaveRoom());
$("closeCallBtn").addEventListener("click", () => leaveRoom());

async function leaveRoom(notifyHost = true) {
  if (!activeRoom) return;
  const room = activeRoom;
  if (notifyHost && room.host_id === currentUser.id && roomChannel) {
    await roomChannel.send({ type: "broadcast", event: "room_closed", payload: {} });
    await supabase.from("voice_rooms").update({ is_open: false }).eq("id", room.id).eq("host_id", currentUser.id);
  }
  for (const id of [...peers.keys()]) removePeer(id);
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  localStream = null; micEnabled = true;
  if (voiceLfo) { try { voiceLfo.stop(); } catch {} voiceLfo.disconnect(); voiceLfo = null; }
  if (audioContext) { await audioContext.close().catch(() => {}); audioContext = null; }
  processedStream = null; micSource = null; voiceNodes = null; soundBus = null;
  if ($("voiceEffect")) $("voiceEffect").value = "normal";
  if ($("soundStatus")) $("soundStatus").textContent = "Âm thanh sẽ được phát cho cả phòng nghe.";
  if (roomChannel) { await supabase.removeChannel(roomChannel); roomChannel = null; }
  stopEffects(); resetChat();
  activeRoom = null; $("callModal").hidden = true; $("participantList").replaceChildren(); $("remoteAudios").replaceChildren();
  await loadRooms();
}

window.addEventListener("beforeunload", () => {
  if (localStream) localStream.getTracks().forEach(track => track.stop());
  peers.forEach(pc => pc.close());
});
init();
