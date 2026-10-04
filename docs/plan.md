Pocket Dice Cup — rebuild plan
==============================

A mobile-first web app that turns the phone into a dice cup. Pick the phone up,
shake it, feel and hear the dice rattle, put it down screen-up, and read the
result.

Goals
-----

Core:

- Shake the device like a dice cup; the dice respond to the real motion.
- While shaking, vibration and sound mimic the dice hitting the cup.
- Put the device down screen-up; the dice settle and show.

Extras:

- Set the number of dice.
- Set the kind of dice (1d3, 3d6, 1d20, mixed pools).
- Show the result as a popup when the dice are stable.
- Result history.
- Dice and table skins.
- Desktop support: click to throw.

Core idea: the phone is the cup
-------------------------------

The accelerometer reading (including gravity) is the pseudo-force that objects
inside the phone would feel. Each frame, the physics world's gravity is set to
`-accelerationIncludingGravity` in the device frame. The dice then rattle, hit
the walls and fall onto the screen without any separate shake-to-roll trigger.

- World: a closed box in the phone's frame. The floor is the table (behind the
  screen), the walls are the screen edges, the ceiling is the glass. The camera
  is fixed top-down, so the screen is a window into the box.
- Feedback: every dice-to-wall and dice-to-dice contact queues a haptic pulse
  and a clack sound, both scaled by impact force.
- Result: read from the simulation, never from a random number.

State machine:

| State    | Enters when                                         | Behaviour                                   |
|----------|-----------------------------------------------------|---------------------------------------------|
| idle     | app start, or after a result                        | dice at rest, UI enabled                    |
| shaking  | acceleration variance crosses a threshold           | touch input locked, haptics and sound on    |
| settling | gravity steady at screen-up and the phone is still  | dice come to rest                           |
| result   | all dice are asleep                                 | read faces, show popup, append to history   |

Stack
-----

- Nuxt + TypeScript, to match the other side projects. SPA mode (`ssr: false`),
  built with `nuxi generate` to static files; everything here is client-only,
  and the Capacitor shell needs a static bundle.
- three.js for rendering
- Rapier (`@dimforge/rapier3d-compat`) for physics
- Vue components for UI
- Vitest for unit tests
- npm, as in the other side projects
- Static PWA over HTTPS (sensors require a secure context), via `@vite-pwa/nuxt`

Hosting: GitHub Pages, deployed by a GitHub Actions workflow using Nitro's
`github_pages` preset (it adds the `.nojekyll` file that the `_nuxt/` folder
needs). A project page is served under `/<repo>/`, so the web build sets
`NUXT_APP_BASE_URL=/<repo>/`; the Capacitor build keeps the default `/`.

The engine (`core`, `physics`, `dice`, `input`, `feedback`, `render`) is plain
TypeScript with no Vue imports. One composable bridges it to the UI and exposes
only small reactive state (current state, pool, last result, history). three.js
and Rapier objects never go into reactive refs.

Architecture
------------

```
app/
  engine/
    core/      state machine, dice-pool model, notation parser ("3d6+1d20"), history store
    physics/   Rapier world, fixed 480 Hz step + CCD, convex-hull colliders, contact events
    dice/      per-die geometry and face-normal -> value tables
    input/     MotionSource interface: DeviceMotionSource | PointerSource
    feedback/  HapticsBackend interface: NativeBackend | VibrateBackend | NullBackend
               AudioEngine: Web Audio clack samples, pitch and gain per impact
    render/    three.js scene, skins
    simulation.ts  physics + motion analysis + state machine, no DOM (runs in Node tests)
    diceCup.ts     the simulation on a canvas, driven by a MotionSource every frame
  composables/ useDiceCup: creates the engine, exposes reactive state to the UI
  components/  settings sheet, result popup, history drawer, permission/start gate
  pages/       index.vue: canvas plus overlay UI
tests/engine/  Vitest, in Node, against the real Rapier WASM
```

World units are centimetres and accelerations are applied at full scale, so the
dice move in step with the hand. Real-size dice cross their own width in a few
milliseconds under a hard shake, which is why the physics steps at 480 Hz: at
120 Hz a die sank up to 9 mm into a wall, at 480 Hz about 2 mm.

Two interfaces carry most of the extras:

- `MotionSource` supplies an acceleration vector per frame. `DeviceMotionSource`
  reads the sensor; `PointerSource` synthesises a burst from a click or drag.
  Desktop support uses the same physics path as mobile.
- `HapticsBackend` plays a transient of a given intensity. `NativeBackend` calls
  Core Haptics through the iOS shell, `VibrateBackend` maps it to
  `navigator.vibrate`, and `NullBackend` covers browsers with neither.

Dice:

- One table of face normals per die type. The result is the face whose normal
  best aligns with "up" (for a d4, "down").
- Colliders are convex hulls built from the render geometry.
- Set: d4, d6, d8, d10, d12, d20. d3 is a d6 numbered 1-3 twice. d100 is two
  d10s. d10 needs a custom mesh (pentagonal trapezohedron).
- Pool cap of about 12 dice, for screen space and performance.

Skins are data objects: colours, material parameters, number style, floor
texture and sound set. Face textures are drawn to canvas atlases at load.

Phases
------

1. **Scaffold and core loop.** Nuxt project, Rapier box, one d6,
   `DeviceMotionSource` (iOS permission gate, iOS/Android sign normalisation),
   state machine, Wake Lock. Dev loop: `npm run dev:https` on the LAN
   (self-signed certificate), opened in Safari on the iPhone; motion sensors
   need a secure context. `?debug` shows the sensor reading and the state.
   Done when: shaking the iPhone and putting it down shows the correct face.
   Status: built and passing in Node tests and in desktop Chrome with
   synthetic motion events. Not yet tried on the iPhone; the iOS sensor sign
   flip and the shake thresholds are the two things to confirm there.
2. **Feedback and iOS shell.** Contact events feed a rate-limited haptic
   scheduler (about one transient per 30-40 ms, intensity by impact) and the
   audio engine. Add the Capacitor iOS shell and a custom Core Haptics plugin
   exposing `playTransient(intensity, sharpness)` as the `NativeBackend`; tune
   the feel on it. Also write the `VibrateBackend` (`navigator.vibrate`,
   8-40 ms pulses) for Android web. Set `navigator.audioSession.type =
   'playback'` so the mute switch does not silence the sound. Needs the most
   on-device tuning.
3. **Dice set and pool.** All geometries, mixed pools, the notation parser.
   A headless Node test rolls each die thousands of times and checks the
   distribution is roughly uniform.
4. **Result popup and history.** Per-die values and total when the dice settle.
   History in `localStorage`.
5. **Skins.** 3-4 dice skins and 3-4 table skins to start.
6. **Desktop and fallbacks.** Click or drag to throw, spacebar, and tap-to-roll
   on mobile when motion permission is denied.
7. **PWA polish.** Offline, installable, fullscreen, rendering paused while the
   phone is face-down.

Verification
------------

- Unit tests for pure logic: notation parser, face reading, state machine,
  shake/stillness detection against recorded sensor traces.
- Distribution test per die type (phase 3).
- Phases 1, 2 and 6 are checked on the iPhone and a desktop browser.
- No Android device is available. The Android web path (`VibrateBackend`,
  sensor sign convention) is written from the spec and stays untested until
  someone can try it on a device.

Native vs web tactile feedback
------------------------------

Native gives much better feedback: decisively on iOS, noticeably on Android.

|                 | Web                                                                                   | Native                                                                                   |
|-----------------|---------------------------------------------------------------------------------------|------------------------------------------------------------------------------------------|
| iOS haptics     | None during a shake, in any browser: Chrome and Firefox on iOS run on WebKit, which has no Vibration API. The hidden-switch hack stopped working from script in iOS 26.5 and now only ticks on a real tap. | Core Haptics: crisp transients with per-event intensity and sharpness, synced with audio. |
| Android haptics | `navigator.vibrate` in Chrome, Edge and Samsung Internet (Firefox removed it in 129). On/off with duration, no amplitude. | `VibrationEffect` with amplitude control and tick/click primitives. Quality depends on the motor. |
| Sensors         | About 60 Hz. Permission prompt on iOS.                                                | 100 Hz or more. No prompt.                                                               |

On the web, iPhone users get sound only. Android users get a coarse
buzz-per-impact rattle with no intensity variation.

Decision: iPhone is the primary target and the only dev device. The app stays
one web codebase, wrapped in a Capacitor iOS shell from phase 2 with a small
custom Core Haptics plugin (roughly 100 lines of Swift). The stock
`@capacitor/haptics` plugin is too coarse. A full native rewrite is not
justified, because rendering and physics would stay in a WebView either way.
The web/PWA build still ships for desktop and as the no-install Android
version. An Android shell with a Kotlin plugin is deferred until there is a
device to test on.

Distribution: the iOS build starts personal, installed from Xcode with a free
Apple ID (builds expire after 7 days). If the result is good enough, publish to
the App Store, which needs the paid developer account ($99/year).

References
----------

- https://caniuse.com/mdn-api_navigator_vibrate
- https://www.w3.org/TR/vibration/
- https://github.com/tijnjh/ios-haptics
- https://haptics-web.vercel.app/
