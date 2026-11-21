import { supabase } from './supabase.js';

const root = document.getElementById('communityChat');
const messagesBox = document.getElementById('communityChatMessages');
const form = document.getElementById('communityChatForm');
const input = document.getElementById('communityChatInput');
const sendButton = document.getElementById('communityChatSend');
const statusLine = document.getElementById('communityChatStatus');
const onlineLine = document.getElementById('communityChatOnline');
const onlineList = document.getElementById('communityChatOnlineList');
const chatTitle = document.getElementById('communityChatTitle');
const emojiBar = document.getElementById('communityChatEmojiBar');

let currentUser = null;
let currentCommunity = null;
let channel = null;
let isMember = false;
let loadingToken = 0;
let knownMessageIds = new Set();
let currentDisplayName = 'Thành viên Connect';

const communityNames = {
  tech: 'Tech Planet', art: 'Art Planet', music: 'Music Planet',
  nature: 'Nature Planet', books: 'Book Planet', sport: 'Sport Planet'
};
const dateTime = value => new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short' }).format(new Date(value));

function make(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function showMessage(message, kind = '') {
  if (!statusLine) return;
  statusLine.textContent = message;
  statusLine.dataset.kind = kind;
}

function renderMessage(row, authorName) {
  if (!messagesBox || knownMessageIds.has(row.id)) return;
  messagesBox.querySelector('.community-chat-empty')?.remove();
  knownMessageIds.add(row.id);
  const item = make('article', `community-chat-message${row.user_id === currentUser?.id ? ' is-mine' : ''}`);
  const avatar = make('span', 'community-chat-avatar', (authorName || 'C').trim().charAt(0).toLocaleUpperCase('vi-VN'));
  const content = make('div', 'community-chat-message-content');
  const meta = make('div', 'community-chat-message-meta');
  meta.append(make('strong', '', authorName || 'Thành viên Connect'), make('time', '', dateTime(row.created_at)));
  content.append(meta, make('p', '', row.body));
  item.append(avatar, content);
  messagesBox.appendChild(item);
  while (messagesBox.children.length > 100) messagesBox.firstElementChild.remove();
  messagesBox.scrollTop = messagesBox.scrollHeight;
}

async function resolveNames(rows) {
  const ids = [...new Set(rows.map(row => row.user_id).filter(Boolean))];
  if (!ids.length) return new Map();
  const { data, error } = await supabase.from('profiles').select('id,display_name').in('id', ids);
  if (error) throw error;
  return new Map((data || []).map(profile => [profile.id, profile.display_name || 'Thành viên Connect']));
}

function renderOnline() {
  if (!channel || !onlineList) return;
  const state = channel.presenceState();
  const people = [];
  Object.values(state).forEach(entries => entries.forEach(entry => {
    if (entry?.user_id && !people.some(person => person.user_id === entry.user_id)) people.push(entry);
  }));
  onlineList.replaceChildren();
  people.slice(0, 8).forEach(person => {
    const chip = make('span', 'community-chat-online-person', (person.display_name || 'Thành viên').slice(0, 18));
    chip.title = person.display_name || 'Thành viên Connect';
    onlineList.appendChild(chip);
  });
  if (onlineLine) onlineLine.textContent = `${people.length} đang trong phòng`;
}

async function disconnect() {
  const old = channel;
  channel = null;
  if (old) {
    try { await supabase.removeChannel(old); } catch (error) { console.warn('Chat channel cleanup:', error); }
  }
}

function setChatEnabled(enabled) {
  if (input) input.disabled = !enabled;
  if (sendButton) sendButton.disabled = !enabled;
  if (emojiBar) emojiBar.querySelectorAll('button').forEach(button => { button.disabled = !enabled; });
  if (form) form.hidden = !enabled;
}

async function loadChat(communityId) {
  const token = ++loadingToken;
  currentCommunity = communityId || null;
  await disconnect();
  knownMessageIds = new Set();
  if (messagesBox) messagesBox.replaceChildren();
  if (onlineList) onlineList.replaceChildren();
  if (!root || !communityId) { if (root) root.hidden = true; return; }
  root.hidden = false;
  if (chatTitle) chatTitle.textContent = `Phòng trò chuyện · ${communityNames[communityId] || 'Connect'}`;

  const auth = await supabase.auth.getUser();
  if (token !== loadingToken) return;
  currentUser = auth.data?.user || null;
  if (!currentUser) {
    isMember = false;
    setChatEnabled(false);
    showMessage('Đăng nhập và tham gia hành tinh để sử dụng phòng chat.');
    return;
  }
  const membership = await supabase.from('community_members').select('community_id')
    .eq('user_id', currentUser.id).eq('community_id', communityId).maybeSingle();
  if (token !== loadingToken) return;
  if (membership.error) {
    setChatEnabled(false);
    showMessage('Không thể kiểm tra thành viên. Hãy chạy 002_community_members.sql.', 'error');
    return;
  }
  isMember = Boolean(membership.data);
  if (!isMember) {
    setChatEnabled(false);
    showMessage('Tham gia hành tinh để mở khóa phòng trò chuyện.');
    if (messagesBox) messagesBox.appendChild(make('p', 'community-chat-empty', 'Phòng chat chỉ dành cho thành viên của hành tinh này.'));
    return;
  }

  setChatEnabled(true);
  showMessage(`Đang kết nối phòng ${communityNames[communityId] || 'cộng đồng'}…`);
  const { data: history, error: historyError } = await supabase.from('community_messages')
    .select('id,user_id,body,created_at').eq('community_id', communityId)
    .order('created_at', { ascending: false }).limit(60);
  if (token !== loadingToken) return;
  if (historyError) {
    setChatEnabled(false);
    showMessage('Chưa tải được tin nhắn. Hãy chạy supabase/migrations/006_community_chat.sql.', 'error');
    return;
  }
  const ordered = (history || []).reverse();
  try {
    const names = await resolveNames(ordered);
    ordered.forEach(row => renderMessage(row, names.get(row.user_id)));
  } catch (error) {
    console.warn('Chat profile lookup:', error);
    ordered.forEach(row => renderMessage(row, 'Thành viên Connect'));
  }
  if (!ordered.length && messagesBox) messagesBox.appendChild(make('p', 'community-chat-empty', 'Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện!'));

  const { data: myProfile } = await supabase.from('profiles').select('display_name').eq('id', currentUser.id).maybeSingle();
  currentDisplayName = myProfile?.display_name || 'Thành viên Connect';
  if (token !== loadingToken) return;

  const room = supabase.channel(`community-chat:${communityId}`, {
    config: { presence: { key: currentUser.id } }
  });
  channel = room;
  room.on('postgres_changes', {
    event: 'INSERT', schema: 'public', table: 'community_messages', filter: `community_id=eq.${communityId}`
  }, async payload => {
    if (token !== loadingToken || !payload.new || knownMessageIds.has(payload.new.id)) return;
    let name = 'Thành viên Connect';
    if (payload.new.user_id === currentUser.id) name = currentDisplayName;
    else {
      try {
        const names = await resolveNames([payload.new]);
        name = names.get(payload.new.user_id) || name;
      } catch (error) { console.warn('Chat author lookup:', error); }
    }
    renderMessage(payload.new, name);
  });
  room.on('presence', { event: 'sync' }, renderOnline);
  room.subscribe(async state => {
    if (token !== loadingToken) return;
    if (state === 'SUBSCRIBED') {
      showMessage(`Bạn đang trò chuyện tại ${communityNames[communityId] || 'cộng đồng'}.`, 'success');
      await room.track({ user_id: currentUser.id, display_name: currentDisplayName, online_at: new Date().toISOString() });
      renderOnline();
    } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
      showMessage('Chat chưa kết nối thời gian thực. Kiểm tra Realtime trong Supabase.', 'error');
    }
  });
}

form?.addEventListener('submit', async event => {
  event.preventDefault();
  if (!currentUser || !currentCommunity || !isMember) return;
  const body = input.value.trim();
  if (!body) return;
  sendButton.disabled = true;
  const { error } = await supabase.from('community_messages').insert({
    community_id: currentCommunity, user_id: currentUser.id, body
  });
  sendButton.disabled = false;
  if (error) {
    showMessage('Gửi tin nhắn thất bại. Kiểm tra kết nối và chính sách RLS.', 'error');
    return;
  }
  input.value = '';
  input.focus();
});

emojiBar?.addEventListener('click', event => {
  const button = event.target.closest('button[data-emoji]');
  if (!button || !input || input.disabled) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.setRangeText(button.dataset.emoji, start, end, 'end');
  input.focus();
});

window.addEventListener('connect:community-selected', event => loadChat(event.detail?.communityId));
window.addEventListener('connect:community-membership-changed', event => {
  if (event.detail?.communityId === currentCommunity) loadChat(currentCommunity);
});
supabase.auth.onAuthStateChange((_event, session) => {
  window.setTimeout(() => {
    currentUser = session?.user || null;
    if (currentCommunity) loadChat(currentCommunity);
  }, 0);
});
