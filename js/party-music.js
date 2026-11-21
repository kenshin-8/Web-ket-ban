/* Connect — Nhạc chung trong phòng tiệc.
   - Chủ phòng là "nguồn sự thật": phát/dừng/tua/chuyển bài rồi phát trạng thái cho cả phòng.
   - Thành viên chỉ ĐỀ XUẤT bài; chủ phòng duyệt thì bài mới vào hàng chờ (tránh spam và
     tránh việc một liên kết lạ làm lộ địa chỉ IP của cả phòng).
   - Mỗi người nghe nhạc từ trình phát cục bộ (không trộn vào micro) nên không bị vọng tiếng.
   - Nguồn phát: liên kết YouTube (trình phát nhúng chính thức, có cả lời karaoke) hoặc file âm thanh
     trực tiếp (.mp3 .ogg .m4a .aac .wav .opus .flac) qua https.
   Lưu ý bảo mật: Supabase Realtime broadcast không xác thực người gửi; trường `from` chỉ là kiểm tra
   cơ bản. Kẻ cố tình giả mạo chỉ ảnh hưởng tới nhạc trong chính phòng đó. */

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be", "www.youtube-nocookie.com", "youtube-nocookie.com"]);
const AUDIO_EXT = /\.(mp3|ogg|oga|m4a|aac|wav|opus|flac)$/i;
const MAX_QUEUE = 20, MAX_PENDING = 10, SUGGEST_COOLDOWN_MS = 5000, TICK_MS = 5000, DRIFT_SEC = 1.5;

/** Trả về {kind, src} hợp lệ hoặc null. Luôn dựng lại từ dữ liệu đã kiểm tra. */
export function parseSource(raw) {
  let u; try { u = new URL(String(raw).trim()); } catch { return null; }
  if (YT_HOSTS.has(u.hostname)) {
    let id = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (u.pathname === "/watch") id = u.searchParams.get("v");
    else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[1]; }
    return id && /^[\w-]{11}$/.test(id) ? { kind: "yt", src: id } : null;
  }
  const local = u.protocol === "http:" && ["localhost", "127.0.0.1"].includes(u.hostname); // tiện cho việc thử nghiệm
  if ((u.protocol === "https:" || local) && !u.username && !u.password && AUDIO_EXT.test(u.pathname)) return { kind: "audio", src: u.href };
  return null;
}
const fmt = s => { s = Math.max(0, Math.floor(Number(s) || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };
const cleanTitle = t => String(t || "").replace(/\s+/g, " ").trim().slice(0, 80);
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2)).replace(/-/g, "").slice(0, 8);

let ytApiPromise = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (ytApiPromise) return ytApiPromise;
  ytApiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev?.(); resolve(window.YT); };
    const s = document.createElement("script"); s.src = "https://www.youtube.com/iframe_api"; s.async = true;
    s.onerror = () => { ytApiPromise = null; reject(new Error("Không tải được trình phát YouTube.")); };
    document.head.appendChild(s);
  });
  return ytApiPromise;
}

export class PartyMusic {
  constructor({ channel, selfId, hostId, selfName }) {
    this.ch = channel; this.selfId = selfId; this.hostId = hostId; this.selfName = selfName || "Thành viên";
    this.isHost = selfId === hostId;
    this.state = { queue: [], index: -1, playing: false, pos: 0, at: performance.now() };
    this.pending = []; this.lastSuggest = new Map(); this.lastOwnAdd = 0;
    this.loadedId = null; this.engineKind = null; this.yt = null; this.ytReady = null;
    this.vol = 60; this.muted = false; this.timers = []; this.destroyed = false;
    try { const v = Number(localStorage.getItem("connect.musicVol")); if (v >= 0 && v <= 100 && localStorage.getItem("connect.musicVol") !== null) this.vol = v; } catch { /* bỏ qua */ }
    this.$ = id => document.getElementById(id);
    this.audio = this.$("musicAudio");
  }

  /* ---------- vòng đời ---------- */
  start() {
    const $ = this.$;
    $("musicPanel").hidden = false;
    $("musicPanel").classList.toggle("is-host", this.isHost);
    $("musicRole").textContent = this.isHost ? "Bạn là chủ phòng: bạn điều khiển nhạc, mọi người nghe đồng bộ." : "Chủ phòng điều khiển nhạc. Bạn có thể đề xuất bài và chỉnh âm lượng của riêng mình.";
    $("musicAddBtn").textContent = this.isHost ? "Thêm vào hàng chờ" : "Đề xuất bài";
    $("musicVolume").value = String(this.vol); $("musicMute").setAttribute("aria-pressed", "false");

    this.bind($("musicAddForm"), "submit", e => { e.preventDefault(); this.submitUrl($("musicUrl").value); });
    this.bind($("musicPlay"), "click", () => this.hostCmd("toggle"));
    this.bind($("musicNext"), "click", () => this.hostCmd("next"));
    this.bind($("musicPrev"), "click", () => this.hostCmd("prev"));
    this.bind($("musicSeek"), "change", e => this.hostCmd("seek", Number(e.target.value)));
    this.bind($("musicVolume"), "input", e => { this.vol = Number(e.target.value); this.applyVolume(); try { localStorage.setItem("connect.musicVol", String(this.vol)); } catch { /* bỏ qua */ } });
    this.bind($("musicMute"), "click", () => { this.muted = !this.muted; $("musicMute").setAttribute("aria-pressed", String(this.muted)); $("musicMute").textContent = this.muted ? "🔇 Đang tắt" : "🔊 Tắt cho tôi"; this.applyVolume(); });
    this.bind($("musicResume"), "click", () => { $("musicResume").hidden = true; this.apply(true); });
    this.bind(this.audio, "ended", () => this.onEnded());
    this.bind(this.audio, "error", () => this.onPlayError());

    this.timers.push(setInterval(() => this.tickUi(), 500));
    if (this.isHost) this.timers.push(setInterval(() => { if (this.state.playing) this.broadcast(); }, TICK_MS));
    else this.send({ type: "req" });
    this.renderAll();
  }
  bind(el, ev, fn) { el.addEventListener(ev, fn); (this._unbind ||= []).push(() => el.removeEventListener(ev, fn)); }

  destroy() {
    this.destroyed = true;
    this.timers.forEach(clearInterval); this.timers = [];
    this._unbind?.forEach(f => f()); this._unbind = [];
    try { this.audio.pause(); this.audio.removeAttribute("src"); this.audio.load(); } catch { /* bỏ qua */ }
    try { this.yt?.destroy(); } catch { /* bỏ qua */ }
    this.yt = null; this.ytReady = null;
    const host = this.$("ytHost"); if (host) host.replaceChildren(Object.assign(document.createElement("div"), { id: "ytPlayer" }));
    this.$("musicPanel").hidden = true; this.$("musicUrl").value = ""; this.$("musicMsg").textContent = "";
    this.$("musicResume").hidden = true; this.$("musicMute").textContent = "🔊 Tắt cho tôi";
  }

  /* ---------- mạng ---------- */
  send(payload) { try { return this.ch.send({ type: "broadcast", event: "music", payload: { ...payload, from: this.selfId } }); } catch (e) { console.warn("music send", e); } }
  onPeerJoin() { if (this.isHost && !this.destroyed) this.broadcast(); }
  broadcast() { this.send({ type: "state", queue: this.state.queue, index: this.state.index, playing: this.state.playing, pos: this.position() }); }

  handle(p) {
    if (this.destroyed || !p || typeof p.from !== "string" || p.from === this.selfId) return;
    if (p.type === "state" && p.from === this.hostId && !this.isHost) {
      const queue = (Array.isArray(p.queue) ? p.queue : []).slice(0, MAX_QUEUE).map(it => this.sanitizeItem(it)).filter(Boolean);
      const index = Number.isInteger(p.index) && p.index >= -1 && p.index < queue.length ? p.index : -1;
      this.state = { queue, index, playing: !!p.playing && index >= 0, pos: Math.max(0, Number(p.pos) || 0), at: performance.now() };
      this.renderAll(); this.apply(false);
    } else if (this.isHost && p.type === "req") { this.broadcast(); }
    else if (this.isHost && p.type === "suggest") { this.receiveSuggestion(p); }
  }

  /* ---------- dữ liệu ---------- */
  sanitizeItem(it) {
    if (!it || typeof it !== "object") return null;
    const src = it.kind === "yt" ? parseSource(`https://youtu.be/${String(it.src)}`) : parseSource(String(it.src));
    if (!src || src.kind !== it.kind) return null;
    return { id: String(it.id || "").slice(0, 12) || uid(), kind: src.kind, src: src.src, title: cleanTitle(it.title) || (src.kind === "yt" ? "Video YouTube" : this.fileName(src.src)), by: cleanTitle(it.by).slice(0, 30) || "Thành viên" };
  }
  fileName(url) { try { return decodeURIComponent(new URL(url).pathname.split("/").pop()).replace(AUDIO_EXT, "") || "Bản nhạc"; } catch { return "Bản nhạc"; } }
  async fetchTitle(src) {
    if (src.kind !== "yt") return this.fileName(src.src);
    try {
      const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent("https://www.youtube.com/watch?v=" + src.src)}&format=json`);
      if (r.ok) { const j = await r.json(); return cleanTitle(j.title) || "Video YouTube"; }
    } catch { /* bỏ qua: dùng tên mặc định */ }
    return "Video YouTube";
  }
  position() { const s = this.state; return s.playing ? s.pos + (performance.now() - s.at) / 1000 : s.pos; }
  current() { return this.state.queue[this.state.index] || null; }
  say(msg) { this.$("musicMsg").textContent = msg; }

  async submitUrl(raw) {
    const src = parseSource(raw);
    if (!src) return this.say("Liên kết chưa hợp lệ. Hãy dán link YouTube hoặc link file nhạc https (.mp3, .ogg, .m4a...).");
    const now = Date.now(); if (now - this.lastOwnAdd < SUGGEST_COOLDOWN_MS) return this.say("Chờ vài giây rồi thêm bài tiếp nhé.");
    this.lastOwnAdd = now;
    const title = await this.fetchTitle(src);
    const item = { id: uid(), kind: src.kind, src: src.src, title, by: this.selfName };
    this.$("musicUrl").value = "";
    if (this.isHost) { this.addToQueue(item); this.say(`Đã thêm: ${title}`); }
    else { this.send({ type: "suggest", item }); this.say("Đã gửi đề xuất cho chủ phòng."); }
  }
  receiveSuggestion(p) {
    const item = this.sanitizeItem(p.item); if (!item) return;
    const last = this.lastSuggest.get(p.from) || 0, now = Date.now();
    if (now - last < SUGGEST_COOLDOWN_MS || this.pending.length >= MAX_PENDING) return;
    if (this.pending.some(x => x.kind === item.kind && x.src === item.src)) return;
    this.lastSuggest.set(p.from, now); item.id = uid(); this.pending.push(item); this.renderPending();
  }

  /* ---------- lệnh của chủ phòng ---------- */
  setState(patch) { this.state = { ...this.state, ...patch, at: performance.now() }; this.renderAll(); this.apply(false); this.broadcast(); }
  addToQueue(item) {
    if (!this.isHost) return;
    if (this.state.queue.length >= MAX_QUEUE) return this.say("Hàng chờ đã đầy (20 bài).");
    const queue = [...this.state.queue, item];
    if (this.state.index === -1) this.setState({ queue, index: queue.length - 1, playing: true, pos: 0 });
    else this.setState({ queue, pos: this.position() });
  }
  hostCmd(cmd, val) {
    if (!this.isHost) return;
    const s = this.state, n = s.queue.length;
    if (cmd === "toggle") { if (s.index === -1 && n) return this.setState({ index: 0, playing: true, pos: 0 }); if (s.index === -1) return; return this.setState({ playing: !s.playing, pos: this.position() }); }
    if (cmd === "next") { if (s.index + 1 < n) this.setState({ index: s.index + 1, playing: true, pos: 0 }); else this.setState({ playing: false, pos: 0 }); }
    if (cmd === "prev") { if (this.position() > 3 || s.index <= 0) this.setState({ pos: 0 }); else this.setState({ index: s.index - 1, playing: true, pos: 0 }); }
    if (cmd === "seek" && s.index >= 0) this.setState({ pos: Math.max(0, val || 0) });
    if (cmd === "jump" && val >= 0 && val < n) this.setState({ index: val, playing: true, pos: 0 });
    if (cmd === "remove" && val >= 0 && val < n) {
      const queue = s.queue.filter((_, i) => i !== val);
      if (val < s.index) this.setState({ queue, index: s.index - 1 });
      else if (val === s.index) this.setState(queue.length ? { queue, index: Math.min(val, queue.length - 1), playing: s.playing && val < queue.length, pos: 0 } : { queue, index: -1, playing: false, pos: 0 });
      else this.setState({ queue });
    }
  }
  onEnded() { if (this.isHost) this.hostCmd("next"); }
  onPlayError() { const it = this.current(); if (!it) return; this.say(`Không phát được "${it.title}".`); if (this.isHost) setTimeout(() => this.hostCmd("next"), 800); }

  /* ---------- phát nhạc ---------- */
  applyVolume() {
    this.audio.volume = this.vol / 100; this.audio.muted = this.muted;
    try { if (this.yt?.setVolume) { this.yt.setVolume(this.vol); this.muted ? this.yt.mute() : this.yt.unMute(); } } catch { /* chưa sẵn sàng */ }
  }
  async ensureYt() {
    if (this.ytReady) return this.ytReady;
    this.ytReady = loadYouTubeApi().then(YT => new Promise(resolve => {
      this.yt = new YT.Player("ytPlayer", {
        width: "100%", height: "100%", host: "https://www.youtube-nocookie.com",
        playerVars: { controls: 0, disablekb: 1, playsinline: 1, rel: 0, modestbranding: 1, origin: location.origin },
        events: {
          onReady: () => { this.applyVolume(); resolve(this.yt); },
          onStateChange: e => { if (e.data === 0) this.onEnded(); },
          onError: () => this.onPlayError(),
          onAutoplayBlocked: () => { this.$("musicResume").hidden = false; }
        }
      });
    })).catch(e => { this.say(e.message); this.ytReady = null; return null; });
    return this.ytReady;
  }
  async apply(userGesture) {
    if (this.destroyed) return;
    const it = this.current(), want = this.state.playing, pos = this.position();
    this.$("ytHost").hidden = !(it && it.kind === "yt");
    if (!it) { try { this.audio.pause(); this.yt?.pauseVideo?.(); } catch { /* bỏ qua */ } this.loadedId = null; return; }
    const changed = this.loadedId !== it.id; this.loadedId = it.id;
    if (it.kind === "audio") {
      try { this.yt?.pauseVideo?.(); } catch { /* bỏ qua */ }
      if (changed) { this.audio.src = it.src; this.audio.currentTime = 0; }
      this.applyVolume();
      const sync = () => { if (Math.abs(this.audio.currentTime - this.position()) > (changed ? 0.3 : DRIFT_SEC)) { try { this.audio.currentTime = this.position(); } catch { /* chưa tải xong */ } } };
      if (changed && this.audio.readyState < 1) this.audio.addEventListener("loadedmetadata", sync, { once: true }); else sync();
      if (want) { this.audio.play().then(() => { this.$("musicResume").hidden = true; }).catch(() => { this.$("musicResume").hidden = false; }); } else this.audio.pause();
    } else {
      this.audio.pause();
      const yt = await this.ensureYt(); if (!yt || this.destroyed || this.loadedId !== it.id) return;
      this.applyVolume();
      try {
        if (changed) yt.loadVideoById({ videoId: it.src, startSeconds: pos });
        else if (Math.abs(yt.getCurrentTime() - pos) > DRIFT_SEC) yt.seekTo(pos, true);
        if (want) yt.playVideo(); else if (!changed) yt.pauseVideo(); else setTimeout(() => yt.pauseVideo?.(), 400);
      } catch (e) { console.warn("YT apply", e); }
    }
  }
  currentTime() {
    const it = this.current(); if (!it) return 0;
    try { return it.kind === "audio" ? this.audio.currentTime : (this.yt?.getCurrentTime?.() || 0); } catch { return 0; }
  }
  duration() {
    const it = this.current(); if (!it) return 0;
    try { return it.kind === "audio" ? (this.audio.duration || 0) : (this.yt?.getDuration?.() || 0); } catch { return 0; }
  }

  /* ---------- giao diện ---------- */
  tickUi() {
    const it = this.current(), dur = this.duration(), pos = Math.min(this.position(), dur || Infinity);
    this.$("musicTime").textContent = it ? `${fmt(pos)} / ${dur ? fmt(dur) : "--:--"}` : "0:00 / 0:00";
    const seek = this.$("musicSeek"); seek.max = String(Math.max(1, Math.floor(dur) || 1));
    if (document.activeElement !== seek) seek.value = String(Math.floor(pos));
    // chủ phòng ngoài việc phát còn tự sửa lệch của chính mình
    if (this.isHost && this.state.playing && it && Math.abs(this.currentTime() - this.position()) > 3 && this.currentTime() > 0) this.state = { ...this.state, pos: this.currentTime(), at: performance.now() };
  }
  renderAll() { this.renderNow(); this.renderQueue(); this.renderPending(); }
  renderNow() {
    const it = this.current();
    this.$("musicTitle").textContent = it ? it.title : "Chưa có bài nào";
    this.$("musicBy").textContent = it ? `${it.kind === "yt" ? "YouTube" : "File âm thanh"} · thêm bởi ${it.by}` : (this.isHost ? "Dán liên kết bên dưới để bắt đầu." : "Chờ chủ phòng thêm bài hoặc đề xuất một bài.");
    this.$("musicPlay").textContent = this.state.playing ? "⏸ Dừng" : "▶ Phát"; this.$("musicPlay").setAttribute("aria-label", this.state.playing ? "Tạm dừng" : "Phát");
    ["musicPlay", "musicNext", "musicPrev", "musicSeek"].forEach(id => { this.$(id).disabled = !this.isHost; });
  }
  renderQueue() {
    const ol = this.$("musicQueue"); ol.replaceChildren();
    if (!this.state.queue.length) { const li = document.createElement("li"); li.className = "music-empty"; li.textContent = "Hàng chờ trống."; ol.append(li); return; }
    this.state.queue.forEach((it, i) => {
      const li = document.createElement("li"); if (i === this.state.index) li.className = "now";
      const t = document.createElement("span"); t.className = "music-q-title"; t.textContent = `${i === this.state.index ? "▶ " : ""}${it.title}`; li.append(t);
      if (this.isHost) {
        const go = document.createElement("button"); go.type = "button"; go.textContent = "Phát"; go.setAttribute("aria-label", `Phát ${it.title}`); go.onclick = () => this.hostCmd("jump", i);
        const rm = document.createElement("button"); rm.type = "button"; rm.textContent = "✕"; rm.setAttribute("aria-label", `Xóa ${it.title}`); rm.onclick = () => this.hostCmd("remove", i);
        li.append(go, rm);
      }
      ol.append(li);
    });
  }
  renderPending() {
    const box = this.$("musicPending"), ul = this.$("musicPendingList");
    box.hidden = !this.isHost || !this.pending.length; ul.replaceChildren();
    this.pending.forEach(it => {
      const li = document.createElement("li");
      const t = document.createElement("span"); t.className = "music-q-title"; t.textContent = `${it.title} · ${it.by}`; li.append(t);
      const ok = document.createElement("button"); ok.type = "button"; ok.textContent = "Duyệt"; ok.onclick = () => { this.pending = this.pending.filter(x => x !== it); this.renderPending(); this.addToQueue(it); };
      const no = document.createElement("button"); no.type = "button"; no.textContent = "Bỏ"; no.onclick = () => { this.pending = this.pending.filter(x => x !== it); this.renderPending(); };
      li.append(ok, no); ul.append(li);
    });
  }
}
