const { Midi } = require('@tonejs/midi');
const midi = new Midi();
const track = midi.addTrack();
track.addNote({ midi: 60, time: 0, duration: 0.5 });
track.addNote({ midi: 60, time: 0.125, duration: 0.5 });
const parsed = new Midi(midi.toArray());
console.log(parsed.tracks[0].notes.map(n => ({ time: n.time, duration: n.duration })));
