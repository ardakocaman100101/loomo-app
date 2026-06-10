const { Midi } = require('@tonejs/midi');
const fs = require('fs');

const midi = new Midi();
midi.name = 'Loomo Studio Session';
midi.header.setTempo(120);
midi.header.update();

const track = midi.addTrack();
track.addNote({
  midi: 60,
  time: 0,
  duration: 1,
  velocity: 0.8
});
track.addNote({
  midi: 62,
  time: 1,
  duration: 1,
  velocity: 0.8
});

const bytes = midi.toArray();
const parsed = new Midi(bytes);

console.log("Parsed tempos:");
console.log(parsed.header.tempos);
console.log("Parsed Notes:");
console.log(parsed.tracks[0].notes.map(n => ({ time: n.time, duration: n.duration })));
