# Connect Tarot Upgrade

## Features
- 22 lá Ẩn chính (Major Arcana) với diễn giải tiếng Việt.
- Trải một lá hoặc ba lá (điều đã qua / hiện tại / hướng cân nhắc).
- Chủ đề: tổng quan, tình cảm & kết nối, công việc & mục tiêu, bản thân & phát triển.
- Hiệu ứng xáo/lật bài, giao diện cosmic responsive và hỗ trợ reduced motion.
- Lịch sử gần nhất được lưu cục bộ; khi đăng nhập, ứng dụng thử đồng bộ với Supabase.
- Nếu bảng Supabase chưa được tạo, lịch sử vẫn hoạt động trên thiết bị và trang hiển thị hướng dẫn.

## Bật đồng bộ lịch sử qua Supabase
1. Mở Supabase Dashboard của dự án Connect.
2. Vào SQL Editor và chạy toàn bộ `supabase/migrations/021_tarot_readings.sql`.
3. Tải lại `icebreaker.html`, đăng nhập tài khoản và rút bài thử.
4. Khu vực lịch sử sẽ báo đã đồng bộ với tài khoản Connect.

Migration chỉ tạo bảng `tarot_readings` mới, bật RLS và giới hạn đọc/ghi/xóa theo `auth.uid()`. Không sửa các bảng hoặc migration hiện hữu.

## Lưu ý
- Không đăng nhập: lịch sử được lưu trong localStorage của trình duyệt hiện tại.
- Đã đăng nhập nhưng chưa chạy migration: vẫn lưu local; không mất chức năng rút bài.
- Nội dung Tarot chỉ phục vụ giải trí và tự suy ngẫm, không phải dự đoán hay tư vấn chuyên môn.
