'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { I18N } = require('../src/lib/i18n.js');

const root = path.join(__dirname, '..', 'src');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (p.endsWith('.js') && !p.includes(path.join('src', 'lib', 'i18n.js'))) files.push(p);
  }
})(root);

test('en and de define the same keys', () => {
  assert.deepEqual(Object.keys(I18N.en).sort(), Object.keys(I18N.de).sort());
});

test('every t("key") used in the code exists', () => {
  const used = new Set();
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    for (const m of src.matchAll(/\bt\('([a-zA-Z0-9_.]+)'\s*[,)]/g)) used.add(m[1]);
  }
  // keys built dynamically in the UI
  for (const m of ['off', 'track', 'limit', 'block']) used.add('mode.' + m);
  for (let d = 0; d < 7; d++) used.add('day.' + d);
  for (const n of ['overview', 'rules', 'settings']) used.add('nav.' + n);
  const missing = [...used].filter((k) => !(k in I18N.en) || !(k in I18N.de));
  assert.deepEqual(missing, []);
  assert.ok(used.size > 60, 'sanity: scanned many keys, got ' + used.size);
});

test('placeholders match between languages', () => {
  const vars = (s) => (typeof s === 'string' ? [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',') : '');
  for (const k of Object.keys(I18N.en)) assert.equal(vars(I18N.en[k]), vars(I18N.de[k]), k);
});
