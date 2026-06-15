// КАО#1 — Флоу 6: смена языка he → document.documentElement.dir === 'rtl'.
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('Язык', () => {
  test('переключение на иврит ставит dir=rtl', async ({ page }) => {
    await openFresh(page);

    // изначально ru → ltr
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');

    await page.evaluate(() => setLang('he'));

    await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
    await expect(page.locator('html')).toHaveAttribute('lang', 'he');

    // кнопка языка показывает HE
    await expect(page.locator('#langBtn')).toContainText('HE');

    // обратно на русский → ltr (Non-Degradation)
    await page.evaluate(() => setLang('ru'));
    await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  });
});
