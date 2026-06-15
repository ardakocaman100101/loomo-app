import { songToMidiBytes } from './src/features/studio/midi-encoder.js';
import * as tonejs from '@tonejs/midi';

const song = {
  tracks: { 0: { name: "Piano" } },
  notes: [
    { midiNote: 60, track: 0, time: 0, duration: 0.5 },
    { midiNote: 60, track: 0, time: 0.5, duration: 0.5 }
  ]
};

const bytes = songToMidiBytes(song as any);
const parsed = new tonejs.Midi(bytes);
console.log(parsed.tracks[0].notes.map(n => ({ time: n.time, duration: n.duration })));
