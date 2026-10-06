import { compareKinds, DIE_KINDS, isDieKind, type DieKind } from '../dice/shapes'

/** The most dice the cup holds, for screen space and performance. */
export const MAX_DICE = 12

/**
 * The dice in the cup, one kind per die, smallest kind first. Between 1 and
 * MAX_DICE long; normalisePool makes one from any list of kinds.
 */
export type DicePool = readonly DieKind[]

/** `kinds` sorted smallest kind first, cut to MAX_DICE, and a lone d6 if empty. */
export function normalisePool(kinds: readonly DieKind[]): DicePool {
  const sorted = [...kinds].sort(compareKinds).slice(0, MAX_DICE)
  return sorted.length > 0 ? sorted : ['d6']
}

/** `count` d6, the pool before the kinds of dice could be chosen. */
export function d6Pool(count: number): DicePool {
  return normalisePool(Array.from({ length: count }, () => 'd6'))
}

/** How many dice of each kind are in `pool`. */
export function countKinds(pool: DicePool): Record<DieKind, number> {
  const counts = Object.fromEntries(DIE_KINDS.map(kind => [kind, 0])) as Record<DieKind, number>
  for (const kind of pool) counts[kind]++
  return counts
}

/** `pool` with `count` dice of `kind`, the others unchanged. */
export function withCount(pool: DicePool, kind: DieKind, count: number): DicePool {
  return normalisePool([...pool.filter(other => other !== kind), ...Array.from({ length: count }, () => kind)])
}

const TERM = /^(\d*)d(\d+)$/

/**
 * The pool written in dice notation, such as "3d6 + d20": terms joined by +,
 * each an optional count and a kind. Case does not matter, and a kind given
 * twice is added up. Spaces also part terms, as a + in a link's query can
 * arrive as one. Null for anything else, a count of 0, or more than
 * MAX_DICE dice.
 */
export function parseNotation(notation: string): DicePool | null {
  const kinds: DieKind[] = []
  const terms = notation.toLowerCase().split(/[+\s]+/).filter(Boolean)
  if (terms.length === 0) return null
  for (const term of terms) {
    const match = TERM.exec(term)
    if (!match) return null
    const count = match[1] ? Number(match[1]) : 1
    const kind = `d${Number(match[2])}`
    if (count < 1 || !isDieKind(kind)) return null
    if (kinds.length + count > MAX_DICE) return null
    for (let i = 0; i < count; i++) kinds.push(kind)
  }
  return normalisePool(kinds)
}

/** `pool` in dice notation, smallest kind first: "3d6 + 1d20". */
export function formatPool(pool: DicePool): string {
  const counts = countKinds(pool)
  return DIE_KINDS.filter(kind => counts[kind] > 0).map(kind => `${counts[kind]}${kind}`).join(' + ')
}
