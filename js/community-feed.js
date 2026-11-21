import { supabase } from './supabase.js';
import { reportContent, blockUser, getBlockedIds } from './safety.js';

const postForm = document.getElementById('communityPostForm');
const postBody = document.getElementById('communityPostBody');
const postSubmit = document.getElementById('communityPostSubmit');
const postList = document.getElementById('communityPostList');
const feedStatus = document.getElementById('communityFeedStatus');
const feedAccess = document.getElementById('communityFeedAccess');
const feedTitle = document.getElementById('communityFeedTitle');
const notificationButton = document.getElementById('communityNotificationButton');
const notificationCount = document.getElementById('communityNotificationCount');
const notificationPanel = document.getElementById('communityNotifications');
const notificationList = document.getElementById('communityNotificationList');
const markNotificationsRead = document.getElementById('communityMarkNotificationsRead');
const communities = {
  tech: 'Tech Planet', art: 'Art Planet', music: 'Music Planet',
  nature: 'Nature Planet', books: 'Book Planet', sport: 'Sport Planet'
};
let selectedCommunity = null;
let activeUser = null;
let memberOf = new Set();
let feedReady = false;
let loadToken = 0;
let notificationRows = [];
let blockedIds = new Set();

const formatDate = value => new Intl.DateTimeFormat('vi-VN', {
  dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(value));

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function setFeedEnabled(enabled) {
  if (postBody) postBody.disabled = !enabled;
  if (postSubmit) postSubmit.disabled = !enabled;
  if (feedAccess) feedAccess.textContent = enabled ? 'Bạn là thành viên' : 'Dành cho thành viên';
  if (postForm) postForm.hidden = !enabled;
  if (notificationButton) notificationButton.disabled = !activeUser;
}

function renderComments(container, comments) {
  const area = element('div', 'community-comments');
  if (!comments.length) area.appendChild(element('p', 'community-no-comments', 'Chưa có bình luận. Hãy bắt đầu cuộc trò chuyện nhé.'));
  comments.filter(comment => !blockedIds.has(comment.author_id)).forEach(comment => {
    const row = element('div', 'community-comment');
    const meta = element('div', 'community-comment-meta');
    meta.append(element('strong', '', comment.authorName), element('time', '', formatDate(comment.created_at)));
    if (activeUser && comment.author_id !== activeUser.id) {
      const report = element('button', 'safety-link', 'Báo cáo');
      report.type = 'button';
      report.addEventListener('click', () => reportContent('community_comment', comment.id, 'Báo cáo bình luận'));
      meta.appendChild(report);
    }
    row.append(meta, element('p', '', comment.body));
    area.appendChild(row);
  });
  container.replaceChildren(area);
}

async function loadComments(post, host, token) {
  const result = await supabase.from('community_comments').select('id,author_id,body,created_at')
    .eq('post_id', post.id).order('created_at', { ascending: true }).limit(50);
  if (token !== loadToken) return;
  if (result.error) throw result.error;
  const ids = [...new Set((result.data || []).map(item => item.author_id))];
  let profiles = [];
  if (ids.length) {
    const profileResult = await supabase.from('profiles').select('id,display_name').in('id', ids);
    if (profileResult.error) throw profileResult.error;
    profiles = profileResult.data || [];
  }
  const names = new Map(profiles.map(profile => [profile.id, profile.display_name || 'Thành viên Connect']));
  const comments = (result.data || []).map(item => ({ ...item, authorName: names.get(item.author_id) || 'Thành viên Connect' }));
  renderComments(host, comments);
}

async function refreshPostLikes(post, button, countLabel) {
  const { data, error } = await supabase.from('community_post_likes').select('user_id')
    .eq('post_id', post.id);
  if (error) throw error;
  const rows = data || [];
  countLabel.textContent = `${rows.length} lượt thích`;
  button.textContent = rows.some(row => row.user_id === activeUser?.id) ? '♥ Đã thích' : '♡ Thích';
  button.classList.toggle('is-liked', rows.some(row => row.user_id === activeUser?.id));
  button.setAttribute('aria-pressed', String(rows.some(row => row.user_id === activeUser?.id)));
  button.disabled = !activeUser || !memberOf.has(selectedCommunity);
}

function renderPost(post, authorName, token, initialLikes) {
  const card = element('article', 'community-post');
  const header = element('div', 'community-post-header');
  const author = element('div', 'community-post-author');
  const avatar = element('span', 'community-post-avatar', (authorName || 'C').trim().charAt(0).toLocaleUpperCase('vi-VN'));
  const authorInfo = element('div', '');
  authorInfo.append(element('strong', '', authorName || 'Thành viên Connect'), element('time', '', formatDate(post.created_at)));
  author.append(avatar, authorInfo);
  header.appendChild(author);
  if (post.author_id === activeUser?.id) {
    const remove = element('button', 'community-post-delete', 'Xóa');
    remove.type = 'button';
    remove.addEventListener('click', async () => {
      if (!window.confirm('Bạn có chắc muốn xóa bài đăng này?')) return;
      remove.disabled = true;
      const { error } = await supabase.from('community_posts').delete().eq('id', post.id);
      if (error) {
        feedStatus.textContent = 'Không thể xóa bài đăng. Vui lòng thử lại.';
        remove.disabled = false;
        return;
      }
      card.remove();
      feedStatus.textContent = 'Đã xóa bài đăng.';
    });
    header.appendChild(remove);
  } else if (activeUser) {
    const report = element('button', 'safety-link', '⚑ Báo cáo');
    report.type = 'button';
    report.addEventListener('click', () => reportContent('community_post', post.id, 'Báo cáo bài đăng'));
    const block = element('button', 'safety-link', '🚫 Chặn');
    block.type = 'button';
    block.addEventListener('click', async () => {
      if (await blockUser(post.author_id, authorName || 'thành viên này')) { blockedIds.add(post.author_id); card.remove(); }
    });
    header.append(report, block);
  }

  const body = element('p', 'community-post-body', post.body);
  const actions = element('div', 'community-post-actions');
  const likeButton = element('button', 'community-like-button', '♡ Thích');
  likeButton.type = 'button';
  const likeCount = element('span', 'community-like-count', `${initialLikes.length} lượt thích`);
  const liked = initialLikes.some(row => row.user_id === activeUser?.id);
  likeButton.textContent = liked ? '♥ Đã thích' : '♡ Thích';
  likeButton.classList.toggle('is-liked', liked);
  likeButton.setAttribute('aria-pressed', String(liked));
  likeButton.disabled = !activeUser || !memberOf.has(selectedCommunity);
  likeButton.addEventListener('click', async () => {
    if (!activeUser || !memberOf.has(selectedCommunity)) return;
    likeButton.disabled = true;
    try {
      const isLiked = likeButton.getAttribute('aria-pressed') === 'true';
      const result = isLiked
        ? await supabase.from('community_post_likes').delete().eq('post_id', post.id).eq('user_id', activeUser.id)
        : await supabase.from('community_post_likes').insert({ post_id: post.id, user_id: activeUser.id });
      if (result.error && result.error.code !== '23505') throw result.error;
      await refreshPostLikes(post, likeButton, likeCount);
    } catch (error) {
      console.warn('Like update failed:', error);
      feedStatus.textContent = 'Chưa cập nhật được lượt thích. Hãy kiểm tra 005_community_interactions.sql.';
    } finally {
      likeButton.disabled = !activeUser || !memberOf.has(selectedCommunity);
    }
  });
  actions.append(likeButton, likeCount);

  const commentToggle = element('button', 'community-comment-toggle', 'Xem bình luận');
  commentToggle.type = 'button';
  const commentArea = element('div', 'community-comment-area');
  commentArea.hidden = true;
  commentToggle.addEventListener('click', async () => {
    commentArea.hidden = !commentArea.hidden;
    if (!commentArea.hidden && !commentArea.dataset.loaded) {
      commentArea.textContent = 'Đang tải bình luận…';
      try {
        await loadComments(post, commentArea, token);
        commentArea.dataset.loaded = 'true';
      } catch (error) {
        console.warn('Load comments failed:', error);
        commentArea.textContent = 'Không thể tải bình luận. Vui lòng kiểm tra cấu hình 004_community_feed.sql.';
      }
    }
  });
  const commentForm = element('form', 'community-comment-form');
  const input = element('input', '');
  input.type = 'text'; input.maxLength = 1000; input.placeholder = 'Viết bình luận…'; input.required = true;
  input.setAttribute('aria-label', 'Nội dung bình luận');
  const submit = element('button', '', 'Gửi'); submit.type = 'submit';
  commentForm.append(input, submit);
  commentForm.addEventListener('submit', async event => {
    event.preventDefault();
    if (!activeUser || !memberOf.has(selectedCommunity)) return;
    const value = input.value.trim();
    if (!value) return;
    submit.disabled = true;
    const { error } = await supabase.from('community_comments').insert({
      post_id: post.id, community_id: selectedCommunity, author_id: activeUser.id, body: value
    });
    submit.disabled = false;
    if (error) {
      feedStatus.textContent = 'Chưa gửi được bình luận. Vui lòng thử lại.';
      return;
    }
    input.value = '';
    commentArea.dataset.loaded = '';
    try { await loadComments(post, commentArea, token); commentArea.dataset.loaded = 'true'; }
    catch (loadError) { console.warn(loadError); }
    loadNotifications();
  });
  card.append(header, body, actions, commentToggle, commentArea, commentForm);
  return card;
}

function renderNotifications(rows, names) {
  if (!notificationList) return;
  notificationList.replaceChildren();
  if (!rows.length) {
    notificationList.appendChild(element('p', 'community-notification-empty', 'Chưa có thông báo mới.'));
    return;
  }
  rows.forEach(item => {
    const row = element('div', `community-notification-item${item.read_at ? '' : ' is-unread'}`);
    const actor = names.get(item.actor_id) || 'Một thành viên';
    const message = item.notification_type === 'like' ? 'đã thích bài viết của bạn' : 'đã bình luận bài viết của bạn';
    row.append(element('strong', '', actor), element('span', '', ` ${message} · ${communities[item.community_id] || 'Connect'}`), element('time', '', formatDate(item.created_at)));
    notificationList.appendChild(row);
  });
}

async function loadNotifications() {
  if (!activeUser || !notificationList) {
    notificationRows = [];
    if (notificationCount) notificationCount.textContent = '0';
    if (notificationList) notificationList.replaceChildren(element('p', '', 'Đăng nhập để xem thông báo.'));
    return;
  }
  const { data, error } = await supabase.from('community_notifications')
    .select('id,actor_id,community_id,post_id,notification_type,created_at,read_at')
    .eq('recipient_id', activeUser.id).order('created_at', { ascending: false }).limit(30);
  if (error) {
    console.warn('Notifications unavailable:', error);
    notificationList.replaceChildren(element('p', '', 'Chưa bật thông báo. Hãy chạy 005_community_interactions.sql trong Supabase.'));
    return;
  }
  notificationRows = data || [];
  const unread = notificationRows.filter(item => !item.read_at).length;
  if (notificationCount) notificationCount.textContent = String(unread);
  const actorIds = [...new Set(notificationRows.map(item => item.actor_id).filter(Boolean))];
  let profiles = [];
  if (actorIds.length) {
    const result = await supabase.from('profiles').select('id,display_name').in('id', actorIds);
    if (!result.error) profiles = result.data || [];
  }
  renderNotifications(notificationRows, new Map(profiles.map(profile => [profile.id, profile.display_name || 'Thành viên Connect'])));
}

async function loadFeed(communityId) {
  selectedCommunity = communityId;
  window.dispatchEvent(new CustomEvent('connect:community-selected', { detail: { communityId } }));
  const token = ++loadToken;
  if (feedTitle) feedTitle.textContent = `Bảng tin ${communities[communityId] || 'cộng đồng'}`;
  if (postList) postList.replaceChildren();
  if (!communityId) return;
  const authResult = await supabase.auth.getUser();
  if (token !== loadToken) return;
  activeUser = authResult.data?.user || null;
  memberOf = new Set();
  if (activeUser) {
    const memberships = await supabase.from('community_members').select('community_id').eq('user_id', activeUser.id);
    if (memberships.error) {
      feedReady = false; setFeedEnabled(false);
      feedStatus.textContent = 'Chưa thể kiểm tra thành viên. Hãy chạy 002_community_members.sql trước.';
      return;
    }
    (memberships.data || []).forEach(row => memberOf.add(row.community_id));
  }
  const isMember = Boolean(activeUser && memberOf.has(communityId));
  setFeedEnabled(isMember);
  if (!activeUser) feedStatus.textContent = 'Đăng nhập và tham gia hành tinh để đọc, đăng bài và bình luận.';
  else if (!isMember) feedStatus.textContent = 'Hãy tham gia hành tinh để xem bảng tin và trò chuyện cùng cộng đồng.';
  else feedStatus.textContent = 'Đang tải bài đăng…';
  loadNotifications();
  if (!isMember) { feedReady = true; return; }
  blockedIds = await getBlockedIds();
  const { data: rawPosts, error } = await supabase.from('community_posts')
    .select('id,community_id,author_id,body,created_at').eq('community_id', communityId)
    .order('created_at', { ascending: false }).limit(30);
  const posts = (rawPosts || []).filter(post => !blockedIds.has(post.author_id));
  if (token !== loadToken) return;
  if (error) {
    feedReady = false;
    feedStatus.textContent = 'Chưa tải được bảng tin. Hãy chạy supabase/migrations/004_community_feed.sql trong Supabase.';
    return;
  }
  const postIds = (posts || []).map(post => post.id);
  let likes = [];
  if (postIds.length) {
    const likesResult = await supabase.from('community_post_likes').select('post_id,user_id').in('post_id', postIds);
    if (likesResult.error) {
      console.warn('Likes unavailable:', likesResult.error);
      feedStatus.textContent = 'Bảng tin đã tải; cần chạy 005_community_interactions.sql để bật lượt thích.';
    } else likes = likesResult.data || [];
  }
  const authorIds = [...new Set((posts || []).map(post => post.author_id))];
  let profiles = [];
  if (authorIds.length) {
    const result = await supabase.from('profiles').select('id,display_name').in('id', authorIds);
    if (result.error) console.warn('Profile names unavailable:', result.error);
    profiles = result.data || [];
  }
  if (token !== loadToken) return;
  const names = new Map(profiles.map(profile => [profile.id, profile.display_name || 'Thành viên Connect']));
  if (!posts?.length) {
    postList.appendChild(element('p', 'community-feed-empty', 'Chưa có bài đăng nào. Hãy là người chia sẻ đầu tiên!'));
  } else {
    posts.forEach(post => postList.appendChild(renderPost(post, names.get(post.author_id) || 'Thành viên Connect', token, likes.filter(like => like.post_id === post.id))));
  }
  feedStatus.textContent = `Hiển thị ${posts?.length || 0} bài đăng gần đây.`;
  feedReady = true;
}

postForm?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!feedReady || !selectedCommunity || !activeUser || !memberOf.has(selectedCommunity)) return;
  const body = postBody.value.trim();
  if (!body) { postBody.focus(); return; }
  postSubmit.disabled = true;
  postSubmit.textContent = 'Đang đăng…';
  const { error } = await supabase.from('community_posts').insert({ community_id: selectedCommunity, author_id: activeUser.id, body });
  postSubmit.disabled = false;
  postSubmit.textContent = 'Đăng bài';
  if (error) {
    feedStatus.textContent = 'Đăng bài thất bại. Kiểm tra kết nối và chính sách Supabase.';
    return;
  }
  postBody.value = '';
  feedStatus.textContent = 'Đã đăng bài thành công.';
  await loadFeed(selectedCommunity);
});

notificationButton?.addEventListener('click', async () => {
  const willOpen = notificationPanel.hidden;
  notificationPanel.hidden = !willOpen;
  notificationButton.setAttribute('aria-expanded', String(willOpen));
  if (willOpen) await loadNotifications();
});
markNotificationsRead?.addEventListener('click', async () => {
  if (!activeUser) return;
  const { error } = await supabase.from('community_notifications').update({ read_at: new Date().toISOString() })
    .eq('recipient_id', activeUser.id).is('read_at', null);
  if (error) {
    notificationList.prepend(element('p', 'community-notification-error', 'Không thể cập nhật trạng thái đã đọc.'));
    return;
  }
  await loadNotifications();
});

document.querySelectorAll('[data-community]').forEach(card => card.addEventListener('click', () => loadFeed(card.dataset.community)));
window.addEventListener('connect:community-membership-changed', event => {
  if (event.detail?.communityId === selectedCommunity) loadFeed(selectedCommunity);
});
supabase.auth.onAuthStateChange((_event, session) => {
  window.setTimeout(() => {
    activeUser = session?.user || null;
    if (selectedCommunity) loadFeed(selectedCommunity);
    else loadNotifications();
  }, 0);
});
