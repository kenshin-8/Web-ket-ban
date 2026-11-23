-- Connect: đồng bộ quyền riêng tư khi chặn người dùng theo cả hai chiều.
-- Chạy SAU toàn bộ migration hiện có, đặc biệt 010_safety_hardening.sql,
-- 004_community_feed.sql, 006_community_chat.sql, 007_profile_social_identity.sql,
-- 008_profile_social_interactions.sql và 009_notification_presence.sql.
-- Có thể chạy lại an toàn; không xóa dữ liệu.

-- Hàm is_blocked_between() được định nghĩa trong 010_safety_hardening.sql.
-- Các policy dưới đây dùng hàm SECURITY DEFINER đó để tránh vòng lặp RLS
-- khi đọc user_blocks.

-- 1) Bảng tin hành tinh: thành viên chỉ đọc bài/bình luận nếu không bị chặn
--    theo bất kỳ chiều nào với tác giả.
drop policy if exists "community_posts_read_members" on public.community_posts;
create policy "community_posts_read_members" on public.community_posts
  for select to authenticated using (
    exists (
      select 1 from public.community_members cm
      where cm.community_id = community_posts.community_id
        and cm.user_id = auth.uid()
    )
    and not public.is_blocked_between(auth.uid(), community_posts.author_id)
  );

drop policy if exists "community_comments_read_members" on public.community_comments;
create policy "community_comments_read_members" on public.community_comments
  for select to authenticated using (
    exists (
      select 1 from public.community_members cm
      where cm.community_id = community_comments.community_id
        and cm.user_id = auth.uid()
    )
    and not public.is_blocked_between(auth.uid(), community_comments.author_id)
  );

-- 2) Chat hành tinh: không đọc tin nhắn từ người đã chặn mình hoặc mình đã chặn.
drop policy if exists "community_messages_read_members" on public.community_messages;
create policy "community_messages_read_members" on public.community_messages
  for select to authenticated using (
    exists (
      select 1 from public.community_members cm
      where cm.community_id = community_messages.community_id
        and cm.user_id = auth.uid()
    )
    and not public.is_blocked_between(auth.uid(), community_messages.user_id)
  );

-- 3) Bài đăng hồ sơ: hồ sơ công khai vẫn xem được với khách chưa đăng nhập;
--    tài khoản đã đăng nhập áp dụng quy tắc chặn hai chiều.
drop policy if exists "profile_posts_read_public_or_own" on public.profile_posts;
create policy "profile_posts_read_public_or_own" on public.profile_posts
  for select to anon, authenticated using (
    user_id = auth.uid()
    or (
      exists (select 1 from public.profiles p where p.id = user_id and p.is_visible = true)
      and (auth.uid() is null or not public.is_blocked_between(auth.uid(), user_id))
    )
  );

-- 4) Tương tác hồ sơ: ẩn lượt thích/bình luận có liên quan đến người bị chặn,
--    đồng thời ngăn tạo tương tác mới qua quan hệ đã bị chặn.
drop policy if exists "profile_post_likes_read_visible" on public.profile_post_likes;
create policy "profile_post_likes_read_visible" on public.profile_post_likes
  for select to anon, authenticated using (
    exists (
      select 1 from public.profile_posts pp
      join public.profiles owner_profile on owner_profile.id = pp.user_id
      where pp.id = profile_post_likes.post_id
        and (owner_profile.is_visible = true or pp.user_id = auth.uid())
        and (auth.uid() is null or not public.is_blocked_between(auth.uid(), pp.user_id))
        and (auth.uid() is null or not public.is_blocked_between(auth.uid(), profile_post_likes.user_id))
    )
  );
drop policy if exists "profile_post_likes_insert_visible" on public.profile_post_likes;
create policy "profile_post_likes_insert_visible" on public.profile_post_likes
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.profile_posts pp
      join public.profiles p on p.id = pp.user_id
      where pp.id = profile_post_likes.post_id
        and p.is_visible = true and pp.user_id <> auth.uid()
        and not public.is_blocked_between(auth.uid(), pp.user_id)
    )
  );

drop policy if exists "profile_post_comments_read_visible" on public.profile_post_comments;
create policy "profile_post_comments_read_visible" on public.profile_post_comments
  for select to anon, authenticated using (
    exists (
      select 1 from public.profile_posts pp
      join public.profiles owner_profile on owner_profile.id = pp.user_id
      where pp.id = profile_post_comments.post_id
        and (owner_profile.is_visible = true or pp.user_id = auth.uid())
        and (auth.uid() is null or not public.is_blocked_between(auth.uid(), pp.user_id))
        and (auth.uid() is null or not public.is_blocked_between(auth.uid(), profile_post_comments.user_id))
    )
  );
drop policy if exists "profile_post_comments_insert_visible" on public.profile_post_comments;
create policy "profile_post_comments_insert_visible" on public.profile_post_comments
  for insert to authenticated with check (
    user_id = auth.uid() and exists (
      select 1 from public.profile_posts pp
      join public.profiles p on p.id = pp.user_id
      where pp.id = profile_post_comments.post_id
        and (p.is_visible = true or pp.user_id = auth.uid())
        and not public.is_blocked_between(auth.uid(), pp.user_id)
    )
  );

-- 5) Lời mời kết bạn và tin nhắn riêng: chặn cả đọc lẫn gửi khi một bên đã chặn.
drop policy if exists "friend_requests_read_participants" on public.friend_requests;
create policy "friend_requests_read_participants" on public.friend_requests
  for select to authenticated using (
    (requester_id = auth.uid() or recipient_id = auth.uid())
    and not public.is_blocked_between(auth.uid(),
      case when requester_id = auth.uid() then recipient_id else requester_id end)
  );

drop policy if exists "direct_messages_read_friends" on public.direct_messages;
create policy "direct_messages_read_friends" on public.direct_messages
  for select to authenticated using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and not public.is_blocked_between(auth.uid(),
      case when sender_id = auth.uid() then recipient_id else sender_id end)
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.requester_id = direct_messages.sender_id and fr.recipient_id = direct_messages.recipient_id)
          or (fr.requester_id = direct_messages.recipient_id and fr.recipient_id = direct_messages.sender_id))
        and (fr.requester_id = auth.uid() or fr.recipient_id = auth.uid())
    )
  );

-- 6) Ẩn thông báo tương tác do người bị chặn tạo ra.
drop policy if exists "community_notifications_read_own" on public.community_notifications;
create policy "community_notifications_read_own" on public.community_notifications
  for select to authenticated using (
    recipient_id = auth.uid()
    and (actor_id is null or not public.is_blocked_between(auth.uid(), actor_id))
  );
drop policy if exists "profile_post_notifications_read_own" on public.profile_post_notifications;
create policy "profile_post_notifications_read_own" on public.profile_post_notifications
  for select to authenticated using (
    recipient_id = auth.uid()
    and (actor_id is null or not public.is_blocked_between(auth.uid(), actor_id))
  );

-- Giữ nguyên quyền update cột read_at đã được cấp trong các migration gốc.

-- 7) Trạng thái online và thông báo kết bạn/tin nhắn cũng không tiết lộ
--    hoạt động của người đang có quan hệ chặn với tài khoản hiện tại.
drop policy if exists "notifications_read_own" on public.notifications;
create policy "notifications_read_own" on public.notifications
  for select to authenticated using (
    recipient_id = auth.uid()
    and (actor_id is null or not public.is_blocked_between(auth.uid(), actor_id))
  );
drop policy if exists "presence_read_self_or_friends" on public.user_presence;
create policy "presence_read_self_or_friends" on public.user_presence
  for select to authenticated using (
    user_id = auth.uid()
    or (
      not public.is_blocked_between(auth.uid(), user_id)
      and exists (
        select 1 from public.friend_requests fr
        where fr.status = 'accepted'
          and ((fr.requester_id = auth.uid() and fr.recipient_id = user_presence.user_id)
            or (fr.recipient_id = auth.uid() and fr.requester_id = user_presence.user_id))
      )
    )
  );

-- 8) Các luồng Quảng trường đã tồn tại cũng phải ẩn cuộc trò chuyện cũ
--    ngay khi một trong hai bên chặn người còn lại.
drop policy if exists "t_select" on public.moment_threads;
create policy "t_select" on public.moment_threads
  for select to authenticated using (public.thread_not_blocked(id));
drop policy if exists "msg_select" on public.moment_messages;
create policy "msg_select" on public.moment_messages
  for select to authenticated using (public.thread_not_blocked(thread_id));

-- 9) Không hiển thị lượt thích của tài khoản đã bị chặn trong bảng tin hành tinh.
drop policy if exists "community_post_likes_read_members" on public.community_post_likes;
create policy "community_post_likes_read_members" on public.community_post_likes
  for select to authenticated using (
    not public.is_blocked_between(auth.uid(), community_post_likes.user_id)
    and exists (
      select 1 from public.community_posts p
      join public.community_members cm on cm.community_id = p.community_id
      where p.id = community_post_likes.post_id and cm.user_id = auth.uid()
    )
  );
