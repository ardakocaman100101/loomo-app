const { Midi } = require('@tonejs/midi');

const song = {
  tracks: { 0: { name: "Piano" } },
  notes: [
    { midiNote: 60, track: 0, time: 0, duration: 0.5 },
    { midiNote: 60, track: 0, time: 0.5, duration: 0.5 }
  ],
  bpms: [{ time: 0, bpm: 120 }],
  secondsToTicks: (s) => Math.round(s * 480 * (120 / 60))
};

const midi = new Midi();
midi.header.setTempo(120);
midi.header.tempos = song.bpms.map((bpmEvent) => {
  const ticks = song.secondsToTicks(bpmEvent.time);
  return { ticks, bpm: bpmEvent.bpm };
});
midi.header.update();

const toneTrack = midi.addTrack();
song.notes.forEach(note => {
  toneTrack.addNote({
    midi: note.midiNote,
    time: note.time,
    duration: note.duration,
    velocity: 0.8
  });
});

const bytes = midi.toArray();
const parsed = new Midi(bytes);
console.log(parsed.tracks[0].notes.map(n => ({ time: n.time, duration: n.duration })));
