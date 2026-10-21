import { deviceUnlock } from '~/engine/store/unlock'

/**
 * Whether Pro is owned, starting from the store's last answer and updated
 * once it answers again. `granted` stands in for a purchase, for trying Pro
 * skins in a debug build before the store plugin exists.
 */
export function useProUnlock(granted: boolean) {
  const ownsPro = ref(granted || loadOwnsPro())
  const backend = granted ? null : deviceUnlock()

  function settle(owned: boolean): boolean {
    ownsPro.value = owned
    saveOwnsPro(owned)
    return owned
  }

  // A store that cannot be reached at launch, as offline, is not a refund,
  // so the last answer stands. A buy or restore that fails rejects instead,
  // for the sheet to say so.
  void backend?.ownsPro().then(settle, (error: unknown) => {
    console.warn('The store could not say whether Pro is owned', error)
  })

  return {
    ownsPro: readonly(ownsPro),
    buyPro: async () => backend ? settle(await backend.buyPro()) : true,
    restorePro: async () => backend ? settle(await backend.restorePro()) : true,
  }
}
