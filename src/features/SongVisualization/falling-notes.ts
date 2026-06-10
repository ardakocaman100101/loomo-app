import { line, roundRect } from '@/features/drawing'
import {
  drawPianoRoll,
  getPianoRollMeasurements,
  handlePianoRollMousePress,
  PianoRollMeasurements,
} from '@/features/drawing/piano'
import { getFixedDoNoteFromKey, getKey, isBlack } from '@/features/theory'
import { palette } from '@/styles/common'
import type { SongMeasure, SongNote } from '@/types'
import { clamp } from '@/utils'
import midiState from '../midi'
import { getRelativePointerCoordinates } from '../pointer'
import { GivenState } from './canvas-renderer'
import {
  CanvasItem,
  getFontSize,
  getItemsInView,
  getOptimalFontSize,
  getSongRange,
  Viewport,
} from './utils'

const TEXT_FONT = 'monospace'
const colors = {
  right: {
    black: palette.purple.dark,
    white: palette.purple.primary,
  },
  left: {
    black: palette.orange.dark,
    white: palette.orange.primary,
  },
  measure: 'rgb(60,60,60)',
  octaveLine: 'rgb(90,90,90)',
  rangeSelectionFill: '#44b22e',
}

function getActiveNotes(state: State): Map<number, string> {
  const activeNotes = new Map<number, string>(state.player.pressFeedback)
  for (let midiNote of midiState.getPressedNotes().keys()) {
    if (!activeNotes.has(midiNote)) {
      activeNotes.set(midiNote, 'grey')
    }
  }

  return activeNotes
}

function isPlayingNote(state: State, note: SongNote) {
  const baselineY = state.pianoTopY - 2
  const itemPos = getItemStartEnd(note, state)
  return itemPos.start <= baselineY && itemPos.end > baselineY
}

function getViewport(state: Readonly<GivenState>): Viewport {
  // Time is on Y-axis (vertical) for falling notes.
  return {
    start: state.time * state.pps,
    end: state.time * state.pps + state.height,
  }
}

type State = GivenState & {
  viewport: Viewport
  pianoMeasurements: PianoRollMeasurements
  pianoTopY: number
  pianoWidth: number
  noteHitY: number
}

function deriveState(state: GivenState): State {
  let items = state.constrictView ? state.items : undefined
  const notes: SongNote[] = items
    ? (items.filter((i) => i.type === 'note') as SongNote[])
    : ([{ midiNote: 21 }, { midiNote: 108 }] as SongNote[])

  let minNotes = state.zoomMode ?? 36
  if (state.zoomMode === undefined && state.height > state.windowWidth) {
    if (state.height > 800) minNotes = 88
    else if (state.height > 600) minNotes = 72
    else if (state.height > 500) minNotes = 60
    else if (state.height > 400) minNotes = 40
    else if (state.height > 300) minNotes = 32
  }

  const { startNote: songStart, endNote: songEnd } = getSongRange({ notes }, minNotes)
  const instrumentRange = midiState.detectedRange
  const { startNote, endNote } = getKeyboardRange(songStart, songEnd, instrumentRange)
  const pianoMeasurements = getPianoRollMeasurements(state.windowWidth, { startNote, endNote })
  const pianoTopY = Math.max(0, state.height - pianoMeasurements.whiteHeight - 5)
  const pianoWidth = pianoMeasurements.pianoWidth
  const noteHitY = pianoTopY

  const averageLaneHeight = state.height / minNotes
  const averageCircleRadius = (averageLaneHeight / 2) - 1
  // Perfect tolerance inside the circle, exactly matching the radius in terms of MS
  // Multiplied by 2.5 to make it more forgiving and easier to get green.
  const perfectRangeMs = (averageCircleRadius / state.pps) * 1000 * 1.5
  // Yellow/purple boundary (e.g. 4 times the circle radius)
  const goodRangeMs = perfectRangeMs * 4
  state.player.setTolerance(perfectRangeMs, goodRangeMs)

  lastState = {
    ...state,
    pianoMeasurements,
    viewport: getViewport(state),
    pianoTopY,
    pianoWidth,
    noteHitY,
  }
  return lastState
}

function getKeyboardRange(
  songStart: number,
  songEnd: number,
  instrumentRange: { start: number; end: number } | null,
) {
  const songSpan = songEnd - songStart
  if (!instrumentRange) {
    return { startNote: songStart, endNote: songEnd }
  }

  const instrumentSpan = instrumentRange.end - instrumentRange.start
  if (songSpan >= instrumentSpan) {
    return { startNote: songStart, endNote: songEnd }
  }

  const desiredStart = Math.min(
    Math.max(instrumentRange.start, songStart),
    instrumentRange.end - instrumentSpan,
  )
  const startNote = desiredStart
  const endNote = desiredStart + instrumentSpan

  return { startNote, endNote }
}

function getFallingNoteItemsInView<T>(state: State): CanvasItem[] {
  let startPred = (item: CanvasItem) => getItemStartEnd(item, state).end >= 0
  let endPred = (item: CanvasItem) => getItemStartEnd(item, state).start > state.height
  return getItemsInView(state, startPred, endPred)
}


export function renderFallingVis(givenState: GivenState): void {
  const state: State = deriveState(givenState)
  state.ctx.fillStyle = '#2e2e2e' // background color
  state.ctx.fillRect(0, 0, state.windowWidth, state.height)

  // Debug first frame only
  if (state.time < 0.1) {
    console.log('=== FIRST FRAME DEBUG ===')
    console.log('Total items:', state.items.length)
    const notes = state.items.filter(i => i.type === 'note')
    console.log('Notes in items:', notes.length)
    if (notes.length > 0) {
      console.log('Note time range:', Math.min(...notes.map(n => (n as any).time)), 'to', Math.max(...notes.map(n => (n as any).time)))
      console.log('First 5 notes:', notes.slice(0, 5).map(n => ({ time: (n as any).time, midi: (n as any).midiNote })))
    }
  }

  const items = getFallingNoteItemsInView(state)

  // Debug per-frame counts
  if (state.time < 5) {
    const noteItems = items.filter((i) => i.type === 'note')
    const upcomingWindowStart = state.time
    const upcomingWindowEnd = state.time + state.height / state.pps
    const upcomingNotes = state.items.filter((i) => i.type === 'note' && (i as SongNote).time >= upcomingWindowStart && (i as SongNote).time <= upcomingWindowEnd)
    console.log('Frame debug: itemsInView=', items.length, 'noteItemsInView=', noteItems.length, 'upcomingWindowNotes=', upcomingNotes.length, 'time=', state.time)
  }

  renderOctaveRuler(state)
  renderHitLine(state)

  for (let i of items) {
    if (i.type === 'measure') {
      renderMeasure(i, state)
    }
  }

  for (let i of items) {
    if (i.type === 'note') {
      renderFallingNote(i, state)
    }
  }

  if (state.selectedRange) {
    renderRange(state)
  }

  handlePianoRollMousePress(
    state.pianoMeasurements,
    state.pianoTopY,
    getRelativePointerCoordinates(state.canvasRect.left, state.canvasRect.top),
  )
  drawPianoRoll(
    state.ctx,
    state.pianoMeasurements,
    state.pianoTopY,
    getActiveNotes(state),
  )
}

function renderHitLine(state: State) {
  const { ctx, noteHitY, windowWidth, pianoTopY } = state
  ctx.save()
  
  // Dashed baseline just above the keyboard
  const baselineY = pianoTopY - 2
  ctx.beginPath()
  ctx.setLineDash([8, 5])
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)'
  ctx.lineWidth = 3
  ctx.moveTo(0, baselineY)
  ctx.lineTo(windowWidth, baselineY)
  ctx.stroke()
  
  ctx.restore()
}

function getNoteColor(state: State, note: SongNote): string {
  const hand = state.hands[note.track]?.hand ?? 'both'
  const keyType = isBlack(note.midiNote) ? 'black' : 'white'

  let color
  if (hand === 'both' || hand === 'right') {
    color = colors.right[keyType]
  } else {
    color = colors.left[keyType]
  }
  return color
}

function renderRange(state: State) {
  const { ctx, height, noteHitY, pps } = state
  if (!state.selectedRange) {
    return
  }

  const { start, end } = state.selectedRange
  ctx.save()
  const duration = end - start
  const canvasY = getItemStartEnd({ type: 'note', time: start, duration } as CanvasItem, state).start
  const rectHeight = duration * pps
  ctx.fillStyle = colors.rangeSelectionFill
  ctx.globalAlpha = 0.5
  ctx.fillRect(0, canvasY, state.windowWidth, rectHeight)
  ctx.restore()
}

function renderOctaveRuler(state: State) {
  const { ctx } = state
  ctx.save()
  ctx.lineWidth = 2
  for (let [midiNote, lane] of Object.entries(state.pianoMeasurements.lanes)) {
    const key = getKey(+midiNote)
    const { left } = lane
    if (key === 'C') {
      ctx.strokeStyle = colors.octaveLine
      line(ctx, left, 0, left, state.pianoTopY)
    }
    if (key === 'F') {
      ctx.strokeStyle = colors.measure
      line(ctx, left, 0, left, state.pianoTopY)
    }
  }
  ctx.restore()
}

export function renderFallingNote(note: SongNote, state: State): void {
  if (!(note.midiNote in state.pianoMeasurements.lanes)) {
    return
  }

  const { ctx, pps, noteLabels, pianoTopY, pianoMeasurements } = state
  const lane = state.pianoMeasurements.lanes[note.midiNote]
  const keyTop = pianoTopY
  const keyHeight = isBlack(note.midiNote) ? pianoMeasurements.blackHeight : pianoMeasurements.whiteHeight

  const posX = Math.floor(lane.left + 1)
  const posY = getItemStartEnd(note, state).start
  const width = Math.max(lane.width - 2, 8)

  const actualLength = note.duration * pps
  const minLengthToDisplayCircle = Math.max(keyHeight, 18)
  const length = Math.max(actualLength, minLengthToDisplayCircle)

  const color = getNoteColor(state, note)

  ctx.save()

  const tailEndY = posY + length - width / 2
  if (tailEndY > posY) {
    const grad = ctx.createLinearGradient(posX, posY, posX, posY + length)
    grad.addColorStop(0, color)
    grad.addColorStop(1, color)
    ctx.fillStyle = grad
    ctx.strokeStyle = 'transparent'
    ctx.globalAlpha = 0.8

    roundRect(ctx, posX, posY + width * 0.15, width, length - width * 0.15, {
      topRadius: width * 0.35,
      bottomRadius: width * 0.35,
    })

    ctx.globalAlpha = 1.0
  }

  const circleRadius = Math.min(width / 2, keyHeight / 2)
  const circleCenterX = posX + width / 2
  const circleCenterY = posY + circleRadius
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(circleCenterX, circleCenterY, circleRadius, 0, 2 * Math.PI)
  ctx.fill()

  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.stroke()

  if (noteLabels !== 'none') {
    ctx.fillStyle = 'white'
    ctx.textBaseline = 'middle'
    const key = getKey(note.midiNote, state.keySignature)
    const noteText = noteLabels === 'alphabetical' ? key : getFixedDoNoteFromKey(key)

    const padding = 2
    const maxWidth = circleRadius * 2 - padding * 2
    const { fontPx, measuredWidth: textWidth } = getOptimalFontSize(
      ctx,
      noteText,
      TEXT_FONT,
      maxWidth,
    )
    ctx.font = `bold ${fontPx}px ${TEXT_FONT}`
    ctx.fillText(noteText, circleCenterX - textWidth / 2, circleCenterY)
  }

  ctx.restore()
}

function renderMeasure(measure: SongMeasure, state: State): void {
  const { ctx, windowWidth } = state
  ctx.save()
  const posY = getItemStartEnd(measure, state).start

  ctx.strokeStyle = ctx.fillStyle = colors.measure
  ctx.lineWidth = 2
  line(ctx, 0, posY, windowWidth, posY)
  ctx.strokeStyle = 'rgb(130,130,130)'
  ctx.fillStyle = 'rgb(130,130,130)'
  ctx.font = `16px ${TEXT_FONT}`
  ctx.fillText(measure.number.toString(), 5, posY + 16)
  ctx.restore()
}

function getItemStartEnd(item: CanvasItem, state: State): { start: number; end: number } {
  const baselineY = state.pianoTopY - 2
  // Times are already in seconds from MIDI parser (tone.js), pps is pixels/second
  const noteScreenY = baselineY - (item.time - state.time) * state.pps
  const endY = noteScreenY + item.duration * state.pps
  return { start: noteScreenY, end: endY }
}

let lastState: State | null = null
export function intersectsWithPiano(point: { x: number; y: number }, canvasRect: DOMRect): boolean {
  if (!lastState) return false
  const relativeY = point.y - canvasRect.top
  return relativeY >= lastState.pianoTopY
}
