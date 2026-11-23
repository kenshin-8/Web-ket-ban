# Connect — ghi chú bản sửa

## Đã xử lý

1. **Ổn định WebRTC phòng thoại:** bổ sung hàng đợi ICE candidate khi tín hiệu đến trước SDP, thương lượng audio hai chiều ngay cả khi thành viên bật micro muộn, và chờ 10 giây trước khi đóng peer ở trạng thái `disconnected`.
2. **Giới hạn phòng thoại phía máy chủ:** thêm `019_voice_room_capacity.sql` với khóa dòng phòng, tối đa 4 tài khoản, mã kết nối riêng cho từng tab và heartbeat để dọn lượt tham gia đã mất kết nối.
3. **Email xác minh:** xử lý lỗi mạng khi gửi lại email; sau khi xác minh, điều hướng thành viên cũ về trang chủ và thành viên mới về Soul Quiz.
4. **Chặn người dùng hai chiều:** thêm `supabase/migrations/013_block_visibility_fix.sql` để RLS lọc người chặn/người bị chặn ở cả hai chiều trên bài đăng và bình luận cộng đồng, chat hành tinh, bài đăng và tương tác hồ sơ, lời mời kết bạn, tin nhắn riêng, thông báo, trạng thái online và các cuộc trò chuyện Quảng trường đã tồn tại.
2. **Quyền riêng tư phía máy chủ:** các bộ lọc quan trọng được áp dụng bằng Row Level Security (RLS), không chỉ dựa vào JavaScript ở trình duyệt.
3. **Hướng dẫn cài đặt:** viết lại README với thứ tự migration, thiết lập Supabase, chạy website, tạo tài khoản thử nghiệm, kiểm thử tính năng và xử lý lỗi.
4. **Bảo vệ tệp nhạy cảm:** thêm `.gitignore` để tránh commit `.env`, `node_modules` và CSV chứa thông tin đăng nhập thử nghiệm.

## Kiểm tra đã thực hiện

- `node --check` cho toàn bộ 37 tệp JavaScript/module: đạt.
- Kiểm tra tham chiếu CSS/JS/ảnh nội bộ trên 14 trang HTML: không phát hiện đường dẫn thiếu.
- Kiểm tra import module nội bộ: không phát hiện module bị thiếu.
- Bổ sung kiểm soát chỗ phòng thoại ở PostgreSQL; cần chạy migration 019 trước khi dùng bản cập nhật này.
- Quét 14 trang HTML: không phát hiện ID trùng.
- Kiểm tra tài nguyên `src`/`href` nội bộ: không phát hiện đường dẫn thiếu.
- Kiểm tra cấu trúc ZIP: đạt.

## Giới hạn kiểm thử

- Chưa chạy migration 019 trên Supabase thật và chưa kiểm thử RLS bằng hai tài khoản thực tế.
- Chưa xác nhận các luồng realtime, upload, camera/microphone và dữ liệu phụ thuộc quyền truy cập trình duyệt.
- Vì vậy, đây là kết quả kiểm tra mã nguồn tĩnh; sau khi giải nén, cần chạy `013_block_visibility_fix.sql` và thực hiện checklist trong README trên dự án Supabase của bạn.

## Cập nhật bổ sung — ổn định phòng thoại

- WebRTC giờ tạo audio transceiver hai chiều ngay khi thiết lập peer, nên thành viên có thể bật micro sau khi đã vào phòng.
- ICE candidate đến sớm được xếp hàng đến khi có remote description; stream từ `ontrack` được dựng thủ công nếu trình duyệt không cung cấp `event.streams`.
- Trạng thái `disconnected` được chờ 10 giây để mạng có cơ hội tự phục hồi.
- Phòng thoại yêu cầu chạy migration mới `019_voice_room_capacity.sql`. Migration dùng khóa dòng phòng để giới hạn tối đa bốn tài khoản, hỗ trợ nhiều tab của cùng một tài khoản và tự dọn phiên không gửi heartbeat trong hai phút.
- Nếu không chạy migration 019, chức năng tham gia phòng ở phiên bản mã mới sẽ báo lỗi RPC chưa tồn tại. Hãy chạy SQL này trước khi đưa bản cập nhật lên website.
