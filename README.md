# Pocket Dice Cup

A web app that turns the phone into a dice cup: shake it, put it down
screen-up, read the dice. The plan and the reasoning behind the stack are in
[docs/plan.md](docs/plan.md). The app's [privacy policy](PRIVACY.md) and
[support page](SUPPORT.md) are the ones the app stores link to.

## Develop

```sh
npm install
npm run dev          # desktop browser, http://localhost:3000
npm run dev:https    # for a phone on the same network
```

Motion sensors only work over HTTPS, so a phone needs `dev:https`. Open the
`https://<your-computer's-address>:3000` URL it prints in Safari, accept the
self-signed certificate warning, tap Start and allow motion access.

With no motion sensor, as on a desktop, click or tap the cup to shake it,
or press the space bar.
The button at the bottom shows the dice in dice notation ("3d6 + 1d20") and
opens a − and + row for each kind, d4 to d20, up to 12 dice in all, with
an × that takes out every die of that kind and a Reset back to the lone d6
the cup starts with; the dice are chosen between rolls and remembered for
next time. When the dice
settle, the total shows at the top, and they stay where they landed while the
phone is picked up and passed round, until the next shake or tap. To roll in
the hand without putting the phone down, tap Settle after the shake: the dice
drop as if the phone lay flat. A tap to roll again in the hand drops them the
same way. History lists the last 50 rolls, also kept
between visits. Style picks the finish of the dice, ivory by default, from
thirteen that all come with the app, in glossy resin, translucent and metal,
and the table they land on: green felt or a tabletop battle mat. Pro adds
neon dice that glow cyan and a deep space table. In the phone apps they
show with a lock, to try on in the cup before buying; the web sells nothing
and leaves them out (`?debug&pro&skin=neon&table=space` to see them). Both are
remembered. The ? button beside it opens an about page, at `/about`, that
says how each part works. Lying screen-down the dice still roll and are
heard and felt but are not drawn; a tap shows them, for a screen watched
elsewhere, as through iPhone Mirroring.

Add `?debug` to the URL to see the sensor reading, the shake level, the
current state and how long the physics takes a frame on screen. It also
starts the dice on a grid out from the middle with the same face up every
time, instead of at random places and faces. `?dice=` starts with other dice
than the remembered ones, as a number of d6 (`?dice=3`) or in dice notation
(`?dice=2d6+d20`), `?skin=` starts with another finish (`?skin=ebony`), and `?table=` on
another table (`?table=battlemat`). `?pro` unlocks Pro without buying it,
only with `?debug`.
"Copy trace" copies the last 30 seconds of readings as
JSON, for replaying in tests. The Haptics and Sound buttons open sliders for
tuning the feel and the clacks live; "Copy tuning" copies the values, to make
them the new defaults.

## Languages

The app is in English, simplified Chinese (`zh-CN`) and Hong Kong
traditional Chinese (`zh-HK`), following the browser's or the phone's
language; traditional Chinese from anywhere reads the Hong Kong text. The
text is in `app/locales/`, one JSON file per language, and
`tests/locale.test.ts` checks they all have the same keys. To add a
language, add its file, its code to `LOCALES` and `pickLocale` in
`app/utils/locale.ts`, its Nuxt UI locale in `app/app.vue`, its line in the
splash screen (`app/spa-loading-template.html`), its code to
`CFBundleLocalizations` in `ios/App/App/Info.plist`, an `.lproj` folder
in `ios/App/App` with the app's name and the launch screen's text, added to
the Xcode project, its code to `android/app/src/main/res/xml/locales_config.xml`,
and a `values-` folder in `android/app/src/main/res` with the app's name.
Dice notation stays "3d6" in every language.

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

`NUXT_PUBLIC_PRO=1` likewise unlocks Pro in the build without buying it.

Pro is sold as one non-consumable in-app purchase with the product id `pro`,
the same in App Store Connect and the Play Console, through
`CupStorePlugin.swift` (StoreKit 2) and `CupStorePlugin.java` (Play Billing
8). Without the product set up in the store, Unlock Pro says the store
could not be reached. Purchases are tried with a sandbox Apple ID on the
iPhone, and on Android with a licence tester account on a build installed
from a Play testing track.

In Xcode, pick your Apple ID under Signing & Capabilities, plug the iPhone
in and run. With a free Apple ID the app stops opening after 7 days, and
running it again from Xcode renews it. Haptics only play on a real device,
not in the simulator.

## Android app

The Android app is the same web build in a Capacitor shell, with a small
plugin that plays each hit on the vibrator at its strength, where the phone
can: a click or a soft tick on phones with those effects, a pulse of the
hit's strength on most others. It needs Android Studio, and builds with
the Java 21 that comes with it.

```sh
npm run android      # build, copy into android/ and open Android Studio
NUXT_PUBLIC_DEBUG=1 npm run android   # with the debug overlay
```

In Android Studio, pick a phone with USB debugging on, or an emulator, and
run. The debug build installs straight from there, with no account and no
expiry. The page can be inspected from Chrome at `chrome://inspect`. In the
emulator, Extended controls → Virtual sensors moves the phone, enough to
check a shake and putting it down, though not the vibration. Back closes
an open sheet, and from the cup leaves the app.

`android/` keeps the versions of Gradle, the Android plugin and the SDK
that Capacitor's template set; `npx cap migrate` moves them on with each
Capacitor release.

## Check

```sh
npm run lint
npm run typecheck
npm test
```
