---
name: run-pocket-dice-cup
description: Build, run, and drive Pocket Dice Cup (the Nuxt + three.js + Rapier dice cup web app). Use when asked to start or run the app, shake or roll the dice, replay a recorded motion trace, open the dice/history/style sheets, take a screenshot of the cup, check a change in the running app, or run its tests.
---

Pocket Dice Cup is a Nuxt SPA: a WebGL canvas of dice driven by the
phone's accelerometer. Start the dev server, then drive it with
`.claude/skills/run-pocket-dice-cup/driver.mjs`, a stdin REPL over
headless Chromium at iPhone size (390×844 @2x). It taps, presses space,
**fakes the motion sensor** with `devicemotion` events (a synthetic shake
or a real iPhone trace from `tests/fixtures/traces/`), reads the result
card and the `?debug` overlay, clicks sheet buttons and takes screenshots.

All paths are relative to the repo root. Checked on macOS (arm64), Node 24.

## Prerequisites

Node ≥ 24 (`package.json` `engines`). Playwright is **not** a project
dependency; the driver loads `playwright-core` from a cache folder outside
the repo (`$PLAYWRIGHT_DIR`, default `~/.cache/pocket-dice-driver`):

```bash
mkdir -p ~/.cache/pocket-dice-driver && cd ~/.cache/pocket-dice-driver
echo '{"private":true}' > package.json   # without it npm installs into the nearest parent package.json (e.g. ~/package.json)
npm i --no-audit --no-fund playwright-core@1.62.1
npx playwright-core install chromium     # no-op when ~/Library/Caches/ms-playwright already has it
```

## Setup

```bash
npm install
```

## Run (agent path)

Start the dev server in the background and poll the port:

```bash
npm run dev > /tmp/pocket-dice-dev.log 2>&1 &
timeout 90 bash -c 'until curl -sf http://localhost:3000 >/dev/null; do sleep 1; done'
```

Pipe commands to the driver (one per line; `#` comments allowed):

```bash
node .claude/skills/run-pocket-dice-cup/driver.mjs <<'EOF'
open dice=2d6
shake 1500
states
wait-result
click History
ss history
click Done
click 2d6
click More d8
click Done
click Style
click Gold
click Done
toss
wait-result
hide-debug
ss gold
errors
quit
EOF
```

Expected output includes `states: idle -> shaking -> result`, a line
like `result: 6 3 + 3` (the total, then the dice), one like
`result: 8 d6: 6 + 1 · d8: 1` for a mixed pool, and `no errors`. The
numbers change from run to run even with `?debug`'s fixed start, because
frame timing feeds the physics. A run takes about 10 s plus the shakes.

Screenshots → `/tmp/pocket-dice-shots/<name>.png` (`$SHOTS_DIR` to change).
Base URL is the first argument (default `http://localhost:3000/`).
`LOCALE=zh-HK` or `LOCALE=zh-CN` starts the browser in that language.

| command | what it does |
|---|---|
| `open [query]` | loads `/?debug&<query>` (e.g. `dice=3d6`, `dice=2d6+d20`, `skin=ebony`), waits for the dice, hides the Nuxt DevTools pill |
| `toss` / `space` | taps the felt / presses space: a roll with no sensor |
| `shake [ms] [restMs]` | synthetic side-to-side shake (default 1500 ms), then lying screen-up (default 3000 ms) so the dice settle; returns when the readings end |
| `replay <trace.json>` | replays a recorded iPhone trace, e.g. `tests/fixtures/traces/shake-horizontal.json`, then 3 s screen-up |
| `wait-result [s]` | waits for the result card (default 20 s) and prints it |
| `states` | the states seen since the last `states`/`open` (idle, shaking, settling, result) |
| `debug` | prints the debug overlay: state, result, sensor, accel, physics ms, impacts/s, sound |
| `click <name>` | a button, radio or tab by accessible name: `History`, `Style`, `Done`, `Clear`, the pool button (`2d6`), `More d8`, `Fewer d6`, skins (`Gold`, `Ebony`…), the Style sheet's `Dice` and `Table` tabs, tables (`Battle mat`) |
| `hide-debug` | hides the debug overlay before a clean screenshot |
| `ss [name]` | screenshot |
| `eval <js>` | evaluates in the page and prints JSON |
| `errors` | console errors and page exceptions since the last `errors`/`open` |
| `wait <ms>`, `help`, `quit` | |

A failed or unknown command prints `<name> failed: …` and the driver
exits 1 at the end. For step-by-step work, run the same driver under tmux and `send-keys`
one command at a time.

Stop the server:

```bash
lsof -ti:3000 -sTCP:LISTEN | xargs kill
```

## Run (human path)

`npm run dev` and open http://localhost:3000 (click, tap or space rolls).
On a phone, `npm run dev:https` with the LAN URL; real motion and haptics
only happen there or in the iOS/Android shells (`npm run ios` /
`npm run android` open Xcode / Android Studio). The driver can't check those.

## Test

```bash
npx vitest run
npm run lint
npm run typecheck
```

`npx vitest run` skips the slow fairness rolls; run them with
`npm run test:fairness`. `npm test` alone starts
vitest in **watch mode** and never exits.

Most engine changes (physics, state machine, motion analysis) can be
checked without a browser: `app/engine/simulation.ts` has no DOM and the
tests in `tests/engine/` run it in Node against the real Rapier WASM,
replaying the same traces.

## Gotchas

- **The Nuxt DevTools pill sits on the History button** in dev and takes
  its clicks (the click times out after 30 s). `open` hides
  `#nuxt-devtools-container`; if you `page.goto` some other way, hide it too.
- **Skins are `role="radio"`, not buttons**, the Style sheet's `Dice` and
  `Table` are `role="tab"`, and the steppers are icon-only with aria-labels
  `More d8` / `Fewer d8`. `click` searches buttons, radios and tabs by
  accessible name, so use those names. Tables only show once the `Table`
  tab is clicked.
- **`?debug` changes the roll.** It starts the dice on a fixed grid with
  the same face up instead of at random, which makes runs repeatable. It
  also covers the top-left of the felt, so `hide-debug` before a screenshot.
- **The motion events use the W3C sign** (screen-up reads z = +9.81).
  Chromium's UA is not iOS, so the app doesn't flip the sign, and the
  trace fixtures are stored after the iOS flip, so they replay as-is.
- **A synthetic shake needs the screen-up tail.** The cup only settles
  when gravity is steady at screen-up and the phone is still; `shake` and
  `replay` add 3 s of `(0, 0, 9.81)` (`shake`'s second argument changes it). Readings that stop while tilted
  leave the dice rolling (`state shaking`) with no result.
- **`states` can miss `settling`.** The overlay updates every 100 ms, so
  a short settle shows as `shaking -> result`.
- **Every run is a fresh browser profile.** `localStorage` is empty, so
  the pool defaults to 1d6 (pass `dice=`) and History only has this run's rolls.
- **WebGL runs on SwiftShader** (`--enable-unsafe-swiftshader`); no GPU is
  needed, and `physics` in `debug` is about 0.1–0.5 ms. Screenshots show
  the real three.js render, not a blank canvas.
- **`playwright-core` must not go into the repo.** The cache folder needs
  its own `package.json`, or `npm i` walks up and writes to the first
  `package.json` above it, such as one in the home folder.

## Troubleshooting

- **`click failed: locator.click: Timeout … exceeded` on `History`**:
  the DevTools pill (see Gotchas). Use `open`, which hides it.
- **`Cannot find module './node_modules/playwright-core'` after
  `npm i` in the cache folder**: npm installed into a parent folder's
  `package.json`. Add `{"private":true}` as `package.json` in the cache
  folder and install again, then remove what went into the parent.
