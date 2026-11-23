# Connect – Community Chat

## Tính năng
- Phòng chat riêng cho 6 hành tinh: Tech, Art, Music, Nature, Book và Sport.
- Lưu tin nhắn vào Supabase; tải tối đa 60 tin gần nhất.
- Nhận tin nhắn mới theo thời gian thực bằng Supabase Realtime.
- Presence hiển thị số người đang mở phòng chat và tên hiển thị của họ.
- Chèn nhanh emoji; giới hạn tin nhắn 1.000 ký tự.
- Chỉ thành viên đã đăng nhập và tham gia đúng hành tinh mới đọc/gửi tin nhắn được (RLS).

## Cài đặt Supabase
1. Mở Supabase Dashboard → SQL Editor.
2. Đảm bảo đã chạy `supabase/migrations/002_community_members.sql`.
3. Chạy toàn bộ `supabase/migrations/006_community_chat.sql`.
4. Trong Supabase Dashboard → Database → Replication/Realtime, xác nhận Realtime đang bật cho bảng `community_messages`. Migration SQL cũng tự thêm bảng vào publication `supabase_realtime` nếu publication tồn tại và bảng chưa có.
5. Tải lại Connect, đăng nhập, chọn một hành tinh và tham gia để mở phòng chat.

## Tệp mới / cập nhật
- `supabase/migrations/006_community_chat.sql`: bảng tin nhắn, index, RLS và publication Realtime.
- `js/community-chat.js`: tải lịch sử, gửi tin nhắn, realtime và presence.
- `index.html`: giao diện phòng chat và script module.
- `js/community-feed.js`: phát sự kiện khi chọn hành tinh để chat đồng bộ đúng phòng.
- `css/home.css`: giao diện responsive cho phòng chat.

## Lưu ý
- Cần chạy SQL trên đúng Supabase project của website; mã nguồn không tự thực hiện migration.
- Nếu Supabase Realtime chưa bật hoặc mạng chặn WebSocket, lịch sử vẫn tải được nhưng tin nhắn mới có thể không cập nhật trực tiếp.
- Presence chỉ phản ánh người đang mở phòng chat và đã kết nối Realtime, không phải trạng thái online toàn website.
- Chat hiện hỗ trợ văn bản và emoji; chưa hỗ trợ gửi ảnh, file, voice hay tin nhắn riêng.
