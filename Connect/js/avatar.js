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
    saveAvatar.disabled = true;
    setMessage("Đang lưu Avatar...");
    try {
        const { data, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        const user = data.user;
        if (!user) {
            setMessage("Vui lòng đăng nhập trước khi lưu Avatar.", "error");
            return;
        }

        const avatar_data = getAvatarData();
        const { data: existing, error: readError } = await supabase
            .from("profiles").select("id").eq("id", user.id).maybeSingle();
        if (readError) throw readError;

        const now = new Date().toISOString();
        const result = existing
            ? await supabase.from("profiles").update({ avatar_data, updated_at: now }).eq("id", user.id)
            : await supabase.from("profiles").insert({
                id: user.id,
                display_name: user.user_metadata?.username || user.email?.split("@")[0] || "Thành viên",
                is_visible: false,
                avatar_data,
                updated_at: now
            });
        if (result.error) throw result.error;
        currentUser = user;
        setMessage("Đã lưu Avatar vào tài khoản thành công!", "success");
    } catch (error) {
        console.error("Lỗi lưu Avatar:", error);
        setMessage(`Lưu thất bại: ${error.message}`, "error");
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
