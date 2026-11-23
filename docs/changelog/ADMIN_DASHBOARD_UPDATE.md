# Connect Admin Dashboard

## Mới
- `admin.html` được thiết kế lại thành trang quản trị riêng (sidebar, phong cách Modern Cosmic), tách khỏi thanh điều hướng người dùng. Giao diện: `css/admin.css`; mã: `js/admin*.js`.
- Mục: Tổng quan, Tìm kiếm tài khoản (email/tên/ID, lọc, phân trang, xem email đăng ký đầy đủ, ngày đăng ký, trạng thái xác minh), Phân quyền Admin, Tài khoản bị khóa, Báo cáo nội dung (giữ nguyên chức năng cũ), Thống kê, Nhật ký hoạt động.
- Migration `020_admin_dashboard.sql`: vai trò owner/admin, bảng `account_locks`, `admin_activity_log` và các hàm `admin_*`.

## Bảo mật
- Mọi hàm `admin_*` kiểm tra `is_admin()` ở PostgreSQL; bảng `admins`, `account_locks`, nhật ký không có policy cho trình duyệt.
- Không có mật khẩu/băm mật khẩu trong bất kỳ kết quả nào; không dùng Service Role Key ở trình duyệt.
- Khóa tài khoản: đặt `banned_until`, thu hồi phiên, chặn insert/update/delete bằng policy restrictive, gỡ hồ sơ khỏi danh sách công khai (khôi phục khi mở khóa nếu trước đó công khai). Lý do khóa bắt buộc.
- Không tự khóa mình, không khóa admin (gỡ quyền trước), chỉ owner cấp/gỡ quyền, không gỡ owner, chỉ cấp cho tài khoản đã xác minh email.
- Nhật ký ghi khóa, mở khóa, cấp/gỡ quyền và cả việc mở chi tiết tài khoản (có hiển thị email).

## Giới hạn đã biết
- Access token đã cấp vẫn dùng được tối đa đến khi hết hạn (mặc định 1 giờ); trong thời gian đó người bị khóa không ghi được vào bảng, nhưng RPC `security definer` do người dùng gọi vẫn có thể chạy. Có thể rút ngắn thời hạn JWT ở Supabase Dashboard.
- Chưa kiểm thử trên dự án Supabase hay trình duyệt thật; mới kiểm tra cú pháp JavaScript và ID HTML.
