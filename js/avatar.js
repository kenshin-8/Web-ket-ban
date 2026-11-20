import { supabase, getInitialSession } from "./supabase.js";
import { OPTIONS, defaultAvatar, applyAvatar, randomAvatar, sanitizeAvatar } from "./avatar-data.js";
import { renderAvatarHologram } from "./avatar-hologram.js";

const avatarCanvas = document.getElementById("avatarCanvas");
const saveAvatar = document.getElementById("saveAvatar");
const avatarMessage = document.getElementById("avatarMessage");
const host = document.getElementById("optionsHost");
const randomButton = document.getElementById("randomAvatar");
const resetButton = document.getElementById("resetAvatar");
const downloadButton = document.getElementById("downloadAvatar");

let state = { ...defaultAvatar };
let currentUser = null;
let updateHologram = null;
const getAvatarData = () => sanitizeAvatar(state);
const updateAvatar = () => {
    applyAvatar(avatarCanvas, state);
    updateHologram?.(state);
};

const hologramHost = document.getElementById("studioAvatarHologram");
if (hologramHost) {
    updateHologram = renderAvatarHologram(hologramHost, state, "bạn");
}
const syncers = [];

function setMessage(message, type = "info") {
    if (!avatarMessage) return;
    avatarMessage.textContent = message;
    avatarMessage.dataset.type = type;
}

async function withRequestTimeout(request, stage, milliseconds = 15000) {
    let timer;
    const timeout = new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error(`Hết thời gian chờ khi ${stage} (${milliseconds / 1000} giây).`)), milliseconds);
    });
    try {
        return await Promise.race([request, timeout]);
    } finally {
        window.clearTimeout(timer);
    }
}

function buildOptions() {
    for (const opt of OPTIONS) {
        const group = document.createElement("div");
        group.className = "option-group";
        const label = document.createElement("label");
        label.textContent = opt.label;
        group.appendChild(label);

        if (opt.type === "select") {
            const select = document.createElement("select");
            select.id = `opt-${opt.key}`;
            label.htmlFor = select.id;
            opt.values.forEach(([value, text]) => select.add(new Option(text, value)));
            select.addEventListener("change", () => {
                state[opt.key] = select.value;
                updateAvatar();
            });
            syncers.push(() => { select.value = state[opt.key]; });
            group.appendChild(select);
        } else {
            const row = document.createElement("div");
            row.className = "swatches";
            const buttons = opt.values.map(([value, name]) => {
                const button = document.createElement("button");
                button.type = "button";
                button.className = "swatch";
                button.style.background = opt.key === "bg" ? name : value;
                button.setAttribute("aria-label", `${opt.label}: ${opt.key === "bg" ? value : name}`);
                button.addEventListener("click", () => {
                    state[opt.key] = value;
                    syncAll();
                    updateAvatar();
                });
                row.appendChild(button);
                return [value, button];
            });
            syncers.push(() => buttons.forEach(([value, button]) => {
                button.setAttribute("aria-pressed", String(value === state[opt.key]));
            }));
            group.appendChild(row);
        }
        host.appendChild(group);
    }
}

function syncAll() {
    syncers.forEach(sync => sync());
}

function setAvatar(data) {
    state = sanitizeAvatar(data);
    syncAll();
    updateAvatar();
}

async function loadAvatar() {
    setAvatar(defaultAvatar);
    try {
        // Dùng phiên INITIAL_SESSION dùng chung, tránh tranh chấp Auth lock với các module khác.
        const session = await withRequestTimeout(getInitialSession(), "khởi tạo phiên đăng nhập", 25000);
        currentUser = session?.user || null;
        if (!currentUser) {
            setMessage("Bạn có thể thiết kế thử. Hãy đăng nhập để lưu Avatar.");
            return;
        }

        const { data: profile, error: profileError } = await withRequestTimeout(
            supabase.from("profiles").select("avatar_data").eq("id", currentUser.id).maybeSingle(),
            "tải Avatar từ bảng profiles"
        );
        if (profileError) throw profileError;
        if (profile?.avatar_data) {
            setAvatar(profile.avatar_data);
            setMessage("Đã tải Avatar đã lưu của bạn.", "success");
        } else {
            setMessage("Bạn chưa có Avatar. Hãy bắt đầu thiết kế nhé!");
        }
    } catch (error) {
        console.error("Lỗi tải Avatar:", error);
        setMessage("Không thể tải Avatar đã lưu. Bạn vẫn có thể thiết kế và thử lại.", "error");
    }
}

async function saveCurrentAvatar() {
    if (!saveAvatar) return;
    if (saveAvatar.dataset.saving === "true") return;
    saveAvatar.dataset.saving = "true";
    saveAvatar.disabled = true;
    setMessage("Đang lưu Avatar...", "info");

    try {
        // Lấy user từ session local. Lệnh ghi bên dưới vẫn được Supabase xác thực bằng access token + RLS.
        const session = await withRequestTimeout(getInitialSession(), "khởi tạo phiên đăng nhập", 25000);
        const user = session?.user;
        if (!user) {
            throw new Error("Không tìm thấy phiên đăng nhập hợp lệ. Hãy đăng xuất rồi đăng nhập lại.");
        }

        const avatar_data = getAvatarData();
        const now = new Date().toISOString();

        // Một lệnh upsert xử lý cả hồ sơ đã tồn tại và hồ sơ chưa được tạo.
        // Timeout đảm bảo giao diện không bị kẹt mãi ở trạng thái Đang lưu.
        const request = supabase
            .from("profiles")
            .upsert({ id: user.id, avatar_data, updated_at: now }, { onConflict: "id" })
            .select("id, avatar_data")
            .single();
        const { data: savedProfile, error: saveError } = await withRequestTimeout(
            request,
            "ghi Avatar vào bảng public.profiles (cột avatar_data)"
        );

        if (saveError) {
            if (saveError.code === "42501" || /row-level security|permission denied/i.test(saveError.message || "")) {
                throw new Error("Supabase từ chối quyền ghi profiles.avatar_data (RLS/GRANT). Hãy kiểm tra đã chạy supabase/voice_avatar_repair_v2.sql trên đúng project chưa.");
            }
            if (saveError.code === "42P01") throw new Error("Không tìm thấy bảng profiles trong Supabase.");
            if (saveError.code === "42703" || /avatar_data/i.test(saveError.message || "")) {
                throw new Error("Bảng profiles chưa có cột avatar_data. Hãy chạy schema.sql và voice_avatar_repair_v2.sql trên đúng project.");
            }
            if (saveError.code === "PGRST116") {
                throw new Error("Supabase đã ghi nhưng không đọc lại được dòng hồ sơ. Kiểm tra policy SELECT của profiles.");
            }
            throw saveError;
        }

        if (!savedProfile || savedProfile.id !== user.id || !savedProfile.avatar_data) {
            throw new Error("Máy chủ chưa xác nhận Avatar đã được lưu. Vui lòng thử lại.");
        }

        currentUser = user;
        try {
            localStorage.setItem("connect:avatar-updated", JSON.stringify({
                userId: user.id,
                avatarData: savedProfile.avatar_data,
                updatedAt: now
            }));
        } catch (storageError) {
            console.warn("Không thể phát tín hiệu đồng bộ Avatar:", storageError);
        }
        window.dispatchEvent(new CustomEvent("connect:avatar-updated", {
            detail: { userId: user.id, avatarData: savedProfile.avatar_data, updatedAt: now }
        }));
        setMessage("Đã lưu Avatar vào tài khoản thành công!", "success");
    } catch (error) {
        console.error("Lỗi lưu Avatar:", error);
        setMessage(`Lưu Avatar thất bại: ${error.message || "Lỗi không xác định"}`, "error");
    } finally {
        saveAvatar.dataset.saving = "false";
        saveAvatar.disabled = false;
    }
}

function downloadPng() {
    if (!avatarCanvas) return;
    const clone = avatarCanvas.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", "720");
    clone.setAttribute("height", "900");
    const svgText = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const image = new Image();

    image.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 720;
        canvas.height = 900;
        const context = canvas.getContext("2d");
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(svgUrl);
        canvas.toBlob(blob => {
            if (!blob) {
                setMessage("Không thể tạo ảnh PNG trên trình duyệt này.", "error");
                return;
            }
            const pngUrl = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = pngUrl;
            link.download = "connect-avatar.png";
            link.click();
            URL.revokeObjectURL(pngUrl);
            setMessage("Đã xuất Avatar thành ảnh PNG.", "success");
        }, "image/png");
    };
    image.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        setMessage("Xuất ảnh thất bại. Hãy thử lại.", "error");
    };
    image.src = svgUrl;
}

buildOptions();
randomButton?.addEventListener("click", () => {
    setAvatar(randomAvatar());
    setMessage("Đã tạo một Avatar ngẫu nhiên.");
});
resetButton?.addEventListener("click", () => {
    setAvatar(defaultAvatar);
    setMessage("Đã khôi phục Avatar mặc định. Nhấn Lưu Avatar để cập nhật tài khoản.");
});
downloadButton?.addEventListener("click", downloadPng);
saveAvatar?.addEventListener("click", saveCurrentAvatar);
loadAvatar();
