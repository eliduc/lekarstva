// КАО#1 — общие хелперы e2e.
// Главное: «fresh-контекст» — гарантировать чистый localStorage ДО загрузки app.js,
// чтобы loadState() взял defaultState (3 времени 08:00/14:00/20:00 и т.п.).
// @ts-check
const { test } = require('@playwright/test');

/**
 * Открыть приложение с гарантированно пустым хранилищем.
 * Трюк: сначала заходим на about:blank нельзя (нет origin), поэтому
 * грузим страницу, чистим storage, затем reload — app.js при reload
 * стартует уже на пустом localStorage и берёт defaultState.
 * @param {import('@playwright/test').Page} page
 * @param {string} [query]  напр. '?env=stage'
 */
async function openFresh(page, query = '') {
  await page.goto('/index.html' + query);
  await page.evaluate(() => {
    try { localStorage.clear(); } catch (e) {}
    try { sessionStorage.clear(); } catch (e) {}
  });
  await page.reload();
  // дождаться, что состояние загрузилось. state — это top-level const (НЕ на window),
  // поэтому обращаемся к нему по «голому» имени внутри evaluate.
  await page.waitForFunction(() => {
    try { return typeof state !== 'undefined' && !!state && !!state.times; }
    catch (e) { return false; }
  }, null, { timeout: 10000 });
  // и что главный экран отрисован (3 строки времени)
  await page.locator('#scr-home .trow').first().waitFor({ state: 'visible', timeout: 10000 });
}

module.exports = { test, openFresh };
