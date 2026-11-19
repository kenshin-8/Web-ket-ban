# Connect

Nền tảng kết nối cộng đồng với hồ sơ cá nhân, Avatar, tinh cầu 3D, Soul Match, bạn bè, nhắn tin, Quảng trường, cộng đồng theo chủ đề và phòng thoại WebRTC.

> **Trạng thái:** mã nguồn frontend và các file SQL được cung cấp trong thư mục này. Các migration SQL không tự chạy trên Supabase. Cần áp dụng đúng thứ tự bên dưới và kiểm thử bằng tài khoản thử nghiệm trước khi mở cho người dùng thật.

## 1. Chạy ứng dụng cục bộ

1. Giải nén thư mục `Connect`.
2. Mở thư mục bằng Visual Studio Code.
3. Chạy bằng Live Server hoặc máy chủ HTTP cục bộ; không mở trang bằng `file://`.
4. Mở `js/supabase.js` và kiểm tra Supabase URL cùng publishable/anon key.
5. Trong Supabase Auth, cấu hình Site URL và Redirect URLs tương ứng với domain phát triển/production.
6. Mở `register.html` để tạo tài khoản thử nghiệm.

Frontend chỉ được chứa publishable/anon key. **Không bao giờ đưa `service_role` key, mật khẩu quản trị, TURN secret hoặc khóa bí mật vào JavaScript, HTML hay ZIP.** Publishable key không thay thế RLS.

## 2. Thứ tự cài đặt SQL

Chạy từng file trong **Supabase → SQL Editor**, theo thứ tự sau. Không chạy các file ngẫu nhiên hoặc bỏ qua migration phụ thuộc. Các file migration được thiết kế để chạy lại an toàn ở mức lệnh đã khai báo, nhưng vẫn nên sao lưu trước khi cập nhật hệ thống đang hoạt động.

| Thứ tự | File | Mục đích / phụ thuộc |
|---:|---|---|
| 1 | `supabase/schema.sql` | Bảng hồ sơ, liên hệ, vị trí, phòng thoại, Quảng trường, Soul Card, cung hoàng đạo và Soul Likes |
| 2 | `supabase/community_members.sql` | Thành viên các cộng đồng chủ đề |
| 3 | `supabase/community_feed.sql` | Bài đăng và bình luận; cần `community_members.sql` |
| 4 | `supabase/community_chat.sql` | Tin nhắn cộng đồng; cần `community_members.sql` |
| 5 | `supabase/community_interactions.sql` | Lượt thích và thông báo cộng đồng; cần `community_members.sql` và `community_feed.sql` |
| 6 | `supabase/friend_system.sql` | Lời mời kết bạn và tin nhắn riêng; cần `schema.sql` |
| 7 | `supabase/notification_presence.sql` | Trung tâm thông báo và trạng thái online; cần `friend_system.sql` |
| 8 | `supabase/profile_social_identity.sql` | Ảnh bìa và bài đăng hồ sơ; cần `schema.sql` |
| 9 | `supabase/profile_social_interactions.sql` | Like/comment bài đăng hồ sơ; cần `profile_social_identity.sql` |
| 10 | `supabase/safety_hardening.sql` | Chặn, báo cáo, giới hạn tần suất, bảo vệ vị trí và upload; chạy sau schema và các migration liên quan ở trên |
| 11 | `supabase/discover_search.sql` | Tìm kiếm hồ sơ phía server; cần `safety_hardening.sql` |
| 12 | `supabase/admin_moderation.sql` | Hàng đợi kiểm duyệt và nhật ký thao tác; cần `safety_hardening.sql` |

Nếu một tính năng chưa được sử dụng, có thể chưa cần chạy migration riêng của tính năng đó. Tuy nhiên, trước khi phát hành bản đầy đủ, hãy chạy toàn bộ theo đúng thứ tự. `schema.sql` đã được chỉnh để tọa độ thô trong `user_locations` chỉ đọc được bởi chính chủ tài khoản; tìm người ở gần dùng RPC `nearby_users()` sau khi cài `safety_hardening.sql`.

### Cấu trúc hồ sơ cốt lõi

`public.profiles` liên kết `id` với `auth.users.id`. Các trường được dùng gồm `display_name`, `bio`, `interests`, `city`, `is_visible`, `avatar_data`, `updated_at` và các trường mở rộng do migration thêm. Không xóa bảng hoặc thay đổi kiểu dữ liệu tùy tiện để sửa lỗi; hãy tạo migration bổ sung có kiểm soát.

## 3. Các trang chính

- `index.html`: trang chủ và Connect Planet 3D.
- `register.html`, `login.html`: đăng ký và đăng nhập.
- `quiz.html`: bài trắc nghiệm Soul.
- `profile.html`, `public-profile.html`: hồ sơ cá nhân và hồ sơ công khai.
- `avatar.html`: thiết kế Avatar SVG.
- `discover.html`, `match.html`: khám phá và Soul Match.
- `friends.html`: lời mời, bạn bè, nhắn tin riêng và thông báo.
- `square.html`: Quảng trường Moments, bình luận và tin nhắn kín.
- `voice.html`: phòng thoại nhóm WebRTC.
- `admin.html`: giao diện kiểm duyệt; cần cấp quyền admin qua SQL.
- `icebreaker.html`: mini-games và gợi ý phá băng.

## 4. Bảo mật và quyền riêng tư

- **RLS:** bật RLS và kiểm tra mọi policy bằng ít nhất hai tài khoản độc lập. Không tắt RLS để khắc phục lỗi truy vấn.
- **Vị trí:** người dùng chủ động chia sẻ; tọa độ thô chỉ chủ tài khoản đọc được. `nearby_users(radius_km)` trả ID và nấc khoảng cách, không trả tọa độ. Tắt chia sẻ vị trí bằng cách xóa dòng của chính mình.
- **Chặn/báo cáo:** `safety_hardening.sql` thêm luồng chặn, báo cáo và tự ẩn nội dung Quảng trường khi có đủ báo cáo hợp lệ. Đây không thay thế quy trình kiểm duyệt của con người.
- **Quảng trường:** bucket `moments` đang public để ảnh/video/ghi âm trong bài có thể hiển thị qua URL công khai. Không tải lên dữ liệu nhạy cảm hoặc nội dung cần bảo mật. Muốn nội dung riêng tư thực sự cần chuyển sang private bucket và thay luồng URL bằng signed URL đồng bộ với RLS.
- **Ảnh bìa:** bucket `profile-covers` đang public để hiển thị ảnh; quyền tải lên/cập nhật/xóa được giới hạn theo thư mục người dùng.
- **Admin:** bảng `admins` không có policy truy cập client. Thêm tài khoản quản trị bằng SQL Editor, ví dụ:

  ```sql
  insert into public.admins (user_id)
  select id from auth.users where email = 'admin@example.com';
  ```

  Thay email ví dụ bằng email tài khoản thực tế. Không cấp quyền admin từ trình duyệt. `admin_moderation.sql` ghi nhật ký thay đổi trạng thái báo cáo vào `admin_audit_log`; bảng này không mở cho client. Nhật ký được ghi khi thao tác xử lý báo cáo cập nhật trạng thái thông qua giao diện/RPC quản trị.
- **Auth:** bật xác minh email, đặt chính sách mật khẩu phù hợp và cấu hình giới hạn đăng nhập trong Supabase Auth. CAPTCHA/Turnstile cần Edge Function hoặc lớp backend; frontend hiện không tự cung cấp cơ chế CAPTCHA hoàn chỉnh.

## 5. Hiệu năng và giới hạn đã biết

- Tinh cầu có lớp Three.js/WebGL và Canvas 2D dự phòng. Three.js được tải từ CDN; cần Internet. Kiểm tra cả thiết bị không hỗ trợ WebGL.
- Tinh cầu và một số thống kê Universe vẫn tải theo giới hạn hữu hạn ở frontend; với cộng đồng lớn cần tiếp tục chuyển sang phân trang/truy vấn server-side.
- Phòng thoại dùng WebRTC với STUN công khai. Một số NAT/firewall cần TURN server riêng để kết nối ổn định; cấu hình TURN phải đặt ở backend an toàn, không nhúng TURN secret vào frontend.
- Presence là trạng thái ước lượng, có thể trễ khi thiết bị mất mạng đột ngột.
- Bucket `moments` hiện dùng public URL; chưa phải signed URL riêng tư.
- Push notification/email chưa được tích hợp.

## 6. Kiểm thử trước khi phát hành

Dùng tối thiểu hai tài khoản A/B và kiểm tra:

1. Đăng ký, xác minh email, đăng nhập, đăng xuất, hết phiên và đặt lại mật khẩu.
2. Hồ sơ công khai/riêng tư; A không đọc được hồ sơ riêng tư của B.
3. A/B thích nhau, bỏ thích, kết bạn, từ chối lời mời và hủy kết bạn.
4. Tin nhắn riêng chỉ đọc/gửi được giữa hai người đã kết bạn; người bị chặn không thể gửi lời mời hoặc tin nhắn.
5. Quảng trường: tạo bài, tải media, like, bình luận, báo cáo, chặn và xóa bài của chính mình.
6. Kiểm tra `moments_feed` không làm lộ `author_id` của bài ẩn danh; kiểm tra URL media vì bucket hiện public.
7. Cộng đồng: chỉ thành viên mới đọc/đăng bài và gửi tin nhắn trong cộng đồng tương ứng.
8. Admin: tài khoản thường không xem được hàng đợi; admin xử lý báo cáo và kiểm tra `admin_audit_log`.
9. Vị trí: tài khoản A không thể SELECT tọa độ của B; RPC chỉ trả ID và nấc khoảng cách.
10. Phòng thoại: cấp/thu hồi quyền micro, rời phòng, đóng phòng, mất mạng, Chrome/Edge và thiết bị di động.
11. Giao diện: desktop/mobile, chế độ sáng/tối, bàn phím, reduced motion và trạng thái mạng chậm.

## 7. Ghi chú phát triển

- Supabase client: `js/supabase.js` (supabase-js `2.45.4`).
- Mã nguồn Avatar: `js/avatar-data.js` và `js/avatar.js`.
- Tinh cầu: `js/planet-3d.js`, `js/planet-three.js`, `js/universe.js`.
- Âm thanh/WebRTC: `js/voice.js`, `js/effects.js`.
- CSS nền tảng: `css/style.css`, `css/theme.css`, `css/compact-ui.css`, `css/quality.css`; CSS tính năng nằm trong các file cùng tên.
- Các file `*_UPDATE.md`, `CHANGELOG_*.md` là ghi chú lịch sử; khi có khác biệt, ưu tiên mã nguồn và migration SQL hiện tại.
