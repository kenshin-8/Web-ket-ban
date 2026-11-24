import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong biến môi trường.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const people = [
  ["An Nhiên", "Hà Nội", "Thích đọc sách, cà phê và đi bộ", ["sách","cà phê","du lịch"], "Thiên Bình"],
  ["Minh Khang", "Hồ Chí Minh", "Yêu công nghệ và bóng rổ", ["công nghệ","bóng rổ","âm nhạc"], "Bạch Dương"],
  ["Bảo Ngọc", "Đà Nẵng", "Nhiếp ảnh và những chuyến đi biển", ["nhiếp ảnh","biển","ẩm thực"], "Song Ngư"],
  ["Gia Huy", "Hải Phòng", "Thích game indie và phim khoa học viễn tưởng", ["game","phim","công nghệ"], "Bảo Bình"],
  ["Khánh Linh", "Cần Thơ", "Yêu mèo, cây xanh và làm bánh", ["thú cưng","làm bánh","thiên nhiên"], "Kim Ngưu"],
  ["Đức Anh", "Hà Nội", "Chạy bộ buổi sáng và nghe podcast", ["chạy bộ","podcast","sức khỏe"], "Nhân Mã"],
  ["Phương Thảo", "Huế", "Âm nhạc acoustic và nghệ thuật", ["âm nhạc","nghệ thuật","sách"], "Cự Giải"],
  ["Tuấn Kiệt", "Nha Trang", "Lặn biển và khám phá địa điểm mới", ["lặn biển","du lịch","thể thao"], "Sư Tử"],
  ["Mai Chi", "Đà Lạt", "Thích trồng cây và chụp ảnh film", ["cây xanh","nhiếp ảnh","cà phê"], "Xử Nữ"],
  ["Hoàng Long", "Bắc Ninh", "Đam mê lập trình và cờ vua", ["lập trình","cờ vua","game"], "Ma Kết"],
  ["Yến Nhi", "Hà Nội", "Thích thời trang tối giản và yoga", ["thời trang","yoga","du lịch"], "Song Tử"],
  ["Quốc Bảo", "Biên Hòa", "Bóng đá, xe đạp và âm nhạc", ["bóng đá","xe đạp","âm nhạc"], "Bạch Dương"],
  ["Hà My", "Vũng Tàu", "Thích viết nhật ký và ngắm hoàng hôn", ["viết lách","biển","sách"], "Thiên Yết"],
  ["Trọng Nghĩa", "Thủ Đức", "Thiết kế UI và sản phẩm số", ["thiết kế","công nghệ","game"], "Bảo Bình"],
  ["Ngọc Hân", "Quy Nhơn", "Ẩm thực địa phương và du lịch chậm", ["ẩm thực","du lịch","nhiếp ảnh"], "Kim Ngưu"],
  ["Nhật Minh", "Hà Nội", "Bơi lội, chạy trail và cắm trại", ["bơi lội","cắm trại","thể thao"], "Nhân Mã"],
  ["Thùy Dương", "Pleiku", "Thích nhạc indie và hội họa", ["âm nhạc","hội họa","cà phê"], "Song Ngư"],
  ["Thanh Tùng", "Long Xuyên", "Quan tâm khoa học và thiên văn", ["khoa học","thiên văn","sách"], "Ma Kết"],
  ["Diệu Anh", "Hội An", "Thích thủ công và khám phá văn hóa", ["thủ công","văn hóa","du lịch"], "Cự Giải"],
  ["Phúc An", "Hà Nội", "Yêu chó, chạy bộ và hoạt động cộng đồng", ["thú cưng","chạy bộ","cộng đồng"], "Sư Tử"]
];


const TARGET_TOTAL = 20;
const runTag = Date.now().toString(36);

const rows = [];
const errors = [];

async function getExistingBots() {
  const allUsers = [];
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 1000,
    });

    if (error) {
      throw new Error(`Không đọc được danh sách tài khoản: ${error.message}`);
    }

    const batch = data.users || [];
    allUsers.push(...batch);

    if (batch.length < 1000) break;
    page++;
  }

  return allUsers.filter((user) => {
    const email = user.email || "";
    const isConnectBot =
      email.startsWith("connect-e2e-") ||
      email.startsWith("connect-test-");

    return isConnectBot && user.user_metadata?.test_account === true;
  });
}

async function ensureProfile(user) {
  const { data: profile, error: checkError } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (checkError) {
    throw new Error(`Không kiểm tra được profile: ${checkError.message}`);
  }

  if (profile) return;

  const name =
    user.user_metadata?.username ||
    user.email?.split("@")[0] ||
    "Connect Bot";

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      display_name: name,
      city: "Việt Nam",
      bio: "Tài khoản tự động kiểm thử Connect",
      interests: ["kiểm thử", "công nghệ"],
      zodiac: "Bảo Bình",
      is_visible: true,
    },
    { onConflict: "id" }
  );

  if (error) {
    throw new Error(`Không tạo được profile cho ${name}: ${error.message}`);
  }
}

async function main() {
  const bots = await getExistingBots();

  console.log(`Đã tìm thấy ${bots.length}/20 bot hiện có.`);

  // Bảo đảm các bot cũ cũng có hồ sơ.
  for (const bot of bots) {
    try {
      await ensureProfile(bot);
    } catch (error) {
      errors.push(`${bot.email}: ${error.message}`);
    }
  }

  if (bots.length >= TARGET_TOTAL) {
    console.log("Đã đủ 20 bot. Không tạo thêm tài khoản.");
    return;
  }

  while (bots.length < TARGET_TOTAL) {
    const slot = bots.length + 1;
    const [baseName, city, bio, interests, zodiac] = people[slot - 1];

    const number = String(slot).padStart(2, "0");
    const name = `Bot ${number} - ${baseName}`;
    const email = `connect-test-${runTag}-${number}@example.com`;
    const password = `Ct!${randomBytes(12).toString("base64url")}9a`;

    console.log(`Đang tạo bot ${number}/20: ${name}`);

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        username: name,
        test_account: true,
      },
    });

    if (error) {
      errors.push(`${email}: ${error.message}`);
      console.error(`Không tạo được ${email}: ${error.message}`);
      break;
    }

    // Ghi nhận tài khoản ngay sau khi Auth tạo thành công.
    bots.push(data.user);

    const { error: profileError } = await supabase.from("profiles").upsert(
      {
        id: data.user.id,
        display_name: name,
        city,
        bio,
        interests,
        zodiac,
        is_visible: true,
      },
      { onConflict: "id" }
    );

    const status = profileError
      ? `AUTH_CREATED_PROFILE_ERROR: ${profileError.message}`
      : "created";

    rows.push({
      number,
      name,
      email,
      password,
      user_id: data.user.id,
      status,
    });

    if (profileError) {
      errors.push(`${email}: lỗi tạo profile: ${profileError.message}`);
      console.error(`Auth đã tạo nhưng profile lỗi: ${email}`);
    } else {
      console.log(`OK ${bots.length}/20 - ${email}`);
    }
  }

  // Xuất riêng thông tin các tài khoản vừa tạo.
  if (rows.length > 0) {
    const headers = [
      "number",
      "display_name",
      "email",
      "password",
      "user_id",
      "status",
    ];

    const csv = [
      headers.join(","),
      ...rows.map((row) =>
        headers
          .map((key) =>
            `"${String(row[key] ?? "").replaceAll('"', '""')}"`
          )
          .join(",")
      ),
    ].join("\n");

    const fileName = `connect-remaining-bots-${runTag}.csv`;

    writeFileSync(fileName, "\uFEFF" + csv, {
      encoding: "utf8",
      mode: 0o600,
    });

    console.log(`Đã lưu thông tin tài khoản mới vào ${fileName}`);
  }

  console.log("\n========== KẾT QUẢ ==========");
  console.log(`Tổng số bot Auth: ${bots.length}/20`);
  console.log(`Số bot vừa tạo: ${rows.length}`);
  console.log(
    `Số bot tạo đủ Auth và profile: ${
      rows.filter((row) => row.status === "created").length
    }`
  );

  if (errors.length) {
    console.error("\nCác lỗi cần xử lý:");
    errors.forEach((error) => console.error("- " + error));
    process.exitCode = 1;
  } else {
    console.log("Hoàn tất, không phát hiện lỗi.");
  }
}

main().catch((error) => {
  console.error("Lỗi:", error.message);
  process.exitCode = 1;
});
