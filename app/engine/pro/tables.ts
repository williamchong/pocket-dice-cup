import { DEFAULT_SOUND_TUNING } from '../feedback/clackSound'
import type { TableFields } from '../tables'

/**
 * The tables that come with Pro, in the order the picker shows them after the
 * free ones. Their looks are under CC BY-NC-ND 4.0 rather than the GPL; see
 * LICENSE.md in this folder.
 */
export const PRO_TABLES = [
  // A glass floor in a starship's deck, with deep space under it, in a
  // gunmetal hull, lit by a cool white lamp with little room light, so the
  // cup is dark outside its pool and neon dice stand out. Dice on glass and
  // metal ring higher and crisper than on cloth: the voices are a first
  // guess, to be tuned by ear on the iPhone as the felt's were.
  {
    id: 'space',
    floor: { colour: '#070a1c', roughness: 0.15, pattern: 'starfield', light: false },
    wall: { colour: '#1c212c', roughness: 0.35, metalness: 0.8 },
    mark: '#5ff0ff',
    light: { colour: '#dfe8ff', environment: 0.15 },
    panel: '#0b1030',
    // The neon dice's cyan, so the trim and the dice read as one set.
    accent: '#5ff0ff',
    sound: {
      floor: { band: 1600, q: 3, knock: 320, decay: 0.03, gain: 0.45 },
      side: { band: 2400, q: 4, knock: 650, decay: 0.04, gain: 0.8 },
      die: DEFAULT_SOUND_TUNING.die,
      muffleHz: 1400,
    },
    sharpness: { floor: 0.7, wall: 0.9, glass: 0.9, die: 0.8 },
    pro: true,
  },
] as const satisfies readonly TableFields[]
