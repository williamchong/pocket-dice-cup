import { DEFAULT_SOUND_TUNING, type SoundTuning } from './feedback/clackSound'
import { DEFAULT_HAPTIC_TUNING } from './feedback/cupFeedback'
import type { Surface } from './physics/world'

/**
 * What the cup is lined with: how its floor and walls look, and how a hit on
 * them sounds and feels. A table never changes how the dice roll: the physics
 * is the same under every one, so the fairness checked by
 * `npm run test:fairness` holds for all of them, and a hard floor is only
 * heard and felt. Plain data, like the dice skins.
 */
interface TableFields {
  /** Also its name's key in the translations (app/locales). */
  id: string
  floor: {
    /** A CSS colour, which the pattern's light and dark shades multiply. */
    colour: string
    /** 0 is a mirror finish, 1 is matt. */
    roughness: number
    /** Cloth is a fine speckle; a grid is a battle mat's one-inch squares. */
    pattern: 'cloth' | 'grid'
  }
  wall: { colour: string, roughness: number }
  /** The ring under each die that did not roll over: light on a dark floor, dark on a light one. */
  mark: string
  sound: Readonly<SoundTuning>
  /** How crisp a hit on each surface feels, from 0 to 1; see HapticTuning.sharpness. */
  sharpness: Readonly<Record<Surface, number>>
}

/** Every table, in the order the picker shows them. All of them come with the app. */
export const TABLES = [
  // The cup as it was before tables: green baize in a dark wooden rail, the
  // sound and feel as tuned on the iPhone (clackSound.ts, cupFeedback.ts).
  {
    id: 'felt',
    floor: { colour: '#0d6b3c', roughness: 1, pattern: 'cloth' },
    wall: { colour: '#2a160c', roughness: 0.45 },
    mark: '#fff1dc',
    sound: DEFAULT_SOUND_TUNING,
    sharpness: DEFAULT_HAPTIC_TUNING.sharpness,
  },
  // A vinyl battle mat, as tabletop role-players roll onto, in a walnut rail.
  // The vinyl lies on a hard table, so a die landing on it slaps rather than
  // thuds: brighter and a little longer than the felt, and felt more crisply.
  // The ring under a die is drawn as if in blue wet-erase marker.
  {
    id: 'battlemat',
    floor: { colour: '#c9c2b0', roughness: 0.7, pattern: 'grid' },
    wall: { colour: '#2e1d12', roughness: 0.5 },
    mark: '#1f4fa8',
    sound: {
      ...DEFAULT_SOUND_TUNING,
      floor: { band: 1200, q: 1.5, knock: 260, decay: 0.025, gain: 0.6 },
      muffleHz: 1000,
    },
    sharpness: { ...DEFAULT_HAPTIC_TUNING.sharpness, floor: 0.5 },
  },
] as const satisfies readonly TableFields[]

export type Table = typeof TABLES[number]
export type TableId = Table['id']

export const DEFAULT_TABLE_ID: TableId = 'felt'

export function isTableId(value: unknown): value is TableId {
  return TABLES.some(table => table.id === value)
}

export function findTable(id: TableId): Table {
  return TABLES.find(table => table.id === id)!
}
