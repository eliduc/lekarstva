// КАО#1 — Флоу 7: stage-режим (?env=stage).
// - оранжевая шапка: header background rgb(154,52,18) (#9a3412)
// - заголовок приложения содержит «STAGE»
// - tgConfigured() === false ДАЖE при заданном токене/чате (stage не шлёт в боевой канал)
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('Stage-режим', () => {
  test('оранжевая шапка, STAGE в заголовке, Telegram выключен', async ({ page }) => {
    await openFresh(page, '?env=stage');

    // body.stage выставлен
    await expect(page.locator('body')).toHaveClass(/stage/);

    // оранжевая шапка
    const headerBg = await page.locator('header').evaluate(
      (el) => getComputedStyle(el).backgroundColor
    );
    expect(headerBg).toBe('rgb(154, 52, 18)');

    // заголовок приложения содержит STAGE
    await expect(page.locator('#appTitle')).toContainText('STAGE');

    // STAGE-флаг приложения активен
    const isStage = await page.evaluate(() => STAGE === true);
    expect(isStage).toBe(true);

    // tgConfigured() === false даже при заданном токене и чате
    const tgResult = await page.evaluate(() => {
      state.tgToken = '123456:FAKE_TOKEN_FOR_TEST';
      state.tgChat = '999999999';
      return tgConfigured();
    });
    expect(tgResult).toBe(false);
  });

  test('prod-режим: tgConfigured() === true при заданном токене (контраст)', async ({ page }) => {
    await openFresh(page); // без ?env=stage

    const isStage = await page.evaluate(() => STAGE === true);
    expect(isStage).toBe(false);

    const tgResult = await page.evaluate(() => {
      state.tgToken = '123456:FAKE_TOKEN_FOR_TEST';
      state.tgChat = '999999999';
      return tgConfigured();
    });
    expect(tgResult).toBe(true);
  });
});
