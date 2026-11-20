# Connect — ghi chú bản sửa

## Đã xử lý

1. **Chặn người dùng hai chiều:** thêm `supabase/block_visibility_fix.sql` để RLS lọc người chặn/người bị chặn ở cả hai chiều trên bài đăng và bình luận cộng đồng, chat hành tinh, bài đăng và tương tác hồ sơ, lời mời kết bạn, tin nhắn riêng, thông báo, trạng thái online và các cuộc trò chuyện Quảng trường đã tồn tại.
2. **Quyền riêng tư phía máy chủ:** các bộ lọc quan trọng được áp dụng bằng Row Level Security (RLS), không chỉ dựa vào JavaScript ở trình duyệt.
3. **Hướng dẫn cài đặt:** viết lại README với thứ tự migration, thiết lập Supabase, chạy website, tạo tài khoản thử nghiệm, kiểm thử tính năng và xử lý lỗi.
4. **Bảo vệ tệp nhạy cảm:** thêm `.gitignore` để tránh commit `.env`, `node_modules` và CSV chứa thông tin đăng nhập thử nghiệm.

## Kiểm tra đã thực hiện

- `node --check` cho 32 tệp JavaScript/module: đạt.
- Quét 14 trang HTML: không phát hiện ID trùng.
- Kiểm tra tài nguyên `src`/`href` nội bộ: không phát hiện đường dẫn thiếu.
- Kiểm tra cấu trúc ZIP: đạt.

## Giới hạn kiểm thử

- Chưa chạy migration trên Supabase thật và chưa kiểm thử RLS bằng hai tài khoản thực tế.
- Chưa xác nhận các luồng realtime, upload, camera/microphone và dữ liệu phụ thuộc quyền truy cập trình duyệt.
- Vì vậy, đây là kết quả kiểm tra mã nguồn tĩnh; sau khi giải nén, cần chạy `block_visibility_fix.sql` và thực hiện checklist trong README trên dự án Supabase của bạn.
