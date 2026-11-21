/* Connect — Cosmic background
   Nền chuyển động 3D cho toàn bộ trang: vòng hoàng đạo nghiêng xoay trong không gian,
   12 chòm sao + ký hiệu cung, sao trôi theo chiều sâu, tinh vân, hành tinh quỹ đạo, sao băng.
   Canvas nằm dưới mọi nội dung (z-index 0, pointer-events none) nên không làm mờ hay che chữ.
   Không phụ thuộc thư viện ngoài. */
(function () {
  "use strict";
  if (window.__cosmicBg) return;
  window.__cosmicBg = true;

  var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var small = Math.min(window.innerWidth, window.innerHeight) < 700;

  var canvas = document.createElement("canvas");
  canvas.id = "cosmic-bg";
  canvas.setAttribute("aria-hidden", "true");
  var ctx = canvas.getContext("2d");
  if (!ctx) return;

  function mount() { document.body.insertBefore(canvas, document.body.firstChild); }
  if (document.body) mount(); else document.addEventListener("DOMContentLoaded", mount);

  /* 12 cung: ký hiệu, tên, chòm sao đơn giản hoá (toạ độ 0..1) và các cạnh nối */
  var SIGNS = [
    { g: "♈", n: "Bạch Dương", c: "#ff9a8a", p: [[0,.55],[.35,.4],[.62,.3],[.85,.38]], e: [[0,1],[1,2],[2,3]] },
    { g: "♉", n: "Kim Ngưu", c: "#9fe3a8", p: [[0,.2],[.3,.45],[.5,.55],[.75,.4],[1,.15],[.5,.9]], e: [[0,1],[1,2],[2,3],[3,4],[2,5]] },
    { g: "♊", n: "Song Tử", c: "#ffe58a", p: [[.2,0],[.25,.4],[.2,.9],[.75,.05],[.7,.45],[.78,.95]], e: [[0,1],[1,2],[3,4],[4,5],[1,4]] },
    { g: "♋", n: "Cự Giải", c: "#c9d6ff", p: [[.5,.5],[.2,.2],[.8,.25],[.25,.85],[.78,.85]], e: [[0,1],[0,2],[0,3],[0,4]] },
    { g: "♌", n: "Sư Tử", c: "#ffc27a", p: [[.1,.6],[.2,.3],[.4,.15],[.5,.4],[.45,.7],[.8,.55],[.95,.7]], e: [[0,1],[1,2],[2,3],[3,4],[4,0],[3,5],[5,6]] },
    { g: "♍", n: "Xử Nữ", c: "#b6f0d0", p: [[0,.3],[.25,.2],[.45,.45],[.65,.3],[.9,.4],[.5,.8],[.3,.95]], e: [[0,1],[1,2],[2,3],[3,4],[2,5],[5,6]] },
    { g: "♎", n: "Thiên Bình", c: "#f5b6e6", p: [[.1,.8],[.5,.75],[.9,.8],[.3,.45],[.7,.45],[.5,.15]], e: [[0,1],[1,2],[0,3],[2,4],[3,5],[4,5]] },
    { g: "♏", n: "Bọ Cạp", c: "#ff8fa6", p: [[0,.2],[.2,.35],[.4,.5],[.55,.7],[.75,.85],[.95,.7],[1,.45]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,6]] },
    { g: "♐", n: "Nhân Mã", c: "#ffb3e0", p: [[.1,.9],[.35,.6],[.55,.4],[.8,.15],[.5,.8],[.8,.7]], e: [[0,1],[1,2],[2,3],[2,4],[2,5]] },
    { g: "♑", n: "Ma Kết", c: "#aab8ff", p: [[0,.2],[.4,.1],[.75,.3],[.95,.7],[.6,.9],[.3,.6]], e: [[0,1],[1,2],[2,3],[3,4],[4,5],[5,0]] },
    { g: "♒", n: "Bảo Bình", c: "#8fe8ff", p: [[0,.3],[.25,.5],[.5,.3],[.75,.5],[1,.3],[.15,.85],[.6,.85]], e: [[0,1],[1,2],[2,3],[3,4],[1,5],[3,6]] },
    { g: "♓", n: "Song Ngư", c: "#c2a8ff", p: [[0,.2],[.2,.5],[.5,.55],[.8,.5],[1,.8],[.1,.9]], e: [[0,1],[1,2],[2,3],[3,4],[1,5]] }
  ];

  var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0;
  var mouseX = 0, mouseY = 0, tmx = 0, tmy = 0, scrollY = 0;
  var stars = [], shooters = [], nebulas = [];
  var lastShoot = 0;

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, small ? 1.25 : 1.6);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W * (W > 900 ? .62 : .5);
    cy = H * (W > 900 ? .50 : .42);
    R = Math.min(W, H) * (W > 900 ? .62 : .78);
    small = Math.min(W, H) < 700;
    initStars();
    initNebulas();
  }

  function initStars() {
    var n = small ? 110 : 230;
    stars = [];
    for (var i = 0; i < n; i++) {
      stars.push({
        x: rand(-1, 1), y: rand(-1, 1), z: rand(.05, 1),
        t: rand(0, 6.28), hue: Math.random() < .25 ? 195 : Math.random() < .3 ? 275 : 45
      });
    }
  }

  function initNebulas() {
    var cols = [[120, 80, 230], [40, 170, 220], [200, 80, 190], [90, 110, 240]];
    nebulas = cols.map(function (c, i) {
      return { x: rand(.1, .9), y: rand(.1, .9), r: rand(.3, .5), c: c, ph: rand(0, 6.28), sp: rand(.05, .1), i: i };
    });
  }

  /* Phép chiếu phối cảnh: xoay quanh Y (theo thời gian + chuột + cuộn), nghiêng quanh X */
  var rotY = 0, tilt = 1.12;
  function project(x, y, z) {
    var cosY = Math.cos(rotY), sinY = Math.sin(rotY);
    var x1 = x * cosY + z * sinY, z1 = -x * sinY + z * cosY;
    var cosT = Math.cos(tilt + tmy * .12), sinT = Math.sin(tilt + tmy * .12);
    var y1 = y * cosT - z1 * sinT, z2 = y * sinT + z1 * cosT;
    var f = 2.6, s = f / (f + z2 * .9);
    return { x: cx + x1 * R * s * .5 + tmx * 14, y: cy + y1 * R * s * .5 + tmy * 10, s: s, z: z2 };
  }

  function drawNebulas(t) {
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < nebulas.length; i++) {
      var n = nebulas[i];
      var px = (n.x + Math.sin(t * n.sp + n.ph) * .06) * W - tmx * 20 * (i + 1) * .3;
      var py = (n.y + Math.cos(t * n.sp * .8 + n.ph) * .06) * H;
      var r = n.r * Math.max(W, H);
      var g = ctx.createRadialGradient(px, py, 0, px, py, r);
      g.addColorStop(0, "rgba(" + n.c.join(",") + ",.16)");
      g.addColorStop(.5, "rgba(" + n.c.join(",") + ",.06)");
      g.addColorStop(1, "rgba(" + n.c.join(",") + ",0)");
      ctx.fillStyle = g; ctx.fillRect(px - r, py - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }

  function drawStars(t, dt) {
    var k = Math.max(W, H) * .55;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.z -= dt * .018;
      if (s.z <= .04) { s.z = 1; s.x = rand(-1, 1); s.y = rand(-1, 1); }
      var px = cx * .0 + W / 2 + (s.x / s.z) * k * .28 + tmx * 26 * (1 - s.z);
      var py = H / 2 + (s.y / s.z) * k * .28 + tmy * 18 * (1 - s.z) - scrollY * .05 * (1 - s.z);
      if (px < -5 || px > W + 5 || py < -5 || py > H + 5) continue;
      var size = (1 - s.z) * 2.1 + .5;
      var tw = .65 + .35 * Math.sin(t * 2 + s.t);
      ctx.globalAlpha = Math.min(1, (1 - s.z) * 1.2 + .15) * tw;
      ctx.fillStyle = "hsl(" + s.hue + ",80%,88%)";
      ctx.beginPath(); ctx.arc(px, py, size, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawRing(radius, y, alpha, width, dash) {
    ctx.beginPath();
    var steps = 96;
    for (var i = 0; i <= steps; i++) {
      var a = i / steps * 6.2832;
      var p = project(Math.cos(a) * radius, y, Math.sin(a) * radius);
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = "rgba(190,210,255," + alpha + ")";
    ctx.lineWidth = width;
    ctx.setLineDash(dash || []);
    ctx.stroke(); ctx.setLineDash([]);
  }

  function drawZodiac(t) {
    var ringR = 1.0;
    /* vòng hoàng đạo: 3 vòng đồng tâm + vạch chia 12 cung */
    drawRing(ringR * 1.18, 0, .22, 1.2);
    drawRing(ringR * .86, 0, .16, 1, [3, 7]);
    drawRing(ringR * 1.34, 0, .10, 1, [1, 9]);
    ctx.beginPath();
    for (var i = 0; i < 12; i++) {
      var a = i * Math.PI / 6 - Math.PI / 12;
      var p1 = project(Math.cos(a) * ringR * .86, 0, Math.sin(a) * ringR * .86);
      var p2 = project(Math.cos(a) * ringR * 1.18, 0, Math.sin(a) * ringR * 1.18);
      ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
    }
    ctx.strokeStyle = "rgba(190,210,255,.16)"; ctx.lineWidth = 1; ctx.stroke();

    /* mỗi cung: chòm sao nằm trong mặt phẳng tiếp tuyến của vòng + ký hiệu */
    var items = [];
    for (var k = 0; k < 12; k++) {
      var sg = SIGNS[k];
      var ang = k * Math.PI / 6;
      var ox = Math.cos(ang) * ringR, oz = Math.sin(ang) * ringR;
      var tx = -Math.sin(ang), tz = Math.cos(ang);        /* tiếp tuyến */
      var sc = .30;
      var pts = sg.p.map(function (q, qi) {
        var u = (q[0] - .5) * sc, v = (q[1] - .5) * sc;
        var bob = Math.sin(t * .8 + k + qi) * .006;
        return project(ox + tx * u, -v + bob, oz + tz * u);
      });
      var centre = project(ox, 0, oz);
      var glyph = project(ox * 1.5, -.02, oz * 1.5);
      items.push({ sg: sg, pts: pts, centre: centre, glyph: glyph, z: centre.z });
    }
    items.sort(function (a, b) { return b.z - a.z; });  /* xa vẽ trước */

    for (var m = 0; m < items.length; m++) {
      var it = items[m];
      var depth = Math.max(.25, Math.min(1, .62 - it.z * .38));  /* gần = sáng hơn */
      var col = it.sg.c;
      ctx.globalAlpha = depth * .85;
      ctx.strokeStyle = col; ctx.lineWidth = 1.1;
      ctx.beginPath();
      for (var e = 0; e < it.sg.e.length; e++) {
        var a2 = it.pts[it.sg.e[e][0]], b2 = it.pts[it.sg.e[e][1]];
        ctx.moveTo(a2.x, a2.y); ctx.lineTo(b2.x, b2.y);
      }
      ctx.stroke();
      ctx.shadowColor = col; ctx.shadowBlur = 8;
      ctx.fillStyle = "#fff";
      for (var q = 0; q < it.pts.length; q++) {
        var tw = .7 + .3 * Math.sin(t * 2.2 + q * 1.7 + m);
        ctx.globalAlpha = depth * tw;
        ctx.beginPath(); ctx.arc(it.pts[q].x, it.pts[q].y, 1.5 + it.pts[q].s * 1.1, 0, 6.2832); ctx.fill();
      }
      ctx.shadowBlur = 0;
      /* ký hiệu cung */
      var fs = Math.round(20 + it.glyph.s * 18);
      ctx.globalAlpha = depth;
      ctx.font = fs + "px 'Segoe UI Symbol','Noto Sans Symbols 2','Apple Symbols',serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.shadowColor = col; ctx.shadowBlur = 14;
      ctx.fillStyle = col;
      ctx.fillText(it.sg.g + "\uFE0E", it.glyph.x, it.glyph.y);
      ctx.shadowBlur = 0;
      if (it.z < .15) {
        ctx.font = "600 " + Math.round(10 + it.glyph.s * 3) + "px 'DM Sans',sans-serif";
        ctx.fillStyle = "rgba(225,232,250,.9)";
        ctx.fillText(it.sg.n, it.glyph.x, it.glyph.y + fs * .85);
      }
    }
    ctx.globalAlpha = 1;
  }

  function drawPlanets(t) {
    var defs = [
      { r: .55, sp: .34, size: 7, c1: "#9be8ff", c2: "#2a6fd6", y: .02 },
      { r: .72, sp: -.22, size: 10, c1: "#ffd48a", c2: "#c4682c", y: -.03, ring: true },
      { r: 1.62, sp: .12, size: 13, c1: "#e0b3ff", c2: "#6a3fc4", y: .04 }
    ];
    for (var i = 0; i < defs.length; i++) {
      var d = defs[i];
      drawRing(d.r, d.y, .10, 1, [2, 8]);
      var a = t * d.sp + i * 2.1;
      var p = project(Math.cos(a) * d.r, d.y, Math.sin(a) * d.r);
      var rad = d.size * p.s * (small ? .8 : 1);
      var g = ctx.createRadialGradient(p.x - rad * .35, p.y - rad * .35, rad * .1, p.x, p.y, rad);
      g.addColorStop(0, d.c1); g.addColorStop(1, d.c2);
      ctx.shadowColor = d.c1; ctx.shadowBlur = 16;
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, rad, 0, 6.2832); ctx.fill();
      ctx.shadowBlur = 0;
      if (d.ring) {
        ctx.strokeStyle = "rgba(255,225,170,.7)"; ctx.lineWidth = 1.4;
        ctx.beginPath(); ctx.ellipse(p.x, p.y, rad * 1.9, rad * .55, -.35, 0, 6.2832); ctx.stroke();
      }
    }
    /* lõi sáng ở tâm vòng */
    var c = project(0, 0, 0);
    var core = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R * .16);
    core.addColorStop(0, "rgba(255,230,170,.55)"); core.addColorStop(.4, "rgba(180,140,255,.22)"); core.addColorStop(1, "rgba(120,100,255,0)");
    ctx.fillStyle = core; ctx.fillRect(c.x - R * .16, c.y - R * .16, R * .32, R * .32);
  }

  function drawShooters(t, dt) {
    if (!reduced && t - lastShoot > rand(5, 9)) {
      lastShoot = t;
      shooters.push({ x: rand(.1, 1) * W, y: rand(0, .4) * H, vx: -rand(380, 560), vy: rand(150, 260), life: 1 });
    }
    for (var i = shooters.length - 1; i >= 0; i--) {
      var s = shooters[i];
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt * 1.1;
      if (s.life <= 0) { shooters.splice(i, 1); continue; }
      var g = ctx.createLinearGradient(s.x, s.y, s.x - s.vx * .12, s.y - s.vy * .12);
      g.addColorStop(0, "rgba(255,255,255," + s.life + ")"); g.addColorStop(1, "rgba(150,200,255,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * .12, s.y - s.vy * .12); ctx.stroke();
    }
  }

  var last = 0, running = true, tAcc = 0;
  function frame(now) {
    if (!running) return;
    var dt = Math.min((now - last) / 1000 || 0, .05); last = now;
    tAcc += dt;
    tmx += (mouseX - tmx) * .05; tmy += (mouseY - tmy) * .05;
    rotY = tAcc * .07 + tmx * .25 + scrollY * .0006;
    ctx.clearRect(0, 0, W, H);
    drawNebulas(tAcc);
    drawStars(tAcc, dt);
    drawZodiac(tAcc);
    drawPlanets(tAcc);
    drawShooters(tAcc, dt);
    if (!reduced) requestAnimationFrame(frame);
  }

  function start() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(frame); } }

  window.addEventListener("resize", function () { resize(); if (reduced) { running = true; frame(performance.now()); } }, { passive: true });
  window.addEventListener("scroll", function () { scrollY = window.scrollY || 0; }, { passive: true });
  window.addEventListener("pointermove", function (e) {
    mouseX = (e.clientX / W - .5) * 2; mouseY = (e.clientY / H - .5) * 2;
  }, { passive: true });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) running = false; else if (!reduced) start();
  });

  resize();
  last = performance.now();
  requestAnimationFrame(frame);
})();
