import { line, roundRect } from '@/features/drawing'
import {
  drawVerticalPianoRoll,
  getVerticalPianoRollMeasurements,
  handleVerticalPianoRollMousePress,
  VerticalPianoRollMeasurements,
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

function getActiveNotes(state: State, inViewNotes: SongNote[]): Map<number, string> {
  const activeNotes = new Map<number, string>()
  const pressFeedback = state.player.pressFeedback
  for (let midiNote of midiState.getPressedNotes().keys()) {
    activeNotes.set(midiNote, pressFeedback.get(midiNote) ?? 'grey')
  }

  return activeNotes
}

function isPlayingNote(state: State, note: SongNote) {
  const itemPos = getItemStartEnd(note, state)
  // A note is actively playing when its front edge (start) has crossed the hit line (or is exactly on it)
  // and its back edge (end) has not yet crossed the hit line
  return itemPos.start <= state.noteHitX && itemPos.end > state.noteHitX
}

function getViewport(state: Readonly<GivenState>): Viewport {
  // Time is on X-axis now. Screen width minus piano width represents the time window length
  return {
    start: state.time * state.pps + state.windowWidth,
    end: state.time * state.pps,
  }
}

type State = GivenState & {
  viewport: Viewport
  pianoMeasurements: VerticalPianoRollMeasurements
  pianoLeftX: number
  pianoWidth: number
  noteHitX: number
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
  const startNote = midiState.detectedRange?.start ?? songStart
  const endNote = midiState.detectedRange?.end ?? songEnd
  const pianoMeasurements = getVerticalPianoRollMeasurements(state.height, { startNote, endNote })
  const pianoLeftX = 0
  const pianoWidth = pianoMeasurements.whiteWidth + 5
  // Shift hit line away from piano by 50 pixels to provide visual clearance.
  const noteHitX = pianoWidth + 50

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
    pianoLeftX,
    pianoWidth,
    noteHitX,
  }
  return lastState
}

function getFallingNoteItemsInView<T>(state: State): CanvasItem[] {
  // Find first item whose right edge is right of the playhead (has not exited screen to the left)
  let startPred = (item: CanvasItem) => getItemStartEnd(item, state).end >= state.noteHitX
  // Stop at the first item whose left edge is right of the screen (has not entered screen from the right)
  let endPred = (item: CanvasItem) => getItemStartEnd(item, state).start > state.windowWidth
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

  handleVerticalPianoRollMousePress(
    state.pianoMeasurements,
    state.pianoLeftX,
    getRelativePointerCoordinates(state.canvasRect.left, state.canvasRect.top),
  )
  drawVerticalPianoRoll(
    state.ctx,
    state.pianoMeasurements,
    state.pianoLeftX,
    getActiveNotes(state, items.filter((i) => i.type === 'note') as any),
  )
}

function renderHitLine(state: State) {
  const { ctx, noteHitX, height } = state
  ctx.save()
  ctx.beginPath()
  ctx.setLineDash([10, 10])
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
  ctx.lineWidth = 2
  ctx.moveTo(noteHitX, 0)
  ctx.lineTo(noteHitX, height)
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
  const { ctx, height, noteHitX, pps } = state
  if (!state.selectedRange) {
    return
  }

  const { start, end } = state.selectedRange
  ctx.save()
  const duration = end - start
  const canvasY = 0
  const canvasX = getItemStartEnd({ type: 'note', time: start, duration } as CanvasItem, state).start

  const width = duration * pps
  ctx.fillStyle = colors.rangeSelectionFill
  ctx.globalAlpha = 0.5
  const lineHeight = Math.floor(height / 120)
  const lineWidth = Math.floor(lineHeight / 4)
  ctx.fillRect(canvasX, 0, width, height)
  // add borders if needed
  ctx.restore()
}

function renderOctaveRuler(state: State) {
  const { ctx } = state
  ctx.save()
  ctx.lineWidth = 2
  for (let [midiNote, lane] of Object.entries(state.pianoMeasurements.lanes)) {
    const key = getKey(+midiNote)
    const { top } = lane
    if (key === 'C') {
      ctx.strokeStyle = colors.octaveLine
      line(ctx, state.pianoWidth, top, state.windowWidth, top)
    }
    if (key === 'F') {
      ctx.strokeStyle = colors.measure
      line(ctx, state.pianoWidth, top, state.windowWidth, top)
    }
  }
  ctx.restore()
}

export function renderFallingNote(note: SongNote, state: State): void {
  if (!(note.midiNote in state.pianoMeasurements.lanes)) {
    return
  }

  const { ctx, pps, noteLabels } = state
  const lane = state.pianoMeasurements.lanes[note.midiNote]

  // Note position and dimensions
  const posX = getItemStartEnd(note, state).start
  const posY = Math.floor(lane.top + 1)
  const height = lane.height - 2

  const actualLength = note.duration * pps
  const minLengthToDisplayCircle = height
  const length = Math.max(actualLength, minLengthToDisplayCircle)

  const color = getNoteColor(state, note)

  ctx.save()

  // Modernized look: Gradient or sleek tail
  // Tail starts from the center of the circle and goes rightwards.
  const tailEndX = posX + length - height / 2
  if (tailEndX > posX) {
    const grad = ctx.createLinearGradient(posX, posY, posX + length, posY)
    grad.addColorStop(0, color)
    grad.addColorStop(1, color) // Solid tail instead of fading out
    ctx.fillStyle = grad
    ctx.strokeStyle = 'transparent'

    ctx.globalAlpha = 0.8

    // Draw trail
    roundRect(ctx, posX, posY + height * 0.15, length, height * 0.7, {
      topRadius: height * 0.35,
      bottomRadius: height * 0.35
    })

    ctx.globalAlpha = 1.0
  }

  // Modernized look: Circle at the front centered at posX exactly
  const circleRadius = height / 2
  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(posX, posY + circleRadius, circleRadius, 0, 2 * Math.PI)
  ctx.fill()

  // Inner stroke to make it pop
  ctx.lineWidth = 2
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.stroke()

  if (noteLabels !== 'none') {
    ctx.fillStyle = 'white'
    ctx.textBaseline = 'middle'
    const key = getKey(note.midiNote, state.keySignature)
    const noteText = noteLabels === 'alphabetical' ? key : getFixedDoNoteFromKey(key)

    // Calculate size that fits in the circle
    const padding = 2
    const maxWidth = circleRadius * 2 - padding * 2
    const { fontPx, measuredWidth: textWidth } = getOptimalFontSize(
      ctx,
      noteText,
      TEXT_FONT,
      maxWidth,
    )
    ctx.font = `bold ${fontPx}px ${TEXT_FONT}`
    ctx.fillText(noteText, posX - textWidth / 2, posY + circleRadius)
  }

  ctx.restore()
}

function renderMeasure(measure: SongMeasure, state: State): void {
  const { ctx, height } = state
  ctx.save()
  const posX = getItemStartEnd(measure, state).start

  ctx.strokeStyle = ctx.fillStyle = colors.measure
  ctx.lineWidth = 2
  line(ctx, posX, 0, posX, height)
  ctx.strokeStyle = 'rgb(130,130,130)'
  ctx.fillStyle = 'rgb(130,130,130)'
  ctx.font = `16px ${TEXT_FONT}`
  ctx.fillText(measure.number.toString(), posX + 5, height / 100 + 16)
  ctx.restore()
}

function getItemStartEnd(item: CanvasItem, state: State): { start: number; end: number } {
  const startX = state.noteHitX + (item.time - state.time) * state.pps
  const duration = item.type === 'note' ? item.duration : 100
  const endX = startX + duration * state.pps
  return { start: startX, end: endX }
}

let lastState: State | null = null
export function intersectsWithPiano(x: number): boolean {
  if (!lastState) return false
  return x <= lastState.pianoWidth
}
