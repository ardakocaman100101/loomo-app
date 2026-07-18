import midiState, { useRecordMidi } from '@/features/midi'
import { SongVisualizer } from '@/features/SongVisualization'
import { InstrumentName, useSynth } from '@/features/synth'
import { useLazyStableRef } from '@/hooks'
import { MidiModal } from '@/pages/play/components/MidiModal'
import { MidiStateEvent, SongConfig } from '@/types'
import { useCallback, useEffect, useState } from 'react'
import TopBar from './components/TopBar'
import FreePlayer from './utils/free-player'
import { parseMidi } from '@/features/parsers'
import { registerCustomSketch, initialize } from '@/features/persist/persistence'
import { ZoomIn, ZoomOut } from 'lucide-react'
import { StartRecord, StopRecord } from '@/icons'
import * as idb from 'idb-keyval'
import { useNavigate } from 'react-router'

export default function FreePlay() {
  const navigate = useNavigate()
  const [instrumentName, setInstrumentName] = useState<InstrumentName>('acoustic_grand_piano')
  const synthState = useSynth(instrumentName)
  const freePlayer = useLazyStableRef(() => new FreePlayer())
  const [isMidiModalOpen, setMidiModal] = useState(false)
  const { isRecording, startRecording, stopRecording } = useRecordMidi(midiState)

  const ppsScales = [0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 4.0]
  const [scaleIndex, setScaleIndex] = useState(2) // Default to 1.0 (index 2)

  const handleRecordToggle = useCallback(async () => {
    if (!isRecording) {
      freePlayer.start()
      startRecording()
    } else {
      freePlayer.stop()
      const midiBytes = stopRecording()
      if (midiBytes !== null && midiBytes.length > 0) {
        try {
          const parsedSong = parseMidi(midiBytes as any)
          const songId = `recorded_${Date.now()}`
          const songTitle = `Practice Recording ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`

          // Save parsed song data directly to IndexedDB SONG_DATA_${id}
          const songToSave = {
            ...parsedSong,
            secondsToTicks: undefined,
            ticksToSeconds: undefined,
          }
          await idb.set(`SONG_DATA_${songId}`, songToSave)

          // Seamless transition to Studio without registering to the library
          navigate(`/studio?id=${songId}&source=upload`)
        } catch (err) {
          console.error('Error packaging recorded MIDI:', err)
          alert('Error packaging recorded performance.')
        }
      }
    }
  }, [isRecording, startRecording, stopRecording, freePlayer, navigate])

  const handleNoteDown = useCallback(
    (note: number, velocity: number = 80) => {
      if (note !== undefined) {
        synthState.synth.playNote(note, velocity)
      }
      freePlayer.addNote(note, velocity)
    },
    [freePlayer, synthState.synth],
  )

  const handleNoteUp = useCallback(
    (note: number) => {
      if (note !== undefined) {
        synthState.synth.stopNote(note)
      }
      freePlayer.releaseNote(note)
    },
    [freePlayer, synthState.synth],
  )

  useEffect(() => {
    const handleMidiStateEvent = (e: MidiStateEvent) => {
      // If it comes from drum pads (MIDI channel 10 / index 9)
      if (e.channel === 9) {
        if (e.type === 'down' && e.note !== undefined) {
          console.log(`[Pad Mapping] Drum pad pressed: note = ${e.note}, velocity = ${e.velocity}`)
          // Map 7th pad (note 42 on Akai MPK Mini Bank A, note 47 on Arturia/Novation defaultSnare, or 48) to toggle recording
          if (e.note === 42 || e.note === 47 || e.note === 48 || e.note === 46) {
            handleRecordToggle()
          }
        }
        return // Do not pass drum pad messages to normal piano lane sounds
      }

      if (e.type === 'up') {
        if (e.note !== undefined) {
          handleNoteUp(e.note)
        }
      } else if (e.type === 'down') {
        if (e.note !== undefined) {
          handleNoteDown(e.note, e.velocity)
        }
      }
    }
    midiState.subscribe(handleMidiStateEvent)
    return () => {
      midiState.unsubscribe(handleMidiStateEvent)
    }
  }, [handleNoteDown, handleNoteUp, handleRecordToggle])

  return (
    <>
      <title>Practice Mode</title>
      <div
        className="flex h-screen w-screen flex-col outline-none bg-[#16182c]"
        {...midiState.getListenerProps()}
        autoFocus
      >
        <TopBar
          onClickBack={() => {
            freePlayer.stop()
            navigate('/')
          }}
          onClickMidi={(e) => {
            e.stopPropagation()
            setMidiModal(!isMidiModalOpen)
          }}
        />
        <MidiModal isOpen={isMidiModalOpen} onClose={() => setMidiModal(false)} />
        
        {/* Floating Zoom Controls (Left Side, like Play Mode) */}
        <div className="absolute left-6 top-[40%] -translate-y-1/2 z-30 flex flex-col gap-4 pointer-events-auto select-none">
          <div className="flex flex-col rounded-[20px] bg-black/45 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] border border-white/5 overflow-hidden w-[52px] justify-between">
            <button
              className="cursor-pointer p-3.5 text-white/70 hover:text-white transition hover:bg-white/5 flex items-center justify-center border-0 bg-transparent"
              onClick={() => setScaleIndex((i) => Math.min(ppsScales.length - 1, i + 1))}
              title="Zoom In"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <div className="h-[1px] bg-white/10 w-full" />
            <button
              className="cursor-pointer p-3.5 text-white/70 hover:text-white transition hover:bg-white/5 flex items-center justify-center border-0 bg-transparent"
              onClick={() => setScaleIndex((i) => Math.max(0, i - 1))}
              title="Zoom Out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Floating Record Toggle Button (Right Side, side of the last note lane's right) */}
        <div className="absolute right-6 top-[40%] -translate-y-1/2 z-30 flex flex-col gap-4 pointer-events-auto select-none">
          <button
            onClick={handleRecordToggle}
            className="w-14 h-14 rounded-full bg-black/45 backdrop-blur-xl border border-white/5 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] flex items-center justify-center cursor-pointer hover:bg-white/5 active:scale-95 transition-all"
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            {isRecording ? (
              <StopRecord size={28} className="text-red-500 hover:text-red-400 transition-colors animate-pulse" />
            ) : (
              <StartRecord size={28} className="text-white/70 hover:text-white transition-colors" />
            )}
          </button>
        </div>

        <div className="relative grow">
          <SongVisualizer
            song={freePlayer.song}
            config={{ visualization: 'reverse-waterfall', noteLabels: 'none' } as SongConfig}
            hand="both"
            handSettings={{ 1: { hand: 'right', practice: false } }}
            getTime={() => freePlayer.getTime()}
            constrictView={false}
            ppsScale={ppsScales[scaleIndex]}
          />
        </div>
      </div>
    </>
  )
}
