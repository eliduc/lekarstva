/* KAO#1.2 — тесты чистой логики sync.js
 * (mergeByTs, mergeStatus, mergeLog, stable, configHash, cleanState).
 * cleanState приватна — проверяем её эффект через configJson? Нет: configHash и
 * публичной поверхности достаточно, плюс отдельно вытаскиваем cleanState из контекста.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
// Объекты/массивы из MedSync создаются в vm-реалме (другой Object/Array.prototype),
// поэтому для структурного сравнения используем НЕ строгий deepEqual (без проверки
// прототипа кросс-реалм). looseDeepEqual = node:assert.deepEqual (loose).
const looseDeepEqual = require('node:assert').deepEqual;
const { loadCore } = require('./load.js');

// mergeByTs и cleanState приватны внутри IIFE sync.js; тест-харнесс (load.js)
// прокидывает их как _mergeByTs/_cleanState (источник на диске не меняется).
function getCleanState(c) {
  return c.MedSync._cleanState;
}

/* ---------------- mergeByTs ---------------- */

test('mergeByTs — больший ts побеждает', () => {
  const c = loadCore();
  const merge = c.MedSync._mergeByTs;
  const a = { '08:00': { v: 'A', ts: 100 } };
  const b = { '08:00': { v: 'B', ts: 200 } };
  assert.deepEqual(merge(a, b)['08:00'], { v: 'B', ts: 200 }, 'b новее → b');
  assert.deepEqual(merge(b, a)['08:00'], { v: 'B', ts: 200 }, 'порядок не важен — выигрывает ts');
});

test('mergeByTs — равный ts: b перетирает a (>=)', () => {
  const c = loadCore();
  const merge = c.MedSync._mergeByTs;
  const a = { k: { v: 'A', ts: 100 } };
  const b = { k: { v: 'B', ts: 100 } };
  assert.equal(merge(a, b).k.v, 'B', 'при равенстве выигрывает второй аргумент');
});

test('mergeByTs — объединение непересекающихся ключей (union)', () => {
  const c = loadCore();
  const merge = c.MedSync._mergeByTs;
  const a = { '08:00': { ts: 1 } };
  const b = { '20:00': { ts: 2 } };
  const out = merge(a, b);
  assert.deepEqual(Object.keys(out).sort(), ['08:00', '20:00']);
});

test('mergeByTs — null/undefined входы безопасны', () => {
  const c = loadCore();
  const merge = c.MedSync._mergeByTs;
  looseDeepEqual(merge(null, null), {});
  looseDeepEqual(merge({ k: { ts: 1 } }, null), { k: { ts: 1 } });
  looseDeepEqual(merge(undefined, { k: { ts: 2 } }), { k: { ts: 2 } });
});

test('mergeByTs — отсутствующий ts трактуется как 0', () => {
  const c = loadCore();
  const merge = c.MedSync._mergeByTs;
  const a = { k: { v: 'A', ts: 5 } };
  const b = { k: { v: 'B' } }; // ts отсутствует → 0
  assert.equal(merge(a, b).k.v, 'A', 'запись без ts (=0) не перетирает ts=5');
});

/* ---------------- mergeStatus ---------------- */

test('mergeStatus — один день: слоты объединяются по ts', () => {
  const c = loadCore();
  const a = {
    date: '2026-06-15',
    slots: { '08:00': { done: true, ts: 100 }, '14:00': { done: false, ts: 50 } },
    box: {}, ts: 100,
  };
  const b = {
    date: '2026-06-15',
    slots: { '14:00': { done: true, ts: 200 }, '20:00': { done: true, ts: 150 } },
    box: {}, ts: 200,
  };
  const out = c.MedSync.mergeStatus(a, b);
  assert.equal(out.date, '2026-06-15');
  assert.equal(out.slots['08:00'].done, true, '08:00 из a (только там)');
  assert.equal(out.slots['14:00'].ts, 200, '14:00 — новее из b');
  assert.equal(out.slots['20:00'].done, true, '20:00 из b (только там)');
  assert.equal(out.ts, 200, 'ts = max');
});

test('mergeStatus — разные даты: слоты только из НОВОЙ даты', () => {
  const c = loadCore();
  const older = {
    date: '2026-06-14',
    slots: { '08:00': { done: true, ts: 999 } }, // даже с большим ts — отбрасывается
    box: { 'Mon|08:00': { iso: '2026-06-14', ts: 10 } }, ts: 999,
  };
  const newer = {
    date: '2026-06-15',
    slots: { '20:00': { done: false, ts: 1 } },
    box: { 'Tue|08:00': { iso: '2026-06-15', ts: 20 } }, ts: 1,
  };
  const out = c.MedSync.mergeStatus(older, newer);
  assert.equal(out.date, '2026-06-15', 'дата = более поздняя (строковое сравнение ISO)');
  assert.deepEqual(Object.keys(out.slots), ['20:00'], 'слоты только новой даты');
  assert.equal(out.slots['20:00'].done, false);
});

test('mergeStatus — box ВСЕГДА сливается, независимо от даты', () => {
  const c = loadCore();
  const a = {
    date: '2026-06-14',
    slots: {},
    box: { 'Mon|08:00': { iso: '2026-06-14', ts: 10 } }, ts: 0,
  };
  const b = {
    date: '2026-06-15',
    slots: {},
    box: { 'Tue|08:00': { iso: '2026-06-15', ts: 20 } }, ts: 0,
  };
  const out = c.MedSync.mergeStatus(a, b);
  assert.deepEqual(Object.keys(out.box).sort(), ['Mon|08:00', 'Tue|08:00'],
    'box объединяет ячейки обеих дат');
});

test('mergeStatus — box сливается по ts при совпадении ключа', () => {
  const c = loadCore();
  const a = { date: 'd', slots: {}, box: { cell: { v: 'old', ts: 1 } }, ts: 0 };
  const b = { date: 'd', slots: {}, box: { cell: { v: 'new', ts: 2 } }, ts: 0 };
  const out = c.MedSync.mergeStatus(a, b);
  assert.equal(out.box.cell.v, 'new');
});

test('mergeStatus — пустые/отсутствующие входы', () => {
  const c = loadCore();
  const out = c.MedSync.mergeStatus(null, null);
  looseDeepEqual(out.slots, {});
  looseDeepEqual(out.box, {});
  assert.equal(out.date, '');
  assert.equal(out.ts, 0);
});

test('mergeStatus — облако null, локальный есть → берём локальный', () => {
  const c = loadCore();
  const local = {
    date: '2026-06-15',
    slots: { '08:00': { done: true, ts: 5 } },
    box: { cell: { ts: 1 } }, ts: 5,
  };
  const out = c.MedSync.mergeStatus(null, local);
  assert.equal(out.date, '2026-06-15');
  assert.equal(out.slots['08:00'].done, true);
  assert.equal(out.box.cell.ts, 1);
});

/* ---------------- mergeLog ---------------- */

test('mergeLog — union по id без дублей', () => {
  const c = loadCore();
  const a = [{ id: 'e1', ts: 1 }, { id: 'e2', ts: 2 }];
  const b = [{ id: 'e2', ts: 2 }, { id: 'e3', ts: 3 }];
  const out = c.MedSync.mergeLog(a, b);
  assert.equal(out.length, 3, 'e2 не дублируется');
  looseDeepEqual(out.map((e) => e.id), ['e1', 'e2', 'e3']);
});

test('mergeLog — сортировка по ts', () => {
  const c = loadCore();
  const a = [{ id: 'late', ts: 300 }, { id: 'early', ts: 100 }];
  const b = [{ id: 'mid', ts: 200 }];
  const out = c.MedSync.mergeLog(a, b);
  looseDeepEqual(out.map((e) => e.id), ['early', 'mid', 'late']);
});

test('mergeLog — первое вхождение id выигрывает (порядок a затем b)', () => {
  const c = loadCore();
  const a = [{ id: 'x', ts: 1, src: 'a' }];
  const b = [{ id: 'x', ts: 1, src: 'b' }];
  const out = c.MedSync.mergeLog(a, b);
  assert.equal(out.length, 1);
  assert.equal(out[0].src, 'a', 'дубль из b отбрасывается, остаётся первый (a)');
});

test('mergeLog — записи без id игнорируются', () => {
  const c = loadCore();
  const a = [{ ts: 1 }, null, { id: 'ok', ts: 2 }];
  const out = c.MedSync.mergeLog(a, []);
  looseDeepEqual(out.map((e) => e.id), ['ok']);
});

test('mergeLog — пустые входы', () => {
  const c = loadCore();
  looseDeepEqual(c.MedSync.mergeLog(null, null), []);
  looseDeepEqual(c.MedSync.mergeLog([{ id: 'a', ts: 1 }], null).map((e) => e.id), ['a']);
});

/* ---------------- stable ---------------- */

test('stable — порядок ключей не влияет на результат', () => {
  const c = loadCore();
  const x = { b: 1, a: 2, c: { z: 9, y: 8 } };
  const y = { a: 2, c: { y: 8, z: 9 }, b: 1 };
  assert.equal(c.MedSync.stable(x), c.MedSync.stable(y));
});

test('stable — массивы сохраняют порядок (значим)', () => {
  const c = loadCore();
  assert.notEqual(c.MedSync.stable([1, 2, 3]), c.MedSync.stable([3, 2, 1]));
  assert.equal(c.MedSync.stable([1, 2, 3]), '[1,2,3]');
});

test('stable — примитивы и null', () => {
  const c = loadCore();
  assert.equal(c.MedSync.stable(null), 'null');
  assert.equal(c.MedSync.stable(5), '5');
  assert.equal(c.MedSync.stable('hi'), '"hi"');
  assert.equal(c.MedSync.stable(true), 'true');
});

test('stable — вложенные объекты сортируются рекурсивно', () => {
  const c = loadCore();
  const out = c.MedSync.stable({ z: { b: 2, a: 1 }, a: 1 });
  assert.equal(out, '{"a":1,"z":{"a":1,"b":2}}');
});

/* ---------------- configHash ---------------- */

test('configHash — детерминирован', () => {
  const c = loadCore();
  const s = c.defaultState();
  assert.equal(c.MedSync.configHash(s), c.MedSync.configHash(s));
});

test('configHash — меняется при изменении конфига', () => {
  const c = loadCore();
  const s1 = c.defaultState();
  const s2 = c.defaultState();
  s2.times.push('23:00');
  assert.notEqual(c.MedSync.configHash(s1), c.MedSync.configHash(s2));
});

test('configHash — НЕ зависит от секретов (токен/ключ стрипаются)', () => {
  const c = loadCore();
  const clean = c.defaultState();
  const withSecrets = c.defaultState();
  withSecrets.sync = { enabled: true, repo: 'u/r', token: 'ghp_SECRET' };
  withSecrets.aiKey = 'sk-ant-SECRET';
  withSecrets.deviceName = 'phone-1';
  const cleanWithSync = c.defaultState();
  cleanWithSync.sync = { enabled: true, repo: 'u/r', token: 'ghp_SECRET' };
  cleanWithSync.aiKey = 'sk-ant-SECRET';
  cleanWithSync.deviceName = 'phone-1';
  // configHash чистит секреты, значит хэш такой же, как у объекта с теми же
  // НЕсекретными полями (enabled/repo) но другим токеном.
  const other = c.defaultState();
  other.sync = { enabled: true, repo: 'u/r', token: 'ghp_DIFFERENT' };
  other.aiKey = 'sk-ant-DIFFERENT';
  other.deviceName = 'phone-2';
  assert.equal(c.MedSync.configHash(cleanWithSync), c.MedSync.configHash(other),
    'разные секреты → одинаковый configHash');
});

/* ---------------- cleanState (СТРИПАЕТ секреты) ---------------- */

test('cleanState — стрипает sync.token, aiKey, deviceName', () => {
  const c = loadCore();
  const cleanState = getCleanState(c);
  const input = {
    caregiver: 'X',
    sync: { enabled: true, repo: 'user/repo', token: 'ghp_SUPER_SECRET' },
    aiKey: 'sk-ant-SECRET',
    deviceName: 'pixel-7',
    times: ['08:00'],
  };
  const out = cleanState(input);
  // токен удалён
  assert.equal(out.sync.token, undefined, 'sync.token удалён');
  // но enabled/repo сохранены
  assert.equal(out.sync.enabled, true);
  assert.equal(out.sync.repo, 'user/repo');
  // aiKey и deviceName удалены
  assert.equal('aiKey' in out, false, 'aiKey удалён');
  assert.equal('deviceName' in out, false, 'deviceName удалён');
  // несекретные поля сохранены
  assert.equal(out.caregiver, 'X');
  assert.deepEqual(out.times, ['08:00']);
});

test('cleanState — не мутирует исходный state', () => {
  const c = loadCore();
  const cleanState = getCleanState(c);
  const input = {
    sync: { enabled: true, repo: 'r', token: 'ghp_X' },
    aiKey: 'sk-X', deviceName: 'd',
  };
  cleanState(input);
  assert.equal(input.sync.token, 'ghp_X', 'исходный токен на месте');
  assert.equal(input.aiKey, 'sk-X', 'исходный aiKey на месте');
  assert.equal(input.deviceName, 'd', 'исходный deviceName на месте');
});

test('cleanState — без sync: безопасно', () => {
  const c = loadCore();
  const cleanState = getCleanState(c);
  const out = cleanState({ caregiver: 'Y' });
  assert.equal(out.caregiver, 'Y');
  assert.equal(out.sync, undefined);
});

test('cleanState — sync без token нормализуется (enabled/repo defaults)', () => {
  const c = loadCore();
  const cleanState = getCleanState(c);
  const out = cleanState({ sync: {} });
  looseDeepEqual(out.sync, { enabled: false, repo: '' });
});

test('cleanState — пустой/undefined state', () => {
  const c = loadCore();
  const cleanState = getCleanState(c);
  assert.deepEqual(cleanState(undefined), {});
  assert.deepEqual(cleanState(null), {});
});

test('cleanState — сериализованный конфиг НЕ содержит секретов (защита от утечки)', () => {
  const c = loadCore();
  const cleanState = getCleanState(c);
  const out = cleanState({
    sync: { enabled: true, repo: 'r', token: 'ghp_LEAK_TOKEN' },
    aiKey: 'sk-ant-LEAK_KEY',
    deviceName: 'LEAK_DEVICE',
  });
  const json = JSON.stringify(out);
  assert.equal(json.includes('ghp_LEAK_TOKEN'), false, 'токен не в JSON');
  assert.equal(json.includes('sk-ant-LEAK_KEY'), false, 'aiKey не в JSON');
  assert.equal(json.includes('LEAK_DEVICE'), false, 'deviceName не в JSON');
});
