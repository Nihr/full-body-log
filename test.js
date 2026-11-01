// Tests for the progression rule, history formatting, saved data, the programme and the service worker list.
// Run with: node test.js   (no dependencies)
// After editing PROGRAMME run `node test.js programme`: it runs only the checks that hold for
// any programme (typos in PROGRAMME, the service worker file list). The full run also pins
// today's targets and increments, so tests naming an exercise you changed on purpose fail.
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = require('./app.js');
const { EX, progression, fmtSets, lastFor, nextDay, buildSession, mergeSessions, parseNum, targetText, cleanSession, parseBackup, newDraft, cleanDraftSet, toggleSet, fmtDate,
  exerciseFor, PROGRAMME, SETS, fmtTime, mmss, weightText, esc, ago, lastDone, sortSessions } = app;

const ONLY = process.argv[2] === 'programme' ? ['Programme', 'Service worker'] : null;
let passed = 0, failed = 0, group = '';
function section(name) { group = name; if (!ONLY || ONLY.includes(name)) console.log(name); }
function test(name, fn) {
  if (ONLY && !ONLY.includes(group)) return;
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (e) { failed++; console.log('  FAIL ' + name + '\n       ' + e.message); }
}
const sets = (w, ...reps) => reps.map(r => ({ w, r }));
const last = s => ({ ts: 1, sets: s });

section('Progression');
test('all three sets hit target: add the increment', () => {
  assert.deepStrictEqual(progression(EX.squat, last(sets(60, 10, 10, 10))), { w: 65, add: true });
});
test('one set short: keep the weight', () => {
  assert.deepStrictEqual(progression(EX.squat, last(sets(60, 10, 10, 9))), { w: 60, add: false });
});
test('fewer than three sets logged: keep the weight', () => {
  assert.deepStrictEqual(progression(EX.bench, last(sets(50, 10, 10))), { w: 50, add: false });
});
test('more reps than target still counts', () => {
  assert.deepStrictEqual(progression(EX.bench, last(sets(50, 12, 11, 10))), { w: 52.5, add: true });
});
test('deadlift uses its own target of 6', () => {
  assert.deepStrictEqual(progression(EX.deadlift, last(sets(100, 6, 6, 6))), { w: 105, add: true });
  assert.deepStrictEqual(progression(EX.deadlift, last(sets(100, 6, 6, 5))), { w: 100, add: false });
});
test('no previous session: weight empty', () => {
  assert.deepStrictEqual(progression(EX.squat, null), { w: null, add: false });
});
test('fractional increments do not drift', () => {
  assert.deepStrictEqual(progression(EX.ohext, last(sets(17.5, 10, 10, 10))), { w: 20, add: true });
  assert.strictEqual(progression(EX.latraise, last(sets(7.1, 10, 10, 10))).w, 8.1);
});
test('mixed weights use the heaviest set', () => {
  assert.deepStrictEqual(progression(EX.squat, last([{ w: 60, r: 10 }, { w: 62.5, r: 10 }, { w: 62.5, r: 8 }])), { w: 62.5, add: false });
});
test('pull-ups: under 10 on any set, stay at bodyweight', () => {
  assert.deepStrictEqual(progression(EX.pullups, last(sets(0, 10, 9, 8))), { w: 0, add: false });
});
test('pull-ups: 10 on all sets prompts +2.5 kg', () => {
  assert.deepStrictEqual(progression(EX.pullups, last(sets(0, 10, 10, 12))), { w: 2.5, add: true });
});
test('added exercise with no weight recorded counts as 0', () => {
  assert.deepStrictEqual(progression(EX.dips, last(sets(null, 10, 10, 10))), { w: 2.5, add: true });
  assert.deepStrictEqual(progression(EX.dips, last(sets(null, 8, 8, 8))), { w: 0, add: false });
});
test('exercises without a weight field never prefill', () => {
  assert.deepStrictEqual(progression(EX.legraise, last(sets(null, 15, 12, 10))), { w: null, add: false });
  assert.deepStrictEqual(progression(EX.abwheel, last(sets(null, 10, 10, 10))), { w: null, add: false });
});
test('lastFor finds the most recent session containing the exercise', () => {
  const sessions = [
    { id: 'b', day: 'B', ts: 3, sets: { legpress: sets(100, 10, 10, 10) } },
    { id: 'a2', day: 'A', ts: 2, sets: { bench: sets(50, 10, 10, 10) } },
    { id: 'a1', day: 'A', ts: 1, sets: { squat: sets(60, 10, 10, 10), bench: sets(45, 10, 10, 10) } }
  ];
  assert.strictEqual(lastFor(sessions, 'bench').sets[0].w, 50);
  assert.strictEqual(lastFor(sessions, 'squat').ts, 1);
  assert.strictEqual(lastFor(sessions, 'deadlift'), null);
});

section('History formatting');
test('same weight collapses', () => {
  assert.strictEqual(fmtSets(EX.squat, sets(60, 10, 10, 9)), '60 kg · 10, 10, 9');
});
test('different weights list each set', () => {
  assert.strictEqual(fmtSets(EX.squat, [{ w: 60, r: 10 }, { w: 62.5, r: 10 }, { w: 65, r: 8 }]), '60×10, 62.5×10, 65×8');
});
test('bodyweight exercise at 0 kg', () => {
  assert.strictEqual(fmtSets(EX.pullups, sets(0, 10, 8, 7)), 'bodyweight · 10, 8, 7');
  assert.strictEqual(fmtSets(EX.pullups, sets(null, 6, 5)), 'bodyweight · 6, 5');
});
test('bodyweight exercise with weight added', () => {
  assert.strictEqual(fmtSets(EX.dips, sets(5, 10, 10, 10)), '+5 kg · 10, 10, 10');
  assert.strictEqual(fmtSets(EX.dips, [{ w: 0, r: 10 }, { w: 2.5, r: 8 }]), 'bw×10, +2.5×8');
});
test('no weight field shows reps only', () => {
  assert.strictEqual(fmtSets(EX.legraise, sets(null, 15, 12, 9)), '15, 12, 9');
});
test('fewer than three sets', () => {
  assert.strictEqual(fmtSets(EX.bench, sets(50, 10)), '50 kg · 10');
});
test('targets', () => {
  assert.strictEqual(targetText(EX.squat), '3 × 10');
  assert.strictEqual(targetText(EX.legraise), '3 × max');
  assert.strictEqual(targetText(EX.pullups), '3 × max, add weight at 10');
});

section('Sessions');
test('rotation: A, then B, C, back to A', () => {
  assert.strictEqual(nextDay([]), 'A');
  assert.strictEqual(nextDay([{ day: 'A' }]), 'B');
  assert.strictEqual(nextDay([{ day: 'C' }, { day: 'B' }]), 'A');
});
test('finish keeps only sets with reps and dates by start time', () => {
  const draft = { day: 'A', started: Date.UTC(2026, 9, 30, 17, 0), sets: {
    squat: [{ w: 60, r: 10, done: true }, { w: 60, r: null, done: false }, { w: 60, r: 0, done: true }],
    bench: [{ w: 50, r: null }, { w: null, r: null }, { w: null, r: null }],
    legraise: [{ w: null, r: 12 }, { w: null, r: null }, { w: null, r: null }]
  } };
  const s = buildSession(draft, Date.UTC(2026, 9, 30, 18, 15));
  assert.strictEqual(s.ts, draft.started);
  assert.strictEqual(s.date, '2026-10-30T17:00:00.000Z');
  assert.deepStrictEqual(s.sets, { squat: [{ w: 60, r: 10 }], legraise: [{ w: null, r: 12 }] });
});
test('finish with nothing logged returns null', () => {
  assert.strictEqual(buildSession({ day: 'B', started: 1, sets: { legpress: [{ w: 100, r: null }] } }), null);
});
test('import merges by id and never duplicates', () => {
  const have = [{ id: 'x', day: 'A', ts: 10, date: '', sets: { squat: sets(60, 10) } }];
  const file = [
    { id: 'x', day: 'A', ts: 10, sets: { squat: sets(60, 10) } },
    { id: 'y', day: 'B', ts: 20, sets: { legpress: sets(100, 10) } },
    { id: 'y', day: 'B', ts: 20, sets: { legpress: sets(100, 10) } },
    { nonsense: true }
  ];
  const r = mergeSessions(have, file);
  assert.deepStrictEqual([r.added, r.skipped, r.invalid], [1, 2, 1]);
  assert.deepStrictEqual(r.sessions.map(s => s.id), ['y', 'x']);
});
test('decimal input accepts comma or point', () => {
  assert.strictEqual(parseNum('62,5'), 62.5);
  assert.strictEqual(parseNum('62.5'), 62.5);
  assert.strictEqual(parseNum(''), null);
  assert.strictEqual(parseNum('abc'), null);
});

section('Saved data and backups');
test('a day no longer in the programme is kept; a known day keeps its spelling', () => {
  const one = day => cleanSession({ id: 'x', day, ts: 1, sets: { squat: sets(60, 10) } });
  assert.strictEqual(one('D').day, 'D');
  assert.strictEqual(one('b').day, 'B');
  assert.strictEqual(one(' C ').day, 'C');
  assert.strictEqual(one(''), null);
  assert.strictEqual(one(undefined), null);
  assert.strictEqual(one('X'.repeat(21)), null);
  assert.strictEqual(nextDay([{ day: 'D', ts: 2 }]), 'A');
  assert.strictEqual(nextDay([{ day: 'D', ts: 3 }, { day: 'B', ts: 2 }, { day: 'A', ts: 1 }]), 'C');
});
test('timestamps outside 1970 to 2100 are rejected, never thrown', () => {
  const ok = { id: 'ok', day: 'A', ts: 1000, sets: { squat: sets(60, 10) } };
  const at = ts => Object.assign({}, ok, { id: 'b' + ts, ts });
  [1e16, 1e20, -1e16, -1, 1761926400000000, Date.UTC(2100, 0, 1)].forEach(ts => assert.strictEqual(cleanSession(at(ts)), null, String(ts)));
  assert.strictEqual(cleanSession(at(Date.UTC(2099, 11, 31))).date, '2099-12-31T00:00:00.000Z');
  const r = mergeSessions([], [ok, at(1e16), at(2000)]);
  assert.deepStrictEqual([r.added, r.skipped, r.invalid], [2, 0, 1]);
});
test('half reps count down, not up', () => {
  const s = cleanSession({ id: 'x', day: 'A', ts: 1, sets: { bench: [{ w: 50, r: 10 }, { w: 50, r: 9.5 }, { w: 50, r: 0.5 }] } });
  assert.deepStrictEqual(s.sets.bench, [{ w: 50, r: 10 }, { w: 50, r: 9 }]);
});
test('backup files: parse and clean', () => {
  assert.deepStrictEqual(parseBackup('[]'), []);
  assert.throws(() => parseBackup('{}'), /No sessions in file/);
  assert.throws(() => parseBackup('null'), /No sessions in file/);
  assert.throws(() => parseBackup('not json'), SyntaxError);
  assert.deepStrictEqual(cleanSession({ id: 'a', day: 'b', date: '2026-10-30T17:00:00.000Z', sets: { legpress: [{ w: 100, r: '10' }, { w: 'x', r: 8 }, { w: 100, r: 0 }, null, { w: 100 }], junk: 'no' } }),
    { id: 'a', day: 'B', ts: Date.UTC(2026, 9, 30, 17), date: '2026-10-30T17:00:00.000Z', sets: { legpress: [{ w: 100, r: 10 }, { w: null, r: 8 }] } });
  assert.strictEqual(cleanSession({ day: 'A', ts: 1, sets: { squat: sets(60, 10) } }), null);
  assert.strictEqual(cleanSession({ id: 'x', day: 'A', ts: 1, sets: { squat: [] } }), null);
  assert.strictEqual(cleanSession({ id: 'x', day: 'A', date: 'yesterday', sets: { squat: sets(60, 10) } }), null);
});
test('a finished session survives the clean on the next load, and export then import gives it back', () => {
  const s = buildSession({ day: 'C', started: Date.UTC(2026, 9, 30, 17), sets: { deadlift: sets(100, 6, 6, 5), pullups: [{ w: null, r: 10 }, { w: 2.5, r: 8 }], abwheel: sets(null, 10, 9) } }, Date.UTC(2026, 9, 30, 18));
  assert.match(s.id, /^s[0-9a-z]+$/);
  assert.deepStrictEqual(cleanSession(s), s);
  const S = mergeSessions([], [s, buildSession({ day: 'B', started: 2000, sets: { legpress: sets(100, 10) } }, 2001)]).sessions;
  const file = JSON.stringify({ app: 'full-body-log', format: 1, exported: new Date(4000).toISOString(), sessions: S }, null, 1);
  const r = mergeSessions([], parseBackup(file));
  assert.deepStrictEqual(r.sessions, S);
  assert.deepStrictEqual([r.added, r.skipped, r.invalid], [2, 0, 0]);
});
test('import keeps the session already here on an id clash, newest first', () => {
  const have = [{ id: 'old', day: 'A', ts: 1, date: '', sets: { squat: sets(60, 10) } }, { id: 'x', day: 'B', ts: 5, date: '', sets: { legpress: sets(90, 10) } }];
  const m = mergeSessions(have, [{ id: 'x', day: 'B', ts: 5, sets: { legpress: sets(200, 10) } }, { id: 'n', day: 'C', ts: 9, sets: { deadlift: sets(100, 6) } }]);
  assert.deepStrictEqual(m.sessions.map(x => x.id), ['n', 'x', 'old']);
  assert.strictEqual(m.sessions[1].sets.legpress[0].w, 90);
});

section('Workout');
test('Done fills the target reps and copies the weight down to empty weight fields', () => {
  const arr = [{ w: 60, r: null, done: false }, { w: null, r: null, done: false }, { w: 70, r: null, done: false }];
  assert.deepStrictEqual(toggleSet(EX.squat, arr, 0), { reps: true, focusReps: false, copied: [1] });
  assert.deepStrictEqual(arr, [{ w: 60, r: 10, done: true, auto: true }, { w: 60, r: null, done: false }, { w: 70, r: null, done: false }]);
});
test('undoing Done clears the reps it filled in, but keeps reps you typed and copied weights', () => {
  const arr = [{ w: 60, r: null, done: false }, { w: null, r: 8, done: false }, { w: null, r: null, done: false }];
  toggleSet(EX.squat, arr, 0); toggleSet(EX.squat, arr, 0);
  assert.deepStrictEqual(arr[0], { w: 60, r: null, done: false });
  assert.deepStrictEqual(arr.map(s => s.w), [60, 60, 60]);
  toggleSet(EX.squat, arr, 1); toggleSet(EX.squat, arr, 1);
  assert.deepStrictEqual(arr[1], { w: 60, r: 8, done: false });
});
test('a mis-tapped Done that is undone is not saved and does not add weight', () => {
  const d = newDraft('A', [], 1);
  d.sets.squat[0].w = 60;
  [0, 1, 2, 2].forEach(i => toggleSet(EX.squat, d.sets.squat, i));
  const s = buildSession(d, 5);
  assert.deepStrictEqual(s.sets.squat, [{ w: 60, r: 10 }, { w: 60, r: 10 }]);
  assert.deepStrictEqual(progression(EX.squat, lastFor([s], 'squat')), { w: 60, add: false });
});
test('Done on a failure exercise with empty reps asks for them; no weight field means no copy', () => {
  const p = [{ w: 0, r: null, done: false }, { w: null, r: null, done: false }, { w: null, r: null, done: false }];
  assert.deepStrictEqual(toggleSet(EX.pullups, p, 0), { reps: false, focusReps: true, copied: [1, 2] });
  assert.deepStrictEqual(p[0], { w: 0, r: null, done: true });
  const a = [{ w: 5, r: null, done: false }, { w: null, r: null, done: false }];
  assert.deepStrictEqual(toggleSet(EX.abwheel, a, 0), { reps: true, focusReps: false, copied: [] });
  assert.strictEqual(a[1].w, null);
});
test('Done leaves a field holding unreadable text alone', () => {
  const r = [{ w: 60, r: null, bad: { r: '8-' }, done: false }, { w: null, r: null, done: false }, { w: null, r: null, done: false }];
  assert.deepStrictEqual(toggleSet(EX.squat, r, 0), { reps: false, focusReps: true, copied: [1, 2] });
  assert.strictEqual(r[0].r, null);
  assert.strictEqual(buildSession({ day: 'A', started: 1, sets: { squat: r } }, 2), null);
  const w = [{ w: 100, r: null, done: false }, { w: null, r: null, bad: { w: '102,,5' }, done: false }, { w: null, r: null, done: false }];
  assert.deepStrictEqual(toggleSet(EX.legpress, w, 0).copied, [2]);
  assert.deepStrictEqual(w.map(s => s.w), [100, null, 100]);
});
test('unreadable text survives a reload until a number replaces it', () => {
  assert.deepStrictEqual(cleanDraftSet({ w: null, r: null, bad: { w: '62,,5', r: 7 }, done: false }), { w: null, r: null, done: false, bad: { w: '62,,5' } });
  assert.deepStrictEqual(cleanDraftSet({ w: 60, r: 8, bad: { w: 'x', r: 'y' }, done: true }), { w: 60, r: 8, done: true });
  assert.deepStrictEqual(cleanDraftSet({ w: null, r: null, bad: { w: '  ' } }), { w: null, r: null, done: false });
});
test('the auto mark survives a reload only while the reps are there', () => {
  assert.deepStrictEqual(cleanDraftSet({ w: 60, r: 10, done: true, auto: true }), { w: 60, r: 10, done: true, auto: true });
  assert.deepStrictEqual(cleanDraftSet({ w: 60, r: null, done: false, auto: true }), { w: 60, r: null, done: false });
  assert.deepStrictEqual(cleanDraftSet({ w: -5, r: '8' }), { w: null, r: null, done: false });
});
test('a new workout prefills every weight field and freezes the Add weight value', () => {
  const d = newDraft('A', [{ id: 'a', day: 'A', ts: 1, sets: { squat: sets(60, 10, 10, 10), bench: sets(50, 10, 10, 9) } }], 2);
  assert.strictEqual(d.started, 2);
  assert.deepStrictEqual(d.sets.squat.map(s => s.w), [65, 65, 65]);
  assert.deepStrictEqual(d.sets.bench.map(s => s.w), [50, 50, 50]);
  assert.deepStrictEqual(d.sets.row.map(s => s.w), [null, null, null]);
  assert.deepStrictEqual(d.add, { squat: 65 });
  assert.deepStrictEqual(newDraft('C', [{ id: 'c', day: 'C', ts: 1, sets: { pullups: sets(0, 10, 10, 10) } }], 2).add, { pullups: 2.5 });
});
test('weights and reps: plain numbers only', () => {
  assert.strictEqual(parseNum(' 62,5 '), 62.5);
  assert.strictEqual(parseNum('62,'), 62);
  assert.strictEqual(parseNum(',5'), 0.5);
  assert.strictEqual(parseNum('+2.5'), 2.5);
  assert.strictEqual(parseNum('0'), 0);
  assert.strictEqual(parseNum(60), 60);
  assert.strictEqual(parseNum(null), null);
  assert.strictEqual(parseNum(undefined), null);
  ['.', '62,,5', '62..5', '62,5,', '62.5kg', '1e3', '-10', '6O'].forEach(v => assert.strictEqual(parseNum(v), null, v));
});

section('Dates');
test('a date from another year adds the year without a comma', () => {
  const y = new Date().getFullYear();
  assert.match(fmtDate(new Date(y, 0, 15, 12).getTime()), /^[A-Z][a-z]{2} 15 Jan$/);
  assert.match(fmtDate(new Date(y - 1, 9, 30, 17).getTime()), new RegExp('^[A-Z][a-z]{2} 30 Oct ' + (y - 1) + '$'));
  assert.match(fmtDate(new Date(y + 1, 2, 1, 12).getTime()), new RegExp('^[A-Z][a-z]{2} 1 Mar ' + (y + 1) + '$'));
});

section('More progression and history');
test('more progression cases', () => {
  assert.deepStrictEqual(progression(EX.pullups, last(sets(2.5, 10, 10, 10))), { w: 5, add: true });
  assert.deepStrictEqual(progression(EX.pullups, last(sets(0, 10, 10, 10))), { w: 2.5, add: true });
  assert.deepStrictEqual(progression(EX.squat, last(sets(null, 10, 10, 10))), { w: null, add: false });
  assert.deepStrictEqual(progression(EX.squat, last([{ w: 60, r: 10 }, { w: 62.5, r: 10 }, { w: 62.5, r: 10 }])), { w: 67.5, add: true });
  assert.deepStrictEqual(progression(EX.dips, last([{ w: null, r: 10 }, { w: 2.5, r: 10 }, { w: 2.5, r: 10 }])), { w: 5, add: true });
  assert.strictEqual(lastFor([{ id: 'n', day: 'A', ts: 2, sets: { squat: [] } }, { id: 'o', day: 'A', ts: 1, sets: { squat: sets(60, 10) } }], 'squat').ts, 1);
  assert.strictEqual(lastFor([{ id: 'x', day: 'A', ts: 1 }], 'squat'), null);
});
test('every weighted exercise goes up by its own increment', () => {
  Object.keys(EX).forEach(k => {
    const ex = EX[k];
    if (ex.load === 'none') return;
    const t = typeof ex.reps === 'number' ? ex.reps : ex.goal;
    assert.deepStrictEqual(progression(ex, last(sets(20, t, t, t))), { w: 20 + ex.inc, add: true }, k);
    assert.deepStrictEqual(progression(ex, last(sets(20, t, t, t - 1))), { w: 20, add: false }, k);
  });
});
test('more history formatting', () => {
  assert.strictEqual(fmtSets(EX.bench, sets(62.5, 10, 10, 9)), '62.5 kg · 10, 10, 9');
  assert.strictEqual(fmtSets(EX.latraise, sets(7.1 + 1, 10, 10, 10)), '8.1 kg · 10, 10, 10');
  assert.strictEqual(fmtSets(EX.latraise, [{ w: 0.1 + 0.2, r: 10 }, { w: 1, r: 10 }]), '0.3×10, 1×10');
  assert.strictEqual(fmtSets(EX.squat, sets(null, 10, 10)), '10, 10');
  assert.strictEqual(fmtSets(EX.squat, [{ w: 60, r: 10 }, { w: null, r: 8 }]), '60×10, 8');
  assert.strictEqual(fmtSets(EX.dips, [{ w: null, r: 10 }, { w: 0, r: 9 }]), 'bodyweight · 10, 9');
  assert.strictEqual(fmtSets(EX.pullups, [{ w: null, r: 10 }, { w: 2.5, r: 8 }]), 'bw×10, +2.5×8');
  assert.strictEqual(fmtSets(EX.abwheel, sets(5, 10, 10, 10)), '10, 10, 10');
  assert.strictEqual(exerciseFor('oldkey').name, 'oldkey');
  assert.strictEqual(fmtSets(exerciseFor('oldkey'), sets(60, 10, 10)), '60 kg · 10, 10');
  assert.strictEqual(targetText(EX.deadlift), '3 × 6');
  assert.strictEqual(targetText(EX.abwheel), '3 × 10');
});
test('badge, timer, time and escaping helpers', () => {
  assert.strictEqual(weightText(EX.squat, 65), '65 kg');
  assert.strictEqual(weightText(EX.pullups, 2.5), '+2.5 kg');
  assert.strictEqual(weightText(EX.latraise, 7.1 + 1), '8.1 kg');
  assert.deepStrictEqual([0, 5, 59, 60, 90, 150, 600].map(mmss), ['0:00', '0:05', '0:59', '1:00', '1:30', '2:30', '10:00']);
  assert.strictEqual(fmtTime(new Date(2026, 9, 30, 7, 5).getTime()), '07:05');
  assert.strictEqual(ago(Date.now()), 'today');
  const daysAgo = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - n); return d.getTime(); };
  assert.strictEqual(ago(daysAgo(1)), 'yesterday');
  assert.strictEqual(ago(daysAgo(7)), '7 days ago');
  assert.strictEqual(esc('<b a="1">&'), '&lt;b a=&quot;1&quot;&gt;&amp;');
  assert.strictEqual(esc("it's"), 'it&#39;s');
});
test('finish: bodyweight saves 0, no-weight exercises save no weight, exercises not on the day are dropped', () => {
  assert.deepStrictEqual(buildSession({ day: 'C', started: 1000, sets: { pullups: [{ w: null, r: 8 }, { w: null, r: null }, { w: null, r: null }] } }, 2000).sets, { pullups: [{ w: 0, r: 8 }] });
  assert.deepStrictEqual(buildSession({ day: 'A', started: 1000, sets: { legraise: [{ w: 5, r: 12 }] } }, 2000).sets, { legraise: [{ w: null, r: 12 }] });
  assert.deepStrictEqual(Object.keys(buildSession({ day: 'A', started: 1000, sets: { squat: sets(60, 10), legpress: sets(100, 10) } }, 2000).sets), ['squat']);
});
test('rotation and lookups', () => {
  assert.strictEqual(nextDay([{ day: 'B', ts: 2 }, { day: 'A', ts: 1 }]), 'C');
  assert.strictEqual(lastDone([{ id: '3', day: 'A', ts: 3 }, { id: '1', day: 'A', ts: 1 }], 'A').id, '3');
  assert.strictEqual(lastDone([{ id: '3', day: 'A', ts: 3 }], 'B'), null);
  assert.deepStrictEqual(sortSessions([{ id: 'a', ts: 1 }, { id: 'b' }, { id: 'c', ts: 9 }]).map(x => x.id), ['c', 'a', 'b']);
});

section('Programme');
test('every exercise is well formed (run this after editing PROGRAMME)', () => {
  assert.strictEqual(SETS, 3);
  assert.strictEqual(new Set(PROGRAMME.map(d => d.day)).size, PROGRAMME.length, 'a day letter repeats');
  const seen = {};
  PROGRAMME.forEach(d => {
    const keys = d.exercises.map(e => e.key);
    assert.strictEqual(new Set(keys).size, keys.length, 'a key repeats on day ' + d.day);
    d.exercises.forEach(e => {
      assert.match(e.key, /^[a-z0-9]+$/, e.key + ': key');
      assert.ok(e.reps === 'failure' || (Number.isInteger(e.reps) && e.reps > 0), e.key + ': reps');
      assert.ok(['weight', 'added', 'none'].includes(e.load), e.key + ': load');
      assert.ok(Number.isInteger(e.rest) && e.rest > 0, e.key + ': rest');
      if (e.load !== 'none') assert.ok(typeof e.inc === 'number' && e.inc > 0, e.key + ': inc');
      if (e.reps === 'failure' && e.load !== 'none') assert.ok(typeof e.goal === 'number' && e.goal > 0, e.key + ': goal');
      const settings = JSON.stringify([e.reps, e.load, e.inc, e.rest, e.goal]);
      if (seen[e.key]) assert.strictEqual(settings, seen[e.key], e.key + ' has different settings on two days');
      seen[e.key] = settings;
    });
  });
});

section('Service worker');
test('the precache list matches the files the app uses', () => {
  const read = f => fs.readFileSync(path.join(__dirname, f), 'utf8');
  const sw = read('sw.js'), html = read('index.html'), manifest = JSON.parse(read('manifest.webmanifest'));
  // Expects SHELL as a plain array of single-quoted strings, the way sw.js writes it now.
  const shell = JSON.parse(sw.match(/const SHELL = (\[[\s\S]*?\]);/)[1].replace(/'/g, '"'));
  shell.filter(u => u !== './').forEach(u => assert.ok(fs.existsSync(path.join(__dirname, u)), 'SHELL lists a missing file: ' + u));
  const local = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u))
    .concat(manifest.icons.map(i => i.src)).map(u => './' + u.replace(/^\.\//, ''));
  local.forEach(u => assert.ok(shell.includes(u), u + ' is not in SHELL in sw.js'));
  const fontCss = sw.match(/const FONT_CSS = '([^']+)'/)[1];
  assert.ok(html.includes('href="' + fontCss + '"'), 'FONT_CSS in sw.js differs from the font link in index.html');
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
