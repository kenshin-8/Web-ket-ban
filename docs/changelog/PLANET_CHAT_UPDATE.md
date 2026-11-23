# Connect Planet – trò chuyện riêng ngay trên Tinh cầu

## Thay đổi
- Chọn avatar thành viên trên Tinh cầu 3D và nhấn **Nhắn tin** để mở khung chat ngay trong thẻ hồ sơ.
- Tải tối đa 60 tin nhắn gần nhất, hiển thị giờ gửi và phân biệt tin nhắn của bạn/bạn bè.
- Gửi tin nhắn trực tiếp qua bảng `direct_messages`; tin nhắn mới được nhận qua Supabase Realtime.
- Chỉ cho phép gửi/đọc tin nhắn khi hai tài khoản đã có quan hệ bạn bè `accepted`, đúng với chính sách RLS hiện có.
- Khung chat có thể thu gọn; đóng thẻ hồ sơ sẽ dọn kênh realtime.

## Cấu hình Supabase
- Chạy `supabase/migrations/003_friend_system.sql` nếu dự án chưa tạo bảng `friend_requests`, `direct_messages`, các chính sách RLS và publication realtime.
- Bảng `direct_messages` phải được bật trong `supabase_realtime` để nhận tin nhắn tức thời. File SQL ở trên đã có đoạn kiểm tra và thêm bảng vào publication.
- Không cần thêm bảng hoặc cột mới cho tính năng này.

## Kiểm tra đã thực hiện
- `node --check` thành công với 33 tệp JavaScript.
- Đã rà soát 14 trang HTML, không phát hiện ID trùng lặp.
- Chưa thực hiện kiểm thử trình duyệt hoặc gửi/nhận tin nhắn end-to-end trên Supabase thật; cần xác nhận bằng hai tài khoản đã kết bạn.
