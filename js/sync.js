/* MedSync — «сервер» приложения: приватный репозиторий GitHub через Contents API.
 *
 * Два независимых канала (у конфига и статуса разная частота записи):
 *   A. КОНФИГ  -> backup/data.json       редко; версия (generation) + compare-and-swap
 *   B. СТАТУС  -> status/<iso>.json       часто; слияние «последняя запись по ts» (LWW)
 *
 * Токен (fine-grained PAT, Contents: Read/Write только на репозиторий данных)
 * вводится в настройках, хранится локально и в облако не уходит.
 *
 * Опорная реализация — PaymentToMetapel/js/sync.js (CAS по sha, generation, fallback
 * на download_url для файлов >1 МБ).
 */
window.MedSync = (function () {
  'use strict';

  function conf(state) { return (state && state.sync) || {}; }
  function isOn(state) {
    var c = conf(state);
    return !!(c.enabled && c.repo && c.token);
  }

  function b64(str) { return btoa(unescape(encodeURIComponent(str))); }
  function unb64(str) { return decodeURIComponent(escape(atob(str))); }

  function headers(c) {
    return {
      'Authorization': 'Bearer ' + c.token,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json'
    };
  }

  // Каноничный JSON (отсортированные ключи) — для сравнения и хэша без ложных диффов.
  function stable(v) {
    if (v === null || typeof v !== 'object') return JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
    return '{' + Object.keys(v).sort().map(function (k) {
      return JSON.stringify(k) + ':' + stable(v[k]);
    }).join(',') + '}';
  }

  // PUT файла. casSha:
  //   undefined  — подтянуть текущий sha и перезаписать (без защиты от гонки);
  //   строка/null — писать ИМЕННО с этим sha; если файл изменился (sha устарел),
  //                 GitHub вернёт 409/422 → бросаем ошибку, чужую запись не трём.
  function putFile(c, path, jsonStr, message, casSha) {
    var url = 'https://api.github.com/repos/' + c.repo + '/contents/' + path;
    function doPut(sha) {
      var body = { message: message, content: b64(jsonStr) };
      if (sha) body.sha = sha;
      return fetch(url, { method: 'PUT', headers: headers(c), body: JSON.stringify(body) })
        .then(function (r) {
          if (r.status === 409 || r.status === 422) {
            throw new Error('CONFLICT'); // облако изменилось с другого устройства
          }
          if (!r.ok) {
            return r.text().then(function (t) {
              throw new Error('GitHub ' + r.status + ': ' + t.slice(0, 160));
            });
          }
          return true;
        });
    }
    if (typeof casSha !== 'undefined') return doPut(casSha);
    return readCloud(c, path).then(function (res) { return doPut(res.sha); });
  }

  // Мягкое чтение JSON-файла. Возвращает {data, sha}: data=null если файла нет (404).
  function readCloud(c, path) {
    var url = 'https://api.github.com/repos/' + c.repo + '/contents/' + path;
    return fetch(url, { headers: headers(c) }).then(function (r) {
      if (r.status === 404) return { data: null, sha: null };
      if (!r.ok) throw new Error('GitHub ' + r.status);
      return r.json();
    }).then(function (j) {
      if (!j || j.data === null) return { data: null, sha: null };
      var sha = j.sha || null;
      var content = String(j.content || '').replace(/\s/g, '');
      if (content) return { data: JSON.parse(unb64(content)), sha: sha };
      // файл >1 МБ: Contents API не отдал содержимое — тянем сырой по ссылке
      if (j.download_url) {
        return fetch(j.download_url).then(function (raw) {
          if (!raw.ok) throw new Error('GitHub ' + raw.status);
          return raw.json();
        }).then(function (d) { return { data: d, sha: sha }; });
      }
      throw new Error('Не удалось прочитать файл из архива.');
    });
  }

  /* ======================= A. КОНФИГ ======================= */

  // Чистая копия конфигурации для облака: убираем секреты и поля устройства.
  function cleanState(state) {
    var s = JSON.parse(JSON.stringify(state || {}));
    if (s.sync) s.sync = { enabled: !!s.sync.enabled, repo: s.sync.repo || '' }; // токен НЕ кладём
    delete s.aiKey;      // ключ Anthropic — только на устройстве
    delete s.deviceName; // имя устройства — локальное
    return s;
  }
  function buildConfig(state, generation) {
    return { kind: 'meds-backup', generation: generation, state: cleanState(state) };
  }
  function configJson(state, gen) { return JSON.stringify(buildConfig(state, gen), null, 1); }
  function configHash(state) { return hash(stable(buildConfig(state, 0))); }

  // Залить backup/data.json, если конфиг изменился И копия не старше облачной.
  function backupConfigIfChanged(state, store) {
    if (!isOn(state)) return Promise.resolve(false);
    var dataHash = hash(stable(buildConfig(state, 0))); // gen=0 → рост версии не триггерит заливку
    if (store.getMeta('lastBackupHash') === dataHash) return Promise.resolve(false);
    var c = conf(state);
    return readCloud(c, 'backup/data.json').then(function (res) {
      var cloud = res.data;
      var cloudGen = (cloud && typeof cloud.generation === 'number') ? cloud.generation : -1;
      var localGen = store.getMeta('backupGeneration') || 0;
      if (cloud && cloudGen > localGen) {
        store.setMeta('lastSyncError',
          'Облачная копия новее этого устройства — нажмите «Загрузить из архива».');
        return false;
      }
      var newGen = Math.max(cloudGen, localGen) + 1;
      return putFile(c, 'backup/data.json', configJson(state, newGen), 'config gen ' + newGen, res.sha)
        .then(function () {
          store.setMeta('backupGeneration', newGen);
          store.setMeta('lastBackupHash', dataHash);
          store.setMeta('lastSyncError', null);
          return true;
        });
    }).catch(function (e) {
      store.setMeta('lastSyncError', errText(e));
      return false;
    });
  }

  // Прочитать облачный конфиг, если он новее локального. -> {state, generation} | null
  function pullConfigIfNewer(state, store) {
    if (!isOn(state)) return Promise.resolve(null);
    return readCloud(conf(state), 'backup/data.json').then(function (res) {
      var cloud = res.data;
      if (!cloud || cloud.kind !== 'meds-backup' || !cloud.state) return null;
      var cloudGen = (typeof cloud.generation === 'number') ? cloud.generation : 0;
      var localGen = store.getMeta('backupGeneration') || 0;
      if (cloudGen > localGen) return { state: cloud.state, generation: cloudGen };
      return null;
    }).catch(function (e) { store.setMeta('lastSyncError', errText(e)); return null; });
  }

  // Явное восстановление (кнопка в настройках). -> {state, generation}
  function fetchConfig(state) {
    return readCloud(conf(state), 'backup/data.json').then(function (res) {
      var cloud = res.data;
      if (!cloud) throw new Error('Резервной копии в архиве ещё нет.');
      if (cloud.kind !== 'meds-backup' || !cloud.state) throw new Error('Файл резервной копии повреждён.');
      return { state: cloud.state, generation: (typeof cloud.generation === 'number') ? cloud.generation : 0 };
    });
  }

  /* ======================= B. ЖИВОЙ СТАТУС ======================= */

  // Один файл на «живой» статус: сегодняшние приёмы (slots, привязаны к date)
  // и недельная таблетница (box, постоянная, не привязана к дню).
  function statusPath() { return 'status/live.json'; }

  // Слияние двух карт {key:{...,ts}} — берём запись с бóльшим ts (last-write-wins).
  function mergeByTs(a, b) {
    var out = {}, k;
    a = a || {}; b = b || {};
    for (k in a) if (Object.prototype.hasOwnProperty.call(a, k)) out[k] = a[k];
    for (k in b) if (Object.prototype.hasOwnProperty.call(b, k)) {
      if (!out[k] || (b[k].ts || 0) >= (out[k].ts || 0)) out[k] = b[k];
    }
    return out;
  }
  function mergeStatus(a, b) {
    a = a || {}; b = b || {};
    var da = a.date || '', db = b.date || '';
    var date = da > db ? da : db;
    var slots;
    if (da === db) slots = mergeByTs(a.slots, b.slots);
    else slots = (date === da) ? (a.slots || {}) : (b.slots || {}); // новый день → слоты актуальной даты
    return { date: date, slots: slots, box: mergeByTs(a.box, b.box), ts: Math.max(a.ts || 0, b.ts || 0) };
  }

  // Двусторонняя синхронизация «живого» статуса в один заход (для опроса по таймеру):
  // читаем облако, сливаем с локальным; если у нас есть более свежее — дописываем (CAS).
  // -> { merged, pulledNew, error }
  //    pulledNew=true → в облаке были записи новее локальных, нужно применить merged.
  function syncStatus(state, store, localStatus, _tries) {
    if (!isOn(state)) return Promise.resolve({ merged: localStatus, pulledNew: false });
    var c = conf(state);
    _tries = _tries || 0;
    return readCloud(c, statusPath()).then(function (res) {
      var cloud = res.data;
      var merged = mergeStatus(cloud, localStatus);
      var pulledNew = stable(merged) !== stable(localStatus);   // облако дало новое
      var changedCloud = stable(merged) !== stable(cloud || {}); // нам есть что дописать
      if (!changedCloud) {
        store.setMeta('lastSyncError', null);
        return { merged: merged, pulledNew: pulledNew };
      }
      return putFile(c, statusPath(), JSON.stringify(merged, null, 1),
        'live ' + (localStatus.date || ''), res.sha).then(function () {
          store.setMeta('lastSyncError', null);
          return { merged: merged, pulledNew: pulledNew };
        });
    }).catch(function (e) {
      if (errText(e) === 'CONFLICT' && _tries < 3) {        // гонка — перечитать и повторить
        return syncStatus(state, store, localStatus, _tries + 1);
      }
      store.setMeta('lastSyncError', errText(e));
      return { merged: localStatus, pulledNew: false, error: errText(e) };
    });
  }

  /* ======================= C. ВЕЧНЫЙ ЖУРНАЛ СОБЫТИЙ ======================= */
  // По одному файлу на день, log/<iso>.json = массив событий. Никогда не
  // перезаписывается затиранием: слияние — объединение по уникальному id (union),
  // поэтому события всех устройств складываются без потерь.
  function logPath(iso) { return 'log/' + iso + '.json'; }

  function mergeLog(a, b) {
    var seen = {}, out = [];
    (a || []).concat(b || []).forEach(function (e) {
      if (e && e.id && !seen[e.id]) { seen[e.id] = 1; out.push(e); }
    });
    out.sort(function (x, y) { return (x.ts || 0) - (y.ts || 0); });
    return out;
  }

  // Слить локальные события за день с облачными и дописать (CAS, повтор при гонке).
  // -> { merged, changed }   merged — полный набор за день (свои + чужие).
  function syncLog(state, store, iso, localEvents, _tries) {
    if (!isOn(state)) return Promise.resolve({ merged: localEvents || [], changed: false });
    var c = conf(state); _tries = _tries || 0;
    return readCloud(c, logPath(iso)).then(function (res) {
      var cloud = res.data || [];
      var merged = mergeLog(cloud, localEvents);
      if (stable(merged) === stable(cloud)) {
        store.setMeta('lastSyncError', null);
        return { merged: merged, changed: false };
      }
      return putFile(c, logPath(iso), JSON.stringify(merged, null, 1), 'log ' + iso, res.sha).then(function () {
        store.setMeta('lastSyncError', null);
        return { merged: merged, changed: true };
      });
    }).catch(function (e) {
      if (errText(e) === 'CONFLICT' && _tries < 3) return syncLog(state, store, iso, localEvents, _tries + 1);
      store.setMeta('lastSyncError', errText(e));
      return { merged: localEvents || [], changed: false, error: errText(e) };
    });
  }

  // Список дат, по которым есть журнал (имена файлов log/<iso>.json без расширения).
  function listLogDates(state) {
    if (!isOn(state)) return Promise.resolve([]);
    var c = conf(state);
    return fetch('https://api.github.com/repos/' + c.repo + '/contents/log', { headers: headers(c) })
      .then(function (r) {
        if (r.status === 404) return [];
        if (!r.ok) throw new Error('GitHub ' + r.status);
        return r.json();
      }).then(function (arr) {
        return (arr || []).filter(function (x) { return x.type === 'file' && /\.json$/.test(x.name); })
          .map(function (x) { return x.name.replace(/\.json$/, ''); }).sort();
      });
  }

  function fetchLog(state, iso) {
    return readCloud(conf(state), logPath(iso)).then(function (res) { return res.data || []; });
  }

  function errText(e) {
    var s = String((e && e.message) || e);
    if (s.indexOf('Failed to fetch') >= 0) return 'нет сети';
    return s;
  }

  return {
    isOn: isOn,
    stable: stable,
    configHash: configHash,
    backupConfigIfChanged: backupConfigIfChanged,
    pullConfigIfNewer: pullConfigIfNewer,
    fetchConfig: fetchConfig,
    mergeStatus: mergeStatus,
    syncStatus: syncStatus,
    mergeLog: mergeLog,
    syncLog: syncLog,
    listLogDates: listLogDates,
    fetchLog: fetchLog
  };
})();
