import { Tooltip } from '@/components'
import { VolumeSliderButton } from '@/features/controls'
import { Logo, Midi } from '@/icons'
import { isMobile } from '@/utils'
import clsx from 'clsx'
import {
  ArrowLeft,
  BarChart2,
  LucideProps,
  Settings,
  SkipBack,
  SkipForward,
  Repeat,
  Timer,
} from 'lucide-react'
import { MouseEvent, PropsWithChildren } from 'react'
import { Link } from 'react-router'
import StatusIcon from './StatusIcon'

type ButtonProps = PropsWithChildren<{
  tooltip: string
  isActive?: boolean
  onClick?: (e: MouseEvent<any>) => void
  className?: string
}>

export function ButtonWithTooltip({
  tooltip,
  children,
  isActive,
  onClick,
  className,
}: ButtonProps) {
  return (
    <Tooltip label={tooltip}>
      <button
        className={clsx(
          'group flex items-center justify-center rounded-md p-2 transition hover:bg-white/10 active:bg-white/20',
          isActive ? 'text-purple-primary' : 'text-white',
          className,
        )}
        onClick={onClick}
      >
        {children}
      </button>
    </Tooltip>
  )
}

type TopBarProps = {
  isLoading: boolean
  isPlaying: boolean
  title?: string
  onTogglePlaying: () => void
  onClickBack: () => void
  onClickRestart: () => void
  onClickSkipToEnd: () => void
  isLooping: boolean
  onClickToggleLoop: () => void
  onClickMidi: (e: MouseEvent<any>) => void
  onClickStats: (e: MouseEvent<any>) => void
  statsVisible: boolean
  isWaiting: boolean
  onToggleWaiting: () => void
}

export default function TopBar({
  isPlaying,
  isLoading,
  onTogglePlaying,
  onClickBack,
  onClickRestart,
  onClickSkipToEnd,
  isLooping,
  onClickToggleLoop,
  title,
  onClickMidi,
  onClickStats,
  statsVisible,
  isWaiting,
  onToggleWaiting,
}: TopBarProps) {
  return (
    <div className="align-center relative z-10 flex h-[50px] min-h-[50px] w-screen justify-center gap-8 bg-[#292929] px-1">
      <div className="absolute! top-1/2 left-3 -translate-y-1/2 flex items-center gap-3">
        <ButtonWithTooltip tooltip="Back">
          <ArrowLeft size={24} onClick={onClickBack} />
        </ButtonWithTooltip>
        
        <Link to="/" onClick={onClickBack} className="flex items-center gap-2 group select-none">
          <Logo height={28} width={44} className="w-[44px] h-7 shadow-[0_0_15px_rgba(160,120,255,0.3)] group-hover:scale-105 transition-all cursor-pointer" />
          <span className="text-lg font-bold tracking-tight text-white group-hover:text-[#d0bcff] transition-all cursor-pointer">loomo</span>
        </Link>
      </div>
      <div
        className={clsx(
          'flex h-full items-center gap-8',
          'sm:absolute sm:left-1/2 sm:-translate-x-3/4',
        )}
      >
        <ButtonWithTooltip tooltip="Restart/Beginning">
          <SkipBack size={24} onClick={onClickRestart} />
        </ButtonWithTooltip>
        <StatusIcon isPlaying={isPlaying} isLoading={isLoading} onTogglePlaying={onTogglePlaying} />
        <ButtonWithTooltip tooltip="Skip to End">
          <SkipForward size={24} onClick={onClickSkipToEnd} />
        </ButtonWithTooltip>
        <ButtonWithTooltip tooltip="Toggle Loop" isActive={isLooping} onClick={onClickToggleLoop}>
          <Repeat size={24} />
        </ButtonWithTooltip>
        <ButtonWithTooltip tooltip="Wait Mode" isActive={isWaiting} onClick={onToggleWaiting}>
          <div className="relative">
            <Midi size={20} />
            {isWaiting && (
              <div className="bg-purple-primary absolute -right-1 -bottom-1 h-2 w-2 rounded-full" />
            )}
          </div>
        </ButtonWithTooltip>
      </div>
      <div className="hidden h-full items-center text-white sm:ml-auto sm:flex">{title}</div>
      <div className="mr-[20px] flex h-full items-center gap-8">
        <ButtonWithTooltip tooltip="Choose a MIDI device">
          <Midi size={24} onClick={onClickMidi} />
        </ButtonWithTooltip>
        {!isMobile() && <VolumeSliderButton />}
        {
          <ButtonWithTooltip tooltip={statsVisible ? 'Hide Stats' : 'Show Stats'}>
            <BarChart2
              onClick={onClickStats}
              size={24}
              className={statsVisible ? 'text-white' : 'text-gray-400'}
            />
          </ButtonWithTooltip>
        }
      </div>
    </div>
  )
}

