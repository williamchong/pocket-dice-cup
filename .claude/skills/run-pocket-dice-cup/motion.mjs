// Fake motion-sensor readings for the dice cup in Playwright, shared by the
// driver and fastlane/screenshots.mjs so their shakes stay the same. Samples
// are [ms, x, y, z] in the W3C sign: screen-up is z = +9.81.

/** Sends `samples` to `page` as devicemotion events at their own pace. */
export async function sendMotion(page, samples) {
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
export function restSamples(ms, from = 0) {
  const out = []
  for (let t = 0; t <= ms; t += 16) out.push([from + t, 0, 0, 9.81])
  return out
}

/** A side-to-side shake of `ms`, then `restMs` lying screen-up so the dice settle. */
export function shakeSamples(ms, restMs) {
  const out = []
  for (let t = 0; t <= ms; t += 16) {
    const phase = (t / 1000) * 2 * Math.PI * 4 // 4 Hz, about a hand's pace
    out.push([t, 25 * Math.sin(phase), 8 * Math.cos(phase * 1.3), 9.81 + 6 * Math.sin(phase * 0.7)])
  }
  return out.concat(restSamples(restMs, ms + 16))
}
