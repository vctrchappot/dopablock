const { test, expect, seed, usageDay, host, DB } = require('./fixtures');

const TIKTOK = 'https://www.tiktok.com';
const YT = 'https://www.youtube.com';

async function open(context, url) {
  const page = await context.newPage();
  await page.goto(url);
  return page;
}

test('extension loads: service worker, options and popup render', async ({ context, extId, worker }) => {
  expect(extId).toMatch(/^[a-p]{32}$/);
  await seed(worker, { presets: { 'youtube:shorts': { mode: 'limit', limitMin: 15 }, 'tiktok:fyp': { mode: 'block' } } });

  const errors = [];
  const options = await context.newPage();
  options.on('pageerror', (e) => errors.push(e.message));
  await options.goto(`chrome-extension://${extId}/src/options/options.html#rules`);
  await expect(options.getByRole('heading', { name: 'Rules' })).toBeVisible();
  await expect(options.getByText('For You (FYP)')).toBeVisible();
  await expect(options.getByText('Entire Discord')).toBeVisible();

  const popup = await context.newPage();
  popup.on('pageerror', (e) => errors.push(e.message));
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
  await expect(popup.getByText('Active rules')).toBeVisible();
  await expect(popup.getByText('Tracked screen time')).toBeVisible();
  expect(errors).toEqual([]);
});

test('TikTok FYP is blocked, profiles and search are not', async ({ context, worker }) => {
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'block' } } });

  const fyp = await open(context, TIKTOK + '/');
  await expect(host(fyp)).toBeAttached();
  await expect(fyp.getByText('TikTok For You (FYP) is closed')).toBeVisible();
  // blurred mode: page stays visible but frozen
  expect(await fyp.evaluate(() => document.body.inert)).toBe(true);
  expect(await fyp.evaluate(() => getComputedStyle(document.body).display)).not.toBe('none');

  const profile = await open(context, TIKTOK + '/@someone');
  await profile.waitForTimeout(800);
  await expect(host(profile)).toHaveCount(0);
  const search = await open(context, TIKTOK + '/search?q=cats');
  await search.waitForTimeout(500);
  await expect(host(search)).toHaveCount(0);
});

test('single-page navigation into a blocked section is caught', async ({ context, worker }) => {
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'block' } } });
  const page = await open(context, TIKTOK + '/@someone');
  await page.waitForTimeout(500);
  await expect(host(page)).toHaveCount(0);

  await page.evaluate(() => history.pushState({}, '', '/'));
  await expect(host(page)).toBeAttached();

  await page.evaluate(() => history.pushState({}, '', '/@someone'));
  await expect(host(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.body.inert)).toBe(false);
});

test('Instagram Reels blocked, normal posts allowed', async ({ context, worker }) => {
  await seed(worker, { presets: { 'instagram:reels': { mode: 'block' } } });
  await expect(host(await open(context, 'https://www.instagram.com/reels/abc/'))).toBeAttached();
  const post = await open(context, 'https://www.instagram.com/p/xyz/');
  await post.waitForTimeout(600);
  await expect(host(post)).toHaveCount(0);
});

test('YouTube: Shorts blocked, suggested videos hidden on watch pages', async ({ context, worker }) => {
  await seed(worker, { presets: { 'youtube:shorts': { mode: 'block' }, 'youtube:recs': { mode: 'block' } } });
  await expect(host(await open(context, YT + '/shorts/abc'))).toBeAttached();

  const watch = await open(context, YT + '/watch?v=1');
  await expect(watch.locator('#related')).toBeHidden();
  await expect(watch.locator('#comments')).toBeVisible();
  await expect(host(watch)).toHaveCount(0);
});

test('daily limit: time is counted, then the section closes and the block is recorded', async ({ context, worker }) => {
  await seed(worker, {
    presets: { 'youtube:shorts': { mode: 'limit', limitMin: 1 } },
    usage: usageDay({ 'youtube:shorts': 57 }, 57),
  });
  const page = await open(context, YT + '/shorts/abc');
  await expect(host(page)).toBeAttached({ timeout: 15000 });
  await expect(page.getByText('Daily limit reached')).toBeVisible();

  // the seconds that tipped us over the limit are persisted, so a new tab sees the limit as reached too
  await expect
    .poll(async () => worker.evaluate(async (key) => (((await chrome.storage.local.get('usage')).usage[key] || {}).rules || {})['youtube:shorts'], DB.dayKey(new Date())))
    .toBeGreaterThanOrEqual(60 - 1);
  const fresh = await open(context, YT + '/shorts/other');
  await expect(host(fresh)).toBeAttached();
  await expect.poll(async () => worker.evaluate(async (key) => ((await chrome.storage.local.get('usage')).usage[key] || {}).blocks, DB.dayKey(new Date()))).toBeGreaterThanOrEqual(1);
});

test('track mode counts time and never blocks', async ({ context, worker }) => {
  await seed(worker, { presets: { 'youtube:shorts': { mode: 'track' } } });
  const page = await open(context, YT + '/shorts/abc');
  await page.waitForTimeout(7000);
  await expect(host(page)).toHaveCount(0);
  const seconds = await worker.evaluate(async (key) => ((await chrome.storage.local.get('usage')).usage?.[key]?.rules || {})['youtube:shorts'] || 0, DB.dayKey(new Date()));
  expect(seconds).toBeGreaterThan(3);
  expect(seconds).toBeLessThan(10);
});

test('two visible tabs of the same section do not double count', async ({ context, worker }) => {
  await seed(worker, { presets: { 'youtube:shorts': { mode: 'track' } } });
  const a = await open(context, YT + '/shorts/a');
  const b = await open(context, YT + '/shorts/b');
  await Promise.all([a.bringToFront(), b.bringToFront()]);
  await b.waitForTimeout(9000);
  const seconds = await worker.evaluate(async (key) => ((await chrome.storage.local.get('usage')).usage?.[key]?.rules || {})['youtube:shorts'] || 0, DB.dayKey(new Date()));
  // one tab ≈ 9 s of wall time; two tabs counting would give ≈ 18 s
  expect(seconds).toBeLessThan(14);
});

test('override: breathe, confirm, section opens for a while', async ({ context, worker }) => {
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'block' } }, settings: { friction: 1 } });
  const page = await open(context, TIKTOK + '/');
  await expect(host(page)).toBeAttached();
  await page.getByRole('button', { name: 'Take 5 more minutes' }).click();
  await expect(page.getByRole('button', { name: /Breathe/ })).toBeVisible();
  const confirm = page.getByRole('button', { name: 'Unlock for 5 min' });
  await expect(confirm).toBeVisible({ timeout: 5000 });
  await confirm.click();
  await expect(host(page)).toHaveCount(0);
  const snoozes = await worker.evaluate(async () => (await chrome.storage.local.get('snoozes')).snoozes);
  expect(snoozes['tiktok:fyp']).toBeGreaterThan(Date.now());
});

test('strict mode: no override button', async ({ context, worker }) => {
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'block' } }, settings: { strict: true } });
  const page = await open(context, TIKTOK + '/');
  await expect(host(page)).toBeAttached();
  await expect(page.getByText('Strict mode is on')).toBeVisible();
  await expect(page.getByRole('button', { name: /more minutes/ })).toHaveCount(0);
});

test('PIN: override needs the right PIN', async ({ context, worker }) => {
  const settings = { friction: 0 };
  await DB.setPin(settings, '4711');
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'block' } }, settings });
  const page = await open(context, TIKTOK + '/');
  await expect(host(page)).toBeAttached();
  await page.getByRole('button', { name: 'Take 5 more minutes' }).click();
  const input = page.getByPlaceholder('Enter PIN');
  await expect(input).toBeVisible();
  await input.fill('0000');
  await page.getByRole('button', { name: 'Unlock for 5 min' }).click();
  await expect(page.getByText('Wrong PIN')).toBeVisible();
  await expect(host(page)).toBeAttached();
  await page.getByPlaceholder('Enter PIN').fill('4711');
  await page.getByRole('button', { name: 'Unlock for 5 min' }).click();
  await expect(host(page)).toHaveCount(0);
});

test('focus session blocks everything that is on, without overrides', async ({ context, worker }) => {
  await seed(worker, { presets: { 'youtube:shorts': { mode: 'track' } }, settings: { focusUntil: Date.now() + 10 * 60000 } });
  const page = await open(context, YT + '/shorts/abc');
  await expect(host(page)).toBeAttached();
  await expect(page.getByText('Focus mode is on')).toBeVisible();
  await expect(page.getByText('No overrides during a focus session.')).toBeVisible();
  await expect(page.getByRole('button', { name: /more minutes/ })).toHaveCount(0);
});

test('schedule: outside the window the rule is relaxed', async ({ context, worker }) => {
  const now = new Date();
  const other = (now.getDay() + 3) % 7; // a day that is not today
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'block', schedule: { days: [other], start: '00:00', end: '24:00' } } } });
  const page = await open(context, TIKTOK + '/');
  await page.waitForTimeout(800);
  await expect(host(page)).toHaveCount(0);
});

test('custom rule created in storage blocks its site and honours exceptions', async ({ context, worker }) => {
  await seed(worker, {
    custom: [{ id: 'c1', name: 'News', hosts: ['news.example.test'], paths: ['/*'], exclude: ['/weather/*'], hide: [], mode: 'block', limitMin: 30, schedule: null }],
  });
  await expect(host(await open(context, 'https://news.example.test/politics'))).toBeAttached();
  const w = await open(context, 'https://news.example.test/weather/today');
  await w.waitForTimeout(600);
  await expect(host(w)).toHaveCount(0);
});

test('rule changes apply live without reloading the page', async ({ context, worker }) => {
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'off' } } });
  const page = await open(context, TIKTOK + '/');
  await page.waitForTimeout(500);
  await expect(host(page)).toHaveCount(0);
  await worker.evaluate(async () => {
    const { config } = await chrome.storage.local.get('config');
    config.presets['tiktok:fyp'] = { mode: 'block' };
    await chrome.storage.local.set({ config });
  });
  await expect(host(page)).toBeAttached();
});

test('options PIN lock screen guards the settings', async ({ context, extId, worker }) => {
  const settings = {};
  await DB.setPin(settings, '1234');
  await seed(worker, { settings });
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extId}/src/options/options.html`);
  await expect(options.getByText('Settings are locked')).toBeVisible();
  await options.getByPlaceholder('Enter PIN').fill('9999');
  await options.getByRole('button', { name: 'Unlock' }).click();
  await expect(options.getByText('Wrong PIN')).toBeVisible();
  await options.getByPlaceholder('Enter PIN').fill('1234');
  await options.getByRole('button', { name: 'Unlock' }).click();
  await expect(options.getByRole('heading', { name: 'Overview' })).toBeVisible();
});

test('options: changing a rule mode saves to storage', async ({ context, extId, worker }) => {
  await seed(worker, {});
  const options = await context.newPage();
  await options.goto(`chrome-extension://${extId}/src/options/options.html#rules`);
  const row = options.locator('.orow', { hasText: 'For You (FYP)' });
  await row.getByRole('button', { name: 'Block' }).click();
  await expect.poll(async () => worker.evaluate(async () => (await chrome.storage.local.get('config')).config.presets['tiktok:fyp']?.mode)).toBe('block');
});

test('popup: start a focus session from the menu', async ({ context, extId, worker }) => {
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'block' } } });
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extId}/src/popup/popup.html`);
  await popup.getByRole('button', { name: 'Pause' }).click();
  await popup.getByRole('button', { name: '25 min' }).click();
  await expect.poll(async () => worker.evaluate(async () => (await chrome.storage.local.get('config')).config.settings.focusUntil)).toBeGreaterThan(Date.now() + 20 * 60000);
  await expect(popup.getByRole('button', { name: /Focus · / })).toBeVisible();
  const page = await open(context, TIKTOK + '/');
  await expect(page.getByText('Focus mode is on')).toBeVisible();
});

test('sync mirrors rules and settings (not usage, pause or focus) to storage.sync', async ({ context, worker }) => {
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'block' } }, settings: { focusUntil: Date.now() + 60000, pausedUntil: Date.now() + 60000 } });
  await worker.evaluate(() => chrome.storage.local.set({ syncEnabled: true }));
  await expect
    .poll(async () => worker.evaluate(async () => (await chrome.storage.sync.get('dopa_presets')).dopa_presets), { timeout: 10000 })
    .toEqual({ 'tiktok:fyp': { mode: 'block' } });
  const remoteSettings = await worker.evaluate(async () => (await chrome.storage.sync.get('dopa_settings')).dopa_settings);
  expect(remoteSettings).not.toHaveProperty('focusUntil');
  expect(remoteSettings).not.toHaveProperty('pausedUntil');
  const all = await worker.evaluate(() => chrome.storage.sync.get(null));
  expect(Object.keys(all).some((k) => k.includes('usage'))).toBe(false);
});
