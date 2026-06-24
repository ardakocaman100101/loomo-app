import { songToMidiBytes } from './src/features/studio/midi-encoder'
import parseMidi from './src/features/parsers/parse-midi'

const song = {
  bpms: [{ time: 0, bpm: 120 }],
  timeSignature: { numerator: 4, denominator: 4 },
  keySignature: "C",
  ppq: 480,
  secondsToTicks: (s: number) => Math.round(s * 480 * (120 / 60)),
  ticksToSeconds: (t: number) => t / (480 * (120 / 60)),
  tracks: { 0: { name: "Piano", instrument: "acoustic_grand_piano", program: 0 } },
  notes: [
    { track: 0, midiNote: 60, time: 0, duration: 1, velocity: 80 },
    { track: 0, midiNote: 62, time: 1, duration: 1, velocity: 80 }
  ]
};

const bytes = songToMidiBytes(song as any);
const parsed = parseMidi(bytes as any);
console.log("Original Notes:");
console.log(song.notes);
console.log("Parsed Notes:");
console.log(parsed.notes);
