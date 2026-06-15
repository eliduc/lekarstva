# E2E (Playwright) — КАО подкоманда 1.1

UI/UX end-to-end тесты для PWA «lekarstva». DOM-зависимый `app.js` тестируется в реальном Chromium.

## Запуск

```bash
cd e2e
npm i                       # @playwright/test
npx playwright install chromium
npx playwright test         # поднимет python -m http.server :8200 сам (webServer в конфиге)
```

`playwright.config.js` автоматически стартует статический сервер из КОРНЯ проекта
(`python -m http.server 8200 --bind 127.0.0.1`) и закрывает его после прогона.

## Покрытие (tests/)

| Файл | Флоу |
|------|------|
| `01-home.spec.js` | Главная: 3 строки 08:00/14:00/20:00 + счётчики лекарств |
| `02-give-wizard.spec.js` | Мастер выдачи 08:00: группа ТАБЛЕТКИ, крупное красное предупреждение esomeprazole (.gbig, 18px, rgb(180,34,34)), порядок лекарств |
| `03-mark-and-undo.spec.js` | Отметка «выдано» + отмена (undoGiven) |
| `04-settings-gate.spec.js` | Шлюз настроек (пароль 1234 → tryUnlock) + экран История (openHistory) |
| `05-lang-rtl.spec.js` | Смена языка he → `document.documentElement.dir==="rtl"` |
| `06-stage.spec.js` | Stage-режим `?env=stage`: оранжевая шапка rgb(154,52,18), «STAGE» в заголовке, `tgConfigured()===false` даже при заданном токене |
| `07-photos.spec.js` | Фото лекарств грузятся (`img.naturalWidth>0`) |
| `08-xss.spec.js` | XSS из облака: payload в id/name/qty/caregiver не исполняется, кнопки работают (КАО#1) |
| `09-xss-warnlevel.spec.js` | XSS через warnLevel/state.times(value)/m.type(tyLabel) (КАО#2) |
| `10-xss-medimg.spec.js` | XSS через `m.img` data:-URL с кавычкой не вырывается из `src` (КАО#3) |
| `11-xss-times-onclick.spec.js` | XSS через `state.times` в `onclick="pickMedFor('…')"` (Настройки) — вырыв из JS-строки (КАО#4) |
| `12-xss-home-next.spec.js` | XSS через `state.times` в «следующий приём» на главной (`${next}`) (КАО#4) |

## Fresh-контекст

`helpers.openFresh(page, query)` чистит localStorage ДО загрузки `app.js` (reload),
чтобы `loadState()` взял `defaultState()`.

Глобальные функции (`startGive`, `tryUnlock`, `setLang`, `openHistory`) доступны через
`page.evaluate(() => fn())` — приложение грузится обычными `<script>`'ами (не модуль),
поэтому top-level `function` попадают в `window`. Top-level `const` (`state`, `STAGE`,
`doneCache`) НЕ на `window` — внутри `evaluate` к ним обращаемся по «голому» имени.
