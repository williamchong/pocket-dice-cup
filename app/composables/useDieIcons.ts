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
 * Draws those of `dice` that are not drawn yet, all in one WebGL context. It
 * holds the page for a moment, so the cup calls it while idle, before anyone
 * opens a picker.
 */
function draw(dice: readonly DieIconRequest[]): void {
  const wanted = dice.filter(({ skin, kind }) => !requested.has(keyOf(skin.id, kind)))
  if (wanted.length === 0) return
  for (const { skin, kind } of wanted) requested.add(keyOf(skin.id, kind))
  // Imported here so three.js stays out of the initial bundle.
  import('~/engine/render/dieIcons')
    .then(({ renderDieIcons }) => {
      renderDieIcons(ICON_PIXELS, wanted).forEach((url, i) => icons.set(keyOf(wanted[i]!.skin.id, wanted[i]!.kind), url))
    })
    .catch((error) => {
      console.error(error)
    })
}

/** Draws every kind of die in `skin`, for the dice picker. */
export function drawDieIcons(skin: DieSkin): void {
  draw(DIE_KINDS.map(kind => ({ skin, kind })))
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
  draw(DIE_SKINS.map(skin => ({ skin, kind: 'd6' })))
  return computed(() => Object.fromEntries(DIE_SKINS.map(skin => [skin.id, icons.get(keyOf(skin.id, 'd6'))])) as Partial<Record<DieSkinId, string>>)
}
