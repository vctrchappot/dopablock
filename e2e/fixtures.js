// Playwright fixtures: a Chromium with the unpacked extension loaded.
// Real hostnames (www.tiktok.com, www.youtube.com, ...) are served fake HTML via request interception,
// so the real presets run against controlled pages without touching the network.
const path = require('node:path');
const base = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
require(path.join(ROOT, 'src/lib/presets.js'));
const DB = require(path.join(ROOT, 'src/lib/engine.js'));

const test = base.test.extend({
  context: async ({}, use) => {
    const context = await base.chromium.launchPersistentContext('', {
      channel: 'chromium', // new headless supports extensions
      headless: true,
      locale: 'en-US',
      args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
    });
    // never touch the real network: every page gets controlled HTML
    await context.route(/^https?:\/\/(?!127\.0\.0\.1).*/, (route) => {
      const url = new URL(route.request().url());
      if (route.request().resourceType() !== 'document') return route.fulfill({ status: 204, body: '' });
      return route.fulfill({ contentType: 'text/html', body: fakePage(url) });
    });
    await use(context);
    await context.close();
  },

  worker: async ({ context }, use) => {
    let [sw] = context.serviceWorkers();
    if (!sw) sw = await context.waitForEvent('serviceworker');
    await use(sw);
  },

  extId: async ({ worker }, use) => {
    await use(new URL(worker.url()).host);
  },
});

function fakePage(url) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>fake ${url.host}${url.pathname}</title>
<style>body{margin:0;font:16px sans-serif;background:#111;color:#fff}.g{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:20px}
.c{height:160px;border-radius:16px;background:linear-gradient(160deg,#ff5f6d,#ffc371)}.c:nth-child(2n){background:linear-gradient(160deg,#4facfe,#00f2fe)}</style></head>
<body><h1 id="title">Fake ${url.host}${url.pathname}</h1>
<div id="related">Suggested videos</div><div id="comments">Comments</div>
<div class="g">${'<div class="c"></div>'.repeat(6)}</div></body></html>`;
}

/** Write config/usage straight into extension storage via the service worker. */
async function seed(worker, { presets = {}, custom = [], settings = {}, usage = {}, snoozes = {} } = {}) {
  const config = { presets, custom, settings: Object.assign({ friction: 1, snoozeMinutes: 5 }, settings), rev: Date.now() };
  await worker.evaluate(async (data) => {
    await chrome.storage.local.clear();
    await chrome.storage.local.set(data);
  }, { config, usage, snoozes });
}

const todayKey = () => DB.dayKey(new Date());

function usageDay(rules, total) {
  const hours = new Array(24).fill(0);
  hours[new Date().getHours()] = total;
  return { [todayKey()]: { rules, hours, total, blocks: 0 } };
}

const host = (page) => page.locator('#dopablock-host');

module.exports = { test, expect: base.expect, seed, usageDay, todayKey, host, DB };
