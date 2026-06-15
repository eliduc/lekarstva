// КАО#2 (SECURITY, ре-верификация) — проверка вектора warnLevel.
// Раунд 1 экранировал name/qty/sub/caregiver/id/времена, но m.warnLevel
// подставляется СЫРЫМ в class-атрибут <div class="wflag ${m.warnLevel}...">
// (app.js строки 505/538/593) и в style/class в openAlert. warnLevel приходит
// из облачного конфига (state.meds[].warnLevel) → потенциальный вырыв из атрибута.
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('Безопасность: XSS через warnLevel', () => {
  test('payload в warnLevel не исполняется в мастере выдачи и алерте', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await openFresh(page);

    await page.evaluate(() => {
      const tm = state.times[0];
      const evilId = 'wl_evil';
      state.meds[evilId] = {
        name: 'WLPAYLOAD',
        type: 'tab',
        qty: '1',
        sub: 's',
        warn: 'имеется предупреждение', // warn непустой → ветка с warnLevel рендерится
        warnLevel: '"><img src=x onerror=window.__WLPWNED=true>',
      };
      state.schedule[tm] = (state.schedule[tm] || []).concat(evilId);
      // Запускаем мастер выдачи (рендер group step → строка 538 с warnLevel)
      startGive(tm);
    });
    await page.waitForTimeout(400);

    // Открываем тестовый алерт (openAlert → строки с warnLevel/цветами)
    await page.evaluate(() => { try { closeWiz(); } catch (e) {} testAlert(); });
    await page.waitForTimeout(400);

    expect(dialogs, 'нет alert/confirm от инъекции warnLevel').toEqual([]);
    expect(pageErrors, 'нет pageerror').toEqual([]);

    const pwned = await page.evaluate(() => !!window.__WLPWNED);
    expect(pwned, 'инъекция через warnLevel не исполнилась').toBe(false);

    // <img src=x> из warnLevel не стал реальным DOM-узлом
    const injectedImg = await page.evaluate(() =>
      document.querySelectorAll('img[src="x"]').length);
    expect(injectedImg, 'инъектированный <img> из warnLevel не должен стать DOM-узлом').toBe(0);
  });

  test('payload в state.times/refillTime не вырывается из value-атрибута (Настройки)', async ({ page }) => {
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await openFresh(page);

    await page.evaluate(() => {
      // компрометированный облачный конфиг: время-ключ и refillTime с вырывом из value="…"
      state.times = ['08:00" data-pwned="1'];
      state.schedule['08:00" data-pwned="1'] = [];
      state.refillTime = '22:30" data-pwned2="1';
      setAuthed = true;
      renderSettings();
    });
    await page.waitForTimeout(300);

    expect(pageErrors, 'нет pageerror').toEqual([]);
    const r = await page.evaluate(() => ({
      t1: document.querySelectorAll('#scr-settings input[data-pwned="1"]').length,
      t2: document.querySelectorAll('#scr-settings input[data-pwned2="1"]').length,
    }));
    expect(r.t1, 'время не должно породить чужой атрибут на input').toBe(0);
    expect(r.t2, 'refillTime не должен породить чужой атрибут на input').toBe(0);
  });

  test('payload в m.type не исполняется через tyLabel (библиотека настроек)', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await openFresh(page);

    await page.evaluate(() => {
      // компрометированный облачный конфиг: неизвестный type с payload
      state.meds['ty_evil'] = {
        name: 'TYPAYLOAD', type: '<img src=x onerror=window.__TYPWNED=true>',
        qty: '1', sub: 's', warn: '',
      };
      setAuthed = true;
      renderSettings();
    });
    await page.waitForTimeout(400);

    expect(dialogs, 'нет alert/confirm от инъекции m.type').toEqual([]);
    expect(pageErrors, 'нет pageerror').toEqual([]);
    const r = await page.evaluate(() => ({
      pwned: !!window.__TYPWNED,
      img: document.querySelectorAll('#scr-settings img[src="x"]').length,
    }));
    expect(r.pwned, 'инъекция через m.type/tyLabel не исполнилась').toBe(false);
    expect(r.img, 'инъектированный <img> из m.type не стал DOM-узлом').toBe(0);
  });
});
