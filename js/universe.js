import { supabase } from './supabase.js';

const communities = {
  tech: { name: 'Tech Planet', subtitle: 'Công nghệ · Lập trình · AI', description: 'Dành cho những người yêu công nghệ, lập trình, trí tuệ nhân tạo và khám phá ý tưởng mới.', keys: ['công nghệ','technology','tech','lập trình','programming','code','coding','ai','trí tuệ nhân tạo','máy tính','developer','software','phần mềm'] },
  art: { name: 'Art Planet', subtitle: 'Nghệ thuật · Thiết kế · Nhiếp ảnh', description: 'Không gian chia sẻ sáng tạo, hội họa, thiết kế, vẽ và nhiếp ảnh.', keys: ['nghệ thuật','art','thiết kế','design','vẽ','drawing','hội họa','nhiếp ảnh','photography','creative','sáng tạo'] },
  music: { name: 'Music Planet', subtitle: 'Âm nhạc · Ca hát · Nhạc cụ', description: 'Gặp gỡ người yêu âm nhạc, ca hát, sáng tác và chơi nhạc cụ.', keys: ['âm nhạc','music','ca hát','singing','hát','nhạc cụ','guitar','piano','sáng tác','song'] },
  nature: { name: 'Nature Planet', subtitle: 'Thiên nhiên · Du lịch · Môi trường', description: 'Kết nối những người yêu thiên nhiên, khám phá, du lịch và bảo vệ môi trường.', keys: ['thiên nhiên','nature','du lịch','travel','môi trường','environment','cắm trại','camping','cây cối','outdoor'] },
  books: { name: 'Book Planet', subtitle: 'Đọc sách · Truyện · Viết lách', description: 'Một góc dành cho độc giả, người mê truyện, sách và viết lách.', keys: ['đọc sách','sách','book','reading','đọc truyện','truyện','novel','viết lách','writing','literature','văn học'] },
  sport: { name: 'Sport Planet', subtitle: 'Thể thao · Bóng đá · Chạy bộ', description: 'Tìm đồng đội cùng yêu vận động, thể thao, bóng đá và các hoạt động ngoài trời.', keys: ['thể thao','sport','sports','bóng đá','football','soccer','chạy bộ','running','cầu lông','badminton','gym','bơi'] }
};

const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('vi-VN').trim();
const tagMatches = (tag, keys) => {
  const value = normalize(tag);
  return keys.some(key => value.includes(normalize(key)) || normalize(key).includes(value));
};
const cards = [...document.querySelectorAll('[data-community]')];
const detail = document.getElementById('universeDetail');
const detailTitle = document.getElementById('universeDetailTitle');
const detailText = document.getElementById('universeDetailText');
const status = document.getElementById('universeStatus');
const explore = document.getElementById('universeExploreBtn');
const joinButton = document.getElementById('universeJoinBtn');
const membersBox = document.getElementById('universeMembers');
const joinedCount = document.getElementById('universeJoinedCount');
let profiles = [];
let activeCommunity = null;
let currentUser = null;
let membershipAvailable = true;
let joinedCommunities = new Set();

function countFor(community) {
  return profiles.filter(profile => (profile.interests || []).some(tag => tagMatches(tag, community.keys))).length;
}
function setMembersMessage(message) {
  if (membersBox) {
    const span = document.createElement('span');
    span.textContent = message;
    membersBox.replaceChildren(span);
  }
}
function renderMembers(members) {
  if (!membersBox) return;
  membersBox.replaceChildren();
  const heading = document.createElement('strong');
  heading.className = 'universe-members-heading';
  heading.textContent = 'Thành viên đã tham gia';
  membersBox.appendChild(heading);
  if (!members.length) {
    const empty = document.createElement('span');
    empty.textContent = 'Chưa có thành viên công khai trong cộng đồng này.';
    membersBox.appendChild(empty);
    return;
  }
  const list = document.createElement('div');
  list.className = 'universe-member-list';
  members.forEach(member => {
    const item = document.createElement('div');
    item.className = 'universe-member-chip';
    const initial = document.createElement('span');
    initial.className = 'universe-member-initial';
    initial.textContent = (member.display_name || 'T').trim().charAt(0).toLocaleUpperCase('vi-VN');
    const name = document.createElement('span');
    name.textContent = member.display_name || 'Thành viên Connect';
    item.append(initial, name);
    list.appendChild(item);
  });
  membersBox.appendChild(list);
}

async function loadMembershipState() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  currentUser = data?.user || null;
  joinedCommunities = new Set();
  if (!currentUser) return;
  const result = await supabase.from('community_members').select('community_id').eq('user_id', currentUser.id);
  if (result.error) {
    if (result.error.code === '42P01' || /community_members/i.test(result.error.message || '')) membershipAvailable = false;
    throw result.error;
  }
  (result.data || []).forEach(row => joinedCommunities.add(row.community_id));
}

async function loadCommunityMembers(communityId) {
  if (!membershipAvailable) {
    setMembersMessage('Cần chạy tệp supabase/community_members.sql trong Supabase để bật danh sách thành viên.');
    if (joinedCount) joinedCount.textContent = '';
    return;
  }
  const { data: memberships, error } = await supabase.from('community_members')
    .select('user_id,joined_at').eq('community_id', communityId).order('joined_at', { ascending: false }).limit(60);
  if (error) throw error;
  const ids = (memberships || []).map(row => row.user_id);
  if (joinedCount) joinedCount.textContent = `${ids.length} người đã tham gia`;
  if (!ids.length) { renderMembers([]); return; }
  const { data: visibleProfiles, error: profileError } = await supabase.from('profiles')
    .select('id,display_name').eq('is_visible', true).in('id', ids);
  if (profileError) throw profileError;
  const byId = new Map((visibleProfiles || []).map(profile => [profile.id, profile]));
  renderMembers(ids.map(id => byId.get(id)).filter(Boolean));
}

function updateJoinButton() {
  if (!joinButton) return;
  if (!currentUser) {
    joinButton.textContent = 'Đăng nhập để tham gia';
    joinButton.disabled = false;
    joinButton.dataset.action = 'login';
  } else if (!membershipAvailable) {
    joinButton.textContent = 'Cần cấu hình Supabase';
    joinButton.disabled = true;
    joinButton.dataset.action = '';
  } else {
    const joined = joinedCommunities.has(activeCommunity);
    joinButton.textContent = joined ? 'Rời cộng đồng' : '＋ Tham gia cộng đồng';
    joinButton.classList.toggle('is-joined', joined);
    joinButton.disabled = false;
    joinButton.dataset.action = joined ? 'leave' : 'join';
  }
}

async function chooseCommunity(id) {
  const community = communities[id];
  if (!community) return;
  activeCommunity = id;
  cards.forEach(card => card.classList.toggle('is-active', card.dataset.community === id));
  detail.hidden = false;
  detailTitle.textContent = community.name;
  detailText.textContent = `${community.description} Có ${countFor(community)} hồ sơ công khai phù hợp theo sở thích.`;
  explore.dataset.community = id;
  updateJoinButton();
  setMembersMessage('Đang tải thành viên cộng đồng…');
  try {
    await loadCommunityMembers(id);
    updateJoinButton();
  } catch (error) {
    console.warn('Không thể tải thành viên cộng đồng:', error);
    setMembersMessage('Không tải được danh sách. Kiểm tra đăng nhập, kết nối và chính sách RLS trong Supabase.');
  }
}

cards.forEach(card => card.addEventListener('click', () => chooseCommunity(card.dataset.community)));

joinButton?.addEventListener('click', async () => {
  if (!activeCommunity || joinButton.disabled) return;
  if (!currentUser) {
    status.textContent = 'Bạn cần đăng nhập Connect trước khi tham gia cộng đồng.';
    document.getElementById('auth')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  const action = joinButton.dataset.action;
  joinButton.disabled = true;
  joinButton.textContent = action === 'leave' ? 'Đang rời cộng đồng…' : 'Đang tham gia…';
  try {
    if (action === 'leave') {
      const { error } = await supabase.from('community_members').delete()
        .eq('community_id', activeCommunity).eq('user_id', currentUser.id);
      if (error) throw error;
      joinedCommunities.delete(activeCommunity);
      status.textContent = `Bạn đã rời ${communities[activeCommunity].name}.`;
    } else {
      const { error } = await supabase.from('community_members').insert({ community_id: activeCommunity, user_id: currentUser.id });
      if (error && error.code !== '23505') throw error;
      joinedCommunities.add(activeCommunity);
      status.textContent = `Bạn đã tham gia ${communities[activeCommunity].name}.`;
    }
    await loadCommunityMembers(activeCommunity);
    window.dispatchEvent(new CustomEvent('connect:community-membership-changed', {
      detail: { communityId: activeCommunity }
    }));
  } catch (error) {
    console.error('Không thể cập nhật thành viên:', error);
    status.textContent = 'Chưa thể cập nhật thành viên. Hãy kiểm tra bảng community_members và chính sách RLS trong Supabase.';
  } finally {
    updateJoinButton();
  }
});

explore?.addEventListener('click', () => {
  if (!activeCommunity) return;
  const community = communities[activeCommunity];
  const select = document.getElementById('planet3dInterestFilter');
  const search = document.getElementById('planet3dSearch');
  const matchingTag = profiles.flatMap(profile => profile.interests || []).find(tag => tagMatches(tag, community.keys));
  if (matchingTag && select) {
    const option = [...select.options].find(item => normalize(item.value) === normalize(matchingTag));
    if (option) { select.value = option.value; select.dispatchEvent(new Event('change', { bubbles: true })); }
    else if (search) { search.value = matchingTag; search.dispatchEvent(new Event('input', { bubbles: true })); }
  } else if (search) {
    search.value = community.keys[0];
    search.dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.getElementById('planet3d')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

async function loadCommunities() {
  try {
    const { data, error } = await supabase.from('profiles').select('id,interests').eq('is_visible', true).limit(500);
    if (error) throw error;
    profiles = data || [];
    cards.forEach(card => {
      const community = communities[card.dataset.community];
      const count = card.querySelector('.universe-member-count');
      if (count) count.textContent = `${countFor(community)} hồ sơ cùng sở thích`;
    });
    try { await loadMembershipState(); }
    catch (membershipError) {
      console.warn('Chưa tải được trạng thái tham gia cộng đồng:', membershipError);
      if (/community_members/i.test(membershipError.message || '')) membershipAvailable = false;
    }
    status.textContent = `Đã đồng bộ ${profiles.length} hồ sơ công khai. Chọn hành tinh để xem thành viên và tham gia cộng đồng.`;
    if (activeCommunity) updateJoinButton();
  } catch (error) {
    console.warn('Không thể tải số lượng cộng đồng:', error);
    cards.forEach(card => {
      const count = card.querySelector('.universe-member-count');
      if (count) count.textContent = 'Chưa tải được dữ liệu';
    });
    status.textContent = 'Không thể đồng bộ dữ liệu. Bạn vẫn có thể khám phá các hành tinh.';
  }
}

supabase.auth.onAuthStateChange((_event, session) => {
  // Defer Supabase queries until after the auth callback has released its internal lock.
  setTimeout(async () => {
    currentUser = session?.user || null;
    joinedCommunities = new Set();
    if (currentUser) {
      const { data, error } = await supabase.from('community_members').select('community_id').eq('user_id', currentUser.id);
      if (error) {
        if (/community_members/i.test(error.message || '')) membershipAvailable = false;
        console.warn('Không thể tải cộng đồng đã tham gia:', error);
      } else (data || []).forEach(row => joinedCommunities.add(row.community_id));
    }
    if (activeCommunity) await chooseCommunity(activeCommunity);
  }, 0);
});
loadCommunities();
