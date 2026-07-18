import { Song, SongNote } from '@/types'
import { isBrowser } from '@/utils'

export default class FreePlayer {
  time: number = 0
  lastTime: number = 0
  raf: number | undefined
  song: Song
  active: Map<number, number> // Map from midiNote --> time created.
  isRecording: boolean = false

  constructor() {
    this.time = 0
    this.lastTime = 0
    this.active = new Map()
    this.song = {
      bpms: [{ time: 0, bpm: 120 }],
      tracks: { 0: { instrument: 'piano' } },
      measures: [],
      notes: [],
      duration: 0,
      items: [],
      keySignature: 'C',
      ppq: 480,
      ticksToSeconds: (ticks: number) => ticks / 480 / 2, // Assuming 120 bpm
      secondsToTicks: (seconds: number) => seconds * 480 * 2,
    }
    this.song.items = this.song.notes // Hack
  }

  start() {
    this.time = 0
    this.lastTime = Date.now()
    this.active.clear()
    this.song.notes = []
    this.song.items = this.song.notes
    this.isRecording = true
    this.loop()
  }

  stop() {
    this.isRecording = false
    if (typeof this.raf === 'number') {
      cancelAnimationFrame(this.raf)
      this.raf = undefined
    }
  }

  loop() {
    if (!this.isRecording) return

    this.raf = requestAnimationFrame(() => {
      const now = Date.now()
      const dt = now - this.lastTime
      this.time += dt
      this.lastTime = now

      // Extend each active note
      const currentTime = this.getTime()
      for (let [midiNote, pressedTime] of this.active.entries()) {
        let note = this.song.notes.find((n) => n.midiNote === midiNote && n.time === pressedTime)
        if (note) {
          note.duration = Math.max(0, currentTime - note.time)
        }
      }
      this.loop()
    })
  }

  addNote(midiNote: number, velocity: number = 80) {
    if (!this.isRecording) return
    const time = this.getTime()
    const note: SongNote = {
      midiNote,
      velocity,
      type: 'note',
      track: 0,
      time,
      duration: 0,
      measure: 0,
    }
    this.song.notes.push(note)
    this.active.set(midiNote, time)
  }

  releaseNote(midiNote: number) {
    this.active.delete(midiNote)
  }

  // In seconds
  getTime() {
    return this.time / 1000
  }
}
