// Nội dung chi tiết cho 12 cung hoàng đạo (mang tính tham khảo, giải trí)
export const ZODIAC_INFO = {
    "Bạch Dương": {
        g: "♈", range: "21/3 – 19/4", el: "Lửa",
        trait: "Nhiệt huyết, thẳng thắn và luôn là người dám bước trước. Bạch Dương có nguồn năng lượng dồi dào, thích thử thách và truyền cảm hứng hành động cho người xung quanh.",
        love: "Yêu hết mình, chủ động và không thích vòng vo. Bạn cần một người bạn đồng hành đủ năng động, biết tôn trọng sự độc lập và kiên nhẫn với tính nóng vội của bạn.",
        work: "Hợp với những môi trường cần quyết đoán và tốc độ: khởi nghiệp, kinh doanh, thể thao, dẫn dắt dự án. Bạn học nhanh nhất khi được thực hành thay vì chỉ nghe lý thuyết.",
        advice: "Hít một hơi thật sâu trước khi phản ứng. Lắng nghe trọn vẹn và hoàn thành việc dang dở sẽ giúp bạn đi xa hơn cả những cú bứt tốc."
    },
    "Kim Ngưu": {
        g: "♉", range: "20/4 – 20/5", el: "Đất",
        trait: "Điềm đạm, kiên định và rất đáng tin cậy. Kim Ngưu yêu cái đẹp, trân trọng sự thoải mái và có gu thưởng thức tinh tế, từ ẩm thực, âm nhạc đến không gian sống.",
        love: "Chậm rãi nhưng chân thành và bền bỉ. Bạn thể hiện tình cảm bằng sự chăm sóc cụ thể, và cần cảm giác an toàn, ổn định để mở lòng hoàn toàn.",
        work: "Làm việc bền bỉ, cẩn thận và có trách nhiệm. Phù hợp với tài chính, thiết kế, ẩm thực, nghệ thuật hoặc bất kỳ lĩnh vực nào đề cao chất lượng và sự bền vững.",
        advice: "Thử bước ra khỏi vùng quen thuộc mỗi tuần một chút. Sự thay đổi nhỏ không làm bạn mất đi sự ổn định, mà còn mở thêm cơ hội mới."
    },
    "Song Tử": {
        g: "♊", range: "21/5 – 20/6", el: "Khí",
        trait: "Hoạt bát, tò mò và có khiếu giao tiếp. Song Tử thích học điều mới, phản xạ nhanh, dí dỏm và dễ làm quen với đủ kiểu người.",
        love: "Cần một người bạn tâm giao để trò chuyện không ngừng. Bạn bị thu hút bởi trí tuệ và sự thú vị, nhưng cũng cần học cách ở lại với những cảm xúc sâu hơn.",
        work: "Tỏa sáng ở truyền thông, viết lách, giảng dạy, marketing, công nghệ. Bạn học tốt qua trao đổi, đa nhiệm giỏi nhưng cần giữ tập trung để theo đến cùng.",
        advice: "Chọn một vài mục tiêu quan trọng và đi sâu vào chúng. Sự tò mò của bạn là món quà, hãy biến nó thành chuyên môn."
    },
    "Cự Giải": {
        g: "♋", range: "21/6 – 22/7", el: "Nước",
        trait: "Ấm áp, nhạy cảm và giàu trực giác. Cự Giải quan tâm đến người thân, trân trọng kỷ niệm và luôn muốn tạo ra một nơi chốn khiến mọi người cảm thấy được che chở.",
        love: "Tận tụy và chung thủy. Bạn cần được an ủi, được lắng nghe và cảm thấy mình thuộc về. Hãy nói ra điều mình cần thay vì chờ người kia tự đoán.",
        work: "Hợp với chăm sóc sức khỏe, giáo dục, tư vấn, ẩm thực, sáng tạo nội dung. Bạn học tốt trong môi trường thân thiện và có sự tin tưởng.",
        advice: "Chăm sóc bản thân cũng quan trọng như chăm sóc người khác. Đặt ranh giới nhẹ nhàng không làm bạn kém dịu dàng đi."
    },
    "Sư Tử": {
        g: "♌", range: "23/7 – 22/8", el: "Lửa",
        trait: "Tự tin, hào phóng và có sức hút tự nhiên. Sư Tử thích tỏa sáng, giàu lòng nhiệt thành và sẵn sàng bảo vệ những người mình yêu quý.",
        love: "Lãng mạn, nồng nhiệt và trung thành. Bạn muốn được trân trọng, và cũng sẵn sàng dành sự ưu ái hết mực cho người mình thương.",
        work: "Hợp với vị trí lãnh đạo, biểu diễn, sáng tạo, truyền thông, sự kiện. Bạn bứt phá khi được giao trách nhiệm lớn và có sân khấu để thể hiện.",
        advice: "Hãy để người khác cùng tỏa sáng. Một lời khen chân thành dành cho đồng đội sẽ làm ánh sáng của bạn ấm áp hơn."
    },
    "Xử Nữ": {
        g: "♍", range: "23/8 – 22/9", el: "Đất",
        trait: "Tỉ mỉ, chu đáo và có óc phân tích tốt. Xử Nữ để ý đến chi tiết, thích sự ngăn nắp và luôn muốn giúp mọi thứ trở nên tốt hơn.",
        love: "Thể hiện tình cảm bằng hành động thiết thực và sự quan tâm thầm lặng. Bạn cần học cách bớt khắt khe, với cả người ấy lẫn bản thân.",
        work: "Hợp với nghiên cứu, y tế, kế toán, biên tập, lập trình, quản lý chất lượng. Bạn học hiệu quả nhờ lập kế hoạch rõ ràng và ôn tập đều đặn.",
        advice: "Không cần hoàn hảo mới được bắt đầu. Hãy ghi nhận những điều đã làm tốt, bạn xứng đáng được nghỉ ngơi."
    },
    "Thiên Bình": {
        g: "♎", range: "23/9 – 22/10", el: "Khí",
        trait: "Hài hòa, công bằng và biết thấu hiểu. Thiên Bình có óc thẩm mỹ, khéo léo trong giao tiếp và luôn tìm cách giữ sự cân bằng giữa mọi người.",
        love: "Yêu sự lãng mạn, tinh tế và tôn trọng lẫn nhau. Bạn cần một mối quan hệ bình đẳng, nhưng đôi khi hãy mạnh dạn nói rõ mong muốn thật của mình.",
        work: "Hợp với thiết kế, luật, ngoại giao, nhân sự, nghệ thuật, làm việc nhóm. Bạn học tốt khi được thảo luận và cộng tác với người khác.",
        advice: "Do dự là bình thường, nhưng đừng để nó kéo dài quá lâu. Tin vào trực giác và chọn một hướng đi, bạn sẽ điều chỉnh được trên đường."
    },
    "Thiên Yết": {
        g: "♏", range: "23/10 – 21/11", el: "Nước",
        trait: "Sâu sắc, bí ẩn và đam mê mãnh liệt. Thiên Yết có ý chí mạnh mẽ, trực giác nhạy bén và không bao giờ làm việc gì nửa vời.",
        love: "Yêu sâu đậm và trung thành tuyệt đối. Bạn cần sự tin tưởng trọn vẹn; hãy từ từ cho phép mình bộc lộ sự mong manh thay vì giữ mọi thứ trong lòng.",
        work: "Hợp với nghiên cứu, điều tra, tâm lý, y học, tài chính, chiến lược. Bạn có thể đào sâu một chủ đề cho đến khi nắm vững hoàn toàn.",
        advice: "Hãy tin người một cách có chọn lọc thay vì đề phòng tất cả. Sự cởi mở đúng lúc sẽ giúp những mối quan hệ của bạn thêm bền chặt."
    },
    "Nhân Mã": {
        g: "♐", range: "22/11 – 21/12", el: "Lửa",
        trait: "Lạc quan, yêu tự do và thích khám phá. Nhân Mã chân thật, hài hước và luôn tìm kiếm ý nghĩa lớn hơn trong mọi trải nghiệm.",
        love: "Cần một người bạn đồng hành cùng phiêu lưu và cùng trưởng thành. Sự thẳng thắn của bạn là điểm mạnh, chỉ cần thêm chút tinh tế khi nói.",
        work: "Hợp với du lịch, giáo dục, xuất bản, truyền thông quốc tế, khởi nghiệp. Bạn học tốt qua trải nghiệm thực tế và những chủ đề khiến mình tò mò.",
        advice: "Hãy dành thời gian hoàn thiện kế hoạch trước khi lên đường. Tự do thật sự đến từ nền tảng vững vàng."
    },
    "Ma Kết": {
        g: "♑", range: "22/12 – 19/1", el: "Đất",
        trait: "Kiên trì, có tham vọng và kỷ luật. Ma Kết thực tế, đáng tin cậy, đặt mục tiêu dài hạn và âm thầm nỗ lực để đạt được.",
        love: "Nghiêm túc và có trách nhiệm với tình cảm. Bạn có thể trông kín đáo lúc đầu, nhưng một khi đã tin tưởng sẽ là điểm tựa vững vàng.",
        work: "Hợp với quản lý, tài chính, kỹ thuật, kiến trúc, pháp lý. Bạn học theo lộ trình rõ ràng và có khả năng tự giác rất cao.",
        advice: "Đừng quên nghỉ ngơi và vui chơi. Thành công sẽ ý nghĩa hơn khi bạn có người cùng chia sẻ."
    },
    "Bảo Bình": {
        g: "♒", range: "20/1 – 18/2", el: "Khí",
        trait: "Độc lập, sáng tạo và có tư duy khác biệt. Bảo Bình yêu tự do, quan tâm đến cộng đồng và luôn nghĩ về những điều mới mẻ cho tương lai.",
        love: "Cần không gian riêng và một người bạn thật sự hiểu mình. Tình bạn là nền tảng của mọi mối quan hệ với bạn; đôi khi hãy chia sẻ cảm xúc nhiều hơn.",
        work: "Hợp với công nghệ, khoa học, thiết kế, hoạt động xã hội, đổi mới sáng tạo. Bạn học tốt khi được tự do khám phá và đặt câu hỏi.",
        advice: "Ý tưởng hay cần được biến thành hành động nhỏ mỗi ngày. Hãy cho người thân thấy bạn quan tâm họ bằng những cử chỉ giản dị."
    },
    "Song Ngư": {
        g: "♓", range: "19/2 – 20/3", el: "Nước",
        trait: "Mơ mộng, giàu cảm xúc và đồng cảm. Song Ngư có trí tưởng tượng phong phú, trực giác tinh tế và lòng trắc ẩn sâu sắc với mọi người.",
        love: "Dịu dàng, lãng mạn và hết lòng vì người mình thương. Bạn cần một người biết trân trọng sự nhạy cảm, và nhớ giữ lại một phần cho chính mình.",
        work: "Hợp với nghệ thuật, âm nhạc, viết lách, tâm lý, chăm sóc sức khỏe. Bạn học tốt qua hình ảnh, câu chuyện và môi trường yên tĩnh, đầy cảm hứng.",
        advice: "Đặt ranh giới và lên lịch cụ thể cho giấc mơ của bạn. Khi biết chăm sóc cảm xúc của chính mình, bạn sẽ chữa lành cho người khác bền vững hơn."
    }
};
