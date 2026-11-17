import { supabase } from "./supabase.js";
const form = document.getElementById("contactForm");
const message = document.getElementById("formMessage");
if (form && message) {
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector("button[type=submit]");
        const payload = {
            name: document.getElementById("contactName").value.trim(),
            email: document.getElementById("contactEmail").value.trim(),
            message: document.getElementById("contactMessage").value.trim()
        };
        if (!payload.name || !payload.message) { message.textContent = "Vui lòng nhập đầy đủ thông tin."; return; }
        button.disabled = true; message.textContent = "Đang gửi...";
        const { error } = await supabase.from("contact_messages").insert(payload); // không .select(): người gửi không được đọc lại
        button.disabled = false;
        if (error) { console.error(error); message.textContent = "Chưa gửi được lời nhắn. Vui lòng thử lại sau."; return; }
        message.textContent = "Cảm ơn bạn! Connect đã nhận được lời nhắn.";
        form.reset();
    });
}
