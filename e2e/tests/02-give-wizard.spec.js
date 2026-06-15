// КАО#1 — Флоу 2: Мастер выдачи 08:00 (startGive).
// Первый шаг — группа ТАБЛЕТКИ (+ далее СИРОП, ИНГАЛЯЦИЯ).
// ESOMEPRAZOLE: крупное красное предупреждение .gbig (18px, rgb(180,34,34),
//   текст «Внимание! Натощак»).
// Порядок лекарств в выдаче (sortMeds по типу): tab(esomeprazole, fusid, forxiga,
//   amiodacore, eliquis) → syr(avilac) → inh(aerovent, flixotide).
const { test, openFresh } = require('./helpers');
const { expect } = require('@playwright/test');

test.describe('Мастер выдачи 08:00', () => {
  test('группа ТАБЛЕТКИ + крупное красное предупреждение esomeprazole + порядок', async ({ page }) => {
    await openFresh(page);

    // запускаем мастер выдачи на 08:00
    await page.evaluate(() => startGive('08:00'));
    await expect(page.locator('#wiz')).toHaveClass(/open/);

    const wbody = page.locator('#wbody');

    // первый шаг — группа, заголовок группы содержит «ТАБЛЕТКИ»
    await expect(wbody).toContainText('ТАБЛЕТКИ', { timeout: 7000 });

    // === ESOMEPRAZOLE: крупное красное предупреждение ===
    const gbig = wbody.locator('.gbig').first();
    await expect(gbig).toBeVisible();
    await expect(gbig).toContainText('Внимание! Натощак');

    // класс red + gbig (warnLevel red, warnBig)
    await expect(gbig).toHaveClass(/red/);
    await expect(gbig).toHaveClass(/gbig/);

    // getComputedStyle: font-size 18px, color rgb(180,34,34)
    const styles = await gbig.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { fontSize: cs.fontSize, color: cs.color };
    });
    expect(styles.fontSize).toBe('18px');
    expect(styles.color).toBe('rgb(180, 34, 34)');

    // === Порядок лекарств в группе ТАБЛЕТКИ ===
    // .grow .gn — название каждого лекарства; берём первое латинское слово.
    const names = await wbody.locator('.grow .gn').allInnerTexts();
    const tabOrder = names.map((n) => n.trim().split(/\s+/)[0].toUpperCase());
    // ожидаемый порядок таблеток в 08:00
    expect(tabOrder).toEqual([
      'ESOMEPRAZOLE', 'FUSID', 'FORXIGA', 'AMIODACORE', 'ELIQUIS',
    ]);

    // === Перейти по группам и собрать общий порядок типов ===
    // group 1: tab → подтвердить → group 2: syr (avilac) → group 3: inh (aerovent, flixotide)
    await page.locator('#wnav .done').click();
    await expect(wbody).toContainText('СИРОП');
    const syrNames = (await wbody.locator('.grow .gn').allInnerTexts())
      .map((n) => n.trim().split(/\s+/)[0].toUpperCase());
    expect(syrNames).toEqual(['AVILAC']);

    await page.locator('#wnav .done').click();
    await expect(wbody).toContainText('ИНГАЛЯЦИЯ');
    const inhNames = (await wbody.locator('.grow .gn').allInnerTexts())
      .map((n) => n.trim().split(/\s+/)[0].toUpperCase());
    expect(inhNames).toEqual(['AEROVENT', 'FLIXOTIDE']);

    // итоговый сквозной порядок: esomeprazole→fusid→forxiga→amiodacore→eliquis→avilac→aerovent→flixotide
    const fullOrder = [...tabOrder, ...syrNames, ...inhNames];
    expect(fullOrder).toEqual([
      'ESOMEPRAZOLE', 'FUSID', 'FORXIGA', 'AMIODACORE', 'ELIQUIS',
      'AVILAC', 'AEROVENT', 'FLIXOTIDE',
    ]);
  });
});
