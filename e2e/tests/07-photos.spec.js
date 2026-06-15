// КАО#1 — Флоу 8: фото лекарств грузятся (img.naturalWidth > 0).
// Фото показываются в мастере выдачи (.grow img) и в библиотеке настроек (.libc img).
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

async function expectImagesLoaded(page, selector) {
  const imgs = page.locator(selector);
  const count = await imgs.count();
  expect(count, `ожидались <img> по селектору ${selector}`).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const img = imgs.nth(i);
    // дождаться полной загрузки и проверить natural width
    await expect.poll(
      () => img.evaluate((el) => el.complete && el.naturalWidth),
      { timeout: 7000, message: `image ${i} (${selector}) должен загрузиться` }
    ).toBeGreaterThan(0);
  }
}

test.describe('Фото лекарств', () => {
  test('фото в мастере выдачи 08:00 загружаются', async ({ page }) => {
    await openFresh(page);
    await page.evaluate(() => startGive('08:00'));
    await expect(page.locator('#wiz')).toHaveClass(/open/);
    await page.locator('#wbody .grow img').first().waitFor({ state: 'visible' });
    await expectImagesLoaded(page, '#wbody .grow img');
  });

  test('фото в библиотеке настроек загружаются', async ({ page }) => {
    await openFresh(page);
    await page.locator('#nb-settings').click();
    await page.locator('#spw').fill('1234');
    await page.evaluate(() => tryUnlock());
    await page.locator('#scr-settings .libc img').first().waitFor({ state: 'visible' });
    await expectImagesLoaded(page, '#scr-settings .libc img');
  });
});
