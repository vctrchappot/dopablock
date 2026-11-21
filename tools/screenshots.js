// Renders store screenshots from the real extension:  npm run screenshots
// Output: store/screenshots/*.png (1280x800 pages, popup at 2x)
const path = require('node:path');
const fs = require('node:fs');
const { chromium } = require('@playwright/test');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'store', 'screenshots');
require(path.join(ROOT, 'src/lib/presets.js'));
const DB = require(path.join(ROOT, 'src/lib/engine.js'));

function fakeFeed(url) {
  const cards = Array.from({ length: 8 }, (_, i) => `<div class="c c${i % 4}"><span>@creator${i + 1}</span></div>`).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><title>${url.host}</title><style>
  body{margin:0;font:600 16px system-ui,sans-serif;background:#0d0d0f;color:#fff}
  header{display:flex;gap:18px;align-items:center;padding:18px 28px;border-bottom:1px solid #222}
  .g{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:24px 28px}
  .c{height:300px;border-radius:20px;display:flex;align-items:flex-end;padding:16px}
  .c0{background:linear-gradient(160deg,#ff5f6d,#ffc371)}.c1{background:linear-gradient(160deg,#4facfe,#00f2fe)}
  .c2{background:linear-gradient(160deg,#a18cd1,#fbc2eb)}.c3{background:linear-gradient(160deg,#43e97b,#38f9d7)}
  </style></head><body><header><b>${url.host}</b><span>For You</span><span>Following</span><span>Explore</span></header><div class="g">${cards}</div></body></html>`;
}

function demoData() {
  const usage = {};
  const totals = [3100, 5400, 2200, 7800, 4100, 1500, 3650];
  totals.forEach((total, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const hours = new Array(24).fill(0);
    [8, 12, 13, 17, 20, 21, 22].forEach((h, n) => (hours[h] = Math.round((total / 7) * (0.5 + ((n * 37) % 10) / 8))));
    const sum = hours.reduce((a, b) => a + b, 0);
    usage[DB.dayKey(d)] = { rules: {}, hours, total: sum, blocks: i === 6 ? 4 : 1 };
  });
  usage[DB.dayKey(new Date())].rules = { 'youtube:shorts': 14 * 60, 'x:all': 21 * 60, 'tiktok:videos': 9 * 60 };
  return usage;
}

function demoConfig(theme) {
  return {
    presets: {
      'tiktok:fyp': { mode: 'block' },
      'instagram:reels': { mode: 'block', schedule: { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' } },
      'youtube:shorts': { mode: 'limit', limitMin: 15 },
      'youtube:recs': { mode: 'block' },
      'x:all': { mode: 'track' },
      'tiktok:videos': { mode: 'limit', limitMin: 10 },
    },
    custom: [{ id: 'c1', name: 'News sites', hosts: ['news.example.com'], paths: ['/*'], exclude: ['/weather/*'], hide: [], mode: 'limit', limitMin: 20, schedule: null }],
    settings: { theme, language: 'en', friction: 10, snoozeMinutes: 5, dailyGoalMin: 90 },
    rev: Date.now(),
  };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    headless: true,
    locale: 'en-US',
    deviceScaleFactor: 2,
    viewport: { width: 1280, height: 800 },
    args: [`--disable-extensions-except=${ROOT}`, `--load-extension=${ROOT}`],
  });
  await context.route(/^https?:\/\/.*/, (route) => {
    if (route.request().resourceType() !== 'document') return route.fulfill({ status: 204, body: '' });
    return route.fulfill({ contentType: 'text/html', body: fakeFeed(new URL(route.request().url())) });
  });
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  const ext = new URL(sw.url()).host;

  for (const theme of ['light', 'dark']) {
    await sw.evaluate(async (data) => {
      await chrome.storage.local.clear();
      await chrome.storage.local.set(data);
    }, { config: demoConfig(theme), usage: demoData(), snoozes: {} });

    const popup = await context.newPage();
    await popup.setViewportSize({ width: 392, height: 760 });
    await popup.goto(`chrome-extension://${ext}/src/popup/popup.html`);
    await popup.waitForTimeout(500);
    await popup.screenshot({ path: path.join(OUT, `popup-${theme}.png`), fullPage: true });

    const options = await context.newPage();
    for (const view of ['overview', 'rules', 'settings']) {
      await options.goto(`chrome-extension://${ext}/src/options/options.html#${view}`);
      await options.reload();
      await options.waitForTimeout(500);
      await options.screenshot({ path: path.join(OUT, `options-${view}-${theme}.png`) });
    }

    const feed = await context.newPage();
    await feed.goto('https://www.tiktok.com/');
    await feed.locator('#dopablock-host').waitFor({ state: 'attached' });
    await feed.waitForTimeout(600);
    await feed.screenshot({ path: path.join(OUT, `blocked-${theme}.png`) });
    await Promise.all([popup.close(), feed.close()]);
  }

  await context.close();
  console.log(fs.readdirSync(OUT).map((f) => 'store/screenshots/' + f).join('\n'));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
