// КАО#1 — Флоу 3: отметка приёма «выдано» и отмена (undoGiven).
// Проходим мастер выдачи 08:00 до конца → строка 08:00 = «ВЫДАНО».
// Затем клик по строке → confirm() → undoGiven → строка снова «ОЖИДАНИЕ/ПРОПУЩЕНО».
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('Отметка приёма и отмена', () => {
  test('выдано → undoGiven возвращает в неотмеченное', async ({ page }) => {
    await openFresh(page);

    // Примечание (КАО#1): в fresh-контексте loadBox() сеет ячейку today|08:00 как
    // опустошённую сегодня, а syncGivenFromBox() помечает 08:00 как «выдано».
    // Это отдельный баг (см. findings). Чтобы детерминированно проверить именно
    // механику give→undo, явно сбрасываем «выдано» и перерисовываем главную.
    const iso = await page.evaluate(() => {
      const i = dateISO();
      doneCache[i] = [];
      localStorage.removeItem('medapp:done:' + i);
      renderHome(true);
      return i;
    });

    const row0 = page.locator('#scr-home .trow').nth(0);
    await expect(row0.locator('.tm')).toHaveText('08:00');
    // после сброса — не выдано
    await expect(row0.locator('.st')).not.toHaveClass(/done/);

    // пройти мастер выдачи 08:00 целиком (3 группы → thanks)
    await page.evaluate(() => startGive('08:00'));
    await expect(page.locator('#wiz')).toHaveClass(/open/);

    // кликаем «подтвердить группу» пока есть кнопка группы; на шаге thanks — закрыть
    for (let guard = 0; guard < 8; guard++) {
      const wbody = page.locator('#wbody');
      // шаг thanks определяем по наличию благодарности
      const isThanks = await wbody.locator('.wbig').count()
        .then(async () => (await wbody.innerText()).includes('Спасибо'));
      if (isThanks) {
        await page.locator('#wnav .done').click(); // закрыть → show('home')
        break;
      }
      await page.locator('#wnav .done').click();
      await page.waitForTimeout(150);
    }

    await expect(page.locator('#wiz')).not.toHaveClass(/open/);

    // строка 08:00 теперь ВЫДАНО
    const row0b = page.locator('#scr-home .trow').nth(0);
    await expect(row0b.locator('.st')).toHaveClass(/done/);
    await expect(row0b.locator('.st')).toContainText('ВЫДАНО');

    // === Отмена: undoGiven вызывает confirm() — принимаем ===
    page.once('dialog', (d) => d.accept());
    await row0b.click();

    // после отмены строка 08:00 снова не «done»
    const row0c = page.locator('#scr-home .trow').nth(0);
    await expect(row0c.locator('.st')).not.toHaveClass(/done/, { timeout: 7000 });
  });
});
