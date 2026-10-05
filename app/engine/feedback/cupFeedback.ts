import type { Impact, Surface } from '../physics/world'

/**
 * Below this (cm/s) a hit is too faint to play: a die rocking to a stop. The
 * softest hits measured on recorded iPhone shakes are about 10.
 */
const QUIET_SPEED = 10
/**
 * From this (cm/s) up a hit plays at full strength. A hard shake on an iPhone
 * hits the walls at up to about 250 most of the time, 450 at the most.
 */
const LOUD_SPEED = 300
/**
 * A vibration motor smears pulses closer than this into one long buzz, so a
 * hit within it of the last pulse is felt as part of that one.
 */
const MIN_PULSE_GAP_MS = 35
/** How far back the debug readout counts impacts. */
const STATS_WINDOW_MS = 1000

/** Plays the sound of a die hitting `surface`, at `strength` from 0 to 1. */
export interface ImpactSound {
  /** Has to run inside a user gesture: browsers only start audio from one. */
  unlock(): void
  play(surface: Surface, strength: number): void
  dispose(): void
}

/** Plays one short tap of vibration at `intensity` from 0 to 1. */
export interface HapticsBackend {
  playTransient(intensity: number): void
}

export interface FeedbackStats {
  impactsPerSecond: number
  /** The strongest impact in the last second, from 0 to 1. */
  peakStrength: number
}

/**
 * How hard a hit feels and sounds, from 0 to 1. Loudness is heard on a log
 * scale, so equal steps in the speed ratio are equal steps in strength.
 */
export function impactStrength(speed: number): number {
  const strength = Math.log(speed / QUIET_SPEED) / Math.log(LOUD_SPEED / QUIET_SPEED)
  return Math.min(1, Math.max(0, strength))
}

/**
 * Turns the dice's impacts into sound and vibration. Every impact is heard;
 * vibration is limited to what a motor can play apart, so it gets the
 * strongest impact of a frame, and none until the last pulse is over.
 */
export class CupFeedback {
  private lastPulseMs = -Infinity
  private recent: { timeMs: number, strength: number }[] = []

  constructor(private readonly sound: ImpactSound | null, private readonly haptics: HapticsBackend | null) {}

  get stats(): FeedbackStats {
    return {
      impactsPerSecond: this.recent.length * 1000 / STATS_WINDOW_MS,
      peakStrength: Math.max(0, ...this.recent.map(hit => hit.strength)),
    }
  }

  unlock(): void {
    this.sound?.unlock()
  }

  play(impacts: readonly Impact[], timeMs: number): void {
    // Most frames, and every frame of a result left on screen, have no hits.
    if (impacts.length === 0 && this.recent.length === 0) return
    this.recent = this.recent.filter(hit => timeMs - hit.timeMs < STATS_WINDOW_MS)
    let strongest = 0
    for (const { speed, surface } of impacts) {
      const strength = impactStrength(speed)
      if (strength === 0) continue
      this.sound?.play(surface, strength)
      this.recent.push({ timeMs, strength })
      strongest = Math.max(strongest, strength)
    }
    if (strongest > 0 && timeMs - this.lastPulseMs >= MIN_PULSE_GAP_MS) {
      this.haptics?.playTransient(strongest)
      this.lastPulseMs = timeMs
    }
  }

  dispose(): void {
    this.sound?.dispose()
  }
}
