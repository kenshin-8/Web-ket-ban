
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY.");
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const zodiacSigns = [
  "Bạch Dương", "Kim Ngưu", "Song Tử", "Cự Giải",
  "Sư Tử", "Xử Nữ", "Thiên Bình", "Thiên Yết",
  "Nhân Mã", "Ma Kết", "Bảo Bình", "Song Ngư"
];

const defaultInterests = [
  ["sách", "âm nhạc", "du lịch"],
  ["công nghệ", "nhiếp ảnh", "cà phê"],
  ["thể thao", "phim ảnh", "khám phá"],
  ["thiên văn", "khoa học", "sáng tạo"]
];

async function getAllUsers() {
  const users = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000
    });

    if (error) throw error;

    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }

  return users;
}

async function main() {
  const users = await getAllUsers();

  const bots = users.filter(user => {
    const email = user.email?.toLowerCase() || "";
    return user.user_metadata?.test_account === true &&
      (email.startsWith("connect-test-") ||
       email.startsWith("connect-e2e-"));
  });

  console.log(`Tìm thấy ${bots.length} tài khoản bot.`);

  if (bots.length !== 20) {
    throw new Error(
      `Dừng để tránh cập nhật nhầm: tìm thấy ${bots.length}/20 bot.`
    );
  }

  let success = 0;
  const errors = [];

  for (let i = 0; i < bots.length; i++) {
    const user = bots[i];

    try {
      const { data: oldProfile, error: readError } =
        await supabase.from("profiles")
          .select("*")
          .eq("id", user.id)
          .maybeSingle();

      if (readError) throw readError;

      const old = oldProfile || {};
      const name =
        old.display_name?.trim() ||
        user.user_metadata?.username ||
        user.email.split("@")[0];

      const interests =
        Array.isArray(old.interests) && old.interests.length
          ? old.interests
          : defaultInterests[i % defaultInterests.length];

      const bio =
        old.bio?.trim() ||
        `Xin chào! Mình là ${name}, thích kết nối, chia sẻ và khám phá những điều mới.`;

      const profile = {
        id: user.id,
        display_name: name,
        headline:
          old.headline?.trim() ||
          `Khám phá, kết nối và chia sẻ cùng cộng đồng Connect`,
        city: old.city?.trim() || "Hà Nội",
        bio,
        interests,
        zodiac:
          old.zodiac ||
          zodiacSigns[i % zodiacSigns.length],
        soul_tags:
          Array.isArray(old.soul_tags) && old.soul_tags.length
            ? old.soul_tags
            : interests.slice(0, 3),
        is_visible: true,
        updated_at: new Date().toISOString()
      };

      const { error: saveError } =
        await supabase.from("profiles")
          .upsert(profile, { onConflict: "id" });

      if (saveError) throw saveError;

      success++;
      console.log(`OK ${success}/20: ${name} — Công khai`);
    } catch (error) {
      errors.push(`${user.email}: ${error.message}`);
      console.error(`Lỗi ${user.email}:`, error.message);
    }
  }

  console.log("\n===== KẾT QUẢ =====");
  console.log(`Hồ sơ cập nhật thành công: ${success}/20`);
  console.log(`Lỗi: ${errors.length}`);

  if (errors.length) {
    console.log(errors.join("\n"));
    process.exitCode = 1;
  }
}

main().catch(error => {
  console.error("Không thể hoàn thành:", error.message);
  process.exitCode = 1;
});
 