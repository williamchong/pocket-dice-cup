import {
  AdditiveBlending,
  ShaderMaterial,
  Vector2,
  WebGLRenderTarget,
  type WebGLRenderer,
} from 'three'
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js'

/**
 * The halo is worked out at a fraction of the screen's pixels, as it is a
 * blur and needs none of their detail: a near halo at a quarter of the
 * width, about 6 px across a d6's pip at a pixel ratio of 2, and a far one a
 * quarter of that again, which reaches out over the floor.
 */
const NEAR_SCALE = 4
const FAR_SCALE = 16
/**
 * How bright each halo is added, as a multiple of the glow colour. The near
 * one makes the pips and edges bloom onto the dark body round them, as a lit
 * tube does through smoked glass; the far one is the light the tubes throw
 * on the floor. At 1.4 and 1.6 the dice's bodies washed out to cyan.
 */
const NEAR_STRENGTH = 0.8
const FAR_STRENGTH = 1

/** A 9-tap Gaussian blur along `direction`, in the source's texels. */
const BLUR_SHADER = /* glsl */ `
  uniform sampler2D source;
  uniform vec2 direction;
  varying vec2 vUv;
  void main() {
    vec4 sum = texture2D(source, vUv) * 0.227027;
    sum += (texture2D(source, vUv + direction) + texture2D(source, vUv - direction)) * 0.1945946;
    sum += (texture2D(source, vUv + direction * 2.0) + texture2D(source, vUv - direction * 2.0)) * 0.1216216;
    sum += (texture2D(source, vUv + direction * 3.0) + texture2D(source, vUv - direction * 3.0)) * 0.054054;
    sum += (texture2D(source, vUv + direction * 4.0) + texture2D(source, vUv - direction * 4.0)) * 0.016216;
    gl_FragColor = sum;
  }
`

/**
 * Added onto the screen after the dice were tone-mapped, so it is not
 * tone-mapped again; the render targets hold linear colour, so it is only
 * encoded for the screen.
 */
const COMPOSITE_SHADER = /* glsl */ `
  uniform sampler2D mask;
  uniform sampler2D near;
  uniform sampler2D far;
  uniform float nearStrength;
  uniform float farStrength;
  varying vec2 vUv;
  void main() {
    // The far halo is light on the floor, so a die's body, opaque in the mask, hides it.
    vec3 floorLight = texture2D(far, vUv).rgb * farStrength * (1.0 - texture2D(mask, vUv).a);
    gl_FragColor = vec4(texture2D(near, vUv).rgb * nearStrength + floorLight, 1.0);
    #include <colorspace_fragment>
  }
`

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`

/** A target only blurred into, which never needs a depth buffer. */
const blurTarget = () => new WebGLRenderTarget(1, 1, { depthBuffer: false })

/**
 * The glow of a neon die spilling round its lit parts, so the light follows
 * the shape of its edges and pips rather than lying round it in a disc. The
 * caller draws only what glows into a mask, then this blurs it twice over,
 * near and far, and adds both onto the screen. A full bloom pass would blur
 * every bright pixel at full size, and change how every skin is tone-mapped;
 * this blurs only the glow, at a sixteenth and a 256th of the pixels.
 */
export class NeonHalo {
  /** The dice's lit parts, in colour, and their bodies, in alpha; with depth, so a die hides the glow of one behind it. */
  private readonly mask = new WebGLRenderTarget(1, 1)
  private readonly near = blurTarget()
  private readonly nearSpare = blurTarget()
  private readonly far = blurTarget()
  private readonly farSpare = blurTarget()
  private readonly source = { value: this.mask.texture }
  private readonly direction = { value: new Vector2() }
  private readonly farStrength = { value: FAR_STRENGTH }
  private readonly blur = new ShaderMaterial({
    uniforms: { source: this.source, direction: this.direction },
    vertexShader: VERTEX_SHADER,
    fragmentShader: BLUR_SHADER,
    depthTest: false,
    depthWrite: false,
  })

  private readonly composite = new ShaderMaterial({
    uniforms: {
      mask: { value: this.mask.texture },
      near: { value: this.near.texture },
      far: { value: this.far.texture },
      nearStrength: { value: NEAR_STRENGTH },
      farStrength: this.farStrength,
    },
    vertexShader: VERTEX_SHADER,
    fragmentShader: COMPOSITE_SHADER,
    blending: AdditiveBlending,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })

  private readonly quad = new FullScreenQuad()

  /** Sized to the canvas's drawing buffer, in device pixels. */
  setSize(width: number, height: number): void {
    for (const [targets, scale] of [[[this.mask, this.near, this.nearSpare], NEAR_SCALE], [[this.far, this.farSpare], FAR_SCALE]] as const) {
      for (const target of targets) target.setSize(Math.max(1, Math.round(width / scale)), Math.max(1, Math.round(height / scale)))
    }
  }

  /** Whether the far halo, the light the tubes throw on the floor, is added. */
  set floorGlow(shown: boolean) {
    this.farStrength.value = shown ? FAR_STRENGTH : 0
  }

  /**
   * Has `drawMask` draw the dice's lit parts into the mask, cleared to
   * transparent black so the halo can tell a die's body from the floor,
   * then adds the halo onto what the screen already shows.
   */
  render(renderer: WebGLRenderer, drawMask: () => void): void {
    const clearAlpha = renderer.getClearAlpha()
    renderer.setRenderTarget(this.mask)
    renderer.setClearAlpha(0)
    drawMask()
    renderer.setClearAlpha(clearAlpha)

    this.blurInto(renderer, this.mask, this.nearSpare, this.near)
    // Each far texel covers four near ones each way, so the far blur spreads four times as wide.
    this.blurInto(renderer, this.near, this.farSpare, this.far)

    this.quad.material = this.composite
    const autoClear = renderer.autoClear
    renderer.autoClear = false
    renderer.setRenderTarget(null)
    this.quad.render(renderer)
    renderer.autoClear = autoClear
  }

  /** Blurs `from` across into `spare`, then down into `to`, at `to`'s size. */
  private blurInto(renderer: WebGLRenderer, from: WebGLRenderTarget, spare: WebGLRenderTarget, to: WebGLRenderTarget): void {
    this.quad.material = this.blur
    this.source.value = from.texture
    this.direction.value.set(1 / to.width, 0)
    renderer.setRenderTarget(spare)
    this.quad.render(renderer)
    this.source.value = spare.texture
    this.direction.value.set(0, 1 / to.height)
    renderer.setRenderTarget(to)
    this.quad.render(renderer)
  }

  dispose(): void {
    for (const target of [this.mask, this.near, this.nearSpare, this.far, this.farSpare]) target.dispose()
    this.blur.dispose()
    this.composite.dispose()
    this.quad.dispose()
  }
}
