# Pocket Dice Cup

A web app that turns the phone into a dice cup: shake it, put it down
screen-up, read the dice. The plan and the reasoning behind the stack are in
[docs/plan.md](docs/plan.md).

## Develop

```sh
npm install
npm run dev          # desktop browser, http://localhost:3000
npm run dev:https    # for a phone on the same network
```

Motion sensors only work over HTTPS, so a phone needs `dev:https`. Open the
`https://<your-computer's-address>:3000` URL it prints in Safari, accept the
self-signed certificate warning, tap Start and allow motion access.

With no motion sensor, as on a desktop, click or tap the cup to shake it.
The button at the bottom shows the dice in dice notation ("3d6 + 1d20") and
opens a − and + row for each kind, d4 to d20, up to 12 dice in all; the
dice are chosen between rolls and remembered for next time. When the dice
settle, the total shows at the top; History lists the last 50 rolls, also
kept between visits.

Add `?debug` to the URL to see the sensor reading, the shake level, the
current state and how long the physics takes a frame on screen. It also
starts the dice on a grid out from the middle with the same face up every
time, instead of at random places and faces. `?dice=` starts with other dice
than the remembered ones, as a number of d6 (`?dice=3`) or in dice notation
(`?dice=2d6+d20`). "Copy trace" copies the last 30 seconds of readings as JSON, for replaying in tests. The
Haptics and Sound buttons open sliders for tuning the feel and the clacks
live; "Copy tuning" copies the values, to make them the new defaults.

## iPhone app

The iOS app is the web build in a [Capacitor](https://capacitorjs.com) shell,
with a small Core Haptics plugin so the phone taps on each hit; iPhone
browsers have no vibration at all. It needs Xcode.

```sh
npm run ios          # build, copy into ios/ and open Xcode
```

The app has no address bar for `?debug`; build it with the debug overlay
turned on instead:

```sh
NUXT_PUBLIC_DEBUG=1 npm run ios
```

In Xcode, pick your Apple ID under Signing & Capabilities, plug the iPhone
in and run. With a free Apple ID the app stops opening after 7 days, and
running it again from Xcode renews it. Haptics only play on a real device,
not in the simulator.

## Check

```sh
npm run lint
npm run typecheck
npm test
```
