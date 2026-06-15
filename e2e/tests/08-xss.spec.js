// КАО#1 (SECURITY) — XSS из «облачных» данных не исполняется в DOM.
// Модель угрозы: приватный GitHub-репозиторий с конфигом/статусом скомпрометирован
// (или подменён через MITM без TLS-pinning). Тогда state.meds[<id>], m.name, m.qty,
// caregiver, ISO-значения ячеек таблетницы и времена приходят под контролем атакующего
// и попадают в innerHTML/onclick app.js. Проверяем, что esc()/escAttrJs() (КАО#1)
// нейтрализуют payload: ни alert/dialog, ни побочный эффект (window.__PWNED*) не
// срабатывают, при этом функциональность (кнопки edit/del, модалка) сохраняется.
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('Безопасность: XSS из облачных данных', () => {
  test('payload в id/имени/qty/caregiver не исполняется, кнопки работают', async ({ page }) => {
    // Любой dialog (alert/confirm) = провал: значит payload вырвался в исполнение.
    const dialogs = [];
    page.on('dialog', async (d) => { dialogs.push(d.message()); await d.dismiss(); });
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));

    await openFresh(page);

    // Инжектим вредоносный «облачный» конфиг прямо в state и рендерим настройки.
    await page.evaluate(() => {
      const evilId = "evil');window.__PWNED=true;('";
      state.meds[evilId] = {
        name: 'X<img src=x onerror=window.__PWNED2=true>',
        type: 'tab',
        qty: "1<svg onload=window.__PWNED4=true>",
        sub: '<b onmouseover=window.__PWNED5=true>s</b>',
        warn: '',
      };
      state.schedule[state.times[0]] = (state.schedule[state.times[0]] || []).concat(evilId);
      state.caregiver = "<img src=x onerror=window.__PWNED3=true>";
      // обходим шлюз пароля и рисуем настройки (там edit/del/onclick с id)
      setAuthed = true;
      renderSettings();
    });

    // Дать времени отработать любым onerror/onload, если бы они существовали.
    await page.waitForTimeout(400);

    // 1) Никаких диалогов и ошибок страницы.
    expect(dialogs, 'не должно быть alert/confirm от инъекции').toEqual([]);
    expect(pageErrors, 'не должно быть pageerror').toEqual([]);

    // 2) Ни один побочный эффект инъекции не выставлен.
    const pwned = await page.evaluate(() => ({
      p1: !!window.__PWNED, p2: !!window.__PWNED2, p3: !!window.__PWNED3,
      p4: !!window.__PWNED4, p5: !!window.__PWNED5,
    }));
    expect(pwned).toEqual({ p1: false, p2: false, p3: false, p4: false, p5: false });

    // 3) Non-Degradation: библиотека лекарств отрисована, есть кнопки edit/del.
    const counts = await page.evaluate(() => ({
      edit: document.querySelectorAll('.libc .ebtn').length,
      del: document.querySelectorAll('.libc .dbtn').length,
    }));
    expect(counts.edit).toBeGreaterThan(0);
    expect(counts.del).toBeGreaterThan(0);

    // 4) Имя лекарства отрисовано как ТЕКСТ (тег <img> не стал реальным элементом).
    const injectedImgInLib = await page.evaluate(() =>
      document.querySelectorAll('#scr-settings .libc img[src="x"]').length);
    expect(injectedImgInLib, 'инъектированный <img src=x> не должен стать DOM-узлом').toBe(0);

    // 5) Клик по edit вредоносного лекарства открывает модалку, но НЕ исполняет инъекцию.
    await page.evaluate(() => { const b = document.querySelector('.libc .ebtn'); if (b) b.click(); });
    await page.waitForTimeout(150);
    const afterClick = await page.evaluate(() => ({
      p1: !!window.__PWNED,
      modalOpen: document.getElementById('modal').classList.contains('open'),
    }));
    expect(afterClick.p1, 'клик не должен запускать инъекцию из id').toBe(false);
    expect(afterClick.modalOpen, 'модалка редактирования открывается (handler жив)').toBe(true);
  });
});
