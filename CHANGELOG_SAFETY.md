# Safety hardening — 19/11/2026
Mới: supabase/safety_hardening.sql, js/safety.js, css/safety.css.
Sửa: js/square.js, js/community-feed.js, js/public-profile.js, js/friends.js, js/match.js, js/contact.js, js/supabase.js, square.html, friends.html, index.html, README.md.
Hành vi thay đổi: "Gần bạn" hiển thị "Trong vòng X km quanh bạn" thay vì khoảng cách gần đúng.

# Gộp và dọn CSS — 19/11/2026
Gộp zodiac+polish -> theme.css; animations+planet-3d+universe -> home.css; xóa 150 khai báo chết; phông chữ chuyển sang <link>; safety.css nạp tĩnh. Chi tiết trong README.

# Trang quản trị báo cáo — 19/11/2026
Mới: admin.html, js/admin.js, css/admin.css, supabase/admin_moderation.sql (bảng admins, is_admin, admin_report_queue, admin_resolve_content; sửa ngưỡng tự ẩn chỉ tính báo cáo open).

# Đồng bộ giao diện — 19/11/2026
friends.html và public-profile.html nạp theme.css (+ Playfair). Sửa bố cục nút báo cáo/chặn trên mobile và nút báo cáo bài trên hồ sơ.
