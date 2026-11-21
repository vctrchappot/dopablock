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

chrome.runtime.onMessage.addListener((msg, sender) => {
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
  let text = '';
  if (paused) text = 'II';
  else if (total >= 3600) text = (total / 3600).toFixed(1) + 'h';
  else if (total >= 60) text = Math.floor(total / 60) + 'm';
  await chrome.action.setBadgeText({ text });
  await chrome.action.setBadgeBackgroundColor({ color: paused ? '#f59e0b' : '#1a1a1a' });
  if (chrome.action.setBadgeTextColor) await chrome.action.setBadgeTextColor({ color: '#ffffff' });
}

let badgeTimer = null;
function scheduleBadge() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(() => updateBadge().catch(() => {}), 400);
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && (changes.usage || changes.config)) scheduleBadge();
});

function setup() {
  chrome.alarms.create('badge', { periodInMinutes: 1 });
  updateBadge().catch(() => {});
}

chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === 'badge') updateBadge().catch(() => {});
});

chrome.runtime.onInstalled.addListener((details) => {
  setup();
  if (details.reason === 'install') chrome.runtime.openOptionsPage();
});
chrome.runtime.onStartup.addListener(setup);
