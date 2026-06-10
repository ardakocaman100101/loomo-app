const tonejs = require('@tonejs/midi')

const midi = new tonejs.Midi()
midi.header.setTempo(120)

console.log("Before manual assignment:", midi.header.tempos)

midi.header.tempos = [
  {
    ticks: 0,
    bpm: 120,
  }
]

const toneTrack = midi.addTrack()
toneTrack.addNote({
  midi: 60,
  time: 0.5,
  duration: 0.5,
})

console.log(toneTrack.notes[0]);
