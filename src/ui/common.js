/*
 * Dopablock – shared UI helpers for popup + options page.
 */
(function (root) {
  'use strict';
  const DB = root.DopaBlock;
  const { t } = DB;

  /* ───────────── icons (24×24, stroke) ───────────── */
  const ICONS = {
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    sliders: '<path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"/>',
    shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
    chart: '<path d="M12 20V10M18 20V4M6 20v-4"/>',
    pause: '<rect x="14" y="4" width="4" height="16" rx="1"/><rect x="6" y="4" width="4" height="16" rx="1"/>',
    play: '<path d="M6 3l14 9-14 9z"/>',
    globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>',
    pencil: '<path d="M21.2 6.8a1 1 0 0 0-4-4L3.8 16.2a2 2 0 0 0-.5.8l-1.3 4.4a.5.5 0 0 0 .6.6l4.4-1.3a2 2 0 0 0 .8-.5z"/>',
    calendar: '<path d="M8 2v4M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    arrowLeft: '<path d="m12 19-7-7 7-7M19 12H5"/>',
    arrowRight: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    eye: '<path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0"/><circle cx="12" cy="12" r="3"/>',
    home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .7-1.5l7-6a2 2 0 0 1 2.6 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  };

  function icon(name, size) {
    const span = document.createElement('span');
    span.className = 'ico-svg';
    span.style.cssText = 'display:inline-flex;width:' + (size || 18) + 'px;height:' + (size || 18) + 'px;flex:none';
    span.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || '') +
      '</svg>';
    return span;
  }

  const LOGO_SVG =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor"/><path d="M22 0a10 10 0 0 1 0 20z" fill="var(--accent)"/></svg>';

  /* ───────────── tiny DOM builder ───────────── */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === false || v == null) continue;
        if (k === 'class') el.className = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
        else if (k === 'html') el.innerHTML = v;
        else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k === 'value') el.value = v;
        else if (v === true) el.setAttribute(k, '');
        else el.setAttribute(k, v);
      }
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    }
    return el;
  }

  /* ───────────── theme / language ───────────── */
  function applyAppearance(settings) {
    DB.setLanguage(settings.language);
    const r = document.documentElement;
    if (settings.theme === 'light' || settings.theme === 'dark') r.setAttribute('data-theme', settings.theme);
    else r.removeAttribute('data-theme');
    r.lang = DB.getLanguage();
  }

  /* ───────────── favicon / site tile ───────────── */
  function faviconUrl(host, size) {
    try {
      const u = new URL(chrome.runtime.getURL('/_favicon/'));
      u.searchParams.set('pageUrl', 'https://' + host + '/');
      u.searchParams.set('size', String(size || 32));
      return u.toString();
    } catch (_) {
      return '';
    }
  }

  function siteTile(host, label, size) {
    const initial = (label || host || '?').trim().charAt(0).toUpperCase();
    const tile = h('span', { class: 'tile', style: { width: (size || 36) + 'px', height: (size || 36) + 'px' } }, h('span', { class: 'tile-initial' }, initial));
    const src = host ? faviconUrl(host, 32) : '';
    if (src) {
      const img = h('img', { src, alt: '', draggable: 'false' });
      img.addEventListener('error', () => img.remove());
      tile.append(img);
    }
    return tile;
  }

  /* ───────────── formatting ───────────── */
  function dayNames() {
    return {
      every: t('sched.every'),
      weekdays: t('sched.weekdays'),
      weekend: t('sched.weekend'),
      short: [0, 1, 2, 3, 4, 5, 6].map((i) => t('day.' + i)),
    };
  }

  const describeSchedule = (s) => DB.describeSchedule(s, dayNames());

  function todayUsage(usage, now) {
    return (usage && usage[DB.dayKey(new Date(now || Date.now()))]) || DB.emptyDay();
  }

  function minutesLabel(sec) {
    const m = Math.floor(sec / 60);
    return m >= 60 ? Math.floor(m / 60) + 'h ' + String(m % 60).padStart(2, '0') + 'm' : m + 'm';
  }

  /** "12m of 30m" | "Blocked" | "Tracking · 4m today" + schedule */
  function ruleStatus(rule, usedSec) {
    let text;
    if (rule.mode === 'limit') text = t('row.limitOf', { used: minutesLabel(usedSec), limit: rule.limitMin + 'm' });
    else if (rule.mode === 'block') text = t('row.blocked');
    else if (rule.mode === 'track') text = usedSec ? t('row.trackingToday', { t: DB.fmtDuration(usedSec) }) : t('row.tracking');
    else text = rule.desc ? DB.loc(rule.desc) : '';
    if (rule.mode !== 'off' && rule.schedule) text += ' · ' + describeSchedule(rule.schedule);
    return text;
  }

  const MODE_TONE = { off: 'gray', track: 'blue', limit: 'orange', block: 'red' };

  /** Rules that only hide elements cannot be limited or tracked. */
  const allowedModes = (rule) => (rule.paths.length ? ['off', 'track', 'limit', 'block'] : ['off', 'block']);

  /** Tinted pill that is really a <select>. */
  function modePill(rule, onChange) {
    const wrap = h('label', { class: 'pill tone-' + MODE_TONE[rule.mode] });
    const dot = h('span', { class: 'dot' });
    const select = h(
      'select',
      { 'aria-label': rule.name },
      allowedModes(rule).map((m) => h('option', { value: m, selected: m === rule.mode }, t('mode.' + m)))
    );
    select.addEventListener('change', () => onChange(select.value));
    wrap.append(dot, h('span', { class: 'pill-label' }, t('mode.' + rule.mode)), icon('chevron', 14), select);
    return wrap;
  }

  function segmented(options, value, onChange, cls) {
    const el = h('div', { class: 'seg ' + (cls || ''), role: 'group' });
    for (const o of options) {
      const b = h(
        'button',
        { type: 'button', class: 'seg-btn' + (o.value === value ? ' active tone-' + (o.tone || 'gray') : ''), 'aria-pressed': String(o.value === value) },
        o.label
      );
      b.addEventListener('click', () => onChange(o.value));
      el.append(b);
    }
    return el;
  }

  function progress(ratio, tone) {
    const r = Math.max(0, Math.min(1, ratio || 0));
    return h('div', { class: 'bar tone-' + (tone || (r >= 1 ? 'red' : r >= 0.75 ? 'orange' : 'green')) }, h('i', { style: { width: r * 100 + '%' } }));
  }

  function debounce(fn, ms) {
    let id;
    return (...a) => {
      clearTimeout(id);
      id = setTimeout(() => fn(...a), ms);
    };
  }

  Object.assign(DB, {
    icon,
    LOGO_SVG,
    h,
    applyAppearance,
    siteTile,
    faviconUrl,
    describeScheduleText: describeSchedule,
    todayUsage,
    minutesLabel,
    ruleStatus,
    MODE_TONE,
    allowedModes,
    modePill,
    segmented,
    progress,
    debounce,
  });
})(typeof globalThis !== 'undefined' ? globalThis : this);
