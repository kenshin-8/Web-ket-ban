# Connect — Voice Stability & Capacity Fix

## Nội dung

- Xử lý ICE candidate đến trước SDP bằng hàng đợi theo từng peer.
- Thương lượng audio hai chiều ngay khi thiết lập peer để hỗ trợ bật micro sau khi đã vào phòng.
- Tạo MediaStream nhận thủ công khi `RTCTrackEvent.streams` rỗng.
- Giữ peer ở trạng thái `disconnected` thêm 10 giây trước khi đóng.
- Hiển thị lỗi tham gia phòng ngay trên danh sách phòng.
- Giới hạn tối đa bốn tài khoản bằng RPC PostgreSQL trong migration `019_voice_room_capacity.sql`.
- Heartbeat 30 giây; phiên không còn heartbeat sẽ được dọn sau hai phút.
- Xử lý lỗi mạng khi gửi lại email xác minh và điều hướng đúng người dùng sau xác minh.

## Cập nhật cơ sở dữ liệu

Chạy `supabase/migrations/019_voice_room_capacity.sql` trong Supabase SQL Editor sau migration 015 (nếu chạy theo bộ migration đầy đủ thì chạy theo thứ tự 019).

## Kiểm tra

- JavaScript syntax: đạt.
- 14 trang HTML: không có ID trùng hoặc tài nguyên nội bộ bị thiếu.
- Import module nội bộ: đạt.
- Kiểm tra sanitize Avatar với dữ liệu thử nghiệm không hợp lệ: đạt.

Các bài kiểm tra trên là kiểm tra mã nguồn cục bộ; chưa thay thế kiểm thử trên Supabase thật với nhiều tài khoản và nhiều mạng Internet.
