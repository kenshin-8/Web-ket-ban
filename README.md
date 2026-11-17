# Connect - hướng dẫn chạy dự án

## Chạy trên máy tính
1. Giải nén thư mục dự án.
2. Mở thư mục bằng Visual Studio Code.
3. Mở `index.html` bằng Live Server (không mở bằng `file://`).
4. Đăng ký/đăng nhập bằng tài khoản Supabase đã cấu hình.

## Cấu hình Supabase
- Thông tin kết nối trình duyệt nằm trong `js/supabase.js`.
- Chỉ sử dụng Publishable/anon key ở trình duyệt. Không bao giờ đưa `service_role` key vào mã nguồn hoặc ZIP.
- Trong Supabase Auth, thêm URL chạy Live Server vào danh sách Site URL / Redirect URLs nếu cần xác minh email.

## Thiết lập cơ sở dữ liệu nhanh
Mở Supabase > SQL Editor, dán và chạy `supabase/schema.sql` (tạo `profiles`, `contact_messages` và các chính sách RLS; chạy lại nhiều lần vẫn an toàn).

## Cấu trúc bảng `public.profiles` mà dự án sử dụng
- `id`: uuid, khóa liên kết với `auth.users.id`.
- `display_name`: text.
- `bio`: text.
- `interests`: text[] (mảng chuỗi).
- `city`: text.
- `is_visible`: boolean.
- `avatar_data`: jsonb.
- `updated_at`: timestamptz.

Dự án giả định bảng `profiles` và các cột trên đã tồn tại. Không chạy lệnh xóa bảng để sửa lỗi.

## Row Level Security (RLS)
Bật RLS cho `public.profiles`. Các chính sách tối thiểu nên đảm bảo:
- Người dùng chỉ được thêm/cập nhật hàng có `id = auth.uid()`.
- Người dùng có thể đọc hồ sơ công khai (`is_visible = true`).
- Người dùng có thể đọc hồ sơ của chính mình kể cả khi hồ sơ riêng tư.
- Không cấp quyền ghi hồ sơ cho `anon` hoặc người dùng khác.

Nếu trang Khám phá báo lỗi quyền truy cập, hãy kiểm tra RLS policies trong Supabase. Không tắt RLS để khắc phục nhanh.

## Voice Community (phòng thoại nhóm)
- Mở `voice.html` bằng Live Server và đăng nhập.
- Trong Supabase > SQL Editor, chạy phần `Voice Community` ở cuối `supabase/schema.sql` (hoặc chạy lại toàn bộ schema; các lệnh đều dùng `if not exists`/`drop policy if exists`).
- Phòng thoại dùng Supabase Realtime Presence/Broadcast để báo hiệu và WebRTC để truyền âm thanh trực tiếp giữa tối đa 4 thành viên. Trình duyệt cần quyền micro và phải chạy trên HTTPS hoặc localhost (Live Server).
- Nếu Supabase project tắt Realtime hoặc chính sách Realtime không cho phép kênh public, bật Realtime Broadcast/Presence cho dự án và kiểm tra cấu hình quyền truy cập kênh.
- Bản thử nghiệm dùng STUN công khai; một số mạng/NAT có thể cần TURN server riêng để kết nối ổn định. Không đưa TURN secret hoặc service_role key vào mã frontend.
- Phòng được tạo bởi tài khoản đăng nhập; chủ phòng kết thúc phòng khi rời đi. Không có ghép đôi ẩn danh 1-1.
- Trong cuộc gọi có bộ lọc giọng (trầm/cao/dễ thương dạng EQ, robot dạng ring-modulation) và hiệu ứng vỗ tay, cười, nhịp tim, nhạc nền tổng hợp. Âm thanh hiệu ứng được trộn vào luồng WebRTC gửi tới người trong phòng. Đây là hiệu ứng Web Audio nhẹ, không phải công nghệ đổi cao độ/formant chất lượng phòng thu; nên thử trên Chrome/Edge và HTTPS hoặc localhost.

## Các trang
- `index.html`: Trang chủ.
- `register.html`, `login.html`: Tạo tài khoản và đăng nhập.
- `profile.html`: Chỉnh sửa hồ sơ và tùy chọn công khai.
- `avatar.html`: Thiết kế và lưu Avatar hoạt hình.
- `discover.html`: Tìm hồ sơ công khai theo tên, thành phố và sở thích.
- `voice.html`: Tạo và tham gia phòng trò chuyện thoại nhóm.

## Ghi chú
- Biểu mẫu liên hệ lưu lời nhắn vào bảng `contact_messages` (xem trong Supabase Dashboard); không gửi email.
- Mã vẽ Avatar dùng chung nằm ở `js/avatar-data.js`.
- Ảnh đại diện chân dung không được tải lên; hồ sơ sử dụng Avatar hoạt hình.
- Kiểm tra kỹ quyền truy cập và chính sách RLS trước khi triển khai công khai.

## Quảng trường (Moments)
- Chạy lại `supabase/schema.sql` (phần "Quảng trường": 5 bảng, 2 view, bucket `moments`). Mở `square.html` bằng Live Server và đăng nhập.
- Bài đăng gồm chữ, ảnh, video (≤10 MB) hoặc ghi âm (≤60 giây); thẻ `#chủ_đề` trong nội dung tự thành hashtag.
- Ẩn danh: người xem chỉ thấy biệt danh ngẫu nhiên. `author_id` chỉ chủ bài đọc được; mọi người đọc qua view `moments_feed`/`comments_feed`. Tin nhắn kín dùng mã cuộc trò chuyện, người nhận không thấy tài khoản người gửi.
- Chưa có kiểm duyệt/báo cáo vi phạm: cần bổ sung trước khi công khai.


## Mini-games & Soul Card
- Mở `icebreaker.html` bằng Live Server để chơi Đoán chữ, Câu hỏi phá băng và Lá bài gợi ý (mang tính giải trí, không dự đoán tương lai).
- Mở `profile.html`, nhập tối đa 6 từ khóa vào Soul Card và nhấn Lưu hồ sơ.
- Chạy lại `supabase/schema.sql` để thêm cột `soul_tags` vào `profiles`; lệnh dùng `add column if not exists` nên không xóa dữ liệu.
- Avatar hiện là nhân vật hoạt hình SVG 2D có thể tùy chỉnh tóc, màu tóc, khuôn mặt, mắt, biểu cảm, màu da và trang phục; chưa phải mô hình 3D tương tác.


## Mutual Like + Soul Connection

Tính năng thích hồ sơ và kết nối tương hỗ được tích hợp ở `discover.html` và `match.html`. Khi A thích B và B cũng thích A, cả hai phía nhận sự kiện Realtime, hiển thị độ tương hợp từ thuật toán Soul Match hiện tại, tinh cầu đôi và các sở thích chung. Người dùng có thể bỏ thích để hủy lượt thích của chính mình.

### Bước bắt buộc trên Supabase

1. Mở **Supabase → SQL Editor**.
2. Chạy toàn bộ file `supabase/migrations/20261117_soul_likes.sql` (hoặc chạy phần cùng tên ở cuối `supabase/schema.sql`).
3. Đảm bảo Realtime đang bật cho bảng `public.soul_likes` trong publication `supabase_realtime` (migration đã tự thêm nếu chưa có).

Bảng `soul_likes` có RLS: người dùng chỉ đọc lượt thích liên quan đến chính họ, chỉ tạo lượt thích với `from_user_id = auth.uid()` và chỉ xóa lượt thích do mình tạo. Không cần thêm cột vào `profiles`.

### Kiểm thử thủ công

- Dùng hai tài khoản đã đăng nhập, hồ sơ công khai.
- Tài khoản A nhấn **Thích hồ sơ** của B: A thấy trạng thái **Đã thích**, chưa có ghép đôi.
- Tài khoản B nhấn **Thích hồ sơ** của A: cả hai phía nhận thông báo **Hai tinh cầu đã tìm thấy nhau**, điểm tương hợp và tag chung.
- A bỏ thích: lượt thích một chiều bị xóa và trạng thái ghép đôi không còn được xác nhận ở lần kiểm tra tiếp theo.

Realtime cần kết nối Supabase đang hoạt động; nếu chưa chạy migration, nút thích sẽ không lưu được dữ liệu.


## Connect 3D Planet

- Màn hình chính có tinh cầu tương tác: kéo để xoay, cuộn hoặc dùng nút +/- để phóng to/thu nhỏ.
- Các Avatar được dựng từ `avatar_data` của hồ sơ công khai (`is_visible = true`); không tạo hồ sơ giả và không tự hiển thị số người online.
- Chọn một Avatar để xem tên, sở thích và độ tương hợp (dùng lại `compat()` trong `js/soul.js`). Nút thích sử dụng luồng `soul_likes` hiện có; Soul Match mở trang ghép đôi, Audio mở `voice.html`.
- Tính năng dùng lại Supabase Auth, hồ sơ và RLS hiện tại. Không cần migration mới. Hồ sơ công khai vẫn tuân theo chính sách `profiles_read_public_or_own`.
- Muốn xuất hiện trên tinh cầu, thành viên cần bật hiển thị hồ sơ trong trang Hồ sơ. Trạng thái online không được suy diễn từ việc hồ sơ công khai.
