const { test, expect, seed, host } = require('./fixtures');

// Measures whether the page can paint before the block overlay exists.
// "exposure" = how long unblocked content was on screen (first-contentful-paint -> overlay attached).
test('block overlay appears before the first paint (no visible flash)', async ({ context, worker }) => {
  await seed(worker, { presets: { 'tiktok:fyp': { mode: 'block' } } });
  const results = [];
  for (let i = 0; i < 5; i++) {
    const page = await context.newPage();
    await page.addInitScript(() => {
      window.__t = { host: null };
      const mo = new MutationObserver(() => {
        if (!window.__t.host && document.getElementById('dopablock-host')) {
          window.__t.host = performance.now();
          mo.disconnect();
        }
      });
      mo.observe(document, { childList: true, subtree: true });
    });
    await page.goto('https://www.tiktok.com/');
    await expect(host(page)).toBeAttached();
    await page.waitForTimeout(300);
    const m = await page.evaluate(() => {
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      return { host: window.__t.host, fcp: fcp ? fcp.startTime : null };
    });
    results.push(m);
    await page.close();
  }
  console.log('flicker measurements (ms):', JSON.stringify(results));
  for (const m of results) {
    expect(m.host).not.toBeNull();
    // overlay must exist no later than the first paint of page content
    if (m.fcp !== null) expect(m.host).toBeLessThanOrEqual(m.fcp + 1);
  }
});
