/**
 * The scheme the phone apps open with, from the Dynamic Island's links. Keep
 * it in step with CupLink in ios/App/CupActivity/CupActivityWidget.swift,
 * CFBundleURLTypes in ios/App/App/Info.plist and the intent filter in
 * android/app/src/main/AndroidManifest.xml.
 */
const CUP_LINK_SCHEME = 'pocketdicecup'

/** The sheets a link can open: the dice to roll, and the history of rolls. */
const SHEETS = ['pool', 'history'] as const
export type CupLinkSheet = typeof SHEETS[number]

/**
 * The sheet `url` asks for, as `pocketdicecup://pool` or
 * `pocketdicecup://history`; null for any other link, which only brings the
 * cup to the front.
 */
export function parseCupLink(url: string): CupLinkSheet | null {
  let parsed: URL
  try {
    parsed = new URL(url)
  }
  catch {
    return null
  }
  if (parsed.protocol !== `${CUP_LINK_SCHEME}:`) return null
  // A custom scheme's first part is the host in some engines and the path in others.
  const target = (parsed.host || parsed.pathname.replace(/^\/+/, '')).toLowerCase()
  return SHEETS.find(sheet => sheet === target) ?? null
}
