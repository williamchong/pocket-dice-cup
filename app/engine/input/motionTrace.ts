import type { Vec3 } from '../math'

/**
 * Accelerometer readings as the motion analyser saw them on a real device,
 * one per animation frame, so tests can replay them in Node.
 */
export interface MotionTrace {
  /** The browser's user agent, which names the platform and OS version. */
  device: string
  recordedAt: string
  /** What was done with the phone while recording. */
  note: string
  /**
   * `[timeMs, x, y, z]` per frame: milliseconds from the first sample and
   * `accelerationIncludingGravity` in m/s², after the iOS sign flip.
   */
  samples: [number, number, number, number][]
}

/** How much of the recent past a trace keeps: enough for a pick-up, a shake and a put-down. */
const WINDOW_MS = 30_000

const round = (value: number, places: number) => Number(value.toFixed(places))

/** Keeps the last 30 seconds of readings, for copying off the phone in debug mode. */
export class TraceRecorder {
  private readonly samples: [number, number, number, number][] = []

  push(acceleration: Vec3, timeMs: number): void {
    this.samples.push([timeMs, acceleration.x, acceleration.y, acceleration.z])
    while (this.samples[0]![0] < timeMs - WINDOW_MS) this.samples.shift()
  }

  toTrace(device: string, note: string, recordedAt = new Date()): MotionTrace {
    const start = this.samples[0]?.[0] ?? 0
    return {
      device,
      recordedAt: recordedAt.toISOString(),
      note,
      samples: this.samples.map(([time, x, y, z]) =>
        [round(time - start, 1), round(x, 2), round(y, 2), round(z, 2)]),
    }
  }
}
