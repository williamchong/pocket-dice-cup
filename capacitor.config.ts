import type { CapacitorConfig } from '@capacitor/cli'

// The iOS shell bundles the static web build, served from `/` rather than the
// GitHub Pages project path (docs/plan.md).
const config: CapacitorConfig = {
  appId: 'cloud.williamchong.pocketdicecup',
  appName: 'Pocket Dice Cup',
  webDir: '.output/public',
  // The felt of the cup, behind the page while it loads, where the WebView
  // would otherwise show black between the launch screen and the splash.
  backgroundColor: '#12241b',
}

export default config
