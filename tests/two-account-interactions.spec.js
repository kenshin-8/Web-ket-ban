
import { test, expect } from '@playwright/test';

const users = [
  {
    email: process.env.TEST_USER_1_EMAIL,
    password: process.env.TEST_USER_1_PASSWORD,
    name: process.env.TEST_USER_1_NAME,
  },
  {
    email: process.env.TEST_USER_2_EMAIL,
    password: process.env.TEST_USER_2_PASSWORD,
    name: process.env.TEST_USER_2_NAME,
  },
];

const configured = users.every(
  (user) => user.email && user.password && user.name
);

const runId = `E2E-${Date.now()}-${Math.random()
  .toString(36)
  .slice(2, 7)}`;

async function login(page, user) {
  await page.goto('/login.html');

  await page.locator('#email').fill(user.email);
  await page.locator('#password').fill(user.password);
  await page.locator('#loginBtn').click();

  await expect(page).not.toHaveURL(/\/login\.html/, {
    timeout: 30000,
  });
}

async function openFriendChat(page, friendName) {
  await page.goto('/friends.html');

  await expect(page.locator('#friendSearchForm')).toBeVisible({
    timeout: 20000,
  });

  const friendCard = page
    .locator('#friendsList .person-card')
    .filter({ hasText: friendName })
    .first();

  await expect(friendCard).toBeVisible({
    timeout: 20000,
  });

  await friendCard
    .getByRole('button', { name: 'Nhắn tin' })
    .click();

  await expect(page.locator('#dmForm')).toBeVisible({
    timeout: 20000,
  });
}

test(
  'E2E hai bot: kết bạn, DM hai chiều và tương tác Quảng trường',
  async ({ browser }) => {
    test.skip(
      !configured,
      'Cần cấu hình đủ thông tin hai tài khoản thử nghiệm.'
    );

    expect(users[0].email).not.toBe(users[1].email);

    const contexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
    ]);

    const [a, b] = await Promise.all(
      contexts.map((context) => context.newPage())
    );

    try {
      // Ghi nhận lỗi trình duyệt và lỗi API.
      for (const [label, page] of [
        ['BOT A', a],
        ['BOT B', b],
      ]) {
        page.on('console', (message) => {
          if (message.type() === 'error') {
            console.log(
              `[${label} CONSOLE]`,
              message.text()
            );
          }
        });

        page.on('pageerror', (error) => {
          console.log(
            `[${label} PAGE ERROR]`,
            error.message
          );
        });

        page.on('response', (response) => {
          if (
            response.url().includes('/rest/v1/') &&
            (
              response.url().includes('friend_requests') ||
              response.status() >= 400
            )
          ) {
            console.log(
              `[${label} SUPABASE]`,
              response.status(),
              response.url()
            );
          }
        });
      }

      // 1. Đăng nhập hai tài khoản độc lập.
      await Promise.all([
        login(a, users[0]),
        login(b, users[1]),
      ]);

      // Xác minh hai tài khoản có user ID khác nhau.
      const ids = await Promise.all(
        [a, b].map((page) =>
          page.evaluate(() => {
            for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);

              if (!key?.endsWith('-auth-token')) {
                continue;
              }

              try {
                const value = JSON.parse(
                  localStorage.getItem(key)
                );

                if (value?.user?.id) {
                  return value.user.id;
                }
              } catch {
                // Bỏ qua dữ liệu localStorage không hợp lệ.
              }
            }

            return null;
          })
        )
      );

      expect(ids[0], 'Bot A phải đăng nhập').toBeTruthy();
      expect(ids[1], 'Bot B phải đăng nhập').toBeTruthy();
      expect(ids[0]).not.toBe(ids[1]);

      console.log('[E2E] Hai bot đăng nhập thành công.');

      // 2. Bot A tìm Bot B.
      await a.goto('/friends.html');

      await expect(
        a.locator('#friendSearchForm')
      ).toBeVisible();

      await a.locator('#friendSearchInput').fill(
        users[1].name
      );

      await a
        .locator('#friendSearchForm button[type="submit"]')
        .click();

      const resultB = a
        .locator('#friendSearchResults .person-card')
        .filter({ hasText: users[1].name })
        .first();

      await expect(resultB).toBeVisible({
        timeout: 20000,
      });

      const relationButton = resultB
        .getByRole('button')
        .first();

      const buttonText = (
        await relationButton.innerText()
      ).trim();

      console.log(
        '[E2E] Trạng thái quan hệ Bot A:',
        buttonText
      );

      let alreadyFriends = false;

      if (buttonText.includes('Nhắn tin')) {
        alreadyFriends = true;

        console.log(
          '[E2E] Hai bot đã là bạn bè từ trước.'
        );
      } else if (
        buttonText.includes('Đã gửi') ||
        buttonText.includes('Gửi lại lời mời')
      ) {
        console.log(
          '[E2E] Lời mời kết bạn đã tồn tại.'
        );
      } else if (buttonText.includes('Kết bạn')) {
        await relationButton.click();

        await expect(relationButton).toContainText(
          'Đã gửi',
          { timeout: 15000 }
        );

        console.log(
          '[E2E] Bot A đã gửi lời mời kết bạn.'
        );
      } else {
        throw new Error(
          `Trạng thái kết bạn không hợp lệ: ${buttonText}`
        );
      }

      // Chỉ nhận lời mời nếu hai bot chưa là bạn bè.
      if (!alreadyFriends) {
        await b.goto('/friends.html');

        const incomingRequest = b
          .locator('#friendRequests .request-card')
          .filter({ hasText: users[0].name })
          .first();

        await expect(incomingRequest).toBeVisible({
          timeout: 20000,
        });

        await incomingRequest
          .getByRole('button', { name: 'Chấp nhận' })
          .click();

        const friendOnB = b
          .locator('#friendsList .person-card')
          .filter({ hasText: users[0].name })
          .first();

        await expect(friendOnB).toBeVisible({
          timeout: 20000,
        });

        console.log(
          '[E2E] Bot B đã chấp nhận lời mời.'
        );
      }

      // 3. Bot A gửi tin nhắn cho Bot B.
      await openFriendChat(a, users[1].name);

      const messageA = `${runId} Xin chào từ Bot A`;

      await a.locator('#dmInput').fill(messageA);
      await a.locator('#dmSend').click();

      await expect(a.locator('#dmMessages')).toContainText(
        messageA,
        { timeout: 15000 }
      );

      console.log('[E2E] Bot A gửi DM thành công.');

      // Bot B tải lại trang và xác minh đã nhận DM.
      await b.reload();

      await openFriendChat(b, users[0].name);

      await expect(b.locator('#dmMessages')).toContainText(
        messageA,
        { timeout: 20000 }
      );

      console.log(
        '[E2E] Bot B đã nhận và đọc được DM từ Bot A.'
      );

      // Bot B trả lời Bot A.
      const messageB = `${runId} Đã nhận, Bot B đây`;

      await b.locator('#dmInput').fill(messageB);
      await b.locator('#dmSend').click();

      await expect(b.locator('#dmMessages')).toContainText(
        messageB,
        { timeout: 15000 }
      );

      // Bot A tải lại và xác minh DM chiều ngược lại.
      await a.reload();

      await openFriendChat(a, users[1].name);

      await expect(a.locator('#dmMessages')).toContainText(
        messageB,
        { timeout: 20000 }
      );

      console.log(
        '[E2E] Bot A đã nhận DM trả lời từ Bot B.'
      );

      // 4. Bot B đăng bài lên Quảng trường.
      const postText = `${runId} Bài đăng kiểm thử từ Bot B`;

      await b.goto('/square.html');

      await expect(b.locator('#sqApp')).toBeVisible({
        timeout: 20000,
      });

      await b.locator('#momentBody').fill(postText);
      await b.locator('#postBtn').click();

      await expect(b.locator('#postMessage')).toContainText(
        'Đã đăng',
        { timeout: 20000 }
      );

      const postOnB = b
        .locator('#feed .moment')
        .filter({ hasText: postText })
        .first();

      await expect(postOnB).toBeVisible({
        timeout: 20000,
      });

      console.log(
        '[E2E] Bot B đã đăng bài lên Quảng trường.'
      );

      // Bot A nhìn thấy bài đăng của Bot B.
      await a.goto('/square.html');

      await expect(a.locator('#sqApp')).toBeVisible({
        timeout: 20000,
      });

      const postOnA = a
        .locator('#feed .moment')
        .filter({ hasText: postText })
        .first();

      await expect(postOnA).toBeVisible({
        timeout: 20000,
      });

      // Bot A thả cảm xúc.
      await postOnA
        .locator('.moment-actions button')
        .nth(0)
        .click();

      await expect(
        postOnA.locator('.moment-actions button').nth(0)
      ).toContainText('❤️ 1', {
        timeout: 15000,
      });

      console.log('[E2E] Bot A đã thả cảm xúc.');

      // Bot A bình luận.
      const commentText = `${runId} Bình luận từ Bot A`;

      await postOnA
        .locator('.moment-actions button')
        .nth(1)
        .click();

      await postOnA.locator('.cm input').fill(commentText);

      await postOnA
        .locator('.cm button')
        .filter({ hasText: 'Gửi' })
        .click();

      await expect(postOnA.locator('.cm')).toContainText(
        commentText,
        { timeout: 15000 }
      );

      console.log('[E2E] Bot A đã bình luận.');

      // 5. Bot B tải lại để xác minh bài đăng,
      // lượt cảm xúc và bình luận được lưu.
      await b.reload();

      const postAfterReload = b
        .locator('#feed .moment')
        .filter({ hasText: postText })
        .first();

      await expect(postAfterReload).toBeVisible({
        timeout: 20000,
      });

      await expect(
        postAfterReload
          .locator('.moment-actions button')
          .nth(0)
      ).toContainText('1', {
        timeout: 15000,
      });

      await postAfterReload
        .locator('.moment-actions button')
        .nth(1)
        .click();

      await expect(
        postAfterReload.locator('.cm')
      ).toContainText(commentText, {
        timeout: 15000,
      });

      console.log(
        '[E2E] Bài đăng, cảm xúc và bình luận đã được lưu.'
      );

      console.log(
        '[E2E] HOÀN TẤT: Kết bạn, DM hai chiều và Quảng trường.'
      );

    } finally {
      await Promise.all(
        contexts.map((context) => context.close())
      );
    }
  }
);
