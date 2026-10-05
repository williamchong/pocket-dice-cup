import type { Surface } from '../physics/world'
import type { ImpactSound } from './cupFeedback'

/**
 * A clack is a burst of noise through a resonant band-pass, for the click of
 * the hit, over a short sine, for the knock of the die's body. Both die away
 * exponentially in `decay` seconds.
 */
interface Voice {
  /** Centre of the band-pass, in Hz. */
  band: number
  /** Sharpness of the band-pass: higher rings more like a hard surface. */
  q: number
  /** Pitch of the knock, in Hz. */
  knock: number
  decay: number
  gain: number
}

/**
 * The floor is felt, so a die landing on it thuds: low, damped and quieter.
 * The walls and the glass are hard and click; they share one voice because in
 * a shake the die hits both within milliseconds and nobody could tell them
 * apart.
 */
const FELT: Voice = { band: 750, q: 1.5, knock: 220, decay: 0.025, gain: 0.5 }
const HARD: Voice = { band: 3200, q: 4, knock: 1100, decay: 0.05, gain: 1 }
const VOICES: Record<Surface, Voice> = { floor: FELT, wall: HARD, glass: HARD }

/** Each clack is detuned at random by up to this fraction, so a rattle is not a machine gun. */
const DETUNE = 0.1
/** How loud the knock is next to the click. */
const KNOCK_GAIN = 0.6
/** A hard shake hits about 20 times a second; past this many at once, more clacks only add mud. */
const MAX_VOICES = 8
/** Noise long enough that each clack can start at a different place in it. */
const NOISE_SECONDS = 0.25
/** Exponential ramps cannot reach zero, so they end here, below hearing. */
const SILENT = 0.0001

/** Impact sounds synthesised with Web Audio, so there are no samples to download. */
export class ClackSound implements ImpactSound {
  private readonly context = new AudioContext()
  private readonly output: AudioNode
  private readonly noise: AudioBuffer
  private voices = 0

  constructor() {
    // iOS: follow the mute switch, as games do, and mix with other audio
    // rather than stopping it.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'ambient'

    // Many clacks landing together would clip; the compressor evens them out.
    this.output = new DynamicsCompressorNode(this.context, { threshold: -12, ratio: 8 })
    this.output.connect(this.context.destination)

    const { sampleRate } = this.context
    this.noise = new AudioBuffer({ length: Math.round(NOISE_SECONDS * sampleRate), sampleRate })
    const samples = this.noise.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = 2 * Math.random() - 1
  }

  unlock(): void {
    // A refusal leaves it suspended, and play() then stays silent.
    if (this.context.state !== 'running') this.context.resume().catch(() => {})
  }

  play(surface: Surface, strength: number): void {
    if (this.context.state !== 'running' || this.voices >= MAX_VOICES) return
    const { context } = this
    const voice = VOICES[surface]
    const detune = 1 + DETUNE * (2 * Math.random() - 1)
    const peak = Math.max(SILENT, voice.gain * strength)
    const start = context.currentTime
    const end = start + voice.decay

    const click = new AudioBufferSourceNode(context, { buffer: this.noise })
    const band = new BiquadFilterNode(context, { type: 'bandpass', frequency: voice.band * detune, Q: voice.q })
    click.connect(band).connect(decaying(context, peak, start, end)).connect(this.output)
    click.start(start, Math.random() * (NOISE_SECONDS - voice.decay), voice.decay)

    const knock = new OscillatorNode(context, { frequency: voice.knock * detune })
    knock.connect(decaying(context, peak * KNOCK_GAIN, start, end)).connect(this.output)
    knock.start(start)
    knock.stop(end)

    this.voices++
    click.onended = () => this.voices--
  }

  dispose(): void {
    this.context.close().catch(() => {})
  }
}

function decaying(context: AudioContext, peak: number, start: number, end: number): GainNode {
  const gain = new GainNode(context, { gain: peak })
  gain.gain.setValueAtTime(peak, start)
  gain.gain.exponentialRampToValueAtTime(SILENT, end)
  return gain
}
