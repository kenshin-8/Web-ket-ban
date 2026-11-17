const words = [
 { clue:"Loài vật thường được gọi là “người bạn bốn chân” và thích đuổi bóng.", answer:"Chó", choices:["Chó","Mèo","Thỏ","Cá"] },
 { clue:"Đồ uống thường được pha từ lá, có thể uống nóng hoặc lạnh.", answer:"Trà", choices:["Nước cam","Trà","Sữa","Cacao"] },
 { clue:"Vật dụng có nhiều trang giấy, thường dùng để đọc hoặc học.", answer:"Sách", choices:["Đồng hồ","Bút","Sách","Cốc"] },
 { clue:"Nhạc cụ có phím đen và trắng, thường đặt trên giá.", answer:"Đàn piano", choices:["Trống","Sáo","Đàn piano","Đàn guitar"] },
 { clue:"Hiện tượng tự nhiên xuất hiện sau mưa, có nhiều màu sắc.", answer:"Cầu vồng", choices:["Sương mù","Cầu vồng","Tuyết","Gió"] }
];
const prompts = [
 "Nếu được học ngay một kỹ năng mới, bạn sẽ chọn kỹ năng nào?",
 "Bài hát nào gần đây khiến bạn muốn nghe đi nghe lại?",
 "Bạn thích một buổi cuối tuần yên tĩnh hay nhiều hoạt động?",
 "Có món ăn nào bạn có thể ăn nhiều lần mà không chán?",
 "Một bộ phim hoặc cuốn sách bạn muốn giới thiệu là gì?",
 "Nếu nuôi một con vật, bạn muốn chọn loài nào?",
 "Bạn thích ngắm bình minh hay hoàng hôn hơn?",
 "Một sở thích nhỏ giúp bạn thư giãn là gì?"
];
const tarot = [
 ["The Star · Ngôi Sao","Giữ hy vọng và dành thời gian nuôi dưỡng điều khiến bạn hứng khởi."],
 ["The Sun · Mặt Trời","Chú ý đến những niềm vui giản dị và chia sẻ năng lượng tích cực."],
 ["The Hermit · Ẩn Sĩ","Một khoảng lặng có thể giúp bạn lắng nghe suy nghĩ của chính mình."],
 ["The World · Thế Giới","Ghi nhận những tiến bộ nhỏ và sẵn sàng cho trải nghiệm mới."],
 ["Strength · Sức Mạnh","Sự kiên nhẫn và lòng tử tế cũng là những dạng sức mạnh."],
 ["The Magician · Nhà Ảo Thuật","Thử bắt đầu từ những nguồn lực và khả năng bạn đang có."]
];
const $ = id => document.getElementById(id);
let activeWord = null;
function newWord(){
 activeWord = words[Math.floor(Math.random()*words.length)];
 $("wordClue").textContent = activeWord.clue;
 $("wordFeedback").textContent = "";
 const wrap=$("wordOptions"); wrap.replaceChildren();
 [...activeWord.choices].sort(()=>Math.random()-.5).forEach(choice=>{
  const b=document.createElement("button"); b.type="button"; b.className="game-option"; b.textContent=choice;
  b.addEventListener("click",()=>{
   [...wrap.children].forEach(x=>x.disabled=true);
   if(choice===activeWord.answer){b.classList.add("correct");$("wordFeedback").textContent="Chính xác! Bạn đoán rất tốt.";}
   else {b.classList.add("wrong");$("wordFeedback").textContent=`Chưa đúng. Đáp án là: ${activeWord.answer}.`;}
  }); wrap.append(b);
 });
}
$("newWord").addEventListener("click",newWord);
$("newPrompt").addEventListener("click",()=>{
 const current=$("promptText").textContent;
 const choices=prompts.filter(x=>x!==current);
 $("promptText").textContent=choices[Math.floor(Math.random()*choices.length)];
 $("promptFeedback").textContent="";
});
$("copyPrompt").addEventListener("click",async()=>{
 try{await navigator.clipboard.writeText($("promptText").textContent);$("promptFeedback").textContent="Đã sao chép câu hỏi.";}
 catch{$("promptFeedback").textContent="Trình duyệt không cho phép sao chép. Bạn có thể chọn và copy câu hỏi.";}
});
$("drawTarot").addEventListener("click",()=>{
 const card=tarot[Math.floor(Math.random()*tarot.length)];
 const box=$("tarotResult"); box.replaceChildren();
 const icon=document.createElement("span");icon.textContent="✦";
 const title=document.createElement("strong");title.textContent=card[0];
 const desc=document.createElement("small");desc.textContent=card[1];
 box.append(icon,title,desc);
});
