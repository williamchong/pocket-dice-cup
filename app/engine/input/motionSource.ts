import type { Vec3 } from '../math'

export type MotionPermission = 'granted' | 'denied' | 'unsupported'

export interface MotionSource {
  /**
   * The latest `accelerationIncludingGravity` in m/s², in the W3C sign
   * convention (a device lying screen-up reads z = +9.81) and in the axes of
   * the screen as currently rotated.
   */
  readonly acceleration: Vec3
  /** Whether any reading has arrived yet. */
  readonly active: boolean
  /** Must be called from a user gesture: iOS only shows its prompt from one. */
  start(): Promise<MotionPermission>
  stop(): void
}

/** What a device lying screen-up on a table reads. */
export const REST_ACCELERATION: Readonly<Vec3> = { x: 0, y: 0, z: 9.80665 }

/**
 * Rotates a reading from the device's axes into the screen's. `angleDegrees`
 * is `screen.orientation.angle`: 90 means the device was turned 90°
 * counter-clockwise, which puts its right edge (+x) at the top of the screen.
 */
export function toScreenFrame(v: Vec3, angleDegrees: number): Vec3 {
  const angle = angleDegrees * Math.PI / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos,
    z: v.z,
  }
}

type PermissionRequester = { requestPermission?: () => Promise<'granted' | 'denied'> }

export class DeviceMotionSource implements MotionSource {
  acceleration: Vec3 = { ...REST_ACCELERATION }
  active = false

  private readonly sign: number

  constructor() {
    // iOS reports the opposite sign to the spec and to every other platform.
    this.sign = isIos() ? -1 : 1
  }

  async start(): Promise<MotionPermission> {
    if (typeof DeviceMotionEvent === 'undefined') return 'unsupported'
    const requester = DeviceMotionEvent as unknown as PermissionRequester
    if (requester.requestPermission) {
      try {
        if (await requester.requestPermission() !== 'granted') return 'denied'
      }
      catch {
        return 'denied'
      }
    }
    window.addEventListener('devicemotion', this.onMotion)
    return 'granted'
  }

  stop(): void {
    window.removeEventListener('devicemotion', this.onMotion)
  }

  private readonly onMotion = (event: DeviceMotionEvent): void => {
    const a = event.accelerationIncludingGravity
    // Desktop browsers fire the event with null fields when there is no sensor.
    if (!a || a.x === null || a.y === null || a.z === null) return
    this.acceleration = toScreenFrame(
      { x: a.x * this.sign, y: a.y * this.sign, z: a.z * this.sign },
      screen.orientation?.angle ?? 0,
    )
    this.active = true
  }
}

/**
 * Every browser on iOS is WebKit, so the platform is what decides the sign.
 * The permission prompt cannot stand in for this test: Chrome has
 * `requestPermission` too. iPadOS calls itself a Mac but has a touch screen.
 */
function isIos(): boolean {
  return /iPhone|iPad|iPod/.test(navigator.userAgent)
    || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1)
}
