/* Dopablock – service worker: usage bookkeeping, overrides, tab actions, toolbar badge. */
importScripts('lib/presets.js', 'lib/i18n.js', 'lib/engine.js');

const DB = self.DopaBlock;
const KEEP_DAYS = 120;

/* All read-modify-write operations on storage run through one queue so that
 * messages from many tabs can never overwrite each other. */
let queue = Promise.resolve();
function enqueue(fn) {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function addUsage(ids, seconds) {
  seconds = Math.max(0, Math.min(60, Number(seconds) || 0));
  if (!seconds || !Array.isArray(ids)) return;
  const now = new Date();
  const { usage = {} } = await chrome.storage.local.get('usage');
  const key = DB.dayKey(now);
  const day = usage[key] || DB.emptyDay();
  day.rules = day.rules || {};
  day.hours = Array.isArray(day.hours) && day.hours.length === 24 ? day.hours : new Array(24).fill(0);
  for (const id of ids) day.rules[id] = (day.rules[id] || 0) + seconds;
  day.total = (day.total || 0) + seconds;
  day.hours[now.getHours()] += seconds;
  usage[key] = day;

  const cutoff = DB.dayKey(new Date(Date.now() - KEEP_DAYS * 86400000));
  for (const k of Object.keys(usage)) if (k < cutoff) delete usage[k];
  await chrome.storage.local.set({ usage });
}

async function addBlock() {
  const { usage = {} } = await chrome.storage.local.get('usage');
  const key = DB.dayKey(new Date());
  const day = usage[key] || DB.emptyDay();
  day.blocks = (day.blocks || 0) + 1;
  usage[key] = day;
  await chrome.storage.local.set({ usage });
}

async function snooze(ids, minutes) {
  const { snoozes = {} } = await chrome.storage.local.get('snoozes');
  const until = Date.now() + Math.max(1, Math.min(240, Number(minutes) || 5)) * 60000;
  for (const id of ids) snoozes[id] = until;
  for (const id of Object.keys(snoozes)) if (snoozes[id] < Date.now()) delete snoozes[id]; // tidy up
  await chrome.storage.local.set({ snoozes });
}

/* PIN checks for content scripts (http pages have no crypto.subtle). Slow down guessing. */
const pinFails = { n: 0, since: 0, lockedUntil: 0 };
async function checkPin(pin) {
  const now = Date.now();
  if (now < pinFails.lockedUntil) return false;
  const all = await DB.loadAll();
  const ok = await DB.verifyPin(all.config.settings, pin);
  if (ok) {
    pinFails.n = 0;
    return true;
  }
  if (now - pinFails.since > 60000) {
    pinFails.n = 0;
    pinFails.since = now;
  }
  if (++pinFails.n >= 5) pinFails.lockedUntil = now + 30000;
  return false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'usage':
      enqueue(() => addUsage(msg.ids, msg.seconds));
      break;
    case 'blocked':
      enqueue(addBlock);
      break;
    case 'snooze':
      enqueue(() => snooze(Array.isArray(msg.ids) ? msg.ids : [], msg.minutes));
      break;
    case 'verifyPin':
      checkPin(String(msg.pin || '')).then((ok) => sendResponse({ ok }), () => sendResponse({ ok: false }));
      return true; // async response
    case 'close':
      if (sender.tab && sender.tab.id != null) chrome.tabs.remove(sender.tab.id).catch(() => {});
      break;
  }
});

/* ───────────── toolbar badge ───────────── */

async function updateBadge() {
  const all = await DB.loadAll();
  const paused = all.config.settings.pausedUntil > Date.now();
  const total = ((all.usage[DB.dayKey(new Date())] || {}).total) || 0;
  const focus = all.config.settings.focusUntil > Date.now();
  let text = '';
  if (focus) text = 'F';
  else if (paused) text = 'II';
  else if (total >= 3600) text = (total / 3600).toFixed(1) + 'h';
  else if (total >= 60) text = Math.floor(total / 60) + 'm';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: focus ? '#7c3aed' : paused ? '#f59e0b' : '#1a1a1a' });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#ffffff' });
}

let badgeTimer = null;
function scheduleBadge() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => updateBadge().catch(() => {}), 400);
}

/* ───────────── optional sync (rules + settings only; usage stays local) ───────────── */

const SYNC_KEYS = ['dopa_presets', 'dopa_custom', 'dopa_settings', 'dopa_rev'];
const LOCAL_ONLY_SETTINGS = ['pausedUntil', 'focusUntil'];

async function pushSync() {
  const { syncEnabled } = await chrome.storage.local.get('syncEnabled');
  if (!syncEnabled) return;
  const all = await DB.loadAll();
  const settings = Object.assign({}, all.config.settings);
  for (const k of LOCAL_ONLY_SETTINGS) delete settings[k];
  try {
    await chrome.storage.sync.set({ dopa_presets: all.config.presets, dopa_custom: all.config.custom, dopa_settings: settings, dopa_rev: all.config.rev || 0 });
    await chrome.storage.local.remove('syncError');
  } catch (e) {
    await chrome.storage.local.set({ syncError: String((e && e.message) || e) });
  }
}

async function pullSync() {
  const { syncEnabled } = await chrome.storage.local.get('syncEnabled');
  if (!syncEnabled) return false;
  const remote = await chrome.storage.sync.get(SYNC_KEYS);
  if (!remote.dopa_rev) return false;
  const all = await DB.loadAll();
  if (remote.dopa_rev <= (all.config.rev || 0)) return false;
  const keep = {};
  for (const k of LOCAL_ONLY_SETTINGS) keep[k] = all.config.settings[k];
  const config = {
    presets: remote.dopa_presets || {},
    custom: remote.dopa_custom || [],
    settings: Object.assign({}, DB.DEFAULT_SETTINGS, remote.dopa_settings || {}, keep),
    rev: remote.dopa_rev,
  };
  await chrome.storage.local.set({ config });
  return true;
}

async function syncNow() {
  try {
    if (!(await pullSync())) await pushSync();
  } catch (_) {}
}

let syncTimer = null;
const scheduleSync = () => {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => enqueue(syncNow), 1500);
};

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    if (changes.usage || changes.config) scheduleBadge();
    if (changes.config || changes.syncEnabled) scheduleSync();
  } else if (area === 'sync') {
    scheduleSync();
  }
});

function setup() {
  chrome.alarms.create('badge', { periodInMinutes: 1 });
  updateBadge().catch(() => {});
  scheduleSync();
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'badge') updateBadge().catch(() => {});
});

chrome.runtime.onInstalled.addListener((details) => {
  setup();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(setup);
