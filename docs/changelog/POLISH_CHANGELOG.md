# Connect Polish & Stabilization — 19/11/2026

## Đã chỉnh sửa

- Sửa `supabase/migrations/001_schema.sql`: chính sách đọc `user_locations` giờ chỉ cho phép người dùng đọc tọa độ của chính mình. Chính sách cũ `loc_read_auth` được drop khi chạy lại schema; tính năng tìm người gần bạn tiếp tục dùng RPC `nearby_users()` sau `010_safety_hardening.sql`.
- Bổ sung `css/quality.css` và nạp sau cùng trên cả 14 trang HTML: chuẩn hóa focus bàn phím, form control, media, giới hạn tràn ngang trên màn hình nhỏ, bảng cuộn ngang và reduced-motion.
- Viết lại `README.md`: chuẩn hóa hướng dẫn chạy, thứ tự migration, phụ thuộc giữa các file SQL, các trang, lưu ý quyền riêng tư, giới hạn triển khai và checklist kiểm thử.
- Bổ sung nhật ký kiểm duyệt `admin_audit_log` trong `supabase/migrations/012_admin_moderation.sql`. Trigger ghi lại thay đổi trạng thái báo cáo; bảng không cấp quyền truy cập cho anon/authenticated client.

## Kiểm tra đã chạy

- `node --check` trên 32 file JavaScript: đạt.
- Kiểm tra đường dẫn CSS/JS/ảnh nội bộ được tham chiếu trong 14 file HTML: đạt.
- Kiểm tra tất cả 14 trang đã nạp `css/quality.css`: đạt.

## Chưa thể xác nhận trong môi trường đóng gói

- Chưa chạy SQL trên Supabase thật; cần áp dụng migration và kiểm tra RLS bằng hai tài khoản.
- Chưa kiểm thử giao diện bằng trình duyệt tự động hoặc thiết bị thật.
- Chưa kiểm thử WebRTC qua các NAT/firewall; TURN server vẫn cần cấu hình riêng.
- Bucket `moments` và `profile-covers` vẫn public theo thiết kế hiện tại; cần chuyển signed URL nếu muốn media riêng tư.
- Chưa tích hợp CAPTCHA/Turnstile, push notification/email, hoặc hệ thống khóa tài khoản có thời hạn.
