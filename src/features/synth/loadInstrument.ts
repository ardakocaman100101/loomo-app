import * as Tone from 'tone'
import { getInstrumentSampleMap, InstrumentName } from './instruments'

export const samplers: { [key in InstrumentName]?: Tone.Sampler | Tone.PolySynth } = {}
const downloading: { [key in InstrumentName]?: Promise<Tone.Sampler | Tone.PolySynth> } = {}

export async function loadInstrument(
  instrument: InstrumentName,
): Promise<Tone.Sampler | Tone.PolySynth> {
  // Already loaded
  if (samplers[instrument]) {
    return samplers[instrument]!
  }
  // Load in-progress
  if (downloading[instrument]) {
    return downloading[instrument]!
  }

  const sampleMap = getInstrumentSampleMap(instrument)

  const loadPromise = new Promise<Tone.Sampler | Tone.PolySynth>((resolve) => {
    const sampler = new Tone.Sampler({
      urls: sampleMap,
      onload: () => {
        resolve(sampler)
      },
      onerror: (err) => {
        console.warn(`Error loading samples for ${instrument}, fallback engaged.`, err)
        resolve(sampler)
      },
    })
  })

  downloading[instrument] = loadPromise

  try {
    const loadedSampler = await loadPromise
    samplers[instrument] = loadedSampler
    delete downloading[instrument]
    return loadedSampler
  } catch (err) {
    console.error(`Failed loading sampler for ${instrument}, using PolySynth fallback:`, err)
    const polySynth = new Tone.PolySynth(Tone.Synth)
    samplers[instrument] = polySynth
    delete downloading[instrument]
    return polySynth
  }
}
