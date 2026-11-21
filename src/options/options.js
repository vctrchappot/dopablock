(function () {
  'use strict';
  const DB = globalThis.DopaBlock;
  const { h, t, icon } = DB;

  const mainEl = document.getElementById('main');
  const sideEl = document.getElementById('side');
  const dialog = document.getElementById('editor');

  const VIEWS = ['overview', 'rules', 'settings'];
  let view = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
  let state = null;
  let query = '';
  let editing = false; // dialog open → don't re-render underneath

  /* ───────────── data ───────────── */

  async function reload() {
    state = await DB.loadAll();
    DB.applyAppearance(state.config.settings);
    document.title = 'Dopablock – ' + t('nav.' + view);
    render();
  }
  const save = () => DB.saveConfig(state.config);

  function toast(msg) {
    const el = h('div', { class: 'toast', role: 'status' }, msg);
    document.body.append(el);
    setTimeout(() => el.remove(), 2400);
  }

  /* ───────────── small widgets ───────────── */

  function stepper(value, min, max, step, onChange) {
    const input = h('input', { type: 'number', min, max, step, value, 'aria-label': t('edit.limit') });
    const clamp = (v) => Math.max(min, Math.min(max, Math.round(Number(v) || min)));
    const commit = (v) => {
      input.value = clamp(v);
      onChange(clamp(v));
    };
    input.addEventListener('change', () => commit(input.value));
    return h(
      'div',
      { class: 'stepper' },
      h('button', { type: 'button', 'aria-label': '−', onclick: () => commit(Number(input.value) - step) }, '−'),
      input,
      h('button', { type: 'button', 'aria-label': '+', onclick: () => commit(Number(input.value) + step) }, '+')
    );
  }

  function field(label, control, help) {
    return h('div', { class: 'field' }, h('label', null, label), control, help ? h('div', { class: 'help' }, help) : null);
  }

  const modeOptions = (rule) =>
    DB.allowedModes(rule).map((m) => ({ value: m, label: t('mode.' + m), tone: DB.MODE_TONE[m] === 'gray' ? 'gray' : DB.MODE_TONE[m] }));

  /* ───────────── sidebar ───────────── */

  function renderSide() {
    const rules = DB.buildRules(state.config);
    const active = rules.filter((r) => r.mode !== 'off').length;
    const s = state.config.settings;
    const paused = s.pausedUntil > Date.now();
    const left = Math.max(0, Math.ceil((s.pausedUntil - Date.now()) / 60000));

    const nav = [
      ['overview', 'chart'],
      ['rules', 'list'],
      ['settings', 'sliders'],
    ].map(([id, ic]) =>
      h(
        'a',
        {
          href: '#' + id,
          class: view === id ? 'active' : '',
          'aria-current': view === id ? 'page' : false,
          onclick: (e) => {
            e.preventDefault();
            go(id);
          },
        },
        icon(ic, 18),
        t('nav.' + id)
      )
    );

    sideEl.replaceChildren(
      h('div', { class: 'logo', html: DB.LOGO_SVG + '<span>Dopablock</span>' }),
      h('nav', { class: 'nav' }, nav),
      h(
        'div',
        { class: 'side-status' + (paused ? ' paused' : '') },
        h('div', { class: 'st' }, h('i'), paused ? t('nav.status.paused', { t: left + ' min' }) : t('nav.status.active')),
        h('small', null, t('nav.status.activeRules', { n: active })),
        paused
          ? h(
              'button',
              {
                class: 'btn',
                onclick: async () => {
                  state.config.settings.pausedUntil = 0;
                  await save();
                },
              },
              icon('play', 15),
              t('popup.resume')
            )
          : null
      )
    );
  }

  function go(id) {
    view = id;
    history.replaceState(null, '', '#' + id);
    document.title = 'Dopablock – ' + t('nav.' + id);
    render();
    window.scrollTo({ top: 0 });
  }

  /* ───────────── overview ───────────── */

  function hairline(day) {
    const max = Math.max(60, ...day.hours);
    const nowH = new Date().getHours();
    return day.hours.map((v, i) => {
      const b = h('b', { class: (v ? '' : 'zero ') + (i === nowH ? 'now' : ''), title: v ? i + ':00 · ' + DB.fmtDuration(v) : i + ':00' });
      if (v) b.style.setProperty('--h', Math.max(6, (v / max) * 96) + 'px');
      return b;
    });
  }

  function bigNumber(total) {
    const { h: hh, m: mm } = DB.fmtDuration(total, { parts: true });
    if (total >= 3600) return [String(hh), h('small', null, 'h'), String(mm).padStart(2, '0'), h('small', null, 'm')];
    if (total >= 60) return [String(mm), h('small', null, 'min')];
    return [String(Math.round(total)), h('small', null, 'sec')];
  }

  function renderOverview() {
    const rules = DB.buildRules(state.config);
    const day = DB.todayUsage(state.usage);
    const activeCount = rules.filter((r) => r.mode !== 'off').length;

    // last 7 days
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const u = state.usage[DB.dayKey(d)];
      days.push({ date: d, total: (u && u.total) || 0, today: i === 0 });
    }
    const weekTotal = days.reduce((a, b) => a + b.total, 0);
    const weekMax = Math.max(60, ...days.map((d) => d.total));
    const avg = weekTotal / 7;

    const week = h(
      'div',
      { class: 'week', role: 'img', 'aria-label': t('ov.week') },
      days.map((d) =>
        h(
          'div',
          { class: 'col' + (d.today ? ' today' : ''), title: DB.fmtDuration(d.total) },
          h('div', { class: 'track' }, d.total ? h('em', null, DB.minutesLabel(d.total)) : null, h('i', { style: { height: Math.max(0, (d.total / weekMax) * 82) + '%' } })),
          h('span', null, d.today ? t('ov.todayLabel') : t('day.' + d.date.getDay()))
        )
      )
    );

    const top = Object.entries(day.rules || {})
      .map(([id, sec]) => ({ rule: rules.find((r) => r.id === id), sec }))
      .filter((x) => x.rule && x.sec > 0)
      .sort((a, b) => b.sec - a.sec)
      .slice(0, 6);
    const topMax = top.length ? top[0].sec : 1;

    const topList = top.length
      ? h(
          'div',
          { class: 'toplist' },
          top.map(({ rule, sec }) =>
            h(
              'div',
              { class: 'top-row' },
              DB.siteTile(rule.hosts[0], rule.siteName, 38),
              h(
                'div',
                { class: 'tr-main' },
                h('div', { class: 't' }, h('span', null, rule.id.endsWith(':all') || rule.custom ? rule.name : rule.siteName + ' · ' + rule.name), h('span', null, DB.fmtDuration(sec))),
                DB.progress(sec / topMax, 'blue')
              )
            )
          )
        )
      : h('div', { class: 'muted', style: { padding: '8px 2px' } }, t('ov.topEmpty'));

    const nodes = [];
    nodes.push(h('div', { class: 'page-head' }, h('div', null, h('h1', null, t('ov.title')), h('p', null, t('ov.sub')))));

    if (!activeCount) {
      nodes.push(
        h(
          'div',
          { class: 'callout' },
          h('span', { class: 'tile' }, icon('shield', 22)),
          h('div', null, h('h3', null, t('ov.getStarted')), h('p', null, t('ov.getStartedText'))),
          h('button', { class: 'btn primary', onclick: () => go('rules') }, t('nav.rules'), icon('arrowRight', 16))
        )
      );
    }

    nodes.push(
      h(
        'div',
        { class: 'grid' },
        h(
          'section',
          { class: 'card stat big span2' },
          h('div', { class: 'stat-row' }, h('span', { class: 'label' }, h('i'), t('ov.today')), h('span', { class: 'tag tone-gray' }, t('ov.avg', { t: DB.fmtDuration(avg) }))),
          h('div', { class: 'value' }, bigNumber(day.total || 0)),
          h('div', { class: 'hairline' }, hairline(day)),
          h('div', { class: 'axis' }, t('popup.hourAxis').map((x) => h('span', null, x)))
        ),
        h(
          'div',
          { style: { display: 'grid', gap: '18px' } },
          h('section', { class: 'card stat' }, h('span', { class: 'label' }, t('ov.blocks')), h('div', { class: 'value' }, String(day.blocks || 0)), h('div', { class: 'hint' }, t('ov.blocksHint'))),
          h('section', { class: 'card stat' }, h('span', { class: 'label' }, t('ov.active')), h('div', { class: 'value' }, String(activeCount)), h('div', { class: 'hint' }, t('ov.activeHint')))
        ),
        h(
          'section',
          { class: 'card panel span2' },
          h('div', { class: 'panel-head' }, h('h2', null, t('ov.week')), h('span', { class: 'tag tone-blue' }, t('ov.weekTotal', { t: DB.fmtDuration(weekTotal) }))),
          week
        ),
        h('section', { class: 'card panel' }, h('div', { class: 'panel-head' }, h('h2', null, t('ov.top'))), topList)
      )
    );
    return nodes;
  }

  /* ───────────── rules ───────────── */

  function ruleRowEl(rule, day) {
    const used = (day.rules && day.rules[rule.id]) || 0;
    const ctrl = h('div', { class: 'ctrl' });

    if (rule.mode === 'limit') {
      ctrl.append(
        stepper(rule.limitMin, 1, 1440, 5, async (v) => {
          DB.patchRule(state.config, rule, { limitMin: v });
          await save();
        }),
        h('span', { class: 'unit' }, 'min')
      );
    }
    ctrl.append(
      DB.segmented(modeOptions(rule), rule.mode, async (mode) => {
        DB.patchRule(state.config, rule, { mode });
        await save();
      })
    );
    ctrl.append(
      h(
        'button',
        { class: 'iconbtn', title: rule.custom ? t('rules.edit') : t('edit.schedule'), 'aria-label': t('rules.edit') + ': ' + rule.name, onclick: () => openEditor(rule) },
        icon(rule.custom ? 'pencil' : 'calendar', 17)
      )
    );

    const tags = [];
    if (!rule.paths.length) tags.push(h('span', { class: 'tag tone-purple' }, t('rules.hidesOnly')));
    if (rule.schedule && rule.mode !== 'off') tags.push(h('span', { class: 'tag tone-gray' }, icon('calendar', 13), DB.describeScheduleText(rule.schedule)));
    if (rule.mode === 'limit' && used) tags.push(h('span', { class: 'tag tone-orange' }, DB.fmtDuration(used)));
    if (rule.mode === 'track' && used) tags.push(h('span', { class: 'tag tone-blue' }, DB.fmtDuration(used)));

    return h(
      'div',
      { class: 'orow' },
      h('div', { class: 'info' }, h('div', { class: 'n' }, rule.name, tags), h('div', { class: 'd' }, rule.custom ? rule.hosts.join(', ') + ' · ' + (rule.paths.join('  ') || '—') : DB.loc(rule.desc))),
      ctrl
    );
  }

  function renderRules() {
    const rules = DB.buildRules(state.config);
    const day = DB.todayUsage(state.usage);
    const q = query.trim().toLowerCase();
    const match = (r) => !q || (r.siteName + ' ' + r.name + ' ' + r.hosts.join(' ') + ' ' + DB.loc(r.desc)).toLowerCase().includes(q);

    const groups = [];
    for (const site of DB.SITES) {
      const own = rules.filter((r) => r.siteId === site.id);
      const shown = own.filter(match);
      if (!shown.length) continue;
      const activeN = own.filter((r) => r.mode !== 'off').length;
      groups.push(
        h(
          'section',
          { class: 'card group' },
          h(
            'div',
            { class: 'group-head' },
            DB.siteTile(site.hosts[0], site.name, 42),
            h('div', null, h('strong', null, site.name), h('small', null, site.hosts.join(' · '))),
            activeN ? h('span', { class: 'tag tone-blue' }, t('rules.activeCount', { n: activeN })) : null
          ),
          shown.map((r) => ruleRowEl(r, day))
        )
      );
    }

    const custom = rules.filter((r) => r.custom);
    const customShown = custom.filter(match);
    const customCard = h(
      'section',
      { class: 'card group' },
      h(
        'div',
        { class: 'group-head' },
        h('span', { class: 'tile', style: { width: '42px', height: '42px' } }, icon('globe', 20)),
        h('div', null, h('strong', null, t('rules.customTitle'))),
        h('button', { class: 'btn', style: { marginLeft: 'auto' }, onclick: () => openEditor(null) }, icon('plus', 16), t('rules.new'))
      ),
      customShown.length ? customShown.map((r) => ruleRowEl(r, day)) : q ? null : h('div', { class: 'custom-empty' }, t('rules.customEmpty'))
    );

    const search = h('input', { class: 'input', type: 'search', placeholder: t('rules.search'), value: query, 'aria-label': t('rules.search') });
    search.addEventListener('input', () => {
      query = search.value;
      const pos = search.selectionStart;
      render();
      const again = mainEl.querySelector('input[type=search]');
      if (again) {
        again.focus();
        again.setSelectionRange(pos, pos);
      }
    });

    return [
      h(
        'div',
        { class: 'page-head' },
        h('div', null, h('h1', null, t('rules.title')), h('p', null, t('rules.sub'))),
        h('div', { class: 'toolbar' }, h('div', { class: 'search' }, icon('search', 17), search), h('button', { class: 'btn primary', onclick: () => openEditor(null) }, icon('plus', 16), t('rules.new')))
      ),
      groups,
      groups.length || customShown.length ? null : h('div', { class: 'card custom-empty' }, t('rules.none')),
      !q || customShown.length ? customCard : null,
    ];
  }

  /* ───────────── editor dialog ───────────── */

  function parseLines(s) {
    return String(s || '')
      .split(/\r?\n/)
      .map((x) => x.trim())
      .filter(Boolean);
  }

  function normalizeHost(x) {
    return x.replace(/^[a-z]+:\/\//i, '').replace(/[/?#].*$/, '').replace(/^www\./i, '').toLowerCase();
  }

  function normalizePattern(p) {
    if (p.startsWith('re:') || p.startsWith('/') || p === '*') return p;
    return '/' + p;
  }

  function openEditor(rule) {
    const isNew = !rule;
    const isCustom = isNew || rule.custom;
    const base = rule || { id: DB.uid(), custom: true, name: '', hosts: [], paths: ['/*'], exclude: [], hide: [], mode: 'block', limitMin: 30, schedule: null, desc: null };
    const draft = {
      name: base.name,
      hosts: base.hosts.join('\n'),
      paths: base.paths.join('\n'),
      exclude: (base.exclude || []).join('\n'),
      hide: (base.hide || []).join('\n'),
      mode: base.mode === 'off' && isNew ? 'block' : base.mode,
      limitMin: base.limitMin,
      scheduleOn: !!base.schedule,
      days: base.schedule && base.schedule.days && base.schedule.days.length ? base.schedule.days.slice() : [1, 2, 3, 4, 5],
      start: (base.schedule && base.schedule.start) || '09:00',
      end: (base.schedule && base.schedule.end) || '17:00',
    };

    const body = h('div', { class: 'editor-body' });
    const errBox = h('div', { class: 'err', hidden: true, role: 'alert' });

    const mk = (key, rows, ph) => {
      const ta = h('textarea', { class: 'textarea', rows, placeholder: ph || '', spellcheck: 'false' });
      ta.value = draft[key];
      ta.addEventListener('input', () => {
        draft[key] = ta.value;
        if (key === 'paths' || key === 'hide') renderModes();
      });
      return ta;
    };

    const modeHost = h('div');
    const limitHost = h('div');
    const schedHost = h('div', { style: { display: 'grid', gap: '12px' } });

    const ruleLike = () => ({ paths: isCustom ? parseLines(draft.paths) : base.paths });

    function renderModes() {
      const allowed = DB.allowedModes(ruleLike()).filter((m) => m !== 'off' || !isCustom);
      if (!allowed.includes(draft.mode)) draft.mode = allowed.includes('block') ? 'block' : allowed[0];
      const opts = allowed.map((m) => ({ value: m, label: t('mode.' + m), tone: DB.MODE_TONE[m] }));
      if (isCustom && !isNew) opts.unshift({ value: 'off', label: t('mode.off'), tone: 'gray' });
      modeHost.replaceChildren(
        DB.segmented(opts, draft.mode, (m) => {
          draft.mode = m;
          renderModes();
        })
      );
      limitHost.replaceChildren(
        draft.mode === 'limit'
          ? field(t('edit.limit'), h('div', { class: 'row2' }, stepper(draft.limitMin, 1, 1440, 5, (v) => (draft.limitMin = v)), h('span', { class: 'muted' }, t('edit.limitUnit'))))
          : ''
      );
    }

    function renderSchedule() {
      const sw = h('input', { type: 'checkbox', checked: draft.scheduleOn, 'aria-label': t('edit.schedule') });
      sw.addEventListener('change', () => {
        draft.scheduleOn = sw.checked;
        renderSchedule();
      });
      const head = h(
        'div',
        { class: 'row2', style: { justifyContent: 'space-between' } },
        h('div', null, h('div', { class: 'label' }, t('edit.schedule')), h('div', { class: 'help' }, t('edit.scheduleHelp'))),
        h('label', { class: 'switch' }, sw, h('span'))
      );
      const parts = [head];
      if (draft.scheduleOn) {
        const order = [1, 2, 3, 4, 5, 6, 0];
        parts.push(
          h(
            'div',
            { class: 'chips', role: 'group' },
            order.map((d) =>
              h(
                'button',
                {
                  type: 'button',
                  class: 'chip' + (draft.days.includes(d) ? ' on' : ''),
                  'aria-pressed': String(draft.days.includes(d)),
                  onclick: () => {
                    draft.days = draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d];
                    renderSchedule();
                  },
                },
                t('day.' + d)
              )
            )
          ),
          h(
            'div',
            { class: 'times' },
            field(t('edit.from'), h('input', { class: 'input', type: 'time', value: draft.start, onchange: (e) => (draft.start = e.target.value || '00:00') })),
            field(t('edit.to'), h('input', { class: 'input', type: 'time', value: draft.end, onchange: (e) => (draft.end = e.target.value || '24:00') }))
          )
        );
      }
      schedHost.replaceChildren(...parts);
    }

    if (isCustom) {
      const nameInput = h('input', { class: 'input', value: draft.name, placeholder: t('edit.namePh') });
      nameInput.addEventListener('input', () => (draft.name = nameInput.value));
      body.append(
        field(t('edit.name'), nameInput),
        field(t('edit.hosts'), mk('hosts', 3, t('edit.hostsPh')), t('edit.hostsHelp')),
        field(t('edit.paths'), mk('paths', 3, '/*'), t('edit.pathsHelp')),
        field(t('edit.exclude'), mk('exclude', 2, '/weather/*'), t('edit.excludeHelp')),
        field(t('edit.hide'), mk('hide', 2, '[data-testid="sidebar"]'), t('edit.hideHelp'))
      );
    } else {
      body.append(
        h('div', { class: 'row2' }, DB.siteTile(base.hosts[0], base.siteName, 42), h('div', null, h('strong', null, base.siteName + ' · ' + base.name), h('div', { class: 'help' }, DB.loc(base.desc)))),
        field(
          t('edit.matches'),
          h('div', { class: 'matches' }, base.paths.length ? base.paths.map((p) => h('code', null, p.length > 44 ? p.slice(0, 42) + '…' : p)) : h('code', null, t('edit.hostOnly')))
        )
      );
    }

    body.append(field(t('edit.mode'), modeHost), limitHost, h('hr', { class: 'dashed' }), schedHost, errBox);
    renderModes();
    renderSchedule();

    const showErr = (msg) => {
      errBox.textContent = msg;
      errBox.hidden = !msg;
    };

    async function onSave() {
      let patch;
      if (isCustom) {
        const hosts = [...new Set(parseLines(draft.hosts).map(normalizeHost).filter(Boolean))];
        if (!hosts.length) return showErr(t('edit.errHosts'));
        const paths = parseLines(draft.paths).map(normalizePattern);
        const hide = parseLines(draft.hide);
        if (!paths.length && !hide.length) return showErr(t('edit.errPaths'));
        const exclude = parseLines(draft.exclude).map(normalizePattern);
        for (const p of [...paths, ...exclude]) {
          if (p.startsWith('re:')) {
            try {
              new RegExp(p.slice(3));
            } catch (_) {
              return showErr(t('edit.errRegex', { s: p.slice(3) }));
            }
          }
        }
        for (const sel of hide) {
          try {
            document.createDocumentFragment().querySelector(sel);
          } catch (_) {
            return showErr(t('edit.errSelector', { s: sel }));
          }
        }
        patch = { name: draft.name.trim() || hosts[0], hosts, paths, exclude, hide };
      } else patch = {};

      let mode = draft.mode;
      if (!DB.allowedModes(ruleLike()).includes(mode)) mode = 'block';
      Object.assign(patch, {
        mode,
        limitMin: Math.max(1, Math.round(draft.limitMin) || 30),
        schedule: draft.scheduleOn ? { days: draft.days.length ? draft.days : [0, 1, 2, 3, 4, 5, 6], start: draft.start, end: draft.end } : null,
      });

      if (isNew) state.config.custom.push(Object.assign({ id: base.id }, patch));
      else DB.patchRule(state.config, rule, patch);
      await save();
      dialog.close();
    }

    dialog.replaceChildren(
      h(
        'form',
        {
          class: 'editor',
          method: 'dialog',
          onsubmit: (e) => {
            e.preventDefault();
            onSave();
          },
        },
        h(
          'div',
          { class: 'editor-head' },
          h('h2', null, isNew ? t('edit.titleNew') : t('edit.titleEdit')),
          h('button', { type: 'button', class: 'iconbtn', 'aria-label': t('edit.cancel'), onclick: () => dialog.close() }, icon('x', 17))
        ),
        body,
        h(
          'div',
          { class: 'editor-foot' },
          isCustom && !isNew
            ? h(
                'button',
                {
                  type: 'button',
                  class: 'btn danger',
                  onclick: async () => {
                    if (!confirm(t('edit.confirmDelete'))) return;
                    state.config.custom = state.config.custom.filter((c) => c.id !== rule.id);
                    await save();
                    dialog.close();
                  },
                },
                icon('trash', 16),
                t('edit.delete')
              )
            : null,
          h('span', { class: 'spacer' }),
          h('button', { type: 'button', class: 'btn', onclick: () => dialog.close() }, t('edit.cancel')),
          h('button', { type: 'submit', class: 'btn primary' }, t('edit.save'))
        )
      )
    );
    editing = true;
    dialog.showModal();
  }

  dialog.addEventListener('close', () => {
    editing = false;
    render();
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });

  /* ───────────── settings ───────────── */

  function renderSettings() {
    const s = state.config.settings;
    const update = async (patch) => {
      Object.assign(state.config.settings, patch);
      await save();
    };

    const themeSeg = DB.segmented(
      [
        { value: 'system', label: t('set.theme.system') },
        { value: 'light', label: t('set.theme.light') },
        { value: 'dark', label: t('set.theme.dark') },
      ],
      s.theme,
      (v) => update({ theme: v })
    );
    const langSeg = DB.segmented(
      [
        { value: 'auto', label: t('set.language.auto') },
        { value: 'en', label: 'English' },
        { value: 'de', label: 'Deutsch' },
      ],
      s.language,
      (v) => update({ language: v })
    );

    const strict = h('input', { type: 'checkbox', checked: !!s.strict, 'aria-label': t('set.strict') });
    strict.addEventListener('change', () => update({ strict: strict.checked }));

    const fileInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || typeof data !== 'object' || !data.config || typeof data.config !== 'object') throw new Error('bad');
        await chrome.storage.local.set({ config: data.config, usage: data.usage && typeof data.usage === 'object' ? data.usage : {} });
        toast(t('set.imported'));
      } catch (_) {
        toast(t('set.importFail'));
      }
      fileInput.value = '';
    });

    const exportBackup = async () => {
      const all = await DB.loadAll();
      const blob = new Blob([JSON.stringify({ app: 'dopablock', version: 1, config: all.config, usage: all.usage }, null, 2)], { type: 'application/json' });
      const a = h('a', { href: URL.createObjectURL(blob), download: 'dopablock-backup-' + DB.dayKey(new Date()) + '.json' });
      document.body.append(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
        a.remove();
      }, 500);
    };

    return [
      h('div', { class: 'page-head' }, h('div', null, h('h1', null, t('set.title')), h('p', null, t('set.sub')))),
      h(
        'section',
        { class: 'card panel' },
        h('div', { class: 'panel-head' }, h('h2', null, t('set.appearance'))),
        h('div', { class: 'setrow' }, h('div', null, h('div', { class: 't' }, t('set.theme'))), themeSeg),
        h('div', { class: 'setrow' }, h('div', null, h('div', { class: 't' }, t('set.language'))), langSeg)
      ),
      h(
        'section',
        { class: 'card panel' },
        h('div', { class: 'panel-head' }, h('h2', null, t('set.willpower'))),
        h(
          'div',
          { class: 'setrow' },
          h('div', null, h('div', { class: 't' }, t('set.friction')), h('div', { class: 'd' }, t('set.frictionHelp'))),
          h('div', { class: 'row2' }, stepper(s.friction, 0, 60, 5, (v) => update({ friction: v })), h('span', { class: 'muted' }, 's'))
        ),
        h(
          'div',
          { class: 'setrow' },
          h('div', null, h('div', { class: 't' }, t('set.snooze')), h('div', { class: 'd' }, t('set.snoozeHelp'))),
          h('div', { class: 'row2' }, stepper(s.snoozeMinutes, 1, 120, 1, (v) => update({ snoozeMinutes: v })), h('span', { class: 'muted' }, 'min'))
        ),
        h('div', { class: 'setrow' }, h('div', null, h('div', { class: 't' }, t('set.strict')), h('div', { class: 'd' }, t('set.strictHelp'))), h('label', { class: 'switch' }, strict, h('span')))
      ),
      h(
        'section',
        { class: 'card panel' },
        h('div', { class: 'panel-head' }, h('h2', null, t('set.data'))),
        h('p', { class: 'muted', style: { marginBottom: '16px' } }, t('set.dataHelp')),
        h(
          'div',
          { class: 'btnrow' },
          h('button', { class: 'btn', onclick: exportBackup }, icon('download', 16), t('set.export')),
          h('button', { class: 'btn', onclick: () => fileInput.click() }, icon('upload', 16), t('set.import')),
          fileInput,
          h(
            'button',
            {
              class: 'btn danger',
              onclick: async () => {
                if (confirm(t('set.confirmUsage'))) await chrome.storage.local.set({ usage: {} });
              },
            },
            icon('trash', 16),
            t('set.resetUsage')
          ),
          h(
            'button',
            {
              class: 'btn danger',
              onclick: async () => {
                if (confirm(t('set.confirmAll'))) await chrome.storage.local.clear();
              },
            },
            t('set.resetAll')
          )
        )
      ),
      h('p', { class: 'about' }, t('set.about') + '  ·  v' + (chrome.runtime.getManifest ? chrome.runtime.getManifest().version : ''))
    ];
  }

  /* ───────────── render ───────────── */

  function render() {
    if (!state || editing) return;
    renderSide();
    let content;
    if (view === 'rules') content = renderRules();
    else if (view === 'settings') content = renderSettings();
    else content = renderOverview();
    const keep = window.scrollY;
    mainEl.replaceChildren(...content.flat(Infinity).filter(Boolean));
    window.scrollTo({ top: keep });
  }

  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (VIEWS.includes(id) && id !== view) go(id);
  });

  chrome.storage.onChanged.addListener(DB.debounce(reload, 80));
  setInterval(() => {
    // refresh clocks (paused countdown, hour marker) while the tab is visible
    if (document.visibilityState === 'visible' && !editing && state && view === 'overview') reload();
  }, 30000);

  reload();
})();
