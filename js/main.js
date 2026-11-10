/* Screens, Practice mode and Game mode. */
(function () {
  'use strict';

  var BT = window.BT, Store = BT.Store, LEVELS = BT.LEVELS;
  var $ = function (id) { return document.getElementById(id); };

  var state = {
    mode: null,          // 'practice' | 'game'
    round: null,
    level: 1,            // game: level being played
    cleared: 0,          // game: highest level cleared this run
    lives: BT.MAX_LIVES,
    runBadges: [],
    practice: Object.assign({ windows: 2, targets: 1, duration: 10, changing: false }, Store.practice())
  };
  BT.state = state; // handy for debugging and automated checks

  function show(id) {
    ['home', 'practice', 'play', 'end'].forEach(function (name) {
      $('screen-' + name).hidden = name !== id;
    });
  }

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  function badgeEl(level, earned, extraCls) {
    var b = el('div', 'badge' + (earned ? '' : ' locked') + (extraCls ? ' ' + extraCls : ''));
    b.style.setProperty('--tier', level.badge.color);
    b.title = level.badge.name + ' — level ' + level.n + (earned ? '' : ' (locked)');
    b.setAttribute('role', 'img');
    b.setAttribute('aria-label', b.title);
    b.appendChild(el('span', null, level.badge.icon));
    return b;
  }

  /* ---------- Home ---------- */

  function renderHome() {
    var scores = Store.scores();
    var fame = $('fame');
    fame.textContent = '';
    scores.forEach(function (s) {
      var li = el('li');
      li.appendChild(el('span', 'who', s.name));
      li.appendChild(el('span', 'lvl', 'Level ' + s.level));
      li.appendChild(el('span', 'when', new Date(s.date).toLocaleDateString()));
      fame.appendChild(li);
    });
    $('fame-empty').hidden = scores.length > 0;

    var earned = Store.badges();
    $('badge-count').textContent = earned.length + ' / ' + LEVELS.length;
    var grid = $('badge-grid');
    grid.textContent = '';
    BT.STAGES.forEach(function (stage, s) {
      var row = el('div', 'badge-stage');
      var label = el('div', 'label', stage.name);
      label.appendChild(el('small', null,
        stage.windows + (stage.windows > 1 ? ' windows' : ' window') + ' · ' +
        stage.targets + (stage.targets > 1 ? ' balls each' : ' ball each')));
      var tiers = el('div', 'tiers');
      LEVELS.filter(function (l) { return l.stage === s; }).forEach(function (l) {
        tiers.appendChild(badgeEl(l, earned.indexOf(l.n) !== -1));
      });
      row.appendChild(label);
      row.appendChild(tiers);
      grid.appendChild(row);
    });
  }

  function goHome() {
    stopRound();
    renderHome();
    show('home');
  }

  /* ---------- Practice setup ---------- */

  var OPTIONS = {
    windows:  [[1, '1'], [2, '2'], [3, '3'], [4, '4']],
    targets:  [[1, '1'], [2, '2'], [3, '3'], [4, '4']],
    duration: [[5, '5 s'], [10, '10 s'], [15, '15 s'], [20, '20 s']],
    changing: [[false, 'Easy'], [true, 'Difficult']]
  };

  function renderPractice() {
    var p = state.practice;
    // 3 or 4 balls to track only fit the single-window layout.
    if (p.windows > 1 && p.targets > 2) p.targets = 2;

    Object.keys(OPTIONS).forEach(function (key) {
      var box = $('opt-' + key);
      box.textContent = '';
      OPTIONS[key].forEach(function (opt) {
        var b = el('button', null, opt[1]);
        b.type = 'button';
        b.setAttribute('aria-pressed', String(p[key] === opt[0]));
        if (key === 'targets' && opt[0] > 2 && p.windows > 1) b.disabled = true;
        b.addEventListener('click', function () {
          p[key] = opt[0];
          renderPractice();
        });
        box.appendChild(b);
      });
    });
    $('targets-hint').hidden = p.windows === 1;
    $('changing-hint').textContent = p.changing
      ? 'Balls keep speeding up and slowing down.'
      : 'Balls move at a constant speed.';
  }

  /* ---------- Playing a round ---------- */

  function stopRound() {
    if (state.round) { state.round.destroy(); state.round = null; }
    $('overlay').hidden = true;
  }

  function setMsg(text, tone) {
    var m = $('msg');
    m.textContent = text;
    m.className = 'msg' + (tone ? ' ' + tone : '');
  }

  function setActions(list) {
    var box = $('actions');
    box.textContent = '';
    list.forEach(function (a) {
      var b = el('button', 'btn' + (a.primary ? ' primary' : ''), a.label);
      b.type = 'button';
      if (a.id) b.id = a.id;
      if (a.disabled) b.disabled = true;
      b.addEventListener('click', a.run);
      box.appendChild(b);
    });
  }

  function renderLives() {
    var box = $('hud-lives');
    box.textContent = '';
    if (state.mode !== 'game') return;
    for (var i = 0; i < BT.MAX_LIVES; i++) {
      box.appendChild(el('span', i < state.lives ? null : 'lost', '♥'));
    }
    box.setAttribute('aria-label', state.lives + ' lives left');
  }

  function startRound(cfg) {
    stopRound();
    show('play');
    renderLives();
    var plural = cfg.targets > 1;
    state.round = new BT.Round($('canvas'), cfg, {
      onPhase: function (phase) {
        if (phase === 'cue') {
          setMsg('Remember the yellow ' + (plural ? 'balls' : 'ball') +
            (cfg.windows > 1 ? ' in each window' : ''));
          setActions([]);
        } else if (phase === 'track') {
          setMsg('Keep your eyes on ' + (plural || cfg.windows > 1 ? 'them' : 'it') + '…');
        } else if (phase === 'pick') {
          setMsg('Tap the ' + (plural ? cfg.targets + ' balls' : 'ball') + ' that ' +
            (plural ? 'were' : 'was') + ' yellow' + (cfg.windows > 1 ? ' in each window' : ''));
          setActions([{ id: 'btn-check', label: 'Check', primary: true, disabled: true, run: onCheck }]);
        }
      },
      onProgress: function (left) {
        $('timebar').style.width = (left * 100).toFixed(1) + '%';
      },
      onPicks: function (complete) {
        var b = $('btn-check');
        if (b) b.disabled = !complete;
      }
    });
  }

  function onCheck() {
    var res = state.round.check();
    if (state.mode === 'practice') practiceResult(res); else gameResult(res);
  }

  function found(res) { return res.correct + ' of ' + res.total + ' found'; }

  /* ---------- Practice ---------- */

  function startPractice() {
    state.mode = 'practice';
    Store.setPractice(state.practice);
    var p = state.practice;
    $('hud-title').textContent = 'Practice · ' + p.duration + ' s · ' + (p.changing ? 'Difficult' : 'Easy');
    startRound(p);
  }

  function practiceResult(res) {
    var all = res.correct === res.total;
    setMsg(found(res) + (all ? ' — perfect!' : ''), all ? 'good' : 'bad');
    setActions([
      { label: 'Settings', run: function () { stopRound(); renderPractice(); show('practice'); } },
      { label: 'Again', primary: true, run: startPractice }
    ]);
  }

  /* ---------- Game ---------- */

  function startGame() {
    state.mode = 'game';
    state.level = 1;
    state.cleared = 0;
    state.lives = BT.MAX_LIVES;
    state.runBadges = [];
    playLevel();
  }

  function playLevel() {
    var L = LEVELS[state.level - 1];
    $('hud-title').textContent = 'Level ' + L.n + ' · ' + L.badge.name;
    startRound(L);
  }

  function gameResult(res) {
    var L = LEVELS[state.level - 1];
    if (res.correct === res.total) {
      // All correct: badge, then the next level.
      Store.addBadge(L.n);
      state.runBadges.push(L.n);
      state.cleared = L.n;
      setMsg(found(res) + ' — level cleared!', 'good');
      setActions([]);
      setTimeout(function () { if (state.cleared === L.n && state.round) showBadge(L); }, 900);
    } else if (res.correct > 0) {
      // Some correct: same level again, no penalty.
      setMsg(found(res) + ' — close! Try this level again.', 'bad');
      setActions([{ label: 'Retry level', primary: true, run: playLevel }]);
    } else {
      // None correct: costs a life.
      state.lives--;
      renderLives();
      if (state.lives > 0) {
        setMsg('None found — you lose a life.', 'bad');
        setActions([{ label: 'Retry level', primary: true, run: playLevel }]);
      } else {
        setMsg('None found — no lives left.', 'bad');
        setActions([{ label: 'Finish', primary: true, run: endGame }]);
      }
    }
  }

  function showBadge(L) {
    var last = L.n === LEVELS.length;
    $('ov-kicker').textContent = 'Level ' + L.n + ' cleared!';
    var box = $('ov-badge');
    box.textContent = '';
    box.appendChild(badgeEl(L, true, 'xl'));
    box.appendChild(el('div', 'badge-name', L.badge.name));
    var next = LEVELS[L.n];
    $('ov-text').textContent = last
      ? 'That was the last level. You have tracked them all.'
      : 'Next: ' + next.windows + (next.windows > 1 ? ' windows' : ' window') + ', ' +
        next.targets + (next.targets > 1 ? ' balls each' : ' ball' + (next.windows > 1 ? ' each' : '')) + ', ' +
        next.duration + ' s, ' + (next.changing ? 'changing speed' : 'constant speed') + '.';
    $('ov-next').textContent = last ? 'Finish' : 'Next level';
    $('ov-next').onclick = function () {
      $('overlay').hidden = true;
      if (last) endGame(); else { state.level++; playLevel(); }
    };
    $('overlay').hidden = false;
    $('ov-next').focus();
  }

  function endGame() {
    stopRound();
    var won = state.cleared === LEVELS.length;
    $('end-title').textContent = won ? 'You did it!' : 'Game over';
    $('end-summary').textContent = state.cleared === 0
      ? 'No level cleared this time.'
      : (won ? 'All ' : '') + state.cleared + ' of ' + LEVELS.length + ' levels cleared' +
        (won ? '.' : ' — you reached level ' + state.level + '.');
    var row = $('end-badges');
    row.textContent = '';
    state.runBadges.forEach(function (n) { row.appendChild(badgeEl(LEVELS[n - 1], true)); });
    $('end-nobadges').hidden = state.runBadges.length > 0;
    $('end-name').value = Store.lastName();
    show('end');
  }

  /* ---------- Wiring ---------- */

  $('btn-practice').addEventListener('click', function () { renderPractice(); show('practice'); });
  $('btn-practice-start').addEventListener('click', startPractice);
  $('btn-game').addEventListener('click', startGame);
  $('btn-end-skip').addEventListener('click', goHome);

  document.querySelectorAll('[data-go="home"]').forEach(function (b) {
    b.addEventListener('click', goHome);
  });

  $('btn-quit').addEventListener('click', function () {
    if (state.mode === 'game') endGame();
    else { stopRound(); renderPractice(); show('practice'); }
  });

  $('end-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = $('end-name').value.trim() || 'Anonymous';
    Store.addScore(name, state.cleared);
    goHome();
  });

  function relayout() { if (state.round) state.round.layout(); }
  window.addEventListener('resize', relayout);
  if (window.ResizeObserver) new ResizeObserver(relayout).observe($('canvas'));

  goHome();
})();
