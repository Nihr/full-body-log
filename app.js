'use strict';

/* ==========================================================================
   Programme
   This is the only place the workouts are defined. Edit freely, then run
   `node test.js programme` to catch typos, update INTRO below if targets changed,
   and bump VERSION in sw.js.

   day    Saved with every session. Adding a day is safe. A renamed or removed
          day keeps its old sessions in History under the old letter, but they
          no longer count for that day's "Last done" or the rotation. Finish or
          discard a workout in progress before renaming or removing its day.
   key    Stable id used in saved data. You can rename `name` at any time. If you
          change `key`, old sessions still show in History under the old key, but
          the workout screen says "First time" and progression starts again.
          A key may sit on more than one day only with identical settings.
   reps   Target reps per set, or 'failure' (no target, log what you got).
   load   'weight' (default) kg on the bar or stack
          'added'  bodyweight exercise, kg added on a belt, 0 = bodyweight
          'none'   no weight field at all
   inc    kg added next time when every set reached the target (leave out for 'none').
   rest   Rest timer in seconds, started when a set is marked done.
   goal   For 'failure' exercises: reps on all sets that trigger "Add weight".
   ========================================================================== */
const SETS = 3;
const PROGRAMME = [
  { day: 'A', exercises: [
    { key: 'squat',    name: 'Squat',             reps: 10, inc: 5,   rest: 150 },
    { key: 'bench',    name: 'Bench press',       reps: 10, inc: 2.5, rest: 150 },
    { key: 'row',      name: 'Machine row',       reps: 10, inc: 5,   rest: 120 },
    { key: 'rdl',      name: 'Romanian deadlift', reps: 10, inc: 5,   rest: 120 },
    { key: 'latraise', name: 'Lateral raise',     reps: 10, inc: 1,   rest: 60 },
    { key: 'curl',     name: 'Barbell curl',      reps: 10, inc: 2.5, rest: 60 },
    { key: 'pushdown', name: 'Triceps pushdown',  reps: 10, inc: 2.5, rest: 60 },
    { key: 'legraise', name: 'Hanging leg raise', reps: 'failure', load: 'none', rest: 60 }
  ] },
  { day: 'B', exercises: [
    { key: 'legpress',  name: 'Leg press',                        reps: 10, inc: 10,  rest: 150 },
    { key: 'incdb',     name: 'Incline dumbbell press',           reps: 10, inc: 2,   rest: 120 },
    { key: 'pulldown',  name: 'Lat pulldown',                     reps: 10, inc: 5,   rest: 120 },
    { key: 'legcurl',   name: 'Lying leg curl',                   reps: 10, inc: 5,   rest: 90 },
    { key: 'dbpress',   name: 'Dumbbell shoulder press',          reps: 10, inc: 2,   rest: 120 },
    { key: 'hammer',    name: 'Hammer curl',                      reps: 10, inc: 2,   rest: 60 },
    { key: 'ohext',     name: 'Overhead cable triceps extension', reps: 10, inc: 2.5, rest: 60 }
  ] },
  { day: 'C', exercises: [
    { key: 'deadlift', name: 'Deadlift',                         reps: 6,  inc: 5,   rest: 180 },
    { key: 'legext',   name: 'Leg extension',                    reps: 10, inc: 5,   rest: 90 },
    { key: 'fly',      name: 'Cable fly or machine chest press', reps: 10, inc: 2.5, rest: 90 },
    { key: 'pullups',  name: 'Pull-ups',                         reps: 'failure', goal: 10, load: 'added', inc: 2.5, rest: 120 },
    { key: 'reardelt', name: 'Rear delt fly',                    reps: 10, inc: 1,   rest: 60 },
    { key: 'incurl',   name: 'Incline dumbbell curl',            reps: 10, inc: 2,   rest: 60 },
    { key: 'dips',     name: 'Dips',                             reps: 10, load: 'added', inc: 2.5, rest: 120 },
    { key: 'abwheel',  name: 'Ab wheel rollout',                 reps: 10, load: 'none', rest: 60 }
  ] }
];
// Shown at the top of the home screen. Update it when you change targets above.
const INTRO = '3 × 10 on everything, deadlift 3 × 6, leg raise and pull-ups to failure. Hit the number on all three sets and the weight goes up next time.';

/* ==========================================================================
   Lookups and constants
   ========================================================================== */
const DAYS = PROGRAMME.map(d => d.day);
const EX = {};
PROGRAMME.forEach(d => d.exercises.forEach(e => {
  e.load = e.load || 'weight';
  e.inc = e.inc || 0;
  e.day = d.day;
  EX[e.key] = e;
}));
const KEYS = { sessions: 'fbl.v1.sessions', draft: 'fbl.v1.draft', meta: 'fbl.v1.meta', view: 'fbl.v1.view', timer: 'fbl.v1.timer' };
const IDLE_REST = 90;

function dayPlan(day) { return PROGRAMME.find(d => d.day === day) || PROGRAMME[0]; }
// Exercises that are no longer in the programme still show up in history.
function exerciseFor(key) { return EX[key] || { key, name: key, reps: 'failure', load: 'weight', inc: 0, rest: IDLE_REST }; }
function targetReps(ex) { return typeof ex.reps === 'number' ? ex.reps : (ex.goal || 0); }

/* ==========================================================================
   Formatting helpers
   ========================================================================== */
/* A plain decimal with a comma or point ("62,5", "62.", ",5"), else null.
   Typos such as "62,,5", "-10" or "1e3" give null rather than a different number. */
function parseNum(v) {
  if (v == null) return null;
  const t = String(v).trim();
  if (!/^\+?(\d+([.,]\d*)?|[.,]\d+)$/.test(t)) return null;
  const n = parseFloat(t.replace(',', '.'));
  return isFinite(n) ? n : null;
}
function round2(n) { return Math.round(n * 100) / 100; }
function fmtW(w) { return w == null ? '' : String(round2(w)); }
/* "Sat 31 Oct", or "Thu 31 Dec 2026" for another year (en-GB adds a comma if asked for the year). */
function fmtDate(ts) {
  const d = new Date(ts), s = d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  return d.getFullYear() !== new Date().getFullYear() ? s + ' ' + d.getFullYear() : s;
}
function fmtTime(ts) { return new Date(ts).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
function ago(ts) {
  const days = Math.round((startOfDay(Date.now()) - startOfDay(ts)) / 86400000);
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : days + ' days ago';
}
function startOfDay(ts) { const d = new Date(ts); d.setHours(0, 0, 0, 0); return d.getTime(); }
function mmss(s) { const m = Math.floor(s / 60), r = s % 60; return m + ':' + (r < 10 ? '0' : '') + r; }
function startedLabel(ts) {
  return new Date(ts).toDateString() === new Date().toDateString() ? 'today ' + fmtTime(ts) : fmtDate(ts) + ' ' + fmtTime(ts);
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function targetText(ex) {
  return SETS + ' × ' + (typeof ex.reps === 'number' ? ex.reps : 'max') + (ex.goal ? ', add weight at ' + ex.goal : '');
}
function weightText(ex, w) {
  return ex.load === 'added' ? '+' + fmtW(w) + ' kg' : fmtW(w) + ' kg';
}

/* One line of sets, e.g. "60 kg · 10, 10, 9" or "60×10, 62.5×10, 65×8". */
function fmtSets(ex, sets) {
  const reps = sets.map(s => s.r).join(', ');
  if (ex.load === 'none') return reps;
  const ws = sets.map(s => ex.load === 'added' ? (s.w || 0) : (s.w == null ? null : s.w));
  if (ws.every(w => w === ws[0])) {
    const w = ws[0];
    const label = ex.load === 'added' ? (w ? '+' + fmtW(w) + ' kg' : 'bodyweight') : (w == null ? '' : fmtW(w) + ' kg');
    return label ? label + ' · ' + reps : reps;
  }
  return sets.map((s, i) => {
    const w = ws[i];
    const label = ex.load === 'added' ? (w ? '+' + fmtW(w) : 'bw') : (w == null ? '' : fmtW(w));
    return (label ? label + '×' : '') + s.r;
  }).join(', ');
}

/* ==========================================================================
   Sessions and the progression rule
   A session is { id, day, ts, date, sets: { exerciseKey: [{ w, r }, ...] } }.
   `sessions` arrays are always kept newest first.
   ========================================================================== */
function sortSessions(list) { return list.sort((a, b) => (b.ts || 0) - (a.ts || 0)); }

function lastFor(sessions, key) {
  for (const s of sessions) {
    const sets = s.sets && s.sets[key];
    if (sets && sets.length) return { ts: s.ts, sets };
  }
  return null;
}
function lastDone(sessions, day) { return sessions.find(s => s.day === day) || null; }
/* The day after the newest session whose day is still in PROGRAMME, else the first day.
   Sessions of a renamed or removed day stay in History but do not move the rotation. */
function nextDay(sessions) {
  const last = sessions.find(s => DAYS.indexOf(s.day) >= 0);
  return last ? DAYS[(DAYS.indexOf(last.day) + 1) % DAYS.length] : DAYS[0];
}

/* Heaviest weight recorded in the last session, null if none. */
function lastWeight(sets) {
  const ws = sets.map(s => s.w).filter(w => typeof w === 'number' && isFinite(w));
  return ws.length ? Math.max.apply(null, ws) : null;
}

/* Prefill for a new workout: { w: weight or null, add: true when going up }. */
function progression(ex, last) {
  if (ex.load === 'none' || !last || !last.sets || !last.sets.length) return { w: null, add: false };
  let w = lastWeight(last.sets);
  if (w == null && ex.load === 'added') w = 0;
  const goal = targetReps(ex);
  const hit = goal > 0 && last.sets.length >= SETS && last.sets.every(s => (s.r || 0) >= goal);
  if (hit && w != null && ex.inc) return { w: round2(w + ex.inc), add: true };
  return { w, add: false };
}

/* Turn a draft into a session. Returns null when nothing was logged. */
function buildSession(draft, now) {
  const sets = {};
  dayPlan(draft.day).exercises.forEach(ex => {
    const arr = (draft.sets[ex.key] || []).filter(s => s.r > 0).map(s => ({
      w: ex.load === 'none' ? null : (s.w == null ? (ex.load === 'added' ? 0 : null) : s.w),
      r: s.r
    }));
    if (arr.length) sets[ex.key] = arr;
  });
  if (!Object.keys(sets).length) return null;
  const ts = draft.started || now || Date.now();
  const id = 's' + (now || Date.now()).toString(36) + Math.random().toString(36).slice(2, 6);
  return { id, day: draft.day, ts, date: new Date(ts).toISOString(), sets };
}

/* ==========================================================================
   Draft rules: the workout in progress
   The browser code keeps the draft in storage and mirrors these changes on screen.
   ========================================================================== */
function emptySets(w) { return Array.from({ length: SETS }, () => ({ w, r: null, done: false })); }

/* A new workout: weights prefilled by the progression rule, "Add weight" values frozen in add. */
function newDraft(day, sessions, now) {
  const d = { v: 1, day, started: now, sets: {}, add: {} };
  dayPlan(day).exercises.forEach(ex => {
    const p = progression(ex, lastFor(sessions, ex.key));
    d.sets[ex.key] = emptySets(p.w);
    if (p.add) d.add[ex.key] = p.w;
  });
  return d;
}

/* A stored draft set made safe. auto marks reps that Done filled in. bad keeps text typed
   into a field that is not a plain number ({ w: '62,,5' }), so it stays on screen, in red,
   until it is corrected; it is never saved in a session. */
function cleanDraftSet(s) {
  const n = v => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : null);
  const c = { w: n(s && s.w), r: n(s && s.r), done: !!(s && s.done) };
  if (s && s.auto && c.r != null) c.auto = true;
  ['w', 'r'].forEach(f => {
    const t = s && s.bad && s.bad[f];
    if (typeof t === 'string' && t.trim() && c[f] == null) (c.bad = c.bad || {})[f] = t;
  });
  return c;
}

/* A field is empty when it holds neither a number nor unreadable text. */
function isEmpty(s, f) { return s[f] == null && !(s.bad && s.bad[f]); }

/* The Done button on set i. Marking fills the target reps into an empty reps field
   (flagged auto) and copies the weight down to later empty weight fields. When the reps
   are still missing (a 'failure' exercise, or text that could not be read) it asks for
   them with focusReps. Unmarking clears reps that marking filled in; reps you typed and
   copied weights stay. Returns what changed so the screen can follow. */
function toggleSet(ex, arr, i) {
  const s = arr[i], out = { reps: false, focusReps: false, copied: [] };
  s.done = !s.done;
  if (s.done) {
    if (isEmpty(s, 'r') && typeof ex.reps === 'number') { s.r = ex.reps; s.auto = true; out.reps = true; }
    else if (s.r == null) out.focusReps = true;
    if (ex.load !== 'none' && s.w != null) {
      for (let j = i + 1; j < arr.length; j++) {
        if (isEmpty(arr[j], 'w')) { arr[j].w = s.w; out.copied.push(j); }
      }
    }
  } else if (s.auto) {
    s.r = null; delete s.auto; out.reps = true;
  }
  return out;
}

/* ==========================================================================
   Backup: validation and merge for imported files
   cleanSession also runs on every load of the stored log, so it must never
   reject a session the app saved itself.
   ========================================================================== */
const MAX_TS = Date.UTC(2100, 0, 1);  // later "dates" are mis-scaled (microseconds) or corrupt
function cleanSession(s) {
  if (!s || typeof s !== 'object' || typeof s.id !== 'string' || !s.id) return null;
  const ts = typeof s.ts === 'number' ? s.ts : Date.parse(s.date);
  // A day in the programme keeps the programme's spelling ('a' becomes 'A'). Any other
  // day is kept as written, so renaming or removing a day never deletes its history.
  const raw = typeof s.day === 'string' || typeof s.day === 'number' ? String(s.day).trim() : '';
  const known = DAYS.find(d => String(d).toUpperCase() === raw.toUpperCase());
  const day = known !== undefined ? known : raw;
  if (!isFinite(ts) || ts < 0 || ts >= MAX_TS || !raw || raw.length > 20 || !s.sets || typeof s.sets !== 'object') return null;
  const sets = {};
  Object.keys(s.sets).forEach(k => {
    const arr = Array.isArray(s.sets[k]) ? s.sets[k] : [];
    const clean = arr
      // Reps are whole numbers and a half rep does not count: 9.5 is stored as 9.
      .map(x => ({ w: x && typeof x.w === 'number' && isFinite(x.w) ? x.w : null, r: Math.floor(Number(x && x.r)) }))
      .filter(x => x.r > 0);
    if (clean.length) sets[k] = clean;
  });
  if (!Object.keys(sets).length) return null;
  return { id: s.id, day, ts, date: new Date(ts).toISOString(), sets };
}
function parseBackup(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : data && Array.isArray(data.sessions) ? data.sessions : null;
  if (!list) throw new Error('No sessions in file');
  return list;
}
function mergeSessions(existing, incoming) {
  const ids = new Set(existing.map(s => s.id));
  const out = existing.slice();
  let added = 0, skipped = 0, invalid = 0;
  incoming.forEach(raw => {
    const s = cleanSession(raw);
    if (!s) { invalid++; return; }
    if (ids.has(s.id)) { skipped++; return; }
    ids.add(s.id); out.push(s); added++;
  });
  return { sessions: sortSessions(out), added, skipped, invalid };
}

/* Node test hook; the browser ignores this. */
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { SETS, PROGRAMME, EX, exerciseFor, parseNum, fmtSets, targetText, progression,
    lastFor, nextDay, buildSession, cleanSession, mergeSessions, parseBackup, newDraft, cleanDraftSet, toggleSet, fmtDate,
    fmtTime, mmss, weightText, esc, ago, lastDone, sortSessions };
}

/* Everything below needs a browser. */
if (typeof document !== 'undefined') (function () {

  /* ========================================================================
     Storage: localStorage, every access wrapped
     ======================================================================== */
  function read(key) { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
  function write(key, val) {
    try {
      if (val == null) localStorage.removeItem(key); else localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch (e) { toast('Could not save. Storage full or blocked.'); return false; }
  }
  function loadSessions() {
    const raw = read(KEYS.sessions);
    return sortSessions(Array.isArray(raw) ? raw.map(cleanSession).filter(Boolean) : []);
  }
  function saveSessions() { return write(KEYS.sessions, state.sessions); }
  function saveDraft() { write(KEYS.draft, state.draft); }
  function meta() { return read(KEYS.meta) || {}; }
  function setMeta(patch) { write(KEYS.meta, Object.assign(meta(), patch)); }
  function rememberView(v) { try { sessionStorage.setItem(KEYS.view, v); } catch (e) {} }
  function recallView() { try { return sessionStorage.getItem(KEYS.view); } catch (e) { return null; } }

  /* ========================================================================
     State and DOM handles
     ======================================================================== */
  const state = { view: 'home', sessions: [], draft: null, menu: false, confirmKey: null, confirmTimer: null, confirmAt: 0 };
  const headEl = document.getElementById('head');
  const main = document.getElementById('main');
  const bar = document.getElementById('bar');
  const toastEl = document.getElementById('toast');
  const srLive = document.getElementById('sr-live');
  const fileInput = document.getElementById('import-file');
  const barProg = bar.querySelector('.bar-prog');
  const timerBtn = bar.querySelector('.timer');
  const tLabel = bar.querySelector('.t-label');
  const tTime = bar.querySelector('.t-time');

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }
  /* Tells screen readers what the screen shows without moving focus. Emptied first so the
     same message is announced again next time. */
  function announce(msg) {
    if (!srLive) return;
    srLive.textContent = '';
    setTimeout(() => { srLive.textContent = msg; }, 50);
  }

  /* ========================================================================
     Draft: the workout in progress, saved on every change
     (newDraft, cleanDraftSet and toggleSet are in the pure part above)
     ======================================================================== */
  /* Keeps an old draft in step with the programme if it was edited. */
  function normalizeDraft() {
    const d = state.draft;
    const sets = {};
    d.add = d.add || {};
    dayPlan(d.day).exercises.forEach(ex => {
      let arr = d.sets && Array.isArray(d.sets[ex.key]) ? d.sets[ex.key].map(cleanDraftSet) : null;
      if (!arr || !arr.length) {
        const p = progression(ex, lastFor(state.sessions, ex.key));
        arr = emptySets(p.w);
        if (p.add) d.add[ex.key] = p.w;
      }
      while (arr.length < SETS) arr.push({ w: null, r: null, done: false });
      sets[ex.key] = arr.slice(0, SETS);
    });
    d.sets = sets;
  }
  function draftCount() {
    let n = 0;
    Object.keys(state.draft.sets).forEach(k => state.draft.sets[k].forEach(s => { if (s.r > 0) n++; }));
    return n;
  }

  /* ========================================================================
     Rest timer and beep
     ======================================================================== */
  const timer = { id: null, end: 0, total: 0, fired: false };
  let actx = null;
  function primeAudio() {
    try {
      if (!actx) actx = new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
    } catch (e) {}
  }
  function beep() {
    try { if (navigator.vibrate) navigator.vibrate([200, 100, 200]); } catch (e) {}
    try {
      if (!actx) return;
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime;
      [[0, 880], [0.28, 1320]].forEach(([off, freq]) => {
        const o = actx.createOscillator(), g = actx.createGain();
        o.frequency.value = freq;
        o.connect(g); g.connect(actx.destination);
        g.gain.setValueAtTime(0.0001, t + off);
        g.gain.exponentialRampToValueAtTime(0.3, t + off + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + off + 0.22);
        o.start(t + off); o.stop(t + off + 0.25);
      });
    } catch (e) {}
  }
  function startTimer(sec) {
    clearInterval(timer.id);
    timer.end = Date.now() + sec * 1000; timer.total = sec; timer.fired = false;
    // Kept for this tab only, so a reload in the middle of a rest carries on counting.
    try { sessionStorage.setItem(KEYS.timer, JSON.stringify({ end: timer.end, total: sec })); } catch (e) {}
    timer.id = setInterval(tick, 250);
    tick();
  }
  function forgetTimer() { try { sessionStorage.removeItem(KEYS.timer); } catch (e) {} }
  function stopTimer() { clearInterval(timer.id); timer.id = null; timer.fired = false; forgetTimer(); paintTimer(0, 0, 'idle'); }
  /* After a reload (Chrome may discard a page in the background), pick up a rest that is
     still running. The beep needs a tap first, so a resumed rest may end with "Go" only. */
  function resumeTimer() {
    let t = null;
    try { t = JSON.parse(sessionStorage.getItem(KEYS.timer)); } catch (e) {}
    const now = Date.now();
    if (!t || !(t.total > 0) || !(t.end > now) || t.end > now + t.total * 1000) { forgetTimer(); return; }
    clearInterval(timer.id);
    timer.end = t.end; timer.total = t.total; timer.fired = false;
    timer.id = setInterval(tick, 250);
    tick();
  }
  function tick() {
    const left = Math.max(0, Math.ceil((timer.end - Date.now()) / 1000));
    if (left <= 0) {
      clearInterval(timer.id); timer.id = null; forgetTimer();
      if (!timer.fired) { timer.fired = true; beep(); announce('Rest over'); }
      paintTimer(0, 100, 'go');
      return;
    }
    paintTimer(left, timer.total ? 100 * (1 - left / timer.total) : 0, 'on');
  }
  function paintTimer(left, pct, mode) {
    barProg.style.width = pct + '%';
    timerBtn.classList.toggle('on', mode === 'on');
    timerBtn.classList.toggle('go', mode === 'go');
    tLabel.textContent = mode === 'go' ? 'Rest over' : 'Rest';
    tTime.textContent = mode === 'go' ? 'Go' : mode === 'on' ? mmss(left) : mmss(IDLE_REST);
    // The spoken name starts with the visible words, so voice control ("tap Go") finds the button.
    const start = 'Tap to start a ' + IDLE_REST + ' second rest';
    timerBtn.setAttribute('aria-label', mode === 'on' ? 'Rest ' + mmss(left) + ' left. Tap to stop.' :
      mode === 'go' ? 'Rest over. Go. ' + start : 'Rest ' + mmss(IDLE_REST) + '. ' + start);
  }

  /* ========================================================================
     Screen wake lock while the workout screen is open
     ======================================================================== */
  let wake = null, wakeReq = null;
  function wakeOn() {
    if (state.view !== 'workout' || wake || wakeReq || !('wakeLock' in navigator)) return;
    try {
      wakeReq = navigator.wakeLock.request('screen').then(l => {
        wakeReq = null;
        if (state.view !== 'workout') { l.release().catch(() => {}); return; }
        wake = l;
        l.addEventListener('release', () => { if (wake === l) wake = null; });
      }).catch(() => { wakeReq = null; });  // refused (battery saver, no permission): carry on without it
    } catch (e) { wakeReq = null; }
  }
  function wakeOff() { try { if (wake) wake.release(); } catch (e) {} wake = null; }
  // What the clock changes on Home and History: "today", "N days ago" and the red backup card.
  let drawnFor = '';
  function clockKey() { const m = meta(); return new Date().toDateString() + (Date.now() - (m.exported || 0) > 14 * 86400000); }
  document.addEventListener('visibilitychange', () => {
    // Back from the background: redraw Home or History only when the date or the backup age
    // changed, so focus is not thrown away for nothing. The workout screen is never redrawn here.
    if (document.visibilityState === 'visible') {
      wakeOn(); if (timer.id) tick();
      if (state.view !== 'workout' && clockKey() !== drawnFor) render();
    }
  });

  /* ========================================================================
     Two tap confirm
     ======================================================================== */
  function confirmStep(btn, key, label) {
    if (state.confirmKey === key) {
      // A second tap within 400 ms is a bounce or a double tap, not a decision: stay armed.
      if (Date.now() - state.confirmAt < 400) return false;
      clearTimeout(state.confirmTimer); state.confirmKey = null; return true;
    }
    resetConfirm();
    state.confirmKey = key;
    state.confirmAt = Date.now();
    btn.dataset.orig = btn.textContent;
    // A button with its own spoken name (History's Delete) speaks the confirm text too.
    if (btn.hasAttribute('aria-label')) { btn.dataset.origLabel = btn.getAttribute('aria-label'); btn.setAttribute('aria-label', label); }
    btn.textContent = label;
    btn.classList.add('confirming');
    state.confirmTimer = setTimeout(resetConfirm, 4000);
    return false;
  }
  function resetConfirm() {
    clearTimeout(state.confirmTimer);
    state.confirmKey = null;
    document.querySelectorAll('.confirming').forEach(b => {
      b.textContent = b.dataset.orig; b.classList.remove('confirming');
      if (b.hasAttribute('data-orig-label')) { b.setAttribute('aria-label', b.dataset.origLabel); b.removeAttribute('data-orig-label'); }
    });
  }

  /* ========================================================================
     Views
     ======================================================================== */
  function go(view, fromHistory) {
    state.view = view; state.menu = false; resetConfirm();
    rememberView(view);
    if (view === 'workout') wakeOn(); else { wakeOff(); stopTimer(); }
    render();
    window.scrollTo(0, 0);
    if (!fromHistory) syncHistory(state.view);  // state.view: render() falls back to home without a draft
  }
  /* Android back. While History or a workout is open there is one browser history entry
     above Home, so the back gesture returns to Home instead of closing the app.
     ownPops counts the popstate events caused by our own history.back(). */
  let ownPops = 0;
  function syncHistory(view) {
    try {
      const cur = history.state && history.state.view;
      if (view === 'home') { if (cur && cur !== 'home' && !ownPops) { ownPops++; history.back(); } }
      else if (cur && cur !== 'home') history.replaceState({ view }, '');
      else { history.replaceState({ view: 'home' }, ''); history.pushState({ view }, ''); }
    } catch (e) {}
  }
  window.addEventListener('popstate', e => {
    // Our own back: Home is showing already, unless a quick tap opened another screen meanwhile.
    if (ownPops) { ownPops--; if (state.view !== 'home') syncHistory(state.view); return; }
    const v = e.state && e.state.view;
    go(v === 'workout' && state.draft ? 'workout' : v === 'history' ? 'history' : 'home', true);
  });
  function render() {
    drawnFor = clockKey();
    if (state.view === 'workout' && state.draft) renderWorkout();
    else if (state.view === 'history') renderHistory();
    else { state.view = 'home'; renderHome(); }
  }

  /* Header and backup menu */
  function renderHead(left, title, right) {
    headEl.innerHTML = '<div class="gutter head-in">' + left + '<h1 class="head-title">' + title + '</h1>' + right + '</div>' + (state.menu ? renderMenu() : '');
  }
  function menuButton() {
    return '<button class="link" type="button" data-act="menu" aria-expanded="' + state.menu + '" aria-controls="menu">Menu</button>';
  }
  function backupStatus() {
    const m = meta();
    return m.exported ? 'Last export ' + fmtDate(m.exported) + ', ' + ago(m.exported) : 'Never exported';
  }
  function renderMenu() {
    const n = state.sessions.length;
    return '<div class="menu gutter" id="menu"><div class="menu-in">' +
      (state.view !== 'history' ? '<button class="menu-row" type="button" data-act="history">History<span class="muted">' + n + ' session' + (n === 1 ? '' : 's') + '</span></button>' : '') +
      '<div class="menu-backup"><div class="eyebrow">Backup</div>' +
      '<p>Your log is stored only in this browser on this phone. Export a backup file regularly and keep it somewhere safe. Import merges a backup in and never creates duplicates.</p>' +
      '<p class="muted menu-stat">' + n + ' session' + (n === 1 ? '' : 's') + ' · ' + backupStatus() + '</p>' +
      '<div class="menu-actions"><button class="primary" type="button" data-act="export">Export backup</button>' +
      '<button class="primary secondary" type="button" data-act="import">Import backup</button></div></div>' +
      '</div></div>';
  }

  function renderHome() {
    renderHead('', 'Full body log', '<button class="link" type="button" data-act="history">History</button>' + menuButton());
    const next = nextDay(state.sessions);
    let html = '<p class="intro">' + esc(INTRO) + '</p>';
    if (state.draft) {
      html += '<section class="card resume"><div><div class="eyebrow">In progress</div><h2>Day ' + esc(state.draft.day) + '</h2>' +
        '<p class="muted">Started ' + startedLabel(state.draft.started) + ' · ' + draftCount() + ' set' + (draftCount() === 1 ? '' : 's') + ' logged</p></div>' +
        '<button class="primary" type="button" data-act="resume">Resume</button></section>';
    }
    PROGRAMME.forEach(d => {
      const last = lastDone(state.sessions, d.day);
      const isNext = d.day === next;
      const isDraft = state.draft && state.draft.day === d.day;
      html += '<section class="card day' + (isNext ? ' is-next' : '') + '"><div class="day-top"><span class="letter" aria-hidden="true">' + d.day + '</span>' +
        '<div><h2>Day ' + d.day + '</h2><p class="muted">' + (last ? 'Last done ' + fmtDate(last.ts) + ', ' + ago(last.ts) : 'Not done yet') + '</p></div>' +
        (isNext ? '<span class="pill">Next up</span>' : '') + '</div>' +
        '<p class="exlist">' + d.exercises.map(e => esc(e.name)).join(', ') + '</p>' +
        '<button class="primary' + (isNext && !state.draft ? '' : ' secondary') + '" type="button" data-act="start" data-day="' + d.day + '">' + (isDraft ? 'Resume' : 'Start') + ' Day ' + d.day + '</button></section>';
    });
    const m = meta();
    const stale = state.sessions.length && (!m.exported || Date.now() - m.exported > 14 * 86400000);
    html += '<section class="card backup' + (stale ? ' is-stale' : '') + '"><div><div class="eyebrow">Backup</div>' +
      '<p class="muted">' + backupStatus() + '. Data lives only on this phone.</p></div>' +
      '<button class="primary secondary" type="button" data-act="export">Export</button></section>';
    main.innerHTML = html;
    bar.hidden = true;
  }

  function renderHistory() {
    renderHead('<button class="link" type="button" data-act="home">Back</button>', 'History', menuButton());
    bar.hidden = true;
    if (!state.sessions.length) {
      main.innerHTML = '<p class="empty">No sessions yet. Finish a workout and it shows up here.</p>';
      return;
    }
    main.innerHTML = state.sessions.map(s => {
      const order = dayPlan(s.day).exercises.map(e => e.key);
      const keys = order.filter(k => s.sets[k]).concat(Object.keys(s.sets).filter(k => order.indexOf(k) < 0));
      let n = 0;
      const rows = keys.map(k => {
        const ex = exerciseFor(k);
        n += s.sets[k].length;
        return '<li><span class="hist-name">' + esc(ex.name) + '</span><span class="nums">' + esc(fmtSets(ex, s.sets[k])) + '</span></li>';
      }).join('');
      return '<section class="card"><div class="hist-top"><span class="letter small"><span class="visually-hidden">Day </span>' + esc(s.day) + '</span>' +
        '<div><h2>' + fmtDate(s.ts) + '</h2><p class="muted">' + fmtTime(s.ts) + ' · ' + n + ' set' + (n === 1 ? '' : 's') + '</p></div>' +
        '<button class="link danger" type="button" data-act="del" data-id="' + esc(s.id) + '" aria-label="Delete Day ' + esc(s.day) + ', ' + fmtDate(s.ts) + ' ' + fmtTime(s.ts) + '">Delete</button></div>' +
        '<ul class="hist-list">' + rows + '</ul></section>';
    }).join('');
  }

  function renderWorkout() {
    normalizeDraft();
    const d = state.draft, day = dayPlan(d.day);
    renderHead('<button class="link" type="button" data-act="home">Back</button>',
      '<span class="letter small" aria-hidden="true">' + day.day + '</span>Day ' + day.day,
      '<button class="link danger" type="button" data-act="discard">Discard</button>');
    main.innerHTML = '<p class="started">Started ' + startedLabel(d.started) + '. Tap Done after each set to start the rest timer. Finish saves the workout under that time.</p>' +
      day.exercises.map(renderExercise).join('');
    bar.hidden = false;
    if (!timer.id && !timer.fired) paintTimer(0, 0, 'idle');
  }
  function renderExercise(ex) {
    const last = lastFor(state.sessions, ex.key);
    const addW = state.draft.add[ex.key];
    const lastTxt = last ? 'Last ' + fmtDate(last.ts) + ' · ' + fmtSets(ex, last.sets) : 'First time';
    const pill = addW != null ? '<span class="pill">Add weight ' + esc(weightText(ex, addW)) + '</span>' : '';
    return '<section class="ex" data-ex="' + ex.key + '"><div class="ex-head"><h2>' + esc(ex.name) + '</h2>' +
      '<div class="ex-meta"><span class="target">' + targetText(ex) + '</span><span class="last">' + esc(lastTxt) + '</span></div>' + pill + '</div>' +
      '<div class="sets">' + state.draft.sets[ex.key].map((s, i) => renderSet(ex, s, i)).join('') + '</div></section>';
  }
  function renderSet(ex, s, i) {
    const id = ex.key + '-' + i;
    const unit = ex.load === 'added' ? '+kg' : 'kg';
    const bad = s.bad || {}, red = f => (bad[f] ? ' aria-invalid="true"' : '');
    const w = ex.load === 'none' ? '' :
      '<label class="field"><input type="text" inputmode="decimal" enterkeyhint="next" id="w-' + id + '" data-f="w" value="' + (bad.w ? esc(bad.w) : fmtW(s.w)) + '"' + red('w') + ' placeholder="' + (ex.load === 'added' ? '0' : '') + '" autocomplete="off" aria-label="' + esc(ex.name) + ', set ' + (i + 1) + ' weight in kg' + (ex.load === 'added' ? ' added' : '') + '"><span>' + unit + '</span></label>';
    const r = '<label class="field"><input type="text" inputmode="numeric" pattern="[0-9]*" enterkeyhint="done" id="r-' + id + '" data-f="r" value="' + (bad.r ? esc(bad.r) : s.r == null ? '' : s.r) + '"' + red('r') + ' placeholder="' + (typeof ex.reps === 'number' ? ex.reps : 'max') + '" autocomplete="off" aria-label="' + esc(ex.name) + ', set ' + (i + 1) + ' reps"><span>reps</span></label>';
    return '<div class="set' + (ex.load === 'none' ? ' noweight' : '') + (s.done ? ' is-done' : '') + '" data-i="' + i + '">' +
      '<span class="n">' + (i + 1) + '</span>' + w + r +
      '<button class="done" type="button" data-act="done" aria-pressed="' + s.done + '" aria-label="' + esc(ex.name) + ', set ' + (i + 1) + ' done">Done</button></div>';
  }

  /* ========================================================================
     Actions
     ======================================================================== */
  function startDay(btn, day) {
    if (state.draft && state.draft.day !== day) {
      if (!confirmStep(btn, 'start' + day, 'Tap again to drop Day ' + state.draft.day)) return;
      state.draft = null;
    }
    if (!state.draft) { state.draft = newDraft(day, state.sessions, Date.now()); saveDraft(); }
    go('workout');
  }
  /* Puts a value the app chose into a field and clears any "could not read" mark. */
  function setField(el, v) { if (el) { el.value = v; el.removeAttribute('aria-invalid'); } }
  function toggleDone(btn) {
    primeAudio();
    const row = btn.closest('.set'), key = btn.closest('.ex').dataset.ex, i = +row.dataset.i;
    // The open day's definition: the same key may also sit on another day.
    const ex = dayPlan(state.draft.day).exercises.find(e => e.key === key) || EX[key];
    const arr = state.draft.sets[key], s = arr[i];
    const ch = toggleSet(ex, arr, i);
    const ri = document.getElementById('r-' + key + '-' + i);
    if (ch.reps) setField(ri, s.r == null ? '' : s.r);
    if (ch.focusReps && ri) ri.focus();
    ch.copied.forEach(j => setField(document.getElementById('w-' + key + '-' + j), fmtW(s.w)));
    if (s.done) startTimer(ex.rest || IDLE_REST);
    row.classList.toggle('is-done', s.done);
    btn.setAttribute('aria-pressed', String(s.done));
    saveDraft();
  }
  function finish() {
    const session = buildSession(state.draft);
    if (!session) { toast('Nothing logged yet. Enter reps for at least one set.'); return; }
    state.sessions = sortSessions(state.sessions.concat([session]));
    if (!saveSessions()) { state.sessions = state.sessions.filter(s => s.id !== session.id); return; }
    state.draft = null;
    write(KEYS.draft, null);
    go('home');
    toast('Saved. Next up: Day ' + nextDay(state.sessions));
  }
  function exportBackup() {
    const now = new Date();
    const payload = { app: 'full-body-log', format: 1, exported: now.toISOString(), sessions: state.sessions };
    try {
      const blob = new Blob([JSON.stringify(payload, null, 1)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const pad = n => (n < 10 ? '0' : '') + n;
      a.href = url;
      a.download = 'full-body-log-' + now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setMeta({ exported: now.getTime() });
      toast('Exported ' + state.sessions.length + ' session' + (state.sessions.length === 1 ? '' : 's'));
      render();
    } catch (e) { toast('Export failed'); }
  }
  function importBackup(file) {
    // Ten years of workouts is about 2 MB, so anything over 10 MB is the wrong file.
    if (file.size > 10 * 1024 * 1024) { toast('That file is too big to be a backup'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const r = mergeSessions(state.sessions, parseBackup(String(reader.result)));
        const before = state.sessions;
        state.sessions = r.sessions;
        // If the save fails, write() has shown "Could not save": keep that message and the old list.
        if (r.added && !saveSessions()) { state.sessions = before; return; }
        let msg = 'Imported ' + r.added + ' new session' + (r.added === 1 ? '' : 's');
        if (r.skipped) msg += ', ' + r.skipped + ' already here';
        if (r.invalid) msg += ', ' + r.invalid + ' unreadable';
        state.menu = false;
        render();
        toast(msg);
      } catch (e) { toast('That file is not a Full body log backup'); }
    };
    reader.onerror = () => toast('Could not read the file');
    reader.readAsText(file);
  }

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    // A tap outside the open menu only closes it.
    if (state.menu && !ev.target.closest('#menu') && !(b && b.dataset.act === 'menu')) { state.menu = false; render(); return; }
    if (!b) return;
    const act = b.dataset.act;
    if (state.confirmKey && !b.classList.contains('confirming')) resetConfirm();
    switch (act) {
      case 'home': go('home'); break;
      case 'history': go('history'); break;
      case 'resume': go('workout'); break;
      case 'menu': {
        state.menu = !state.menu; render();
        // render() rebuilt the header: put focus back on the new Menu button.
        const mb = headEl.querySelector('[data-act="menu"]'); if (mb) mb.focus();
        break;
      }
      case 'export': exportBackup(); break;
      case 'import': fileInput.value = ''; fileInput.click(); break;
      case 'start': startDay(b, b.dataset.day); break;
      case 'discard':
        if (!confirmStep(b, 'discard', 'Tap again to discard')) return;
        state.draft = null; write(KEYS.draft, null); go('home'); toast('Workout discarded');
        break;
      case 'del': {
        if (!confirmStep(b, 'del' + b.dataset.id, 'Tap again to delete')) return;
        const before = state.sessions;
        state.sessions = state.sessions.filter(s => s.id !== b.dataset.id);
        if (!saveSessions()) { state.sessions = before; renderHistory(); return; }
        renderHistory(); toast('Session deleted');
        break;
      }
      case 'finish': if (state.draft) finish(); break;
      case 'timer': primeAudio(); if (timer.id) stopTimer(); else startTimer(IDLE_REST); break;
      case 'done': toggleDone(b); break;
    }
  });
  main.addEventListener('input', ev => {
    const inp = ev.target;
    if (!inp.dataset || !inp.dataset.f || !state.draft) return;
    const row = inp.closest('.set'), exEl = inp.closest('.ex');
    if (!row || !exEl) return;
    const s = state.draft.sets[exEl.dataset.ex][+row.dataset.i];
    const n = parseNum(inp.value), f = inp.dataset.f;
    // Text that is not a plain number is kept as typed in s.bad, outlined red, and not saved
    // until it is fixed. Done treats such a field as filled in, so it never overwrites it.
    if (n == null && inp.value.trim() !== '') { inp.setAttribute('aria-invalid', 'true'); (s.bad = s.bad || {})[f] = inp.value; }
    else { inp.removeAttribute('aria-invalid'); if (s.bad) { delete s.bad[f]; if (!s.bad.w && !s.bad.r) delete s.bad; } }
    if (f === 'w') s.w = n == null || n < 0 ? null : n;
    else { s.r = n == null || n < 0 ? null : Math.floor(n); delete s.auto; }  // 9.5 reps is 9
    saveDraft();
  });
  // Leaving a field shows what was stored ("9.5" reps becomes "9", "62," becomes "62").
  // Text that could not be read stays as typed, outlined red, so it can be corrected.
  main.addEventListener('change', ev => {
    const inp = ev.target;
    if (!inp.dataset || !inp.dataset.f || !state.draft || inp.getAttribute('aria-invalid') === 'true') return;
    const row = inp.closest('.set'), exEl = inp.closest('.ex');
    const arr = row && exEl && state.draft.sets[exEl.dataset.ex], s = arr && arr[+row.dataset.i];
    if (!s) return;
    inp.value = inp.dataset.f === 'w' ? fmtW(s.w) : (s.r == null ? '' : String(s.r));
  });
  // The keyboard's Done key in a reps field marks the set done and closes the keyboard.
  main.addEventListener('keydown', ev => {
    const inp = ev.target;
    if (ev.key !== 'Enter' || !inp.dataset || inp.dataset.f !== 'r' || !state.draft) return;
    ev.preventDefault();
    const row = inp.closest('.set'), exEl = inp.closest('.ex');
    const arr = row && exEl && state.draft.sets[exEl.dataset.ex], s = arr && arr[+row.dataset.i];
    if (s && !s.done && s.r > 0) toggleDone(row.querySelector('.done'));
    inp.blur();
  });
  fileInput.addEventListener('change', () => { if (fileInput.files && fileInput.files[0]) importBackup(fileInput.files[0]); });

  /* ========================================================================
     Boot: load data, restore the last view, register the service worker
     ======================================================================== */
  function validDraft(d) { return d && d.started && d.sets && typeof d.sets === 'object' && DAYS.indexOf(d.day) >= 0 ? d : null; }
  state.sessions = loadSessions();
  state.draft = validDraft(read(KEYS.draft));
  if (state.draft) { normalizeDraft(); saveDraft(); } else write(KEYS.draft, null);
  const view = recallView();
  go(view === 'workout' && state.draft ? 'workout' : view === 'history' ? 'history' : 'home');
  if (state.view === 'workout') resumeTimer();

  // Another tab or window changed the data: pick it up instead of overwriting it.
  window.addEventListener('storage', e => {
    if (e.key !== null && e.key !== KEYS.sessions && e.key !== KEYS.draft && e.key !== KEYS.meta) return;
    state.sessions = loadSessions();
    state.draft = validDraft(read(KEYS.draft));
    if (state.view === 'workout' && !state.draft) go('home'); else render();
  });

  try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {}); } catch (e) {}
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();
