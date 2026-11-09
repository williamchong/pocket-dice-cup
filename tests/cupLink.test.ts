import { describe, expect, it } from 'vitest'
import { parseCupLink } from '../app/utils/cupLink'

describe('parseCupLink', () => {
  it('opens the sheet the link names', () => {
    expect(parseCupLink('pocketdicecup://pool')).toBe('pool')
    expect(parseCupLink('pocketdicecup://history')).toBe('history')
    expect(parseCupLink('pocketdicecup://History/')).toBe('history')
  })

  it('opens nothing for any other link', () => {
    expect(parseCupLink('pocketdicecup://')).toBeNull()
    expect(parseCupLink('pocketdicecup://skin')).toBeNull()
    expect(parseCupLink('https://example.com/pool')).toBeNull()
    expect(parseCupLink('not a link')).toBeNull()
  })
})
