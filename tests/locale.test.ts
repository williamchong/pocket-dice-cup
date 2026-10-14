import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import en from '../app/locales/en.json'
import zhCN from '../app/locales/zh-CN.json'
import zhHK from '../app/locales/zh-HK.json'
import { DIE_SKINS } from '../app/engine/render/skins'
import { pickLocale } from '../app/utils/locale'

describe('pickLocale', () => {
  it('reads English and simplified Chinese from their tags', () => {
    expect(pickLocale(['en-GB'])).toBe('en')
    expect(pickLocale(['zh-CN'])).toBe('zh-CN')
    expect(pickLocale(['zh-Hans-CN'])).toBe('zh-CN')
    expect(pickLocale(['zh-SG'])).toBe('zh-CN')
    expect(pickLocale(['zh'])).toBe('zh-CN')
  })

  it('gives traditional Chinese, from any region, the Hong Kong text', () => {
    expect(pickLocale(['zh-HK'])).toBe('zh-HK')
    expect(pickLocale(['zh-Hant-HK'])).toBe('zh-HK')
    expect(pickLocale(['zh-TW'])).toBe('zh-HK')
    expect(pickLocale(['zh-Hant'])).toBe('zh-HK')
    expect(pickLocale(['zh_MO'])).toBe('zh-HK')
  })

  it('passes over languages it lacks, and falls back to English', () => {
    expect(pickLocale(['fr-FR', 'zh-HK', 'en'])).toBe('zh-HK')
    expect(pickLocale(['ja-JP'])).toBe('en')
    expect(pickLocale([])).toBe('en')
  })
})

describe('the splash screen', () => {
  const template = readFileSync(new URL('../app/spa-loading-template.html', import.meta.url), 'utf8')
  const script = template.match(/<script>([\s\S]*?)<\/script>/)![1]!
  const MESSAGES = { 'en': en, 'zh-CN': zhCN, 'zh-HK': zhHK }

  /** The splash's name and status line, run with `languages` as the browser's. */
  function splash(languages: string[]) {
    const text: Record<string, string> = { '#splash .splash__name': en.app.name, '#splash .splash__status': 'Loading…' }
    const document = { querySelector: (selector: string) => ({ set textContent(value: string) { text[selector] = value } }) }
    new Function('navigator', 'document', script)({ languages }, document)
    return [text['#splash .splash__name'], text['#splash .splash__status']]
  }

  const LOADING = { 'en': 'Loading…', 'zh-CN': '加载中…', 'zh-HK': '載入中…' }

  it.each([['en-US'], ['zh-Hans-CN'], ['zh-HK'], ['zh-TW'], ['fr', 'zh-MO'], ['ja']])('picks the language pickLocale picks for %s', (...languages) => {
    const locale = pickLocale(languages)
    expect(splash(languages)).toEqual([MESSAGES[locale].app.name, LOADING[locale]])
  })
})

/** Every key in `messages`, as "cup.settle". */
function keys(messages: object, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'object' ? keys(value, `${prefix}${key}.`) : [`${prefix}${key}`])
}

describe('translations', () => {
  it.each([['zh-CN', zhCN], ['zh-HK', zhHK]])('%s has every English key and no others', (_, messages) => {
    expect(keys(messages).sort()).toEqual(keys(en).sort())
  })

  it('names every skin', () => {
    for (const skin of DIE_SKINS) expect(en.skin).toHaveProperty(skin.id)
  })
})
