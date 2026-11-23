# Connect Planet – cập nhật tiếp theo

## Mạng liên kết sở thích
- Bổ sung lớp SVG độc lập để hiển thị các đường nối giữa thành viên có sở thích chung.
- Đường nối xuất hiện khi chọn một Avatar, độ dày/độ sáng thay đổi theo số sở thích chung.
- SVG nằm trên lớp WebGL và dưới Avatar nên không bị bề mặt Three.js che khuất.
- Khi đóng thẻ hồ sơ hoặc bỏ chọn, các đường nối được xóa.

## Giữ nguyên
- Dữ liệu hồ sơ công khai lấy từ Supabase.
- Bộ lọc tìm kiếm và sở thích.
- Chọn Avatar, xem hồ sơ và Soul Match.
- Tương tác xoay/thu phóng tinh cầu và Canvas fallback.

## Kiểm tra
- Đã kiểm tra cú pháp JavaScript bằng Node.js.
- Đã kiểm tra ID HTML trùng lặp và cấu trúc ZIP.
- Chưa kiểm thử trực tiếp bằng tài khoản Supabase hoặc trình duyệt thật.


## Đã triển khai tiếp: Community Chat
Xem `changelog/COMMUNITY_CHAT_UPDATE.md` và chạy `supabase/migrations/006_community_chat.sql` sau `002_community_members.sql` để bật phòng chat thời gian thực.
