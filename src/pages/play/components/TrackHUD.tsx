import { Volume2, VolumeX, Eye } from 'lucide-react'
import { Song, SongConfig } from '@/types'
import { formatInstrumentName } from '@/utils'
import clsx from 'clsx'
import React from 'react'

type TrackHUDProps = {
    song: Song
    config: SongConfig
    onToggleMute: (trackId: number) => void
    onSolo: (trackId: number) => void
    onTogglePractice: (trackId: number) => void
}

export default function TrackHUD({ song, config, onToggleMute, onTogglePractice }: Omit<TrackHUDProps, 'onSolo'>) {
    const tracks = Object.entries(song.tracks).filter(([_, t]) =>
        song.notes.some(n => n.track === Number(_))
    )

    if (tracks.length <= 1) return null

    return (
        <div className="flex flex-col gap-2 rounded-[20px] bg-black/45 p-3 backdrop-blur-xl shadow-[inset_0_1px_0_0_rgba(255,255,255,0.15),0_8px_32px_0_rgba(0,0,0,0.37)] border border-white/5 max-h-[50vh] overflow-y-auto w-[232px] pointer-events-auto">
            <div className="mb-3 text-[12px] font-black uppercase tracking-[0.18em] text-[#b08eff] text-center select-none">
                TRACKS
            </div>
            {tracks.map(([idStr, track]) => {
                const id = Number(idStr)
                const settings = config.tracks[id]
                const isMuted = !settings?.sound
                const noteCount = song.notes.filter(n => n.track === id).length

                return (
                    <div
                        key={id}
                        className={clsx(
                            "group flex flex-col gap-1 rounded-xl p-2 transition-all hover:bg-white/5",
                            isMuted ? "opacity-45" : "opacity-100"
                        )}
                    >
                        <div className="flex items-center justify-between">
                            <span className="truncate text-xs font-bold text-white max-w-[140px]" title={track.name}>
                                {track.name || formatInstrumentName(settings?.instrument || track.instrument)}
                            </span>
                            <div className="flex items-center gap-1.5">
                                <button
                                    onClick={() => onTogglePractice(id)}
                                    className={clsx(
                                        "p-1 rounded transition select-none bg-transparent border-0",
                                        settings?.practice ? "text-[#b08eff]" : "text-white/35 hover:text-white"
                                    )}
                                    title="Toggle note appearance"
                                >
                                    <Eye size={15} />
                                </button>
                                <button
                                    onClick={() => onToggleMute(id)}
                                    className="text-white/35 hover:text-white transition select-none bg-transparent border-0 p-1"
                                    title={isMuted ? "Unmute track" : "Mute track"}
                                >
                                    {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
                                </button>
                             </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-purple-500/50"
                                    style={{ width: `${Math.min(100, (noteCount / song.notes.length) * 500)}%` }}
                                />
                            </div>
                            <span className="text-[8px] text-white/30">{noteCount}n</span>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}
