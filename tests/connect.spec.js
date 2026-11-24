import { test, expect } from '@playwright/test';

const publicPages = [
  'index.html', 'login.html', 'register.html', 'quiz.html', 'profile.html',
  'avatar.html', 'discover.html', 'friends.html', 'match.html', 'square.html',
  'voice.html', 'icebreaker.html', 'public-profile.html', 'account-settings.html'
];

test.describe('Connect – kiểm tra khói các trang', () => {
  for (const route of publicPages) {
    test(`mở ${route} không trả về 404`, async ({ page, request }) => {
      const response = await request.get(`/${route}`);
      expect(response.status(), `${route} phải được phục vụ`).toBe(200);
      await page.goto(`/${route}`);
      await expect(page.locator('body')).toBeVisible();
      await expect(page.locator('body')).not.toBeEmpty();
    });
  }
});

test('Đăng nhập: form và kiểm tra trường bắt buộc hoạt động', async ({ page }) => {
  await page.goto('/login.html');
  await expect(page.locator('#loginForm')).toBeVisible();
  await expect(page.locator('#email')).toHaveAttribute('required', '');
  await expect(page.locator('#password')).toHaveAttribute('required', '');
  await page.locator('#loginBtn').click();
  await expect(page.locator('#loginForm')).toBeVisible();
  expect(await page.locator('#email').evaluate(el => el.validity.valueMissing)).toBeTruthy();
});

test('Đăng ký: từ chối mật khẩu quá ngắn trước khi gọi máy chủ', async ({ page }) => {
  await page.goto('/register.html');
  await page.locator('#username').fill('Bot kiểm thử');
  await page.locator('#email').fill('bot-validation@example.com');
  await page.locator('#password').fill('12345678');
  await page.locator('#confirmPassword').fill('abcdefgh');
  await page.locator('#registerBtn').click();
  await expect(page.locator('#registerMessage')).toContainText('không khớp');
});

test('Tarot: rút một lá, lưu lịch sử cục bộ', async ({ page }) => {
  await page.goto('/icebreaker.html');
  await expect(page.locator('#drawTarot')).toBeVisible();
  await page.locator('#tarotSpread').selectOption('single');
  await page.locator('#drawTarot').click();
  await expect(page.locator('.tarot-reading-card')).toHaveCount(1, { timeout: 12_000 });
  await expect(page.locator('#tarotHistoryList .tarot-history-item')).toHaveCount(1);
  const saved = await page.evaluate(() => Object.keys(localStorage).some(k => k.startsWith('connect:tarot-history')));
  expect(saved).toBeTruthy();
});

test('Tarot: trải ba lá hiển thị đủ ba vị trí', async ({ page }) => {
  await page.goto('/icebreaker.html');
  await page.locator('#tarotSpread').selectOption('three');
  await page.locator('#tarotTopic').selectOption('love');
  await page.locator('#drawTarot').click();
  await expect(page.locator('.tarot-reading-card')).toHaveCount(3, { timeout: 12_000 });
  await expect(page.locator('.tarot-position')).toHaveCount(3);
});

test('Các liên kết nội bộ chính không trỏ tới trang thiếu', async ({ page, request }) => {
  await page.goto('/index.html');
  const hrefs = await page.locator('a[href$=".html"]').evaluateAll(links => [...new Set(links.map(a => a.getAttribute('href')).filter(Boolean))]);
  const missing = [];
  for (const href of hrefs) {
    const response = await request.get('/' + href.replace(/^\.\//, ''));
    if (response.status() >= 400) missing.push(`${href} (${response.status()})`);
  }
  expect(missing, `Liên kết hỏng: ${missing.join(', ')}`).toEqual([]);
});

test('Hai tài khoản bot đăng nhập độc lập (bật khi khai báo TEST_USER_1/2)', async ({ browser }) => {
  const users = [
    { email: process.env.TEST_USER_1_EMAIL, password: process.env.TEST_USER_1_PASSWORD },
    { email: process.env.TEST_USER_2_EMAIL, password: process.env.TEST_USER_2_PASSWORD }
  ];
  test.skip(users.some(user => !user.email || !user.password), 'Chưa cấu hình hai tài khoản thử nghiệm.');
  const contexts = await Promise.all(users.map(() => browser.newContext()));
  try {
    const pages = await Promise.all(contexts.map(context => context.newPage()));
    await Promise.all(pages.map(async (page, i) => {
      await page.goto('/login.html');
      await page.locator('#email').fill(users[i].email);
      await page.locator('#password').fill(users[i].password);
      await page.locator('#loginBtn').click();
      await expect(page).not.toHaveURL(/login\.html/, { timeout: 20_000 });
      const user = await page.evaluate(() => {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (!key?.endsWith('-auth-token')) continue;
          try { const value = JSON.parse(localStorage.getItem(key)); if (value?.user?.id) return value.user.id; } catch {}
        }
        return null;
      });
      expect(user, `Tài khoản bot ${i + 1} phải có phiên đăng nhập`).toBeTruthy();
      await page.goto('/profile.html');
      await expect(page.locator('body')).toBeVisible();
    }));
    const ids = await Promise.all(pages.map(page => page.evaluate(() => {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.endsWith('-auth-token')) continue;
        try { const value = JSON.parse(localStorage.getItem(key)); if (value?.user?.id) return value.user.id; } catch {}
      }
      return null;
    })));
    expect(ids[0]).not.toBe(ids[1]);
  } finally {
    await Promise.all(contexts.map(context => context.close()));
  }
});
