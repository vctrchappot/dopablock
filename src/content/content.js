/*
 * Dopablock – content script.
 * Evaluates the current URL against the user's rules, hides elements, shows the
 * block overlay and counts time spent on tracked sections.
 */
(function () {
  'use strict';
  if (window.top !== window.self) return;
  if (!/^https?:$/.test(location.protocol)) return;

  const DB = globalThis.DopaBlock;
  if (!DB || !DB.evaluate) return;

  const TICK_MS = 500;
  const FLUSH_MS = 5000;
  const BLOCK_STYLE_ID = 'dopablock-block-style';
  const HIDE_STYLE_ID = 'dopablock-hide-style';

  let config = null;
  let usage = {};
  let snoozes = {};
  let rules = [];
  let hasHostRules = false;

  let current = null; // last evaluation
  let lastHref = '';
  let lastTick = 0;
  let sinceFlush = 0;
  let sinceEval = 0;
  let interval = null;
  const pending = {}; // ruleId → seconds not yet sent
  let pendingTotal = 0;

  let overlay = null;
  let overlayKey = '';
  let hideCss = '';
  let observer = null;

  const alive = () => {
    try {
      return !!(chrome.runtime && chrome.runtime.id);
    } catch (_) {
      return false;
    }
  };

  function send(msg) {
    if (!alive()) return shutdown();
    try {
      const p = chrome.runtime.sendMessage(msg);
      if (p && p.catch) p.catch(() => {});
    } catch (_) {
      shutdown();
    }
  }

  /* ───────────── state ───────────── */

  async function load() {
    const d = await chrome.storage.local.get(['config', 'usage', 'snoozes']);
    ingest(d);
    rebuild();
  }

  function ingest(d) {
    if ('config' in d) {
      config = d.config || {};
      config.presets = config.presets || {};
      config.custom = config.custom || [];
      config.settings = Object.assign({}, DB.DEFAULT_SETTINGS, config.settings || {});
    }
    if ('usage' in d) usage = d.usage || {};
    if ('snoozes' in d) snoozes = d.snoozes || {};
  }

  function rebuild() {
    if (!config) return;
    DB.setLanguage(config.settings.language);
    rules = DB.buildRules(config);
    hasHostRules = rules.some((r) => r.mode !== 'off' && DB.hostMatches(location.hostname, r.hosts));
    if (hasHostRules) startTimer();
    else stopTimer();
    apply(true);
  }

  function usageToday() {
    const day = usage[DB.dayKey(new Date())];
    const map = Object.assign({}, (day && day.rules) || {});
    for (const id in pending) map[id] = (map[id] || 0) + pending[id];
    return map;
  }

  /* ───────────── evaluate + apply ───────────── */

  function apply(force) {
    if (!config) return;
    const res = hasHostRules ? DB.evaluate({ rules, settings: config.settings, usage: usageToday(), snoozes }, location.href) : { hide: [], blocked: null, track: [], blockers: [] };
    current = res;
    syncHide(res.hide);
    syncOverlay(res, force);
  }

  function syncHide(selectors) {
    const css = [...new Set(selectors)].map((s) => s + '{display:none!important}').join('\n');
    if (css === hideCss) return;
    hideCss = css;
    let style = document.getElementById(HIDE_STYLE_ID);
    if (!css) {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = HIDE_STYLE_ID;
      (document.documentElement || document).append(style);
    }
    style.textContent = css;
  }

  function setPageHidden(hidden) {
    let style = document.getElementById(BLOCK_STYLE_ID);
    if (!hidden) {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement('style');
      style.id = BLOCK_STYLE_ID;
      style.textContent = 'html>body{display:none!important}';
      (document.documentElement || document).append(style);
    }
  }

  function syncOverlay(res, force) {
    if (!res.blocked) {
      if (overlay) {
        overlay.destroy();
        overlay = null;
        overlayKey = '';
      }
      setPageHidden(false);
      return;
    }
    const key = res.blocked.rule.id + '|' + res.blocked.reason;
    setPageHidden(true);
    if (overlay && overlayKey === key && !force) {
      if (!overlay.host.isConnected) (document.documentElement || document).append(overlay.host);
      return;
    }
    if (overlay) overlay.destroy();
    const ids = res.blockers || [res.blocked.rule.id];
    overlay = DB.createOverlay(res.blocked, {
      settings: config.settings,
      scheduleText: DB.describeSchedule(res.blocked.rule.schedule, {
        every: DB.t('sched.every'),
        weekdays: DB.t('sched.weekdays'),
        weekend: DB.t('sched.weekend'),
        short: [0, 1, 2, 3, 4, 5, 6].map((i) => DB.t('day.' + i)),
      }),
      onBack: () => {
        if (history.length > 1) history.back();
        else send({ type: 'close' });
      },
      onClose: () => send({ type: 'close' }),
      onUnlock: (minutes) => {
        const until = Date.now() + minutes * 60000;
        for (const id of ids) snoozes[id] = until;
        send({ type: 'snooze', ids, minutes });
        apply(true);
      },
    });
    (document.documentElement || document).append(overlay.host);
    overlay.focus();
    if (overlayKey !== key) send({ type: 'blocked', ruleId: res.blocked.rule.id });
    overlayKey = key;
    pauseMedia();
  }

  function pauseMedia() {
    document.querySelectorAll('video,audio').forEach((m) => {
      try {
        if (!m.paused) m.pause();
      } catch (_) {}
    });
  }

  /* ───────────── time tracking ───────────── */

  function flush() {
    if (!pendingTotal) return;
    const ids = Object.keys(pending);
    const seconds = pendingTotal;
    // optimistic local update; storage events later replace it with the real value
    const key = DB.dayKey(new Date());
    const day = usage[key] || (usage[key] = DB.emptyDay());
    for (const id of ids) day.rules[id] = (day.rules[id] || 0) + pending[id];
    for (const id of ids) delete pending[id];
    pendingTotal = 0;
    sinceFlush = 0;
    send({ type: 'usage', ids, seconds });
  }

  function tick() {
    if (!alive()) return shutdown();
    const now = performance.now();
    const dt = Math.min(2000, now - lastTick) / 1000;
    lastTick = now;

    if (location.href !== lastHref) {
      lastHref = location.href;
      apply(false);
      sinceEval = 0;
    }

    if (overlay) {
      pauseMedia();
      return;
    }

    if (document.visibilityState === 'visible' && current && current.track.length) {
      for (const id of current.track) pending[id] = (pending[id] || 0) + dt;
      pendingTotal += dt;
      sinceFlush += dt * 1000;
      sinceEval += dt * 1000;
      if (sinceEval >= 1000) {
        sinceEval = 0;
        apply(false); // limit may have been reached
      }
      if (sinceFlush >= FLUSH_MS) flush();
    }
  }

  function startTimer() {
    if (interval) return;
    lastTick = performance.now();
    lastHref = location.href;
    interval = setInterval(tick, TICK_MS);
  }

  function stopTimer() {
    if (!interval) return;
    flush();
    clearInterval(interval);
    interval = null;
  }

  function shutdown() {
    clearInterval(interval);
    interval = null;
    if (observer) observer.disconnect();
    if (overlay) overlay.destroy();
    overlay = null;
    setPageHidden(false);
    const s = document.getElementById(HIDE_STYLE_ID);
    if (s) s.remove();
  }

  /* ───────────── wiring ───────────── */

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      const d = {};
      for (const k of ['config', 'usage', 'snoozes']) if (k in changes) d[k] = changes[k].newValue;
      ingest(d);
      if ('config' in d) rebuild();
      else apply(false);
    });
  } catch (_) {
    return;
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
    else lastTick = performance.now();
  });
  window.addEventListener('pagehide', flush);
  window.addEventListener('popstate', () => apply(false));

  // keep the overlay alive if the page tears down documentElement children
  observer = new MutationObserver(() => {
    if (overlay && !overlay.host.isConnected) (document.documentElement || document).append(overlay.host);
    if (overlay && !document.getElementById(BLOCK_STYLE_ID)) setPageHidden(true);
  });
  observer.observe(document, { childList: true });
  const startObserving = () => {
    if (document.documentElement) observer.observe(document.documentElement, { childList: true });
  };
  startObserving();

  load().catch(() => {});
})();
