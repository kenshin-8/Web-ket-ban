import { supabase } from "./supabase.js";
import { createAvatarSvg } from "./avatar-data.js";
import { signByName } from "./zodiac.js";
import { PLANETS, compat } from "./soul.js";
import { initSoulConnections, createSoulLikeButton, sharedInterests } from "./soul-connection.js";

const likeSafe = text => text.replace(/[\\%_]/g, "\\$&");
const membersList = document.getElementById("membersList");
const memberCount = document.getElementById("memberCount");
const searchInput = document.getElementById("searchInput");
const cityFilter = document.getElementById("cityFilter");
const interestFilter = document.getElementById("interestFilter");
const searchBtn = document.getElementById("searchBtn");
const clearFilters = document.getElementById("clearFilters");
let searchTimer = null, currentUser = null, myProfile = null;

function makeAvatar(avatarData, displayName) {
    const wrapper = document.createElement("div");
    wrapper.className = "member-avatar";
    if (!avatarData) {
        wrapper.classList.add("member-avatar-fallback");
        wrapper.textContent = (displayName || "T").trim().charAt(0).toLocaleUpperCase("vi-VN");
        return wrapper;
    }
    wrapper.appendChild(createAvatarSvg(avatarData, `Avatar của ${displayName || "thành viên"}`));
    return wrapper;
}

function addText(parent, tag, className, value) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    element.textContent = value;
    parent.appendChild(element);
    return element;
}

function renderMember(member) {
    const card = document.createElement("article");
    card.className = "member-card";
    card.dataset.memberId = member.id;
    card.appendChild(makeAvatar(member.avatar_data, member.display_name));
    const planet = PLANETS[member.planet];
    if (planet) addText(card, "div", "planet-orb-mini", `${planet.icon} Tinh cầu ${planet.name}`);
    addText(card, "h3", "member-name", member.display_name || "Thành viên Connect");
    const sign = signByName(member.zodiac);
    if (sign) addText(card, "span", "zodiac-badge", `${sign.g} ${sign.n}`);
    addText(card, "p", "member-city", `📍 ${member.city || "Chưa cập nhật thành phố"}`);
    addText(card, "p", "member-bio", member.bio || "Thành viên chưa thêm phần giới thiệu.");

    const interests = document.createElement("div");
    interests.className = "member-interests";
    addText(interests, "p", "interests-title", "Sở thích");
    const values = Array.isArray(member.interests) ? member.interests : [];
    if (values.length) {
        values.forEach(value => addText(interests, "span", "interest-tag", String(value)));
    } else {
        addText(interests, "span", "interest-empty", "Chưa cập nhật");
    }
    card.appendChild(interests);
    if (currentUser && member.id !== currentUser.id) {
        const common = sharedInterests(myProfile?.interests, member.interests);
        const score = myProfile?.planet && member.planet ? compat(myProfile, member) : 0;
        const actions = document.createElement("div"); actions.className = "member-actions";
        card.appendChild(actions);
        createSoulLikeButton(member.id, score, common, actions);
    }
    return card;
}

async function loadMembers() {
    if (!membersList || !memberCount) return;
    const nameTerm = searchInput?.value.trim() || "";
    const cityTerm = cityFilter?.value.trim() || "";
    const interestTerm = (interestFilter?.value.trim() || "").toLocaleLowerCase("vi-VN");

    membersList.replaceChildren();
    addText(membersList, "p", "empty-message", "Đang tải thành viên...");
    if (searchBtn) searchBtn.disabled = true;

    try {
        let query = supabase
            .from("profiles")
            .select("id, display_name, bio, interests, city, avatar_data, zodiac, planet, soul_scores")
            .eq("is_visible", true);
        if (nameTerm) query = query.ilike("display_name", `%${likeSafe(nameTerm)}%`);
        if (cityTerm) query = query.ilike("city", `%${likeSafe(cityTerm)}%`);

        const { data, error } = await query.order("display_name", { ascending: true });
        if (error) throw error;

        const filtered = (data || []).filter(member => {
            if (!interestTerm) return true;
            const interests = Array.isArray(member.interests) ? member.interests : [];
            return interests.some(item => String(item).toLocaleLowerCase("vi-VN").includes(interestTerm));
        });

        memberCount.textContent = `${filtered.length} thành viên`;
        membersList.replaceChildren();
        if (!filtered.length) {
            addText(membersList, "p", "empty-message", "Không tìm thấy thành viên phù hợp. Hãy thử thay đổi bộ lọc.");
            return;
        }
        filtered.forEach(member => membersList.appendChild(renderMember(member)));
    } catch (error) {
        console.error("Lỗi tải thành viên:", error);
        memberCount.textContent = "Chưa tải được";
        membersList.replaceChildren();
        addText(membersList, "p", "empty-message", "Không thể tải danh sách. Hãy kiểm tra kết nối hoặc quyền truy cập Supabase.");
    } finally {
        if (searchBtn) searchBtn.disabled = false;
    }
}

function scheduleSearch() {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadMembers, 350);
}

[searchInput, cityFilter, interestFilter].forEach(input => {
    if (!input) return;
    input.addEventListener("input", scheduleSearch);
    input.addEventListener("keydown", event => {
        if (event.key === "Enter") { clearTimeout(searchTimer); loadMembers(); }
    });
});
searchBtn?.addEventListener("click", () => { clearTimeout(searchTimer); loadMembers(); });
clearFilters?.addEventListener("click", () => {
    if (searchInput) searchInput.value = "";
    if (cityFilter) cityFilter.value = "";
    if (interestFilter) interestFilter.value = "";
    loadMembers();
});

(async () => {
    const { data } = await supabase.auth.getUser(); currentUser = data?.user || null;
    if (currentUser) {
        const { data: profile } = await supabase.from("profiles").select("planet,soul_scores,interests,zodiac").eq("id", currentUser.id).maybeSingle();
        myProfile = profile || {};
        initSoulConnections(currentUser.id, myProfile);
    }
    loadMembers();
})();
