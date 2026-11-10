/* What the game remembers.
 *
 * Badges, practice settings and a copy of your own records live in one
 * localStorage entry on this device. When the page runs as a Claude artifact
 * with a shared database, the hall of fame is also kept there, so everyone
 * who opens the page sees the same list on every device.
 */
(function () {
  'use strict';

  var KEY = 'balltracer.v1';
  var MAX_SCORES = 10;
  var data = { scores: [], badges: [], practice: null, lastName: '' };

  try {
    var raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.scores)) data.scores = raw.scores;
      if (Array.isArray(raw.badges)) data.badges = raw.badges;
      if (raw.practice && typeof raw.practice === 'object') data.practice = raw.practice;
      if (typeof raw.lastName === 'string') data.lastName = raw.lastName;
    }
  } catch (e) { /* storage unavailable or corrupt: start fresh */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  // Highest level first; among equals, whoever got there first.
  function rank(list) {
    return list.slice().sort(function (a, b) { return b.level - a.level || a.date - b.date; })
      .slice(0, MAX_SCORES);
  }

  /* ---------- shared hall of fame ---------- */

  var db = null;
  var shared = null;        // records from the shared database, once it has answered
  var status = 'local';     // 'local' | 'loading' | 'shared' | 'unreachable'
  var listeners = [];

  function notify() { listeners.forEach(function (fn) { fn(); }); }
  function setStatus(s) { if (status !== s) { status = s; notify(); } }

  // Shared rows are written by other people: keep only well-formed ones.
  function clean(d) {
    if (!d || typeof d.name !== 'string') return null;
    var level = Math.floor(Number(d.level)), date = Number(d.date);
    if (!(level >= 0 && level <= 40) || !isFinite(date)) return null;
    return { name: d.name.slice(0, 16), level: level, date: date };
  }

  function upload(score) {
    if (!db || score.shared) return;
    db.collection('scores').add({ name: score.name, level: score.level, date: score.date })
      .then(function () { score.shared = true; save(); })
      .catch(function () { /* stays on this device; retried on the next visit */ });
  }

  function connect(store) {
    if (!store) return;
    db = store;
    setStatus('loading');
    var timer = setTimeout(function () { if (!shared) setStatus('unreachable'); }, 10000);
    db.collection('scores').limit(1000).onSnapshot(function (snap) {
      shared = snap.docs.map(function (doc) { return clean(doc.data()); }).filter(Boolean);
      if (!snap.metadata.fromCache) clearTimeout(timer);
      status = 'shared';
      notify();
    }, function () {
      clearTimeout(timer);
      shared = null;
      setStatus('unreachable');
    });
    // Records made on this device before the shared list existed.
    data.scores.forEach(upload);
  }

  if (window.claude && typeof window.claude.use === 'function') {
    window.claude.use('db').then(connect, function () {});
  }

  window.BT = window.BT || {};
  window.BT.Store = {
    scores: function () { return rank(shared || data.scores); },
    scoresStatus: function () { return status; },
    onScoresChange: function (fn) { listeners.push(fn); },
    addScore: function (name, level) {
      var score = { name: name, level: level, date: Date.now() };
      data.lastName = name;
      data.scores.push(score);
      data.scores = rank(data.scores);
      save();
      upload(score);
      notify();
    },
    badges: function () { return data.badges.slice(); },
    addBadge: function (level) {
      if (data.badges.indexOf(level) === -1) { data.badges.push(level); save(); }
    },
    practice: function () { return data.practice; },
    setPractice: function (p) { data.practice = p; save(); },
    lastName: function () { return data.lastName; }
  };
})();
