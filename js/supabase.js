import { createClient } from
"https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm";

const SUPABASE_URL = "https://hitpdnyhmunamemtpbca.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_ZHQ1PfXw2bRoT0PHWoJTjA_wZX2qG76";

export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);

// Share one local session read across page modules. This prevents session.js,
// presence.js and avatar.js from competing for the Supabase Auth lock at startup.
let initialSessionPromise = null;
export function getInitialSession(timeoutMs = 20000) {
    if (initialSessionPromise) return initialSessionPromise;

    const readSession = Promise.resolve().then(async () => {
        let timer;
        const timeout = new Promise((_, reject) => {
            timer = window.setTimeout(() => reject(new Error(
                `Không đọc được phiên đăng nhập từ Supabase sau ${timeoutMs / 1000} giây. Hãy kiểm tra kết nối mạng hoặc tải lại trang.`
            )), timeoutMs);
        });
        try {
            const result = await Promise.race([supabase.auth.getSession(), timeout]);
            if (result.error) throw result.error;
            return result.data?.session || null;
        } finally {
            window.clearTimeout(timer);
        }
    });

    initialSessionPromise = readSession.catch(error => {
        initialSessionPromise = null;
        throw error;
    });
    return initialSessionPromise;
}
