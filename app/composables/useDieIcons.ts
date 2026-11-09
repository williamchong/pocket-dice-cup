import { DIE_KINDS, type DieKind } from '~/engine/dice/shapes'
import type { DieIconRequest } from '~/engine/render/dieIcons'
import { DIE_SKINS, type DieSkin, type DieSkinId } from '~/engine/render/skins'

/** Big enough for a 44 px picture on a 3x screen. */
const ICON_PIXELS = 132

/** The pictures drawn so far, by skin and kind, as image URLs. */
const icons = reactive(new Map<string, string>())
/** Every picture asked for, drawn or not, so none is drawn twice. */
const requested = new Set<string>()

const keyOf = (skin: DieSkinId, kind: DieKind) => `${skin}/${kind}`

/**
 * The drawing under way, which the next waits for: drawn side by side, each
 * would hold a WebGL context and compile the same shaders again.
 */
let drawing = Promise.resolve()

/**
 * Draws those of `dice` that are not drawn yet, all in one WebGL context,
 * over several tasks so the page is not held for long.
 */
function draw(dice: readonly DieIconRequest[]): void {
  const wanted: DieIconRequest[] = []
  for (const die of dice) {
    const key = keyOf(die.skin.id, die.kind)
    if (requested.has(key)) continue
    requested.add(key)
    wanted.push(die)
  }
  if (wanted.length === 0) return
  drawing = drawing
    // Imported here so three.js stays out of the initial bundle.
    .then(() => import('~/engine/render/dieIcons'))
    .then(async ({ renderDieIcons }) => {
      const urls = await renderDieIcons(ICON_PIXELS, wanted)
      wanted.forEach(({ skin, kind }, i) => icons.set(keyOf(skin.id, kind), urls[i]!))
    })
    .catch((error) => {
      console.error(error)
    })
}

const kindsIn = (skin: DieSkin): DieIconRequest[] => DIE_KINDS.map(kind => ({ skin, kind }))
const skinPicker = (): DieIconRequest[] => DIE_SKINS.map(skin => ({ skin, kind: 'd6' }))

/** Draws every kind of die in `skin`, for the dice picker. */
export function drawDieIcons(skin: DieSkin): void {
  draw(kindsIn(skin))
}

/**
 * Draws both pickers' pictures, every kind in `skin` and a d6 in each skin,
 * in one go: compiling the skins' shaders takes too long to leave until the
 * Style sheet is opening.
 */
export function drawPickerIcons(skin: DieSkin): void {
  draw([...kindsIn(skin), ...skinPicker()])
}

/** A picture of each kind of die in `skin` showing its highest face, each missing until drawn. */
export function useDieIcons(skin: MaybeRefOrGetter<DieSkin>) {
  watchEffect(() => drawDieIcons(toValue(skin)))
  return computed(() => {
    const id = toValue(skin).id
    return Object.fromEntries(DIE_KINDS.map(kind => [kind, icons.get(keyOf(id, kind))])) as Partial<Record<DieKind, string>>
  })
}

/** A d6 in each skin, to pick one by, each missing until drawn. */
export function useSkinIcons() {
  draw(skinPicker())
  return computed(() => Object.fromEntries(DIE_SKINS.map(skin => [skin.id, icons.get(keyOf(skin.id, 'd6'))])) as Partial<Record<DieSkinId, string>>)
}
