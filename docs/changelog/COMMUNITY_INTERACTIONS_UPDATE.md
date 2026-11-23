# Connect – Social Interaction System

## Tính năng
- Thích/bỏ thích bài viết trong hành tinh; mỗi tài khoản chỉ có một lượt thích trên một bài.
- Hiển thị tổng lượt thích và trạng thái đã thích.
- Thông báo trong ứng dụng khi có người thích hoặc bình luận bài viết của bạn.
- Hiển thị số thông báo chưa đọc và cho phép đánh dấu đã đọc.
- Thông báo được tạo ở cơ sở dữ liệu bằng trigger; người dùng chỉ đọc và cập nhật trạng thái đọc của thông báo thuộc về mình.

## Cài đặt Supabase
Chạy theo thứ tự nếu chưa cài các phần trước:
1. `supabase/migrations/002_community_members.sql`
2. `supabase/migrations/004_community_feed.sql`
3. `supabase/migrations/005_community_interactions.sql`

Mở Supabase Dashboard → SQL Editor, dán nội dung từng tệp và nhấn Run. Tệp tương tác có thể chạy lại an toàn; các lệnh tạo policy/trigger đều dùng `drop if exists` trước khi tạo.

## Kiểm tra
1. Đăng nhập bằng tài khoản A, tham gia một hành tinh và đăng bài.
2. Đăng nhập bằng tài khoản B, tham gia cùng hành tinh, thích bài viết hoặc bình luận.
3. Trở lại tài khoản A, mở nút **Thông báo** để xem thông báo; chọn **Đánh dấu đã đọc** để xóa số chưa đọc.
4. Thử bỏ thích và tải lại trang để kiểm tra trạng thái được đồng bộ từ Supabase.

## Lưu ý
- Chỉ thành viên của hành tinh mới xem và tương tác với bài viết trong hành tinh đó.
- Tác giả không nhận thông báo khi tự thích hoặc tự bình luận bài viết của mình.
- Đây là thông báo trong ứng dụng, chưa phải thông báo đẩy của trình duyệt/email.
- Cần chạy SQL trên Supabase thật; việc đóng gói mã nguồn không tự thay đổi cơ sở dữ liệu từ xa.
