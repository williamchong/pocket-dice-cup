import type { Impact, Surface } from '../physics/world'
import type { SoundTuning } from './clackSound'

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
export interface HapticTuning {
  /**
   * A vibration motor smears pulses closer than this (ms) into one long buzz,
   * so a hit within it of the last pulse is felt as part of that one.
   */
  minPulseGapMs: number
  /**
   * How crisp a hit on each surface feels, from 0 to 1, as the clacks sound: a
   * soft thud on the felt floor, a sharp tap on the walls and the glass.
   */
  sharpness: Record<Surface, number>
  /**
   * The intensity of the faintest hit that plays, from 0 to 1: a Taptic
   * Engine transient much below 0.3 is hard to feel at all. Harder hits rise
   * from it to 1. The sound keeps the plain strength.
   */
  minIntensity: number
}

export const DEFAULT_HAPTIC_TUNING: Readonly<HapticTuning> = {
  minPulseGapMs: 35,
  sharpness: { floor: 0.2, wall: 0.8, glass: 0.8 },
  minIntensity: 0,
}

/** How far back the debug readout counts impacts. */
const STATS_WINDOW_MS = 1000

/** Plays the sound of a die hitting `surface`, at `strength` from 0 to 1. */
export interface ImpactSound {
  /** Has to run inside a user gesture: browsers only start audio from one. Never rejects. */
  unlock(): Promise<void>
  play(surface: Surface, strength: number): void
  dispose(): void
  /** A one-line summary for the debug readout. */
  readonly state: string
  /** What the debug overlay can tune live, where the sound has anything to tune. */
  readonly tuning?: SoundTuning
}

/**
 * Plays one short tap of vibration at `intensity` from 0 to 1. `sharpness`,
 * from 0 to 1, is how crisp it feels, where the hardware can vary that.
 */
export interface HapticsBackend {
  playTransient(intensity: number, sharpness: number): void
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
  /** Changed live from the debug overlay, to tune the feel on a phone. */
  readonly tuning: HapticTuning = structuredClone(DEFAULT_HAPTIC_TUNING)

  constructor(private readonly sound: ImpactSound | null, private readonly haptics: HapticsBackend | null) {}

  get stats(): FeedbackStats {
    return {
      impactsPerSecond: this.recent.length * 1000 / STATS_WINDOW_MS,
      peakStrength: Math.max(0, ...this.recent.map(hit => hit.strength)),
    }
  }

  get soundState(): string {
    return this.sound?.state ?? 'none'
  }

  get soundTuning(): SoundTuning | null {
    return this.sound?.tuning ?? null
  }

  unlock(): Promise<void> {
    return this.sound?.unlock() ?? Promise.resolve()
  }

  play(impacts: readonly Impact[], timeMs: number): void {
    // Most frames, and every frame of a result left on screen, have no hits.
    if (impacts.length === 0 && this.recent.length === 0) return
    this.recent = this.recent.filter(hit => timeMs - hit.timeMs < STATS_WINDOW_MS)
    let strongest = 0
    let strongestSurface: Surface = 'floor'
    for (const { speed, surface } of impacts) {
      const strength = impactStrength(speed)
      if (strength === 0) continue
      this.sound?.play(surface, strength)
      this.recent.push({ timeMs, strength })
      if (strength > strongest) {
        strongest = strength
        strongestSurface = surface
      }
    }
    if (strongest > 0 && timeMs - this.lastPulseMs >= this.tuning.minPulseGapMs) {
      this.pulse(strongest, strongestSurface)
      this.lastPulseMs = timeMs
    }
  }

  /** Plays a full-strength hit on `surface`, to hear and feel the tuning without a shake. */
  testHit(surface: Surface): void {
    this.sound?.play(surface, 1)
    this.pulse(1, surface)
  }

  private pulse(strength: number, surface: Surface): void {
    const { minIntensity, sharpness } = this.tuning
    this.haptics?.playTransient(minIntensity + (1 - minIntensity) * strength, sharpness[surface])
  }

  dispose(): void {
    this.sound?.dispose()
  }
}
