/**
 * How a set of dice is finished: its colours and the material they are cast
 * in. A skin is plain data, so the settings and the tests can read it without
 * three.js; the looks turn it into textures and materials.
 */
interface SkinFields {
  id: string
  name: string
  /** The body, as a CSS colour. */
  body: string
  /** The pips and the numbers. */
  ink: string
  /** 0 is a mirror finish, 1 is matt. */
  roughness: number
  /** 0 is plastic or stone, 1 is metal. */
  metalness: number
  /** How much of a lacquer layer sits over the body, 0 to 1. */
  clearcoat: number
}

/** Glossy resin, as most game dice are cast in. */
const RESIN = { roughness: 0.25, metalness: 0, clearcoat: 1 }

/** Every skin, in the order the picker shows them. All of them come with the app. */
export const DIE_SKINS = [
  // Ivory rather than pure white, which blows out under the lamp.
  { id: 'ivory', name: 'Ivory', body: '#e9e2d0', ink: '#17171b', ...RESIN },
  { id: 'ebony', name: 'Ebony', body: '#1c1c20', ink: '#f1ebdc', ...RESIN },
  { id: 'casino', name: 'Casino red', body: '#b4202a', ink: '#f6f1e6', ...RESIN },
  { id: 'sapphire', name: 'Sapphire', body: '#1f3f8c', ink: '#f6f1e6', ...RESIN },
  { id: 'emerald', name: 'Emerald', body: '#1d6b3f', ink: '#f6f1e6', ...RESIN },
  { id: 'amethyst', name: 'Amethyst', body: '#5a2d82', ink: '#e9c76a', ...RESIN },
  // Brushed metal: no lacquer, and a little rough so the room reflects as a sheen rather than a mirror.
  { id: 'gold', name: 'Gold', body: '#d2a23b', ink: '#2b1d08', roughness: 0.4, metalness: 0.9, clearcoat: 0 },
] as const satisfies readonly SkinFields[]

export type DieSkin = typeof DIE_SKINS[number]
export type DieSkinId = DieSkin['id']

export const DEFAULT_SKIN_ID: DieSkinId = 'ivory'

export function isDieSkinId(value: unknown): value is DieSkinId {
  return DIE_SKINS.some(skin => skin.id === value)
}

export function findSkin(id: DieSkinId): DieSkin {
  return DIE_SKINS.find(skin => skin.id === id)!
}
