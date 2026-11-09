import { Capacitor, registerPlugin } from '@capacitor/core'
import type { DieKind } from '../engine/dice/shapes'

/**
 * Keeps the last roll where it can be seen after leaving the app: the
 * Dynamic Island and the Lock Screen, in the iPhone app.
 */
export interface LastRollBackend {
  /** Shows a roll of the dice of `kinds`, or with no values, a change of pool, which only updates what is already shown. */
  show(kinds: readonly DieKind[], values: readonly number[] | null, time: number): void
  /** The quick rolls made from the island since the last call, unchecked, oldest first. */
  takeQuickRolls(): Promise<unknown[]>
}

/** The Live Activity plugin in the iOS app (ios/App/App/CupActivityPlugin.swift). */
interface CupActivityPlugin {
  show(options: { kinds: DieKind[], values: number[] | null, time: number }): Promise<void>
  takeQuickRolls(): Promise<{ rolls: unknown[] }>
}

const CupActivity = registerPlugin<CupActivityPlugin>('CupActivity')

class NativeLastRollBackend implements LastRollBackend {
  show(kinds: readonly DieKind[], values: readonly number[] | null, time: number): void {
    // Fire and forget: a roll is never held up by the island.
    CupActivity.show({ kinds: [...kinds], values: values && [...values], time }).catch(() => {})
  }

  async takeQuickRolls(): Promise<unknown[]> {
    try {
      return (await CupActivity.takeQuickRolls()).rolls
    }
    catch {
      return []
    }
  }
}

/** The island in the iOS app; null on the web and in the Android app, which have none. */
export function deviceLastRoll(): LastRollBackend | null {
  return Capacitor.getPlatform() === 'ios' ? new NativeLastRollBackend() : null
}
