# Connect — Friend System & Direct Messages

- Tìm kiếm hồ sơ công khai, gửi lời mời và chấp nhận/từ chối.
- Danh sách bạn bè và nhắn tin riêng 1–1.
- Tin nhắn riêng đồng bộ qua Supabase Realtime.
- Cần chạy `supabase/migrations/003_friend_system.sql` trước khi dùng.

# Notification Center & Online Presence

- Thêm trung tâm thông báo cho lời mời kết bạn, lời mời được chấp nhận và tin nhắn riêng.
- Badge thông báo chưa đọc xuất hiện ở liên kết Bạn bè & Tin nhắn trên trang chủ và trang bạn bè.
- Thông báo mới đồng bộ realtime; có thể đánh dấu từng thông báo hoặc tất cả là đã đọc.
- Heartbeat hiện diện cập nhật mỗi 45 giây khi tab đang hiển thị.
- Bạn bè được xem là trực tuyến nếu heartbeat trong 2 phút gần nhất; trạng thái chỉ chia sẻ với bạn bè đã kết nối.
- Cần chạy `supabase/migrations/009_notification_presence.sql` sau `supabase/migrations/003_friend_system.sql`.

## Lưu ý

Presence dựa trên heartbeat của trình duyệt, không phải trạng thái kết nối máy chủ tuyệt đối. Khi đóng trình duyệt hoặc mất mạng đột ngột, trạng thái có thể còn hiển thị trực tuyến tối đa khoảng 2 phút.
