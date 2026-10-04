import type { Vec3 } from '../math'

export type MotionPermission = 'granted' | 'denied' | 'unsupported'

export interface MotionSource {
  /**
   * The latest `accelerationIncludingGravity` in m/s², in the W3C sign
   * convention (a device lying screen-up reads z = +9.81) and in the device's
   * own axes. The page turns itself back when the screen rotates, so these
   * are also the axes of the cup on screen.
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
    this.acceleration = { x: a.x * this.sign, y: a.y * this.sign, z: a.z * this.sign }
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
