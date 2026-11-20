import { supabase, getInitialSession } from "./supabase.js";

let user = null;
try {
  const session = await getInitialSession();
  user = session?.user || null;
} catch (error) {
  console.debug("Presence: phiên đăng nhập chưa sẵn sàng:", error.message);
}
if (user) {
  let busy = false;
  const heartbeat = async () => {
    if (busy || document.visibilityState !== "visible") return;
    busy = true;
    const { error } = await supabase.from("user_presence").upsert(
      { user_id: user.id, last_seen: new Date().toISOString() },
      { onConflict: "user_id" }
    );
    if (error) console.debug("Presence heartbeat unavailable:", error.message);
    busy = false;
  };
  await heartbeat();
  const timer = window.setInterval(heartbeat, 45000);
  document.addEventListener("visibilitychange", heartbeat);
  window.addEventListener("pagehide", () => window.clearInterval(timer), { once: true });
}
