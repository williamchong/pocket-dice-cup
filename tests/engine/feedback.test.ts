import { describe, expect, it } from 'vitest'
import { CupFeedback, impactStrength, type HapticsBackend, type ImpactSound } from '../../app/engine/feedback/cupFeedback'
import type { Impact, Surface } from '../../app/engine/physics/world'

class FakeSound implements ImpactSound {
  played: [Surface, number][] = []
  state = 'running'
  async unlock() {}
  play(surface: Surface, strength: number) {
    this.played.push([surface, strength])
  }

  dispose() {}
}

class FakeHaptics implements HapticsBackend {
  pulses: number[] = []
  sharpnesses: number[] = []
  playTransient(intensity: number, sharpness: number) {
    this.pulses.push(intensity)
    this.sharpnesses.push(sharpness)
  }
}

const hit = (speed: number, surface: Surface = 'wall', die = 0): Impact => ({ die, speed, surface })

describe('impactStrength', () => {
  it('is silent for the faintest hits, full for the hardest, and rises in between', () => {
    expect(impactStrength(5)).toBe(0)
    expect(impactStrength(10)).toBe(0)
    expect(impactStrength(300)).toBe(1)
    expect(impactStrength(450)).toBe(1)
    expect(impactStrength(30)).toBeGreaterThan(0)
    expect(impactStrength(100)).toBeGreaterThan(impactStrength(30))
  })
})

describe('CupFeedback', () => {
  it('plays a sound for every audible impact, on its surface', () => {
    const sound = new FakeSound()
    const feedback = new CupFeedback(sound, null)
    feedback.play([hit(100, 'floor'), hit(5, 'wall'), hit(200, 'glass', 1)], 0)
    expect(sound.played.map(([surface]) => surface)).toEqual(['floor', 'glass'])
    expect(sound.played[0]![1]).toBeCloseTo(impactStrength(100))
  })

  it('vibrates once a frame, for the strongest impact, and no closer together than a motor can play', () => {
    const haptics = new FakeHaptics()
    const feedback = new CupFeedback(null, haptics)
    feedback.play([hit(50), hit(200)], 0)
    feedback.play([hit(300)], 17)
    feedback.play([hit(30)], 34)
    feedback.play([hit(5)], 51)
    feedback.play([hit(60)], 68)
    expect(haptics.pulses).toEqual([impactStrength(200), impactStrength(60)])
  })

  it('feels a hit on the felt floor softer than one on the walls or the glass', () => {
    const haptics = new FakeHaptics()
    const feedback = new CupFeedback(null, haptics)
    feedback.play([hit(50, 'wall'), hit(200, 'floor')], 0)
    feedback.play([hit(200, 'wall'), hit(50, 'floor')], 100)
    feedback.play([hit(200, 'glass')], 200)
    expect(haptics.sharpnesses).toHaveLength(3)
    const [floor, wall, glass] = haptics.sharpnesses
    expect(floor).toBeLessThan(wall!)
    expect(glass).toBe(wall)
  })

  it('spaces the pulses by the live tuning', () => {
    const haptics = new FakeHaptics()
    const feedback = new CupFeedback(null, haptics)
    feedback.tuning.minPulseGapMs = 15
    feedback.play([hit(200)], 0)
    feedback.play([hit(200)], 17)
    expect(haptics.pulses).toHaveLength(2)
  })

  it('lifts faint pulses to the minimum intensity, but not the sound', () => {
    const sound = new FakeSound()
    const haptics = new FakeHaptics()
    const feedback = new CupFeedback(sound, haptics)
    feedback.tuning.minIntensity = 0.4
    feedback.play([hit(30)], 0)
    feedback.play([hit(300)], 100)
    const faint = impactStrength(30)
    expect(haptics.pulses[0]).toBeCloseTo(0.4 + 0.6 * faint)
    expect(haptics.pulses[1]).toBe(1)
    expect(sound.played[0]![1]).toBeCloseTo(faint)
  })

  it('counts the impacts of the last second for the debug readout', () => {
    const feedback = new CupFeedback(null, null)
    feedback.play([hit(300), hit(30)], 0)
    feedback.play([hit(100)], 500)
    expect(feedback.stats).toEqual({ impactsPerSecond: 3, peakStrength: 1 })
    feedback.play([], 1200)
    expect(feedback.stats).toEqual({ impactsPerSecond: 1, peakStrength: impactStrength(100) })
  })
})
