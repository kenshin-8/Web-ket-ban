# Profile 2.0 & Social Identity

## Tính năng
- Ảnh bìa hồ sơ: tải JPG/PNG/WebP tối đa 5 MB, xem trước và gỡ ảnh.
- Dòng giới thiệu ngắn (headline).
- Trang hồ sơ công khai riêng, hiển thị avatar, ảnh bìa, giới thiệu, sở thích, Soul Card, cung hoàng đạo và tinh cầu.
- Huy hiệu hồ sơ được tính từ dữ liệu thật đang có (avatar, bio, Soul Card, Soul Quiz, chia sẻ công khai), không phải điểm thưởng giả.
- Dòng thời gian: đăng, xem và xóa bài viết văn bản tối đa 500 ký tự.
- Trang Khám phá có liên kết tới trang hồ sơ.
- Hồ sơ tắt công khai không thể được người khác truy cập; chủ tài khoản vẫn xem trước được.

## Cài đặt
1. Mở Supabase Dashboard → SQL Editor.
2. Chạy `supabase/profile_social_identity.sql`.
3. Đảm bảo các migration nền trước đó của Connect đã được chạy.
4. Tải lại website, vào Hồ sơ cá nhân và thử tải ảnh bìa, lưu hồ sơ, đăng bài.
5. Bật “Hiển thị hồ sơ trong cộng đồng” để người khác xem trang hồ sơ.

## Ghi chú
- Cần chạy migration mới để có `headline`, `cover_url`, bucket `profile-covers` và bảng `profile_posts`.
- Không thể xác nhận thao tác upload/đọc/ghi thực tế cho tới khi migration được chạy trên Supabase của bạn.
