/** What dice are cast in, in the order the picker groups them. */
export const FINISHES = ['resin', 'translucent', 'metal'] as const

/**
 * How a set of dice is finished: its colours and the material they are cast
 * in. A skin is plain data, so the settings and the tests can read it without
 * three.js; the looks turn it into textures and materials.
 */
interface SkinFields {
  /** Also its name's key in the translations (app/locales). */
  id: string
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
  /** What it is cast in, which the picker groups the skins by. */
  finish: typeof FINISHES[number]
  /** How much light passes through the body, 0 to 1; the markings stay solid. Opaque if left out. */
  transmission?: number
  /** The colour light deepens to as it goes through the body, so a die is darker where it is thick. */
  tint?: string
}

/** Glossy resin, as most game dice are cast in. */
const RESIN = { roughness: 0.25, metalness: 0, clearcoat: 1, finish: 'resin' } as const
/** Clear resin, with the body's colour in the plastic rather than on it. */
const TRANSLUCENT = { roughness: 0.15, metalness: 0, clearcoat: 1, finish: 'translucent', transmission: 0.8 } as const
/** Brushed metal: no lacquer, and a little rough so the room reflects as a sheen rather than a mirror. */
const METAL = { roughness: 0.4, metalness: 0.9, clearcoat: 0, finish: 'metal' } as const

/** Every skin, in the order the picker shows them. All of them come with the app. */
export const DIE_SKINS = [
  // Ivory rather than pure white, which blows out under the lamp.
  { id: 'ivory', body: '#e9e2d0', ink: '#17171b', ...RESIN },
  { id: 'ebony', body: '#1c1c20', ink: '#f1ebdc', ...RESIN },
  { id: 'casino', body: '#b4202a', ink: '#f6f1e6', ...RESIN },
  { id: 'sapphire', body: '#1f3f8c', ink: '#f6f1e6', ...RESIN },
  { id: 'emerald', body: '#1d6b3f', ink: '#f6f1e6', ...RESIN },
  { id: 'amethyst', body: '#5a2d82', ink: '#e9c76a', ...RESIN },
  // Oxblood with gold numbers, as fantasy role-players' dice often are; darker than casino red, so the two tell apart.
  { id: 'dragon', body: '#5e0f14', ink: '#e2b659', ...RESIN },
  // Clear red with white pips, as casinos' precision dice are.
  { id: 'cherry', body: '#f06070', ink: '#f6f1e6', tint: '#ff8088', ...TRANSLUCENT, transmission: 0.85 },
  { id: 'smoke', body: '#9a9aa4', ink: '#f6f1e6', tint: '#c0c0c8', ...TRANSLUCENT },
  { id: 'ice', body: '#e4f2ff', ink: '#16263c', tint: '#c8e4ff', ...TRANSLUCENT, transmission: 0.9 },
  { id: 'gold', body: '#d2a23b', ink: '#2b1d08', ...METAL },
  { id: 'silver', body: '#c4c8ce', ink: '#1c2026', ...METAL },
  { id: 'copper', body: '#b86a42', ink: '#2a140a', ...METAL },
] as const satisfies readonly SkinFields[]

/** A skin, with the fields only some skins set readable on every one. */
export type DieSkin = typeof DIE_SKINS[number] & SkinFields
export type DieSkinId = DieSkin['id']

export const DEFAULT_SKIN_ID: DieSkinId = 'ivory'

export function isDieSkinId(value: unknown): value is DieSkinId {
  return DIE_SKINS.some(skin => skin.id === value)
}

export function findSkin(id: DieSkinId): DieSkin {
  return DIE_SKINS.find(skin => skin.id === id)!
}
