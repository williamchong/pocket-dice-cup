import type { CapacitorConfig } from '@capacitor/cli'

// The iOS shell bundles the static web build, served from `/` rather than the
// GitHub Pages project path (docs/plan.md).
const config: CapacitorConfig = {
  appId: 'cloud.williamchong.pocketdicecup',
  appName: 'Pocket Dice Cup',
  webDir: '.output/public',
}

export default config
