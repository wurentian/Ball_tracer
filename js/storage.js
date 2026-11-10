/* Everything the game remembers lives in one localStorage entry on this device. */
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

  window.BT = window.BT || {};
  window.BT.Store = {
    scores: function () { return data.scores.slice(); },
    addScore: function (name, level) {
      data.lastName = name;
      data.scores.push({ name: name, level: level, date: Date.now() });
      // Highest level first; among equals, whoever got there first.
      data.scores.sort(function (a, b) { return b.level - a.level || a.date - b.date; });
      data.scores.length = Math.min(data.scores.length, MAX_SCORES);
      save();
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
