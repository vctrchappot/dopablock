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

  const STRICTNESS = { off: 0, track: 1, limit: 2, block: 3 };

  /** With a PIN set, loosening a rule needs the PIN. */
  async function setMode(rule, mode) {
    if (STRICTNESS[mode] < STRICTNESS[rule.mode] && !(await guard())) return render();
    DB.patchRule(state.config, rule, { mode });
    await save();
  }

  async function blockHost(host) {
    state.config.custom.push({ id: DB.uid(), name: host, hosts: [host], paths: ['/*'], exclude: [], hide: [], mode: 'block', limitMin: 30, schedule: null });
    await save();
  }

  /* ───────────── pin ───────────── */

  function pinPrompt() {
    return new Promise((resolve) => {
      const input = h('input', { class: 'input pin', type: 'password', inputmode: 'numeric', autocomplete: 'off', placeholder: t('pin.enter'), 'aria-label': t('pin.enter') });
      const err = h('div', { class: 'err' });
      let box;
      const close = (v) => {
        box.remove();
        resolve(v);
      };
      const submit = async () => {
        if (await DB.verifyPin(state.config.settings, input.value)) close(true);
        else {
          err.textContent = t('pin.wrong');
          input.value = '';
          input.focus();
        }
      };
      input.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter') submit();
        if (e.key === 'Escape') close(false);
      });
      box = h(
        'div',
        { class: 'pinmodal', onclick: (e) => e.target === box && close(false) },
        h(
          'div',
          { class: 'card pincard' },
          h('div', { class: 'pintitle' }, icon('lock', 18), t('pin.enter')),
          input,
          err,
          h('div', { class: 'pinbtns' }, h('button', { class: 'btn', onclick: () => close(false) }, t('edit.cancel')), h('button', { class: 'btn primary', onclick: submit }, t('pin.unlock')))
        )
      );
      document.body.append(box);
      input.focus();
    });
  }

  const guard = async () => !state.config.settings.pinHash || (await pinPrompt());

  /* ───────────── pause & focus ───────────── */

  async function pauseFor(minutes) {
    menuOpen = false;
    if (!(await guard())) return render();
    state.config.settings.pausedUntil = Date.now() + minutes * 60000;
    await save();
  }

  async function resume() {
    state.config.settings.pausedUntil = 0;
    await save();
  }

  async function startFocus(minutes) {
    menuOpen = false;
    state.config.settings.focusUntil = Date.now() + minutes * 60000;
    state.config.settings.pausedUntil = 0;
    await save();
  }

  async function endFocus() {
    menuOpen = false;
    if (!(await guard())) return render();
    state.config.settings.focusUntil = 0;
    await save();
  }

  function remaining(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  function startCountdown(key, done) {
    if (countdown) clearInterval(countdown.timer);
    const secs = Math.max(0, state.config.settings.friction | 0);
    if (!secs) return done();
    countdown = { key, left: secs };
    countdown.timer = setInterval(() => {
      countdown.left -= 1;
      if (countdown.left <= 0) {
        clearInterval(countdown.timer);
        countdown = null;
        done();
      } else render();
    }, 1000);
    render();
  }

  function closeMenu() {
    menuOpen = false;
    if (countdown) clearInterval(countdown.timer);
    countdown = null;
  }

  function menuItem(key, label, onClick) {
    const waiting = countdown && countdown.key === key;
    return h(
      'button',
      {
        class: waiting ? 'wait' : '',
        onclick: (e) => {
          e.stopPropagation();
          onClick();
        },
      },
      waiting ? t('popup.pauseConfirm', { s: countdown.left }) : label
    );
  }

  function pauseControl() {
    const s = state.config.settings;
    const now = Date.now();
    const toggle = (e) => {
      e.stopPropagation();
      const was = menuOpen;
      closeMenu();
      menuOpen = !was;
      render();
    };
    const wrap = (btn, items) =>
      menuOpen ? h('div', { style: { position: 'relative' } }, btn, h('div', { class: 'menu', onclick: (e) => e.stopPropagation() }, items)) : btn;

    if (s.focusUntil > now) {
      const btn = h(
        'button',
        { class: 'btn pausebtn focus', 'aria-haspopup': 'true', 'aria-expanded': String(menuOpen), onclick: toggle },
        icon('moon', 15),
        h('span', { class: 'num', 'data-focus-label': '' }, t('popup.focusing', { t: remaining(s.focusUntil - now) }))
      );
      return wrap(btn, [menuItem('end', t('popup.focusEnd'), () => startCountdown('end', endFocus))]);
    }
    if (s.pausedUntil > now) {
      return h(
        'button',
        { class: 'btn pausebtn on', onclick: resume, title: t('popup.resume') },
        icon('play', 15),
        h('span', { class: 'num', 'data-pause-label': '' }, t('popup.paused', { t: remaining(s.pausedUntil - now) }))
      );
    }
    const btn = h('button', { class: 'btn pausebtn', 'aria-haspopup': 'true', 'aria-expanded': String(menuOpen), onclick: toggle }, icon('pause', 15), t('popup.pause'), icon('chevron', 14));
    const items = [];
    if (!s.strict) {
      items.push(h('div', { class: 'label' }, t('popup.pauseFor')));
      for (const m of [5, 15, 30, 60]) items.push(menuItem('p' + m, t('popup.min', { n: m }), () => startCountdown('p' + m, () => pauseFor(m))));
    } else {
      items.push(h('div', { class: 'label' }, t('popup.strictNoPause')));
    }
    items.push(h('div', { class: 'label' }, t('popup.focusFor')));
    for (const m of [25, 50, 90]) items.push(menuItem('f' + m, t('popup.min', { n: m }), () => startFocus(m)));
    return wrap(btn, items);
  }

  function hero(day) {
    const s = state.config.settings;
    const paused = s.pausedUntil > Date.now();
    const focus = s.focusUntil > Date.now();
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
        h('span', { class: 'tag ' + (focus ? 'tone-purple' : paused ? 'tone-orange' : 'tone-green') }, focus ? t('popup.focusTag') : paused ? t('popup.pausedTag') : t('popup.protectedTag'))
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

    // live countdown for pause / focus
    clearInterval(ticker);
    const st = state.config.settings;
    if (st.pausedUntil > Date.now() || st.focusUntil > Date.now()) {
      ticker = setInterval(() => {
        const n = Date.now();
        const p = state.config.settings.pausedUntil - n;
        const f = state.config.settings.focusUntil - n;
        const pl = app.querySelector('[data-pause-label]');
        const fl = app.querySelector('[data-focus-label]');
        if ((pl && p <= 0) || (fl && f <= 0)) {
          clearInterval(ticker);
          render();
          return;
        }
        if (pl) pl.textContent = t('popup.paused', { t: remaining(p) });
        if (fl) fl.textContent = t('popup.focusing', { t: remaining(f) });
      }, 1000);
    }
  }

  document.addEventListener('click', () => {
    if (menuOpen) {
      closeMenu();
      render();
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && menuOpen) {
      closeMenu();
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
