/**
 * Whether this is a debug run: `?debug` in the address, or `NUXT_PUBLIC_DEBUG=1`
 * for the native shells, which have no address bar. Read from the address
 * rather than the route, as plugins run before the router is ready.
 */
export function isDebugRun(): boolean {
  return new URLSearchParams(location.search).has('debug') || Boolean(useRuntimeConfig().public.debug)
}
