#!/usr/bin/env node
// Drives the dice cup in headless Chromium at phone size. Reads one command
// per line from stdin (a heredoc, or tmux send-keys) and prints what it saw.
// Usage: node .claude/skills/run-pocket-dice-cup/driver.mjs [baseUrl] <<'EOF' ... EOF
// playwright-core is not a project dependency; it is looked for in
// $PLAYWRIGHT_DIR (default ~/.cache/pocket-dice-driver), see SKILL.md.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { createInterface } from 'node:readline'

const playwrightDir = process.env.PLAYWRIGHT_DIR ?? join(homedir(), '.cache/pocket-dice-driver')
const { chromium } = createRequire(join(playwrightDir, 'package.json'))('playwright-core')

const base = process.argv[2] ?? 'http://localhost:3000/'
const shots = process.env.SHOTS_DIR ?? '/tmp/pocket-dice-shots'
mkdirSync(shots, { recursive: true })

const browser = await chromium.launch({
  // A real GPU is not needed: SwiftShader's WebGL is enough for three.js.
  args: ['--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
})
const viewport = { width: 390, height: 844 }
const context = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: true, locale: process.env.LOCALE ?? 'en-US' })
const page = await context.newPage()
const errors = []
page.on('console', msg => msg.type() === 'error' && errors.push(msg.text()))
page.on('pageerror', err => errors.push(String(err)))

let shotCount = 0

/** `arg` as a number, `fallback` when it is empty; a typo fails rather than becoming NaN. */
function num(arg, fallback) {
  if (!arg) return fallback
  const value = Number(arg)
  if (Number.isNaN(value)) throw new Error(`not a number: ${arg}`)
  return value
}

function hide(selector) {
  return page.addStyleTag({ content: `${selector} { display: none !important }` })
}

/** Sends `samples` ([ms, x, y, z], W3C sign: screen-up is z = +9.81) as devicemotion events at their own pace. */
async function sendMotion(samples) {
  await page.evaluate(async (samples) => {
    const start = performance.now()
    for (const [t, x, y, z] of samples) {
      const wait = start + t - performance.now()
      if (wait > 0) await new Promise(r => setTimeout(r, wait))
      window.dispatchEvent(new DeviceMotionEvent('devicemotion', { accelerationIncludingGravity: { x, y, z }, interval: 16 }))
    }
  }, samples)
}

/** `ms` of the phone lying still, screen-up. */
function restSamples(ms, from = 0) {
  const out = []
  for (let t = 0; t <= ms; t += 16) out.push([from + t, 0, 0, 9.81])
  return out
}

/** A side-to-side shake of `ms`, then `restMs` lying screen-up so the dice settle. */
function shakeSamples(ms, restMs) {
  const out = []
  for (let t = 0; t <= ms; t += 16) {
    const phase = (t / 1000) * 2 * Math.PI * 4 // 4 Hz, about a hand's pace
    out.push([t, 25 * Math.sin(phase), 8 * Math.cos(phase * 1.3), 9.81 + 6 * Math.sin(phase * 0.7)])
  }
  return out.concat(restSamples(restMs, ms + 16))
}

async function debugText() {
  return page.locator('.cup__debug pre').textContent({ timeout: 2000 }).catch(() => '(no debug overlay: open with ?debug)')
}

const commands = {
  /** open [query]  - loads base?debug&query and waits for the dice. */
  async open(query = '') {
    const url = `${base}?debug${query ? `&${query}` : ''}`
    errors.length = 0
    await page.goto(url)
    await page.locator('.cup__controls').waitFor({ timeout: 60_000 })
    // The engine ticks the debug text every 100 ms once ready.
    await page.waitForFunction(() => document.querySelector('.cup__debug pre')?.textContent?.match(/^state\s/m), null, { timeout: 30_000 })
    // The dev server's DevTools pill sits over the History button and takes its clicks.
    await hide('#nuxt-devtools-container, nuxt-devtools-inspect-panel')
    // Logs each change of state, for `states`.
    await page.evaluate(() => {
      window.__states = []
      const pre = document.querySelector('.cup__debug pre')
      const read = () => {
        const now = /^state\s+(\S+)/m.exec(pre.textContent)?.[1]
        if (now && now !== window.__states.at(-1)) window.__states.push(now)
      }
      read()
      new MutationObserver(read).observe(pre, { childList: true, characterData: true, subtree: true })
    })
    console.log(`opened ${url}`)
  },
  /** states - the states the cup went through since the last `states` (or `open`). */
  async states() {
    const seen = await page.evaluate(() => {
      const all = window.__states
      window.__states = all.slice(-1)
      return all
    })
    console.log(`states: ${seen.join(' -> ')}`)
  },
  /** hide-debug - hides the debug overlay for a clean screenshot (it covers the top-left die). */
  async 'hide-debug'() {
    await hide('.cup__debug')
    console.log('debug overlay hidden')
  },
  /** toss - taps the felt, as on a desktop with no sensor. */
  async toss() {
    await page.mouse.click(viewport.width / 2, viewport.height / 3)
    console.log('tossed')
  },
  /** space - presses the space bar, which also tosses. */
  async space() {
    await page.keyboard.press('Space')
    console.log('pressed space')
  },
  /** shake [ms] [restMs] - a synthetic side-to-side shake (1500 ms), then lying screen-up (3000 ms). Returns when the readings end. */
  async shake(args) {
    const [ms, restMs] = args.split(/\s+/)
    const shakeMs = num(ms, 1500)
    const stillMs = num(restMs, 3000)
    await sendMotion(shakeSamples(shakeMs, stillMs))
    console.log(`shook ${shakeMs} ms, then lay still ${stillMs} ms`)
  },
  /** replay <trace.json> - replays a recorded iPhone trace (tests/fixtures/traces), then 3 s screen-up. */
  async replay(file) {
    const trace = JSON.parse(readFileSync(resolve(file), 'utf8'))
    const last = trace.samples.at(-1)[0]
    await sendMotion(trace.samples.concat(restSamples(3000, last + 16)))
    console.log(`replayed ${trace.samples.length} samples: ${trace.note}`)
  },
  /** wait-result [seconds] - waits for the result card and prints it. */
  async 'wait-result'(seconds) {
    const card = page.locator('[role=status].result')
    await card.waitFor({ timeout: num(seconds, 20) * 1000 })
    console.log(`result: ${(await card.innerText()).replace(/\s+/g, ' ')}`)
  },
  /** debug - prints the ?debug overlay (state, result, sensor, physics ms...). */
  async debug() {
    console.log(await debugText())
  },
  /** click <name> - clicks the button, radio or tab with that name: Done, History, Style, Table, 2d6, More d8, Gold, Clear... */
  async click(text) {
    // Skins are radios and the Style sheet's Dice and Table are tabs; everything else in the sheets is a button.
    const named = exact => page.getByRole('button', { name: text, exact })
      .or(page.getByRole('radio', { name: text, exact }))
      .or(page.getByRole('tab', { name: text, exact }))
    // An exact name first, so `d6` is not taken for `More d6`.
    const target = await named(true).count() ? named(true) : named(false)
    await target.first().click({ timeout: 5000 })
    console.log(`clicked "${text}"`)
  },
  async wait(ms) {
    await page.waitForTimeout(num(ms, 1000))
  },
  /** ss [name] - screenshot to $SHOTS_DIR. */
  async ss(name) {
    const file = join(shots, `${name || String(++shotCount).padStart(2, '0')}.png`)
    await page.screenshot({ path: file })
    console.log(`screenshot ${file}`)
  },
  /** eval <js> - evaluates in the page and prints the result. */
  async eval(code) {
    console.log(JSON.stringify(await page.evaluate(code)))
  },
  /** errors - prints console errors and page exceptions since the last `errors` (or `open`). */
  async errors() {
    console.log(errors.splice(0).join('\n') || 'no errors')
  },
  async help() {
    console.log(Object.keys(commands).join(' '))
  },
}

const rl = createInterface({ input: process.stdin, terminal: false })
for await (const line of rl) {
  // The rest of the line goes to the command as one string, so `eval` code and `click` names keep their spaces.
  const [, name, args] = /^(\S*)\s*(.*)$/.exec(line.trim())
  if (!name || name.startsWith('#')) continue
  if (name === 'quit') break
  const run = commands[name]
  if (!run) {
    console.log(`unknown command: ${name} (try help)`)
    process.exitCode = 1
    continue
  }
  try {
    await run(args)
  }
  catch (error) {
    console.log(`${name} failed: ${error.message.split('\n')[0]}`)
    process.exitCode = 1
  }
}
await browser.close()
