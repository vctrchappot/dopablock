'use strict';
// Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/lib/presets.js');
const DB = require('../src/lib/engine.js');

const rulesWith = (presets, custom = []) => DB.buildRules({ presets, custom });
const ev = (rules, url, extra = {}, now) => DB.evaluate({ rules, settings: {}, usage: {}, snoozes: {}, ...extra }, url, now);

test('TikTok: only the FYP is matched, profiles and search stay free', () => {
  const rules = rulesWith({ 'tiktok:fyp': { mode: 'block' } });
  for (const u of ['https://www.tiktok.com/', 'https://www.tiktok.com/foryou', 'https://www.tiktok.com/en', 'https://www.tiktok.com/de-DE/', 'https://www.tiktok.com/en/foryou?lang=en']) {
    assert.equal(ev(rules, u).blocked?.rule.id, 'tiktok:fyp', u);
  }
  for (const u of ['https://www.tiktok.com/@someone', 'https://www.tiktok.com/search?q=x', 'https://www.tiktok.com/@someone/video/123', 'https://www.tiktok.com/following']) {
    assert.equal(ev(rules, u).blocked, null, u);
  }
});

test('Instagram: reels (incl. profile reels) but not posts or DMs', () => {
  const rules = rulesWith({ 'instagram:reels': { mode: 'block' } });
  for (const u of ['https://www.instagram.com/reels/', 'https://www.instagram.com/reels/abc/', 'https://www.instagram.com/reel/XYZ/', 'https://www.instagram.com/someone/reels/']) {
    assert.ok(ev(rules, u).blocked, u);
  }
  for (const u of ['https://www.instagram.com/', 'https://www.instagram.com/p/abc/', 'https://www.instagram.com/direct/inbox/', 'https://www.instagram.com/someone/']) {
    assert.equal(ev(rules, u).blocked, null, u);
  }
});

test('YouTube Shorts: path blocked, shelves hidden, normal watch page untouched', () => {
  const rules = rulesWith({ 'youtube:shorts': { mode: 'block' } });
  assert.ok(ev(rules, 'https://www.youtube.com/shorts/abc123').blocked);
  const home = ev(rules, 'https://www.youtube.com/');
  assert.equal(home.blocked, null);
  assert.ok(home.hide.includes('ytd-reel-shelf-renderer'));
  assert.equal(ev(rules, 'https://www.youtube.com/watch?v=abc').blocked, null);
  assert.ok(ev(rules, 'https://m.youtube.com/shorts/abc').blocked, 'subdomains match');
});

test('hide-only sections never block but hide', () => {
  const rules = rulesWith({ 'youtube:recs': { mode: 'block' } });
  const r = ev(rules, 'https://www.youtube.com/watch?v=1');
  assert.equal(r.blocked, null);
  assert.ok(r.hide.includes('#related'));
});

test('hosts do not match lookalikes', () => {
  const rules = rulesWith({ 'tiktok:all': { mode: 'block' } });
  assert.equal(ev(rules, 'https://nottiktok.com/').blocked, null);
  assert.equal(ev(rules, 'https://tiktok.com.evil.test/').blocked, null);
  assert.ok(ev(rules, 'https://tiktok.com/').blocked);
});

test('track mode counts time but never blocks', () => {
  const rules = rulesWith({ 'youtube:shorts': { mode: 'track' } });
  const r = ev(rules, 'https://www.youtube.com/shorts/a');
  assert.equal(r.blocked, null);
  assert.deepEqual(r.track, ['youtube:shorts']);
  assert.deepEqual(r.hide, []);
});

test('limit mode blocks once the daily allowance is used', () => {
  const rules = rulesWith({ 'youtube:shorts': { mode: 'limit', limitMin: 10 } });
  const url = 'https://www.youtube.com/shorts/a';
  assert.equal(ev(rules, url, { usage: { 'youtube:shorts': 599 } }).blocked, null);
  const hit = ev(rules, url, { usage: { 'youtube:shorts': 600 } });
  assert.equal(hit.blocked.reason, 'limit');
  assert.equal(hit.blocked.limit, 600);
});

test('snooze and pause suspend enforcement but keep counting', () => {
  const rules = rulesWith({ 'tiktok:all': { mode: 'block' } });
  const now = Date.now();
  const snoozed = ev(rules, 'https://tiktok.com/', { snoozes: { 'tiktok:all': now + 60000 } }, now);
  assert.equal(snoozed.blocked, null);
  assert.deepEqual(snoozed.track, ['tiktok:all']);
  const paused = ev(rules, 'https://tiktok.com/', { settings: { pausedUntil: now + 1000 } }, now);
  assert.equal(paused.blocked, null);
});

test('schedule: weekday office hours and overnight windows', () => {
  const office = { days: [1, 2, 3, 4, 5], start: '09:00', end: '17:00' };
  assert.equal(DB.isScheduleActive(office, new Date(2026, 10, 18, 10, 0)), true); // Wed
  assert.equal(DB.isScheduleActive(office, new Date(2026, 10, 18, 17, 0)), false);
  assert.equal(DB.isScheduleActive(office, new Date(2026, 10, 21, 10, 0)), false); // Sat
  const night = { days: [5], start: '22:00', end: '06:00' }; // Friday night
  assert.equal(DB.isScheduleActive(night, new Date(2026, 10, 20, 23, 0)), true); // Fri 23:00
  assert.equal(DB.isScheduleActive(night, new Date(2026, 10, 21, 5, 0)), true); // Sat 05:00 (still Friday's window)
  assert.equal(DB.isScheduleActive(night, new Date(2026, 10, 21, 23, 0)), false); // Sat 23:00
  assert.equal(DB.isScheduleActive(null, new Date()), true);
});

test('schedule outside its window → allowed', () => {
  const rules = rulesWith({ 'tiktok:all': { mode: 'block', schedule: { days: [1], start: '09:00', end: '10:00' } } });
  const mondayNine = new Date(2026, 10, 16, 9, 30).getTime();
  const mondayNoon = new Date(2026, 10, 16, 12, 0).getTime();
  assert.ok(ev(rules, 'https://tiktok.com/', {}, mondayNine).blocked);
  assert.equal(ev(rules, 'https://tiktok.com/', {}, mondayNoon).blocked, null);
});

test('custom rules: whole site with exceptions, regex and bad regex', () => {
  const rules = rulesWith({}, [
    { id: 'c1', name: 'News', hosts: ['news.example.com'], paths: ['/*'], exclude: ['/weather/*'], mode: 'block' },
    { id: 'c2', name: 'Bad', hosts: ['bad.example'], paths: ['re:('], mode: 'block' },
  ]);
  assert.ok(ev(rules, 'https://news.example.com/politics').blocked);
  assert.equal(ev(rules, 'https://news.example.com/weather/today').blocked, null);
  assert.equal(ev(rules, 'https://bad.example/anything').blocked, null, 'invalid regex must not throw or match');
});

test('block beats limit when both match; non-http URLs are ignored', () => {
  const rules = rulesWith({ 'youtube:shorts': { mode: 'limit', limitMin: 1 }, 'youtube:all': { mode: 'block' } });
  const r = ev(rules, 'https://www.youtube.com/shorts/a', { usage: { 'youtube:shorts': 100 } });
  assert.equal(r.blocked.reason, 'block');
  assert.equal(ev(rules, 'chrome://extensions').blocked, null);
  assert.equal(ev(rules, 'not a url').blocked, null);
});

test('pattern syntax', () => {
  const m = DB.patternMatches;
  assert.ok(m('/shorts/*', '/shorts'));
  assert.ok(m('/shorts/*', '/shorts/x/y'));
  assert.ok(!m('/shorts/*', '/shortsy'));
  assert.ok(m('/explore*', '/explorer'));
  assert.ok(m('/', '/'));
  assert.ok(!m('/', '/a'));
  assert.ok(m('/a', '/a/'));
  assert.ok(m('re:^/x/\\d+$', '/x/12'));
});
