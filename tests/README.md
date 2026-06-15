# tests/ — node-раннер чистой логики (KAO#1.2)

Без внешних зависимостей. Используют встроенные `node:test` + `node:assert` и `node:vm`
для загрузки DOM-free модулей приложения (`js/i18n.js`, `js/data.js`, `js/sync.js`,
`js/storage.js`).

## Запуск

```sh
node --test tests/
```

или одним файлом:

```sh
node --test tests/i18n.test.js
node --test tests/data.test.js
node --test tests/sync.test.js
node --test tests/storage.test.js
```

## Что покрыто

- **i18n.test.js** — `ruPl`, `fmtMeds`, `fmtDur`, `locQty`, `t`/`tf` (подстановка),
  наличие/симметрия ключей во всех 4 языках (ru/en/he/uz), длины `days_*`, `LANG_META`.
- **data.test.js** — `defaultState` (3 времени, 9 лекарств, расписание 8/1/4,
  `amiodacore.excludeDays=[2,5]`, `esomeprazole.warnLevel=red`+`warnBig`), `medImg`
  (data:/IMG_SRC/null), `hash` (детерминизм, FNV-1a), `esc` (`&<>"'`).
- **sync.test.js** — `mergeByTs`, `mergeStatus`, `mergeLog`, `stable`, `configHash`,
  `cleanState` (стрип `sync.token` / `aiKey` / `deviceName`).
- **storage.test.js** — префикс ключей `stage:` (по pathname и `?env=stage`),
  изоляция prod/stage, `getMeta`/`setMeta`, fallback при недоступном localStorage.

`load.js` — общий загрузчик. `i18n`+`data`+`sync` грузятся в ОДИН vm-контекст
(делят лексический global scope, как `<script>` в браузере); `storage` — отдельно,
чтобы подменять `location` для stage-режима.
