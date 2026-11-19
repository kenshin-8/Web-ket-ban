import { supabase } from "./supabase.js";

const { data } = await supabase.auth.getUser();
const user = data?.user;
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
