# Notification Center & Online Presence

## Tính năng
- Thông báo tự động khi có lời mời kết bạn, khi lời mời được chấp nhận và khi nhận tin nhắn riêng.
- Badge tổng số thông báo chưa đọc ở điều hướng trên trang chủ và trang Bạn bè.
- Danh sách 40 thông báo gần nhất, mở lời mời/cuộc trò chuyện liên quan và đánh dấu đã đọc.
- Trạng thái trực tuyến của bạn bè dựa trên heartbeat 45 giây; online khi lần cập nhật gần nhất dưới 2 phút.
- RLS giới hạn thông báo cho người nhận và presence cho chính người dùng/bạn bè đã chấp nhận.

## Cài đặt
1. Đảm bảo đã chạy `supabase/friend_system.sql`.
2. Chạy `supabase/notification_presence.sql` trong Supabase SQL Editor.
3. Tải lại Connect và đăng nhập bằng tài khoản đã kết bạn.
4. Dùng tài khoản thứ hai gửi lời mời hoặc tin nhắn để kiểm tra thông báo realtime.

## Giới hạn
- Presence là ước lượng dựa trên heartbeat trình duyệt; trạng thái có thể trễ tối đa khoảng 2 phút khi đóng tab hoặc mất mạng.
- Chưa có push notification của trình duyệt hoặc thông báo email.
- Cần bật Supabase Realtime cho `notifications` và `user_presence`; SQL có đoạn thêm hai bảng vào publication nếu publication đã tồn tại.
