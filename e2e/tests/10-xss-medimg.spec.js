// КАО#3 (SECURITY, ре-верификация) — вектор m.img (фото лекарства) из облака.
// Модель угрозы: облачный конфиг (state.meds[<id>].img) скомпрометирован. Прежняя
// medImg пропускала ЛЮБУЮ строку с префиксом "data:", поэтому значение вида
//   data:image/png;base64,x" onerror="window.__IMGPWNED=true
// вырывалось из <img src="${medImg(m)}"> и исполняло onerror.
// Проверяем: payload НЕ исполняется (нет dialog, нет __IMGPWNED), при этом
// легитимное data:image/...;base64 фото по-прежнему рендерится (Non-Degradation).
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('Безопасность: XSS через m.img (data:-URL)', () => {
  test('data:-URL с кавычкой не вырывается из src; легитимное фото рендерится', async ({ page }) => {
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await openFresh(page);

    await page.evaluate(() => {
      // 1×1 PNG — заведомо валидное фото (canvas.toDataURL-форма)
      const realPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      // вредоносный «облачный» img: data:-префикс + вырыв из атрибута + onerror
      const evilImg = 'data:image/png;base64,x" onerror="window.__IMGPWNED=true" data-x="';
      state.meds.evilphoto = { name: 'EVIL', type: 'tab', qty: '1', sub: '', warn: '', img: evilImg };
      state.meds.goodphoto = { name: 'GOOD', type: 'tab', qty: '1', sub: '', warn: '', img: realPng };
      state.schedule[state.times[0]] = (state.schedule[state.times[0]] || []).concat(['evilphoto', 'goodphoto']);
      setAuthed = true;
      renderSettings();           // библиотека (libc) рендерит <img src=medImg(m)>
    });

    await page.waitForTimeout(400);

    expect(dialogs, 'инъекция onerror не должна порождать dialog').toEqual([]);
    expect(pageErrors, 'не должно быть pageerror').toEqual([]);

    const pwned = await page.evaluate(() => !!window.__IMGPWNED);
    expect(pwned, 'onerror из data:-URL не должен исполниться').toBe(false);

    // Non-Degradation: легитимное фото действительно отрисовано как <img> с data:-src.
    const goodImgs = await page.evaluate(() =>
      [...document.querySelectorAll('#scr-settings .libc img')]
        .filter((im) => im.getAttribute('src') && im.getAttribute('src').indexOf('data:image/png;base64,iVBOR') === 0).length);
    expect(goodImgs, 'валидное data:image должно рендериться').toBeGreaterThan(0);

    // Вредоносный img НЕ создал реального src со встроенным onerror-атрибутом:
    // ни один <img> не должен иметь onerror-атрибут.
    const evilOnError = await page.evaluate(() =>
      document.querySelectorAll('#scr-settings .libc img[onerror]').length);
    expect(evilOnError, 'инъектированный onerror не должен стать атрибутом').toBe(0);
  });
});
