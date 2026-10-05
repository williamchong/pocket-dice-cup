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

Add `?debug` to the URL to see the sensor reading, the shake level and the
current state on screen. It also starts the die in the middle with the same
face up every time, instead of at a random place and face. "Copy trace" copies
the last 30 seconds of readings as JSON, for replaying in tests.

## iPhone app

The iOS app is the web build in a [Capacitor](https://capacitorjs.com) shell,
with a small Core Haptics plugin so the phone taps on each hit; iPhone
browsers have no vibration at all. It needs Xcode.

```sh
npm run ios          # build, copy into ios/ and open Xcode
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
