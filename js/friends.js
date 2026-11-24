import { supabase } from "./supabase.js";
import { openBlockedDialog } from "./safety.js";
import { createAvatarSvg, createAvatarForProfile } from "./avatar-data.js";

const $ = (id) => document.getElementById(id);
const searchForm = $("friendSearchForm");
const searchInput = $("friendSearchInput");
const searchResults = $("friendSearchResults");
const searchStatus = $("friendSearchStatus");
const requestsBox = $("friendRequests");
const friendsBox = $("friendsList");
const dmPanel = $("directMessagePanel");
const dmMessages = $("dmMessages");
const dmForm = $("dmForm");
const dmInput = $("dmInput");
const dmStatus = $("dmStatus");

let currentUser = null;
let activeFriend = null;
let messageChannel = null;
let messageIds = new Set();
let searchTimer = null;
let notificationChannel = null;
let presenceChannel = null;
let presenceTimer = null;
let friendProfiles = new Map();
let friendIds = [];

function safeText(value, fallback = "Thành viên Connect") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function makeAvatar(profile) {
  const avatar = document.createElement("span");
  avatar.className = "person-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.appendChild(createAvatarSvg(createAvatarForProfile(profile), `Avatar của ${safeText(profile?.display_name)}`));
  return avatar;
}

function makePersonCard(profile, actionLabel, onAction, note = "") {
  const card = document.createElement("article");
  card.className = "person-card";
  const identity = document.createElement("div");
  identity.className = "person-identity";
  identity.append(makeAvatar(profile));
  const copy = document.createElement("div");
  copy.className = "person-copy";
  const name = document.createElement("strong");
  name.textContent = safeText(profile.display_name);
  const meta = document.createElement("small");
  meta.textContent = note || safeText(profile.city, "Thành viên Connect");
  copy.append(name, meta);
  if (profile.id && profile.showPresence) {
    const presence = document.createElement("small");
    presence.className = "person-presence";
    presence.dataset.presenceUser = profile.id;
    presence.textContent = "Đang kiểm tra trạng thái…";
    copy.append(presence);
  }
  identity.append(copy);
  card.append(identity);
  if (actionLabel) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "person-action";
    button.textContent = actionLabel;
    button.addEventListener("click", () => onAction(button));
    card.append(button);
  }
  return card;
}

function showEmpty(container, text) {
  const p = document.createElement("p");
  p.className = "empty-state";
  p.textContent = text;
  container.replaceChildren(p);
}

async function loadProfiles(ids) {
  const uniqueIds = [...new Set(ids.filter(Boolean))];
  if (!uniqueIds.length) return new Map();
  const { data, error } = await supabase.from("profiles")
    .select("id, display_name, city, interests, avatar_data")
    .in("id", uniqueIds);
  if (error) throw error;
  return new Map((data || []).map(profile => [profile.id, profile]));
}

async function runSearch(term) {
  const query = term.trim();
  if (query.length < 2) {
    showEmpty(searchResults, "Nhập ít nhất 2 ký tự để tìm kiếm.");
    searchStatus.textContent = "Tìm theo tên hiển thị của hồ sơ công khai.";
    return;
  }
  searchStatus.textContent = "Đang tìm thành viên…";
  searchResults.replaceChildren();
  const { data, error } = await supabase.from("profiles")
    .select("id, display_name, city, interests, avatar_data")
    .eq("is_visible", true)
    .ilike("display_name", `%${query.replace(/[,%()]/g, " ")}%`)
    .neq("id", currentUser.id)
    .order("display_name", { ascending: true })
    .limit(20);
  if (error) {
    searchStatus.textContent = "Không thể tìm kiếm. Hãy kiểm tra SQL và quyền truy cập Supabase.";
    console.error("Friend search:", error);
    return;
  }
  if (!data?.length) {
    searchStatus.textContent = "Không tìm thấy hồ sơ phù hợp.";
    showEmpty(searchResults, "Thử một tên khác nhé.");
    return;
  }
  const { data: existingRows, error: existingError } = await supabase.from("friend_requests")
    .select("id, requester_id, recipient_id, status")
    .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`);
  if (existingError) {
    searchStatus.textContent = "Đã tìm thấy thành viên nhưng chưa tải được trạng thái kết bạn.";
    console.error(existingError);
    return;
  }
  const relationByPerson = new Map();
  (existingRows || []).forEach(row => {
    const otherId = row.requester_id === currentUser.id ? row.recipient_id : row.requester_id;
    relationByPerson.set(otherId, row);
  });
  data.forEach(profile => {
    const relation = relationByPerson.get(profile.id);
    let label = "＋ Kết bạn";
    let handler = (button) => sendRequest(profile, null, button);
    if (relation?.status === "accepted") {
      label = "Nhắn tin";
      handler = () => openConversation(profile);
    } else if (relation?.status === "pending") {
      label = relation.requester_id === currentUser.id ? "Đã gửi" : "Đang chờ phản hồi";
      handler = () => { searchStatus.textContent = "Bạn đã có lời mời đang chờ xử lý với thành viên này."; };
    } else if (relation?.status === "declined") {
      label = "Gửi lại lời mời";
      handler = (button) => sendRequest(profile, relation, button);
    }
    searchResults.append(makePersonCard(profile, label, handler, profile.city || (profile.interests || []).slice(0, 3).join(" · ") || "Hồ sơ công khai"));
  });
  searchStatus.textContent = `Tìm thấy ${data.length} thành viên phù hợp.`;
}

async function sendRequest(profile, previous = null, button = null) {
  if (button) button.disabled = true;
  try {
    if (previous?.status === "declined") {
      const { error: deleteError } = await supabase.from("friend_requests").delete().eq("id", previous.id);
      if (deleteError) throw deleteError;
    }
    const { error } = await supabase.from("friend_requests").insert({ requester_id: currentUser.id, recipient_id: profile.id, status: "pending" });
    if (error) throw error;
    searchStatus.textContent = `Đã gửi lời mời kết bạn đến ${safeText(profile.display_name)}.`;
    await loadNetwork();
    await runSearch(searchInput.value);
  } catch (error) {
    console.error("Send friend request:", error);
    searchStatus.textContent = error.code === "23505" ? "Hai bạn đã có lời mời hoặc đã là bạn bè." : `Không gửi được lời mời: ${error.message || "Lỗi kết nối"}`;
    if (button) button.disabled = false;
  }
}

async function loadNetwork() {
  const { data: rows, error } = await supabase.from("friend_requests")
    .select("id, requester_id, recipient_id, status, created_at")
    .or(`requester_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    console.error("Load friend network:", error);
    showEmpty(requestsBox, "Không tải được lời mời. Hãy chạy 003_friend_system.sql trong Supabase.");
    showEmpty(friendsBox, "Không tải được danh sách bạn bè.");
    return;
  }
  const incoming = (rows || []).filter(row => row.status === "pending" && row.recipient_id === currentUser.id);
  const accepted = (rows || []).filter(row => row.status === "accepted");
  $("requestCount").textContent = String(incoming.length);
  $("friendsCount").textContent = String(accepted.length);

  const ids = [...incoming.map(row => row.requester_id), ...accepted.map(row => row.requester_id === currentUser.id ? row.recipient_id : row.requester_id)];
  friendIds = accepted.map(row => row.requester_id === currentUser.id ? row.recipient_id : row.requester_id);
  let profiles = new Map();
  try { profiles = await loadProfiles(ids); }
  catch (profileError) { console.warn("Some friend profiles are private or unavailable:", profileError); }

  requestsBox.replaceChildren();
  if (!incoming.length) showEmpty(requestsBox, "Chưa có lời mời kết bạn mới.");
  incoming.forEach(row => {
    const profile = profiles.get(row.requester_id) || { display_name: "Thành viên Connect", city: "Hồ sơ hiện không công khai" };
    const card = document.createElement("article");
    card.className = "person-card request-card";
    const identity = document.createElement("div"); identity.className = "person-identity";
    identity.append(makeAvatar(profile));
    const copy = document.createElement("div"); copy.className = "person-copy";
    const name = document.createElement("strong"); name.textContent = safeText(profile.display_name);
    const meta = document.createElement("small"); meta.textContent = "Muốn kết nối với bạn";
    copy.append(name, meta); identity.append(copy); card.append(identity);
    const actions = document.createElement("div"); actions.className = "request-actions";
    const accept = document.createElement("button"); accept.type = "button"; accept.className = "person-action"; accept.textContent = "Chấp nhận";
    accept.addEventListener("click", () => respondRequest(row, "accepted", accept));
    const decline = document.createElement("button"); decline.type = "button"; decline.className = "person-action person-action-muted"; decline.textContent = "Từ chối";
    decline.addEventListener("click", () => respondRequest(row, "declined", decline));
    actions.append(accept, decline); card.append(actions); requestsBox.append(card);
  });

  friendProfiles = new Map();
  friendIds.forEach(id => { if (profiles.has(id)) friendProfiles.set(id, profiles.get(id)); });
  friendsBox.replaceChildren();
  if (!accepted.length) showEmpty(friendsBox, "Bạn chưa có bạn bè. Hãy tìm kiếm thành viên ở phía trên.");
  accepted.forEach(row => {
    const friendId = row.requester_id === currentUser.id ? row.recipient_id : row.requester_id;
    const profile = profiles.get(friendId) || { id: friendId, display_name: "Bạn bè Connect", city: "Hồ sơ hiện không công khai" };
    friendsBox.append(makePersonCard({ ...profile, showPresence: true }, "Nhắn tin", () => openConversation(profile), profile.city || "Bạn bè Connect"));
  });
  await renderOnlineFriends();
}

async function respondRequest(row, status, button) {
  button.disabled = true;
  const { error } = await supabase.from("friend_requests").update({ status }).eq("id", row.id);
  if (error) {
    console.error("Respond friend request:", error);
    dmStatus.textContent = `Không cập nhật được lời mời: ${error.message}`;
    button.disabled = false;
    return;
  }
  await loadNetwork();
  if (status === "accepted") dmStatus.textContent = "Đã chấp nhận lời mời. Bạn có thể bắt đầu nhắn tin riêng.";
}

function renderMessage(message) {
  if (!message?.id || messageIds.has(message.id)) return;
  messageIds.add(message.id);
  const item = document.createElement("article");
  item.className = `dm-message ${message.sender_id === currentUser.id ? "is-mine" : "is-theirs"}`;
  const body = document.createElement("p"); body.textContent = message.body;
  const time = document.createElement("time");
  const date = new Date(message.created_at);
  time.dateTime = date.toISOString();
  time.textContent = date.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  item.append(body, time); dmMessages.append(item);
  dmMessages.scrollTop = dmMessages.scrollHeight;
}

async function openConversation(profile) {
  if (!profile?.id || profile.id === currentUser.id) return;
  activeFriend = profile;
  await supabase.from("notifications").update({ is_read: true })
    .eq("recipient_id", currentUser.id).eq("actor_id", profile.id)
    .eq("notification_type", "direct_message").eq("is_read", false);
  await loadNotifications();
  messageIds = new Set();
  $("dmTitle").textContent = safeText(profile.display_name);
  $("dmSubtitle").textContent = "Cuộc trò chuyện riêng tư · Chỉ hai bạn có quyền truy cập";
  dmMessages.replaceChildren();
  dmForm.hidden = false;
  dmStatus.textContent = "Đang tải tin nhắn…";
  if (messageChannel) {
    await supabase.removeChannel(messageChannel);
    messageChannel = null;
  }
  const { data, error } = await supabase.from("direct_messages")
    .select("id, sender_id, recipient_id, body, created_at")
    .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${profile.id}),and(sender_id.eq.${profile.id},recipient_id.eq.${currentUser.id})`)
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) {
    dmStatus.textContent = "Không tải được tin nhắn. Hãy kiểm tra 003_friend_system.sql và trạng thái kết bạn.";
    console.error("Load direct messages:", error);
    return;
  }
  (data || []).forEach(renderMessage);
  if (!data?.length) showEmpty(dmMessages, "Đây là cuộc trò chuyện mới. Hãy gửi lời chào đầu tiên!");
  dmStatus.textContent = "Tin nhắn được đồng bộ theo thời gian thực.";
  messageChannel = supabase.channel(`direct-${[currentUser.id, profile.id].sort().join("-")}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, payload => {
      const message = payload.new;
      if ((message.sender_id === currentUser.id && message.recipient_id === profile.id) || (message.sender_id === profile.id && message.recipient_id === currentUser.id)) {
        const empty = dmMessages.querySelector(".empty-state"); if (empty) empty.remove();
        renderMessage(message);
      }
    })
    .subscribe(status => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") dmStatus.textContent = "Kết nối realtime bị gián đoạn; bạn vẫn có thể thử gửi tin nhắn.";
    });
  dmPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  dmInput.focus();
}

function notificationIcon(type) {
  return ({ friend_request: "＋", friend_accepted: "✓", direct_message: "✉" })[type] || "•";
}

function formatRelativeTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Vừa xong";
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "Vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  return date.toLocaleDateString("vi-VN");
}

async function loadNotifications() {
  const list = $("notificationList");
  if (!list || !currentUser) return;
  const { data, error } = await supabase.from("notifications")
    .select("id, actor_id, notification_type, title, body, is_read, created_at")
    .eq("recipient_id", currentUser.id)
    .order("created_at", { ascending: false }).limit(40);
  if (error) {
    showEmpty(list, "Không tải được thông báo. Hãy chạy 009_notification_presence.sql trong Supabase.");
    $("notificationStatus").textContent = "";
    console.warn("Load notifications:", error);
    return;
  }
  const unread = (data || []).filter(item => !item.is_read).length;
  $("notificationUnreadCount").textContent = String(unread);
  list.replaceChildren();
  if (!data?.length) {
    showEmpty(list, "Bạn chưa có thông báo mới.");
    return;
  }
  const actors = await loadProfiles((data || []).map(item => item.actor_id).filter(Boolean)).catch(() => new Map());
  data.forEach(item => {
    const card = document.createElement("article");
    card.className = `notification-item${item.is_read ? " is-read" : " is-unread"}`;
    const icon = document.createElement("span"); icon.className = "notification-icon"; icon.textContent = notificationIcon(item.notification_type);
    const content = document.createElement("div"); content.className = "notification-copy";
    const title = document.createElement("strong"); title.textContent = item.title;
    const body = document.createElement("p"); body.textContent = item.body || "Bạn có một cập nhật mới trên Connect.";
    const time = document.createElement("time"); time.dateTime = item.created_at; time.textContent = formatRelativeTime(item.created_at);
    content.append(title, body, time);
    card.append(icon, content);
    const action = document.createElement("button"); action.type = "button"; action.className = "notification-open";
    action.textContent = item.notification_type === "direct_message" ? "Trò chuyện" : item.notification_type === "friend_request" ? "Xem lời mời" : "Xem bạn bè";
    action.addEventListener("click", async () => {
      if (!item.is_read) await supabase.from("notifications").update({ is_read: true }).eq("id", item.id);
      if (item.notification_type === "direct_message" && item.actor_id) {
        const profile = actors.get(item.actor_id);
        if (profile) await openConversation(profile);
        else $("notificationStatus").textContent = "Không thể mở cuộc trò chuyện này.";
      } else if (item.notification_type === "friend_request") {
        $("friendRequests").scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        $("friendsList").scrollIntoView({ behavior: "smooth", block: "center" });
      }
      await loadNotifications();
    });
    card.append(action);
    list.append(card);
  });
  $("notificationStatus").textContent = `${unread} thông báo chưa đọc · Tối đa 40 thông báo gần nhất.`;
}

async function markAllNotificationsRead() {
  const button = $("notificationMarkAll");
  button.disabled = true;
  const { error } = await supabase.from("notifications").update({ is_read: true })
    .eq("recipient_id", currentUser.id).eq("is_read", false);
  button.disabled = false;
  if (error) {
    $("notificationStatus").textContent = "Không thể cập nhật trạng thái thông báo.";
    console.error(error);
    return;
  }
  await loadNotifications();
}

async function refreshPresence() {
  if (!currentUser || !friendIds.length) {
    $("onlineFriendsCount").textContent = "0";
    return new Map();
  }
  const { data, error } = await supabase.from("user_presence")
    .select("user_id, last_seen").in("user_id", friendIds);
  if (error) {
    console.warn("Load friend presence:", error);
    return new Map();
  }
  const presence = new Map((data || []).map(row => [row.user_id, row.last_seen]));
  const onlineIds = new Set([...presence].filter(([, lastSeen]) => Date.now() - new Date(lastSeen).getTime() < 120000).map(([id]) => id));
  document.querySelectorAll("[data-presence-user]").forEach(node => {
    const online = onlineIds.has(node.dataset.presenceUser);
    node.textContent = online ? "● Đang trực tuyến" : "○ Không hoạt động";
    node.classList.toggle("is-online", online);
    node.classList.toggle("is-offline", !online);
  });
  return presence;
}

async function renderOnlineFriends() {
  const box = $("onlineFriendsList");
  if (!box) return;
  const presence = await refreshPresence();
  const online = [...presence].filter(([, lastSeen]) => Date.now() - new Date(lastSeen).getTime() < 120000).map(([id]) => id);
  $("onlineFriendsCount").textContent = String(online.length);
  box.replaceChildren();
  if (!online.length) {
    showEmpty(box, friendIds.length ? "Chưa có bạn bè nào đang trực tuyến." : "Kết bạn để xem trạng thái hoạt động của bạn bè.");
    return;
  }
  online.forEach(id => {
    const profile = friendProfiles.get(id) || { id, display_name: "Bạn bè Connect" };
    const card = makePersonCard({ ...profile, showPresence: true }, "Nhắn tin", () => openConversation(profile), "Đang trực tuyến");
    const status = card.querySelector(".person-presence");
    if (status) { status.textContent = "● Đang trực tuyến"; status.classList.add("is-online"); }
    box.append(card);
  });
}

function startRealtimeUpdates() {
  if (notificationChannel) supabase.removeChannel(notificationChannel);
  notificationChannel = supabase.channel(`notifications-${currentUser.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${currentUser.id}` }, () => loadNotifications())
    .subscribe();
  if (presenceChannel) supabase.removeChannel(presenceChannel);
  presenceChannel = supabase.channel(`friend-presence-${currentUser.id}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "user_presence" }, payload => {
      if (friendIds.includes(payload.new?.user_id) || friendIds.includes(payload.old?.user_id)) renderOnlineFriends();
    })
    .subscribe();
  if (presenceTimer) clearInterval(presenceTimer);
  presenceTimer = setInterval(renderOnlineFriends, 60000);
}

$("notificationMarkAll")?.addEventListener("click", markAllNotificationsRead);

searchForm?.addEventListener("submit", event => {
  event.preventDefault();
  runSearch(searchInput.value);
});
searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    if (searchInput.value.trim().length >= 2) runSearch(searchInput.value);
  }, 350);
});

dmForm?.addEventListener("submit", async event => {
  event.preventDefault();
  const body = dmInput.value.trim();
  if (!activeFriend || !body) return;
  const send = $("dmSend"); send.disabled = true;
  const { data, error } = await supabase.from("direct_messages").insert({
    sender_id: currentUser.id,
    recipient_id: activeFriend.id,
    body
  }).select("id, sender_id, recipient_id, body, created_at").single();
  send.disabled = false;
  if (error) {
    dmStatus.textContent = `Gửi tin nhắn thất bại: ${error.message}`;
    console.error("Send direct message:", error);
    return;
  }
  const empty = dmMessages.querySelector(".empty-state"); if (empty) empty.remove();
  renderMessage(data);
  dmInput.value = "";
  dmInput.focus();
});

async function init() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    window.location.href = "login.html?next=friends.html";
    return;
  }
  currentUser = data.user;
  await loadNetwork();
  await loadNotifications();
  startRealtimeUpdates();
  const params = new URLSearchParams(window.location.search);
  const friendId = params.get("with");
  if (friendId && friendId !== currentUser.id) {
    try {
      const profiles = await loadProfiles([friendId]);
      const profile = profiles.get(friendId);
      if (profile) openConversation(profile);
    } catch (error) { console.warn("Could not open requested conversation:", error); }
  }
}

init();
$("blockedBtn")?.addEventListener("click", openBlockedDialog);
