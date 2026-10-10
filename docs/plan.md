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
- Set the kind of dice (3d6, 1d20, mixed pools).
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
    core/      state machine, dice-pool model, notation parser ("3d6+1d20")
    physics/   Rapier world, fixed 480 Hz step + CCD, convex-hull colliders, contact events
    dice/      per-die geometry and face-normal -> value tables
    input/     MotionSource interface: DeviceMotionSource
    feedback/  CupFeedback: impacts -> sound and rate-limited haptic pulses
               HapticsBackend interface: NativeBackend | VibrateBackend
               ClackSound: Web Audio clacks synthesised per impact and surface
    render/    three.js scene, skins
    simulation.ts  physics + motion analysis + state machine, no DOM (runs in Node tests)
    diceCup.ts     the simulation on a canvas, driven by a MotionSource every frame
  composables/ useDiceCup: creates the engine, exposes reactive state to the UI
  components/  settings sheet, result popup, history drawer, permission/start gate
  utils/       roll history and dice count, kept in localStorage
  pages/       index.vue: canvas plus overlay UI
tests/engine/  Vitest, in Node, against the real Rapier WASM
```

World units are centimetres and accelerations are applied at full scale, so the
dice move in step with the hand. Real-size dice cross their own width in a few
milliseconds under a hard shake, which is why the physics steps at 480 Hz: at
120 Hz a die sank up to 9 mm into a wall, at 480 Hz about 2 mm.

Two interfaces carry most of the extras:

- `MotionSource` supplies an acceleration vector per frame. `DeviceMotionSource`
  reads the sensor. A click or tap instead hits the dice up into the air with a
  random push and spin: a synthetic shake gentle enough to watch on a desktop
  slid the dice without turning them, so they mostly landed on the face they
  started on.
- `HapticsBackend` plays a transient of a given intensity. `NativeBackend` calls
  Core Haptics through the iOS shell, `VibrateBackend` maps it to
  `navigator.vibrate`, and browsers with neither get no backend.

Dice:

- One table of face normals per die type. The result is the face whose normal
  best aligns with "up" (for a d4, "down").
- Colliders are convex hulls built from the render geometry.
- Set: d4, d6, d8, d10, d12, d20. d10 needs a custom mesh (pentagonal
  trapezohedron). No d3 or d100.
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
   Status: done. Shake and put-down detection and the iOS sensor sign are
   tested against motion traces recorded on the iPhone (`tests/fixtures/traces`).
2. **Feedback and iOS shell.** Contact events feed a rate-limited haptic
   scheduler (about one transient per 30-40 ms, intensity by impact) and the
   audio engine. Add the Capacitor iOS shell and a custom Core Haptics plugin
   exposing `playTransient(intensity, sharpness)` as the `NativeBackend`; tune
   the feel on it. Also write the `VibrateBackend` (`navigator.vibrate`,
   8-30 ms pulses) for Android web. Needs the most
   on-device tuning.
   Status: done. The physics measures each hit from the change in a die's
   velocity and tells the floor, the walls and the glass apart. Each hit plays
   a synthesised clack: a soft thud on the felt floor and a dull knock on the
   walls and the glass, all through a low-pass at 650 Hz, tuned by ear on an
   iPhone Air and a MacBook Pro. A brighter click sounded like dice in a tin
   rather than a lined cup. Android web vibrates through `navigator.vibrate`.
   The audio session is `ambient`, so the iOS mute switch silences it, as it
   does in games, and the app needs no mute button of its own. The Capacitor
   shell (`ios/`) and the Core Haptics plugin are built: each pulse carries a
   sharpness as well as an intensity, soft for the felt floor and crisp for
   the walls and the glass. The shell is held in portrait and keeps the
   screen on natively. Checked on the iPhone in the app: the motion prompt
   and readings, shake and put-down, the clacks, silence with the mute switch
   on, other apps' music carrying on under the clacks, and the haptics,
   including after the app has been idle or in the background. The haptic
   strength, sharpness and pulse gap are still at their first values; the
   debug overlay has sliders for tuning them and the sound on the phone.
3. **Dice set and pool.** All geometries, mixed pools, the notation parser.
   A headless Node test rolls each die thousands of times and checks the
   distribution is roughly uniform.
   Status: pools of up to 12 d6 are built. New dice are laid where their
   square on the floor clears the others; when the floor is full, a die goes
   in under the glass and falls on top. Hits between two dice are told apart
   from hits on the cup by the contact normal, heard once per pair with a
   shorter, higher click. Each frame's pulse is sized by the summed speed of
   its hits, so dice hitting the cup together feel heavier than one, and a
   hit between dice adds only 0.3 of its speed, since the hand holds the
   cup. The dice are 12 mm: at 16 mm a dozen jammed against the walls. The
   dice are chosen between rolls from a button at the bottom of the screen
   that shows them in dice notation ("3d6 + 1d20") and opens a − and + row
   per kind, up to 12 in all. The pool is kept in `localStorage` as
   notation, and `?dice=` takes notation too. Each shape is one table of
   vertices, faces and values (`dice/shapes.ts`), from which come the
   collider (a rounded convex hull; the d6 keeps its rounded box), the face
   reading and the mesh, numbered from a texture atlas, one draw call per
   kind. Sizes are a standard 16 mm set's scaled to the 12 mm d6. The d10 is
   a pentagonal trapezohedron printed 0-9 and read as 1-10; the d4 reads the
   face it lies on, shown at its top corner. New dice are laid where their
   circle on the floor clears the others. `npm run test:fairness` rolls 1,200
   dice per kind (100 full cups) and checks the counts are uniform by χ², all
   six well inside the limit, and that a lone die settles flat (0-2 in 100
   cocked, the d12 and d20 leaning on the bevels). A full cup piles up
   against a wall, and a fifth of the dice came to rest leaning on the
   others; now, once the dice stop with any cocked, they lose their grip
   for up to a second, with drag, so a propped die slides off and the pile
   spreads, moving at most about two dice across. That leaves 0.2-2.5% of a
   full cup cocked, also checked, read by the face nearest up. Not yet
   checked on the iPhone: whether the slip can be seen. One cup of twelve d12 in 100 took 10.6 s to settle, a die creeping off
   the others. The hulls cost about what the boxes do: about 0.4 ms of
   physics a frame for 12 dice of any kind in Node. Not yet checked on the
   iPhone: the frame cost of many dice, whether the 8-voice cap drops clacks,
   how the die-to-die clack and feel sound and feel, and how the new shapes
   look and roll. The d3 and the d100 are dropped.
4. **Result popup and history.** Per-die values and total when the dice settle.
   History in `localStorage`.
   Status: done in a desktop browser. When the dice settle, a card at the
   top of the screen shows the total and, for more than one die, each value.
   It lets taps through, so tapping or shaking again re-rolls, and it goes
   when the next roll starts or the count changes. Each result is added to
   a history of the last 50 rolls, kept in `localStorage` and opened from a
   History button beside the dice count; a shake closes it. Not yet checked
   on the iPhone.
5. **Skins.** 3-4 dice skins and 3-4 table skins to start.
   Status: dice skins done, all free. A skin is a data object
   (`engine/render/skins.ts`): body and ink colours plus roughness,
   metalness and clearcoat, which the looks turn into face atlases and a
   `MeshPhysicalMaterial`. Seven ship: ivory, ebony, casino red, sapphire,
   emerald, amethyst and gold. A Style sheet beside History shows a d6 in
   each, swaps the cup's looks in place without disturbing a roll, and the
   choice is kept in `localStorage` (`?skin=` overrides it). Not yet done:
   table skins, and anything paid. If skins are ever sold, add a `locked`
   flag to the data and an entitlement check in the sheet; the renderer
   need not know.
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
