import { supabase } from "./supabase.js";
import { applyAvatar } from "./avatar-data.js";
import { PLANETS } from "./soul.js";

const $ = id => document.getElementById(id);
const form = $("profileForm");
const message = $("profileMessage");
const saveBtn = $("saveBtn");
let currentUser = null;
let currentAvatarData = null;
let currentCoverUrl = "";

async function loadProfile() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) { window.location.href = "login.html"; return; }
    currentUser = data.user;
    const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("display_name,bio,interests,city,is_visible,avatar_data,soul_tags,zodiac,planet,headline,cover_url")
        .eq("id", currentUser.id).maybeSingle();
    if (profileError) { message.textContent = "Không thể tải hồ sơ. Vui lòng thử lại."; console.error(profileError); return; }
    currentAvatarData = profile?.avatar_data || null;
    currentCoverUrl = profile?.cover_url || "";
    renderSavedAvatar(currentAvatarData);
    if (profile) {
        $("displayName").value = profile.display_name || "";
        $("bio").value = profile.bio || "";
        $("city").value = profile.city || "";
        $("headline").value = profile.headline || "";
        $("interests").value = Array.isArray(profile.interests) ? profile.interests.join(", ") : "";
        $("isVisible").checked = profile.is_visible === true;
        $("zodiac").value = profile.zodiac || "";
        $("soulTags").value = Array.isArray(profile.soul_tags) ? profile.soul_tags.join(", ") : "";
        renderSoulCard(profile.soul_tags || []);
    }
    renderPlanetBadge(profile?.planet);
    renderCover(currentCoverUrl);
    updatePublicLink();
    await loadPosts();
}

function renderSavedAvatar(avatarData) {
    const display = $("savedAvatarDisplay");
    const svg = $("profileAvatarCanvas");
    if (avatarData) {
        if (!svg && display) {
            const replacement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
            replacement.id = "profileAvatarCanvas";
            replacement.setAttribute("viewBox", "0 0 240 240");
            replacement.setAttribute("role", "img");
            replacement.setAttribute("aria-label", "Avatar của tôi");
            display.replaceChildren(replacement);
            applyAvatar(replacement, avatarData);
        } else if (svg) applyAvatar(svg, avatarData);
    } else if (display) display.textContent = "Bạn chưa tạo Avatar.";
}

function renderCover(url) {
    const preview = $("coverPreview");
    if (!preview) return;
    preview.replaceChildren();
    if (url) {
        preview.style.backgroundImage = `linear-gradient(90deg,rgba(8,12,30,.42),rgba(8,12,30,.04)),url("${url.replaceAll('"', '%22')}")`;
        const label = document.createElement("span"); label.textContent = "YOUR CONNECT STORY"; preview.append(label);
    } else {
        preview.style.backgroundImage = "";
        const label = document.createElement("span"); label.textContent = "YOUR CONNECT STORY"; preview.append(label);
    }
}

function updatePublicLink() {
    const link = $("publicProfileLink");
    if (link && currentUser) link.href = `public-profile.html?id=${encodeURIComponent(currentUser.id)}`;
}

$("coverFile")?.addEventListener("change", async event => {
    const file = event.target.files?.[0];
    if (!file || !currentUser) return;
    const status = $("coverMessage");
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { status.textContent = "Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP."; event.target.value = ""; return; }
    if (file.size > 5 * 1024 * 1024) { status.textContent = "Ảnh vượt quá 5 MB. Vui lòng chọn ảnh nhỏ hơn."; event.target.value = ""; return; }
    status.textContent = "Đang tải ảnh bìa…";
    const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
    const path = `${currentUser.id}/${crypto.randomUUID()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("profile-covers").upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) { status.textContent = `Tải ảnh thất bại: ${uploadError.message}. Hãy chạy migration Profile 2.0 trong Supabase.`; return; }
    const { data } = supabase.storage.from("profile-covers").getPublicUrl(path);
    currentCoverUrl = data.publicUrl;
    renderCover(currentCoverUrl);
    status.textContent = "Đã tải ảnh bìa. Nhấn Lưu hồ sơ để cập nhật hồ sơ.";
});

$("removeCover")?.addEventListener("click", () => {
    currentCoverUrl = ""; renderCover(""); $("coverFile").value = "";
    $("coverMessage").textContent = "Ảnh bìa sẽ được gỡ khi bạn nhấn Lưu hồ sơ.";
});

async function refreshSavedAvatar() {
    if (!currentUser) return;
    const { data, error } = await supabase.from("profiles").select("avatar_data").eq("id", currentUser.id).maybeSingle();
    if (error) { console.warn("Không thể đồng bộ Avatar mới:", error); return; }
    currentAvatarData = data?.avatar_data || null; renderSavedAvatar(currentAvatarData);
}

form?.addEventListener("submit", async event => {
    event.preventDefault(); if (!currentUser) return;
    await refreshSavedAvatar();
    const displayName = $("displayName").value.trim();
    if (!displayName) { message.textContent = "Vui lòng nhập tên hiển thị."; return; }
    const interests = [...new Set($("interests").value.split(",").map(x => x.trim().slice(0, 30)).filter(Boolean))].slice(0, 10);
    const soulTags = [...new Set($("soulTags").value.split(",").map(x => x.trim().slice(0, 24)).filter(Boolean))].slice(0, 6);
    saveBtn.disabled = true; saveBtn.textContent = "Đang lưu…"; message.textContent = "";
    const { error } = await supabase.from("profiles").upsert({
        id: currentUser.id, display_name: displayName, headline: $("headline").value.trim(),
        bio: $("bio").value.trim(), city: $("city").value.trim(), interests,
        is_visible: $("isVisible").checked, avatar_data: currentAvatarData, cover_url: currentCoverUrl,
        soul_tags: soulTags, zodiac: $("zodiac").value || null, updated_at: new Date().toISOString()
    });
    saveBtn.disabled = false; saveBtn.textContent = "Lưu hồ sơ";
    if (error) { message.textContent = "Lưu thất bại: " + error.message; console.error(error); return; }
    message.textContent = "Lưu hồ sơ thành công!"; updatePublicLink();
});

function renderPlanetBadge(planetKey) {
    const badge = $("profilePlanetBadge"); if (!badge) return;
    const planet = PLANETS[planetKey]; badge.hidden = !planet; badge.replaceChildren(); if (!planet) return;
    const icon = document.createElement("span"); icon.className = "planet-orb-icon"; icon.textContent = planet.icon;
    const label = document.createElement("span"); label.className = "planet-orb-label"; label.textContent = `Tinh cầu ${planet.name}`;
    const desc = document.createElement("small"); desc.textContent = planet.desc; badge.append(icon, label, desc);
}

function renderSoulCard(tags) {
    const preview = $("soulCardPreview"); if (!preview) return; preview.replaceChildren();
    if (!tags.length) { const empty = document.createElement("span"); empty.className = "soul-card-empty"; empty.textContent = "Từ khóa của bạn sẽ xuất hiện ở đây."; preview.append(empty); return; }
    tags.slice(0, 6).forEach(tag => { const chip = document.createElement("span"); chip.className = "soul-tag"; chip.textContent = tag; preview.append(chip); });
}
$("soulTags")?.addEventListener("input", event => renderSoulCard([...new Set(event.target.value.split(",").map(x => x.trim()).filter(Boolean))].slice(0, 6)));

async function loadPosts() {
    const list = $("profilePostsList"); if (!list || !currentUser) return;
    const { data, error } = await supabase.from("profile_posts").select("id,body,created_at").eq("user_id", currentUser.id).order("created_at", { ascending: false }).limit(20);
    list.replaceChildren();
    if (error) { list.textContent = "Chưa tải được dòng thời gian. Hãy kiểm tra migration Profile 2.0."; console.warn(error); return; }
    $("postCount").textContent = `${data.length} bài viết`;
    if (!data.length) { const empty = document.createElement("p"); empty.className = "posts-empty"; empty.textContent = "Chưa có bài viết nào. Hãy đăng cập nhật đầu tiên!"; list.append(empty); return; }
    data.forEach(post => {
        const article = document.createElement("article"); article.className = "profile-post-card";
        const body = document.createElement("p"); body.textContent = post.body;
        const meta = document.createElement("div"); meta.className = "profile-post-meta";
        const date = document.createElement("time"); date.dateTime = post.created_at; date.textContent = new Date(post.created_at).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });
        const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "Xóa"; remove.addEventListener("click", () => deletePost(post.id));
        meta.append(date, remove); article.append(body, meta); list.append(article);
    });
}

$("profilePostForm")?.addEventListener("submit", async event => {
    event.preventDefault(); const body = $("profilePostBody").value.trim(); if (!body || !currentUser) return;
    const button = $("publishPostBtn"); button.disabled = true; button.textContent = "Đang đăng…";
    const { error } = await supabase.from("profile_posts").insert({ user_id: currentUser.id, body });
    button.disabled = false; button.textContent = "Đăng bài";
    if (error) { $("postsMessage").textContent = `Đăng bài thất bại: ${error.message}`; return; }
    $("profilePostBody").value = ""; $("postsMessage").textContent = "Đã đăng bài."; await loadPosts();
});

async function deletePost(id) {
    if (!confirm("Bạn muốn xóa bài viết này?")) return;
    const { error } = await supabase.from("profile_posts").delete().eq("id", id).eq("user_id", currentUser.id);
    if (error) { $("postsMessage").textContent = `Không thể xóa: ${error.message}`; return; }
    await loadPosts();
}

window.addEventListener("connect:avatar-updated", event => { if (!currentUser || event.detail?.userId !== currentUser.id) return; currentAvatarData = event.detail.avatarData || null; renderSavedAvatar(currentAvatarData); });
window.addEventListener("storage", event => {
    if (event.key !== "connect:avatar-updated" || !currentUser || !event.newValue) return;
    try { const update = JSON.parse(event.newValue); if (update.userId === currentUser.id) { currentAvatarData = update.avatarData || null; renderSavedAvatar(currentAvatarData); } } catch (error) { console.warn("Không đọc được tín hiệu Avatar:", error); }
});
window.addEventListener("pageshow", () => refreshSavedAvatar());
document.addEventListener("visibilitychange", () => { if (!document.hidden) refreshSavedAvatar(); });
loadProfile();
