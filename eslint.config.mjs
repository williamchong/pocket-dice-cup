// @ts-check
import withNuxt from './.nuxt/eslint.config.mjs'

export default withNuxt(
  // The native shells hold only copies of the web build and Capacitor's own
  // scripts, and Gradle's build output under android/.
  { ignores: ['android/', 'ios/'] },
)
