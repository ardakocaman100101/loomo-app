import fs from 'fs'
import * as tonejs from '@tonejs/midi'
import { songToMidiBytes } from './src/features/studio/midi-encoder.ts'
import parseMidi from './src/features/parsers/parse-midi.ts'

const bpm = 120;
const song: any = {
  tracks: { 0: { name: "Melody" } },
  notes: [
    { track: 0, midiNote: 60, time: 0.5, duration: 0.5, velocity: 80 },
    { track: 0, midiNote: 62, time: 1.0, duration: 0.5, velocity: 80 }
  ],
  bpms: [{ time: 0, bpm }],
  timeSignature: { numerator: 4, denominator: 4 },
  keySignature: "C",
  ppq: 480,
  secondsToTicks: (s: number) => Math.round(s * 480 * (bpm / 60) * 2),
  ticksToSeconds: (t: number) => t / (480 * (bpm / 60) * 2),
}

const bytes = songToMidiBytes(song);
const parsed = parseMidi(bytes);
console.log("Original notes:");
console.log(song.notes);
console.log("\nParsed notes:");
console.log(parsed.notes);
