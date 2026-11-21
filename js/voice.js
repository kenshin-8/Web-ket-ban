import { PartyMusic } from "./party-music.js";
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
const pendingIceCandidates = new Map();
const peerDisconnectTimers = new Map();
let roomConnectionId = null;
let roomHeartbeatTimer = null;

function createConnectionId() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return [...bytes].map(value => value.toString(16).padStart(2, "0")).join("");
}

async function releaseRoomSlot(roomId = activeRoom?.id) {
  if (roomHeartbeatTimer) window.clearInterval(roomHeartbeatTimer);
  roomHeartbeatTimer = null;
  const connectionId = roomConnectionId;
  roomConnectionId = null;
  if (!roomId || !connectionId) return;
  try {
    const { error } = await withRequestTimeout(
      supabase.rpc("leave_voice_room", { p_room_id: roomId, p_connection_id: connectionId }), 5000
    );
    if (error) console.warn("Không thể giải phóng lượt tham gia phòng:", error);
  } catch (error) {
    console.warn("Không thể giải phóng lượt tham gia phòng:", error);
  }
}

function startRoomHeartbeat(roomId) {
  if (roomHeartbeatTimer) window.clearInterval(roomHeartbeatTimer);
  roomHeartbeatTimer = window.setInterval(async () => {
    if (!activeRoom || activeRoom.id !== roomId || !roomConnectionId) return;
    try {
      const { data, error } = await supabase.rpc("heartbeat_voice_room", {
        p_room_id: roomId,
        p_connection_id: roomConnectionId
      });
      if (error) {
        console.warn("Không thể gia hạn lượt tham gia phòng:", error);
      } else if (data === false) {
        $("callStatus").textContent = "Lượt tham gia phòng đã hết hạn. Vui lòng tham gia lại.";
        await leaveRoom(false);
      }
    } catch (error) {
      console.warn("Không thể gia hạn lượt tham gia phòng:", error);
    }
  }, 30000);
}

async function withRequestTimeout(request, milliseconds = 12000) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => reject(new Error("Supabase phản hồi quá lâu. Kiểm tra kết nối rồi thử lại.")), milliseconds);
  });
  try { return await Promise.race([request, timeout]); }
  finally { window.clearTimeout(timer); }
}

async function init() {
  const list = $("roomList");
  try {
    const { data, error } = await withRequestTimeout(supabase.auth.getUser());
    if (error) throw error;
    currentUser = data.user || null;
    // Cho phép mở biểu mẫu để hiển thị hướng dẫn đăng nhập thay vì vô hiệu hóa nút.
    $("showCreateBtn").disabled = false;
    if (!currentUser) {
      list.innerHTML = '<div class="empty-state">Bạn cần <a href="login.html">đăng nhập</a> để tạo và tham gia phòng thoại.</div>';
      return;
    }
    await loadRooms();
  } catch (error) {
    console.error("Không khởi tạo được phòng thoại:", error);
    $("showCreateBtn").disabled = false;
    list.innerHTML = '<div class="empty-state">Không kiểm tra được phiên đăng nhập. Hãy tải lại trang hoặc đăng nhập lại.</div>';
  }
}

function showRoomNotice(message) {
  const notice = document.createElement("div");
  notice.className = "empty-state room-error-notice";
  notice.setAttribute("role", "alert");
  notice.textContent = message;
  $("roomList")?.prepend(notice);
}

async function loadRooms() {
  const list = $("roomList");
  list.innerHTML = '<div class="empty-state">Đang tải danh sách phòng...</div>';
  try {
    const { data, error } = await withRequestTimeout(
      supabase.from("voice_rooms").select("id,name,topic,description,host_name,host_id,created_at").eq("is_open", true).order("created_at", { ascending: false }).limit(40)
    );
    if (error) throw error;
    renderRooms(data || []);
  } catch (error) {
    list.innerHTML = `<div class="empty-state">Không tải được phòng: ${String(error.message || "Lỗi kết nối").replace(/[<>]/g, "")}. Kiểm tra migration 015_voice_avatar_repair_v2.sql.</div>`;
    console.error("Lỗi tải phòng thoại:", error);
  }
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
$("showCreateBtn").addEventListener("click", () => {
  $("createModal").hidden = false;
  if (!currentUser) $("createMessage").textContent = "Bạn cần đăng nhập trước khi tạo phòng thoại.";
  else $("createMessage").textContent = "";
  window.setTimeout(() => $("roomName")?.focus(), 0);
});
$("closeCreateBtn").addEventListener("click", () => { $("createModal").hidden = true; });
$("createModal").addEventListener("click", e => { if (e.target === $("createModal")) $("createModal").hidden = true; });

$("createRoomForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("createRoomBtn");
  const message = $("createMessage");
  if (!currentUser) {
    message.textContent = "Bạn cần đăng nhập trước khi tạo phòng thoại.";
    return;
  }
  const name = $("roomName").value.trim();
  const description = $("roomDescription").value.trim();
  const topic = $("roomTopic").value;
  if (name.length < 3 || name.length > 55) {
    message.textContent = "Tên phòng cần có từ 3 đến 55 ký tự.";
    return;
  }
  button.disabled = true;
  message.textContent = "Đang tạo phòng...";
  try {
    const hostName = currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Thành viên";
    const { data, error } = await withRequestTimeout(
      supabase.from("voice_rooms").insert({ name, topic, description, host_id: currentUser.id, host_name: hostName }).select().single()
    );
    if (error) {
      if (error.code === "42501" || /permission|row-level security/i.test(error.message || "")) {
        throw new Error("Tài khoản chưa có quyền tạo phòng. Hãy chạy supabase/migrations/015_voice_avatar_repair_v2.sql trong SQL Editor.");
      }
      if (error.code === "42P01") throw new Error("Chưa có bảng voice_rooms. Hãy chạy migration 015_voice_avatar_repair_v2.sql.");
      throw error;
    }
    if (!data?.id) throw new Error("Supabase chưa trả về phòng vừa tạo.");
    $("createRoomForm").reset();
    $("createModal").hidden = true;
    message.textContent = "";
    await loadRooms();
    await joinRoom(data);
  } catch (error) {
    console.error("Lỗi tạo phòng thoại:", error);
    message.textContent = `Không tạo được phòng: ${error.message || "Lỗi không xác định"}`;
  } finally {
    button.disabled = false;
  }
});

async function joinRoom(room) {
  if (activeRoom || !currentUser) return;
  activeRoom = room;
  localStream = null;
  micEnabled = false;
  $("callModal").hidden = false;
  $("activeRoomName").textContent = room.name;
  $("callStatus").textContent = "Đang kiểm tra chỗ trống...";
  updateMicButton();

  // Giữ chỗ nguyên tử ở PostgreSQL trước khi tham gia Presence để không vượt quá 4 người.
  roomConnectionId = createConnectionId();
  try {
    const { error } = await withRequestTimeout(supabase.rpc("join_voice_room", {
      p_room_id: room.id,
      p_connection_id: roomConnectionId
    }), 12000);
    if (error) throw error;
  } catch (error) {
    roomConnectionId = null;
    activeRoom = null;
    $("callModal").hidden = true;
    const message = ["PGRST202", "42883"].includes(error.code)
      ? "Chưa bật giới hạn thành viên phía máy chủ. Hãy chạy supabase/migrations/019_voice_room_capacity.sql trong Supabase SQL Editor."
      : (error.message || "Không thể tham gia phòng.");
    await loadRooms();
    showRoomNotice(message);
    return;
  }

  // Vào phòng trước, chỉ xin quyền micro khi người dùng chủ động nhấn nút.
  // Điều này tránh việc hộp thoại cấp quyền của trình duyệt làm treo luồng tham gia.
  roomChannel = supabase.channel(`voice-room-${room.id}`, { config: { presence: { key: currentUser.id }, broadcast: { self: false } } });
  roomChannel.on("presence", { event: "sync" }, handlePresenceSync);
  roomChannel.on("broadcast", { event: "signal" }, ({ payload }) => handleSignal(payload));
  roomChannel.on("broadcast", { event: "gift" }, ({ payload }) => handleGift(payload));
  roomChannel.on("broadcast", { event: "chat" }, ({ payload }) => handleChat(payload));
  const selfName = currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Thành viên";
  music = new PartyMusic({ channel: roomChannel, selfId: currentUser.id, hostId: room.host_id, selfName });
  roomChannel.on("broadcast", { event: "music" }, ({ payload }) => music?.handle(payload));
  roomChannel.on("presence", { event: "join" }, () => music?.onPeerJoin());
  roomChannel.on("broadcast", { event: "room_closed" }, () => { alert("Chủ phòng đã kết thúc phòng thoại."); leaveRoom(false); });
  try {
    await withRequestTimeout(new Promise((resolve, reject) => {
      roomChannel.subscribe(async state => {
        if (activeRoom?.id !== room.id || !roomChannel) return;
        if (state === "SUBSCRIBED") {
          try {
            await roomChannel.track({ user_id: currentUser.id, name: currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Thành viên", joined_at: new Date().toISOString() });
            startRoomHeartbeat(room.id);
            $("callStatus").textContent = "Đã vào phòng · Chế độ nghe/chat. Nhấn Bật micro nếu muốn nói chuyện.";
            updateParticipants();
            music?.start();
            resolve(true);
          } catch (error) { reject(error); }
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
          reject(new Error("Không kết nối được Realtime. Kiểm tra cấu hình Supabase Realtime."));
        }
      });
    }), 12000);
  } catch (error) {
    console.error("Lỗi tham gia phòng thoại:", error);
    $("callStatus").textContent = error.message || "Kết nối phòng thất bại.";
    music?.destroy(); music = null;
    await releaseRoomSlot(room.id);
    if (roomChannel) {
      await supabase.removeChannel(roomChannel).catch(() => {});
      roomChannel = null;
    }
    activeRoom = null;
    $("callModal").hidden = true;
    await loadRooms();
    showRoomNotice(error.message || "Không kết nối được phòng thoại.");
  }
}

async function handlePresenceSync() {
  if (!activeRoom || !roomChannel || !currentUser) return;
  const state = roomChannel.presenceState();
  const people = Object.entries(state).flatMap(([id, metas]) => metas.slice(0, 1).map(meta => ({ id, ...meta })));
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
  if (peers.has(peerId)) return peers.get(peerId);
  if (!activeRoom || !roomChannel) return null;

  const pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.l.google.com:19302" }] });
  peers.set(peerId, pc);
  // Luôn thương lượng một kênh audio hai chiều. Người dùng có thể bật micro sau khi đã vào phòng.
  const audioTransceiver = pc.addTransceiver("audio", { direction: "sendrecv" });
  const outgoingTrack = (processedStream || localStream)?.getAudioTracks()[0] || null;
  if (outgoingTrack) await audioTransceiver.sender.replaceTrack(outgoingTrack);

  pc.onicecandidate = event => {
    if (event.candidate) sendSignal({ to: peerId, candidate: event.candidate.toJSON() });
  };
  pc.ontrack = event => {
    // replaceTrack trên transceiver không gắn stream ID, vì vậy một số trình duyệt
    // trả event.streams rỗng. Tạo MediaStream tường minh để audio vẫn phát được.
    let stream = event.streams?.[0];
    if (!stream) {
      stream = remoteStreams.get(peerId) || new MediaStream();
      if (!stream.getTracks().some(track => track.id === event.track.id)) stream.addTrack(event.track);
    }
    remoteStreams.set(peerId, stream);
    let audio = document.getElementById(`remote-${peerId}`);
    if (!audio) {
      audio = document.createElement("audio");
      audio.id = `remote-${peerId}`;
      audio.autoplay = true;
      audio.playsInline = true;
      $("remoteAudios").append(audio);
    }
    audio.srcObject = stream;
    audio.play?.().catch(() => {
      $("callStatus").textContent = "Đã kết nối âm thanh. Nếu chưa nghe được, hãy tương tác với trang rồi thử lại.";
    });
  };
  pc.onconnectionstatechange = () => {
    if (pc.connectionState === "connected") {
      const timer = peerDisconnectTimers.get(peerId);
      if (timer) window.clearTimeout(timer);
      peerDisconnectTimers.delete(peerId);
    } else if (pc.connectionState === "disconnected") {
      if (!peerDisconnectTimers.has(peerId)) {
        peerDisconnectTimers.set(peerId, window.setTimeout(() => {
          peerDisconnectTimers.delete(peerId);
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") removePeer(peerId);
        }, 10000));
      }
    } else if (["failed", "closed"].includes(pc.connectionState)) {
      removePeer(peerId);
    }
  };

  if (initiator) {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    await sendSignal({ to: peerId, description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
  }
  return pc;
}

async function flushPendingIceCandidates(peerId, pc) {
  const queued = pendingIceCandidates.get(peerId) || [];
  pendingIceCandidates.delete(peerId);
  for (const candidate of queued) {
    try { await pc.addIceCandidate(candidate); }
    catch (error) { console.warn("Bỏ qua ICE candidate không hợp lệ:", error); }
  }
}

async function sendSignal(payload) {
  if (!roomChannel) return;
  await roomChannel.send({ type: "broadcast", event: "signal", payload: { ...payload, from: currentUser.id } });
}

async function handleSignal(payload) {
  if (!payload || payload.to !== currentUser.id || !payload.from || payload.from === currentUser.id) return;
  try {
    const pc = await createPeer(payload.from, false);
    if (!pc) return;
    if (payload.description) {
      await pc.setRemoteDescription(payload.description);
      await flushPendingIceCandidates(payload.from, pc);
      if (payload.description.type === "offer") {
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignal({ to: payload.from, description: { type: pc.localDescription.type, sdp: pc.localDescription.sdp } });
      }
    } else if (payload.candidate) {
      if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
      else {
        const queued = pendingIceCandidates.get(payload.from) || [];
        if (queued.length < 64) queued.push(payload.candidate);
        pendingIceCandidates.set(payload.from, queued);
      }
    }
  } catch (error) {
    console.error("Lỗi thiết lập kết nối thoại:", error);
  }
}

function updateParticipants() {
  if (!activeRoom || !roomChannel) return;
  const state = roomChannel.presenceState(); const people = [];
  Object.values(state).forEach(metas => { if (metas?.[0]) people.push(metas[0]); });
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
  const timer = peerDisconnectTimers.get(peerId);
  if (timer) window.clearTimeout(timer);
  peerDisconnectTimers.delete(peerId);
  pendingIceCandidates.delete(peerId);
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

function updateMicButton() {
  const button = $("micBtn");
  if (button) button.textContent = !localStream ? "🎙️ Bật micro" : micEnabled ? "🎙️ Tắt micro" : "🔇 Bật micro";
}

async function requestMicrophone() {
  if (!activeRoom || localStream) return;
  if (!navigator.mediaDevices?.getUserMedia) {
    $("callStatus").textContent = "Trình duyệt cần HTTPS hoặc localhost để cấp quyền micro. Bạn vẫn có thể nghe và chat trong phòng.";
    return;
  }
  const button = $("micBtn");
  if (button) button.disabled = true;
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
    micEnabled = true;
    setupAudioProcessing();
    updateMicButton();
    const outgoingTrack = (processedStream || localStream).getAudioTracks()[0] || null;
    const ids = presenceList().map(person => person.id).filter(id => id !== currentUser.id);
    for (const peerId of ids) {
      let pc = peers.get(peerId);
      if (!pc && currentUser.id.localeCompare(peerId) < 0) pc = await createPeer(peerId, true);
      if (pc) {
        const sender = pc.getTransceivers().find(item => item.receiver?.track?.kind === "audio")?.sender;
        if (sender) await sender.replaceTrack(outgoingTrack);
      }
    }
    $("callStatus").textContent = "Micro đã bật. Bạn có thể trò chuyện bằng giọng nói.";
  } catch (error) {
    console.warn("Không thể bật micro:", error);
    $("callStatus").textContent = "Chưa bật được micro. Hãy kiểm tra quyền Microphone của trình duyệt và thử lại.";
  } finally {
    if (button) button.disabled = false;
  }
}
$("voiceEffect")?.addEventListener("change", event => {
  if (!activeRoom) return;
  if (audioContext?.state === "suspended") audioContext.resume();
  applyVoiceEffect(event.target.value);
  $("callStatus").textContent = `Đang dùng hiệu ứng: ${event.target.selectedOptions[0].textContent}`;
});
$("micBtn").addEventListener("click", async () => {
  if (!localStream) { await requestMicrophone(); return; }
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
let music = null;

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
  music?.destroy(); music = null;
  await releaseRoomSlot(room.id);
  for (const id of [...peers.keys()]) removePeer(id);
  for (const timer of peerDisconnectTimers.values()) window.clearTimeout(timer);
  peerDisconnectTimers.clear(); pendingIceCandidates.clear();
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
