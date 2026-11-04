import type { SkinFields } from '../render/skins'

/** Smoked glass with lit tubes set into it: a dark body, so the glow is what is seen. */
const NEON = { roughness: 0.1, metalness: 0, clearcoat: 1, finish: 'neon' } as const

/**
 * The skins that come with Pro, in the order the picker shows them after the
 * free ones. Their looks are under CC BY-NC-ND 4.0 rather than the GPL; see
 * LICENSE.md in this folder.
 */
export const PRO_SKINS = [
  // Near black rather than black, so the body still shows its shape against a dark table.
  { id: 'neon', body: '#10131c', ink: '#7ff4ff', glow: '#19e6ff', ...NEON, pro: true },
] as const satisfies readonly SkinFields[]
