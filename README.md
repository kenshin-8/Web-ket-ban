# Connect — hướng dẫn cài đặt và kiểm thử

Connect là website cộng đồng theo chủ đề hành tinh, sử dụng HTML/CSS/JavaScript và Supabase.

## Cấu trúc thư mục

```
Connect/
├─ README.md                 hướng dẫn này
├─ *.html                    các trang của website (index, login, match, square, voice...)
├─ css/                      giao diện
├─ js/                       mã chạy trên trình duyệt
├─ images/
├─ supabase/
│  ├─ migrations/            001_ … 019_  — chạy theo thứ tự số
│  ├─ optional/              migration tùy chọn
│  └─ archive/               bản cũ, chỉ để tham khảo
├─ docs/
│  ├─ README.md              chỉ mục tài liệu
│  ├─ NEXT_UPDATE.md, REPAIR_NOTES.md
│  └─ changelog/             nhật ký thay đổi theo từng đợt cập nhật
├─ create-test-accounts.mjs  tạo 20 tài khoản thử nghiệm
├─ package.json, .env.example, .gitignore
```

## 1. Yêu cầu

- Node.js 18 trở lên (chỉ cần nếu tạo tài khoản thử nghiệm).
- Một dự án Supabase do bạn quản lý.
- Trình duyệt hiện đại và VS Code (khuyến nghị).

## 2. Cấu hình Supabase

1. Mở **Supabase Dashboard → SQL Editor**.
2. Chạy lần lượt các tệp SQL dưới đây. Mỗi tệp chạy một lần theo đúng thứ tự; các migration có chú thích hỗ trợ chạy lại an toàn.

| Thứ tự | Tệp SQL | Mục đích / phụ thuộc |
|---:|---|---|
| 1 | `supabase/migrations/001_schema.sql` | Bảng và chính sách nền tảng: hồ sơ, Quảng trường, vị trí, phòng thoại… |
| 2 | `supabase/migrations/002_community_members.sql` | Thành viên của 6 cộng đồng hành tinh |
| 3 | `supabase/migrations/003_friend_system.sql` | Lời mời kết bạn và tin nhắn riêng; cần schema |
| 4 | `supabase/migrations/004_community_feed.sql` | Bài đăng và bình luận; cần community_members |
| 5 | `supabase/migrations/005_community_interactions.sql` | Lượt thích và thông báo bảng tin; cần community_feed |
| 6 | `supabase/migrations/006_community_chat.sql` | Chat theo hành tinh; cần community_members |
| 7 | `supabase/migrations/007_profile_social_identity.sql` | Ảnh bìa và bài đăng hồ sơ; cần schema |
| 8 | `supabase/migrations/008_profile_social_interactions.sql` | Thích, bình luận, thông báo bài đăng hồ sơ; cần profile_social_identity |
| 9 | `supabase/migrations/009_notification_presence.sql` | Thông báo kết bạn/tin nhắn và trạng thái online; cần friend_system |
| 10 | `supabase/migrations/010_safety_hardening.sql` | Chặn người dùng, báo cáo, giới hạn và quyền riêng tư; cần schema + friend_system |
| 11 | `supabase/migrations/011_discover_search.sql` | Tìm kiếm hồ sơ phía máy chủ; cần safety_hardening |
| 12 | `supabase/migrations/012_admin_moderation.sql` | Hàng đợi báo cáo và công cụ quản trị; cần safety_hardening, community_feed và profile_social_identity |
| 13 | `supabase/migrations/013_block_visibility_fix.sql` | Đồng bộ chặn hai chiều trên bảng tin, chat, hồ sơ, kết bạn và tin nhắn |
| 14 | `supabase/migrations/014_voice_avatar_repair.sql` | Migration tương thích từ bản sửa trước |
| 15 | `supabase/migrations/015_voice_avatar_repair_v2.sql` | Bổ sung quyền SQL/RLS và cột cần thiết cho lưu Avatar, tạo phòng thoại |
| 16 | `supabase/migrations/016_planet_presence.sql` | Đồng bộ vị trí Avatar trên tinh cầu qua Realtime; cần `010_safety_hardening.sql` và hồ sơ nền tảng |
| 17 | `supabase/migrations/017_square_polls.sql` | Bình chọn ẩn danh ở Quảng trường; cần `010_safety_hardening.sql` |
| 18 | `supabase/migrations/018_match_chat.sql` | Nhắn tin và gọi thoại 1-1 cho cặp ghép đôi; cần `013_block_visibility_fix.sql` và `009_notification_presence.sql` |
| 19 | `supabase/migrations/019_voice_room_capacity.sql` | Giới hạn tối đa 4 tài khoản trong phòng thoại ở PostgreSQL; tự giải phóng chỗ khi tab mất kết nối |

**Tùy chọn (chạy sau cùng, khi đã bật "Confirm email" ở mục 4a):** `supabase/optional/email_verification.sql` — chặn tài khoản chưa xác minh email ghi dữ liệu ở phía máy chủ.

**Đã đổi tên (không cần chạy lại):** các tệp SQL được đánh số theo thứ tự chạy và gom vào `supabase/migrations/`. Nếu bạn đã chạy các tệp này trước đó, cơ sở dữ liệu không thay đổi gì, chỉ đổi tên tệp. `supabase/archive/20261117_soul_likes.sql` là bản cũ đã nằm sẵn trong `001_schema.sql`, giữ lại để tham khảo.

**Lưu ý:** `013_block_visibility_fix.sql`, `014_voice_avatar_repair.sql`, `015_voice_avatar_repair_v2.sql`, `016_planet_presence.sql` và `019_voice_room_capacity.sql` là các migration bổ sung trong các bản cập nhật gần đây. Nếu đã cài Connect trước đây, không cần xóa dữ liệu hoặc tạo lại dự án; chạy các migration này sau khi đã chạy các migration nền tảng còn thiếu.

### Cấp quyền quản trị

Sau khi chạy `012_admin_moderation.sql`, thêm tài khoản của bạn vào danh sách quản trị trong SQL Editor (thay email mẫu bằng email đăng nhập Supabase của bạn):

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'your-email@example.com'
on conflict (user_id) do nothing;
```

Không cấp quyền quản trị cho tài khoản không đáng tin cậy.

## 3. Cấu hình và chạy website

1. Mở `js/supabase.js`.
2. Điền **Project URL** và **publishable/anon key** của đúng dự án Supabase vào cấu hình tương ứng. Chỉ dùng publishable/anon key ở trình duyệt.
3. Mở thư mục dự án bằng VS Code.
4. Chạy website bằng Live Server hoặc một máy chủ web tĩnh tương đương. Không nên mở trực tiếp trang bằng `file://` vì một số chức năng gọi API có thể bị trình duyệt chặn do origin/CORS.
5. Đăng ký tài khoản, hoàn thành Soul Quiz nếu được yêu cầu, sau đó kiểm tra hồ sơ và các hành tinh.

**Tuyệt đối không đưa service role/secret key vào `js/`, HTML, Git hoặc trình duyệt.**

## 4. Tạo 20 tài khoản thử nghiệm (không bắt buộc)

Script này dùng quyền quản trị Supabase để tạo tối đa 20 tài khoản. Chỉ chạy trên dự án thử nghiệm mà bạn kiểm soát.

### Windows PowerShell

```powershell
npm install
$env:SUPABASE_URL="https://YOUR_PROJECT.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="YOUR_SECRET_SERVICE_ROLE_KEY"
npm run create
```

`create-test-accounts.mjs` đọc biến môi trường trực tiếp; nó **không tự nạp** tệp `.env`. Vì vậy hãy thiết lập hai biến PowerShell như ví dụ trên, hoặc tự cấu hình công cụ quản lý biến môi trường an toàn.

Kết quả là tệp `connect-test-accounts.csv` gồm email, mật khẩu ngẫu nhiên và user ID. Giữ tệp này riêng tư, không gửi cho người khác và không commit lên Git. Email `example.com` chỉ phục vụ dữ liệu thử nghiệm, không nhận thư thật.

Script chỉ tạo tài khoản Auth và hồ sơ cơ bản. Nó không tự tạo bạn bè, tin nhắn, bài đăng, lượt thích hoặc Avatar; cần đăng nhập từng tài khoản để kiểm thử các luồng đó.

## 4a. Bắt buộc xác minh email khi đăng ký

Ai đăng ký cũng phải bấm liên kết trong thư xác minh mới dùng được tài khoản.

1. **Bật trong Supabase (bắt buộc):** *Authentication → Sign In / Providers → Email* → bật **Confirm email** → Save.
2. **Cho phép địa chỉ chuyển hướng:** *Authentication → URL Configuration* → thêm vào **Redirect URLs** địa chỉ trang đăng nhập, ví dụ `http://127.0.0.1:5501/login.html?verified=1` (và địa chỉ thật của web khi triển khai). Đặt **Site URL** đúng địa chỉ web.
3. **Thư gửi đi:** dịch vụ thư mặc định của Supabase bị giới hạn số thư mỗi giờ và dễ vào Spam. Khi chạy thật, hãy cấu hình SMTP riêng tại *Authentication → SMTP Settings* (Resend, Brevo, SendGrid…).
4. **Lớp bảo vệ phía máy chủ (khuyến nghị):** chạy `supabase/optional/email_verification.sql` trong SQL Editor. Tài khoản chưa xác minh sẽ không ghi được dữ liệu dù gọi API trực tiếp. Hãy thử trên dự án staging trước.

Luồng trên web: Đăng ký → hiện thông báo kèm nút **Gửi lại thư** (chờ 60 giây giữa các lần) → bấm liên kết trong thư → về trang đăng nhập. Đăng nhập khi chưa xác minh sẽ bị từ chối và hiện lại nút gửi thư. Tài khoản tạo bằng `create-test-accounts.mjs` đã được xác nhận sẵn nên không bị ảnh hưởng.

## 4b. Nhạc chung trong phòng tiệc

Trong phòng thoại có khung **🎵 Nhạc chung · karaoke**. Không cần chạy thêm SQL, chỉ dùng kênh Realtime đã có của phòng.

- **Chủ phòng** thêm bài, phát/dừng, tua, chuyển bài, xóa bài. Mọi người nghe đồng bộ (tự sửa lệch trên 1,5 giây).
- **Thành viên** đề xuất bài, chủ phòng bấm Duyệt thì bài mới vào hàng chờ. Mỗi người tự chỉnh âm lượng hoặc tắt nhạc của riêng mình.
- **Nguồn phát:** link YouTube (trình phát nhúng chính thức, hiện cả lời karaoke) hoặc link file âm thanh `https` kết thúc bằng `.mp3 .ogg .m4a .aac .wav .opus .flac`.
- Nhạc phát riêng trên máy từng người, không đi qua micro nên không bị vọng tiếng.
- Realtime broadcast không xác thực người gửi, nên một người cố tình giả mạo chỉ có thể làm nhiễu nhạc trong chính phòng đó. Chỉ phát nội dung bạn có quyền chia sẻ.

## 4c. Nhắn tin và gọi thoại 1-1 từ Ghép đôi

Chạy `supabase/migrations/018_match_chat.sql` (mục 18 ở bảng trên).

**Phòng thoại nhóm:** chạy thêm `supabase/migrations/019_voice_room_capacity.sql` (mục 19) để bật giới hạn 4 thành viên được kiểm tra nguyên tử ở máy chủ. Mỗi tab gửi heartbeat định kỳ; lượt tham gia của tab mất kết nối được tự dọn sau 2 phút.

- Hai người **Soul Like lẫn nhau** (hoặc đã là bạn bè) và không bên nào chặn bên kia thì thấy hai nút **💬 Nhắn tin** và **📞 Gọi thoại** trên thẻ ở trang Soul Match. Hộp thoại "Soul Connection" cũng có nút **💬 Nhắn tin ngay**.
- Tin nhắn dùng bảng `direct_messages` hiện có. Quyền đọc/gửi do RLS kiểm soát qua hàm `can_direct_message`. Nếu một bên bỏ thích và hai người không phải bạn bè, khung chat không còn xem được tin cũ.
- Cuộc gọi thoại: người nhận nghe chuông ở **mọi trang** khi đang đăng nhập. Hàng cuộc gọi chỉ hai người đọc được; tín hiệu WebRTC đi qua kênh Realtime mang tên là mã cuộc gọi (uuid). Mỗi người chỉ có một cuộc gọi tại một thời điểm, gọi liên tiếp bị giới hạn 8 giây.
- Chỉ dùng STUN công cộng. Hai máy sau NAT đối xứng (một số mạng di động hoặc văn phòng) có thể không kết nối được và cần máy chủ TURN, cấu hình ở hằng `ICE` đầu `js/match-chat.js`.
- Chưa có gọi video/mặt nạ avatar và chưa có lịch sử cuộc gọi.

## 5. Kiểm thử các tính năng chính

- **Tài khoản:** đăng ký, đăng nhập, đăng xuất, tải lại trang và kiểm tra phiên đăng nhập.
- **Soul Quiz / Avatar:** hoàn thành quiz, lưu kết quả, đổi Avatar và tải lại trang để kiểm tra dữ liệu có được lưu.
- **Hành tinh:** tham gia/rời cộng đồng, tải bảng tin, đăng bài, bình luận, thích bài và mở thông báo. Đăng nhập hai tài khoản ở hai trình duyệt, chạy `016_planet_presence.sql`, di chuyển Avatar ở một cửa sổ và xác nhận cửa sổ còn lại thấy Avatar cập nhật vị trí.
- **Chat cộng đồng:** gửi tin nhắn ở từng hành tinh và kiểm tra cập nhật realtime trên hai phiên đăng nhập.
- **Bạn bè / DM:** gửi, chấp nhận, từ chối lời mời; nhắn tin giữa hai tài khoản đã kết bạn.
- **Hồ sơ:** cập nhật thông tin, ảnh bìa, bài đăng; mở hồ sơ công khai bằng tài khoản khác.
- **An toàn:** báo cáo nội dung, chặn/bỏ chặn hai tài khoản và xác nhận hai bên không xem được hồ sơ, bài đăng, bình luận hoặc tin nhắn của nhau.
- **Quản trị:** đăng nhập bằng tài khoản đã thêm vào `public.admins`, mở `admin.html`, kiểm tra hàng đợi và thao tác xử lý báo cáo.

## 6. Xử lý lỗi thường gặp

- **Không tải được hồ sơ / báo lỗi thiếu bảng hoặc cột:** kiểm tra đã chạy đủ migration theo thứ tự ở mục 2.
- **Bảng tin hoặc chat trống:** kiểm tra đã đăng nhập, đã tham gia hành tinh và đã chạy `002_community_members.sql`, `004_community_feed.sql`, `006_community_chat.sql`.
- **Không có thông báo thích/bình luận:** kiểm tra `005_community_interactions.sql` hoặc `008_profile_social_interactions.sql` tùy loại bài đăng.
- **Không tìm kiếm được hồ sơ:** kiểm tra `011_discover_search.sql` và quyền gọi RPC `search_profiles`.
- **Realtime không cập nhật:** kiểm tra bảng đã được thêm vào publication `supabase_realtime` trong Supabase và thử tải lại trang. Với Avatar nhiều người, xác nhận đã chạy `016_planet_presence.sql`, cả hai tài khoản có hồ sơ công khai và không chặn lẫn nhau.
- **Ảnh không tải lên:** kiểm tra bucket Storage, policy và giới hạn loại/kích thước tệp trong migration tương ứng.
- **Mở bằng `file://` bị CORS:** chạy qua Live Server hoặc máy chủ web tĩnh.

Nếu vẫn lỗi, mở DevTools bằng `F12`, xem tab **Console** và **Network**, ghi lại thông báo lỗi đã che thông tin nhạy cảm trước khi chia sẻ.

## 7. Bảo mật

- Không chia sẻ publishable key kèm thông tin cá nhân; tuyệt đối không chia sẻ service role/secret key.
- Không commit `.env`, CSV tài khoản thử nghiệm, mật khẩu hoặc token.
- Dùng tài khoản và dữ liệu giả cho môi trường thử nghiệm.
- Các migration SQL chỉ được áp dụng khi bạn chạy chúng trong Supabase. Việc kiểm tra mã nguồn cục bộ không thay thế kiểm thử thực tế trên dự án Supabase của bạn.

## 5. Lưu ý khi dùng phòng thoại và Avatar

- Phòng thoại cần chạy website qua HTTPS hoặc `localhost` để trình duyệt cấp quyền micro. Nếu chưa cấp quyền, bản sửa vẫn cho vào phòng ở chế độ nghe và chat; nhấn **Bật micro** sau khi cấp quyền.
- Avatar được lưu trong `public.profiles.avatar_data`. Nếu lưu thất bại, mở Console (F12) để xem lỗi Supabase và kiểm tra đã chạy `015_voice_avatar_repair_v2.sql` và xem thông báo cụ thể trên trang. Nếu yêu cầu lưu kéo dài, phiên bản mới sẽ tự báo timeout thay vì giữ nút ở trạng thái đang lưu mãi.
