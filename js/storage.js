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
  var data = { scores: [], badges: [], hardBadges: [], practice: null, lastName: '' };

  try {
    var raw = JSON.parse(localStorage.getItem(KEY));
    if (raw && typeof raw === 'object') {
      if (Array.isArray(raw.scores)) data.scores = raw.scores;
      if (Array.isArray(raw.badges)) data.badges = raw.badges;
      if (Array.isArray(raw.hardBadges)) data.hardBadges = raw.hardBadges;
      if (raw.practice && typeof raw.practice === 'object') data.practice = raw.practice;
      if (typeof raw.lastName === 'string') data.lastName = raw.lastName;
    }
  } catch (e) { /* storage unavailable or corrupt: start fresh */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
  }

  // Highest level first; among equals, Hard beats Easy, then whoever got there first.
  function rank(list) {
    return list.slice().sort(function (a, b) {
      return b.level - a.level || (b.hard ? 1 : 0) - (a.hard ? 1 : 0) || a.date - b.date;
    })
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
    return { name: d.name.slice(0, 16), level: level, date: date, hard: d.hard === true };
  }

  function upload(score) {
    if (!db || score.shared) return;
    db.collection('scores').add({ name: score.name, level: score.level, date: score.date, hard: !!score.hard })
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
    addScore: function (name, level, hard) {
      var score = { name: name, level: level, date: Date.now(), hard: !!hard };
      data.lastName = name;
      data.scores.push(score);
      data.scores = rank(data.scores);
      save();
      upload(score);
      notify();
    },
    // Levels cleared in either mode, and the subset cleared on Hard.
    badges: function () {
      return data.badges.concat(data.hardBadges.filter(function (n) { return data.badges.indexOf(n) === -1; }));
    },
    hardBadges: function () { return data.hardBadges.slice(); },
    addBadge: function (level, hard) {
      var list = hard ? data.hardBadges : data.badges;
      if (list.indexOf(level) === -1) { list.push(level); save(); }
    },
    practice: function () { return data.practice; },
    setPractice: function (p) { data.practice = p; save(); },
    lastName: function () { return data.lastName; }
  };
})();
