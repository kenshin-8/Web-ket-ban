import { supabase, getInitialSession } from './supabase.js';
const $ = id => document.getElementById(id);
let user = null;
const say = (id, message, bad = false) => { const el = $(id); if (el) { el.textContent = message; el.style.color = bad ? '#ffb8c7' : '#aee8cf'; } };
async function init() {
  const session = await getInitialSession(); user = session?.user;
  if (!user) { location.href = 'login.html'; return; }
  const prefs = JSON.parse(localStorage.getItem(`connect:prefs:${user.id}`) || '{}');
  $('language').value = prefs.language || 'vi'; $('notifications').checked = prefs.notifications === true;
  const { data: profile } = await supabase.from('profiles').select('is_visible').eq('id', user.id).maybeSingle();
  $('profileVisible').checked = profile?.is_visible === true;
  await loadBlocks();
}
$('savePreferences').addEventListener('click', () => {
  localStorage.setItem(`connect:prefs:${user.id}`, JSON.stringify({ language: $('language').value, notifications: $('notifications').checked }));
  say('preferencesMessage', 'Đã lưu tùy chỉnh trên trình duyệt này.');
});
$('profileVisible').addEventListener('change', async () => {
  const { error } = await supabase.from('profiles').update({ is_visible: $('profileVisible').checked }).eq('id', user.id);
  if (error) { $('profileVisible').checked = !$('profileVisible').checked; say('privacyMessage', 'Không thể cập nhật: ' + error.message, true); }
  else say('privacyMessage', 'Đã cập nhật quyền hiển thị hồ sơ.');
});
$('emailForm').addEventListener('submit', async e => { e.preventDefault(); const { error } = await supabase.auth.updateUser({ email: $('newEmail').value.trim() }); say('emailMessage', error ? error.message : 'Đã gửi email xác nhận đến địa chỉ mới.', !!error); });
$('passwordForm').addEventListener('submit', async e => { e.preventDefault(); const { error } = await supabase.auth.updateUser({ password: $('newPassword').value }); say('passwordMessage', error ? error.message : 'Đã cập nhật mật khẩu.', !!error); if (!error) $('passwordForm').reset(); });
async function loadBlocks() {
  const host = $('blockedList');
  const { data, error } = await supabase.rpc('my_blocks');
  if (error) { host.textContent = 'Chưa tải được danh sách. Hãy kiểm tra migration 010_safety_hardening.sql.'; say('blockedMessage', error.message, true); return; }
  host.replaceChildren();
  if (!data?.length) { host.textContent = 'Bạn chưa chặn tài khoản nào.'; return; }
  data.forEach(row => {
    const item = document.createElement('div'); item.className = 'block-row';
    const name = document.createElement('span'); name.textContent = row.display_name || 'Thành viên Connect';
    const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Bỏ chặn';
    button.addEventListener('click', async () => {
      button.disabled = true;
      const { error: removeError } = await supabase.from('user_blocks').delete().eq('blocked_id', row.blocked_id);
      if (removeError) { button.disabled = false; say('blockedMessage', removeError.message, true); }
      else { item.remove(); say('blockedMessage', 'Đã bỏ chặn tài khoản.'); if (!host.children.length) host.textContent = 'Bạn chưa chặn tài khoản nào.'; }
    });
    item.append(name, button); host.append(item);
  });
}
init().catch(error => { console.error(error); say('blockedMessage', 'Không thể tải cài đặt tài khoản.', true); });
