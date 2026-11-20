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

const runTag = Date.now().toString(36);
const rows = [];
const errors = [];

for (let i = 0; i < people.length; i++) {
  const [name, city, bio, interests, zodiac] = people[i];
  const number = String(i + 1).padStart(2, "0");
  const email = `connect-test-${runTag}-${number}@example.com`;
  const password = `Ct!${randomBytes(9).toString("base64url")}9a`;
  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { username: name, test_account: true }
    });
    if (error) throw error;

    const { error: profileError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      display_name: name,
      bio,
      interests,
      city,
      zodiac,
      is_visible: true
    }, { onConflict: "id" });

    if (profileError) {
      // Auth user was created; record it so it can be cleaned up manually if profile setup fails.
      rows.push({ number, name, email, password, user_id: data.user.id, status: `AUTH_CREATED_PROFILE_ERROR: ${profileError.message}` });
      errors.push(`${email}: profile: ${profileError.message}`);
    } else {
      rows.push({ number, name, email, password, user_id: data.user.id, status: "created" });
      console.log(`OK ${number}/20 ${email}`);
    }
  } catch (e) {
    errors.push(`${email}: ${e.message}`);
    rows.push({ number, name, email, password, user_id: "", status: `ERROR: ${e.message}` });
    console.error(`Lỗi ${number}/20: ${e.message}`);
  }
}

const headers = ["number","display_name","email","password","user_id","status"];
const csv = [headers.join(","), ...rows.map(r => headers.map(k => `"${String(r[k] ?? "").replaceAll('"','""')}"`).join(","))].join("\n");
writeFileSync("connect-test-accounts.csv", "\uFEFF" + csv, "utf8");
console.log(`\nHoàn tất: ${rows.filter(r => r.status === "created").length}/20 tài khoản tạo đủ cả Auth và profile.`);
console.log("Đã ghi connect-test-accounts.csv trong thư mục chạy script.");
if (errors.length) {
  console.error("\nCần xử lý các lỗi sau:\n" + errors.join("\n"));
  process.exitCode = 2;
}
