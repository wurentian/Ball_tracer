# Ball Tracer

A multiple-object-tracking game. A few balls flash yellow during a 3-second countdown, then every ball
turns the same blue and they all start moving. Keep your eyes on the ones that were yellow and point them out when they stop.

**Play it:** https://wurentian.github.io/Ball_tracer/

## Run it

No build step and no dependencies. Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
```

Works with mouse and touch.

## Practice mode

Choose your own settings:

- **Split windows**: 1–4
- **Balls to track per window**: 1–2 (3–4 with a single window)
- **How long the balls move**: 5, 10, 15 or 20 seconds
- **Movement**: Easy (constant speed) or Difficult (every ball keeps speeding up and slowing down)

## Game mode

40 levels in 10 stages, 3 lives.

- All targets found → you earn that level's badge and move on.
- Some found → the same level again, no penalty.
- None found → you lose a life and replay the level. No lives left ends the run.

Each stage sets the windows and the balls to track:

| Stage | Levels | Name | Windows | Balls per window |
|---|---|---|---|---|
| 1 | 1–4 | Spotter | 1 | 1 |
| 2 | 5–8 | Double Take | 1 | 2 |
| 3 | 9–12 | Split Vision | 2 | 1 |
| 4 | 13–16 | Triple Lock | 1 | 3 |
| 5 | 17–20 | Wide Angle | 3 | 1 |
| 6 | 21–24 | Juggler | 1 | 4 |
| 7 | 25–28 | Twin Radar | 2 | 2 |
| 8 | 29–32 | Four Corners | 4 | 1 |
| 9 | 33–36 | Hawk | 3 | 2 |
| 10 | 37–40 | Mastermind | 4 | 2 |

Inside each stage the four levels are: Bronze (constant speed, 5 s), Silver (changing speed, 5 s),
Gold (constant speed, 10 s), Diamond (changing speed, 10 s).

When a run ends you can record your name. The hall of fame (top 10) and your badge collection are
kept in the browser's local storage on that device.

## Code

- `js/engine.js` — one round: physics, phases, drawing, picking
- `js/levels.js` — the level table and badges
- `js/storage.js` — hall of fame, badges, last practice settings
- `js/main.js` — screens and the two modes
