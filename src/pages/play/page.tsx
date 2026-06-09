import { SongScrubBar } from '@/features/controls'
import { useSong } from '@/features/data'
import { useSongMetadata } from '@/features/data/library'
import midiState from '@/features/midi'
import { requiresPermissionAtom, scanFolders } from '@/features/persist/persistence'
import { usePlayer } from '@/features/player'
import { getHandSettings, getSongSettings, SongVisualizer } from '@/features/SongVisualization'
import { getSynthStub } from '@/features/synth'
import {
  useEventListener,
  useLazyStableRef,
  useOnUnmount,
  usePlayerState,
  useSongSettings,
  useWakeLock,
} from '@/hooks'
import { MidiStateEvent, SongSource } from '@/types'
import clsx from 'clsx'
import { useAtomValue } from 'jotai'
import { AlertCircle, ArrowLeft, RefreshCw, ZoomIn, ZoomOut } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { SettingsPanel, TopBar, TrackHUD } from './components'
import { MidiModal } from './components/MidiModal'
import { StatsPopup } from './components/StatsPopup'

function RequiresPermissionPrompt({
  onGrantPermission,
  onGoBack,
}: {
  onGrantPermission: () => void
  onGoBack: () => void
}) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-orange-500" />
          <h2 className="text-lg font-medium text-gray-900">Permission Required</h2>
        </div>
        <p className="mb-6 text-sm text-gray-600">
          We need permission to access your music files. Please grant access to continue playing
          this song.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onGoBack}
            className="flex items-center gap-2 rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Go Back
          </button>
          <button
            onClick={onGrantPermission}
            className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
          >
            <RefreshCw className="h-4 w-4" />
            Grant Permission
          </button>
        </div>
      </div>
    </div>
  )
}

function SongNotFound({ songTitle, onGoBack }: { songTitle?: string; onGoBack: () => void }) {
  return (
    <div className="flex h-screen items-center justify-center bg-gray-50">
      <div className="mx-auto max-w-md rounded-lg bg-white p-6 text-center shadow-lg">
        <div className="mb-4">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
        </div>
        <h2 className="mb-2 text-lg font-medium text-gray-900">Song Not Found</h2>
        {songTitle && (
          <p className="mb-4 text-sm text-gray-600">
            Could not load "{songTitle}". The file may have been moved or deleted.
          </p>
        )}
        <p className="mb-6 text-sm text-gray-500">
          Please check that the file still exists or try selecting a different song. It may also be
          that Sightread lost access to your local files. If that's the case, please re-scan
          directories in the "Manage Folders" menu.
        </p>
        <button
          onClick={onGoBack}
          className="mx-auto flex cursor-pointer items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Go Back to Song List
        </button>
      </div>
    </div>
  )
}

export default function PlaySongPage() {
  const [searchParams, _setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  let { source, id, recording }: { source: SongSource; id: string; recording?: string } =
    Object.fromEntries(searchParams) as any

  // If source or id is messed up, redirect to the homepage
  if (!source || !id) {
    navigate('/', { replace: true })
    return null
  }
  id = decodeURIComponent(id)

  const player = usePlayer()
  const [settingsOpen, setSettingsPanel] = useState(false)
  const [isMidiModalOpen, setMidiModal] = useState(false)
  const [statsVisible, setStatsVisible] = useState(true)
  const zoomModes = [25, 32, 49, 61, 76, 88]
  const [zoomIndex, setZoomIndex] = useState(2)
  const playerState = usePlayerState()
  const synth = useLazyStableRef(() => getSynthStub('acoustic_grand_piano'))
  let { data: song, error, isLoading, mutate } = useSong(id, source)
  let songMeta = useSongMetadata(id, source)
  const range = useAtomValue(player.getRange())
  const selectedRange = useMemo(
    () => (range ? { start: range[0], end: range[1] } : undefined),
    [range],
  )
  const isLooping = !!range
  const requiresPermission = useAtomValue(requiresPermissionAtom)

  const [songConfig, setSongConfig] = useSongSettings(id)
  const isRecording = !!recording
  useWakeLock()

  const hand =
    songConfig.left && songConfig.right
      ? 'both'
      : songConfig.left
        ? 'left'
        : songConfig.right
          ? 'right'
          : 'none'

  // Hack for updating player when config changes.
  // Maybe move to the onChange? Or is this chill.
  const { waiting, left, right } = songConfig
  useEffect(() => {
    player.setWait(waiting)
    if (left && right) {
      player.setHand('both')
    } else {
      player.setHand(left ? 'left' : 'right')
    }
  }, [waiting, left, right, player])

  useEffect(() => {
    if (!song) return
    player.trackConfigs = songConfig.tracks
    Object.entries(songConfig.tracks).forEach(([id, settings]) => {
      player.setTrackVolume(Number(id), settings.sound ? 1 : 0)
    })
  }, [songConfig.tracks, player, song])

  useOnUnmount(() => player.stop())

  useEffect(() => {
    if (!song) return
    // TODO: handle invalid song. Pipe up not-found midi for 400s etc.
    const config = getSongSettings(id, song)
    setSongConfig(config)
    player.setSong(song, config)

    // Auto-enable progressive learning if the song title indicates it
    if (songMeta?.title?.startsWith('Progressive:')) {
      player.store.set(player.progressiveMode, true)
      player.store.set(player.completedTracks, new Set<number>())

      const tracks = Object.keys(song.tracks).map(Number).sort((a, b) => a - b)
      if (tracks.length > 0) {
        player.setupProgressiveRegion_(tracks[0])
      }
    } else {
      player.store.set(player.progressiveMode, false)
    }
  }, [song, setSongConfig, id, player, songMeta?.title])

  useEventListener<KeyboardEvent>('keydown', (evt: KeyboardEvent) => {
    if (evt.code === 'Space') {
      evt.preventDefault()
      player.toggle()
    } else if (evt.shiftKey && evt.code === 'Comma') {
      player.seekToPreviousMeasure()
    } else if (evt.shiftKey && evt.code === 'Period') {
      player.seekToNextMeasure()
    } else if (evt.code === 'Comma') {
      player.seek(player.currentSongTime - 16 / 1000)
    } else if (evt.code === 'Period') {
      player.seek(player.currentSongTime + 16 / 1000)
    }
  })

  const handleToggleMute = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const current = prev.tracks[trackId]
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: { ...current, sound: !current.sound },
          },
        }
      })
    },
    [setSongConfig],
  )

  const handleSolo = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const newTracks = { ...prev.tracks }
        Object.keys(newTracks).forEach((id) => {
          const numericId = Number(id)
          newTracks[numericId] = {
            ...newTracks[numericId],
            sound: numericId === trackId,
          }
        })
        return { ...prev, tracks: newTracks }
      })
    },
    [setSongConfig],
  )

  const handleTogglePractice = React.useCallback(
    (trackId: number) => {
      setSongConfig((prev) => {
        const current = prev.tracks[trackId]
        return {
          ...prev,
          tracks: {
            ...prev.tracks,
            [trackId]: { ...current, practice: !current.practice },
          },
        }
      })
    },
    [setSongConfig],
  )

  useOnUnmount(() => player.stop())

  useEffect(() => {
    const handleMidiEvent = ({ type, note, velocity, cc, value }: MidiStateEvent) => {
      if (type === 'down' && note !== undefined) {
        synth.playNote(note, velocity!)
      } else if (type === 'up' && note !== undefined) {
        synth.stopNote(note, velocity)
      } else if (type === 'cc') {
        // Knob 1 (CC 74): Volume
        if (cc === 74) {
          player.setVolume(value! / 127)
        }
        // Transport: Stop (CC 113) / Play (CC 115)
        if (cc === 115 && value! > 0) {
          player.toggle()
        }
        if (cc === 113 && value! > 0) {
          player.restart()
        }
        // Custom: Pad 1-8 (mapped to CC 20-27) -> Mute Tracks
        if (cc! >= 20 && cc! <= 27 && value! > 0) {
          const trackIds = Object.keys(songConfig.tracks)
          const targetId = Number(trackIds[cc! - 20])
          if (!isNaN(targetId)) {
            handleToggleMute(targetId)
          }
        }
        // Custom: CC 28 -> Toggle Wait
        if (cc === 28 && value! > 0) {
          setSongConfig((prev) => ({ ...prev, waiting: !prev.waiting }))
        }
      }
    }

    midiState.subscribe(handleMidiEvent)
    return () => midiState.unsubscribe(handleMidiEvent)
  }, [synth, player, handleToggleMute, songConfig.tracks, setSongConfig])

  const handleLoopingToggle = (enable: boolean) => {
    if (!enable) {
      player.setRange(undefined)
      return
    } else {
      const duration = player.getDuration()
      const tenth = duration / 10
      player.setRange({
        start: duration / 2 - tenth,
        end: duration / 2 + tenth,
      })
    }
  }

  // Handle permission required for local files
  if (source === 'local' && requiresPermission) {
    return (
      <RequiresPermissionPrompt
        onGrantPermission={async () => {
          await scanFolders()
          mutate()
        }}
        onGoBack={() => {
          player.stop()
          navigate('/songs')
        }}
      />
    )
  }

  // Handle song not found
  if (error || (source === 'local' && !song && !isLoading)) {
    return (
      <SongNotFound
        songTitle={songMeta?.title}
        onGoBack={() => {
          player.stop()
          navigate('/songs')
        }}
      />
    )
  }

  return (
    <>
      <title>Playing</title>
      <div
        className={clsx(
          // Enable fixed to remove all scrolling.
          'fixed',
          'flex h-screen max-h-screen max-w-screen flex-col outline-none',
        )}
        {...midiState.getListenerProps()}
        autoFocus
      >
        {!isRecording && (
          <>
            <TopBar
              title={songMeta?.title}
              isLoading={!playerState.canPlay}
              isPlaying={playerState.playing}
              onTogglePlaying={() => player.toggle()}
              onClickRestart={() => player.restart()}
              onClickBack={() => {
                player.stop()
                navigate('/')
              }}
              onClickMidi={(e) => {
                e.stopPropagation()
                setMidiModal(!isMidiModalOpen)
              }}
              onClickSettings={(e) => {
                e.stopPropagation()
                setSettingsPanel(!settingsOpen)
              }}
              onClickStats={(e) => {
                setStatsVisible(!statsVisible)
              }}
              onToggleWaiting={() => setSongConfig({ ...songConfig, waiting: !waiting })}
              isWaiting={waiting}
              settingsOpen={settingsOpen}
              statsVisible={statsVisible}
              onClickStudio={() => {
                player.stop()
                navigate(`/studio?id=${encodeURIComponent(id)}&source=${source}`)
              }}
            />
            <MidiModal isOpen={isMidiModalOpen} onClose={() => setMidiModal(false)} />
            {settingsOpen && (
              <SettingsPanel
                onClose={() => setSettingsPanel(false)}
                onChange={setSongConfig}
                config={songConfig}
                song={song}
                onLoopToggled={handleLoopingToggle}
                isLooping={isLooping}
              />
            )}
            {song && (
              <TrackHUD
                song={song}
                config={songConfig}
                onToggleMute={handleToggleMute}
                onSolo={handleSolo}
                onTogglePractice={handleTogglePractice}
              />
            )}
            <div className="relative min-w-full">
              <SongScrubBar
                rangeSelection={selectedRange}
                setRange={(range: any) => player.setRange(range)}
                height={40}
              />
            </div>
            {statsVisible && <StatsPopup />}
            <div className="absolute left-4 top-20 z-10 flex flex-col gap-2">
              <button
                className="cursor-pointer rounded-full bg-black/30 p-2 text-white transition hover:bg-black/50 pointer-events-auto"
                onClick={() => setZoomIndex(i => Math.max(0, i - 1))}
              >
                <ZoomIn className="h-5 w-5" />
              </button>
              <button
                className="cursor-pointer rounded-full bg-black/30 p-2 text-white transition hover:bg-black/50 pointer-events-auto"
                onClick={() => setZoomIndex(i => Math.min(zoomModes.length - 1, i + 1))}
              >
                <ZoomOut className="h-5 w-5" />
              </button>
            </div>
          </>
        )}
        <div
          className={clsx(
            'fixed -z-10 h-[100vh] w-screen',
            'h-[100dvh]!',
            songConfig.visualization === 'sheet' ? 'bg-white' : 'bg-[#2e2e2e]',
          )}
        >
          <SongVisualizer
            song={song}
            config={songConfig}
            hand={hand}
            handSettings={getHandSettings(songConfig)}
            selectedRange={selectedRange}
            getTime={() => player.getTime()}
            enableTouchscroll={songConfig.visualization === 'falling-notes'}
            zoomMode={zoomModes[zoomIndex]}
          />
        </div>
      </div>
    </>
  )
}
