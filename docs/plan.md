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

In `result` the dice keep the pull they came to rest under instead of the
sensor's, so picking the phone up to show the roll leaves them where they are
and silent. Only a shake or a tap rolls them again.

A gentle shake can slide a die about on one face, as it would in a real cup:
the recorded gentle iPhone shake left a d6 on its face in 600 rolls in a row,
and a d20 on its face about half the time, rocking onto a neighbour and back.
The trick is left to work, and a faint ring on the felt marks each die that
did not roll over: one that ended on the face it began the roll with, which
never tipped past sideways. The ring is lit and shaded like the felt, fades in
with the result (at once under reduced motion) and goes with the next roll;
the result card says the count to screen readers only. A die against a wall
has part of its ring hidden where the felt curves up into it. Hard shakes flag no dice; with the flagged ones left
out, the rest repeat their last face about as often as fair dice do.

A phone held in the hand is never put down flat enough to reach `settling`,
and its dice slide into the low wall. While a roll is under way and the sensor
is sending readings, a Settle button gives the dice a straight-down pull, as
if the phone lay flat and still, and the roll goes on to a result. It spins
until the dice come to rest, so the wait reads as the roll ending; in Chinese
it is 開盅 (开盅), "open the cup", as said when a real 骰盅 is lifted, since
放低 (put it down) read as an instruction rather than a button. A tap used to
let go of that pull, so with the phone still in the hand the dice slid into
the low wall again and waited there for Settle. Now a tap with the phone
neither resting screen-up nor being shaken lays the dice flat in the same
way, and one lying still on a table, even tilted up to 45°, keeps its pull.
Not yet checked on the iPhone.

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
  the `CupHaptics` plugin of the native shells, Core Haptics on iOS and the
  vibrator on Android, `VibrateBackend` maps it to `navigator.vibrate`, and
  browsers with neither get no backend.

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
   WebKit only gives a page motion access from a tap, so the app opened on
   a "tap to begin" screen and showed the system's motion prompt. The app
   now reads the sensor through Core Motion instead, in a second plugin
   (`CupMotionPlugin.swift`, `NativeMotionSource`), which needs no
   permission: the cup senses a shake from launch. It sends Core Motion's
   gravity plus the hand's acceleration, 60 times a second, which is what
   WebKit turns into `accelerationIncludingGravity` at the same rate, so the
   shake tuning and the recorded traces still hold; the raw accelerometer
   would not match them. Readings stop while the app is in the background.
   Checked on the iPhone: the readings arrive at about 60 a second and lying
   still read 1 g. Not yet checked on the iPhone: that no prompt or start
   screen shows, and a shake, put-down and trace compared with the fixtures.
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
   per kind, up to 12 in all, each named beside its picture, as a d8, a d10
   and a d12 are hard to tell apart at that size. The pool is kept in `localStorage` as
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
   A die could come to rest under the card, where it could not be seen to
   check the total. When the card would hide one, its centre under the card
   or within half its radius of an edge, the card goes down above the
   buttons, unless it would hide more there. Clipping only a corner does not
   count: with a full cup of eight both places nearly always clip one. In 16
   tosses of four d6 in the browser it went down three times, each for a
   die under the top, and hid no die in any. Not yet checked on the iPhone.
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
   Status: a click or tap tosses the dice, with or without a sensor, and
   when motion access is refused or there is no sensor a line under the
   buttons says so. The space bar tosses too, unless a button or field has
   the focus, where it presses that instead. A tap throws the dice away
   from gravity, not off the screen: with the phone tilted 40° or more they
   fell back into the corner by the bottom wall and slid there, and a d6
   landed on its last face a quarter of the time over 1,200 taps in a row.
   Now 15-18% at every tilt, against 17% for a fair die, checked by
   `npm run test:fairness`. A d4 among other dice still keeps its face
   about 30% of the time, against 25%, once the phone is tilted 40° or
   more. Not yet checked on the iPhone: how the harder throw looks and
   sounds. Not yet done: drag to throw.
   Nothing on screen said to shake the phone, so a first-time user tapped
   and took it for a plain dice roller. The tap that grants motion access
   on iOS now says to shake afterwards, and once the sensor is sending
   readings, a line under the buttons says to shake the phone like a dice
   cup and lay it flat whenever the cup is still, until the first roll the
   phone was shaken for; that one shake is kept in `localStorage`. Beside
   it a drawn hand shakes a phone, its dice rattling, in five bursts each
   time the hint comes, then stops: SVG is not animated on the compositor,
   so a loop kept the page drawing while the dice were asleep. Not yet
   checked on the iPhone.
   A ? button beside Style opens an about page at `/about`, which says what
   the app is and how each part works, in the reader's language. It is a
   child route of the cup's page, so the dice stay loaded behind it, and has
   an address of its own for search engines: the static build writes it out
   as `about/index.html`, as GitHub Pages would otherwise serve the 404
   page, with a 404 status, for it. The page's head also carries an English
   description for crawlers and link previews that run no script. Not yet
   checked on the iPhone, or with Android's back gesture.
7. **PWA polish.** Offline, installable, fullscreen, rendering paused while the
   phone is face-down.
   Status: screen-down, the dice still roll and are heard and felt, but are
   not drawn. Left still screen-down for 2 s with the dice asleep, the frames
   stop and the web wake lock is let go, until a reading moves the phone.
   This works in the shells too, though they keep the screen on natively, so
   there it stays lit. Not yet done: offline, installable, fullscreen.
8. **Android shell.** The same web build in a Capacitor Android shell, with a
   `CupHaptics` plugin in Java beside the Swift one.
   Status: built, and checked in the emulator (Pixel 7a, Android 16,
   WebView 146), not yet on a phone. The plugin plays each hit as the best
   the phone has: a click for the walls, the glass and the other dice and
   a low tick for the felt, at the hit's strength, where the phone has
   those primitives (Android 11+); a pulse of the hit's strength, shorter
   for a crisp hit, where it controls the amplitude; or a pulse whose
   length grows with the hit, as on the web. It vibrates as media, so the
   phone's touch-vibration setting does not silence the dice. The shell
   is held in portrait, keeps the screen on, and shows the die on the
   felt as Android's launch screen until the page's own loading screen
   takes over; unlike the iOS WebView, Android's draws that page before
   the engine has loaded, so it needs no native cover. The page is laid
   out under the status and navigation bars, with light icons on them,
   and keeps clear of them by the safe-area insets as on the iPhone. Back
   closes an open sheet, and otherwise sends the app to the background.
   The app's name and the page follow Android 13's per-app language.
   Checked in the emulator: the sensor sign, a shake and putting it down,
   the plugin receiving each hit, back, the insets, the icon and the
   Hong Kong Chinese text. Not yet checked on a phone: how the haptics
   feel and which of the three the phone plays, the physics' frame cost
   on a mid-range phone, and whether other apps' music carries on under
   the clacks. Android has no mute switch; the clacks follow the media
   volume. CI builds the debug APK on every push.

Languages
---------

English, simplified Chinese and Hong Kong traditional
Chinese, by vue-i18n with every language in the bundle, chosen from the
system's language with no switcher. The iOS app lists them in
`CFBundleLocalizations`, so its WebView reports the language iOS picked
for the app and Settings offers a per-app language. The Android app lists
them in `locales_config.xml` for the same, and its WebView follows the
language picked there. The debug overlay
stays in English. The app's name is 口袋骰盅 in both kinds of Chinese,
on the home screen (`InfoPlist.strings`), the launch screen
(`LaunchScreen.strings`), the web splash and the page title. Checked in
the iOS simulator launched in zh-HK and zh-Hans; not yet checked on the
iPhone.

Verification
------------

- Unit tests for pure logic: notation parser, face reading, state machine,
  shake/stillness detection against recorded sensor traces.
- Distribution test per die type (phase 3).
- Phases 1, 2 and 6 are checked on the iPhone and a desktop browser.
- No Android device is available. The Android app is checked in the
  emulator, whose virtual sensors cover the sign convention and the
  shake and put-down; the vibration, in the app (`CupHaptics`) and on the
  web (`VibrateBackend`), stays untested until someone can try it on a
  device.

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
version. The Android shell (phase 8) followed the same way, with a Java
plugin, as Capacitor's Android template is Java. The iOS app reads the
sensor through Core Motion, so it needs no tap to begin (phase 2); the
Android app still reads it through the WebView, which asks no permission,
and the engine only takes one reading a frame, so a faster native rate
would gain it nothing. It is built and checked in the
emulator while there is no Android device to tune its feel on.

Distribution: the iOS build starts personal, installed from Xcode with a free
Apple ID (builds expire after 7 days). If the result is good enough, publish to
the App Store, which needs the paid developer account ($99/year).

References
----------

- https://caniuse.com/mdn-api_navigator_vibrate
- https://www.w3.org/TR/vibration/
- https://github.com/tijnjh/ios-haptics
- https://haptics-web.vercel.app/
