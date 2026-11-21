/*
 * Dopablock – rule engine.
 *
 * Pure functions shared by the service worker, the content script and the
 * extension pages. No DOM / chrome.* access in here (except `storage` helpers
 * at the bottom, which only run when chrome.storage exists).
 */
(function (root) {
  'use strict';

  const DB = root.DopaBlock || (root.DopaBlock = {});
  const SITES = DB.SITES || (typeof require !== 'undefined' ? require('./presets.js').SITES : []);

  const MODES = ['off', 'track', 'limit', 'block'];

  const DEFAULT_SETTINGS = {
    language: 'auto', // auto | en | de
    theme: 'system', // system | light | dark
    friction: 10, // seconds of "breathing" before an override is granted
    snoozeMinutes: 5, // length of an override
    strict: false, // no overrides, no pause
    pausedUntil: 0,
  };

  const DEFAULT_PRESET_STATE = { mode: 'off', limitMin: 30, schedule: null };

  /* ───────────── time helpers ───────────── */

  const pad = (n) => String(n).padStart(2, '0');

  function dayKey(date) {
    const d = date instanceof Date ? date : new Date(date);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function toMin(hhmm) {
    const [h, m] = String(hhmm || '0:0').split(':').map((x) => parseInt(x, 10) || 0);
    return Math.min(24 * 60, h * 60 + m);
  }

  /** Is the schedule currently in force? `null` schedule = always. */
  function isScheduleActive(schedule, date) {
    if (!schedule) return true;
    const d = date instanceof Date ? date : new Date(date);
    const days = schedule.days && schedule.days.length ? schedule.days : [0, 1, 2, 3, 4, 5, 6];
    const mins = d.getHours() * 60 + d.getMinutes();
    const a = toMin(schedule.start);
    const b = toMin(schedule.end);
    const day = d.getDay();
    if (a === b) return days.includes(day); // whole day
    if (a < b) return days.includes(day) && mins >= a && mins < b;
    // overnight window, e.g. 22:00 → 06:00
    if (mins >= a) return days.includes(day);
    if (mins < b) return days.includes((day + 6) % 7);
    return false;
  }

  /* ───────────── matching ───────────── */

  function normHost(host) {
    return String(host || '').toLowerCase().replace(/^www\./, '');
  }

  function hostMatches(host, hosts) {
    const h = normHost(host);
    return hosts.some((x) => {
      x = normHost(x);
      return h === x || h.endsWith('.' + x);
    });
  }

  const reCache = new Map();
  function getRegex(src) {
    if (reCache.has(src)) return reCache.get(src);
    let re = null;
    try {
      re = new RegExp(src);
    } catch (_) {
      re = null;
    }
    reCache.set(src, re);
    return re;
  }

  function trimSlash(p) {
    return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p;
  }

  function patternMatches(pattern, pathname) {
    pattern = String(pattern || '').trim();
    if (!pattern) return false;
    if (pattern.startsWith('re:')) {
      const re = getRegex(pattern.slice(3));
      return !!re && re.test(pathname);
    }
    if (pattern === '*' || pattern === '/*') return true;
    if (pattern.endsWith('/*')) {
      const base = trimSlash(pattern.slice(0, -2));
      return pathname === base || pathname.startsWith(base + '/');
    }
    if (pattern.endsWith('*')) return pathname.startsWith(pattern.slice(0, -1));
    return trimSlash(pathname) === trimSlash(pattern);
  }

  function pathMatches(pathname, paths, exclude) {
    if (!paths || !paths.length) return false;
    if (exclude && exclude.some((p) => patternMatches(p, pathname))) return false;
    return paths.some((p) => patternMatches(p, pathname));
  }

  /* ───────────── rules ───────────── */

  /** Flatten presets (with the user's overrides) + custom rules into one list. */
  function buildRules(config) {
    config = config || {};
    const presets = config.presets || {};
    const out = [];
    for (const site of SITES) {
      for (const sec of site.sections) {
        const id = site.id + ':' + sec.id;
        const st = Object.assign({}, DEFAULT_PRESET_STATE, presets[id] || {});
        out.push({
          id,
          custom: false,
          siteId: site.id,
          siteName: site.name,
          name: sec.name,
          desc: sec.desc,
          hosts: site.hosts,
          paths: sec.paths || [],
          exclude: sec.exclude || [],
          hide: sec.hide || [],
          mode: MODES.includes(st.mode) ? st.mode : 'off',
          limitMin: Math.max(1, Math.round(st.limitMin) || 30),
          schedule: st.schedule || null,
        });
      }
    }
    for (const c of config.custom || []) {
      out.push({
        id: c.id,
        custom: true,
        siteId: 'custom',
        siteName: (c.hosts && c.hosts[0]) || 'Custom',
        name: c.name || (c.hosts && c.hosts[0]) || 'Custom rule',
        desc: null,
        hosts: c.hosts || [],
        paths: c.paths || [],
        exclude: c.exclude || [],
        hide: c.hide || [],
        mode: MODES.includes(c.mode) ? c.mode : 'block',
        limitMin: Math.max(1, Math.round(c.limitMin) || 30),
        schedule: c.schedule || null,
      });
    }
    return out;
  }

  /**
   * Evaluate a URL against the rules.
   *
   * ctx: { rules, settings, usage: {ruleId: seconds today}, snoozes: {ruleId: untilTs} }
   * returns {
   *   hostRules  – enabled rules whose host matches,
   *   matched    – rules whose page pattern matches this URL,
   *   blocked    – null | { rule, reason: 'block'|'limit', used, limit },
   *   hide       – css selectors to hide,
   *   track      – rule ids to count time for
   * }
   */
  function evaluate(ctx, urlStr, now) {
    now = now || Date.now();
    const out = { hostRules: [], matched: [], blocked: null, hide: [], track: [] };
    let url;
    try {
      url = new URL(urlStr);
    } catch (_) {
      return out;
    }
    if (!/^https?:$/.test(url.protocol)) return out;

    const settings = Object.assign({}, DEFAULT_SETTINGS, ctx.settings || {});
    const paused = settings.pausedUntil > now;
    const usage = ctx.usage || {};
    const snoozes = ctx.snoozes || {};
    const date = new Date(now);
    const candidates = [];

    for (const rule of ctx.rules) {
      if (rule.mode === 'off' || !rule.hosts.length) continue;
      if (!hostMatches(url.hostname, rule.hosts)) continue;
      out.hostRules.push(rule);

      const scheduled = isScheduleActive(rule.schedule, date);
      const snoozed = (snoozes[rule.id] || 0) > now;
      const used = usage[rule.id] || 0;
      const limit = rule.limitMin * 60;
      const limitHit = rule.mode === 'limit' && used >= limit;
      const inForce = !paused && scheduled && !snoozed && (rule.mode === 'block' || limitHit);

      if (inForce) for (const sel of rule.hide) out.hide.push(sel);

      if (pathMatches(url.pathname, rule.paths, rule.exclude)) {
        out.matched.push(rule);
        if (inForce) candidates.push({ rule, reason: rule.mode === 'block' ? 'block' : 'limit', used, limit });
        else out.track.push(rule.id);
      }
    }

    if (candidates.length) {
      out.blocked = candidates.find((c) => c.reason === 'block') || candidates[0];
      out.blockers = candidates.map((c) => c.rule.id); // an override must lift all of them
      out.track = []; // the page is not shown → nothing to count
    }
    return out;
  }

  /* ───────────── formatting ───────────── */

  function fmtDuration(seconds, opts) {
    const s = Math.max(0, Math.round(seconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (opts && opts.parts) return { h, m, s: s % 60 };
    if (h) return h + 'h ' + pad(m) + 'm';
    if (m) return m + 'm';
    return s + 's';
  }

  function describeSchedule(schedule, names) {
    if (!schedule) return '';
    const days = (schedule.days && schedule.days.length ? schedule.days : [0, 1, 2, 3, 4, 5, 6]).slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
    let dayText;
    if (days.length === 7) dayText = names.every;
    else if (days.length === 5 && !days.includes(0) && !days.includes(6)) dayText = names.weekdays;
    else if (days.length === 2 && days.includes(0) && days.includes(6)) dayText = names.weekend;
    else dayText = days.map((d) => names.short[d]).join(', ');
    const a = schedule.start || '00:00';
    const b = schedule.end || '24:00';
    return a === b ? dayText : dayText + ' · ' + a + '–' + b;
  }

  /* ───────────── storage (only where chrome.storage exists) ───────────── */

  function emptyDay() {
    return { rules: {}, hours: new Array(24).fill(0), total: 0, blocks: 0 };
  }

  async function loadAll() {
    const d = await chrome.storage.local.get(['config', 'usage', 'snoozes']);
    const config = d.config || {};
    config.presets = config.presets || {};
    config.custom = config.custom || [];
    config.settings = Object.assign({}, DEFAULT_SETTINGS, config.settings || {});
    return { config, usage: d.usage || {}, snoozes: d.snoozes || {} };
  }

  async function saveConfig(config) {
    await chrome.storage.local.set({ config });
  }

  /** Change a rule (preset override or custom rule) inside `config`. Returns config. */
  function patchRule(config, rule, patch) {
    if (rule.custom) {
      const i = config.custom.findIndex((c) => c.id === rule.id);
      if (i >= 0) config.custom[i] = Object.assign({}, config.custom[i], patch);
    } else {
      config.presets[rule.id] = Object.assign({}, DEFAULT_PRESET_STATE, config.presets[rule.id] || {}, patch);
    }
    return config;
  }

  function uid() {
    return 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  const api = {
    MODES,
    DEFAULT_SETTINGS,
    DEFAULT_PRESET_STATE,
    dayKey,
    isScheduleActive,
    hostMatches,
    patternMatches,
    pathMatches,
    buildRules,
    evaluate,
    fmtDuration,
    describeSchedule,
    emptyDay,
    loadAll,
    saveConfig,
    patchRule,
    uid,
  };
  Object.assign(DB, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = Object.assign({}, DB);
})(typeof globalThis !== 'undefined' ? globalThis : this);
