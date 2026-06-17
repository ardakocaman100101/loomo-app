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

const feedbackColors: Record<string, string> = {
  green: '#2ecc71',
  yellow: '#f1c40f',
  grey: '#95a5a6',
  red: '#e74c3c',
  purple: '#8147EB',
}

function getActiveNotes(state: State): Map<number, string> {
  const activeNotes = new Map<number, string>(state.player.pressFeedback)
  for (let midiNote of midiState.getPressedNotes().keys()) {
    if (!activeNotes.has(midiNote)) {
      activeNotes.set(midiNote, 'purple')
    }
  }

  return activeNotes
}

function isPlayingNote(state: State, note: SongNote) {
  const baselineY = state.noteHitY
  const itemPos = getItemStartEnd(note, state)
  return itemPos.end <= baselineY && itemPos.start > baselineY
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
  const noteHitY = pianoTopY - 120

  const averageLaneWidth = state.windowWidth / minNotes
  const averageCircleRadius = (averageLaneWidth / 2) - 1
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
  let start = 36;
  let end = 96;

  if (instrumentRange) {
    start = instrumentRange.start;
    end = instrumentRange.end;
  }

  let k = 0;
  if (songStart < start || songEnd > end) {
    const shiftDown = Math.ceil((start - songStart) / 12);
    const shiftUp = Math.ceil((songEnd - end) / 12);
    
    if (shiftDown > 0 && shiftUp <= 0) {
      k = -shiftDown;
    } else if (shiftUp > 0 && shiftDown <= 0) {
      k = shiftUp;
    } else {
      const songCenter = (songStart + songEnd) / 2;
      const instrumentCenter = (start + end) / 2;
      k = Math.round((songCenter - instrumentCenter) / 12);
    }
  }

  const minK = Math.ceil((21 - start) / 12);
  const maxK = Math.floor((108 - end) / 12);
  k = Math.max(minK, Math.min(maxK, k));

  return { 
    startNote: start + k * 12, 
    endNote: end + k * 12 
  }
}

function getFallingNoteItemsInView<T>(state: State): CanvasItem[] {
  // Items are sorted by ascending time.
  // Earliest items (small time) have the largest Y (below screen),
  // latest items (large time) have the smallest Y (above screen).
  // startPred: start collecting when the top of the note enters the bottom of the screen
  let startPred = (item: CanvasItem) => getItemStartEnd(item, state).end <= state.height
  // endPred: stop collecting when the bottom of the note is completely above the screen
  let endPred = (item: CanvasItem) => getItemStartEnd(item, state).start < 0
  return getItemsInView(state, startPred, endPred)
}

export function renderFallingVis(givenState: GivenState): void {
  const state: State = deriveState(givenState)
  state.ctx.fillStyle = '#2e2e2e' // background color
  state.ctx.fillRect(0, 0, state.windowWidth, state.height)

  const items = getFallingNoteItemsInView(state)

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
  const { ctx, noteHitY, windowWidth } = state
  ctx.save()
  
  // Dashed baseline just above the keyboard
  ctx.beginPath()
  ctx.setLineDash([8, 5])
  ctx.strokeStyle = 'rgba(100, 200, 255, 0.6)'
  ctx.lineWidth = 3
  ctx.moveTo(0, noteHitY)
  ctx.lineTo(windowWidth, noteHitY)
  ctx.stroke()
  
  ctx.restore()
}

function getNoteColor(state: State, note: SongNote): string {
  const isPressed = midiState.getPressedNotes().has(note.midiNote)
  const feedback = state.player.pressFeedback.get(note.midiNote)
  
  if (isPressed && feedback) {
    return feedbackColors[feedback] ?? feedback
  }

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
  ctx.fillRect(0, canvasY - rectHeight, state.windowWidth, rectHeight)
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

  let posX = lane.left
  let noteWidth = lane.width

  if (!isBlack(note.midiNote)) {
    const leftBlack = state.pianoMeasurements.lanes[note.midiNote - 1]
    const rightBlack = state.pianoMeasurements.lanes[note.midiNote + 1]
    
    if (leftBlack && isBlack(note.midiNote - 1)) {
      posX = leftBlack.left + leftBlack.width
    }
    
    let rightEdge = lane.left + lane.width
    if (rightBlack && isBlack(note.midiNote + 1)) {
      rightEdge = rightBlack.left
    }
    
    noteWidth = rightEdge - posX
  }

  posX = Math.floor(posX + 1)
  const width = Math.max(noteWidth - 2, 8)
  const posY = getItemStartEnd(note, state).start

  const actualLength = note.duration * pps
  const circleRadius = Math.min(width / 2, keyHeight / 2)
  const minLengthToDisplayCircle = Math.max(circleRadius * 2, 18)
  const length = Math.max(actualLength, minLengthToDisplayCircle)

  const color = getNoteColor(state, note)

  ctx.save()

  const tailTopY = posY - length
  const circleCenterX = posX + width / 2
  const circleCenterY = posY - circleRadius
  
  if (tailTopY < posY - circleRadius) {
    const grad = ctx.createLinearGradient(circleCenterX, circleCenterY, circleCenterX, tailTopY)
    grad.addColorStop(0, color)
    grad.addColorStop(1, color)
    ctx.fillStyle = grad
    ctx.strokeStyle = 'transparent'
    ctx.globalAlpha = 0.8

    const rectTop = tailTopY
    const rectHeight = circleCenterY - rectTop
    const rectWidth = circleRadius * 2
    const rectLeft = circleCenterX - circleRadius

    roundRect(ctx, rectLeft, rectTop, rectWidth, rectHeight, {
      topRadius: rectWidth * 0.35,
      bottomRadius: 0,
    })

    ctx.globalAlpha = 1.0
  }


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
    ctx.textAlign = 'center'
    const key = getKey(note.midiNote, state.keySignature)
    const noteText = noteLabels === 'alphabetical' ? key : getFixedDoNoteFromKey(key)

    const padding = 2
    const maxWidth = circleRadius * 2 - padding * 2
    let { fontPx, measuredWidth: textWidth } = getOptimalFontSize(
      ctx,
      noteText,
      TEXT_FONT,
      maxWidth,
    )
    fontPx = Math.min(fontPx, maxWidth * 0.8)
    ctx.font = `bold ${fontPx}px ${TEXT_FONT}`
    ctx.fillText(noteText, circleCenterX, circleCenterY + fontPx * 0.05)
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
  // Times are already in seconds from MIDI parser (tone.js), pps is pixels/second
  const noteScreenY = state.noteHitY - (item.time - state.time) * state.pps
  const endY = noteScreenY - item.duration * state.pps
  return { start: noteScreenY, end: endY }
}

let lastState: State | null = null
export function intersectsWithPiano(point: { x: number; y: number }, canvasRect: DOMRect): boolean {
  if (!lastState) return false
  const relativeY = point.y - canvasRect.top
  return relativeY >= lastState.pianoTopY
}
