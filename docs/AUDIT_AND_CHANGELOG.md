# Connect — kiểm tra và cập nhật mã nguồn

## Phạm vi đã kiểm tra

- Đọc README, tài liệu phát triển, ghi chú sửa lỗi và nhật ký cập nhật.
- Kiểm kê các trang HTML, module JavaScript, CSS và migration Supabase.
- Chạy kiểm tra cú pháp JavaScript bằng Node.js.
- Kiểm tra ID HTML trùng và tham chiếu tài nguyên nội bộ.
- Rà soát các điểm liên quan đến RLS, quản trị, xác minh email, báo cáo nội dung và WebRTC.

## Thay đổi trong gói này

1. Loại bỏ `supabase/migrations/20261117_soul_likes.sql` khỏi thư mục migration đang chạy. Nội dung này trùng byte-for-byte với `supabase/archive/20261117_soul_likes.sql` và bảng/chính sách `soul_likes` đã có trong `001_schema.sql`. Bản archive được giữ nguyên để tra cứu.
2. Thêm `scripts/check-project.mjs` và lệnh `npm test` để lặp lại các kiểm tra tĩnh cơ bản.
3. Bổ sung hướng dẫn chạy kiểm tra vào README.

## Kết quả kiểm tra tĩnh

Kết quả tại thời điểm đóng gói:

- 44 tệp JavaScript/MJS: cú pháp đạt.
- 15 trang HTML: không phát hiện ID trùng.
- 424 tham chiếu tài nguyên nội bộ: không phát hiện đường dẫn thiếu.
- 20 migration: tất cả theo quy ước `NNN_name.sql`.

## Các việc chưa thể xác nhận bằng gói mã nguồn

- RLS và quyền truy cập cần được kiểm thử bằng nhiều tài khoản thực trên một Supabase staging. Không có quyền truy cập dự án staging trong phiên này.
- Bật Confirm email, SMTP, Site URL và Redirect URLs phải cấu hình trong Supabase Dashboard.
- Cần TURN server và thông tin cấu hình phù hợp để kiểm thử WebRTC qua mạng di động, NAT đối xứng và mạng doanh nghiệp. Hiện cấu hình client mới khai báo STUN công cộng.
- Kênh broadcast phòng thoại và cuộc gọi 1-1 cần được chuyển sang private channel có Realtime Authorization; không thể coi trường `from` trong payload là xác thực.
- `content_reports` hiện chỉ hỗ trợ moment, bình luận moment, bài/bình luận cộng đồng và hồ sơ/bài hồ sơ; chưa hỗ trợ báo cáo tin nhắn riêng.
- Trang cài đặt đã giải thích rằng xóa tài khoản cần Edge Function/API phía máy chủ, nhưng chưa có luồng xóa hoàn chỉnh.
- Chưa có xác nhận độ tuổi, trang Điều khoản/Chính sách quyền riêng tư/Quy tắc cộng đồng hoàn chỉnh. Các nội dung này cần chủ dự án xác định chính sách và yêu cầu pháp lý áp dụng, không nên tự điền điều khoản giả định.
- Chưa có chính sách MFA/assurance-level bắt buộc cho admin trong mã được kiểm tra.

## Cảnh báo vận hành

Không chạy migration trên production chỉ vì bộ kiểm tra tĩnh đạt. Trước khi áp dụng migration mới, sao lưu database, thử trên staging và xác nhận các luồng đăng nhập, hồ sơ, bạn bè, tin nhắn, báo cáo, admin, avatar và thoại bằng các tài khoản có vai trò khác nhau.
