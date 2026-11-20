# Connect Planet Multiplayer Presence

## Tính năng
- Avatar di chuyển của từng tài khoản được lưu vào `public.planet_presence`.
- Supabase Realtime phát sự kiện INSERT/UPDATE để các trình duyệt khác cập nhật vị trí gần như tức thời.
- Avatar thành viên khác chỉ được vẽ nếu hồ sơ của họ đang công khai và không có quan hệ chặn giữa hai tài khoản.
- Vị trí là tọa độ ảo trên quả cầu (radian), không phải vị trí địa lý.
- Heartbeat 30 giây; Avatar của phiên đã ngừng cập nhật hơn 90 giây sẽ tự ẩn ở phía người xem.
- Nhấn Avatar thành viên khác để mở thẻ hồ sơ như trước.

## Cài đặt
1. Chạy `supabase/planet_presence.sql` trong Supabase SQL Editor sau `schema.sql`, `friend_system.sql` và `safety_hardening.sql`.
2. Mở Connect qua Live Server/HTTPS và đăng nhập hai tài khoản có hồ sơ công khai.
3. Mở cùng một hành tinh trên hai trình duyệt/thiết bị. Di chuyển ở một cửa sổ để thấy Avatar cập nhật ở cửa sổ còn lại.

## Giới hạn hiện tại
- Vị trí chỉ tồn tại khi phiên trình duyệt còn gửi heartbeat; không lưu lịch sử di chuyển.
- Chỉ hiển thị những thành viên nằm trong danh sách hồ sơ công khai được trang chủ tải (tối đa 60 hồ sơ hiện tại).
- Nếu Supabase Realtime hoặc migration chưa được bật, di chuyển cục bộ vẫn hoạt động nhưng Avatar của người khác không đồng bộ.
