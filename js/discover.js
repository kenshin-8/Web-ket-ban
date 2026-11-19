import { supabase } from "./supabase.js";
import { createAvatarSvg } from "./avatar-data.js";
import { signByName } from "./zodiac.js";
import { PLANETS, compat } from "./soul.js";
import { initSoulConnections, createSoulLikeButton, sharedInterests } from "./soul-connection.js";

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
    const profileLink = document.createElement("a");
    profileLink.className = "member-profile-link";
    profileLink.href = `public-profile.html?id=${encodeURIComponent(member.id)}`;
    profileLink.textContent = "Xem hồ sơ ↗";
    card.appendChild(profileLink);
    if (currentUser && member.id !== currentUser.id) {
        const common = sharedInterests(myProfile?.interests, member.interests);
        const score = myProfile?.planet && member.planet ? compat(myProfile, member) : 0;
        const actions = document.createElement("div"); actions.className = "member-actions";
        card.appendChild(actions);
        createSoulLikeButton(member.id, score, common, actions);
    }
    return card;
}

const PAGE_SIZE = 24;
let loadToken = 0, loadedCount = 0, moreBtn = null;

function setMoreButton(total) {
    if (!moreBtn) {
        moreBtn = document.createElement("button");
        moreBtn.type = "button"; moreBtn.className = "btn btn-light load-more-btn";
        moreBtn.addEventListener("click", () => loadMembers({ append: true }));
        membersList.after(moreBtn);
    }
    moreBtn.hidden = loadedCount >= total;
    moreBtn.disabled = false;
    moreBtn.textContent = `Xem thêm (${total - loadedCount} thành viên)`;
}

// Tìm kiếm và phân trang chạy phía server (hàm search_profiles trong supabase/discover_search.sql).
async function loadMembers({ append = false } = {}) {
    if (!membersList || !memberCount) return;
    const token = ++loadToken;
    const offset = append ? loadedCount : 0;
    if (!append) {
        loadedCount = 0;
        membersList.replaceChildren();
        addText(membersList, "p", "empty-message", "Đang tải thành viên...");
        if (moreBtn) moreBtn.hidden = true;
    } else if (moreBtn) { moreBtn.disabled = true; moreBtn.textContent = "Đang tải..."; }
    if (searchBtn) searchBtn.disabled = true;

    try {
        const { data, error } = await supabase.rpc("search_profiles", {
            p_name: searchInput?.value.trim() || null,
            p_city: cityFilter?.value.trim() || null,
            p_interest: interestFilter?.value.trim() || null,
            p_limit: PAGE_SIZE,
            p_offset: offset
        });
        if (token !== loadToken) return; // đã có lần tìm mới hơn
        if (error) throw error;

        const rows = data || [];
        const total = rows.length ? Number(rows[0].total_count) : (append ? loadedCount : 0);
        if (!append) membersList.replaceChildren();
        if (!rows.length && !append) {
            memberCount.textContent = "0 thành viên";
            addText(membersList, "p", "empty-message", "Không tìm thấy thành viên phù hợp. Hãy thử thay đổi bộ lọc.");
            return;
        }
        rows.forEach(member => membersList.appendChild(renderMember(member)));
        loadedCount += rows.length;
        memberCount.textContent = `${total} thành viên`;
        setMoreButton(total);
    } catch (error) {
        if (token !== loadToken) return;
        console.error("Lỗi tải thành viên:", error);
        memberCount.textContent = "Chưa tải được";
        if (!append) membersList.replaceChildren();
        addText(membersList, "p", "empty-message", "Không thể tải danh sách. Hãy chạy supabase/discover_search.sql và kiểm tra kết nối.");
        if (moreBtn) moreBtn.hidden = true;
    } finally {
        if (token === loadToken && searchBtn) searchBtn.disabled = false;
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
