# Connect – Upgrade notes (18/11/2026)

## Đợt nâng cấp Connect Universe

### Đã triển khai
- Bổ sung tìm kiếm thành viên theo tên, thành phố và sở thích.
- Bổ sung bộ lọc sở thích lấy từ hồ sơ công khai thực tế.
- Bổ sung điều khiển tạm dừng/tiếp tục tự xoay và đặt lại góc nhìn tinh cầu.
- Khi chọn một thành viên, vẽ các đường hologram tới hồ sơ khác có sở thích chung.
- Tự dừng vòng lặp Canvas khi tab bị ẩn để giảm tải CPU/GPU.
- Bổ sung trạng thái focus bàn phím, nhãn truy cập và bố cục responsive cho thanh khám phá.
- Giữ nguyên luồng Supabase, Avatar SVG, Soul Match và bảng dữ liệu hiện có.

### Giới hạn đã biết
- Phiên bản ban đầu dùng Canvas 2D; bản cập nhật phía dưới bổ sung lớp Three.js/WebGL.
- Tìm kiếm/lọc áp dụng trên tối đa 60 hồ sơ tải về theo truy vấn hiện tại.
- Presence không được giả lập; trạng thái online vẫn chỉ hiển thị khi có tích hợp Presence thật.
- Không thay đổi schema hoặc RLS Supabase trong đợt này.

### Cách chạy và kiểm thử
1. Giải nén thư mục `Connect`.
2. Mở thư mục bằng VS Code và chạy `index.html` bằng Live Server (localhost), không mở bằng `file://`.
3. Kiểm tra tải hồ sơ công khai, tìm kiếm tên/sở thích, lọc sở thích, xoay/zoom/reset.
4. Chọn Avatar để kiểm tra thẻ thành viên, điểm tương hợp và nút thích.
5. Kiểm tra đăng nhập, Soul Match, Avatar Studio, Discover, Voice và Quảng trường để bảo đảm các luồng hiện có không bị ảnh hưởng.
6. Kiểm tra trên màn hình nhỏ và bật `prefers-reduced-motion` trong cài đặt hệ điều hành/trình duyệt.

## Nâng cấp Connect Planet bằng Three.js
- Thêm lớp WebGL/Three.js với hình cầu 3D, lưới hologram, khí quyển, quỹ đạo và nền sao.
- Giữ Canvas 2D hiện tại làm fallback khi WebGL hoặc CDN Three.js không khả dụng.
- Giữ lớp Avatar HTML tương tác ở phía trên tinh cầu để không thay đổi luồng chọn hồ sơ.
- Giới hạn pixel ratio, tạm dừng animation khi tab ẩn, hỗ trợ `prefers-reduced-motion` và giải phóng tài nguyên khi rời trang.
- Sửa lỗi thứ tự khai báo `rotateToggle` có thể gây `ReferenceError` khi bật chế độ giảm chuyển động.
