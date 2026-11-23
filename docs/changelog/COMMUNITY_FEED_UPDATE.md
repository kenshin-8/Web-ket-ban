# Connect – Community Feed Update

## Tính năng
- Mỗi hành tinh có bảng tin riêng.
- Thành viên đã tham gia hành tinh có thể đăng bài văn bản (tối đa 2.000 ký tự).
- Thành viên có thể xem và gửi bình luận (tối đa 1.000 ký tự).
- Người đăng có thể xóa bài viết của chính mình.
- Nội dung được hiển thị bằng `textContent`, không diễn giải nội dung người dùng thành HTML.
- Bài đăng và bình luận chỉ đọc được bởi thành viên của hành tinh tương ứng theo Row Level Security.

## Cài đặt Supabase
1. Mở Supabase Dashboard → SQL Editor.
2. Đảm bảo đã chạy `supabase/migrations/002_community_members.sql`.
3. Chạy tiếp toàn bộ `supabase/migrations/004_community_feed.sql`.
4. Tải lại Connect, đăng nhập, chọn một hành tinh và tham gia cộng đồng.
5. Thử đăng bài và bình luận.

## Cấu trúc dữ liệu
- `community_posts`: bài đăng theo `community_id`.
- `community_comments`: bình luận gắn với bài đăng và cộng đồng.
- RLS yêu cầu người đăng/bình luận là thành viên của đúng cộng đồng.
- Người dùng chỉ được xóa bài/bình luận do chính mình tạo.

## Giới hạn phiên bản
- Bảng tin hiện hỗ trợ văn bản, chưa hỗ trợ ảnh/video/đính kèm.
- Chưa có sửa bài, thích bài, báo cáo nội dung hoặc thông báo đẩy.
- Cần chạy SQL migration thủ công trong Supabase; đóng gói ZIP không tự thay đổi cơ sở dữ liệu đang chạy.
