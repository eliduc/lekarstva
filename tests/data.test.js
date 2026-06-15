/* KAO#1.2 — тесты чистой логики data.js (defaultState, medImg, hash, esc). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load.js');

test('defaultState — ровно 3 времени 08:00/14:00/20:00', () => {
  const c = loadCore();
  const s = c.defaultState();
  assert.deepEqual(s.times, ['08:00', '14:00', '20:00']);
  assert.equal(s.times.length, 3);
});

test('defaultState — 9 лекарств в библиотеке', () => {
  const c = loadCore();
  const s = c.defaultState();
  const ids = Object.keys(s.meds);
  assert.equal(ids.length, 9, 'ожидается 9 лекарств, есть: ' + ids.join(', '));
  // ожидаемый набор id
  const expected = ['esomeprazole', 'fusid', 'forxiga', 'amiodacore', 'eliquis',
    'lipitor', 'avilac', 'aerovent', 'flixotide'].sort();
  assert.deepEqual(ids.slice().sort(), expected);
});

test('defaultState — расписание: 08:00=8 преп, 14:00=[flixotide], 20:00=4', () => {
  const c = loadCore();
  const s = c.defaultState();
  assert.equal(s.schedule['08:00'].length, 8, '08:00 → 8 препаратов');
  assert.deepEqual(s.schedule['14:00'], ['flixotide'], '14:00 → только flixotide');
  assert.equal(s.schedule['20:00'].length, 4, '20:00 → 4 препарата');
  // ключи расписания совпадают с временами
  assert.deepEqual(Object.keys(s.schedule).sort(), s.times.slice().sort());
});

test('defaultState — каждый id в расписании существует в библиотеке', () => {
  const c = loadCore();
  const s = c.defaultState();
  const lib = new Set(Object.keys(s.meds));
  for (const time of Object.keys(s.schedule)) {
    for (const id of s.schedule[time]) {
      assert.ok(lib.has(id), `${time}: лекарство "${id}" нет в библиотеке`);
    }
  }
});

test('defaultState — amiodacore.excludeDays = [2,5]', () => {
  const c = loadCore();
  const s = c.defaultState();
  assert.deepEqual(s.meds.amiodacore.excludeDays, [2, 5]);
});

test('defaultState — esomeprazole warnLevel=red, warnBig=true', () => {
  const c = loadCore();
  const s = c.defaultState();
  assert.equal(s.meds.esomeprazole.warnLevel, 'red');
  assert.equal(s.meds.esomeprazole.warnBig, true);
});

test('defaultState — eliquis warnLevel=red (антикоагулянт)', () => {
  const c = loadCore();
  const s = c.defaultState();
  assert.equal(s.meds.eliquis.warnLevel, 'red');
});

test('defaultState — возвращает свежую копию (без общих ссылок)', () => {
  const c = loadCore();
  const a = c.defaultState();
  const b = c.defaultState();
  a.times.push('XX:XX');
  a.meds.fusid.qty = 'mutated';
  assert.notEqual(b.times.length, a.times.length, 'мутация times не утекает');
  assert.equal(b.meds.fusid.qty, '1 таблетка', 'мутация meds не утекает');
});

test('medImg — data:/IMG_SRC/null', () => {
  const c = loadCore();
  // null / без img
  assert.equal(c.medImg(null), null);
  assert.equal(c.medImg(undefined), null);
  assert.equal(c.medImg({}), null);
  assert.equal(c.medImg({ img: '' }), null);
  // data: URL возвращается как есть
  const dataUrl = 'data:image/jpeg;base64,/9j/AAAA';
  assert.equal(c.medImg({ img: dataUrl }), dataUrl);
  // известный ключ → путь из IMG_SRC
  assert.equal(c.medImg({ img: 'fusid' }), 'img/fusid.jpg');
  assert.equal(c.medImg({ img: 'flixotide' }), 'img/flixotide.jpg');
  // неизвестный ключ → null
  assert.equal(c.medImg({ img: 'no_such_image' }), null);
});

test('medImg — каждое лекарство по умолчанию имеет рабочую картинку', () => {
  const c = loadCore();
  const s = c.defaultState();
  for (const id of Object.keys(s.meds)) {
    const src = c.medImg(s.meds[id]);
    assert.ok(src, `${id}: medImg вернул путь`);
    assert.match(src, /^img\/.+\.jpg$/, `${id}: путь в img/*.jpg`);
  }
});

test('hash — детерминирован и зависит от входа', () => {
  const c = loadCore();
  assert.equal(c.hash('abc'), c.hash('abc'), 'одинаковый вход → одинаковый хэш');
  assert.notEqual(c.hash('abc'), c.hash('abd'), 'разный вход → разный хэш');
  // непустая строка-результат в base36
  assert.match(c.hash('hello'), /^[0-9a-z]+$/);
  // пустая строка и число приводятся (FNV-1a от String(x))
  assert.equal(c.hash(''), c.hash(''));
  assert.equal(c.hash(123), c.hash('123'));
});

test('hash — известное значение FNV-1a (offset для пустой строки)', () => {
  const c = loadCore();
  // FNV-1a 32 offset basis = 0x811c9dc5 = 2166136261 → base36
  assert.equal(c.hash(''), (2166136261).toString(36));
});

test('esc — экранирует & < > " \'', () => {
  const c = loadCore();
  assert.equal(c.esc('&'), '&amp;');
  assert.equal(c.esc('<'), '&lt;');
  assert.equal(c.esc('>'), '&gt;');
  assert.equal(c.esc('"'), '&quot;');
  assert.equal(c.esc("'"), '&#39;');
  assert.equal(c.esc('<script>alert("x")</script>'),
    '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  // & экранируется первым (нет двойного экранирования)
  assert.equal(c.esc('a&b'), 'a&amp;b');
  // null/undefined → пустая строка
  assert.equal(c.esc(null), '');
  assert.equal(c.esc(undefined), '');
  // число приводится к строке
  assert.equal(c.esc(42), '42');
});

test('esc — обычный текст без спецсимволов не меняется', () => {
  const c = loadCore();
  assert.equal(c.esc('ФУСИД 40 мг'), 'ФУСИД 40 мг');
});

/* escAttrJs — экранирование для двойного контекста onclick="fn('<тут>')"
   (KAO#1.2: защита от инъекции облачных ключей/ISO в инлайновый обработчик). */
test('escAttrJs — одинарная кавычка гасится через \\ (НЕ &#39;)', () => {
  const c = loadCore();
  // апостроф экранируется как JS-строка (\\'), иначе вырвался бы из onclick
  assert.equal(c.escAttrJs("a'b"), "a\\'b");
  assert.equal(c.escAttrJs("');alert(1)//"), "\\');alert(1)//");
});

test('escAttrJs — бэкслэш удваивается первым', () => {
  const c = loadCore();
  assert.equal(c.escAttrJs('a\\b'), 'a\\\\b');
});

test('escAttrJs — HTML-метасимволы " < > & через сущности', () => {
  const c = loadCore();
  assert.equal(c.escAttrJs('a"b'), 'a&quot;b');
  assert.equal(c.escAttrJs('a<b>c'), 'a&lt;b&gt;c');
  assert.equal(c.escAttrJs('a&b'), 'a&amp;b');
});

test('escAttrJs — переводы строк схлопываются в пробел', () => {
  const c = loadCore();
  assert.equal(c.escAttrJs('a\nb'), 'a b');
  assert.equal(c.escAttrJs('a\r\nb'), 'a  b'); // \r и \n заменяются КАЖДЫЙ → два пробела
});

test('escAttrJs — null/undefined/число', () => {
  const c = loadCore();
  assert.equal(c.escAttrJs(null), '');
  assert.equal(c.escAttrJs(undefined), '');
  assert.equal(c.escAttrJs(42), '42');
});
