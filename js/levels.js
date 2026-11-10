/* Game-mode levels and badges.
 *
 * 10 stages x 4 tiers = 40 levels. A stage fixes how many windows there are and
 * how many balls must be tracked in each; the tier sets movement and duration.
 * Stages are ordered by the total number of balls to follow, and for the same
 * total, one window comes before several.
 */
(function () {
  'use strict';

  var STAGES = [
    { name: 'Spotter',      icon: '🎯', windows: 1, targets: 1 },
    { name: 'Double Take',  icon: '👁️', windows: 1, targets: 2 },
    { name: 'Split Vision', icon: '👀', windows: 2, targets: 1 },
    { name: 'Triple Lock',  icon: '🔱', windows: 1, targets: 3 },
    { name: 'Wide Angle',   icon: '🔭', windows: 3, targets: 1 },
    { name: 'Juggler',      icon: '🤹', windows: 1, targets: 4 },
    { name: 'Twin Radar',   icon: '📡', windows: 2, targets: 2 },
    { name: 'Four Corners', icon: '🧭', windows: 4, targets: 1 },
    { name: 'Hawk',         icon: '🦅', windows: 3, targets: 2 },
    { name: 'Mastermind',   icon: '🧠', windows: 4, targets: 2 }
  ];

  var TIERS = [
    { name: 'Bronze',  color: '#cd8a4b', changing: false, duration: 10 },
    { name: 'Silver',  color: '#c9d3e0', changing: false, duration: 20 },
    { name: 'Gold',    color: '#ffcf3d', changing: true,  duration: 10 },
    { name: 'Diamond', color: '#7fe9ff', changing: true,  duration: 20 }
  ];

  var LEVELS = [];
  STAGES.forEach(function (stage, s) {
    TIERS.forEach(function (tier, t) {
      LEVELS.push({
        n: LEVELS.length + 1,
        stage: s,
        tier: t,
        windows: stage.windows,
        targets: stage.targets,
        duration: tier.duration,
        changing: tier.changing,
        badge: { name: tier.name + ' ' + stage.name, icon: stage.icon, color: tier.color }
      });
    });
  });

  window.BT = window.BT || {};
  window.BT.STAGES = STAGES;
  window.BT.TIERS = TIERS;
  window.BT.LEVELS = LEVELS;
  window.BT.MAX_LIVES = 3;
})();
