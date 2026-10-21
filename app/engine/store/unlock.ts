import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Where Pro is bought and the purchase is checked. Each call resolves to
 * whether Pro is owned afterwards, and rejects when the store cannot say, as
 * offline, so that a failed check is never taken for a refund.
 */
export interface UnlockBackend {
  ownsPro(): Promise<boolean>
  /** Resolves false when the buyer cancels. */
  buyPro(): Promise<boolean>
  restorePro(): Promise<boolean>
}

/** The web has no store, so Pro is never owned there; see app/utils/proUnlock.ts. */
export class WebUnlockBackend implements UnlockBackend {
  async ownsPro() {
    return false
  }

  async buyPro() {
    return false
  }

  async restorePro() {
    return false
  }
}

/**
 * The store plugin in the native shells, StoreKit 2 on iOS and Play Billing
 * on Android, kept in step as CupHaptics is. Not written yet: until it is,
 * every call is unimplemented, and Pro is not owned.
 */
interface CupStorePlugin {
  ownsPro(): Promise<{ owned: boolean }>
  buyPro(): Promise<{ owned: boolean }>
  restorePro(): Promise<{ owned: boolean }>
}

const CupStore = registerPlugin<CupStorePlugin>('CupStore')

export class NativeUnlockBackend implements UnlockBackend {
  /** A plugin that is not in the shell yet sells nothing, so nothing is owned; any other failure is passed on. */
  async ownsPro() {
    try {
      return (await CupStore.ownsPro()).owned
    }
    catch (error) {
      if ((error as { code?: string } | null)?.code === 'UNIMPLEMENTED') return false
      throw error
    }
  }

  // Unlike the check, a failed purchase or restore rejects, so the buyer can
  // be told it failed rather than see it as cancelled.
  async buyPro() {
    return (await CupStore.buyPro()).owned
  }

  async restorePro() {
    return (await CupStore.restorePro()).owned
  }
}

export function deviceUnlock(): UnlockBackend {
  return Capacitor.isNativePlatform() ? new NativeUnlockBackend() : new WebUnlockBackend()
}
