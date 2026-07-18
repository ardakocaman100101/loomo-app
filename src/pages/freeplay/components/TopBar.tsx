import { VolumeSliderButton } from '@/features/controls'
import { Logo, Midi } from '@/icons'
import { ArrowLeft } from 'lucide-react'
import { MouseEvent } from 'react'
import { Link } from 'react-router'
import { ButtonWithTooltip } from '@/pages/play/components/TopBar'

type TopBarProps = {
  onClickBack: () => void
  onClickMidi: (e: MouseEvent<any>) => void
}

export default function TopBar({
  onClickBack,
  onClickMidi,
}: TopBarProps) {
  return (
    <div className="fixed top-0 left-0 w-full h-[78px] z-40 bg-[#131313]/20 backdrop-blur-3xl border-b border-white/5 flex items-center select-none shadow-[0_8px_32px_rgba(0,0,0,0.37)] px-6">
      {/* Left side: Back button */}
      <div className="flex items-center">
        <ButtonWithTooltip tooltip="Back" onClick={onClickBack}>
          <ArrowLeft size={32} className="cursor-pointer text-white/70 hover:text-white" />
        </ButtonWithTooltip>
      </div>

      {/* Center: Absolute centered Loomo Identity */}
      <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2">
        <Link to="/" onClick={onClickBack} className="flex items-center gap-3 group">
          <Logo height={42} width={77} className="w-[77px] h-10.5 shadow-[0_0_15px_rgba(160,120,255,0.3)] group-hover:scale-105 transition-all cursor-pointer" />
          <span className="text-3xl sm:text-4xl font-black tracking-tighter text-[#e5e2e1] group-hover:text-[#d0bcff] transition-all cursor-pointer">loomo</span>
        </Link>
      </div>

      {/* Right side: MIDI Device, Volume */}
      <div className="ml-auto flex items-center gap-6">
        <ButtonWithTooltip tooltip="Choose a MIDI device" onClick={onClickMidi}>
          <Midi size={32} />
        </ButtonWithTooltip>

        <VolumeSliderButton />
      </div>
    </div>
  )
}
