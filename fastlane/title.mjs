#!/usr/bin/env node
// Makes the App Store's title asset, the wide picture at the top of the
// product page and in search results: the icon, name and tagline on the felt's
// green, beside a roll in the running app, in each store language and in both
// sizes App Store Connect takes, into fastlane/title/<locale>/. deliver does
// not upload these; they go in by hand, under the version's 标题 (Title).
// Usage: npm run dev, then node fastlane/title.mjs [baseUrl]
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chosenLocales, chromium, feltGreen, hide, locales, openCup, rollUntil, tap, typeset } from './cup.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'title')
const icon = `data:image/png;base64,${readFileSync(join(here, '../ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png')).toString('base64')}`

// The two sizes App Store Connect lists for a title asset.
const sizes = [{ width: 3840, height: 1646 }, { width: 5244, height: 2950 }]
// The renderer draws at most 2× (MAX_PIXEL_RATIO in engine/render/scene.ts),
// so the cup is rendered at half size, 2× being the sharpest it gets.
const scale = 2
// The share of the width the cup takes, on the right, leaving the left to the words.
const cupShare = 0.58

const text = {
  'en-US': ['Pocket Dice Cup', 'Roll like a real dice cup', 'Real 3D dice for board games and tabletop RPGs'],
  'zh-Hans': ['口袋骰盅', '像真的骰盅一样摇', '真实 3D 骰子，桌游、跑团都适用'],
  'zh-Hant': ['口袋骰盅', '像真的骰盅一樣搖', '真實 3D 骰子，桌遊、TRPG 都適用'],
}

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })
// The banner is laid out in a browser of its own: a 4–5K screenshot taken in
// the one that just ran WebGL failed about half the time ("Unable to capture
// screenshot"), and never did in a fresh one.
const layout = await chromium.launch()

/** A roll of mixed dice in a cup of `viewport`, without its buttons, as a JPEG at 2×. */
async function capture(viewport, locale) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: scale, hasTouch: true, locale, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await openCup(page, 'dice=3d6+d8+d12+d20')
  await hide(page, '.cup__controls')
  // A ring on a die that only slid would ask a question the banner does not answer.
  await rollUntil(page, tap(page), false, 'title')
  const shot = await page.screenshot({ type: 'jpeg', quality: 95 })
  await context.close()
  return shot
}

/** The words on the left, the cup on the right, at `size`. */
async function compose(size, shot, words, style) {
  const [name, tagline, detail] = words.map(t => typeset(t, style))
  // Laid out at the cup's scale and taken at 2×, as Chromium will not capture a 3840 px wide page at 1×.
  const half = { width: size.width / scale, height: size.height / scale }
  const page = await layout.newPage({ viewport: half, deviceScaleFactor: scale })
  const cupWidth = Math.round(half.width * cupShare)
  const unit = half.height / 100
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div style="width:${half.width}px;height:${half.height}px;display:flex;overflow:hidden;
      background:radial-gradient(90% 120% at 20% 50%, ${feltGreen});
      font-family:${style.font};color:#fff">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;padding:0 ${7 * unit}px 0 ${9 * unit}px">
        <img src="${icon}" style="width:${17 * unit}px;height:${17 * unit}px;border-radius:22.5%;
          box-shadow:0 ${unit}px ${4 * unit}px rgba(0,0,0,.4)">
        <div style="font-size:${10.5 * unit}px;font-weight:700;letter-spacing:-.01em;line-height:1.05;margin-top:${5 * unit}px;word-break:keep-all">${name}</div>
        <div style="font-size:${5.6 * unit}px;font-weight:600;line-height:1.2;margin-top:${2.4 * unit}px;word-break:keep-all;text-wrap:balance">${tagline}</div>
        <div style="font-size:${3.6 * unit}px;opacity:.75;line-height:1.3;margin-top:${2 * unit}px;word-break:keep-all;text-wrap:balance">${detail}</div>
      </div>
      <img src="data:image/jpeg;base64,${shot.toString('base64')}" style="width:${cupWidth}px;height:${half.height}px;display:block">
    </div></body></html>`)
  await page.evaluate(() => document.fonts.ready)
  // PNG, as App Store Connect takes no other format for the header, and a JPEG fails its processing.
  const image = await page.screenshot({ type: 'png' })
  await page.close()
  return image
}

for (const locale of chosenLocales()) {
  const style = locales[locale]
  mkdirSync(join(out, locale), { recursive: true })
  for (const size of sizes) {
    const viewport = { width: Math.round(size.width * cupShare / scale), height: size.height / scale }
    const shot = await capture(viewport, style.app)
    const file = join(out, locale, `${size.width}x${size.height}.png`)
    writeFileSync(file, await compose(size, shot, text[locale], style))
    console.log(file)
  }
}
await Promise.all([browser.close(), layout.close()])
