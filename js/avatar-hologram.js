import { createAvatarSvg, defaultAvatar, sanitizeAvatar } from "./avatar-data.js";

/** Render an existing Connect avatar as an interactive, continuously rotating hologram. */
export function renderAvatarHologram(host, avatarData, label = "Avatar Connect") {
  if (!host) return () => {};
  host.replaceChildren();

  const scene = document.createElement("div");
  scene.className = "avatar-holo-scene";
  scene.setAttribute("aria-label", `Mô hình hologram 3D của ${label}`);
  scene.setAttribute("role", "group");

  const stars = document.createElement("div");
  stars.className = "avatar-holo-stars";
  stars.setAttribute("aria-hidden", "true");
  for (let i = 0; i < 24; i += 1) {
    const star = document.createElement("i");
    star.style.left = `${5 + ((i * 29) % 90)}%`;
    star.style.top = `${5 + ((i * 43) % 86)}%`;
    star.style.animationDuration = `${1.7 + (i % 8) * 0.22}s`;
    star.style.animationDelay = `${-i * 0.17}s`;
    stars.append(star);
  }

  const lightBeam = document.createElement("div");
  lightBeam.className = "avatar-holo-light-beam";
  lightBeam.setAttribute("aria-hidden", "true");

  const orbit = document.createElement("div");
  orbit.className = "avatar-holo-orbit avatar-holo-orbit--outer";
  orbit.setAttribute("aria-hidden", "true");
  const orbitInner = document.createElement("div");
  orbitInner.className = "avatar-holo-orbit avatar-holo-orbit--inner";
  orbitInner.setAttribute("aria-hidden", "true");

  const avatarFrame = document.createElement("div");
  avatarFrame.className = "avatar-holo-character";
  const rotator = document.createElement("div");
  rotator.className = "avatar-holo-rotator";
  rotator.append(createAvatarSvg(avatarData || defaultAvatar, `Avatar của ${label}`));
  avatarFrame.append(rotator);

  const platform = document.createElement("div");
  platform.className = "avatar-holo-platform";
  platform.setAttribute("aria-hidden", "true");
  const platformCore = document.createElement("span");
  platformCore.className = "avatar-holo-platform-core";
  platform.append(platformCore);

  const identity = document.createElement("div");
  identity.className = "avatar-holo-identity";
  const title = document.createElement("strong");
  title.textContent = "CONNECT AVATAR";
  const subtitle = document.createElement("span");
  subtitle.textContent = "360° HOLOGRAM · LIVE LIGHTING";
  identity.append(title, subtitle);

  const controls = document.createElement("div");
  controls.className = "avatar-holo-controls";
  const motionButton = document.createElement("button");
  motionButton.type = "button";
  motionButton.className = "avatar-holo-motion-toggle";
  motionButton.textContent = "Ⅱ Tạm dừng";
  motionButton.setAttribute("aria-pressed", "false");
  motionButton.addEventListener("click", () => {
    const paused = scene.classList.toggle("is-paused");
    motionButton.setAttribute("aria-pressed", String(paused));
    motionButton.textContent = paused ? "▶ Tiếp tục" : "Ⅱ Tạm dừng";
  });

  const lightButton = document.createElement("button");
  lightButton.type = "button";
  lightButton.className = "avatar-holo-light-toggle";
  lightButton.textContent = "✦ Tắt ánh sáng";
  lightButton.setAttribute("aria-pressed", "true");
  lightButton.addEventListener("click", () => {
    const lightingOff = scene.classList.toggle("is-lighting-off");
    lightButton.setAttribute("aria-pressed", String(!lightingOff));
    lightButton.textContent = lightingOff ? "✧ Bật ánh sáng" : "✦ Tắt ánh sáng";
  });
  controls.append(motionButton, lightButton);

  scene.append(stars, lightBeam, orbit, orbitInner, avatarFrame, platform, identity, controls);
  host.append(scene);

  const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  if (reduceMotion) {
    scene.classList.add("is-paused");
    motionButton.setAttribute("aria-pressed", "true");
    motionButton.textContent = "▶ Bật hiệu ứng";
  }

  let pointerActive = false;
  scene.addEventListener("pointermove", event => {
    if (reduceMotion || event.pointerType === "touch") return;
    const rect = scene.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    scene.style.setProperty("--holo-rotate-y", `${x * 13}deg`);
    scene.style.setProperty("--holo-rotate-x", `${-y * 10}deg`);
    scene.style.setProperty("--holo-light-x", `${50 + x * 45}%`);
    scene.style.setProperty("--holo-light-y", `${40 + y * 45}%`);
    pointerActive = true;
  });
  scene.addEventListener("pointerleave", () => {
    if (!pointerActive) return;
    scene.style.setProperty("--holo-rotate-y", "0deg");
    scene.style.setProperty("--holo-rotate-x", "0deg");
    scene.style.setProperty("--holo-light-x", "50%");
    scene.style.setProperty("--holo-light-y", "40%");
    pointerActive = false;
  });

  // Keep the hologram instance mounted; only replace its SVG when the user edits the avatar.
  return nextAvatarData => {
    rotator.replaceChildren(createAvatarSvg(sanitizeAvatar(nextAvatarData), `Avatar của ${label}`));
  };
}
