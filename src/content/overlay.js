/*
 * Dopablock – full-page "ticket" overlay shown instead of a blocked page.
 * Lives in a closed shadow root so page CSS cannot touch it.
 */
(function (root) {
  'use strict';
  const DB = root.DopaBlock;
  const { t } = DB;

  const SVG = {
    ban: '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
    timer: '<path d="M10 2h4M12 14l3-3"/><circle cx="12" cy="14" r="8"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  };
  const svg = (name, size) =>
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + SVG[name] + '</svg>';

  const CSS = `
:host{all:initial}
*{box-sizing:border-box}
.scrim{--bg:#f2f2f2;--veil:rgba(244,244,247,.5);--card:#fff;--fg:#171717;--fg2:#4a4a4f;--muted:#8a8a90;--line:rgba(0,0,0,.1);--ink:#1a1a1a;--inkfg:#fff;--soft:#f6f6f6;
  --red-bg:#fde8e8;--red-fg:#c0392b;--pu-bg:#eee8fd;--pu-fg:#6d3be0;--or-bg:#fdeede;--or-fg:#b45309;--gray-bg:#ececec;--gray-fg:#5f5f66;--shadow:0 2px 4px rgba(0,0,0,.04),0 30px 70px -22px rgba(0,0,0,.3);
  position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px;overflow:auto;
  background:var(--bg);color:var(--fg);
  font:14px/1.45 Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI Variable Text","Segoe UI",Roboto,sans-serif;letter-spacing:-.006em;-webkit-font-smoothing:antialiased;
  animation:fade .25s ease}
.scrim.blur{background:var(--veil);-webkit-backdrop-filter:blur(26px) saturate(1.2);backdrop-filter:blur(26px) saturate(1.2)}
.scrim.dark{--bg:#0c0c0c;--veil:rgba(8,8,8,.55);--card:#171717;--fg:#f1f1f1;--fg2:#c6c6cb;--muted:#8b8b92;--line:rgba(255,255,255,.14);--ink:#f4f4f4;--inkfg:#121212;--soft:#202020;
  --red-bg:rgba(239,68,68,.18);--red-fg:#ff8d84;--pu-bg:rgba(139,92,246,.22);--pu-fg:#b9a2ff;--or-bg:rgba(245,158,11,.17);--or-fg:#f7b955;--gray-bg:#272727;--gray-fg:#a8a8af;--shadow:0 2px 4px rgba(0,0,0,.4),0 30px 80px -20px rgba(0,0,0,.8)}
@keyframes fade{from{opacity:0}}
@keyframes rise{from{opacity:0;transform:translateY(14px) scale(.98)}}
.ticket{position:relative;width:min(400px,100%);filter:drop-shadow(0 24px 40px rgba(0,0,0,.16));animation:rise .35s cubic-bezier(.2,.9,.3,1.1)}
.part{position:relative;background:var(--card)}
.part.t{border-radius:30px 30px 0 0;-webkit-mask:radial-gradient(13px at 0 100%,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(13px at 100% 100%,#0000 97%,#000) right/51% 100% no-repeat;mask:radial-gradient(13px at 0 100%,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(13px at 100% 100%,#0000 97%,#000) right/51% 100% no-repeat}
.part.t::after{content:"";position:absolute;left:24px;right:24px;bottom:0;border-top:2px dashed var(--line)}
.part.b{border-radius:0 0 30px 30px;-webkit-mask:radial-gradient(13px at 0 0,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(13px at 100% 0,#0000 97%,#000) right/51% 100% no-repeat;mask:radial-gradient(13px at 0 0,#0000 97%,#000) left/51% 100% no-repeat,radial-gradient(13px at 100% 0,#0000 97%,#000) right/51% 100% no-repeat}
.top{padding:34px 28px 28px;text-align:center}
.icon{display:grid;place-items:center;width:72px;height:72px;margin:0 auto 20px;border-radius:24px;background:var(--tone-bg);color:var(--tone-fg);box-shadow:inset 0 0 0 1px rgba(0,0,0,.04)}
.red{--tone-bg:var(--red-bg);--tone-fg:var(--red-fg)}
.orange{--tone-bg:var(--or-bg);--tone-fg:var(--or-fg)}
.gray{--tone-bg:var(--gray-bg);--tone-fg:var(--gray-fg)}
.purple{--tone-bg:var(--pu-bg);--tone-fg:var(--pu-fg)}
h1{margin:0;font-size:23px;line-height:1.2;font-weight:650;letter-spacing:-.03em}
p{margin:8px 0 0;color:var(--muted);font-size:14.5px}
.tags{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:16px}
.tag{display:inline-flex;align-items:center;height:26px;padding:0 11px;border-radius:999px;font-size:12px;font-weight:600;background:var(--tone-bg);color:var(--tone-fg)}
dl{margin:0;padding:26px 28px 8px;display:grid;gap:14px}
.row{display:flex;justify-content:space-between;align-items:baseline;gap:16px}
dt{font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);font-weight:600}
dd{margin:0;font-weight:600;text-align:right;font-variant-numeric:tabular-nums}
.actions{display:grid;gap:10px;padding:18px 20px 20px}
button{font:inherit;letter-spacing:inherit;cursor:pointer;height:48px;border-radius:16px;border:1px solid var(--line);background:var(--card);color:var(--fg);font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;transition:transform .12s,filter .15s}
button:hover{filter:brightness(.97)}button:active{transform:scale(.98)}
button:focus-visible{outline:2px solid #2563eb;outline-offset:2px}
button.primary{background:var(--ink);color:var(--inkfg);border-color:transparent}
button.link{height:40px;border:0;background:transparent;color:var(--muted);font-weight:600;font-size:13.5px}
button.link:hover{color:var(--fg)}
button.wait{background:var(--or-bg);color:var(--or-fg);border-color:transparent;cursor:default}
.pinbox{display:grid;gap:6px}
.pinbox input{font:inherit;height:48px;border-radius:16px;border:1px solid var(--line);background:var(--soft);color:var(--fg);padding:0 14px;text-align:center;letter-spacing:.35em;font-size:18px;width:100%}
.pinbox input:focus{outline:2px solid #2563eb;outline-offset:2px}
.pinbox .err{color:var(--red-fg);font-size:13px;text-align:center}
.note{text-align:center;color:var(--muted);font-size:12.5px;padding:6px 0 2px}
.brand{position:absolute;left:0;right:0;bottom:22px;display:flex;justify-content:center;align-items:center;gap:8px;color:var(--fg2);font-weight:650;font-size:13px;letter-spacing:-.01em;pointer-events:none}
.brand svg{width:24px;height:15px}
@media (max-height:640px){.brand{display:none}.top{padding-top:24px}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
`;

  function sectionName(rule) {
    return rule.custom || rule.id.endsWith(':all') ? rule.name : rule.siteName + ' ' + rule.name;
  }

  function wantsDark(settings) {
    if (settings.theme === 'dark') return true;
    if (settings.theme === 'light') return false;
    try {
      return matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (_) {
      return false;
    }
  }

  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html !== undefined) n.innerHTML = html;
    return n;
  };
  const text = (tag, cls, str) => {
    const n = el(tag, cls);
    n.textContent = str;
    return n;
  };

  /**
   * decision: { rule, reason: 'block'|'limit'|'focus', used, limit, focusUntil }
   * opts: { settings, scheduleText, onBack(), onClose(), onUnlock(minutes), verifyPin(pin) → Promise<boolean> }
   */
  function createOverlay(decision, opts) {
    const { rule, reason } = decision;
    const settings = opts.settings;
    const isLimit = reason === 'limit';
    const isFocus = reason === 'focus';
    const name = sectionName(rule);
    const site = (location.hostname || '').replace(/^www\./, '');

    const host = document.createElement('div');
    host.id = 'dopablock-host';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;';
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.append(Object.assign(document.createElement('style'), { textContent: CSS }));

    const scrim = el('div', 'scrim ' + (settings.blockStyle === 'solid' ? 'solid' : 'blur') + (wantsDark(settings) ? ' dark' : ''));
    scrim.setAttribute('role', 'alertdialog');
    scrim.setAttribute('aria-modal', 'true');
    scrim.setAttribute('aria-labelledby', 'dpb-title');

    const tone = isFocus ? 'purple' : isLimit ? 'orange' : 'red';
    const ticket = el('div', 'ticket');

    const top = el('div', 'top');
    top.append(el('div', 'icon ' + tone, svg(isFocus ? 'moon' : isLimit ? 'timer' : 'ban', 34)));
    const h1 = text('h1', '', isFocus ? t('block.titleFocus') : isLimit ? t('block.titleLimit') : t('block.titleBlock', { name }));
    h1.id = 'dpb-title';
    top.append(h1, text('p', '', t(isFocus ? 'block.subFocus' : isLimit ? 'block.subLimit' : 'block.subBlock', { name, site })));
    const tags = el('div', 'tags');
    tags.append(text('span', 'tag ' + tone, isFocus ? t('block.tagFocus') : isLimit ? t('block.tagLimit') : t('block.tagBlock')));
    if (rule.schedule && !isFocus) tags.append(text('span', 'tag gray', t('block.tagSchedule')));
    top.append(tags);

    const dl = el('dl');
    const addRow = (k, v) => {
      const r = el('div', 'row');
      const dd = text('dd', '', v);
      r.append(text('dt', '', k), dd);
      dl.append(r);
      return dd;
    };
    addRow(t('block.section'), name);
    let focusCell = null;
    const focusLeft = () => DB.fmtDuration(Math.max(0, (decision.focusUntil - Date.now()) / 1000));
    if (isFocus) {
      focusCell = addRow(t('block.focusLeft'), focusLeft());
    } else if (isLimit) {
      addRow(t('block.used'), DB.fmtDuration(decision.used));
      addRow(t('block.limit'), rule.limitMin + 'm');
      addRow(t('block.resets'), t('block.midnight'));
    } else {
      addRow(t('block.when'), rule.schedule ? opts.scheduleText : t('block.always'));
    }
    const clock = focusCell ? setInterval(() => (focusCell.textContent = focusLeft()), 15000) : null;

    const actions = el('div', 'actions');
    const back = text('button', 'primary', t('block.back'));
    back.addEventListener('click', opts.onBack);
    const close = text('button', '', t('block.close'));
    close.addEventListener('click', opts.onClose);
    actions.append(back, close);

    const minutes = Math.max(1, settings.snoozeMinutes | 0 || 5);
    let timer = null;
    if (isFocus) {
      actions.append(text('div', 'note', t('block.focusNote')));
    } else if (settings.strict) {
      actions.append(text('div', 'note', t('block.strict')));
    } else {
      // idle -> (click) -> waiting -> (countdown over) -> ready -> [pin] -> unlocked
      let phase = 'idle';
      let cancel = null;
      let pinBox = null;
      let pinInput = null;
      let pinErr = null;
      const needsPin = !!settings.pinHash;
      const unlock = text('button', 'link', t('block.unlock', { n: minutes }));
      const reset = () => {
        clearInterval(timer);
        timer = null;
        phase = 'idle';
        unlock.className = 'link';
        unlock.textContent = t('block.unlock', { n: minutes });
        if (cancel) cancel.remove();
        if (pinBox) pinBox.remove();
        cancel = pinBox = pinInput = pinErr = null;
      };
      const ready = () => {
        phase = 'ready';
        unlock.className = 'primary';
        unlock.textContent = t('block.confirm', { n: minutes });
        if (needsPin) {
          pinBox = el('div', 'pinbox');
          pinInput = el('input');
          pinInput.type = 'password';
          pinInput.inputMode = 'numeric';
          pinInput.autocomplete = 'off';
          pinInput.placeholder = t('pin.enter');
          pinInput.setAttribute('aria-label', t('pin.enter'));
          pinErr = text('div', 'err', '');
          pinInput.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Enter') unlock.click();
          });
          pinBox.append(pinInput, pinErr);
          actions.insertBefore(pinBox, unlock);
          pinInput.focus();
        }
      };
      unlock.addEventListener('click', async () => {
        if (phase === 'ready') {
          if (!needsPin) return opts.onUnlock(minutes);
          const ok = await opts.verifyPin(pinInput.value);
          if (ok) return opts.onUnlock(minutes);
          pinErr.textContent = t('pin.wrong');
          pinInput.value = '';
          pinInput.focus();
          return;
        }
        if (phase === 'waiting') return; // the countdown cannot be skipped
        let left = Math.max(0, settings.friction | 0);
        if (!left) return ready();
        phase = 'waiting';
        unlock.className = 'wait';
        unlock.textContent = t('block.breathe', { s: left });
        cancel = text('button', 'link', t('block.cancel'));
        cancel.addEventListener('click', reset);
        actions.append(cancel);
        timer = setInterval(() => {
          left -= 1;
          if (left > 0) {
            unlock.textContent = t('block.breathe', { s: left });
            return;
          }
          clearInterval(timer);
          timer = null;
          ready();
        }, 1000);
      });
      actions.append(unlock);
    }

    const partTop = el('div', 'part t');
    partTop.append(top);
    const partBottom = el('div', 'part b');
    partBottom.append(dl, actions);
    ticket.append(partTop, partBottom);
    const brand = el('div', 'brand', DB.LOGO_MINI + '<span>Dopablock</span>');
    scrim.append(ticket, brand);
    shadow.append(scrim);

    return {
      host,
      destroy() {
        clearInterval(timer);
        clearInterval(clock);
        host.remove();
      },
      focus() {
        try {
          back.focus({ preventScroll: true });
        } catch (_) {}
      },
    };
  }

  DB.LOGO_MINI =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 20" aria-hidden="true"><circle cx="10" cy="10" r="10" fill="currentColor"/><path d="M22 0a10 10 0 0 1 0 20z" fill="#ff62d0"/></svg>';
  DB.createOverlay = createOverlay;
})(typeof globalThis !== 'undefined' ? globalThis : this);
