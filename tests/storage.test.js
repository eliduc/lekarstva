/* KAO#1.2 — тесты storage.js: префикс ключей stage: и базовое поведение. */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadStorage } = require('./load.js');

test('prod-режим — ключи БЕЗ префикса', () => {
  const s = loadStorage({ pathname: '/', search: '' });
  assert.equal(s.MedStore.isStage, false);
  s.MedStore.set('medapp:lang', 'ru');
  assert.deepEqual(Object.keys(s.backing), ['medapp:lang'], 'ключ без префикса');
  assert.equal(s.MedStore.get('medapp:lang'), 'ru');
});

test('stage по pathname /lekarstva-stage/ — префикс stage:', () => {
  const s = loadStorage({ pathname: '/lekarstva-stage/index.html', search: '' });
  assert.equal(s.MedStore.isStage, true);
  s.MedStore.set('medapp:lang', 'he');
  assert.deepEqual(Object.keys(s.backing), ['stage:medapp:lang']);
  assert.equal(s.MedStore.get('medapp:lang'), 'he');
});

test('stage по query ?env=stage — префикс stage:', () => {
  const s = loadStorage({ pathname: '/', search: '?env=stage' });
  assert.equal(s.MedStore.isStage, true);
  s.MedStore.set('medapp:box', '{}');
  assert.deepEqual(Object.keys(s.backing), ['stage:medapp:box']);
});

test('stage по query &env=stage (не первый параметр)', () => {
  const s = loadStorage({ pathname: '/', search: '?a=1&env=stage' });
  assert.equal(s.MedStore.isStage, true);
});

test('изоляция prod/stage — данные не пересекаются на одном backing', () => {
  // Симулируем общий origin: разные store, но проверяем разные ключи.
  const prod = loadStorage({ pathname: '/lekarstva/', search: '' });
  const stage = loadStorage({ pathname: '/lekarstva-stage/', search: '' });
  prod.MedStore.set('medapp:state:v2', 'PROD_DATA');
  stage.MedStore.set('medapp:state:v2', 'STAGE_DATA');
  // Ключи различаются префиксом → на общем localStorage не затёрли бы друг друга.
  assert.deepEqual(Object.keys(prod.backing), ['medapp:state:v2']);
  assert.deepEqual(Object.keys(stage.backing), ['stage:medapp:state:v2']);
});

test('remove — удаляет ключ с правильным префиксом', () => {
  const s = loadStorage({ pathname: '/lekarstva-stage/', search: '' });
  s.MedStore.set('medapp:lang', 'uz');
  assert.equal(s.MedStore.get('medapp:lang'), 'uz');
  s.MedStore.remove('medapp:lang');
  assert.equal(s.MedStore.get('medapp:lang'), null);
  assert.deepEqual(Object.keys(s.backing), []);
});

test('getMeta/setMeta — единый JSON medapp:meta, без префикса в prod', () => {
  const s = loadStorage({ pathname: '/', search: '' });
  s.MedStore.setMeta('backupGeneration', 7);
  assert.equal(s.MedStore.getMeta('backupGeneration'), 7);
  assert.deepEqual(Object.keys(s.backing), ['medapp:meta']);
  // setMeta(null) удаляет поле
  s.MedStore.setMeta('backupGeneration', null);
  assert.equal(s.MedStore.getMeta('backupGeneration'), undefined);
});

test('getMeta/setMeta — в stage хранится под stage:medapp:meta', () => {
  const s = loadStorage({ pathname: '/lekarstva-stage/', search: '' });
  s.MedStore.setMeta('lastSyncError', 'нет сети');
  assert.deepEqual(Object.keys(s.backing), ['stage:medapp:meta']);
  assert.equal(s.MedStore.getMeta('lastSyncError'), 'нет сети');
});

test('get без значения возвращает null', () => {
  const s = loadStorage({ pathname: '/', search: '' });
  assert.equal(s.MedStore.get('medapp:nothing'), null);
});

test('fallback на mem при недоступном localStorage (приватный режим)', () => {
  const s = loadStorage({ noLocalStorage: true, pathname: '/', search: '' });
  // не должно бросать; пишет в внутренний mem
  s.MedStore.set('medapp:lang', 'en');
  assert.equal(s.MedStore.get('medapp:lang'), 'en');
});
