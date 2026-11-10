#!/usr/bin/env node
// Takes the App Store screenshots: five scenes of the running app in each
// store language, each under a headline, at the 6.9" iPhone's 1320×2868 px,
// into fastlane/screenshots/<locale>/ where `fastlane metadata` uploads them.
// What only the iPhone app shows, the Lock Screen's roll, is framed from a
// simulator screenshot kept in fastlane/screenshots-raw/.
// Usage: npm run dev, then node fastlane/screenshots.mjs [baseUrl]
// playwright-core comes from the run-pocket-dice-cup skill's cache folder
// ($PLAYWRIGHT_DIR, default ~/.cache/pocket-dice-driver), as it is not a
// project dependency.
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { sendMotion, shakeSamples } from '../.claude/skills/run-pocket-dice-cup/motion.mjs'

const playwrightDir = process.env.PLAYWRIGHT_DIR ?? join(homedir(), '.cache/pocket-dice-driver')
const { chromium } = createRequire(join(playwrightDir, 'package.json'))('playwright-core')
const base = process.argv[2] ?? 'http://localhost:3000/'
const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'screenshots')
// Outside screenshots/, where deliver would take a folder for a language.
const rawDir = join(here, 'screenshots-raw')

// The 6.9" iPhone in points; at 3× it is the 1320×2868 the store asks for.
const phone = { width: 440, height: 956 }
const canvas = { width: 1320, height: 2868 }

// Store locale → the app's language and the font for its script.
// Font names are single-quoted, as they go inside a double-quoted style attribute.
const locales = {
  'en-US': { app: 'en-US', font: "-apple-system, 'Helvetica Neue', sans-serif" },
  'zh-Hans': { app: 'zh-CN', font: "'PingFang SC', sans-serif", cjk: true },
  'zh-Hant': { app: 'zh-HK', font: "'PingFang HK', 'PingFang TC', sans-serif", cjk: true },
}

// Each scene shows what one thing the app does gets someone at the table.
// `shake` rolls with a shake and lays the phone down, as on a real phone,
// `slid` rolls until a die only slid and wears its ring, `sheet` opens the
// pool, History or Style sheet over the cup, and `raw` frames a screenshot
// from the iOS simulator instead, for what only the iPhone app shows.
const scenes = [
  {
    name: 'shake',
    query: 'dice=3d6',
    shake: true,
    text: {
      'en-US': ['Roll like a real dice cup', 'Shake, hear them rattle, set it down, read the total'],
      'zh-Hans': ['像真的骰盅一样摇', '摇一摇，听骰子作响，放下就看总数'],
      'zh-Hant': ['像真的骰盅一樣搖', '搖一搖，聽骰子作響，放下就看總數'],
    },
  },
  {
    name: 'lockscreen',
    raw: 'lockscreen.png',
    text: {
      'en-US': ['Check the roll without reopening', 'On the Lock Screen and in the Dynamic Island while you read the rules'],
      'zh-Hans': ['不用切回 App 也能看结果', '查规则、记分时，结果就在锁定屏幕和灵动岛上'],
      'zh-Hant': ['不用切回 App 也能看結果', '查規則、記分時，結果就在鎖定畫面和動態島上'],
    },
  },
  {
    name: 'fair',
    query: 'dice=4d6&skin=ebony',
    slid: true,
    text: {
      'en-US': ['Rolls the whole table can trust', 'Read from the faces the dice land on, with a ring on any die that only slid'],
      'zh-Hans': ['全桌都信得过的一掷', '点数取自骰子朝上的一面，只滑不滚的骰子会被圈出'],
      'zh-Hant': ['全桌都信得過的一擲', '點數取自骰子朝上的一面，只滑不滾的骰子會被圈出'],
    },
  },
  {
    name: 'dice',
    query: 'dice=d4+d8+d12+d20&skin=gold&table=battlemat',
    // Opened before any roll, as the result card would sit over the sheet.
    rolls: 0,
    sheet: 'pool',
    text: {
      'en-US': ['Every die your game calls for', 'd4 to d20, up to 12 at once, for tabletop RPGs and board games'],
      'zh-Hans': ['游戏要什么骰子都有', 'd4 到 d20，一次最多 12 颗，跑团、桌游都适用'],
      'zh-Hant': ['遊戲要什麼骰子都有', 'd4 到 d20，一次最多 12 顆，TRPG、桌遊都適用'],
    },
  },
  {
    name: 'style',
    query: 'dice=2d6&skin=cherry',
    sheet: 'style',
    text: {
      'en-US': ['Dice that suit your table', '13 finishes from ivory to gold, on green felt or a battle mat'],
      'zh-Hans': ['挑一副喜欢的骰子', '13 种骰子款式，绿色绒布或战斗地图任选'],
      'zh-Hant': ['挑一副喜歡的骰子', '13 種骰子款式，綠色絨布或戰鬥地圖任選'],
    },
  },
  {
    name: 'history',
    query: 'dice=2d6+d20&skin=emerald',
    rolls: 6,
    sheet: 'history',
    text: {
      'en-US': ['Settle who rolled what', 'Your last 50 rolls, and the dice stay put as the phone goes round'],
      'zh-Hans': ['谁掷了几点，一查便知', '保留最近 50 次，传手机时骰子也不动'],
      'zh-Hant': ['誰擲了幾點，一查便知', '保留最近 50 次，傳手機時骰子也不動'],
    },
  },
]

const browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader'] })

// The cup's buttons, in order.
const sheets = ['pool', 'history', 'style']
const resultCard = page => page.locator('[role=status].result')

/** Rolls with `trigger` and waits for the dice to settle; true when a die only slid and wears its ring. */
async function settle(page, trigger) {
  const rolling = trigger()
  // The card goes once the dice move; waited for, so the last roll's card is not read as this one's.
  await resultCard(page).waitFor({ state: 'hidden', timeout: 30_000 })
  await rolling
  await resultCard(page).waitFor({ timeout: 30_000 })
  return await resultCard(page).locator('.sr-only').count() > 0
}

/** One scene of the app, as a JPEG at 3×, which the framing scales down anyway. */
async function capture(context, scene) {
  const page = await context.newPage()
  // Without ?debug the dice start at random, as a real roll does.
  await page.goto(`${base}?${scene.query}`)
  await page.locator('.cup__controls').waitFor({ timeout: 60_000 })
  // The dev server's DevTools pill would show in the shot.
  await page.addStyleTag({ content: '#nuxt-devtools-container, nuxt-devtools-inspect-panel { display: none !important }' })
  const trigger = scene.shake
    ? () => sendMotion(page, shakeSamples(1800, 3000))
    : () => page.mouse.click(phone.width / 2, phone.height / 3)
  for (let i = 0; i < (scene.rolls ?? 1); i++) {
    // A die that only slid shows a ring: rolled again, unless the ring is the point.
    // About 1 tap roll in 6 leaves a die that only slid, so 60 tries almost never runs out.
    for (let tries = 1; (await settle(page, trigger)) !== Boolean(scene.slid); tries++) {
      if (tries >= 60) throw new Error(`${scene.name}: no roll in 60 came out as wanted`)
    }
  }
  if (scene.sheet) {
    // The card is placed clear of the dice, which can put it over the sheet;
    // the sheet is what the shot is of, and History's first row repeats the roll.
    await page.addStyleTag({ content: '[role=status].result { display: none !important }' })
    await page.locator('.cup__controls button').nth(sheets.indexOf(scene.sheet)).click()
    // The sheets draw their dice icons after opening, showing colour swatches
    // (Style) or no picture (the pool) until then; History has none.
    await page.waitForFunction(() => document.querySelectorAll('.skins__swatch').length === 0
      && document.querySelectorAll('.stepper').length === document.querySelectorAll('.stepper__die').length
      && [...document.querySelectorAll('.skins__die, .stepper__die')].every(img => img.complete), null, { timeout: 60_000 })
    // The sheet itself, which reduced motion opens at once, and one more frame.
    await page.waitForTimeout(500)
  }
  const shot = await page.screenshot({ type: 'jpeg', quality: 95 })
  await page.close()
  return shot
}

/** The screenshot under its headline, on the felt's green. */
async function frame(context, image, text, { font, cjk }) {
  // Chinese breaks at punctuation only (keep-all below), so the spaces around numbers ("12 颗") must not break either.
  const [headline, subline] = cjk ? text.map(t => t.replaceAll(' ', '\u00A0')) : text
  const page = await context.newPage()
  const shot = `data:image/${image[0] === 0xFF ? 'jpeg' : 'png'};base64,${image.toString('base64')}`
  await page.setContent(`<!doctype html><html><body style="margin:0">
    <div style="width:${canvas.width}px;height:${canvas.height}px;box-sizing:border-box;padding-top:170px;
      background:radial-gradient(120% 70% at 50% 0%, #1f7a4a 0%, #0f4a2c 55%, #08281a 100%);
      font-family:${font};color:#fff;text-align:center;overflow:hidden">
      <div style="font-size:108px;font-weight:700;letter-spacing:-1px;line-height:1.1;padding:0 70px;text-wrap:balance;word-break:keep-all">${headline}</div>
      <div style="font-size:52px;font-weight:400;opacity:.8;line-height:1.3;margin-top:36px;padding:0 100px;text-wrap:balance;word-break:keep-all">${subline}</div>
      <img src="${shot}" style="display:block;margin:110px auto 0;width:1050px;border-radius:96px;
        box-shadow:0 40px 120px rgba(0,0,0,.55), 0 0 0 14px #111, 0 0 0 16px #333">
    </div></body></html>`)
  await page.evaluate(() => document.fonts.ready)
  const framed = await page.screenshot({ clip: { x: 0, y: 0, ...canvas }, type: 'jpeg', quality: 90 })
  await page.close()
  return framed
}

const framer = await browser.newContext({ viewport: canvas, deviceScaleFactor: 1 })
// LOCALES=zh-Hant,en-US redoes only those, as a full run takes minutes.
const only = process.env.LOCALES?.split(',')
for (const [locale, style] of Object.entries(locales).filter(([locale]) => !only || only.includes(locale))) {
  // Written aside and swapped in whole, so a failed run leaves the last full set for deliver.
  const dir = join(out, locale)
  const next = `${dir}.next`
  rmSync(next, { recursive: true, force: true })
  mkdirSync(next, { recursive: true })
  for (const [i, scene] of scenes.entries()) {
    let image
    if (scene.raw) {
      // Taken by hand in the iPhone 17 Pro Max simulator, which is 1320×2868:
      // `xcrun simctl io booted screenshot fastlane/screenshots-raw/<name>.png`.
      const raw = join(rawDir, scene.raw)
      if (!existsSync(raw)) {
        console.warn(`skipped ${scene.name}: no ${raw}`)
        continue
      }
      image = readFileSync(raw)
    }
    else {
      // A fresh profile per scene, so History holds only that scene's rolls.
      // Reduced motion shows the ring and the card at once, rather than caught mid-fade.
      const context = await browser.newContext({ viewport: phone, deviceScaleFactor: 3, hasTouch: true, locale: style.app, reducedMotion: 'reduce' })
      image = await capture(context, scene)
      await context.close()
    }
    // JPEG, as the store takes it and PNGs of the felt are 2 MB each in git.
    const file = join(next, `${i + 1}_${scene.name}.jpg`)
    writeFileSync(file, await frame(framer, image, scene.text[locale], style))
    console.log(join(dir, `${i + 1}_${scene.name}.jpg`))
  }
  rmSync(dir, { recursive: true, force: true })
  renameSync(next, dir)
}
await browser.close()
