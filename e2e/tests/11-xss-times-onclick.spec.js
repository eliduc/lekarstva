// КАО#4 (SECURITY, регрессия) — вырыв из onclick="pickMedFor('${tm}')" в renderSettings.
// tm берётся из state.times (облачный конфиг). Раньше на входе в onclick НЕ применялся
// escAttrJs, поэтому одинарная кавычка в значении времени закрывала JS-строку и инъектила
// код. Фикс: escAttrJs(tm) в onclick + esc(tm) в заголовке + esc для подстановки tf.
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test('XSS: payload в state.times НЕ вырывается из onclick pickMedFor (Настройки)', async ({ page }) => {
  const dialogs = [];
  page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
  const pageErrors = [];
  page.on('pageerror', (e) => pageErrors.push(e.message));

  await openFresh(page);

  await page.evaluate(() => {
    // Время-ключ с вырывом из JS-строки внутри onclick="pickMedFor('...')"
    const evil = "08:00');window.__TIMEPWNED=true;//";
    state.times = [evil];
    state.schedule[evil] = [];
    setAuthed = true;
    renderSettings();
  });
  await page.waitForTimeout(200);

  // Если инъекция сработала, в DOM будет кнопка .addln, чей onclick-атрибут
  // содержит исполняемый второй стейтмент. Проверим САМ атрибут (вырыв из строки)
  // и факт исполнения, кликнув по кнопке.
  // Кнопка pickMedFor — единственная, чей onclick начинается с "pickMedFor".
  const attr = await page.evaluate(() => {
    const b = [...document.querySelectorAll('#scr-settings .addln')]
      .find((x) => (x.getAttribute('onclick') || '').startsWith('pickMedFor'));
    return b ? b.getAttribute('onclick') : '(pickMedFor button not found)';
  });
  // Симулируем клик — если был вырыв, выполнится window.__TIMEPWNED=true
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('#scr-settings .addln')]
      .find((x) => (x.getAttribute('onclick') || '').startsWith('pickMedFor'));
    if (b) b.click();
  });
  await page.waitForTimeout(100);

  const pwned = await page.evaluate(() => !!window.__TIMEPWNED);
  console.log('onclick attr =', JSON.stringify(attr));
  console.log('PWNED =', pwned, 'pageErrors =', JSON.stringify(pageErrors));

  expect(pwned, 'инъекция через state.times в onclick НЕ должна исполняться').toBe(false);
});
