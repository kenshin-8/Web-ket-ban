# Avatar Hologram 3D – Connect

## Nội dung cập nhật

- Thêm khu vực Avatar Hologram trong trang hồ sơ cá nhân và hồ sơ công khai.
- Hologram sử dụng dữ liệu Avatar hiện có (`profiles.avatar_data`), không tạo bảng mới và không thay đổi quy trình lưu Avatar.
- Thêm phối cảnh CSS, vòng quỹ đạo, bệ hologram, hiệu ứng ánh sáng và parallax khi rê chuột.
- Thêm nút tạm dừng/tiếp tục hiệu ứng; tôn trọng thiết lập `prefers-reduced-motion` của thiết bị.
- Nâng cấp các nút Avatar thành viên trên tinh cầu Connect với vòng quỹ đạo và hiệu ứng chiều sâu.

## Tệp được thêm

- `js/avatar-hologram.js`
- `css/avatar-hologram.css`

## Tệp được cập nhật

- `profile.html`, `public-profile.html`
- `js/profile.js`, `js/public-profile.js`
- `css/public-profile.css`, `css/planet-3d.css`

## Cách sử dụng

1. Giải nén phiên bản mới và mở bằng Live Server.
2. Đăng nhập, mở **Hồ sơ cá nhân** để xem Avatar Hologram.
3. Rê chuột quanh khu vực hologram để thay đổi góc nhìn; nhấn nút để tạm dừng hoặc tiếp tục hiệu ứng.
4. Mở trang hồ sơ công khai để xem cách Avatar hiển thị với thành viên khác.

Không cần chạy migration Supabase mới cho tính năng này. Hologram chỉ trình bày dữ liệu Avatar đang có; tính năng lưu Avatar vẫn dùng cơ chế hiện tại.
