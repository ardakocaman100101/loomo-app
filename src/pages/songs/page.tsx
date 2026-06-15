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
      <div className="bg-purple-lightest flex min-h-screen w-full flex-col">
        <div className="mx-auto flex w-full max-w-(--breakpoint-lg) grow flex-col p-6 pt-24">
          <h2 className="text-3xl">Learn a song</h2>
          <Sizer height={8} />
          <h3 className="text-base"> Select a song, choose your settings, and begin learning</h3>
          <Sizer height={24} />
          <div className="flex gap-4">
            <SearchBox
              placeholder={'Search Songs by Title or Artist'}
              onSearch={setSearch}
              autoFocus={true}
            />
            <UploadMidi
              onUpload={(id: string) => navigate(`/studio?id=${id}&source=upload`)}
              className="bg-purple-dark hover:bg-purple-hover flex items-center gap-2 rounded-md px-4 py-2 text-white transition"
            />
            <button
              className={clsx(
                'hidden flex-nowrap whitespace-nowrap sm:flex',
                'items-center gap-1 rounded-md px-4 py-2',
                'bg-purple-dark hover:bg-purple-hover text-white transition',
              )}
              onClick={handleAddNew}
            >
              <Plus width={20} height={20} />
              <span>Manage Folders</span>
            </button>
          </div>
          <Sizer height={32} />
          <Table
            columns={[
              { label: 'Name', id: 'title', keep: true },
              {
                label: 'Length',
                id: 'duration',
                format: (n) => formatTime(Number(n)),
              },
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
