import { registerPlugin } from '@capacitor/core'

/**
 * Every event that can leave the app, and what it carries. Listing them here
 * keeps anything else from being sent by accident: the numbers rolled and the
 * motion sensor's readings are never among them, as PRIVACY.md promises.
 */
export interface AnalyticsEvents {
  /** `dice` as `formatPool` writes it, and the ids of the skin and table. */
  roll_completed: { dice: string, skin: string, table: string }
  /**
   * A buy of Pro, in the phone apps only. `cancelled` also covers one waiting
   * on a parent or a cash payment, which the store does not tell apart.
   */
  pro_purchase: { outcome: 'bought' | 'cancelled' | 'failed' }
}

/** Where events go: Google Analytics on the web, and Firebase's SDK in the phone apps. */
export interface AnalyticsBackend {
  track<E extends keyof AnalyticsEvents>(event: E, params: AnalyticsEvents[E]): void | Promise<void>
  setEnabled(enabled: boolean): void | Promise<void>
}

/** The part of Google's gtag function that is used here. */
export type Gtag = (command: 'event', event: string, params: Record<string, string>) => void

/**
 * Google Analytics on the web. The script is only fetched once analytics is
 * on, by `load`, so someone who switched it off asks nothing of Google.
 */
export class GtagAnalyticsBackend implements AnalyticsBackend {
  private gtag: Promise<Gtag> | null = null

  constructor(private readonly id: string, private readonly load: () => Promise<Gtag>) {}

  async track<E extends keyof AnalyticsEvents>(event: E, params: AnalyticsEvents[E]) {
    const gtag = await this.gtag
    gtag?.('event', event, params)
  }

  async setEnabled(enabled: boolean) {
    // Google's own switch, which its script checks at each hit, for switching
    // off a script that has already loaded and cannot be taken back out.
    (globalThis as unknown as Record<string, unknown>)[`ga-disable-${this.id}`] = !enabled
    if (!enabled) return
    this.gtag ??= this.load()
    // So that a load that fails, as offline, reaches the caller's catch.
    await this.gtag
  }
}

/**
 * Firebase's SDK in the phone apps, through ios/App/App/CupAnalyticsPlugin.swift
 * and android/.../CupAnalyticsPlugin.java, kept in step as CupHaptics is.
 */
interface CupAnalyticsPlugin {
  track(options: { event: string, params: Record<string, string> }): Promise<void>
  setEnabled(options: { enabled: boolean }): Promise<void>
}

const CupAnalytics = registerPlugin<CupAnalyticsPlugin>('CupAnalytics')

export class NativeAnalyticsBackend implements AnalyticsBackend {
  track<E extends keyof AnalyticsEvents>(event: E, params: AnalyticsEvents[E]) {
    return CupAnalytics.track({ event, params })
  }

  setEnabled(enabled: boolean) {
    return CupAnalytics.setEnabled({ enabled })
  }
}

/**
 * What the app calls. With no backend, as in a debug run or a build with no
 * measurement ID, it does nothing and the switch for it is not shown.
 */
export class Analytics {
  constructor(private readonly backend: AnalyticsBackend | null, private on: boolean) {}

  /** Whether there is anything to switch on or off. */
  get available() {
    return this.backend !== null
  }

  get enabled() {
    return this.on
  }

  /** Tells the backend the saved choice at launch; the phone apps collect nothing until told. */
  start() {
    void this.run(backend => backend.setEnabled(this.on))
  }

  track<E extends keyof AnalyticsEvents>(event: E, params: AnalyticsEvents[E]) {
    if (this.on) void this.run(backend => backend.track(event, params))
  }

  setEnabled(enabled: boolean) {
    this.on = enabled
    saveAnalyticsEnabled(enabled)
    void this.run(backend => backend.setEnabled(enabled))
  }

  /** A failure here must never get in the way of a roll or a purchase. */
  private async run(call: (backend: AnalyticsBackend) => void | Promise<void>) {
    if (!this.backend) return
    try {
      await call(this.backend)
    }
    catch (error) {
      // A shell built before the plugin was added has nothing to report.
      if ((error as { code?: string } | null)?.code !== 'UNIMPLEMENTED') console.warn('Analytics failed', error)
    }
  }
}

const STORAGE_KEY = 'pocket-dice-cup:analytics'

/** On unless switched off on the about page. */
export function loadAnalyticsEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off'
  }
  catch {
    // Storage can throw when blocked, as in some private windows. A choice to
    // switch off could not have been saved there, so err on the side of off.
    return false
  }
}

export function saveAnalyticsEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  }
  catch {
    // Not saved; the choice still applies until the page is closed.
  }
}
