import { supabase } from "./supabase.js";
import { PLANETS, QUESTIONS, scoreAnswers } from "./soul.js";
const form = document.getElementById("quizForm"), msg = document.getElementById("quizMessage"), result = document.getElementById("quizResult");
QUESTIONS.forEach((item, i) => {
    const set = document.createElement("fieldset"); set.className = "quiz-q";
    const lg = document.createElement("legend"); lg.textContent = `${i + 1}. ${item.text}`; set.appendChild(lg);
    item.options.forEach(([planet, label]) => {
        const l = document.createElement("label"); l.className = "q-opt";
        const r = document.createElement("input"); r.type = "radio"; r.name = "q" + i; r.value = planet; r.required = true;
        const s = document.createElement("span"); s.textContent = label; l.append(r, s); set.appendChild(l);
    });
    form.insertBefore(set, document.getElementById("quizSubmit"));
});
form.addEventListener("submit", async e => {
    e.preventDefault();
    const btn = document.getElementById("quizSubmit");
    const { data } = await supabase.auth.getUser();
    if (!data?.user) { msg.textContent = "Vui lòng đăng nhập để lưu kết quả."; return; }
    const { planet, scores } = scoreAnswers(QUESTIONS.map((_, i) => form.elements["q" + i].value));
    btn.disabled = true; msg.textContent = "Đang lưu...";
    const { error } = await supabase.from("profiles").upsert({ id: data.user.id, planet, soul_scores: scores, updated_at: new Date().toISOString() });
    btn.disabled = false;
    if (error) { console.error(error); msg.textContent = "Lưu thất bại: " + error.message; return; }
    msg.textContent = "";
    form.hidden = true; result.hidden = false;
    document.getElementById("resultIcon").textContent = PLANETS[planet].icon;
    document.getElementById("resultName").textContent = "Tinh cầu " + PLANETS[planet].name;
    document.getElementById("resultDesc").textContent = PLANETS[planet].desc;
});
