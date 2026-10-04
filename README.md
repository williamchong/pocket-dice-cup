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
current state on screen.

## Check

```sh
npm run lint
npm run typecheck
npm test
```
