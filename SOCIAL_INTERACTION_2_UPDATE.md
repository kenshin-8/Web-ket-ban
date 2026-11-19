# Connect – Social Interaction 2.0

## Tính năng
- Thích/bỏ thích bài viết trên hồ sơ công khai.
- Bình luận và xóa bình luận do chính mình tạo.
- Chia sẻ liên kết bài viết bằng Web Share API; nếu không hỗ trợ thì sao chép liên kết.
- Chủ hồ sơ có khu vực xem thông báo khi có người thích hoặc bình luận bài viết; có thể đánh dấu đã đọc.
- Realtime cập nhật tương tác khi Supabase Realtime được bật.

## Cài đặt Supabase
1. Đảm bảo đã chạy `supabase/profile_social_identity.sql`.
2. Mở Supabase Dashboard → SQL Editor.
3. Chạy toàn bộ `supabase/profile_social_interactions.sql`.
4. Tải lại website và đăng nhập bằng hai tài khoản thử nghiệm.

## Kiểm thử đề xuất
1. Tài khoản A bật chia sẻ hồ sơ công khai và đăng bài viết.
2. Tài khoản B mở liên kết hồ sơ A, nhấn Thích và gửi bình luận.
3. Tài khoản A mở hồ sơ của mình, kiểm tra thông báo và đánh dấu đã đọc.
4. Tài khoản B thử bỏ thích; tài khoản A thử xóa bình luận của chính mình.
5. Dùng nút Chia sẻ để kiểm tra chức năng chia sẻ/sao chép liên kết.

## Quyền riêng tư
- Chỉ hồ sơ công khai mới cho người khác xem bài viết và tương tác.
- Hồ sơ riêng tư chỉ chủ tài khoản được xem nội dung hồ sơ của mình.
- Người dùng chỉ được xóa bình luận do chính họ tạo.
- Thông báo chỉ người nhận mới đọc và đánh dấu đã đọc được.
- SQL migration cần được chủ dự án chạy thủ công; mã nguồn không tự triển khai lên Supabase.
