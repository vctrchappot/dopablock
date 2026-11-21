// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.js',
  timeout: 60000,
  expect: { timeout: 8000 },
  workers: 1, // one browser with the extension loaded at a time
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
});
