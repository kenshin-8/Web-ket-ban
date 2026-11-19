# Connect – sửa lỗi Avatar và Planet 3D

## 1. Đồng bộ Avatar trang cá nhân
- Sau khi lưu Avatar ở `avatar.html`, trang phát tín hiệu đồng bộ cho các tab Connect đang mở.
- `profile.js` nhận tín hiệu cùng tab, sự kiện `storage` giữa các tab, và tải lại `avatar_data` từ Supabase khi trang được hiển thị lại.
- Trước khi lưu các trường hồ sơ, trang đọc lại Avatar mới nhất để tránh ghi đè bằng dữ liệu cũ.

## 2. Tương tác tinh cầu
- Three.js thử tải từ jsDelivr; nếu thất bại sẽ thử CDN unpkg.
- Khi WebGL hoạt động: kéo trực tiếp trên tinh cầu để xoay, cuộn để phóng to/thu nhỏ; các nút +/- và đặt lại góc nhìn được đồng bộ với mô hình.
- Lớp Avatar DOM tiếp tục được định vị theo góc xoay để có thể chọn thành viên.
- Khi WebGL không tải được, Canvas dự phòng vẫn hỗ trợ kéo, thu phóng, chọn Avatar và có thêm các mảng lục địa.

## 3. Kiểm tra
Đã kiểm tra cú pháp JavaScript bằng Node.js và kiểm tra cấu trúc ZIP. Chưa kiểm thử end-to-end với tài khoản Supabase thật hoặc trình duyệt của người dùng; cần kiểm tra quyền đọc/ghi bảng `profiles` nếu dữ liệu vẫn không cập nhật.
