// Connect Planet: lớp WebGL 3D độc lập; Canvas 2D hiện tại vẫn là fallback.
const wrap = document.getElementById('planet3dWrap');
const canvas = document.getElementById('planetThreeCanvas');
if (wrap && canvas) {
  let renderer, frame = 0, observer, disposed = false;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Tạo bản đồ hành tinh ngay trong trình duyệt, không cần tải ảnh ngoài.
  function makePlanetTexture(THREE) {
    const mapCanvas = document.createElement('canvas');
    mapCanvas.width = 2048;
    mapCanvas.height = 1024;
    const ctx = mapCanvas.getContext('2d');
    const ocean = ctx.createLinearGradient(0, 0, 0, 1024);
    ocean.addColorStop(0, '#10275e');
    ocean.addColorStop(.48, '#1768a8');
    ocean.addColorStop(1, '#101b55');
    ctx.fillStyle = ocean;
    ctx.fillRect(0, 0, 2048, 1024);

    // Vân đại dương và các đường sáng mảnh.
    for (let i = 0; i < 90; i++) {
      const y = (i / 90) * 1024;
      ctx.strokeStyle = `rgba(91,210,255,${.025 + (i % 4) * .009})`;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(520, y - 32, 1420, y + 36, 2048, y - 12);
      ctx.stroke();
    }

    // Các mảng lục địa giả lập có viền phát sáng.
    let seed = 92741;
    const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    const continents = [
      [300, 330, 190, 135], [700, 650, 250, 155], [1040, 300, 270, 180],
      [1450, 610, 300, 175], [1780, 260, 180, 125], [80, 760, 130, 100]
    ];
    continents.forEach(([cx, cy, rx, ry], index) => {
      const points = 28;
      ctx.beginPath();
      for (let i = 0; i <= points; i++) {
        const angle = (i / points) * Math.PI * 2;
        const wobble = .78 + random() * .42;
        const x = cx + Math.cos(angle) * rx * wobble;
        const y = cy + Math.sin(angle) * ry * wobble;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.closePath();
      const land = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy + ry);
      land.addColorStop(0, '#35c7bd');
      land.addColorStop(.55, index % 2 ? '#4c9f9d' : '#54b7a2');
      land.addColorStop(1, '#286d91');
      ctx.shadowColor = '#4beaff';
      ctx.shadowBlur = 24;
      ctx.fillStyle = land;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(117,246,255,.72)';
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.save();
      ctx.clip();
      for (let j = 0; j < 22; j++) {
        const px = cx - rx + random() * rx * 2;
        const py = cy - ry + random() * ry * 2;
        ctx.fillStyle = 'rgba(197,255,224,.12)';
        ctx.beginPath();
        ctx.arc(px, py, 4 + random() * 18, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    });

    // Mây mỏng để bề mặt có thêm chiều sâu.
    for (let i = 0; i < 150; i++) {
      const x = random() * 2048;
      const y = random() * 1024;
      ctx.strokeStyle = `rgba(180,239,255,${.035 + random() * .07})`;
      ctx.lineWidth = 2 + random() * 8;
      ctx.beginPath();
      ctx.ellipse(x, y, 16 + random() * 70, 3 + random() * 10, random() * .4, 0, Math.PI * 2);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(mapCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    return texture;
  }

  try {
    let THREE;
    try {
      THREE = await import('https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js');
    } catch (primaryError) {
      console.warn('jsDelivr không tải được Three.js, thử CDN dự phòng:', primaryError);
      THREE = await import('https://unpkg.com/three@0.180.0/build/three.module.js');
    }
    if (!('WebGLRenderingContext' in window)) throw new Error('WebGL không được hỗ trợ');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    camera.position.set(0, 0, 5.6);
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const planet = new THREE.Group();
    scene.add(planet);
    const surfaceTexture = makePlanetTexture(THREE);
    const globe = new THREE.Mesh(
      new THREE.SphereGeometry(1.32, 96, 72),
      new THREE.MeshStandardMaterial({ map: surfaceTexture, roughness: .78, metalness: .08 })
    );
    planet.add(globe);

    const wire = new THREE.Mesh(
      new THREE.SphereGeometry(1.337, 36, 24),
      new THREE.MeshBasicMaterial({ color: 0x8beaff, wireframe: true, transparent: true, opacity: .13 })
    );
    planet.add(wire);

    const cloud = new THREE.Mesh(
      new THREE.SphereGeometry(1.355, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x9ceeff, transparent: true, opacity: .075, wireframe: true })
    );
    planet.add(cloud);

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(1.405, 64, 48),
      new THREE.MeshBasicMaterial({ color: 0x39aaff, transparent: true, opacity: .13, side: THREE.BackSide })
    );
    planet.add(atmosphere);

    scene.add(new THREE.AmbientLight(0x9db8ff, 1.15));
    const keyLight = new THREE.DirectionalLight(0xb9f4ff, 2.4);
    keyLight.position.set(-3, 4, 5);
    scene.add(keyLight);
    const violetLight = new THREE.PointLight(0x873dff, 18, 8);
    violetLight.position.set(3, -1, -2);
    scene.add(violetLight);

    const orbitGroup = new THREE.Group();
    scene.add(orbitGroup);
    [0, 1, 2].forEach((i) => {
      const orbit = new THREE.Mesh(
        new THREE.TorusGeometry(1.72 + i * .13, .006, 8, 180),
        new THREE.MeshBasicMaterial({ color: i === 1 ? 0x55dfff : 0x9c69ff, transparent: true, opacity: .38 - i * .06 })
      );
      orbit.rotation.x = Math.PI / 2.65 + i * .19;
      orbit.rotation.y = i * .58;
      orbitGroup.add(orbit);
    });

    const starGeometry = new THREE.BufferGeometry();
    const starPositions = new Float32Array(520 * 3);
    for (let i = 0; i < 520; i++) {
      const radius = 3.2 + Math.random() * 5.5;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      starPositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      starPositions[i * 3 + 1] = radius * Math.cos(phi);
      starPositions[i * 3 + 2] = radius * Math.sin(phi) * Math.sin(theta);
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(starPositions, 3));
    const stars = new THREE.Points(starGeometry, new THREE.PointsMaterial({ color: 0xd8e8ff, size: .024, transparent: true, opacity: .85, sizeAttenuation: true }));
    scene.add(stars);

    function resize() {
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(320, Math.min(520, width * .72));
      renderer.setSize(width, height, false);
      canvas.style.width = '100%';
      canvas.style.height = `${height}px`;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    }
    observer = new ResizeObserver(resize);
    observer.observe(wrap);
    resize();

    const clock = new THREE.Clock();
    function render() {
      if (disposed || document.hidden) return;
      const delta = Math.min(clock.getDelta(), .05);
      if (!reducedMotion) {
        if (autoRotate && !pointer) rotationY += delta * .075;
        planet.rotation.y = rotationY;
        planet.rotation.x = rotationX + (autoRotate ? Math.sin(clock.elapsedTime * .12) * .035 : 0);
        cloud.rotation.y += delta * .009;
        orbitGroup.rotation.z += delta * .025;
        stars.rotation.y -= delta * .006;
      }
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    }
    wrap.classList.add('has-webgl');
    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'none';
    const legacyCanvas = document.getElementById('connectPlanetCanvas');
    if (legacyCanvas) legacyCanvas.style.pointerEvents = 'none';

    // Kéo để xoay trực tiếp mô hình WebGL; cuộn để phóng to/thu nhỏ.
    let pointer = null;
    let rotationX = 0;
    let rotationY = 0;
    let targetZoom = 1;
    let autoRotate = !reducedMotion;
    const syncLegacyLayer = () => wrap.dispatchEvent(new CustomEvent('connect:planet-transform', {
      detail: { rotationX, rotationY, zoom: targetZoom }
    }));
    canvas.addEventListener('pointerdown', event => {
      pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
      canvas.setPointerCapture(event.pointerId);
      autoRotate = false;
      wrap.dispatchEvent(new CustomEvent('connect:planet-auto-rotate', { detail: { enabled: false } }));
    });
    canvas.addEventListener('pointermove', event => {
      if (!pointer || pointer.id !== event.pointerId) return;
      const dx = event.clientX - pointer.x;
      const dy = event.clientY - pointer.y;
      pointer.x = event.clientX;
      pointer.y = event.clientY;
      rotationY += dx * 0.008;
      rotationX = Math.max(-1.05, Math.min(1.05, rotationX + dy * 0.008));
      syncLegacyLayer();
    });
    const endPointer = event => {
      if (pointer && pointer.id === event.pointerId) pointer = null;
    };
    canvas.addEventListener('pointerup', endPointer);
    canvas.addEventListener('pointercancel', endPointer);
    canvas.addEventListener('wheel', event => {
      event.preventDefault();
      targetZoom = Math.max(0.78, Math.min(1.5, targetZoom + (event.deltaY < 0 ? 0.07 : -0.07)));
      camera.position.z = 5.6 / targetZoom;
      syncLegacyLayer();
    }, { passive: false });
    wrap.addEventListener('connect:planet-zoom', event => {
      targetZoom = Math.max(0.78, Math.min(1.5, targetZoom + (event.detail?.direction === 'in' ? 0.12 : -0.12)));
      camera.position.z = 5.6 / targetZoom;
      syncLegacyLayer();
    });
    wrap.addEventListener('connect:planet-reset', () => {
      rotationX = 0;
      rotationY = 0;
      targetZoom = 1;
      camera.position.z = 5.6;
      autoRotate = true;
      syncLegacyLayer();
    });
    wrap.addEventListener('connect:planet-auto-rotate', event => {
      autoRotate = Boolean(event.detail?.enabled);
    });
    render();
    const onVisibility = () => {
      if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
      else if (!frame && !disposed) render();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer?.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      renderer?.dispose();
      surfaceTexture.dispose();
      starGeometry.dispose();
    }, { once: true });
  } catch (error) {
    console.warn('Connect Planet WebGL unavailable; using Canvas fallback:', error);
    canvas.hidden = true;
  }
}
