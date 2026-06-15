// КАО#4 (SECURITY, регрессия) — вырыв через state.times в "следующий приём" на главной.
// <div class="big">${next}</div> — next берётся из state.times (облако). Раньше без esc →
// инъекция тега. Фикс: esc(next).
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test('XSS: payload в state.times НЕ инъектит img на главной (next intake)', async ({ page }) => {
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await openFresh(page);

  await page.evaluate(() => {
    // время в будущем (23:59), чтобы стать "next", с payload-тегом
    const evil = '23:59<img src=x onerror="window.__HOMEPWNED=true">';
    state.times = [evil];
    state.schedule = { [evil]: [] };
    renderHome(true); // перерисовать главную
  });
  await page.waitForTimeout(300);

  const r = await page.evaluate(() => ({
    pwned: !!window.__HOMEPWNED,
    img: document.querySelectorAll('#scr-home img[src="x"]').length,
  }));
  console.log('HOME PWNED =', r.pwned, 'img nodes =', r.img, 'pageErrors =', JSON.stringify(pageErrors));
  expect(r.img, 'инъектированный <img> из next не должен стать DOM-узлом').toBe(0);
  expect(r.pwned, 'инъекция через next НЕ должна исполняться').toBe(false);
});
