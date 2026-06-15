// КАО#1 — Флоу 1: Главная.
// Fresh-контекст → defaultState: 3 строки времени 08:00/14:00/20:00 + счётчики лекарств.
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('Главная', () => {
  test('3 строки 08:00/14:00/20:00 со счётчиками лекарств', async ({ page }) => {
    await openFresh(page);

    const rows = page.locator('#scr-home .trow');
    await expect(rows).toHaveCount(3);

    // времена в порядке (state.times отсортирован)
    await expect(rows.nth(0).locator('.tm')).toHaveText('08:00');
    await expect(rows.nth(1).locator('.tm')).toHaveText('14:00');
    await expect(rows.nth(2).locator('.tm')).toHaveText('20:00');

    // счётчик лекарств у каждой строки (.cnt содержит «N лек.»)
    for (let i = 0; i < 3; i++) {
      const cnt = (await rows.nth(i).locator('.cnt').innerText()).trim();
      expect(cnt, `строка ${i} должна показывать счётчик`).toMatch(/\d+\s*лек/);
    }

    // 08:00 — 8 активных лекарств в defaultState (today зависит от дня недели;
    // amiodacore исключён по ВТ/ПТ). Проверяем что счётчик > 0 и не больше 8.
    const cnt0 = (await rows.nth(0).locator('.cnt').innerText()).match(/(\d+)/);
    expect(Number(cnt0 && cnt0[1])).toBeGreaterThan(0);
    expect(Number(cnt0 && cnt0[1])).toBeLessThanOrEqual(8);

    // заголовок «Сегодня — <день>»
    await expect(page.locator('#scr-home h2').first()).toContainText('Сегодня');
  });
});
