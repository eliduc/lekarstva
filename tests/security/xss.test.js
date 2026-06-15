/* КАО#1.3 (SECURITY) — XSS/инъекции для DOM-free хелперов экранирования.
 *
 * app.js DOM-зависим (его innerHTML-шаблоны проверяются в браузере/Playwright),
 * но низкоуровневые экранировщики esc() и escAttrJs() живут в data.js и
 * тестируемы в node через vm. Эти функции — единственный барьер между
 * пользовательскими/облачными строками и innerHTML, поэтому их корректность
 * критична: если esc/escAttrJs пропускают метасимволы, ВСЕ места их вызова в
 * app.js становятся XSS-дырами.
 *
 * Контекст escAttrJs: подстановка в инлайновый onclick вида
 *   onclick="fn('${escAttrJs(id)}')"
 * Здесь ДВА вложенных контекста: HTML-атрибут (двойные кавычки) и JS-строка
 * (одинарные). Браузер сначала декодирует HTML-сущности, ПОТОМ парсит JS,
 * поэтому одинарную кавычку нельзя гасить через &#39; — нужен JS-бэкслэш.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('../load.js');

/* ---------------- esc() — HTML-текст/атрибут ---------------- */

test('esc — экранирует все пять HTML-метасимволов', () => {
  const c = loadCore();
  assert.equal(c.esc('<script>'), '&lt;script&gt;');
  assert.equal(c.esc('a&b'), 'a&amp;b');
  assert.equal(c.esc('"x"'), '&quot;x&quot;');
  assert.equal(c.esc("'y'"), '&#39;y&#39;');
});

test('esc — нейтрализует классический img-onerror payload', () => {
  const c = loadCore();
  const payload = '"><img src=x onerror=alert(1)>';
  const out = c.esc(payload);
  assert.equal(out.includes('<'), false, 'нет сырого <');
  assert.equal(out.includes('>'), false, 'нет сырого >');
  assert.equal(out.includes('"'), false, 'нет сырой кавычки');
});

test('esc — null/undefined → пустая строка (не "null"/"undefined")', () => {
  const c = loadCore();
  assert.equal(c.esc(null), '');
  assert.equal(c.esc(undefined), '');
});

test('esc — числа/прочее приводятся к строке', () => {
  const c = loadCore();
  assert.equal(c.esc(42), '42');
});

/* ---------------- escAttrJs() — двойной контекст onclick (КАО#1) ---------------- */

test('escAttrJs — одинарная кавычка экранируется ДЛЯ JS (бэкслэш), не &#39;', () => {
  const c = loadCore();
  const out = c.escAttrJs("'");
  // должно остаться \'  — иначе после HTML-декода кавычка вернётся к JS-парсеру
  assert.equal(out, "\\'", "одинарная кавычка → \\' (JS-уровень)");
  assert.equal(out.includes('&#39;'), false, 'НЕ через HTML-сущность');
});

test('escAttrJs — бэкслэш удваивается (нельзя экранировать наш же \\\')', () => {
  const c = loadCore();
  assert.equal(c.escAttrJs('\\'), '\\\\');
  // payload  \'  не должен схлопнуться в экранированную кавычку
  assert.equal(c.escAttrJs("\\'"), "\\\\\\'");
});

test('escAttrJs — двойная кавычка/угловые скобки/амперсанд → HTML-сущности', () => {
  const c = loadCore();
  assert.equal(c.escAttrJs('"'), '&quot;');
  assert.equal(c.escAttrJs('<'), '&lt;');
  assert.equal(c.escAttrJs('>'), '&gt;');
  assert.equal(c.escAttrJs('&'), '&amp;');
});

test('escAttrJs — переводы строк убираются (инлайн-атрибут одной строкой)', () => {
  const c = loadCore();
  assert.equal(c.escAttrJs('a\nb\rc').includes('\n'), false);
  assert.equal(c.escAttrJs('a\nb\rc').includes('\r'), false);
});

test('escAttrJs — реальный payload вырыва из onclick нейтрализован', () => {
  const c = loadCore();
  // Облачный ключ лекарства вида:  ');alert(document.cookie);//
  const payload = "');alert(document.cookie);//";
  const id = c.escAttrJs(payload);
  // Соберём фрагмент так же, как app.js: onclick="editMed('<id>')"
  const attr = `editMed('${id}')`;
  // 1) JS-строка не закрывается раньше времени: единственная закрывающая ' —
  //    последняя (после ')'), все внутренние ' экранированы \'.
  // Эмулируем двухступенчатый разбор браузера:
  const htmlDecoded = attr
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // Теперь htmlDecoded — это исходник JS, который выполнит браузер.
  // Достаём строковый литерал-аргумент через JSON-безопасный разбор:
  const m = /^editMed\('((?:\\.|[^'\\])*)'\)$/.exec(htmlDecoded);
  assert.ok(m, 'аргумент остаётся ОДНИМ корректным JS-строковым литералом, инъекции нет');
  // и раскодированное значение литерала равно исходному payload (данные сохранены).
  // Раскодируем JS-строковый литерал БЕЗ eval (безопасно): снимаем только \' и \\.
  const decoded = m[1].replace(/\\(['\\])/g, '$1');
  assert.equal(decoded, payload, 'данные не искажены, только обезврежены');
});

test('escAttrJs — payload не порождает исполняемого вызова alert', () => {
  const c = loadCore();
  const id = c.escAttrJs("x');document.title='PWNED';('");
  const attr = `editMed('${id}')`;
  const htmlDecoded = attr
    .replace(/&quot;/g, '"').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&amp;/g, '&');
  // Корректный одиночный литерал-аргумент → нет второго стейтмента после ')'
  assert.ok(/^editMed\('(?:\\.|[^'\\])*'\)$/.test(htmlDecoded),
    'нет вырыва во второй JS-стейтмент');
});

test('escAttrJs — null/undefined → пустая строка', () => {
  const c = loadCore();
  assert.equal(c.escAttrJs(null), '');
  assert.equal(c.escAttrJs(undefined), '');
});

/* ---------------- wlClass() — whitelist warnLevel (КАО#2, анти-XSS из облака) ---------------- */

test('wlClass — пропускает только info/amber/red', () => {
  const c = loadCore();
  assert.equal(c.wlClass('info'), 'info');
  assert.equal(c.wlClass('amber'), 'amber');
  assert.equal(c.wlClass('red'), 'red');
});

test('wlClass — любое чужое значение → info (нет вырыва из class-атрибута)', () => {
  const c = loadCore();
  // именно этот payload исполнялся через <div class="wflag ${warnLevel}">
  assert.equal(c.wlClass('"><img src=x onerror=alert(1)>'), 'info');
  assert.equal(c.wlClass('red onmouseover=alert(1)'), 'info');
  assert.equal(c.wlClass(''), 'info');
  assert.equal(c.wlClass(undefined), 'info');
  assert.equal(c.wlClass(null), 'info');
  // в выводе нет ни одного метасимвола атрибута
  const out = c.wlClass('a"b<c>');
  assert.equal(/["<>]/.test(out), false);
});

/* ---------------- tyLabel() — m.type из облака в innerHTML (КАО#2) ---------------- */

test('tyLabel — известные типы переводятся как раньше', () => {
  const c = loadCore();
  c.setLang('ru');
  assert.equal(c.tyLabel('tab'), 'ТАБЛЕТКИ');
  assert.equal(c.tyLabel('inh'), 'ИНГАЛЯЦИЯ');
});

test('tyLabel — неизвестный тип не возвращает сырой HTML (экранируется)', () => {
  const c = loadCore();
  const payload = '<img src=x onerror=alert(1)>';
  const out = c.tyLabel(payload);
  assert.equal(out.includes('<'), false, 'нет сырого <');
  assert.equal(out.includes('>'), false, 'нет сырого >');
  // и не возвращает «ty_<...>» с живыми метасимволами
  assert.equal(/[<>"']/.test(out), false);
});

/* ---------------- medImg() — только data:/известные пути (анти-инъекция src) ---------------- */

test('medImg — отвергает не-data строку (нельзя протащить onerror через img)', () => {
  const c = loadCore();
  // Облачный m.img с попыткой инъекции: НЕ начинается с data: и НЕ в IMG_SRC
  assert.equal(c.medImg({ img: 'x" onerror="alert(1)' }), null,
    'произвольная строка → null, в src не попадёт');
  assert.equal(c.medImg({ img: 'javascript:alert(1)' }), null);
});

test('medImg — пропускает data:-URL (легитимное фото) и известные ключи', () => {
  const c = loadCore();
  const dataUrl = 'data:image/jpeg;base64,AAAA';
  assert.equal(c.medImg({ img: dataUrl }), dataUrl);
  assert.equal(c.medImg({ img: 'fusid' }), c.IMG_SRC.fusid);
});

/* КАО#3 (SECURITY) — вырыв из <img src="..."> через data:-URL с кавычкой.
   Прежняя medImg пропускала ЛЮБУЮ строку с префиксом "data:", поэтому облачный
   m.img вида  data:image/png;base64,x" onerror="alert(1)  ломал атрибут src и
   исполнял onerror. Теперь пропускается только строгая форма data:image/...;base64,<safe>. */
test('medImg — data:-URL с кавычкой/угловыми скобками отвергается (анти-вырыв из src)', () => {
  const c = loadCore();
  // двойная кавычка — закрывает src и открывает onerror
  assert.equal(c.medImg({ img: 'data:image/png;base64,x" onerror="alert(document.cookie)' }), null,
    'data:-URL с " не должен попадать в src');
  // угловые скобки
  assert.equal(c.medImg({ img: 'data:image/png;base64,x><script>alert(1)</script>' }), null);
  // svg с onload — не base64-форма
  assert.equal(c.medImg({ img: 'data:image/svg+xml,<svg onload=alert(1)>' }), null);
  // одинарная кавычка / бэктик
  assert.equal(c.medImg({ img: "data:image/png;base64,x' onerror='alert(1)" }), null);
  assert.equal(c.medImg({ img: 'data:image/png;base64,x` ' }), null);
});

test('medImg — легитимные canvas.toDataURL остаются валидными (Non-Degradation)', () => {
  const c = loadCore();
  // именно такой вид даёт canvas.toDataURL('image/jpeg',...) в app.js
  const realJpeg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA==';
  assert.equal(c.medImg({ img: realJpeg }), realJpeg);
  const realPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  assert.equal(c.medImg({ img: realPng }), realPng);
});
