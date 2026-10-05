import type { Surface } from '../physics/world'
import type { ImpactSound } from './cupFeedback'

/**
 * A clack is a burst of noise through a resonant band-pass, for the click of
 * the hit, over a short sine, for the knock of the die's body. Both die away
 * exponentially in `decay` seconds.
 */
export interface Voice {
  /** Centre of the band-pass, in Hz. */
  band: number
  /** Sharpness of the band-pass: higher rings more like a hard surface. */
  q: number
  /** Pitch of the knock, in Hz. */
  knock: number
  decay: number
  gain: number
}

export interface SoundTuning {
  /** The floor is felt, so a die landing on it thuds: low, damped and quieter. */
  floor: Voice
  /**
   * The walls and the glass share one voice because in a shake the die hits
   * both within milliseconds and nobody could tell them apart. It is the
   * inside of a lined cup, so a dull knock rather than a click: a bright,
   * ringing voice sounded like dice in a tin.
   */
  side: Voice
  /**
   * Every clack goes through a low-pass at this (Hz), which takes the hiss
   * off the noise. Tuned by ear on an iPhone Air and a MacBook Pro: 600-700
   * Hz sounded like a lined cup on both.
   */
  muffleHz: number
}

export const DEFAULT_SOUND_TUNING: Readonly<SoundTuning> = {
  floor: { band: 600, q: 1, knock: 180, decay: 0.022, gain: 0.5 },
  side: { band: 1300, q: 1.5, knock: 400, decay: 0.03, gain: 0.9 },
  muffleHz: 650,
}

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
  /** Where every clack goes: through it to the compressor and the speaker. */
  private readonly muffle: BiquadFilterNode
  private readonly noise: AudioBuffer
  private voices = 0
  /** Why the context last refused to start, for the debug readout. */
  private resumeError = ''
  /** Changed live from the debug overlay, to tune the sound on a phone. */
  readonly tuning: SoundTuning = structuredClone(DEFAULT_SOUND_TUNING)

  constructor() {
    // iOS: follow the mute switch, as games do, and mix with other audio
    // rather than stopping it.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession
    if (session) session.type = 'ambient'

    // Many clacks landing together would clip; the compressor evens them out.
    const compressor = new DynamicsCompressorNode(this.context, { threshold: -12, ratio: 8 })
    compressor.connect(this.context.destination)
    this.muffle = new BiquadFilterNode(this.context, { type: 'lowpass', frequency: this.tuning.muffleHz })
    this.muffle.connect(compressor)

    const { sampleRate } = this.context
    this.noise = new AudioBuffer({ length: Math.round(NOISE_SECONDS * sampleRate), sampleRate })
    const samples = this.noise.getChannelData(0)
    for (let i = 0; i < samples.length; i++) samples[i] = 2 * Math.random() - 1
  }

  /** The context's state ("interrupted" is iOS only) and the clacks still sounding. */
  get state(): string {
    const refused = this.resumeError ? `, refused: ${this.resumeError}` : ''
    return `${this.context.state}, ${this.voices} voices${refused}`
  }

  async unlock(): Promise<void> {
    if (this.context.state === 'running') return
    try {
      await this.context.resume()
    }
    catch (error) {
      // A refusal leaves it suspended, and play() then stays silent.
      this.resumeError = String(error)
    }
  }

  play(surface: Surface, strength: number): void {
    if (this.context.state !== 'running' || this.voices >= MAX_VOICES) return
    const { context } = this
    const voice = surface === 'floor' ? this.tuning.floor : this.tuning.side
    if (this.muffle.frequency.value !== this.tuning.muffleHz) this.muffle.frequency.value = this.tuning.muffleHz
    const detune = 1 + DETUNE * (2 * Math.random() - 1)
    const peak = Math.max(SILENT, voice.gain * strength)
    const start = context.currentTime
    const end = start + voice.decay

    const click = new AudioBufferSourceNode(context, { buffer: this.noise })
    const band = new BiquadFilterNode(context, { type: 'bandpass', frequency: voice.band * detune, Q: voice.q })
    click.connect(band).connect(decaying(context, peak, start, end)).connect(this.muffle)
    click.start(start, Math.random() * (NOISE_SECONDS - voice.decay), voice.decay)

    const knock = new OscillatorNode(context, { frequency: voice.knock * detune })
    knock.connect(decaying(context, peak * KNOCK_GAIN, start, end)).connect(this.muffle)
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
