// Shared by the App Store screenshot and title scripts: the store languages,
// and opening and rolling the cup in headless Chromium. playwright-core comes
// from the run-pocket-dice-cup skill's cache folder ($PLAYWRIGHT_DIR, default
// ~/.cache/pocket-dice-driver), as it is not a project dependency.
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { join } from 'node:path'

const playwrightDir = process.env.PLAYWRIGHT_DIR ?? join(homedir(), '.cache/pocket-dice-driver')
export const { chromium } = createRequire(join(playwrightDir, 'package.json'))('playwright-core')
const base = process.argv[2] ?? 'http://localhost:3000/'

// Store locale → the app's language and the font for its script.
// Font names are single-quoted, as they go inside a double-quoted style attribute.
export const locales = {
  'en-US': { app: 'en-US', font: "-apple-system, 'Helvetica Neue', sans-serif" },
  'zh-Hans': { app: 'zh-CN', font: "'PingFang SC', sans-serif", cjk: true },
  'zh-Hant': { app: 'zh-HK', font: "'PingFang HK', 'PingFang TC', sans-serif", cjk: true },
}

/** The store locales in LOCALES=zh-Hant,en-US, or all; a full run takes minutes. */
export function chosenLocales() {
  const only = process.env.LOCALES?.split(',').map(name => name.trim()) ?? Object.keys(locales)
  const unknown = only.filter(name => !(name in locales))
  if (unknown.length) throw new Error(`unknown LOCALES ${unknown.join(', ')}; known: ${Object.keys(locales).join(', ')}`)
  return only
}

// The felt's green, behind the words on every store image.
export const feltGreen = '#1f7a4a 0%, #0f4a2c 55%, #08281a 100%'

/** Chinese breaks at punctuation only (keep-all), so the spaces around numbers ("12 颗") must not break either. */
export function typeset(text, { cjk }) {
  return cjk ? text.replaceAll(' ', '\u00A0') : text
}

const resultCard = page => page.locator('[role=status].result')

export function hide(page, selector) {
  return page.addStyleTag({ content: `${selector} { display: none !important }` })
}

/** Loads the cup with `query` and waits for it; without ?debug the dice start at random, as a real roll does. */
export async function openCup(page, query) {
  await page.goto(`${base}?${query}`)
  await page.locator('.cup__controls').waitFor({ timeout: 60_000 })
  // The dev server's DevTools pill would show in the shot.
  await hide(page, '#nuxt-devtools-container, nuxt-devtools-inspect-panel')
}

/** A tap on the felt, which rolls with no sensor. */
export function tap(page) {
  const { width, height } = page.viewportSize()
  return () => page.mouse.click(width / 2, height / 3)
}

/** Rolls with `trigger` and waits for the dice to settle; true when a die only slid and wears its ring. */
async function settle(page, trigger) {
  const rolling = trigger()
  // The card goes once the dice move; waited for, so the last roll's card is not read as this one's.
  await resultCard(page).waitFor({ state: 'hidden', timeout: 30_000 })
  await rolling
  await resultCard(page).waitFor({ timeout: 30_000 })
  return await resultCard(page).locator('.sr-only').count() > 0
}

const maxTries = 60

/**
 * Rolls until a die only slid, or until none did, as `slid` asks. A tap leaves a
 * die on the face it started on 15–18% of the time (docs/plan.md), and only some
 * of those slid without tipping, so a ringed roll can take dozens of tries; how
 * many is logged, to tell whether the limit is right.
 */
export async function rollUntil(page, trigger, slid, name) {
  let tries = 1
  while ((await settle(page, trigger)) !== slid) {
    if (++tries > maxTries) throw new Error(`${name}: no roll in ${maxTries} came out as wanted`)
  }
  if (tries > 1) console.log(`${name}: ${tries} rolls`)
}
