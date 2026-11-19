import { supabase } from "./supabase.js";
import { OPTIONS, defaultAvatar, applyAvatar, randomAvatar, sanitizeAvatar } from "./avatar-data.js";

const avatarCanvas = document.getElementById("avatarCanvas");
const saveAvatar = document.getElementById("saveAvatar");
const avatarMessage = document.getElementById("avatarMessage");
const host = document.getElementById("optionsHost");
const randomButton = document.getElementById("randomAvatar");
const resetButton = document.getElementById("resetAvatar");
const downloadButton = document.getElementById("downloadAvatar");

let state = { ...defaultAvatar };
let currentUser = null;
const getAvatarData = () => sanitizeAvatar(state);
const updateAvatar = () => applyAvatar(avatarCanvas, state);
const syncers = [];

function setMessage(message, type = "info") {
    avatarMessage.textContent = message;
    avatarMessage.dataset.type = type;
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
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        currentUser = data.user;
        if (!currentUser) {
            setMessage("Bạn có thể thiết kế thử. Hãy đăng nhập để lưu Avatar.");
            return;
        }

        const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("avatar_data")
            .eq("id", currentUser.id)
            .maybeSingle();
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
    saveAvatar.disabled = true;
    setMessage("Đang lưu Avatar...");

    try {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = authData?.user;
        if (!user) {
            setMessage("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại rồi lưu Avatar.", "error");
            return;
        }

        const avatar_data = getAvatarData();
        const now = new Date().toISOString();

        // Upsert theo ID giúp xử lý an toàn cả hồ sơ đã tồn tại và hồ sơ chưa được tạo.
        // Chỉ gửi các cột cần thiết để không ghi đè tên, bio hay cài đặt hồ sơ hiện tại.
        const { data: savedProfile, error: saveError } = await supabase
            .from("profiles")
            .upsert(
                { id: user.id, avatar_data, updated_at: now },
                { onConflict: "id" }
            )
            .select("id, avatar_data")
            .single();

        if (saveError) {
            if (saveError.code === "42501" || /row-level security|permission denied/i.test(saveError.message || "")) {
                throw new Error("Supabase đang từ chối quyền lưu hồ sơ. Hãy kiểm tra policy profiles_insert_own và profiles_update_own trong SQL Editor.");
            }
            if (saveError.code === "42P01") {
                throw new Error("Không tìm thấy bảng profiles. Hãy kiểm tra schema Connect trong Supabase.");
            }
            if (saveError.code === "42703" || /avatar_data/i.test(saveError.message || "")) {
                throw new Error("Cột avatar_data chưa tồn tại trong bảng profiles. Hãy cập nhật schema Connect trong Supabase.");
            }
            throw saveError;
        }

        if (!savedProfile || savedProfile.id !== user.id || !savedProfile.avatar_data) {
            throw new Error("Supabase chưa xác nhận dữ liệu Avatar đã được ghi. Vui lòng thử lại.");
        }

        currentUser = user;
        // Chỉ đồng bộ sang các trang khác sau khi Supabase xác nhận lưu thành công.
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
