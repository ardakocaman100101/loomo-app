import { addUploadedSongs } from '@/features/persist/persistence'
import { Upload } from 'lucide-react'
import { useRef, useState } from 'react'

export function UploadMidi({
    onUpload,
    className,
    children,
}: {
    onUpload?: (id: string) => void
    className?: string
    children?: React.ReactNode
}) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [isUploading, setIsUploading] = useState(false)

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || [])
        if (selectedFiles.length === 0) return

        try {
            setIsUploading(true)
            const id = await addUploadedSongs(selectedFiles)
            if (onUpload) {
                onUpload(id)
            }
        } catch (error) {
            console.error('Failed to upload MIDI:', error)
            alert('Failed to upload MIDI files')
        } finally {
            setIsUploading(false)
            if (inputRef.current) {
                inputRef.current.value = ''
            }
        }
    }

    return (
        <>
            <input
                type="file"
                accept=".mid,.midi,audio/midi,audio/x-midi"
                multiple
                // @ts-expect-error - webkitdirectory is not a standard React attribute but works in browsers
                webkitdirectory=""
                directory=""
                ref={inputRef}
                className="hidden"
                onChange={handleFileChange}
            />
            <button
                onClick={() => inputRef.current?.click()}
                disabled={isUploading}
                className={className}
            >
                {children ? children : (
                    <>
                        <Upload className="mr-2 h-4 w-4" />
                        {isUploading ? 'Uploading...' : 'Upload MIDI'}
                    </>
                )}
            </button>
        </>
    )
}
