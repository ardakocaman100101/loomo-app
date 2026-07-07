import { usePlayer } from '@/features/player'
import { useEventListener, useRAFLoop } from '@/hooks'
import { Song } from '@/types'
import { clamp, formatTime } from '@/utils'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { useCallback, useRef, useState } from 'react'

const CAPTURE_OPT = { capture: true }

export default function SongScrubBar({
  setRange = () => {},
  onSeek = () => {},
  onClick = () => {},
  rangeSelection,
}: {
  rangeSelection?: undefined | { start: number; end: number }
  setRange?: any
  onSeek?: any
  height?: number
  onClick?: any
}) {
  const [pointerOver, setPointerOver] = useState(false)
  const divRef = useRef<HTMLDivElement>(null)
  const playheadRef = useRef<HTMLDivElement>(null)
  const timeSpanRef = useRef<HTMLSpanElement>(null)
  const measureSpanRef = useRef<HTMLSpanElement>(null)
  const toolTipRef = useRef<HTMLDivElement>(null)
  const rangeRef = useRef<HTMLDivElement>(null)
  const player = usePlayer()
  const isDraggingL = useRef(false)
  const isDraggingR = useRef(false)
  const song: Song | null = useAtomValue(player.song)
  const progressBarRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const isScrubbing = useRef<boolean>(false)

  const getProgress = useCallback((e: MouseEvent) => {
    const rect = progressBarRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return clamp((e.clientX - rect.left) / rect.width, { min: 0, max: 1 })
  }, [])

  useRAFLoop(() => {
    if (!divRef.current || !progressBarRef.current) {
      return
    }
    const duration = player.getDuration()
    if (duration === 0) return
    const progress = player.getTime() / duration
    const barWidth = progressBarRef.current.offsetWidth

    divRef.current.style.transform = `scaleX(${progress})`
    if (playheadRef.current) {
      playheadRef.current.style.transform = `translateX(${progress * barWidth}px)`
    }
    if (rangeRef.current && rangeSelection) {
      let start = rangeSelection.start
      let end = rangeSelection.end
      if (end < start) {
        ;[start, end] = [end, start]
        isDraggingL.current = !isDraggingL.current
        isDraggingR.current = !isDraggingR.current
      }
      rangeRef.current.style.left = (start / duration) * barWidth + 'px'
      rangeRef.current.style.width = ((end - start) / duration) * barWidth + 'px'
    }
  })

  const seekPlayer = useCallback(
    (e: MouseEvent) => {
      const progress = getProgress(e)
      const songTime = progress * player.getDuration()
      onSeek()
      player.seek(songTime)
    },
    [player, getProgress, onSeek],
  )

  let wasPlaying = useRef(false)
  useEventListener<PointerEvent>('pointerdown', (e) => {
    const target = e.target as HTMLElement
    if (progressBarRef.current?.contains(target) && !isDraggingL.current && !isDraggingR.current) {
      isScrubbing.current = true

      if (player.isPlaying()) {
        wasPlaying.current = true
        player.pause()
      }

      seekPlayer(e)
    }
  })

  useEventListener<PointerEvent>(
    'pointerup',
    (e) => {
      const target = e.target as HTMLElement
      const completedAction = isDraggingL.current || isDraggingR.current || isScrubbing.current
      const minorMissclick = wrapperRef.current?.contains(target)
      if (completedAction || minorMissclick) {
        e.stopPropagation()
      }
      isDraggingL.current = false
      isDraggingR.current = false
      isScrubbing.current = false

      if (wasPlaying.current) {
        wasPlaying.current = false
        player.play()
      }
    },
    undefined,
    CAPTURE_OPT,
  )

  useEventListener<PointerEvent>('pointermove', (e) => {
    const progress = getProgress(e)
    const songTime = progress * player.getDuration()
    if ((isDraggingL.current || isDraggingR.current) && rangeSelection) {
      if (isDraggingL.current) {
        rangeSelection.start = songTime
      } else {
        rangeSelection.end = songTime
      }
      setRange(rangeSelection)
    } else if (isScrubbing.current) {
      seekPlayer(e)
    }
  })

  return (
    <div
      className="group relative flex w-full touch-none select-none h-[12px] items-center justify-center"
      onClick={onClick}
      ref={wrapperRef}
      onPointerMove={(e: React.MouseEvent) => {
        if (
          !player.getSong() ||
          !measureSpanRef.current ||
          !timeSpanRef.current ||
          !toolTipRef.current ||
          !progressBarRef.current
        ) {
          return
        }

        const rect = progressBarRef.current.getBoundingClientRect()
        const progress = clamp((e.clientX - rect.left) / rect.width, { min: 0, max: 1 })
        const songTime = progress * player.getDuration()
        const measure = player.getMeasureForTime(songTime)

        toolTipRef.current.style.left = `${clamp(e.clientX - rect.left - 45, {
          min: 0,
          max: rect.width - 90,
        })}px`
        measureSpanRef.current.innerText = String(measure?.number)
        timeSpanRef.current.innerText = formatTime(player.getRealTimeDuration(0, songTime))
      }}
      onPointerOver={() => setPointerOver(true)}
      onPointerOut={() => setPointerOver(false)}
    >
      <div
        className={clsx(
          pointerOver ? 'flex' : 'hidden',
          'absolute z-30 min-w-max items-center justify-between gap-4',
          '-top-2 rounded-lg bg-black/95 border border-white/10 px-3 py-1.5 text-xs text-white shadow-xl',
          '-translate-y-full transition-all duration-150',
        )}
        ref={toolTipRef}
      >
        <span>
          Time: <span className="text-[#6c79f0] font-mono" ref={timeSpanRef} />
        </span>
        <span className="w-[1px] h-3 bg-white/10" />
        <span>
          Measure: <span className="text-[#6c79f0] font-mono" ref={measureSpanRef} />
        </span>
      </div>

      <div
        ref={progressBarRef}
        className="relative h-[6px] w-full bg-white/10 cursor-pointer overflow-visible rounded-full"
      >
        {/* Played track */}
        <div
          ref={divRef}
          className="absolute left-0 top-0 h-full bg-[#6c79f0] origin-left pointer-events-none rounded-full"
          style={{ width: '100%', transform: 'scaleX(0)' }}
        />

        {/* Playhead handle */}
        <div
          ref={playheadRef}
          className="absolute top-1/2 left-0 w-4.5 h-4.5 -mt-2.25 -ml-2.25 bg-white rounded-full shadow-[0_0_10px_rgba(255,255,255,0.9)] opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none"
        />

        {rangeSelection && (
          <div ref={rangeRef} className="pointer-events-none absolute flex h-full items-center">
            <div className="bg-purple-dark/40 absolute h-4 w-[calc(100%-10px)]" />
            <div
              className="bg-purple-dark/90 hover:bg-[#6c79f0] pointer-events-auto absolute left-0 h-4 w-4 -translate-x-1/2 cursor-pointer rounded-full transition"
              onPointerEnter={() => setPointerOver(true)}
              onPointerLeave={() => setPointerOver(false)}
              onPointerDown={() => (isDraggingL.current = true)}
            />
            <div
              className="bg-purple-dark/90 hover:bg-[#6c79f0] pointer-events-auto absolute right-0 h-4 w-4 translate-x-1/2 cursor-pointer rounded-full transition"
              onPointerDown={() => (isDraggingR.current = true)}
              onPointerEnter={() => setPointerOver(true)}
              onPointerLeave={() => setPointerOver(false)}
            />
          </div>
        )}
      </div>
    </div>
  )
}
