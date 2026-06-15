// КАО#1 — конфиг Playwright для PWA «lekarstva».
// Сервер: статика проекта через python -m http.server на 127.0.0.1:8200.
// baseURL указывает на корень проекта; спеки ходят на '/?...'.
// @ts-check
const { defineConfig, devices } = require('@playwright/test');
const path = require('node:path');

const PORT = 8200;
const ROOT = path.resolve(__dirname, '..'); // каталог проекта (где index.html)

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: false, // один общий http-сервер; флоу независимы, но порядок логов читабельнее
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    actionTimeout: 7000,
    navigationTimeout: 10000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // Поднимаем статический сервер из КОРНЯ проекта (на уровень выше e2e/).
  webServer: {
    command: `python -m http.server ${PORT} --bind 127.0.0.1`,
    cwd: ROOT,
    url: `http://127.0.0.1:${PORT}/index.html`,
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
