const { Midi } = require('@tonejs/midi');
const fs = require('fs');
const midi = new Midi();
midi.header.setTempo(120);
midi.header.tempos = [{ ticks: 0, bpm: 120 }];
midi.header.update();

const track = midi.addTrack();
track.addNote({ midi: 60, time: 0, duration: 0.5 });
track.addNote({ midi: 60, time: 0.5, duration: 0.5 });

const bytes = midi.toArray();
const parsed = new Midi(bytes);
console.log(parsed.tracks[0].notes.map(n => ({ time: n.time, duration: n.duration })));
