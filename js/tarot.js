import { supabase } from "./supabase.js";

const $ = (id) => document.getElementById(id);
const STORAGE_BASE = "connect:tarot-history:v2";
const TOPICS = {
  general: { label: "Tổng quan", intro: "Hãy đón nhận thông điệp như một góc nhìn mới để suy ngẫm." },
  love: { label: "Tình cảm & kết nối", intro: "Một lời nhắc để lắng nghe cảm xúc, giao tiếp chân thành và tôn trọng ranh giới." },
  work: { label: "Công việc & mục tiêu", intro: "Một gợi ý để nhìn lại ưu tiên, nguồn lực và bước tiến tiếp theo." },
  self: { label: "Bản thân & phát triển", intro: "Một khoảng dừng để nhận ra nhu cầu và khả năng phát triển của chính mình." }
};
const POSITIONS = { single: ["Thông điệp dành cho bạn"], three: ["Điều đã qua", "Điều đang diễn ra", "Hướng bạn có thể cân nhắc"] };
const ARCANA = [
 {n:"The Fool",v:"Kẻ Khờ",s:"✧",k:"Khởi đầu · Tin tưởng · Khám phá",m:"Một hành trình mới có thể bắt đầu từ bước nhỏ và sự tò mò chân thành. Bạn không cần biết hết mọi câu trả lời mới được phép tiến lên.",love:"Cho phép một kết nối phát triển tự nhiên; đừng vội gắn nhãn hay đặt kỳ vọng quá sớm.",work:"Thử một ý tưởng mới ở quy mô nhỏ, đồng thời chuẩn bị phương án và học hỏi từ trải nghiệm.",self:"Hãy dành chỗ cho sự tò mò, vui chơi và những trải nghiệm giúp bạn nhìn thế giới khác đi.",q:"Bước đầu tiên nào khiến bạn thấy háo hức nhưng vẫn còn ngần ngại?"},
 {n:"The Magician",v:"Nhà Ảo Thuật",s:"✴",k:"Chủ động · Năng lực · Sáng tạo",m:"Bạn có thể đang sở hữu nhiều nguồn lực hơn mình nghĩ. Kết hợp những gì sẵn có và biến ý định thành hành động cụ thể.",love:"Sự chủ động và cách bày tỏ rõ ràng có thể mở ra cuộc trò chuyện ý nghĩa.",work:"Tập trung vào thế mạnh, chọn một mục tiêu đo lường được và bắt đầu bằng nguồn lực hiện có.",self:"Nhận diện kỹ năng của mình và thử dùng chúng theo một cách sáng tạo hơn.",q:"Bạn đang có nguồn lực nào mà chưa tận dụng hết?"},
 {n:"The High Priestess",v:"Nữ Tư Tế",s:"☾",k:"Trực giác · Tĩnh lặng · Thấu hiểu",m:"Không phải câu trả lời nào cũng xuất hiện trong sự vội vã. Tạm lắng lại, quan sát cảm xúc và phân biệt trực giác với nỗi lo.",love:"Lắng nghe điều mình thật sự cảm nhận, nhưng hãy trao đổi thẳng thắn thay vì suy đoán ý người khác.",work:"Thu thập thêm thông tin và quan sát những điều chưa được nói rõ trước khi quyết định.",self:"Tạo một khoảng riêng để viết nhật ký, nghỉ ngơi hoặc thực hành chánh niệm.",q:"Nếu tạm gác tiếng ồn bên ngoài, điều gì đang cần bạn chú ý?"},
 {n:"The Empress",v:"Hoàng Hậu",s:"❀",k:"Nuôi dưỡng · Sáng tạo · Đủ đầy",m:"Sự phát triển bền vững cần được nuôi dưỡng. Hãy chăm sóc điều quan trọng bằng sự kiên nhẫn và lòng trân trọng.",love:"Một kết nối ấm áp lớn lên nhờ sự quan tâm đều đặn và cảm giác an toàn từ cả hai phía.",work:"Cho ý tưởng thời gian phát triển; đầu tư vào chất lượng và môi trường làm việc lành mạnh.",self:"Chăm sóc cơ thể, không gian sống và những hoạt động khiến bạn cảm thấy được nâng đỡ.",q:"Điều gì trong cuộc sống đang cần được bạn chăm sóc nhiều hơn?"},
 {n:"The Emperor",v:"Hoàng Đế",s:"♜",k:"Cấu trúc · Trách nhiệm · Ranh giới",m:"Một nền tảng rõ ràng giúp bạn vững vàng. Đặt giới hạn phù hợp, sắp xếp ưu tiên và chịu trách nhiệm với lựa chọn của mình.",love:"Thống nhất kỳ vọng và ranh giới để hai người cảm thấy được tôn trọng.",work:"Lập kế hoạch thực tế, xác định vai trò và chia mục tiêu lớn thành các mốc nhỏ.",self:"Xây dựng thói quen ổn định thay vì chỉ dựa vào động lực nhất thời.",q:"Ranh giới hoặc cấu trúc nào sẽ giúp bạn cảm thấy vững vàng hơn?"},
 {n:"The Hierophant",v:"Giáo Hoàng",s:"✥",k:"Tri thức · Giá trị · Người dẫn đường",m:"Bạn có thể tìm thấy giá trị trong việc học hỏi từ kinh nghiệm, cộng đồng hoặc một hệ thống đã được kiểm chứng — nhưng hãy giữ tư duy độc lập.",love:"Chia sẻ những giá trị nền tảng và thảo luận xem hai người mong đợi điều gì ở một mối quan hệ.",work:"Tìm người cố vấn, học quy trình tốt và chọn phương pháp phù hợp với hoàn cảnh của mình.",self:"Khám phá niềm tin cốt lõi: điều gì thực sự là giá trị của bạn, điều gì chỉ là thói quen tiếp nhận?",q:"Giá trị nào bạn muốn giữ vững trong giai đoạn này?"},
 {n:"The Lovers",v:"Những Người Yêu",s:"♡",k:"Kết nối · Lựa chọn · Hòa hợp",m:"Sự hòa hợp đến từ lựa chọn có ý thức. Thành thật với mong muốn của mình và tôn trọng sự khác biệt.",love:"Nuôi dưỡng kết nối bằng sự đồng thuận, giao tiếp chân thành và lựa chọn từ hai phía.",work:"Cân nhắc lựa chọn dựa trên giá trị dài hạn, không chỉ sức hấp dẫn trước mắt.",self:"Tìm sự thống nhất giữa điều bạn tin, điều bạn nói và điều bạn làm.",q:"Lựa chọn nào phản ánh đúng nhất những giá trị bạn trân trọng?"},
 {n:"The Chariot",v:"Cỗ Xe",s:"☄",k:"Ý chí · Tập trung · Tiến bước",m:"Năng lượng sẽ hiệu quả hơn khi có hướng đi. Chọn một ưu tiên, giữ nhịp độ phù hợp và điều chỉnh khi cần.",love:"Chủ động nói về hướng đi chung, nhưng đừng biến mối quan hệ thành cuộc đua phải đạt đích.",work:"Giảm việc phân tán, xác định tiêu chí hoàn thành và theo dõi tiến độ từng tuần.",self:"Kiên trì với mục tiêu nhưng linh hoạt với phương pháp và nhịp nghỉ ngơi.",q:"Một mục tiêu quan trọng nhất mà bạn muốn tập trung lúc này là gì?"},
 {n:"Strength",v:"Sức Mạnh",s:"♌",k:"Can đảm · Dịu dàng · Kiên nhẫn",m:"Sức mạnh không nhất thiết phải ồn ào. Sự bình tĩnh, lòng trắc ẩn và khả năng điều tiết cảm xúc cũng là bản lĩnh.",love:"Sự dịu dàng đi cùng ranh giới rõ ràng giúp hai người xử lý bất đồng lành mạnh hơn.",work:"Giữ bình tĩnh trước áp lực, giải quyết từng vấn đề thay vì phản ứng vội vàng.",self:"Đối xử với bản thân như cách bạn sẽ động viên một người bạn thân.",q:"Bạn có thể tử tế với chính mình hơn ở điểm nào?"},
 {n:"The Hermit",v:"Ẩn Sĩ",s:"☼",k:"Chiêm nghiệm · Độc lập · Sáng tỏ",m:"Một khoảng lặng có thể giúp bạn nghe rõ tiếng nói bên trong. Tạm rút khỏi sự xao nhãng để xác định điều thật sự quan trọng.",love:"Giữ không gian cá nhân lành mạnh và chia sẻ nhu cầu đó với người đồng hành.",work:"Dành thời gian rà soát chất lượng công việc và tìm câu trả lời trước khi nhận thêm việc.",self:"Một buổi đi bộ, đọc sách hoặc viết nhật ký có thể giúp bạn kết nối lại với mình.",q:"Bạn cần tạm lùi lại khỏi điều gì để nhìn rõ hơn?"},
 {n:"Wheel of Fortune",v:"Bánh Xe Số Phận",s:"◉",k:"Chu kỳ · Thay đổi · Thích nghi",m:"Hoàn cảnh luôn chuyển động. Hãy nhận diện điều nằm trong khả năng kiểm soát và giữ sự linh hoạt trước phần còn lại.",love:"Mối quan hệ có thể đi qua những giai đoạn khác nhau; trò chuyện giúp hai người thích nghi cùng nhau.",work:"Chuẩn bị cho thay đổi bằng cách cập nhật kỹ năng và tránh đặt mọi kế hoạch vào một giả định.",self:"Nhìn lại chu kỳ cũ để nhận ra điều nên tiếp tục và điều đã đến lúc khép lại.",q:"Điều gì bạn có thể chủ động, và điều gì cần học cách đón nhận?"},
 {n:"Justice",v:"Công Lý",s:"⚖",k:"Cân bằng · Rõ ràng · Trách nhiệm",m:"Hãy nhìn vấn đề bằng dữ kiện và sự công bằng. Mỗi lựa chọn đều có hệ quả, vì vậy sự rõ ràng rất quan trọng.",love:"Trao đổi công bằng về nhu cầu, trách nhiệm và những điều khiến mỗi người cảm thấy chưa được lắng nghe.",work:"Dựa trên tiêu chí minh bạch, ghi nhận đóng góp và xử lý vấn đề bằng dữ liệu.",self:"Thành thật với quyết định của mình mà không tự phán xét quá khắt khe.",q:"Bạn cần nhìn nhận sự việc công bằng hơn ở khía cạnh nào?"},
 {n:"The Hanged Man",v:"Người Treo Ngược",s:"⟡",k:"Góc nhìn · Tạm dừng · Buông bỏ",m:"Khi tiến lên chưa hiệu quả, thử thay đổi góc nhìn. Tạm dừng không đồng nghĩa với bỏ cuộc; đôi khi đó là cách tạo không gian cho nhận thức mới.",love:"Thử lắng nghe câu chuyện từ góc nhìn của người kia mà không phủ nhận cảm xúc của mình.",work:"Đánh giá lại cách làm hiện tại; một quy trình khác có thể tiết kiệm nhiều nguồn lực.",self:"Cho phép bản thân nghỉ ngơi và buông một kỳ vọng không còn phù hợp.",q:"Nếu nhìn vấn đề từ một góc độ hoàn toàn khác, bạn sẽ thấy gì?"},
 {n:"Death",v:"Chuyển Hóa",s:"♧",k:"Khép lại · Chuyển đổi · Tái sinh",m:"Lá bài tượng trưng cho sự kết thúc của một giai đoạn và cơ hội tạo chỗ cho điều mới — không phải điềm báo về cái chết.",love:"Nhận diện khuôn mẫu cũ cần thay đổi để kết nối có thể phát triển lành mạnh hơn.",work:"Hoàn tất hoặc dừng một cách làm không còn hiệu quả để dành nguồn lực cho hướng phù hợp hơn.",self:"Từ bỏ một định nghĩa cũ về bản thân nếu nó không còn phản ánh con người bạn hôm nay.",q:"Điều gì đã hoàn thành vai trò của nó và có thể được khép lại?"},
 {n:"Temperance",v:"Tiết Độ",s:"⚗",k:"Điều hòa · Kiên nhẫn · Hài hòa",m:"Những điều khác biệt có thể cùng tồn tại khi được điều chỉnh khéo léo. Tìm nhịp độ vừa sức thay vì chọn cực đoan.",love:"Tôn trọng khác biệt và tìm thỏa hiệp mà không đánh mất nhu cầu cốt lõi.",work:"Cân bằng tiến độ, chất lượng và nguồn lực để tránh kiệt sức.",self:"Tạo thói quen nhỏ có thể duy trì lâu dài thay vì thay đổi mọi thứ cùng lúc.",q:"Bạn đang cần điều chỉnh điều gì để cuộc sống cân bằng hơn?"},
 {n:"The Devil",v:"Bóng Tối",s:"⛓",k:"Ràng buộc · Nhận diện · Tự do",m:"Hãy quan sát thói quen hoặc nỗi sợ đang giới hạn lựa chọn. Nhận diện chúng là bước đầu để tìm lại quyền chủ động.",love:"Phân biệt sự gắn bó lành mạnh với kiểm soát; tôn trọng tự do và ranh giới của nhau.",work:"Nhận ra cam kết hoặc thói quen làm bạn mắc kẹt và tìm một bước tháo gỡ thực tế.",self:"Quan sát điều khiến bạn lệ thuộc mà không tự trách; tìm hỗ trợ khi cần.",q:"Thói quen nào đang lấy đi nhiều tự do hoặc năng lượng của bạn?"},
 {n:"The Tower",v:"Tòa Tháp",s:"ϟ",k:"Thức tỉnh · Sự thật · Tái thiết",m:"Một nhận thức mới đôi khi làm lung lay giả định cũ. Hãy kiểm tra sự thật, giữ an toàn và xây lại nền tảng vững chắc.",love:"Khi có bất đồng, ưu tiên sự thật và an toàn cảm xúc thay vì né tránh vấn đề.",work:"Nếu kế hoạch không còn phù hợp, đánh giá rủi ro và xây phương án thay thế từng bước.",self:"Cho phép mình thay đổi quan điểm khi có thông tin mới; điều đó không làm giảm giá trị của bạn.",q:"Giả định nào bạn cần kiểm tra lại bằng sự thật?"},
 {n:"The Star",v:"Ngôi Sao",s:"✦",k:"Hy vọng · Chữa lành · Cảm hứng",m:"Hãy giữ lại một tia hy vọng thực tế. Những hành động nhỏ, đều đặn có thể giúp bạn lấy lại cảm hứng và niềm tin.",love:"Sự chân thành và an toàn cảm xúc tạo điều kiện để niềm tin được vun đắp.",work:"Nhắc lại lý do bạn bắt đầu và chia mục tiêu dài hạn thành bước có thể thực hiện ngay.",self:"Tìm hoạt động giúp bạn hồi phục năng lượng và kết nối với điều đem lại ý nghĩa.",q:"Điều nhỏ bé nào đang giúp bạn có thêm hy vọng?"},
 {n:"The Moon",v:"Mặt Trăng",s:"☽",k:"Cảm xúc · Mơ hồ · Khám phá",m:"Khi mọi thứ chưa rõ ràng, đừng vội kết luận. Kiểm chứng thông tin và chăm sóc cảm xúc trước khi đưa ra quyết định lớn.",love:"Không suy diễn ý định của người khác; hãy hỏi và lắng nghe để làm rõ điều chưa chắc chắn.",work:"Xác minh dữ liệu, làm rõ kỳ vọng và tránh quyết định dựa trên tin đồn.",self:"Ghi nhận nỗi lo nhưng không xem mọi suy nghĩ lo âu là sự thật.",q:"Điều gì đang khiến bạn chưa nhìn rõ tình huống?"},
 {n:"The Sun",v:"Mặt Trời",s:"☀",k:"Niềm vui · Rõ ràng · Sức sống",m:"Hãy ghi nhận những điều đang diễn ra tốt đẹp. Sự rõ ràng và niềm vui giản dị có thể tiếp thêm năng lượng cho hành trình.",love:"Chia sẻ niềm vui, dành thời gian chất lượng và thể hiện sự trân trọng.",work:"Ghi nhận tiến bộ của nhóm và trình bày ý tưởng một cách sáng rõ.",self:"Cho phép mình tận hưởng thành quả mà không cần chờ mọi thứ hoàn hảo.",q:"Thành quả nào gần đây bạn chưa dành thời gian ghi nhận?"},
 {n:"Judgement",v:"Phán Xét",s:"♢",k:"Tỉnh thức · Đánh giá · Tiếng gọi",m:"Đây là lúc nhìn lại trải nghiệm bằng sự trưởng thành. Học từ quá khứ mà không để nó định nghĩa toàn bộ tương lai.",love:"Nhìn lại điều đã học từ các kết nối trước và xác định cách bạn muốn yêu thương lành mạnh hơn.",work:"Đánh giá kết quả, rút kinh nghiệm và quyết định điều gì xứng đáng được tiếp tục.",self:"Tha thứ cho phiên bản cũ của mình và chọn hành động phù hợp với nhận thức hiện tại.",q:"Bạn đã trưởng thành hơn từ trải nghiệm nào?"},
 {n:"The World",v:"Thế Giới",s:"◎",k:"Hoàn thành · Tích hợp · Mở rộng",m:"Một chặng đường có thể đang đi đến điểm tổng kết. Hãy ghi nhận điều đã học và chọn cách mở rộng hành trình tiếp theo.",love:"Trân trọng sự đồng hành và cùng nhau xác định chương tiếp theo theo mong muốn của cả hai.",work:"Tổng kết dự án, lưu lại bài học và xác định bước phát triển tiếp theo.",self:"Nhìn nhận bản thân như một hành trình đang tiếp diễn, không phải một đích đến cố định.",q:"Bạn muốn mang theo bài học nào sang chặng đường tiếp theo?"}
];

let userId = null;
let history = [];
let lastReading = null;
let remoteAvailable = false;
const topicText = (card, topic) => topic === "general" ? card.m : card[topic];
const safeDate = (value) => { const d = new Date(value); return Number.isNaN(d.getTime()) ? "Vừa xong" : d.toLocaleString("vi-VN", { dateStyle:"medium", timeStyle:"short" }); };
const storageKey = () => `${STORAGE_BASE}:${userId || "guest"}`;
function readLocal() { try { const value = JSON.parse(localStorage.getItem(storageKey()) || "[]"); return Array.isArray(value) ? value : []; } catch { return []; } }
function writeLocal() { try { localStorage.setItem(storageKey(), JSON.stringify(history.slice(0, 30))); } catch (e) { console.warn("Không lưu được lịch sử Tarot trên thiết bị:", e); } }
function makeId() { return globalThis.crypto?.randomUUID?.() || `tarot-${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function shufflePick(count) { const pool = [...ARCANA]; const picked = []; while (picked.length < count && pool.length) picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]); return picked; }
function element(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
function renderCard(card, position, topic, index) {
 const article = element("article", "tarot-reading-card");
 const positionLabel = element("span", "tarot-position", position); article.append(positionLabel);
 const visual = element("div", "tarot-revealed-card"); visual.style.setProperty("--card-index", String(index));
 visual.append(element("span", "tarot-revealed-symbol", card.s), element("small", "tarot-arcana-number", `ARCANA ${String(ARCANA.indexOf(card)).padStart(2,"0")}`), element("strong", "tarot-arcana-name", card.n), element("b", "tarot-arcana-vn", card.v), element("span", "tarot-arcana-stars", "✦ · ☾ · ✧"));
 article.append(visual, element("h4", "tarot-card-title", card.v), element("span", "tarot-card-keywords", card.k), element("p", "tarot-card-message", topicText(card, topic)), element("p", "tarot-card-reflection", `✧ Gợi ý suy ngẫm: ${card.q}`));
 return article;
}
function renderReading(record) {
 const root = $("tarotReading"); if (!root) return; root.replaceChildren(); root.hidden = false;
 const head = element("div", "tarot-reading-intro"); head.append(element("span", "eyebrow", "YOUR COSMIC MESSAGE"), element("h3", "", record.spread_type === "three" ? "Hành trình qua ba lá bài" : "Lá bài dành cho bạn"), element("p", "", `${TOPICS[record.topic]?.label || TOPICS.general.label} · ${TOPICS[record.topic]?.intro || TOPICS.general.intro}`)); root.append(head);
 const grid = element("div", `tarot-reading-grid ${record.spread_type === "three" ? "is-three" : "is-single"}`);
 (record.cards || []).forEach((card, i) => grid.append(renderCard(card, (POSITIONS[record.spread_type] || POSITIONS.single)[i] || "Thông điệp", record.topic, i)));
 root.append(grid);
 const foot = element("p", "tarot-reading-footnote", "Hãy xem đây là chất liệu để tự suy ngẫm. Bạn luôn là người quyết định lựa chọn của mình."); root.append(foot);
 root.scrollIntoView({behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block:"nearest"});
}
function renderHistory() {
 const list = $("tarotHistoryList"); if (!list) return; list.replaceChildren();
 if (!history.length) { list.append(element("p", "tarot-history-empty", "Những lá bài bạn đã rút sẽ xuất hiện tại đây.")); return; }
 history.slice(0, 12).forEach(record => {
  const item = element("button", "tarot-history-item"); item.type = "button"; item.setAttribute("aria-label", `Mở trải bài ${safeDate(record.created_at)}`);
  const symbols = element("span", "tarot-history-symbols", (record.cards || []).map(c => c.s).join(" "));
  const copy = element("span", "tarot-history-copy"); copy.append(element("strong", "", (record.cards || []).map(c => c.v).join(" · ")), element("small", "", `${record.spread_type === "three" ? "Trải ba lá" : "Một lá"} · ${TOPICS[record.topic]?.label || "Tổng quan"} · ${safeDate(record.created_at)}`));
  item.append(symbols, copy, element("span", "tarot-history-arrow", "↗")); item.addEventListener("click", () => { lastReading = record; renderReading(record); }); list.append(item);
 });
}
function normalizeRecord(row) { return { id: row.id || makeId(), spread_type: row.spread_type === "three" ? "three" : "single", topic: TOPICS[row.topic] ? row.topic : "general", cards: Array.isArray(row.cards) ? row.cards : [], created_at: row.created_at || new Date().toISOString() }; }
async function loadHistory() {
 history = readLocal();
 if (userId) {
  try {
   const { data, error } = await supabase.from("tarot_readings").select("id,spread_type,topic,cards,created_at").order("created_at", {ascending:false}).limit(30);
   if (error) throw error;
   remoteAvailable = true;
   const merged = new Map(); [...(data || []).map(normalizeRecord), ...history.map(normalizeRecord)].forEach(item => merged.set(item.id, item));
   history = [...merged.values()].sort((a,b) => new Date(b.created_at)-new Date(a.created_at)).slice(0,30); writeLocal();
   $("tarotStorageNote").textContent = "Đã đồng bộ lịch sử với tài khoản Connect của bạn.";
  } catch (error) {
   remoteAvailable = false;
   $("tarotStorageNote").textContent = "Lịch sử đang được lưu trên thiết bị này. Chạy migration 021_tarot_readings.sql để bật đồng bộ theo tài khoản.";
   console.info("Tarot cloud history chưa sẵn sàng; dùng lưu trữ cục bộ:", error.message);
  }
 } else {
  $("tarotStorageNote").textContent = "Bạn đang dùng chế độ khách. Đăng nhập để có thể đồng bộ lịch sử giữa các thiết bị sau khi bật lưu trữ Supabase.";
 }
 renderHistory();
}
async function saveReading(record) {
 history = [record, ...history.filter(x => x.id !== record.id)].slice(0,30); writeLocal(); renderHistory();
 if (!userId) return;
 try {
  const { error } = await supabase.from("tarot_readings").insert({ id: record.id, user_id: userId, spread_type: record.spread_type, topic: record.topic, cards: record.cards, created_at: record.created_at });
  if (error) throw error;
  remoteAvailable = true; $("tarotStorageNote").textContent = "Đã lưu và đồng bộ trải bài vào tài khoản Connect.";
 } catch (error) {
  remoteAvailable = false; $("tarotStorageNote").textContent = "Đã lưu trên thiết bị. Để đồng bộ tài khoản, hãy chạy migration 021_tarot_readings.sql trong Supabase.";
  console.info("Không thể đồng bộ Tarot lên Supabase:", error.message);
 }
}
function draw() {
 const spread = $("tarotSpread").value; const topic = $("tarotTopic").value; const count = spread === "three" ? 3 : 1;
 const button = $("drawTarot"); button.disabled = true; button.textContent = "✧ Đang xáo bài…";
 const stage = $("tarotDeckStage"); stage.classList.remove("is-shuffling","is-revealed"); void stage.offsetWidth; stage.classList.add("is-shuffling");
 window.setTimeout(() => {
  const cards = shufflePick(count); const record = { id:makeId(), spread_type:spread, topic, cards, created_at:new Date().toISOString() };
  lastReading = record; stage.classList.remove("is-shuffling"); stage.classList.add("is-revealed");
  $("tarotInstruction").textContent = "Thông điệp đã mở ra. Hãy đọc chậm và chọn điều phù hợp với trải nghiệm của bạn.";
  renderReading(record); saveReading(record).finally(() => { button.disabled = false; button.textContent = "✦ Rút một trải bài mới"; });
 }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 1050);
}
function resetReading() { $("tarotReading").hidden = true; $("tarotReading").replaceChildren(); $("tarotDeckStage").classList.remove("is-shuffling","is-revealed"); $("tarotInstruction").textContent = "Hít thở chậm, nghĩ về điều bạn muốn khám phá rồi bắt đầu rút bài."; $("drawTarot").disabled = false; $("drawTarot").textContent = "✦ Xáo bài & rút bài"; }
async function clearHistory() {
 if (!history.length) return;
 if (!window.confirm("Bạn muốn xóa toàn bộ lịch sử rút bài trên thiết bị này và tài khoản Connect (nếu đã đồng bộ)?")) return;
 history = []; writeLocal(); renderHistory();
 if (userId && remoteAvailable) {
  const { error } = await supabase.from("tarot_readings").delete().eq("user_id", userId);
  if (error) { $("tarotStorageNote").textContent = "Đã xóa lịch sử trên thiết bị, nhưng chưa thể xóa bản đồng bộ. Vui lòng thử lại sau."; return; }
 }
 $("tarotStorageNote").textContent = "Lịch sử rút bài đã được xóa.";
}
async function init() {
 if (!$('drawTarot')) return;
 try { const { data } = await supabase.auth.getUser(); userId = data?.user?.id || null; } catch { userId = null; }
 $("drawTarot").addEventListener("click", draw);
 $("resetTarot").addEventListener("click", resetReading);
 $("clearTarotHistory").addEventListener("click", clearHistory);
 $("tarotSpread").addEventListener("change", () => { resetReading(); $("tarotInstruction").textContent = $("tarotSpread").value === "three" ? "Ba lá bài sẽ lần lượt gợi mở điều đã qua, hiện tại và hướng bạn có thể cân nhắc." : "Hãy tập trung vào một câu hỏi hoặc chủ đề bạn muốn chiêm nghiệm."; });
 await loadHistory();
}
init().catch(error => console.error("Không thể khởi tạo Tarot Connect:", error));
