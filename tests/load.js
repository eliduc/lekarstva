/* KAO#1.2 — загрузчик DOM-free модулей приложения в node через vm.
 * i18n.js / data.js / sync.js делят общий лексический global scope (как в браузере,
 * где они грузятся подряд <script>'ами). Поэтому грузим их в ОДИН vm-контекст:
 * const/function верхнего уровня одного файла видны следующему.
 * storage.js самодостаточен (IIFE на window.MedStore) — грузится отдельно, чтобы
 * можно было подменять location (stage-режим).
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const JSDIR = path.join(ROOT, 'js');

function readJs(name) {
  return fs.readFileSync(path.join(JSDIR, name), 'utf8');
}

/* Загрузить i18n+data+sync в один контекст.
 * window нужен, т.к. sync.js делает window.MedSync = (...). btoa/atob нужны sync.js. */
function loadCore() {
  const win = {};
  const ctx = {
    window: win,
    location: { pathname: '/', search: '' },
    console,
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    // fetch не нужен для чистой логики, но пусть будет no-op, чтобы парс не падал на ссылках
    fetch: () => Promise.reject(new Error('no network in tests')),
    Math, JSON, Object, Array, String, Number, Boolean, Date, RegExp,
  };
  vm.createContext(ctx);
  // порядок важен: i18n (t/tf) -> data (использует t) -> sync (использует hash/stable)
  vm.runInContext(readJs('i18n.js'), ctx, { filename: 'i18n.js' });
  vm.runInContext(readJs('data.js'), ctx, { filename: 'data.js' });

  // sync.js: mergeByTs и cleanState — приватные (внутри IIFE), но КАО#1.2 требует
  // их прямого тестирования. Файл приложения на диске НЕ меняем — здесь только
  // в загруженной В ПАМЯТЬ копии источника дописываем эти функции в объект,
  // возвращаемый IIFE (поведение приложения идентично, добавлены лишь поля API
  // в тестовом процессе). Это не правка app-кода, а тест-харнесс.
  var rawSync = readJs('sync.js');
  var syncSrc = rawSync.replace(
    /return\s*\{\s*\n\s*isOn:\s*isOn,/,
    'return {\n    _mergeByTs: mergeByTs,\n    _cleanState: cleanState,\n    isOn: isOn,'
  );
  if (syncSrc === rawSync) {
    throw new Error(
      'tests/load.js: не удалось внедрить тест-хуки _mergeByTs/_cleanState в sync.js — ' +
      'изменилась форма "return { isOn: isOn,". Поправьте регэксп в loadCore().'
    );
  }
  vm.runInContext(syncSrc, ctx, { filename: 'sync.js' });

  // Достаём символы верхнего уровня. const/function в vm-скрипте НЕ попадают на ctx
  // автоматически (они лексические), поэтому экспортируем их явным выражением.
  const exported = vm.runInContext(`({
    L: L, LANG_META: LANG_META,
    t: t, tf: tf, DF: DF, DS: DS,
    ruPl: ruPl, fmtMeds: fmtMeds, fmtDur: fmtDur, locQty: locQty,
    getLang: function(){ return lang; },
    setLang: function(v){ lang = v; },
    defaultState: defaultState, esc: esc, escAttrJs: escAttrJs, wlClass: wlClass, hash: hash, medImg: medImg,
    icon: icon, tyLabel: tyLabel, TYPES: TYPES, IMG_SRC: IMG_SRC,
    medRu: medRu, medSub: medSub, medWarn: medWarn,
    MedSync: window.MedSync
  })`, ctx, { filename: 'export.js' });

  exported._ctx = ctx;
  return exported;
}

/* Загрузить storage.js с подменяемым location (для проверки stage-префикса).
 * Передаём собственный localStorage-мок, чтобы наблюдать реальные ключи. */
function loadStorage(opts) {
  opts = opts || {};
  const storeBacking = {};
  const localStorageMock = {
    getItem: (k) => (Object.prototype.hasOwnProperty.call(storeBacking, k) ? storeBacking[k] : null),
    setItem: (k, v) => { storeBacking[k] = String(v); },
    removeItem: (k) => { delete storeBacking[k]; },
  };
  const win = {};
  const ctx = {
    window: win,
    location: { pathname: opts.pathname || '/', search: opts.search || '' },
    localStorage: opts.noLocalStorage ? undefined : localStorageMock,
    console,
    JSON, Object,
  };
  // Если просят сломать localStorage (приватный режим) — делаем getter, бросающий ошибку.
  if (opts.noLocalStorage) {
    Object.defineProperty(ctx, 'localStorage', {
      get() { throw new Error('localStorage disabled'); },
    });
  }
  vm.createContext(ctx);
  vm.runInContext(readJs('storage.js'), ctx, { filename: 'storage.js' });
  return { MedStore: win.MedStore, backing: storeBacking, ctx };
}

module.exports = { loadCore, loadStorage, ROOT, JSDIR };
