import { deviceUnlock } from '~/engine/store/unlock'

/**
 * Whether Pro is owned, starting from the store's last answer and updated
 * once it answers again. `granted` stands in for a purchase, for trying Pro
 * skins in a debug build before the store plugin exists.
 */
export function useProUnlock(granted: boolean) {
  const ownsPro = ref(granted || loadOwnsPro())
  const backend = granted ? null : deviceUnlock()
  // A launch check still waiting when a purchase completes would otherwise
  // answer after it and take Pro away until the next launch.
  const ask = newestAnswer((owned: boolean) => {
    ownsPro.value = owned
    saveOwnsPro(owned)
  })

  // A store that cannot be reached at launch, as offline, is not a refund,
  // so the last answer stands. A buy or restore that fails rejects instead,
  // for the sheet to say so.
  if (backend) {
    ask(() => backend.ownsPro()).catch((error: unknown) => {
      console.warn('The store could not say whether Pro is owned', error)
    })
  }

  return {
    ownsPro: readonly(ownsPro),
    /** Whether Pro can be bought here: in the store apps, not on the web, nor when granted for debugging. */
    sellsPro: backend?.sells ?? false,
    buyPro: () => backend ? ask(() => backend.buyPro()) : Promise.resolve(true),
    restorePro: () => backend ? ask(() => backend.restorePro()) : Promise.resolve(true),
  }
}
