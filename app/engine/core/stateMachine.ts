export type CupState = 'idle' | 'shaking' | 'settling' | 'result'

export interface CupInput {
  /** The device is being shaken hard enough to count as rolling. */
  shaking: boolean
  /** The device has been still and screen-up for a moment. */
  restingFaceUp: boolean
  /** Every die has stopped moving. */
  diceAtRest: boolean
}

export function nextState(state: CupState, input: CupInput): CupState {
  // A shake restarts the roll from any state, including a shown result.
  if (input.shaking) return 'shaking'
  if (state === 'shaking' && input.restingFaceUp) return 'settling'
  if (state === 'settling' && input.diceAtRest) return 'result'
  return state
}
