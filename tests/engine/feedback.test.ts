import { describe, expect, it } from 'vitest'
import { CupFeedback, impactStrength, type HapticsBackend, type ImpactSound } from '../../app/engine/feedback/cupFeedback'
import type { Impact, Surface } from '../../app/engine/physics/world'

class FakeSound implements ImpactSound {
  played: [Surface, number][] = []
  unlock() {}
  play(surface: Surface, strength: number) {
    this.played.push([surface, strength])
  }

  dispose() {}
}

class FakeHaptics implements HapticsBackend {
  pulses: number[] = []
  playTransient(intensity: number) {
    this.pulses.push(intensity)
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

  it('counts the impacts of the last second for the debug readout', () => {
    const feedback = new CupFeedback(null, null)
    feedback.play([hit(300), hit(30)], 0)
    feedback.play([hit(100)], 500)
    expect(feedback.stats).toEqual({ impactsPerSecond: 3, peakStrength: 1 })
    feedback.play([], 1200)
    expect(feedback.stats).toEqual({ impactsPerSecond: 1, peakStrength: impactStrength(100) })
  })
})
