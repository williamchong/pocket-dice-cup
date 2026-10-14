import type { CapacitorConfig } from '@capacitor/cli'

// The iOS and Android shells bundle the static web build, served from `/`
// rather than the GitHub Pages project path (docs/plan.md).
const config: CapacitorConfig = {
  appId: 'cloud.williamchong.pocketdicecup',
  appName: 'Pocket Dice Cup',
  webDir: '.output/public',
  // The felt of the cup, behind the page while it loads, where the WebView
  // would otherwise show black between the launch screen and the splash.
  backgroundColor: '#12241b',
  plugins: {
    // Android: light icons on the status and navigation bars, over the felt
    // in the phone's light theme too, and the page laid out under them from
    // the first frame, as its viewport has viewport-fit=cover (nuxt.config.ts).
    SystemBars: {
      style: 'DARK',
      initialViewportFitValueHint: 'cover',
    },
  },
}

export default config
