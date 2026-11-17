import { supabase } from "./supabase.js";
import { applyAvatar } from "./avatar-data.js";
import { PLANETS } from "./soul.js";

const form = document.getElementById("profileForm");
const message = document.getElementById("profileMessage");
const saveBtn = document.getElementById("saveBtn");
let currentUser = null;
let currentAvatarData = null;

async function loadProfile() {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
        window.location.href = "login.html";
        return;
    }
    currentUser = data.user;
    const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("display_name, bio, interests, city, is_visible, avatar_data, soul_tags, zodiac, planet")
        .eq("id", currentUser.id)
        .maybeSingle();
    if (profileError) {
        message.textContent = "Không thể tải hồ sơ. Vui lòng thử lại.";
        console.error(profileError);
        return;
    }
    currentAvatarData = profile?.avatar_data || null;
    if (profile) {
        document.getElementById("displayName").value = profile.display_name || "";
        document.getElementById("bio").value = profile.bio || "";
        document.getElementById("city").value = profile.city || "";
        document.getElementById("interests").value = Array.isArray(profile.interests) ? profile.interests.join(", ") : "";
        document.getElementById("isVisible").checked = profile.is_visible === true;
        document.getElementById("zodiac").value = profile.zodiac || "";
        document.getElementById("soulTags").value = Array.isArray(profile.soul_tags) ? profile.soul_tags.join(", ") : "";
        renderSoulCard(profile.soul_tags || []);
    }
    const display = document.getElementById("savedAvatarDisplay");
    if (currentAvatarData) applyAvatar(document.getElementById("profileAvatarCanvas"), currentAvatarData);
    else if (display) display.textContent = "Bạn chưa tạo Avatar.";
    renderPlanetBadge(profile?.planet);
}

if (form) {
    form.addEventListener("submit", async event => {
        event.preventDefault();
        if (!currentUser) return;
        const displayName = document.getElementById("displayName").value.trim();
        const bio = document.getElementById("bio").value.trim();
        const city = document.getElementById("city").value.trim();
        const interests = document.getElementById("interests").value.split(",").map(item => item.trim().slice(0, 30)).filter(Boolean);
        const uniqueInterests = [...new Set(interests)].slice(0, 10);
        const isVisible = document.getElementById("isVisible").checked;
        const soulTags = [...new Set(document.getElementById("soulTags").value.split(",").map(x => x.trim().slice(0, 24)).filter(Boolean))].slice(0, 6);
        if (!displayName) {
            message.textContent = "Vui lòng nhập tên hiển thị.";
            return;
        }
        saveBtn.disabled = true;
        saveBtn.textContent = "Đang lưu...";
        message.textContent = "";
        const { error } = await supabase.from("profiles").upsert({
            id: currentUser.id,
            display_name: displayName,
            bio,
            city,
            interests: uniqueInterests,
            is_visible: isVisible,
            avatar_data: currentAvatarData,
            soul_tags: soulTags,
            zodiac: document.getElementById("zodiac").value || null,
            updated_at: new Date().toISOString()
        });
        saveBtn.disabled = false;
        saveBtn.textContent = "Lưu hồ sơ";
        if (error) {
            message.textContent = "Lưu thất bại: " + error.message;
            console.error(error);
            return;
        }
        message.textContent = "Lưu hồ sơ thành công!";
    });
}


function renderPlanetBadge(planetKey) {
    const badge = document.getElementById("profilePlanetBadge");
    if (!badge) return;
    const planet = PLANETS[planetKey];
    badge.hidden = !planet;
    badge.replaceChildren();
    if (!planet) return;
    const icon = document.createElement("span");
    icon.className = "planet-orb-icon";
    icon.textContent = planet.icon;
    const label = document.createElement("span");
    label.className = "planet-orb-label";
    label.textContent = `Tinh cầu ${planet.name}`;
    const desc = document.createElement("small");
    desc.textContent = planet.desc;
    badge.append(icon, label, desc);
}
\nfunction renderSoulCard(tags) {
    const preview = document.getElementById("soulCardPreview");
    if (!preview) return;
    preview.replaceChildren();
    if (!tags.length) {
        const empty = document.createElement("span");
        empty.className = "soul-card-empty";
        empty.textContent = "Từ khóa của bạn sẽ xuất hiện ở đây.";
        preview.append(empty);
        return;
    }
    tags.slice(0, 6).forEach(tag => {
        const chip = document.createElement("span");
        chip.className = "soul-tag";
        chip.textContent = tag;
        preview.append(chip);
    });
}
document.getElementById("soulTags")?.addEventListener("input", event => {
    const tags = [...new Set(event.target.value.split(",").map(x => x.trim()).filter(Boolean))].slice(0, 6);
    renderSoulCard(tags);
});

loadProfile();
