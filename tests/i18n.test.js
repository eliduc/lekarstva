/* KAO#1.2 — тесты чистой логики i18n.js (ruPl, fmtMeds, fmtDur, locQty, t/tf, ключи). */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadCore } = require('./load.js');

const LANGS = ['ru', 'en', 'he', 'uz'];

test('ruPl — русская плюрализация', async (t) => {
  const c = loadCore();
  const f = ['лекарство', 'лекарства', 'лекарств']; // [1, 2-4, 5-0/11-14]
  // одна форма (n1==1, кроме 11)
  for (const n of [1, 21, 31, 101, 1001]) {
    assert.equal(c.ruPl(n, f), 'лекарство', `n=${n} → форма[0]`);
  }
  // форма 2-4 (n1 2..4, кроме 12..14)
  for (const n of [2, 3, 4, 22, 23, 24, 102, 104]) {
    assert.equal(c.ruPl(n, f), 'лекарства', `n=${n} → форма[1]`);
  }
  // форма "много": 0, 5..20, 11..14
  for (const n of [0, 5, 6, 9, 10, 11, 12, 13, 14, 15, 19, 20, 25, 100, 111, 112]) {
    assert.equal(c.ruPl(n, f), 'лекарств', `n=${n} → форма[2]`);
  }
});

test('ruPl — модуль 100 и отрицательные', () => {
  const c = loadCore();
  const f = ['a', 'b', 'c'];
  // 11..14 всегда форма[2] даже как 111..114
  assert.equal(c.ruPl(11, f), 'c');
  assert.equal(c.ruPl(111, f), 'c');
  assert.equal(c.ruPl(114, f), 'c');
  // отрицательные обрабатываются через Math.abs
  assert.equal(c.ruPl(-1, f), 'a');
  assert.equal(c.ruPl(-2, f), 'b');
  assert.equal(c.ruPl(-5, f), 'c');
});

test('fmtMeds — по языкам', () => {
  const c = loadCore();
  c.setLang('ru');
  assert.equal(c.fmtMeds(1), '1 лекарство');
  assert.equal(c.fmtMeds(2), '2 лекарства');
  assert.equal(c.fmtMeds(5), '5 лекарств');
  c.setLang('en');
  assert.equal(c.fmtMeds(1), '1 medication');
  assert.equal(c.fmtMeds(2), '2 medications');
  c.setLang('he');
  assert.equal(c.fmtMeds(1), 'תרופה אחת');
  assert.equal(c.fmtMeds(3), '3 תרופות');
  c.setLang('uz');
  assert.equal(c.fmtMeds(1), '1 ta dori');
  assert.equal(c.fmtMeds(7), '7 ta dori');
  c.setLang('ru');
});

test('fmtDur — часы и минуты по языкам', () => {
  const c = loadCore();
  c.setLang('ru');
  assert.equal(c.fmtDur(0, 1), '1 минута');
  assert.equal(c.fmtDur(0, 2), '2 минуты');
  assert.equal(c.fmtDur(0, 5), '5 минут');
  assert.equal(c.fmtDur(1, 30), '1 час 30 минут');
  assert.equal(c.fmtDur(2, 0), '2 часа 0 минут');
  assert.equal(c.fmtDur(5, 21), '5 часов 21 минута');
  c.setLang('en');
  assert.equal(c.fmtDur(0, 1), '1 minute');
  assert.equal(c.fmtDur(1, 1), '1 hour 1 minute');
  assert.equal(c.fmtDur(2, 30), '2 hours 30 minutes');
  c.setLang('he');
  assert.equal(c.fmtDur(0, 1), 'דקה');
  assert.equal(c.fmtDur(1, 0), 'שעה 0 דקות'); // 1 час = 'שעה ', 0 минут = '0 דקות'
  assert.equal(c.fmtDur(1, 1), 'שעה דקה');     // m===1 → 'דקה'
  assert.equal(c.fmtDur(2, 5), '2 שעות 5 דקות');
  c.setLang('uz');
  assert.equal(c.fmtDur(0, 5), '5 daqiqa');
  assert.equal(c.fmtDur(1, 5), '1 soat 5 daqiqa');
  c.setLang('ru');
});

test('locQty — локализация единиц количества', () => {
  const c = loadCore();
  // ru — возврат как есть
  c.setLang('ru');
  assert.equal(c.locQty('1 таблетка'), '1 таблетка');
  assert.equal(c.locQty(''), '');
  assert.equal(c.locQty(null), '');
  assert.equal(c.locQty(undefined), '');
  // en
  c.setLang('en');
  assert.equal(c.locQty('1 таблетка'), '1 tablet');
  assert.equal(c.locQty('2 таблетки'), '2 tablets');
  assert.equal(c.locQty('30 мл'), '30 ml');
  assert.equal(c.locQty('40 мг'), '40 mg');
  assert.equal(c.locQty('2 капсулы'), '2 capsules');
  // he
  c.setLang('he');
  assert.equal(c.locQty('1 таблетка'), '1 טבליה');
  assert.equal(c.locQty('30 мл'), '30 מ"ל');
  // uz
  c.setLang('uz');
  assert.equal(c.locQty('1 таблетка'), '1 tabletka');
  assert.equal(c.locQty('1 мл'), '1 ml');
  c.setLang('ru');
});

test('t — выбор языка и fallback на ru', () => {
  const c = loadCore();
  c.setLang('ru');
  assert.equal(c.t('nav_home'), 'ГЛАВНАЯ');
  c.setLang('en');
  assert.equal(c.t('nav_home'), 'HOME');
  c.setLang('he');
  assert.equal(c.t('nav_home'), 'ראשי');
  c.setLang('uz');
  assert.equal(c.t('nav_home'), 'ASOSIY');
  // несуществующий ключ → возвращается сам ключ
  assert.equal(c.t('__no_such_key__'), '__no_such_key__');
  c.setLang('ru');
});

test('tf — подстановка переменных {x}', () => {
  const c = loadCore();
  c.setLang('ru');
  // today_is:"Сегодня — {d}"
  assert.equal(c.tf('today_is', { d: 'Понедельник' }), 'Сегодня — Понедельник');
  // in_t:"через {t} · {m}" — несколько переменных
  assert.equal(c.tf('in_t', { t: '2 часа', m: 'ФУСИД' }), 'через 2 часа · ФУСИД');
  // повторяющаяся переменная (tg_when:"{d}, {t}")
  assert.equal(c.tf('tg_when', { d: 'ВТ', t: '08:00' }), 'ВТ, 08:00');
  // отсутствие vars не ломает
  assert.equal(c.tf('nav_home', {}), 'ГЛАВНАЯ');
  assert.equal(c.tf('nav_home'), 'ГЛАВНАЯ');
});

test('tf — численная подстановка приводится корректно', () => {
  const c = loadCore();
  c.setLang('en');
  // meds_n:"{n} meds"
  assert.equal(c.tf('meds_n', { n: 5 }), '5 meds');
  c.setLang('ru');
});

test('наличие ключей во всех 4 языках', () => {
  const c = loadCore();
  const L = c.L;
  for (const lng of LANGS) {
    assert.ok(L[lng], `язык ${lng} существует`);
  }
  const ruKeys = Object.keys(L.ru);
  // каждый ru-ключ обязан присутствовать в en/he/uz
  for (const lng of ['en', 'he', 'uz']) {
    const missing = ruKeys.filter((k) => !(k in L[lng]));
    assert.equal(missing.length, 0, `в ${lng} отсутствуют ключи: ${missing.join(', ')}`);
  }
});

test('нет лишних ключей в нерусских языках (симметрия)', () => {
  const c = loadCore();
  const L = c.L;
  const ruKeys = new Set(Object.keys(L.ru));
  for (const lng of ['en', 'he', 'uz']) {
    const extra = Object.keys(L[lng]).filter((k) => !ruKeys.has(k));
    assert.equal(extra.length, 0, `в ${lng} лишние ключи: ${extra.join(', ')}`);
  }
});

test('days_full/days_short — 7 элементов во всех языках', () => {
  const c = loadCore();
  const L = c.L;
  for (const lng of LANGS) {
    assert.equal(L[lng].days_full.length, 7, `${lng} days_full=7`);
    assert.equal(L[lng].days_short.length, 7, `${lng} days_short=7`);
  }
});

test('LANG_META — флаг и имя для всех 4 языков', () => {
  const c = loadCore();
  for (const lng of LANGS) {
    assert.ok(c.LANG_META[lng], `LANG_META[${lng}]`);
    assert.ok(c.LANG_META[lng].flag, `флаг ${lng}`);
    assert.ok(c.LANG_META[lng].name, `имя ${lng}`);
  }
});
