(function () {
  'use strict';
  const DB = globalThis.DopaBlock;
  const { h, t, icon } = DB;
  const app = document.getElementById('app');

  let state = null;
  let tabUrl = '';
  let menuOpen = false;
  let countdown = null; // { minutes, left, timer }
  let ticker = null;

  /* ───────────── data ───────────── */

  async function reload() {
    state = await DB.loadAll();
    DB.applyAppearance(state.config.settings);
    render();
  }

  async function save() {
    await DB.saveConfig(state.config);
  }

  async function setMode(rule, mode) {
    DB.patchRule(state.config, rule, { mode });
    await save();
  }

  async function blockHost(host) {
    state.config.custom.push({ id: DB.uid(), name: host, hosts: [host], paths: ['/*'], exclude: [], hide: [], mode: 'block', limitMin: 30, schedule: null });
    await save();
  }

  async function pauseFor(minutes) {
    state.config.settings.pausedUntil = Date.now() + minutes * 60000;
    menuOpen = false;
    await save();
  }

  async function resume() {
    state.config.settings.pausedUntil = 0;
    await save();
  }

  /* ───────────── pieces ───────────── */

  function remaining(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function pauseControl() {
    const s = state.config.settings;
    const now = Date.now();
    if (s.pausedUntil > now) {
      const label = h('span', { class: 'num', 'data-pause-label': '' }, t('popup.paused', { t: remaining(s.pausedUntil - now) }));
      return h('button', { class: 'btn pausebtn on', onclick: resume, title: t('popup.resume') }, icon('play', 15), label);
    }
    if (s.strict) {
      return h('button', { class: 'btn pausebtn', disabled: true, title: t('popup.strictNoPause') }, icon('lock', 15), t('popup.pause'));
    }
    const btn = h(
      'button',
      {
        class: 'btn pausebtn',
        'aria-haspopup': 'true',
        'aria-expanded': String(menuOpen),
        onclick: (e) => {
          e.stopPropagation();
          menuOpen = !menuOpen;
          countdown = null;
          render();
        },
      },
      icon('pause', 15),
      t('popup.pause')
    );
    if (!menuOpen) return btn;
    const items = [5, 15, 30, 60].map((m) => {
      const waiting = countdown && countdown.minutes === m;
      return h(
        'button',
        {
          class: waiting ? 'wait' : '',
          onclick: (e) => {
            e.stopPropagation();
            startCountdown(m);
          },
        },
        waiting ? t('popup.pauseConfirm', { s: countdown.left }) : t('popup.min', { n: m })
      );
    });
    return h('div', { style: { position: 'relative' } }, btn, h('div', { class: 'menu', onclick: (e) => e.stopPropagation() }, h('div', { class: 'label' }, t('popup.pauseFor')), items));
  }

  function startCountdown(minutes) {
    if (countdown) clearInterval(countdown.timer);
    const secs = Math.max(0, state.config.settings.friction | 0);
    if (!secs) return pauseFor(minutes);
    countdown = { minutes, left: secs };
    countdown.timer = setInterval(() => {
      countdown.left -= 1;
      if (countdown.left <= 0) {
        clearInterval(countdown.timer);
        countdown = null;
        pauseFor(minutes);
      } else render();
    }, 1000);
    render();
  }

  function hero(day) {
    const s = state.config.settings;
    const paused = s.pausedUntil > Date.now();
    const total = day.total || 0;
    const { h: hh, m: mm } = DB.fmtDuration(total, { parts: true });
    let num;
    if (total >= 3600) num = [h('span', { class: 'big' }, String(hh)), h('span', { class: 'unit' }, 'h'), h('span', { class: 'big' }, String(mm).padStart(2, '0')), h('span', { class: 'unit' }, 'm')];
    else if (total >= 60) num = [h('span', { class: 'big' }, String(mm)), h('span', { class: 'unit' }, 'min')];
    else num = [h('span', { class: 'big' }, String(Math.round(total))), h('span', { class: 'unit' }, 'sec')];

    const max = Math.max(60, ...day.hours);
    const nowH = new Date().getHours();
    const bars = day.hours.map((v, i) => {
      const b = h('b', { class: (v ? '' : 'zero ') + (i === nowH ? 'now' : '') });
      if (v) b.style.setProperty('--h', Math.max(6, (v / max) * 64) + 'px');
      return b;
    });

    return h(
      'section',
      { class: 'card hero' },
      h(
        'div',
        { class: 'hero-top' },
        h('span', { class: 'hero-label' }, h('i'), t('popup.screenTime')),
        h('span', { class: 'tag ' + (paused ? 'tone-orange' : 'tone-green') }, paused ? t('popup.pausedTag') : t('popup.protectedTag'))
      ),
      h('div', { class: 'hero-num' }, num),
      h('div', { class: 'hairline', role: 'img', 'aria-label': t('ov.hourly') }, bars),
      h('div', { class: 'axis' }, t('popup.hourAxis').map((x) => h('span', null, x))),
      h('div', { class: 'hero-foot' }, h('span', { class: 'tag ' + (day.blocks ? 'tone-red' : 'tone-gray') }, day.blocks ? t('popup.blocksToday', { n: day.blocks }) : t('popup.noBlocks')))
    );
  }

  function ruleRow(rule, day, opts) {
    opts = opts || {};
    const used = (day.rules && day.rules[rule.id]) || 0;
    const ratio = rule.mode === 'limit' ? used / (rule.limitMin * 60) : null;
    const tone = rule.mode === 'block' ? 'red' : ratio !== null && ratio >= 1 ? 'red' : '';
    const title = opts.withSite && !rule.id.endsWith(':all') && !rule.custom ? rule.siteName + ' · ' + rule.name : rule.name;
    return h(
      'div',
      { class: 'rule' },
      opts.withSite ? DB.siteTile(rule.hosts[0], rule.siteName, 36) : null,
      h(
        'div',
        { class: 'rule-main' },
        h('div', { class: 'rule-name', title }, title),
        h('div', { class: 'rule-sub' + (tone ? ' tone-' + tone : '') }, DB.ruleStatus(rule, used)),
        ratio !== null ? DB.progress(ratio) : null
      ),
      DB.modePill(rule, (mode) => setMode(rule, mode))
    );
  }

  function thisSite(rules, day) {
    let url;
    try {
      url = new URL(tabUrl);
    } catch (_) {
      return null;
    }
    if (!/^https?:$/.test(url.protocol)) return null;
    const host = url.hostname.replace(/^www\./, '');
    const site = DB.SITES.find((s) => DB.hostMatches(host, s.hosts));

    let own;
    let name = host;
    if (site) {
      own = rules.filter((r) => r.siteId === site.id);
      name = site.name;
    } else {
      own = rules.filter((r) => r.custom && DB.hostMatches(host, r.hosts));
    }

    const head = h('div', { class: 'site-head' }, DB.siteTile(host, name, 40), h('div', null, h('strong', null, name), h('small', null, host)));
    const body = [];
    if (own.length) own.forEach((r) => body.push(ruleRow(r, day)));
    else
      body.push(
        h(
          'button',
          { class: 'btn blockbtn block', onclick: () => blockHost(host) },
          icon('ban', 20),
          h('span', { class: 'txt' }, t('popup.blockSite', { host }), h('small', null, t('popup.blockSiteHint')))
        )
      );
    return { el: h('section', { class: 'card section' }, h('div', { class: 'section-head' }, h('h2', null, t('popup.thisSite'))), head, h('div', { class: 'rules' }, body)), ids: new Set(own.map((r) => r.id)) };
  }

  function activeRules(rules, day, skip) {
    const list = rules.filter((r) => r.mode !== 'off' && !skip.has(r.id));
    const head = h('div', { class: 'section-head' }, h('h2', null, t('popup.activeRules')), h('span', { class: 'tag tone-blue', style: { marginLeft: 'auto' } }, String(list.length)));
    if (!list.length) {
      return h(
        'section',
        { class: 'card section' },
        head,
        h('div', { class: 'empty' }, h('span', { class: 'tile' }, icon('shield', 20)), h('span', null, t('popup.emptyActive')))
      );
    }
    return h('section', { class: 'card section' }, head, h('div', { class: 'rules' }, list.map((r) => ruleRow(r, day, { withSite: true }))));
  }

  /* ───────────── render ───────────── */

  function render() {
    if (!state) return;
    const rules = DB.buildRules(state.config);
    const day = DB.todayUsage(state.usage);
    const site = thisSite(rules, day);

    app.replaceChildren(
      h(
        'header',
        { class: 'top' },
        h('div', { class: 'logo', html: DB.LOGO_SVG + '<span>Dopablock</span>' }),
        h(
          'div',
          { class: 'top-actions' },
          pauseControl(),
          h('button', { class: 'iconbtn', title: t('popup.openSettings'), 'aria-label': t('popup.openSettings'), onclick: () => chrome.runtime.openOptionsPage() }, icon('sliders', 18))
        )
      ),
      hero(day),
      site ? site.el : null,
      activeRules(rules, day, site ? site.ids : new Set()),
      h('div', { class: 'foot' }, h('button', { class: 'btn primary block', onclick: () => chrome.runtime.openOptionsPage() }, t('popup.manage'), icon('arrowRight', 16)))
    );

    // live countdown for "paused"
    clearInterval(ticker);
    if (state.config.settings.pausedUntil > Date.now()) {
      ticker = setInterval(() => {
        const left = state.config.settings.pausedUntil - Date.now();
        if (left <= 0) {
          clearInterval(ticker);
          render();
          return;
        }
        const el = app.querySelector('[data-pause-label]');
        if (el) el.textContent = t('popup.paused', { t: remaining(left) });
      }, 1000);
    }
  }

  document.addEventListener('click', () => {
    if (menuOpen) {
      menuOpen = false;
      if (countdown) clearInterval(countdown.timer);
      countdown = null;
      render();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) {
      menuOpen = false;
      if (countdown) clearInterval(countdown.timer);
      countdown = null;
      render();
    }
  });

  chrome.storage.onChanged.addListener(DB.debounce(reload, 80));

  (async function init() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      tabUrl = (tab && tab.url) || '';
    } catch (_) {
      tabUrl = '';
    }
    await reload();
  })();
})();
