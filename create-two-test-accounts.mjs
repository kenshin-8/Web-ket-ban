import { createClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const url = process.env.SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) {
  console.error('Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY. Chỉ chạy cục bộ; không đưa key vào frontend hoặc gửi qua chat.');
  process.exit(1);
}
const supabase = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
const tag = Date.now().toString(36);
const people = [
  { name: `Bot An ${tag}`, city: 'Hà Nội', bio: 'Tài khoản tự động kiểm thử Connect', interests: ['kiểm thử', 'công nghệ'], zodiac: 'Thiên Bình' },
  { name: `Bot Bình ${tag}`, city: 'Đà Nẵng', bio: 'Tài khoản tự động kiểm thử Connect', interests: ['kiểm thử', 'âm nhạc'], zodiac: 'Bảo Bình' }
];
const rows = [];
for (let i = 0; i < people.length; i++) {
  const p = people[i];
  const email = `connect-e2e-${tag}-${i + 1}@example.com`;
  const password = `CxE2E!${randomBytes(12).toString('base64url')}9`;
  const { data, error } = await supabase.auth.admin.createUser({
    email, password, email_confirm: true,
    user_metadata: { username: p.name, test_account: true }
  });
  if (error) throw new Error(`Tạo ${email} thất bại: ${error.message}`);
  const { error: profileError } = await supabase.from('profiles').upsert({
    id: data.user.id, display_name: p.name, city: p.city, bio: p.bio,
    interests: p.interests, zodiac: p.zodiac, is_visible: true
  }, { onConflict: 'id' });
  rows.push({ slot: i + 1, name: p.name, email, password, user_id: data.user.id, profile_status: profileError?.message || 'ok' });
  if (profileError) throw new Error(`Auth user ${email} created, but profile failed: ${profileError.message}. User ID: ${data.user.id}`);
  console.log(`Created ${email}`);
}
const csv = ['slot,name,email,password,user_id,profile_status', ...rows.map(r => Object.values(r).map(v => `"${String(v).replaceAll('"', '""')}"`).join(','))].join('\n');
writeFileSync('connect-two-test-accounts.csv', '\uFEFF' + csv, { mode: 0o600 });
console.log('Đã tạo 2 tài khoản thử nghiệm. Thông tin nằm trong connect-two-test-accounts.csv (giữ riêng tư, không commit).');
