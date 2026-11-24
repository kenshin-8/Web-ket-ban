# Connect – cập nhật tinh gọn trang chủ

## Thay đổi
- Rút chiều cao hero trang chủ; giữ nguyên nội dung giới thiệu và hai CTA hiện có.
- Giảm khoảng đệm khu vực các hành tinh cộng đồng.
- Thu gọn chiều cao render của tinh cầu 3D đồng bộ giữa canvas 2D và WebGL để giữ vị trí Avatar/điểm tương tác chính xác.
- Gom phần giới thiệu, bộ tìm cung hoàng đạo và biểu mẫu liên hệ vào mục mở rộng “Khám phá thêm về Connect”. Các ID và script hiện có được giữ lại.
- Bỏ CTA “Đi đến Khám phá” bị trùng với nút Khám phá cộng đồng ở hero.
- Bỏ nhóm “Cá nhân” khỏi menu điều hướng chính. Hồ sơ và chỉnh sửa Avatar vẫn truy cập được từ menu tài khoản và liên kết chỉnh sửa Avatar trên trang Hồ sơ.

## Phạm vi không thay đổi
- Không xóa trang HTML hoặc dữ liệu.
- Không thay đổi schema, migration, cấu hình hay dữ liệu Supabase.
- Không xóa các script chức năng của cộng đồng, tinh cầu, cung hoàng đạo hoặc biểu mẫu liên hệ.

## Kiểm tra
- Đã kiểm tra cú pháp các file JavaScript trong thư mục `js`.
- Đã kiểm tra cấu trúc HTML của trang chủ và các ID chức năng chính.
- Chưa kiểm thử giao diện thực tế trên trình duyệt hoặc kết nối Supabase.
