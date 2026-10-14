# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Pocket Dice Cup turns the phone into a dice cup: a Nuxt SPA (`ssr: false`) rendering dice with three.js and simulating them with Rapier, driven by the accelerometer, also shipped as Capacitor iOS and Android shells. `docs/plan.md` holds the design, the reasoning behind it, and each phase's status — read it before larger changes, and update the phase's status when a change finishes or checks something it lists as not yet checked.

## Commands

```sh
npx vitest run                         # all tests, once (fairness rolls skipped)
npx vitest run tests/engine/pool.test.ts -t "<name>"   # one file / one test
npm run test:fairness                  # slow χ² rolls of every die kind (FAIRNESS=1)
npm run lint
npm run typecheck
```

`npm test` starts vitest in **watch mode** and never exits; use `npx vitest run` from an agent. CI runs lint, typecheck and tests, then `npm run generate` for GitHub Pages and a debug APK build of the Android shell.

To run and drive the app in a browser (synthetic shakes, trace replay, screenshots), use the `run-pocket-dice-cup` skill.

## Architecture

- **The phone is the cup.** Each frame the physics world's gravity is set from the sensor's `accelerationIncludingGravity` in the device frame; there is no "shake to roll" trigger, and the result is read from the settled dice's faces, never from a random number.
- **`app/engine/` is plain TypeScript with no Vue/Nuxt imports.** `simulation.ts` (`CupSimulation`: physics + `MotionAnalyser` + state machine) has no DOM, so tests in `tests/engine/` drive it in Node against the real Rapier WASM (`RAPIER.init()` in `beforeAll`). `diceCup.ts` wraps it with the three.js scene, sound, haptics and a `MotionSource`.
- **`app/composables/useDiceCup.ts` is the only bridge to Vue.** It exposes small refs (state, result, pool…). three.js and Rapier objects must never go into reactive refs — Vue's proxies would wrap objects read thousands of times a frame.
- **State machine** (`engine/core/stateMachine.ts`): idle → shaking → settling → result. A shake restarts from any state; in `result` the dice keep the pull they settled under, so picking the phone up doesn't disturb them.
- **Physics scale:** world units are centimetres and accelerations are full scale; the step is a fixed 480 Hz because real-size dice tunnel into walls at lower rates. Tuning constants in `physics/world.ts`, `core/motionAnalyser.ts` and `feedback/cupFeedback.ts` carry comments with the measurements behind them — keep that reasoning when changing a value.
- **Sensor sign:** the engine uses the W3C convention (screen-up reads z = +9.81); `DeviceMotionSource` flips iOS's opposite sign. Recorded iPhone traces in `tests/fixtures/traces/` are stored after the flip and are replayed by the tests; new ones come from `?debug` → "Copy trace".
- **Dice shapes** are one table per kind in `engine/dice/shapes.ts` (vertices, faces, values), from which the collider, the face reading and the mesh are all derived. Skins are data objects in `engine/render/skins.ts`.
- **Haptics** go through the `HapticsBackend` interface: `NativeBackend` calls the `CupHaptics` Capacitor plugin (Swift in `ios/App/App/CupHapticsPlugin.swift`, Java in `android/.../CupHapticsPlugin.java` — keep the two in step), `VibrateBackend` uses `navigator.vibrate`.

## Gotchas

- `?debug` starts the dice on a fixed grid with the same face up instead of at random — runs are repeatable but not a representative roll. `NUXT_PUBLIC_DEBUG=1` turns the overlay on for the native shells, which have no address bar.
- Motion sensors need HTTPS, so testing on a phone uses `npm run dev:https`; haptics only play on a real device or in the native shells.
- The native shells bundle `.output/public` from `nuxt generate` (served at `/`); the GitHub Pages build sets `NUXT_APP_BASE_URL` to the project path, so keep asset URLs relative.
- Adding a language touches many places across web, iOS and Android; the full list is in README.md → Languages. `tests/locale.test.ts` checks all locale files share the same keys.

## Conventions

- Commits: gitmoji followed by a plain-English sentence saying what changed and why (see `git log`).
- Comments and docs are full prose sentences explaining *why*, with measurements where a value was tuned; match that style.
