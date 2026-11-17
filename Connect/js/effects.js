// Bộ hiệu ứng toàn màn hình dùng chung: quà tặng ảo (pháo hoa, mưa sao băng, trái tim bay)
// và hiệu ứng từ khóa (thả biểu tượng cảm xúc khi gõ "chúc mừng sinh nhật", "nhớ bạn", ...).
// Vẽ bằng một <canvas> phủ toàn màn hình, không chặn thao tác chuột/cảm ứng.

export const GIFTS = {
    fireworks: { icon: "🎆", label: "Pháo hoa" },
    meteors: { icon: "🌠", label: "Mưa sao băng" },
    hearts: { icon: "💖", label: "Trái tim bay" }
};

const EMOJI_FONT = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const reduceMotion = () => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
const MAX_ACTIVE = 4;

let layer, canvas, ctx, banners;
let W = 0, H = 0, dpr = 1, raf = 0, last = 0;
const active = new Set();

/* ---------- Lớp hiển thị ---------- */
function ensureLayer() {
    if (layer) return;
    layer = document.createElement("div");
    layer.className = "fx-layer";
    layer.setAttribute("aria-hidden", "true");
    if ("popover" in HTMLElement.prototype) layer.setAttribute("popover", "manual"); // nằm trên cả <dialog> đang mở
    canvas = document.createElement("canvas");
    ctx = canvas.getContext("2d");
    banners = document.createElement("div");
    banners.className = "fx-banners";
    layer.append(canvas, banners);
    document.body.appendChild(layer);
    addEventListener("resize", () => { if (layer.classList.contains("on")) resize(); });
}
function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function show() {
    ensureLayer();
    if (!layer.classList.contains("on")) {
        layer.classList.add("on");
        try { layer.showPopover?.(); } catch { /* đã mở */ }
        resize();
    }
}
function hideIfIdle() {
    if (!layer || active.size || banners.children.length) return;
    layer.classList.remove("on", "night", "dim");
    try { layer.hidePopover?.(); } catch { /* chưa mở */ }
    ctx.clearRect(0, 0, W, H);
}
function loop(t) {
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    ctx.clearRect(0, 0, W, H);
    for (const e of [...active]) {
        if (e.step(dt) === false) { active.delete(e); e.end?.(); } else e.draw(ctx);
    }
    if (active.size) raf = requestAnimationFrame(loop);
    else { raf = 0; hideIfIdle(); }
}
function start(effect) {
    if (active.size >= MAX_ACTIVE) return false;
    show();
    effect.t = 0;
    active.add(effect);
    if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); }
    return true;
}
export function stopEffects() {
    active.forEach(e => e.end?.());
    active.clear();
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    if (banners) banners.replaceChildren();
    hideIfIdle();
}

/* ---------- Biểu ngữ ngắn ("A tặng B 🎆 Pháo hoa") ---------- */
export function showBanner(text) {
    show();
    const b = document.createElement("div");
    b.className = "fx-banner";
    b.textContent = text;
    banners.appendChild(b);
    while (banners.children.length > 3) banners.firstChild.remove();
    setTimeout(() => { b.remove(); hideIfIdle(); }, 3300);
}

/* ---------- Pháo hoa ---------- */
function fireworks() {
    const k = Math.min(W, H) / 800 + 0.35;
    const e = {
        rockets: [], sparks: [], launched: 0, total: W > 700 ? 11 : 8, nextAt: 0,
        step(dt) {
            if (!this.lit) { this.lit = true; layer.classList.add("night", "dim"); } // làm tối nền nhẹ để pháo hoa nổi bật
            this.t += dt;
            if (this.launched < this.total && this.t >= this.nextAt) {
                this.launched++; this.nextAt = this.t + rand(0.28, 0.6);
                const x = rand(W * 0.12, W * 0.88), ty = rand(H * 0.14, H * 0.45);
                this.rockets.push({ x, y: H + 10, px: x, py: H + 10, ty, vy: -rand(520, 700) * k - 120, hue: rand(0, 360) });
            }
            this.rockets = this.rockets.filter(r => {
                r.px = r.x; r.py = r.y; r.y += r.vy * dt; r.vy *= 0.992;
                if (r.y <= r.ty || r.vy > -90) { this.burst(r); return false; }
                return true;
            });
            this.sparks = this.sparks.filter(s => {
                s.life -= dt; if (s.life <= 0) return false;
                s.px = s.x; s.py = s.y;
                s.vx *= 0.988; s.vy = s.vy * 0.988 + 95 * dt;
                s.x += s.vx * dt; s.y += s.vy * dt; return true;
            });
            return this.launched < this.total || this.rockets.length > 0 || this.sparks.length > 0;
        },
        burst(r) {
            const ring = Math.random() < 0.35, n = ring ? 54 : 78, sec = (r.hue + rand(40, 160)) % 360;
            for (let i = 0; i < n; i++) {
                const a = ring ? (i / n) * Math.PI * 2 : rand(0, Math.PI * 2);
                const sp = (ring ? 330 : rand(60, 390)) * k;
                const life = rand(1, 1.8);
                this.sparks.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life, max: life, hue: i % 3 === 0 ? sec : r.hue });
            }
        },
        draw(c) {
            c.save(); c.globalCompositeOperation = "lighter"; c.lineCap = "round";
            for (const r of this.rockets) {
                c.strokeStyle = `hsla(${r.hue},100%,80%,.9)`; c.lineWidth = 2.5;
                c.beginPath(); c.moveTo(r.px, r.py + 16); c.lineTo(r.x, r.y); c.stroke();
            }
            for (const s of this.sparks) {
                const a = Math.max(0, s.life / s.max);
                c.strokeStyle = `hsla(${s.hue},100%,${55 + 25 * a}%,${a})`; c.lineWidth = 1 + 2 * a;
                c.beginPath(); c.moveTo(s.x - s.vx * 0.045, s.y - s.vy * 0.045); c.lineTo(s.x, s.y); c.stroke(); // vệt sáng không phụ thuộc tốc độ khung hình
            }
            c.restore();
        },
        end() { layer?.classList.remove("dim"); if (![...active].some(x => x.night)) layer?.classList.remove("night"); },
        night: true
    };
    return e;
}

/* ---------- Mưa sao băng ---------- */
function meteors() {
    const k = Math.min(W, H) / 800 + 0.4, DUR = 5.6;
    const stars = Array.from({ length: 70 }, () => ({ x: rand(0, W), y: rand(0, H * 0.85), r: rand(0.6, 1.9), ph: rand(0, 6.28) }));
    return {
        list: [], spawnAt: 0,
        step(dt) {
            if (!this.lit) { this.lit = true; layer.classList.add("night"); }
            this.t += dt;
            if (this.t < DUR - 1.2 && this.t >= this.spawnAt) {
                this.spawnAt = this.t + rand(0.06, 0.2);
                const ang = rand(0.45, 0.75), sp = rand(750, 1250) * k;
                this.list.push({ x: rand(W * 0.2, W * 1.15), y: rand(-60, H * 0.35), vx: -Math.cos(ang) * sp, vy: Math.sin(ang) * sp, len: rand(110, 260) * k, w: rand(1.5, 3.2) });
            }
            this.list = this.list.filter(m => { m.x += m.vx * dt; m.y += m.vy * dt; return m.y < H + 80 && m.x > -300; });
            return this.t < DUR || this.list.length > 0;
        },
        draw(c) {
            const env = Math.min(1, this.t / 0.6, Math.max(0, (DUR + 0.6 - this.t) / 0.8));
            c.save();
            for (const s of stars) {
                c.globalAlpha = env * (0.35 + 0.65 * Math.abs(Math.sin(this.t * 2 + s.ph)));
                c.fillStyle = "#fff"; c.beginPath(); c.arc(s.x, s.y, s.r, 0, 6.283); c.fill();
            }
            c.globalAlpha = 1; c.globalCompositeOperation = "lighter"; c.lineCap = "round";
            for (const m of this.list) {
                const d = Math.hypot(m.vx, m.vy), tx = m.x - (m.vx / d) * m.len, ty = m.y - (m.vy / d) * m.len;
                const g = c.createLinearGradient(m.x, m.y, tx, ty);
                g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.25, "rgba(190,170,255,.65)"); g.addColorStop(1, "rgba(120,90,255,0)");
                c.strokeStyle = g; c.lineWidth = m.w; c.beginPath(); c.moveTo(m.x, m.y); c.lineTo(tx, ty); c.stroke();
                c.fillStyle = "rgba(255,255,255,.95)"; c.shadowColor = "#cbb8ff"; c.shadowBlur = 14;
                c.beginPath(); c.arc(m.x, m.y, m.w * 1.1, 0, 6.283); c.fill(); c.shadowBlur = 0;
            }
            c.restore();
        },
        end() { if (![...active].some(e => e.night)) layer?.classList.remove("night", "dim"); },
        night: true
    };
}

/* ---------- Trái tim bay ---------- */
function heartPath(c, s) {
    c.beginPath(); c.moveTo(0, s * 0.4);
    c.bezierCurveTo(-s * 0.9, -s * 0.1, -s * 0.5, -s * 0.8, 0, -s * 0.3);
    c.bezierCurveTo(s * 0.5, -s * 0.8, s * 0.9, -s * 0.1, 0, s * 0.4); c.closePath();
}
function hearts() {
    const k = Math.min(W, H) / 800 + 0.5, colors = ["#ff4d8d", "#ff7aa8", "#ff2e63", "#ffb3cf", "#c9a8ff", "#ff9ec4"];
    return {
        list: [], spawnAt: 0,
        step(dt) {
            this.t += dt;
            if (this.t < 3.6 && this.t >= this.spawnAt) {
                this.spawnAt = this.t + rand(0.04, 0.11);
                this.list.push({ x: rand(0, W), y: H + 40, vy: -rand(130, 280) * k, s: rand(16, 44) * (0.7 + k * 0.3), amp: rand(14, 50), f: rand(1, 2.6), ph: rand(0, 6.28), col: pick(colors), age: 0, rot: rand(-0.4, 0.4) });
            }
            this.list = this.list.filter(h => { h.age += dt; h.y += h.vy * dt; return h.y > -60; });
            return this.t < 3.6 || this.list.length > 0;
        },
        draw(c) {
            c.save();
            for (const h of this.list) {
                const pop = Math.min(1, h.age / 0.3), fade = Math.min(1, Math.max(0, (h.y + 60) / (H * 0.25)));
                c.globalAlpha = 0.92 * fade; c.fillStyle = h.col; c.shadowColor = h.col; c.shadowBlur = 10;
                c.save(); c.translate(h.x + Math.sin(h.age * h.f + h.ph) * h.amp, h.y); c.rotate(h.rot + Math.sin(h.age * h.f + h.ph) * 0.2);
                c.scale(pop, pop); heartPath(c, h.s); c.fill(); c.restore();
            }
            c.restore();
        }
    };
}

/* ---------- Mưa biểu tượng cảm xúc ---------- */
function emojiRain(emojis, o = {}) {
    const speed = o.speed || 220, total = o.count || 42, spawnTime = o.spawn || 2.2, k = Math.min(W, H) / 800 + 0.5;
    const confCols = ["#ff5c8a", "#ffd166", "#6bcB77", "#4d96ff", "#b388ff"];
    return {
        kind: "text", list: [], spawned: 0,
        step(dt) {
            this.t += dt;
            const due = Math.min(total, Math.floor((this.t / spawnTime) * total));
            while (this.spawned < due) {
                this.spawned++;
                const conf = o.confetti && Math.random() < 0.35;
                this.list.push({ conf, e: pick(emojis), x: rand(0, W), y: -50, vy: speed * rand(0.7, 1.3) * k, s: conf ? rand(6, 11) : rand(24, 46), amp: rand(10, 40), f: rand(1, 2.4), ph: rand(0, 6.28), rot: rand(-0.5, 0.5), spin: rand(-2, 2), col: pick(confCols), age: 0 });
            }
            this.list = this.list.filter(p => { p.age += dt; p.y += p.vy * dt; return p.y < H + 70; });
            return this.spawned < total || this.list.length > 0;
        },
        draw(c) {
            c.save(); c.textAlign = "center"; c.textBaseline = "middle";
            for (const p of this.list) {
                const x = p.x + Math.sin(p.age * p.f + p.ph) * p.amp;
                c.save(); c.translate(x, p.y); c.rotate(p.rot + p.age * p.spin * (p.conf ? 1 : 0.25));
                if (p.conf) { c.fillStyle = p.col; c.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
                else { c.font = `${p.s}px ${EMOJI_FONT}`; c.fillText(p.e, 0, 0); }
                c.restore();
            }
            c.restore();
        }
    };
}

/* ---------- API công khai ---------- */
export function playGift(kind) {
    if (!Object.hasOwn(GIFTS, kind) || reduceMotion()) return false; // người dùng tắt chuyển động: chỉ hiện biểu ngữ
    ensureLayer(); show(); resize();
    const make = { fireworks, meteors, hearts }[kind];
    const ok = start(make());
    if (!ok) hideIfIdle();
    return ok;
}

// Quy tắc từ khóa. Mẫu có dấu; khi người dùng gõ không dấu ("chuc ngu ngon") vẫn nhận ra.
const RULES = [
    { id: "birthday", words: ["sinh nhật", "happy birthday", "hpbd", "hbd"], emojis: ["🎂", "🎈", "🎉", "🎁", "🥳"], confetti: true, speed: 230 },
    { id: "missyou", words: ["nhớ bạn", "nhớ em", "nhớ anh", "nhớ cậu", "nhớ mọi người", "nhớ quá", "miss you"], emojis: ["💭", "🥺", "💗", "💌", "🫶"], speed: 120, spawn: 2.8 },
    { id: "goodnight", words: ["chúc ngủ ngon", "ngủ ngon", "good night", "goodnight"], emojis: ["🌙", "⭐", "😴", "💤", "✨"], speed: 95, spawn: 3 },
    { id: "love", words: ["yêu bạn", "yêu em", "yêu anh", "thương bạn", "i love you", "love you"], emojis: ["❤️", "💕", "💖", "😍", "💘"], speed: 170 },
    { id: "congrats", words: ["chúc mừng", "congrats", "congratulations"], emojis: ["🎉", "🎊", "👏", "✨", "🥂"], confetti: true, speed: 240 },
    { id: "thanks", words: ["cảm ơn", "cám ơn", "thank you", "thanks"], emojis: ["🙏", "🌸", "💐", "😊", "✨"], speed: 130 }
];
const strip = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d");
const toRegex = w => new RegExp(`(?<![\\p{L}\\p{N}])${w.replace(/ /g, "\\s+")}(?![\\p{L}\\p{N}])`, "u");
RULES.forEach(r => { r.re = r.words.map(toRegex); r.plain = r.words.map(w => toRegex(strip(w))); });

/** Tìm quy tắc hiệu ứng khớp với đoạn chat; trả về null nếu không có. */
export function effectForText(text) {
    if (typeof text !== "string" || !text) return null;
    const lower = text.normalize("NFC").toLowerCase().slice(0, 300);
    const plain = strip(lower), unaccented = plain === lower; // chỉ so khớp không dấu khi cả câu không có dấu
    return RULES.find(r => r.re.some(re => re.test(lower)) || (unaccented && r.plain.some(re => re.test(plain)))) || null;
}

/** Nếu đoạn chat có từ khóa đặc biệt, thả biểu tượng cảm xúc tương ứng. Trả về quy tắc đã khớp hoặc null. */
export function playTextEffect(text) {
    const rule = effectForText(text);
    if (!rule) return null;
    if (reduceMotion()) { showBanner(rule.emojis.slice(0, 4).join(" ")); return rule; }
    if ([...active].some(e => e.kind === "text")) return rule; // không chồng nhiều trận mưa cùng lúc
    ensureLayer(); show(); resize();
    if (!start(emojiRain(rule.emojis, rule))) hideIfIdle();
    return rule;
}
