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

// Memoized subtle noise pattern to prevent banding and add premium matte texture
let noisePattern: CanvasPattern | null = null
function getNoisePattern(ctx: CanvasRenderingContext2D): CanvasPattern | null {
  if (noisePattern) return noisePattern

  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 128
  const offCtx = canvas.getContext('2d')
  if (!offCtx) return null

  const imageData = offCtx.createImageData(128, 128)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const v = Math.random() > 0.5 ? 255 : 0
    data[i] = v
    data[i + 1] = v
    data[i + 2] = v
    data[i + 3] = Math.floor(Math.random() * 6) // Max ~2.3% opacity
  }
  offCtx.putImageData(imageData, 0, 0)
  noisePattern = ctx.createPattern(canvas, 'repeat')
  return noisePattern
}

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
  blue: '#3498db',
}

function getActiveNotes(state: State): Map<number, string> {
  const activeNotes = new Map<number, string>(state.player.pressFeedback)
  for (let midiNote of midiState.getPressedNotes().keys()) {
    if (!activeNotes.has(midiNote)) {
      activeNotes.set(midiNote, 'blue')
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

  let minNotes = state.zoomMode ?? 0
  if (state.zoomMode === undefined && state.height > state.windowWidth) {
    // We allow the octaves to dictate the width, but keep a sensible minimum
    // if the screen is very tall compared to width to avoid huge keys.
    if (state.height > 800) minNotes = 48
    else if (state.height > 600) minNotes = 36
    else if (state.height > 500) minNotes = 24
    else minNotes = 24
  }

  const { startNote: songStart, endNote: songEnd } = getSongRange({ notes }, minNotes)
  const instrumentRange = midiState.detectedRange
  const { startNote, endNote } = getKeyboardRange(songStart, songEnd, instrumentRange)
  const pianoMeasurements = getPianoRollMeasurements(state.windowWidth, { startNote, endNote })
  const pianoTopY = Math.max(0, state.height - pianoMeasurements.whiteHeight - 5)
  const pianoWidth = pianoMeasurements.pianoWidth
  const noteHitY = pianoTopY - 120

  const averageLaneWidth = state.windowWidth / Math.max(endNote - startNote, 1)
  const averageCircleRadius = (averageLaneWidth / 2) - 1
  // Perfect tolerance inside the circle, exactly matching the radius in terms of MS
  // Multiplied by 2.5 to make it more forgiving and easier to get green.
  const perfectRangeMs = (averageCircleRadius / state.pps) * 1000 * 1.5
  // Yellow/blue boundary (e.g. 4 times the circle radius)
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

export function getKeyboardRange(
  songStart: number,
  songEnd: number,
  instrumentRange: { start: number; end: number } | null,
) {
  let k = 0
  if (instrumentRange) {
    const instStart = instrumentRange.start
    const instEnd = instrumentRange.end
    
    if (songStart < instStart || songEnd > instEnd) {
      const shiftDown = Math.ceil((instStart - songStart) / 12)
      const shiftUp = Math.ceil((songEnd - instEnd) / 12)
      
      if (shiftDown > 0 && shiftUp <= 0) {
        k = -shiftDown
      } else if (shiftUp > 0 && shiftDown <= 0) {
        k = shiftUp
      } else {
        const songCenter = (songStart + songEnd) / 2
        const instrumentCenter = (instStart + instEnd) / 2
        k = Math.round((songCenter - instrumentCenter) / 12)
      }
    }
  }

  // Shift incoming hardware MIDI notes by k octaves so the user can play the song
  midiState.midiOctaveDiff = k

  // Determine bounds by taking the union of the song's range and the shifted instrument's range
  let displayStart = songStart
  let displayEnd = songEnd
  
  if (instrumentRange) {
    displayStart = Math.min(songStart, instrumentRange.start + k * 12)
    displayEnd = Math.max(songEnd, instrumentRange.end + k * 12)
  }

  // Snap to the nearest C octaves (multiples of 12)
  let start = Math.floor(displayStart / 12) * 12
  let end = Math.ceil(displayEnd / 12) * 12

  // Ensure minimum of 1 octave (13 keys, e.g. C to C)
  if (end - start < 12) {
    end = start + 12
  }

  // Constrain to valid piano MIDI range (A0 = 21, C8 = 108)
  start = Math.max(21, start)
  end = Math.min(108, end)

  return { 
    startNote: start, 
    endNote: end 
  }
}

function getFallingNoteItemsInView<T>(state: State): CanvasItem[] {
  // Items are sorted by ascending time.
  // Earliest items (small time) have the largest Y (below screen),
  // latest items (large time) have the smallest Y (above screen).
  // startPred: start collecting when the top of the note enters the bottom of the screen
  let startPred = (item: CanvasItem) => getItemStartEnd(item, state).end <= state.height
  // endPred: stop collecting when the bottom of the note is completely above the screen
  // In 3D mode with beta=3.0, notes remain visible further up the screen.
  let endPred = (item: CanvasItem) => getItemStartEnd(item, state).start < -state.height * 2.5
  return getItemsInView(state, startPred, endPred)
}

function projectPoint(x: number, y: number, state: State): { x: number; y: number; scale: number } {
  const anchorY = state.pianoTopY
  const d = anchorY - y
  if (d <= 0) {
    return { x, y, scale: 1 }
  }
  const beta = 3.0
  const scale = anchorY / (anchorY + d / beta)
  const centerX = state.windowWidth / 2
  const px = centerX + (x - centerX) * scale
  const py = anchorY - d * scale
  return { x: px, y: py, scale }
}

export function renderFallingVis(givenState: GivenState): void {
  const state: State = deriveState(givenState)
  // Deep charcoal radial gradient fading to pure black
  const cx = state.windowWidth / 2
  const cy = state.height / 2
  const radius = Math.max(state.windowWidth, state.height)
  
  const bgGrad = state.ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
  bgGrad.addColorStop(0, '#242424') // Lighter charcoal center
  bgGrad.addColorStop(0.7, '#0a0a0a') // Deep black mid
  bgGrad.addColorStop(1, '#000000') // Pure black edges
  
  state.ctx.fillStyle = bgGrad
  state.ctx.fillRect(0, 0, state.windowWidth, state.height)

  // Apply subtle matte noise texture overlay
  const pattern = getNoisePattern(state.ctx)
  if (pattern) {
    state.ctx.fillStyle = pattern
    state.ctx.fillRect(0, 0, state.windowWidth, state.height)
  }

  const items = getFallingNoteItemsInView(state)

  renderLanes(state)
  renderHitLine(state)

  for (let i of items) {
    if (i.type === 'measure') {
      renderMeasure(i, state)
    }
  }

  // Pre-calculate active targets for feedback coloring
  const activeTargets = new Set<SongNote>()
  const now = state.time
  const margin = state.player.goodRange / 1000
  const seenPitches = new Set<number>()

  for (let i of items) {
    if (i.type === 'note') {
      if (!seenPitches.has(i.midiNote)) {
        if (now <= i.time + i.duration + margin) {
          activeTargets.add(i)
          seenPitches.add(i.midiNote)
        }
      }
    }
  }

  for (let i of items) {
    if (i.type === 'note') {
      renderFallingNote(i, state, activeTargets.has(i))
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
  
  ctx.beginPath()
  ctx.setLineDash([])
  ctx.strokeStyle = 'rgba(129, 71, 235, 1)'
  ctx.lineWidth = 6
  ctx.moveTo(0, noteHitY)
  ctx.lineTo(windowWidth, noteHitY)
  ctx.stroke()
  
  ctx.restore()
}

function getNoteColor(state: State, note: SongNote, isActiveTarget: boolean): string {
  if (state.player.missedNotes.has(note)) {
    return feedbackColors.red
  }

  const isPressed = midiState.getPressedNotes().has(note.midiNote)
  const feedback = state.player.pressFeedback.get(note.midiNote)
  
  if (isPressed && feedback && isActiveTarget) {
    // Only apply feedback color if the note is currently near or on the baseline.
    const now = state.time;
    const margin = state.player.goodRange / 1000; // convert ms to seconds
    if (now >= note.time - margin && now <= note.time + note.duration + margin) {
      return feedbackColors[feedback] ?? feedback
    }
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
  const { ctx, pps } = state
  if (!state.selectedRange) {
    return
  }

  const { start, end } = state.selectedRange
  ctx.save()
  const duration = end - start
  const canvasY = getItemStartEnd({ type: 'note', time: start, duration } as CanvasItem, state).start
  const rectHeight = duration * pps
  const posY = canvasY
  const tailTopY = canvasY - rectHeight

  // Project the 4 corners of the full-width range selection block
  const bottomLeft = projectPoint(0, posY, state)
  const bottomRight = projectPoint(state.windowWidth, posY, state)
  const topRight = projectPoint(state.windowWidth, tailTopY, state)
  const topLeft = projectPoint(0, tailTopY, state)

  ctx.fillStyle = colors.rangeSelectionFill
  ctx.globalAlpha = 0.5
  
  ctx.beginPath()
  ctx.moveTo(bottomLeft.x, bottomLeft.y)
  ctx.lineTo(bottomRight.x, bottomRight.y)
  ctx.lineTo(topRight.x, topRight.y)
  ctx.lineTo(topLeft.x, topLeft.y)
  ctx.closePath()
  ctx.fill()
  
  ctx.restore()
}

function renderLanes(state: State) {
  const { ctx } = state
  ctx.save()
  
  const segments = 16
  const yStart = -state.height * 2.5
  const yEnd = state.pianoTopY
  const yStep = (yEnd - yStart) / segments

  for (let [midiNote, lane] of Object.entries(state.pianoMeasurements.lanes)) {
    const midiNum = +midiNote
    if (isBlack(midiNum)) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.03)'
      
      ctx.beginPath()
      // Left boundary of the lane going down
      const pStart = projectPoint(lane.left, yStart, state)
      ctx.moveTo(pStart.x, pStart.y)
      for (let j = 1; j <= segments; j++) {
        const y = yStart + j * yStep
        const p = projectPoint(lane.left, y, state)
        ctx.lineTo(p.x, p.y)
      }
      
      // Right boundary of the lane going up
      for (let j = segments; j >= 0; j--) {
        const y = yStart + j * yStep
        const p = projectPoint(lane.left + lane.width, y, state)
        ctx.lineTo(p.x, p.y)
      }
      
      ctx.closePath()
      ctx.fill()
    }
  }
  ctx.restore()
}

export function renderFallingNote(note: SongNote, state: State, isActiveTarget: boolean = false): void {
  if (!(note.midiNote in state.pianoMeasurements.lanes)) {
    return
  }

  const { ctx, pps, noteLabels, pianoTopY, pianoMeasurements } = state
  const lane = state.pianoMeasurements.lanes[note.midiNote]
  const keyTop = pianoTopY
  const keyHeight = isBlack(note.midiNote) ? pianoMeasurements.blackHeight : pianoMeasurements.whiteHeight

  let posX = lane.left
  let noteWidth = lane.width

  if (isBlack(note.midiNote)) {
    const originalWidth = lane.width
    noteWidth = originalWidth * 0.8
    posX = lane.left + (originalWidth - noteWidth) / 2
  } else {
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

  const color = getNoteColor(state, note, isActiveTarget)

  ctx.save()

  const tailTopY = posY - length
  const circleCenterX = posX + width / 2
  const circleCenterY = posY - circleRadius
  
  if (tailTopY < posY - circleRadius) {
    const rectLeft = circleCenterX - circleRadius
    const rectRight = circleCenterX + circleRadius
    const rectTop = tailTopY
    const rectBottom = circleCenterY

    // Project 4 corners of the note tail trapezoid
    const bottomLeft = projectPoint(rectLeft, rectBottom, state)
    const bottomRight = projectPoint(rectRight, rectBottom, state)
    const topRight = projectPoint(rectRight, rectTop, state)
    const topLeft = projectPoint(rectLeft, rectTop, state)

    const grad = ctx.createLinearGradient(circleCenterX, bottomLeft.y, circleCenterX, topLeft.y)
    grad.addColorStop(0, color)
    grad.addColorStop(1, color)
    ctx.fillStyle = grad
    ctx.strokeStyle = 'transparent'
    ctx.globalAlpha = 0.8

    ctx.beginPath()
    ctx.moveTo(bottomLeft.x, bottomLeft.y)
    ctx.lineTo(bottomRight.x, bottomRight.y)
    ctx.lineTo(topRight.x, topRight.y)
    ctx.lineTo(topLeft.x, topLeft.y)
    ctx.closePath()
    ctx.fill()

    ctx.globalAlpha = 1.0
  }

  // Draw 3D projected note head
  const center = projectPoint(circleCenterX, circleCenterY, state)
  const radiusScaled = circleRadius * center.scale

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(center.x, center.y, radiusScaled, 0, 2 * Math.PI)
  ctx.fill()

  ctx.lineWidth = Math.max(1, 2 * center.scale)
  ctx.strokeStyle = 'rgba(255,255,255,0.3)'
  ctx.stroke()

  if (noteLabels !== 'none') {
    ctx.fillStyle = 'white'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'center'
    const key = getKey(note.midiNote, state.keySignature)
    const noteText = noteLabels === 'alphabetical' ? key : getFixedDoNoteFromKey(key)

    const padding = 2
    const maxWidth = (circleRadius * 2 - padding * 2) * center.scale
    let { fontPx } = getOptimalFontSize(
      ctx,
      noteText,
      TEXT_FONT,
      maxWidth,
    )
    fontPx = Math.min(fontPx, maxWidth * 0.8)
    ctx.font = `bold ${fontPx}px ${TEXT_FONT}`
    ctx.fillText(noteText, center.x, center.y + fontPx * 0.05)
  }
  ctx.restore()
}

function renderMeasure(measure: SongMeasure, state: State): void {
  const { ctx } = state
  ctx.save()
  const posY = getItemStartEnd(measure, state).start

  // Project the text anchor position (left side of screen)
  const pt = projectPoint(8, posY, state)

  ctx.strokeStyle = 'rgba(130,130,130, 0.4)'
  ctx.fillStyle = 'rgba(130,130,130, 0.4)'
  ctx.font = `${Math.max(8, 14 * pt.scale)}px ${TEXT_FONT}`
  ctx.fillText(measure.number.toString(), pt.x, pt.y + 16 * pt.scale)
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
