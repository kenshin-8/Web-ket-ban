import { supabase } from "./supabase.js";
import { applyAvatar, createAvatarForProfile } from "./avatar-data.js";
import { renderAvatarHologram } from "./avatar-hologram.js";
import { PLANETS } from "./soul.js";
import { reportContent, blockUser, safetyButton } from "./safety.js";
const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const targetId = params.get("id");
const status = $("publicProfileStatus");
let viewer = null;
let profileOwner = null;
let realtimeChannel = null;

function node(tag, className = "", text = "") {
  const item = document.createElement(tag);
  if (className) item.className = className;
  if (text !== "") item.textContent = text;
  return item;
}
function dateLabel(value) {
  return new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
}
function chipList(target, values, className = "") {
  target.replaceChildren();
  (values || []).filter(Boolean).slice(0, 10).forEach(value => target.append(node("span", className, value)));
}
function addAchievement(container, icon, title, detail, unlocked) {
  const item = node("div", `achievement-item${unlocked ? " is-unlocked" : ""}`);
  item.append(node("span", "achievement-icon", icon), node("strong", "", title), node("small", "", detail));
  container.append(item);
}
function renderAvatar(host, data, name, profileId) {
  host.replaceChildren();
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 240 240"); svg.setAttribute("role", "img"); svg.setAttribute("aria-label", `Avatar của ${name}`);
  host.append(svg); applyAvatar(svg, createAvatarForProfile({ id: profileId, display_name: name, avatar_data: data }));
}

async function getNames(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.from("profiles").select("id,display_name").in("id", unique);
  if (error) throw error;
  return new Map((data || []).map(item => [item.id, item.display_name || "Thành viên Connect"]));
}

async function loadNotifications() {
  const panel = $("profileSocialNotifications");
  const list = $("profileSocialNotificationList");
  if (!panel || !list || !viewer || viewer.id !== profileOwner) return;
  const { data, error } = await supabase.from("profile_post_notifications")
    .select("id,actor_id,post_id,notification_type,created_at,read_at")
    .eq("recipient_id", viewer.id).order("created_at", { ascending: false }).limit(20);
  if (error) { list.textContent = "Chưa tải được thông báo. Hãy kiểm tra migration Social Interaction 2.0."; return; }
  const rows = data || [];
  const unread = rows.filter(row => !row.read_at).length;
  $("profileSocialNotificationCount").textContent = String(unread);
  list.replaceChildren();
  if (!rows.length) { list.append(node("p", "posts-empty", "Chưa có tương tác mới.")); return; }
  const names = await getNames(rows.map(row => row.actor_id));
  rows.forEach(row => {
    const label = row.notification_type === "like" ? "đã thích bài viết của bạn" : "đã bình luận bài viết của bạn";
    const item = node("div", `profile-social-notification${row.read_at ? "" : " is-unread"}`);
    item.append(node("strong", "", names.get(row.actor_id) || "Một thành viên"), node("span", "", ` ${label}`), node("time", "", dateLabel(row.created_at)));
    list.append(item);
  });
  const markRead = $("profileSocialMarkRead");
  if (markRead) {
    markRead.disabled = unread === 0;
    markRead.onclick = async () => {
      const idsToRead = rows.filter(row => !row.read_at).map(row => row.id);
      if (!idsToRead.length) return;
      markRead.disabled = true;
      const { error: readError } = await supabase.from("profile_post_notifications").update({ read_at: new Date().toISOString() }).in("id", idsToRead);
      if (readError) { markRead.disabled = false; return; }
      $("profileSocialNotificationCount").textContent = "0";
      list.querySelectorAll(".is-unread").forEach(item => item.classList.remove("is-unread"));
    };
  }
}

async function renderComments(postId, host) {
  host.replaceChildren(node("p", "posts-empty", "Đang tải bình luận…"));
  const { data, error } = await supabase.from("profile_post_comments")
    .select("id,user_id,body,created_at").eq("post_id", postId).order("created_at", { ascending: true }).limit(50);
  if (error) { host.replaceChildren(node("p", "posts-empty", "Không thể tải bình luận.")); return; }
  const comments = data || [];
  const names = await getNames(comments.map(item => item.user_id));
  host.replaceChildren();
  if (!comments.length) host.append(node("p", "posts-empty", "Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện!"));
  comments.forEach(comment => {
    const row = node("article", "profile-post-comment");
    const meta = node("div", "profile-post-comment-meta");
    meta.append(node("strong", "", names.get(comment.user_id) || "Thành viên Connect"), node("time", "", dateLabel(comment.created_at)));
    row.append(meta, node("p", "", comment.body));
    if (viewer?.id === comment.user_id) {
      const remove = node("button", "profile-post-delete-comment", "Xóa"); remove.type = "button";
      remove.addEventListener("click", async () => {
        remove.disabled = true;
        const { error: deleteError } = await supabase.from("profile_post_comments").delete().eq("id", comment.id);
        if (deleteError) { remove.disabled = false; return; }
        await renderComments(postId, host);
      });
      row.append(remove);
    }
    host.append(row);
  });
}

async function renderPost(post, names) {
  const card = node("article", "profile-post-card social-post-card");
  const header = node("div", "profile-social-post-header");
  header.append(node("strong", "", names.get(profileOwner) || "Thành viên Connect"));
  if (viewer?.id === profileOwner) {
    const own = node("span", "profile-post-owner-label", "Bài viết của bạn"); header.append(own);
  }
  const body = node("p", "", post.body);
  const time = node("time", "", dateLabel(post.created_at)); time.dateTime = post.created_at;
  const actions = node("div", "profile-social-post-actions");
  const likeButton = node("button", "profile-post-like", "♡ Thích"); likeButton.type = "button";
  const likeCount = node("span", "profile-post-like-count", "0 lượt thích");
  const commentToggle = node("button", "profile-post-comment-toggle", "Bình luận"); commentToggle.type = "button";
  const shareButton = node("button", "profile-post-share", "Chia sẻ"); shareButton.type = "button";
  const canInteract = !!viewer && profileVisible && viewer.id !== profileOwner;
  likeButton.disabled = !canInteract;
  commentToggle.disabled = !viewer;
  const { data: likes, error: likesError } = await supabase.from("profile_post_likes").select("user_id").eq("post_id", post.id);
  if (!likesError) {
    const rows = likes || [];
    const liked = rows.some(row => row.user_id === viewer?.id);
    likeButton.textContent = liked ? "♥ Đã thích" : "♡ Thích";
    likeButton.classList.toggle("is-liked", liked);
    likeButton.setAttribute("aria-pressed", String(liked));
    likeCount.textContent = `${rows.length} lượt thích`;
  }
  likeButton.addEventListener("click", async () => {
    if (!canInteract) return;
    likeButton.disabled = true;
    const liked = likeButton.getAttribute("aria-pressed") === "true";
    const result = liked
      ? await supabase.from("profile_post_likes").delete().eq("post_id", post.id).eq("user_id", viewer.id)
      : await supabase.from("profile_post_likes").insert({ post_id: post.id, user_id: viewer.id });
    if (!result.error) {
      const count = Math.max(0, Number.parseInt(likeCount.textContent, 10) + (liked ? -1 : 1));
      likeCount.textContent = `${count} lượt thích`;
      likeButton.textContent = liked ? "♡ Thích" : "♥ Đã thích";
      likeButton.classList.toggle("is-liked", !liked);
      likeButton.setAttribute("aria-pressed", String(!liked));
    }
    likeButton.disabled = !canInteract;
  });
  const commentArea = node("div", "profile-post-comments"); commentArea.hidden = true;
  commentToggle.addEventListener("click", async () => {
    commentArea.hidden = !commentArea.hidden;
    if (!commentArea.hidden && !commentArea.dataset.loaded) {
      await renderComments(post.id, commentArea); commentArea.dataset.loaded = "true";
    }
  });
  const commentForm = node("form", "profile-post-comment-form");
  const commentInput = node("input", ""); commentInput.type = "text"; commentInput.maxLength = 1000; commentInput.placeholder = "Viết bình luận…"; commentInput.required = true;
  const commentSubmit = node("button", "", "Gửi"); commentSubmit.type = "submit";
  commentForm.append(commentInput, commentSubmit); commentForm.hidden = !viewer;
  commentForm.addEventListener("submit", async event => {
    event.preventDefault(); const value = commentInput.value.trim(); if (!value || !viewer) return;
    commentSubmit.disabled = true;
    const { error } = await supabase.from("profile_post_comments").insert({ post_id: post.id, user_id: viewer.id, body: value });
    commentSubmit.disabled = false;
    if (error) { commentSubmit.textContent = "Thử lại"; return; }
    commentInput.value = ""; commentArea.dataset.loaded = "true"; await renderComments(post.id, commentArea);
    if (viewer.id === profileOwner) await loadNotifications();
  });
  shareButton.addEventListener("click", async () => {
    const url = `${location.origin}${location.pathname}?id=${encodeURIComponent(profileOwner)}#post-${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: "Bài viết trên Connect", text: post.body, url });
      else { await navigator.clipboard.writeText(url); shareButton.textContent = "Đã sao chép liên kết"; }
    } catch (error) { if (error?.name !== "AbortError") shareButton.textContent = "Không thể chia sẻ"; }
  });
  actions.append(likeButton, likeCount, commentToggle, shareButton);
  if (viewer && viewer.id !== profileOwner) {
    const reportButton = node("button", "profile-post-share", "⚑ Báo cáo"); reportButton.type = "button";
    reportButton.addEventListener("click", () => reportContent("profile_post", post.id, "Báo cáo bài viết"));
    actions.appendChild(reportButton);
  }
  card.id = `post-${post.id}`;
  card.append(header, body, time, actions, commentArea, commentForm);
  return card;
}

let profileVisible = false;
async function loadPosts() {
  const list = $("publicPosts");
  const { data, error } = await supabase.from("profile_posts").select("id,user_id,body,created_at")
    .eq("user_id", profileOwner).order("created_at", { ascending: false }).limit(30);
  list.replaceChildren();
  if (error) { list.textContent = "Chưa thể tải dòng thời gian."; return; }
  const posts = data || [];
  $("publicPostCount").textContent = `${posts.length} bài viết`;
  if (!posts.length) { list.append(node("p", "posts-empty", "Chưa có bài viết công khai.")); return; }
  const names = await getNames([profileOwner]);
  for (const post of posts) list.append(await renderPost(post, names));
}

async function load() {
  if (!targetId) { status.textContent = "Liên kết hồ sơ không hợp lệ."; return; }
  const { data: authData } = await supabase.auth.getUser();
  viewer = authData?.user || null;
  const { data: profile, error } = await supabase.from("profiles")
    .select("id,display_name,headline,bio,city,interests,soul_tags,zodiac,planet,avatar_data,cover_url,is_visible")
    .eq("id", targetId).maybeSingle();
  if (error || !profile || (!profile.is_visible && profile.id !== viewer?.id)) {
    status.textContent = "Hồ sơ này không tồn tại hoặc chưa được chia sẻ công khai."; return;
  }
  profileOwner = profile.id; profileVisible = profile.is_visible === true;
  status.hidden = true; $("publicProfile").hidden = false;
  $("publicName").textContent = profile.display_name || "Thành viên Connect";
  $("publicHeadline").textContent = profile.headline || "";
  $("publicCity").textContent = profile.city ? `⌖ ${profile.city}` : "Thành viên Connect";
  $("publicBio").textContent = profile.bio || "Thành viên này chưa thêm phần giới thiệu.";
  renderAvatar($("publicAvatar"), profile.avatar_data, profile.display_name, profile.id);
  renderAvatarHologram($("publicAvatarHologram"), profile.avatar_data, profile.display_name || "thành viên Connect");
  if (profile.cover_url) $("publicCover").style.backgroundImage = `linear-gradient(90deg,rgba(8,12,30,.45),rgba(8,12,30,.05)),url("${profile.cover_url.replaceAll('"','%22')}")`;
  chipList($("publicInterests"), profile.interests, "public-chip");
  chipList($("publicSoulTags"), profile.soul_tags, "public-chip soul-chip");
  $("publicZodiac").textContent = profile.zodiac ? `✦ ${profile.zodiac}` : "";
  const planet = PLANETS[profile.planet]; $("publicPlanet").textContent = planet ? `${planet.icon} Tinh cầu ${planet.name} · ${planet.desc}` : "";
  $("editOwnProfile").hidden = profile.id !== viewer?.id;
  document.getElementById("profileSafety")?.remove();
  if (viewer && profile.id !== viewer.id) {
    const box = node("div", "profile-safety"); box.id = "profileSafety";
    safetyButton("⚑ Báo cáo hồ sơ", () => reportContent("profile", profile.id, "Báo cáo hồ sơ này"), box);
    safetyButton("🚫 Chặn", async () => { if (await blockUser(profile.id, profile.display_name || "thành viên này")) location.href = "discover.html"; }, box);
    $("editOwnProfile").after(box);
  }
  const achievements = $("publicAchievements"); achievements.replaceChildren();
  addAchievement(achievements, "✧", "Chào mừng", "Đã tham gia Connect", true);
  addAchievement(achievements, "◉", "Avatar riêng", "Tạo avatar cá nhân", !!profile.avatar_data);
  addAchievement(achievements, "✎", "Người kể chuyện", "Thêm phần giới thiệu", !!profile.bio?.trim());
  addAchievement(achievements, "✦", "Soul Card", "Chọn từ khóa cá nhân", (profile.soul_tags || []).length > 0);
  addAchievement(achievements, "◎", "Khám phá bản thân", "Hoàn thành Soul Quiz", !!profile.planet);
  addAchievement(achievements, "☼", "Kết nối cộng đồng", "Chia sẻ hồ sơ công khai", !!profile.is_visible);
  if (viewer?.id === profileOwner) { $("profileSocialNotifications").hidden = false; await loadNotifications(); }
  await loadPosts();
  if (viewer) {
    realtimeChannel = supabase.channel(`profile-social-${profileOwner}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_post_likes" }, () => loadPosts())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "profile_post_comments" }, () => loadPosts());
    if (viewer.id === profileOwner) realtimeChannel.on("postgres_changes", { event: "INSERT", schema: "public", table: "profile_post_notifications", filter: `recipient_id=eq.${viewer.id}` }, () => loadNotifications());
    realtimeChannel.subscribe();
  }
}
load().catch(error => { console.error(error); status.textContent = "Đã xảy ra lỗi khi tải hồ sơ."; });
window.addEventListener("pagehide", () => { if (realtimeChannel) supabase.removeChannel(realtimeChannel); });
