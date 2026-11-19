import { supabase } from "./supabase.js";

const link = document.querySelector('.nav-links a[href="friends.html"]');
if (link) {
  const badge = document.createElement("span");
  badge.className = "nav-notification-count";
  badge.hidden = true;
  badge.setAttribute("aria-label", "Thông báo chưa đọc");
  link.append(badge);

  const { data: authData } = await supabase.auth.getUser();
  const user = authData?.user;
  if (user) {
    const refresh = async () => {
      const { count, error } = await supabase.from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id).eq("is_read", false);
      if (error) return;
      badge.textContent = count > 99 ? "99+" : String(count || 0);
      badge.hidden = !count;
    };
    await refresh();
    supabase.channel(`notification-badge-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `recipient_id=eq.${user.id}` }, refresh)
      .subscribe();
  } else {
    badge.remove();
  }
}
