import * as Tone from 'tone'
import { atom, getDefaultStore } from 'jotai'

type JotaiStore = ReturnType<typeof getDefaultStore>
const store: JotaiStore = getDefaultStore()

export const reverbWetAtom = atom(0.1)
export const eqLowAtom = atom(0)
export const eqMidAtom = atom(0)
export const eqHighAtom = atom(0)
export const masterVolumeDbAtom = atom(0)

class AudioEffectsBus {
  private static instance: AudioEffectsBus
  private reverb: Tone.Reverb
  private eq: Tone.EQ3
  private limiter: Tone.Limiter
  private masterGain: Tone.Gain

  private constructor() {
    // Subtle acoustic environment reverb
    this.reverb = new Tone.Reverb({
      decay: 1.8,
      preDelay: 0.01,
      wet: store.get(reverbWetAtom),
    })

    // 3-Band Equalizer for future visual EQ controls
    this.eq = new Tone.EQ3({
      low: store.get(eqLowAtom),
      mid: store.get(eqMidAtom),
      high: store.get(eqHighAtom),
    })

    // Master Limiter to prevent clipping
    this.limiter = new Tone.Limiter(-0.5)

    // Master Gain stage
    this.masterGain = new Tone.Gain(1)

    // Connect chain: EQ3 -> Reverb -> Limiter -> MasterGain -> Destination
    this.eq.connect(this.reverb)
    this.reverb.connect(this.limiter)
    this.limiter.connect(this.masterGain)
    this.masterGain.toDestination()

    // Subscribe to Jotai atoms for reactive EQ and reverb adjustments
    store.sub(reverbWetAtom, () => {
      this.reverb.wet.value = store.get(reverbWetAtom)
    })
    store.sub(eqLowAtom, () => {
      this.eq.low.value = store.get(eqLowAtom)
    })
    store.sub(eqMidAtom, () => {
      this.eq.mid.value = store.get(eqMidAtom)
    })
    store.sub(eqHighAtom, () => {
      this.eq.high.value = store.get(eqHighAtom)
    })
    store.sub(masterVolumeDbAtom, () => {
      this.masterGain.gain.value = Tone.dbToGain(store.get(masterVolumeDbAtom))
    })
  }

  public static getInstance(): AudioEffectsBus {
    if (!AudioEffectsBus.instance) {
      AudioEffectsBus.instance = new AudioEffectsBus()
    }
    return AudioEffectsBus.instance
  }

  public getInputElement(): Tone.InputNode {
    return this.eq
  }
}

export function getGlobalEffectsBus(): Tone.InputNode {
  return AudioEffectsBus.getInstance().getInputElement()
}
