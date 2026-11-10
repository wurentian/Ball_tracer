/* One round of tracking: cue -> track -> pick -> reveal.
 *
 *   new BT.Round(canvas, { windows, targets, duration, changing }, callbacks)
 *
 * callbacks: onPhase(phase), onProgress(fractionLeft), onPicks(complete)
 * round.check() ends the pick phase and returns { correct, total }.
 */
(function () {
  'use strict';

  var CUE_SECONDS = 2;
  var STEP = 1 / 120;
  var GAP = 10;

  var COLORS = {
    cyan:   { hi: '#b8efff', mid: '#2fbdf5', lo: '#0c8fd0', glow: 'rgba(40,190,255,0.7)' },
    yellow: { hi: '#fff6a8', mid: '#ffd21f', lo: '#f0a800', glow: 'rgba(255,210,40,0.85)' },
    green:  { hi: '#b6ffcf', mid: '#2fd673', lo: '#159c4c', glow: 'rgba(47,214,115,0.8)' },
    red:    { hi: '#ffb0b0', mid: '#ff4d5e', lo: '#c81e3a', glow: 'rgba(255,77,94,0.8)' }
  };

  function rand(a, b) { return a + Math.random() * (b - a); }

  function Round(canvas, cfg, cb) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = cfg;
    this.cb = cb || {};
    this.phase = 'cue';
    this.phaseTime = 0;
    this.clock = 0;
    this.acc = 0;
    this.last = 0;
    this.dead = false;
    this.wins = [];

    var count = cfg.targets <= 2 ? 6 : 8;
    for (var i = 0; i < cfg.windows; i++) this.wins.push({ balls: [], picks: [], count: count });
    this.layout();
    this.wins.forEach(this.spawn, this);

    this.onPointer = this.onPointer.bind(this);
    this.frame = this.frame.bind(this);
    canvas.addEventListener('pointerdown', this.onPointer);
    this.emit('onPhase', this.phase);
    this.emit('onProgress', 1);
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  }

  Round.prototype.emit = function (name, arg) {
    if (this.cb[name]) this.cb[name](arg);
  };

  Round.prototype.destroy = function () {
    this.dead = true;
    cancelAnimationFrame(this.raf);
    this.canvas.removeEventListener('pointerdown', this.onPointer);
  };

  /* Fit the canvas to its box and place the windows; keeps balls in place on resize. */
  Round.prototype.layout = function () {
    var c = this.canvas;
    var W = c.clientWidth, H = c.clientHeight;
    if (!W || !H) return;
    var dpr = window.devicePixelRatio || 1;
    c.width = Math.round(W * dpr);
    c.height = Math.round(H * dpr);
    this.dpr = dpr;
    this.W = W; this.H = H;

    var n = this.wins.length;
    var cols = 1, rows = 1;
    if (n === 4) { cols = 2; rows = 2; }
    else if (n > 1) {
      // Side by side (as in the original) unless stacking gives clearly squarer windows.
      var skew = function (cl, rw) { return Math.abs(Math.log((W / cl) / (H / rw))); };
      if (skew(1, n) + 0.3 < skew(n, 1)) rows = n; else cols = n;
    }
    var w = (W - GAP * (cols - 1)) / cols;
    var h = (H - GAP * (rows - 1)) / rows;

    this.wins.forEach(function (win, i) {
      var scale = Math.sqrt(w * h);
      var r = Math.max(9, Math.min(30, scale * 0.06));
      if (win.w) {
        var sx = w / win.w, sy = h / win.h;
        win.balls.forEach(function (b) {
          b.x = Math.max(r, Math.min(w - r, b.x * sx));
          b.y = Math.max(r, Math.min(h - r, b.y * sy));
        });
      }
      win.x = (i % cols) * (w + GAP);
      win.y = Math.floor(i / cols) * (h + GAP);
      win.w = w; win.h = h; win.r = r;
      win.speed = scale * 0.5;
    });
  };

  Round.prototype.spawn = function (win) {
    var r = win.r;
    for (var i = 0; i < win.count; i++) {
      var x, y, ok, tries = 0;
      do {
        x = rand(r * 1.5, win.w - r * 1.5);
        y = rand(r * 1.5, win.h - r * 1.5);
        ok = win.balls.every(function (o) { return Math.hypot(o.x - x, o.y - y) > r * 3; });
      } while (!ok && ++tries < 300);
      var a = rand(0, Math.PI * 2);
      win.balls.push({
        x: x, y: y, dx: Math.cos(a), dy: Math.sin(a),
        m: 1, mGoal: 1, mTimer: rand(0, 0.8),
        target: i < this.cfg.targets, picked: false
      });
    }
  };

  Round.prototype.setPhase = function (phase) {
    this.phase = phase;
    this.phaseTime = 0;
    this.emit('onPhase', phase);
  };

  Round.prototype.frame = function (now) {
    if (this.dead) return;
    var dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0;
    this.last = now;
    this.clock += dt;
    this.phaseTime += dt;

    if (this.phase === 'cue' && this.phaseTime >= CUE_SECONDS) {
      this.setPhase('track');
    } else if (this.phase === 'track') {
      this.acc += dt;
      while (this.acc >= STEP) { this.step(STEP); this.acc -= STEP; }
      var left = 1 - this.phaseTime / this.cfg.duration;
      this.emit('onProgress', Math.max(0, left));
      if (left <= 0) {
        this.setPhase('pick');
        this.emit('onPicks', false);
      }
    }
    this.draw();
    this.raf = requestAnimationFrame(this.frame);
  };

  Round.prototype.step = function (dt) {
    var changing = this.cfg.changing;
    this.wins.forEach(function (win) {
      var r = win.r, balls = win.balls, i, j, b;
      for (i = 0; i < balls.length; i++) {
        b = balls[i];
        if (changing) {
          // Each ball drifts toward its own randomly chosen pace, re-chosen every second or so.
          b.mTimer -= dt;
          if (b.mTimer <= 0) { b.mGoal = rand(0.4, 1.9); b.mTimer = rand(0.5, 1.6); }
          b.m += (b.mGoal - b.m) * Math.min(1, dt * 3);
        }
        var v = win.speed * b.m;
        b.x += b.dx * v * dt;
        b.y += b.dy * v * dt;
        if (b.x < r) { b.x = r; b.dx = Math.abs(b.dx); }
        else if (b.x > win.w - r) { b.x = win.w - r; b.dx = -Math.abs(b.dx); }
        if (b.y < r) { b.y = r; b.dy = Math.abs(b.dy); }
        else if (b.y > win.h - r) { b.y = win.h - r; b.dy = -Math.abs(b.dy); }
      }
      for (i = 0; i < balls.length; i++) {
        for (j = i + 1; j < balls.length; j++) {
          var p = balls[i], q = balls[j];
          var ex = q.x - p.x, ey = q.y - p.y;
          var d = Math.hypot(ex, ey);
          if (d >= 2 * r || d === 0) continue;
          var nx = ex / d, ny = ey / d;
          var sp = win.speed * p.m, sq = win.speed * q.m;
          var rel = (p.dx * sp - q.dx * sq) * nx + (p.dy * sp - q.dy * sq) * ny;
          if (rel > 0) {
            // Equal-mass bounce: swap the velocity along the contact normal,
            // then keep only the new direction (each ball keeps its own pace).
            redirect(p, p.dx * sp - rel * nx, p.dy * sp - rel * ny, -nx, -ny);
            redirect(q, q.dx * sq + rel * nx, q.dy * sq + rel * ny, nx, ny);
          }
          var push = (2 * r - d) / 2;
          p.x -= nx * push; p.y -= ny * push;
          q.x += nx * push; q.y += ny * push;
        }
      }
    });
  };

  function redirect(b, vx, vy, fx, fy) {
    var len = Math.hypot(vx, vy);
    if (len < 1e-6) { b.dx = fx; b.dy = fy; }
    else { b.dx = vx / len; b.dy = vy / len; }
  }

  Round.prototype.onPointer = function (e) {
    if (this.phase !== 'pick') return;
    var rect = this.canvas.getBoundingClientRect();
    var px = e.clientX - rect.left, py = e.clientY - rect.top;
    var need = this.cfg.targets;
    for (var i = 0; i < this.wins.length; i++) {
      var win = this.wins[i];
      var x = px - win.x, y = py - win.y;
      if (x < 0 || y < 0 || x > win.w || y > win.h) continue;
      var best = null, bestD = Math.max(win.r * 1.7, 24);
      win.balls.forEach(function (b) {
        var d = Math.hypot(b.x - x, b.y - y);
        if (d < bestD) { bestD = d; best = b; }
      });
      if (!best) return;
      if (best.picked) {
        best.picked = false;
        win.picks.splice(win.picks.indexOf(best), 1);
      } else {
        // Window already full: the oldest pick gives way.
        if (win.picks.length >= need) win.picks.shift().picked = false;
        best.picked = true;
        win.picks.push(best);
      }
      break;
    }
    this.emit('onPicks', this.wins.every(function (w) { return w.picks.length === need; }));
  };

  Round.prototype.check = function () {
    var correct = 0, total = 0;
    this.wins.forEach(function (win) {
      win.balls.forEach(function (b) {
        if (b.target) { total++; if (b.picked) correct++; }
      });
    });
    this.result = { correct: correct, total: total };
    this.setPhase('reveal');
    return this.result;
  };

  /* ---------- drawing ---------- */

  Round.prototype.draw = function () {
    var ctx = this.ctx, self = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    var pulse = 0.5 + 0.5 * Math.sin(this.clock * 7);

    this.wins.forEach(function (win) {
      ctx.save();
      ctx.translate(win.x, win.y);
      roundRect(ctx, 0.5, 0.5, win.w - 1, win.h - 1, 18);
      ctx.fillStyle = 'rgba(255,255,255,0.035)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(140,170,255,0.28)';
      ctx.lineWidth = 1;
      ctx.stroke();

      win.balls.forEach(function (b) { self.drawBall(b, win.r, pulse); });

      if (self.phase === 'pick') {
        ctx.font = '600 13px system-ui, sans-serif';
        ctx.textBaseline = 'top';
        ctx.fillStyle = win.picks.length === self.cfg.targets ? '#ffd21f' : 'rgba(234,242,255,0.6)';
        ctx.fillText(win.picks.length + ' / ' + self.cfg.targets, 12, 10);
      }
      ctx.restore();
    });
  };

  Round.prototype.drawBall = function (b, r, pulse) {
    var ctx = this.ctx, phase = this.phase;
    var color = COLORS.cyan, alpha = 1, mark = null, ring = null, scale = 1;

    if (phase === 'cue' && b.target) {
      color = COLORS.yellow;
      scale = 1 + 0.08 * pulse;
    } else if (phase === 'pick' && b.picked) {
      ring = '#ffffff';
    } else if (phase === 'reveal') {
      if (b.target && b.picked) { color = COLORS.green; mark = 'check'; }
      else if (b.picked) { color = COLORS.red; mark = 'cross'; }
      else if (b.target) { color = COLORS.yellow; ring = 'rgba(255,210,40,' + (0.4 + 0.6 * pulse) + ')'; }
      else alpha = 0.35;
    }

    var R = r * scale;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(b.x, b.y);
    var g = ctx.createRadialGradient(-R * 0.3, -R * 0.35, R * 0.1, 0, 0, R);
    g.addColorStop(0, color.hi);
    g.addColorStop(0.55, color.mid);
    g.addColorStop(1, color.lo);
    ctx.shadowColor = color.glow;
    ctx.shadowBlur = R * 0.9;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.stroke();

    if (ring) {
      ctx.beginPath();
      ctx.arc(0, 0, R + 5, 0, Math.PI * 2);
      ctx.lineWidth = 3;
      ctx.strokeStyle = ring;
      ctx.stroke();
    }
    if (mark) {
      ctx.lineWidth = Math.max(2.5, R * 0.2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#ffffff';
      ctx.beginPath();
      var s = R * 0.42;
      if (mark === 'check') {
        ctx.moveTo(-s, 0); ctx.lineTo(-s * 0.25, s * 0.7); ctx.lineTo(s, -s * 0.65);
      } else {
        ctx.moveTo(-s, -s); ctx.lineTo(s, s); ctx.moveTo(s, -s); ctx.lineTo(-s, s);
      }
      ctx.stroke();
    }
    ctx.restore();
  };

  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  window.BT = window.BT || {};
  window.BT.Round = Round;
})();
