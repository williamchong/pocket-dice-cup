import { DEFAULT_SOUND_TUNING, type SoundTuning } from './feedback/clackSound'
import { DEFAULT_HAPTIC_TUNING } from './feedback/cupFeedback'
import type { Surface } from './physics/world'
import { PRO_TABLES } from './pro/tables'

/**
 * What the cup is lined with: how its floor and walls look, and how a hit on
 * them sounds and feels. A table never changes how the dice roll: the physics
 * is the same under every one, so the fairness checked by
 * `npm run test:fairness` holds for all of them, and a hard floor is only
 * heard and felt. Plain data, like the dice skins.
 */
export interface TableFields {
  /** Also its name's key in the translations (app/locales). */
  id: string
  floor: {
    /** A CSS colour, which the pattern's light and dark shades multiply; a starfield is painted on it instead. */
    colour: string
    /** 0 is a mirror finish, 1 is matt. */
    roughness: number
    /**
     * Cloth is a fine speckle; a grid is a battle mat's one-inch squares; a
     * starfield is a sky of stars and nebula under the glass, lit from within.
     */
    pattern: 'cloth' | 'grid' | 'starfield'
    /** Light enough that cream text over it cannot be read, so the buttons and hints over it go dark. */
    light: boolean
  }
  /** 0 is a painted or wooden rail, 1 is metal; 0 if left out. */
  wall: { colour: string, roughness: number, metalness?: number }
  /** The ring under each die that did not roll over: light on a dark floor, dark on a light one. */
  mark: string
  sound: Readonly<SoundTuning>
  /** How crisp a hit on each surface feels, from 0 to 1; see HapticTuning.sharpness. */
  sharpness: Readonly<Record<Surface, number>>
  /**
   * The lamp's colour, and how much the room around the table lights it,
   * from 0 to 1; a warm games-table lamp at 0.3 if left out.
   */
  light?: { colour: string, environment: number }
  /** The dark that the sheets and hints over the cup are tinted with, in place of the felt green. */
  panel?: string
  /** A bright colour the glass buttons are rimmed with and the hints drawn in, as lit trim; none if left out. */
  accent?: string
  /** Comes with Pro rather than free; see app/utils/proUnlock.ts. Only the picker reads it, never the cup. */
  pro?: boolean
}

/** Every table, in the order the picker shows them. The free ones come first, and stay free; Pro's follow, from app/engine/pro. */
export const TABLES = [
  // The cup as it was before tables: green baize in a dark wooden rail, the
  // sound and feel as tuned on the iPhone (clackSound.ts, cupFeedback.ts).
  {
    id: 'felt',
    floor: { colour: '#0d6b3c', roughness: 1, pattern: 'cloth', light: false },
    wall: { colour: '#2a160c', roughness: 0.45 },
    mark: '#fff1dc',
    sound: DEFAULT_SOUND_TUNING,
    sharpness: DEFAULT_HAPTIC_TUNING.sharpness,
  },
  // A vinyl battle mat, as tabletop role-players roll onto, in a walnut rail.
  // The ring under a die is drawn as if in blue wet-erase marker. It sounds
  // and feels as the felt until a voice of its own is tuned on the iPhone.
  {
    id: 'battlemat',
    floor: { colour: '#c9c2b0', roughness: 0.7, pattern: 'grid', light: true },
    wall: { colour: '#2e1d12', roughness: 0.5 },
    mark: '#1f4fa8',
    sound: DEFAULT_SOUND_TUNING,
    sharpness: DEFAULT_HAPTIC_TUNING.sharpness,
  },
  ...PRO_TABLES,
] as const satisfies readonly TableFields[]

/** A table, with the fields only some tables set readable on every one. */
export type Table = typeof TABLES[number] & TableFields
export type TableId = Table['id']

export const DEFAULT_TABLE_ID: TableId = 'felt'

export function isTableId(value: unknown): value is TableId {
  return TABLES.some(table => table.id === value)
}

export function findTable(id: TableId): Table {
  return TABLES.find(table => table.id === id)!
}
