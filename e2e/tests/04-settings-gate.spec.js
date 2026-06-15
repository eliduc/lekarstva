// КАО#1 — Флоу 4: шлюз настроек паролем 1234 (#spw → tryUnlock)
//          Флоу 5: экран История (openHistory) внутри настроек.
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('Настройки: пароль и История', () => {
  test('пароль 1234 открывает настройки', async ({ page }) => {
    await openFresh(page);

    // открыть вкладку Настройки → должен появиться шлюз с полем пароля
    await page.locator('#nb-settings').click();
    const spw = page.locator('#spw');
    await expect(spw).toBeVisible();

    // неверный пароль — настройки НЕ открываются, показывается ошибка
    await spw.fill('0000');
    await page.evaluate(() => tryUnlock());
    await expect(page.locator('#spwerr')).toBeVisible();
    await expect(page.locator('#spw')).toBeVisible(); // всё ещё на шлюзе

    // верный пароль 1234
    await page.locator('#spw').fill('1234');
    await page.evaluate(() => tryUnlock());

    // шлюз исчез, появились настройки (кнопка Истории + заголовок «Времена приёма»)
    await expect(page.locator('#spw')).toHaveCount(0);
    await expect(page.locator('#scr-settings')).toContainText('Времена приёма');
    await expect(page.locator('#scr-settings')).toContainText('История');
  });

  test('экран История (openHistory) открывается из настроек', async ({ page }) => {
    await openFresh(page);

    await page.locator('#nb-settings').click();
    await page.locator('#spw').fill('1234');
    await page.evaluate(() => tryUnlock());
    await expect(page.locator('#scr-settings')).toContainText('Времена приёма');

    // открыть Историю
    await page.evaluate(() => openHistory());

    // заголовок «История событий» и кнопка «Назад»
    await expect(page.locator('#scr-settings h2').first()).toContainText('История событий');
    await expect(page.locator('#scr-settings')).toContainText('Назад');

    // sync выключен в fresh-контексте → подсказка hist_offline ИЛИ пусто
    await expect(page.locator('#scr-settings')).toContainText(
      /Включите синхронизацию|Событий пока нет/,
      { timeout: 7000 }
    );
  });
});
