# Connect Universe – Avatar di chuyển trên tinh cầu

## Tính năng
- Thành viên đã đăng nhập sẽ thấy Avatar của mình xuất hiện trên bề mặt tinh cầu ở trang chủ.
- Di chuyển Avatar bằng phím W/A/S/D hoặc phím mũi tên khi con trỏ đang ở khu vực tinh cầu.
- Trên điện thoại có cụm nút điều hướng ngay bên dưới tinh cầu.
- Avatar dùng dữ liệu `avatar_data` hiện có trong hồ sơ; không tạo bảng mới và không cần migration SQL.
- Vị trí di chuyển hiện là trạng thái tạm thời trong phiên trang, chưa đồng bộ giữa các thiết bị và chưa lưu vào Supabase.

## Kiểm tra
- Đã kiểm tra cú pháp toàn bộ JavaScript bằng `node --check`.
- Đã kiểm tra 14 trang HTML: không phát hiện ID trùng hoặc tài nguyên nội bộ bị thiếu.
- Cần kiểm tra thực tế bằng tài khoản đã đăng nhập trong trình duyệt để xác nhận hồ sơ có quyền đọc `profiles.avatar_data`.
