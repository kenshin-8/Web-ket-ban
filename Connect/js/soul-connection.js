import { supabase } from "./supabase.js";
import { compat, PLANETS } from "./soul.js";

let currentUserId = null, currentProfile = null, realtimeChannel = null;
const notified = new Set();
const norm = value => String(value || "").trim().toLocaleLowerCase("vi-VN");
export const sharedInterests = (a, b) => {
  const right = new Set((b || []).map(norm));
  return [...new Map((a || []).filter(x => right.has(norm(x))).map(x => [norm(x), String(x).trim()])).values()];
};

function ensureToast() {
  let dialog = document.getElementById("soulConnectionDialog");
  if (dialog) return dialog;
  dialog = document.createElement("dialog"); dialog.id = "soulConnectionDialog"; dialog.className = "soul-connection-dialog";
  dialog.innerHTML = `<button class="soul-connection-close" type="button" aria-label="Đóng">×</button><div class="soul-connection-stars" aria-hidden="true">✦　♡　✦</div><p class="eyebrow">SOUL CONNECTION</p><h2>Hai tinh cầu đã tìm thấy nhau!</h2><p class="soul-connection-score"></p><p class="soul-connection-planets"></p><div class="soul-connection-tags"></div><p class="soul-connection-footnote">Cả hai đã thích nhau. Hãy bắt đầu một cuộc trò chuyện nhé.</p><a class="btn soul-connection-chat" href="discover.html">Khám phá kết nối</a>`;
  document.body.appendChild(dialog);
  dialog.querySelector(".soul-connection-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", e => { if (e.target === dialog) dialog.close(); });
  return dialog;
}
function showConnection(other, score, common) {
  if (!other?.id || notified.has(other.id)) return;
  notified.add(other.id);
  const dialog = ensureToast(), scoreNode = dialog.querySelector(".soul-connection-score");
  scoreNode.textContent = `✧ Độ tương hợp tâm hồn ${score}% ✧`;
  const mine = PLANETS[currentProfile?.planet], theirs = PLANETS[other.planet];
  dialog.querySelector(".soul-connection-planets").textContent = `${mine ? mine.icon + " " + mine.name : "Tinh cầu của bạn"}  ↔  ${theirs ? theirs.icon + " " + theirs.name : "Tinh cầu bạn ấy"}`;
  const tags = dialog.querySelector(".soul-connection-tags"); tags.replaceChildren();
  common.slice(0, 6).forEach(tag => { const span = document.createElement("span"); span.className = "interest-tag shared"; span.textContent = tag; tags.appendChild(span); });
  dialog.querySelector(".soul-connection-chat").href = `discover.html?connection=${encodeURIComponent(other.id)}`;
  if (!dialog.open) dialog.showModal();
  document.querySelectorAll(`[data-member-id="${CSS.escape(other.id)}"]`).forEach(card => card.classList.add("soul-connected"));
}
async function findMutual(otherId) {
  const { data: reciprocal, error } = await supabase.from("soul_likes").select("from_user_id")
    .eq("from_user_id", otherId).eq("to_user_id", currentUserId).maybeSingle();
  if (error || !reciprocal) return false;
  const { data: other } = await supabase.from("profiles")
    .select("id,display_name,planet,soul_scores,interests").eq("id", otherId).maybeSingle();
  if (!other) return false;
  const score = currentProfile ? compat(currentProfile, other) : 0;
  showConnection(other, score, sharedInterests(currentProfile?.interests, other.interests));
  return true;
}
export function initSoulConnections(userId, profile) {
  currentUserId = userId; currentProfile = profile;
  if (realtimeChannel) supabase.removeChannel(realtimeChannel);
  realtimeChannel = supabase.channel(`soul-likes-${userId}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "soul_likes", filter: `to_user_id=eq.${userId}` }, payload => {
      const fromId = payload.new?.from_user_id;
      if (fromId) findMutual(fromId);
    }).subscribe();
}
export function createSoulLikeButton(targetId, score, common, parent) {
  if (!currentUserId || !targetId || targetId === currentUserId) return null;
  const button = document.createElement("button");
  button.type = "button"; button.className = "soul-like-button"; button.textContent = "♡ Thích hồ sơ";
  button.setAttribute("aria-label", "Thích hồ sơ thành viên này");
  const card = parent?.closest(".member-card") || parent;
  if (card) card.dataset.memberId = targetId;
  (async () => {
    const { data } = await supabase.from("soul_likes").select("to_user_id").eq("from_user_id", currentUserId).eq("to_user_id", targetId).maybeSingle();
    if (data) { button.classList.add("is-liked"); button.textContent = "♥ Đã thích"; }
    if (data) await findMutual(targetId);
  })();
  button.addEventListener("click", async () => {
    if (button.disabled) return;
    button.disabled = true;
    const { data: existing, error: readError } = await supabase.from("soul_likes").select("to_user_id").eq("from_user_id", currentUserId).eq("to_user_id", targetId).maybeSingle();
    if (readError) { button.title = "Không tải được trạng thái thích. Hãy chạy SQL cập nhật trong Supabase."; button.disabled = false; return; }
    if (existing) {
      const { error } = await supabase.from("soul_likes").delete().eq("from_user_id", currentUserId).eq("to_user_id", targetId);
      if (!error) { button.classList.remove("is-liked"); button.textContent = "♡ Thích hồ sơ"; card?.classList.remove("soul-connected"); }
      else button.title = error.message;
    } else {
      const { error } = await supabase.from("soul_likes").insert({ from_user_id: currentUserId, to_user_id: targetId });
      if (!error) { button.classList.add("is-liked"); button.textContent = "♥ Đã thích"; await findMutual(targetId); }
      else button.title = error.message;
    }
    button.disabled = false;
  });
  parent?.appendChild(button);
  return button;
}
