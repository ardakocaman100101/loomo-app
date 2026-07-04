import { Modal, Sizer, UploadMidi } from '@/components'
import { useSongManifest } from '@/features/data/library'
import { initialize } from '@/features/persist/persistence'
import { useEventListener } from '@/hooks'
import { Plus } from '@/icons'
import { SongMetadata } from '@/types'
import { formatTime } from '@/utils'
import clsx from 'clsx'
import * as React from 'react'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { Table } from './components'
import ManageFoldersForm from './components/AddFolderForm'
import { SearchBox } from './components/Table/SearchBox'
import { Play, Sliders } from 'lucide-react'

// TODO: after an upload, scroll to the newly uploaded song / make it focused.
export default function SelectSongPage() {
  const navigate = useNavigate()
  let songs: SongMetadata[] = useSongManifest()
  const [isUploadFormOpen, setUploadForm] = useState<boolean>(false)
  const [search, setSearch] = useState('')

  useEventListener<KeyboardEvent>('keydown', (event) => {
    if (event.key === 'Escape') {
      setUploadForm(false)
    }
  })

  const handleAddNew = (e: any) => {
    setUploadForm(true)
    e.stopPropagation()
  }

  const handleCloseAddNew = () => {
    setUploadForm(false)
  }

  return (
    <>
      <title>Select a song</title>
      <Modal show={isUploadFormOpen} onClose={handleCloseAddNew}>
        <ManageFoldersForm onClose={handleCloseAddNew} />
      </Modal>
      <div className="bg-[#15121a] text-[#e7e0ec] selection:bg-[#d0bcff]/30 flex min-h-screen w-full flex-col relative overflow-hidden">
        {/* Deep Purple Perspective Gradient */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[150%] h-1/2 glow-perspective" />
          <div className="absolute top-1/4 right-0 w-96 h-96 bg-[#d0bcff]/10 blur-[120px] rounded-full" />
        </div>

        <div className="mx-auto flex w-full max-w-(--breakpoint-lg) grow flex-col p-6 pt-32 relative z-10">
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-[1.1] bg-gradient-to-r from-white via-[#e7e0ec] to-[#d0bcff] bg-clip-text text-transparent">
            Select a Song
          </h2>
          <Sizer height={8} />
          <h3 className="text-[#cbc3d5] font-light text-base md:text-lg max-w-2xl">Choose a song from your library and begin practicing</h3>
          <Sizer height={32} />
          <Table
            columns={[
              { label: 'Name', id: 'title', keep: true },
              {
                label: 'Length',
                id: 'duration',
                format: (n) => formatTime(Number(n)),
              },
              {
                label: 'Play',
                id: 'id',
                keep: true,
                format: (id, row) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/play?id=${id}&source=${row.source || 'local'}`)
                    }}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-[#d0bcff] hover:bg-[#a078ff]/20 hover:text-white active:scale-95 transition-all cursor-pointer"
                    title="Play Song"
                  >
                    <Play className="w-4 h-4 fill-current" />
                  </button>
                )
              },
              {
                label: 'Studio',
                id: 'id',
                keep: true,
                format: (id, row) => (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      navigate(`/studio?id=${id}&source=${row.source || 'local'}`)
                    }}
                    className="p-2 rounded-xl bg-white/5 border border-white/10 text-[#d0bcff] hover:bg-[#a078ff]/20 hover:text-white active:scale-95 transition-all cursor-pointer"
                    title="Open in Studio"
                  >
                    <Sliders className="w-4 h-4" />
                  </button>
                )
              }
            ]}
            getId={(s: SongMetadata) => s.id}
            rows={songs}
            filter={['title']}
            onSelectRow={(id: string) => {
              const song = songs.find(s => s.id === id)
              if (song) {
                navigate(`/studio?id=${id}&source=${song.source || 'local'}`)
              }
            }}
            search={search}
          />
        </div>
        <Sizer height={32} />
      </div>
    </>
  )
}
