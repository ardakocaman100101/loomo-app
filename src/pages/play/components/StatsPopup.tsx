import MovablePopup from '@/components/MovablePopup'
import { usePlayer } from '@/features/player'
import { BarChart2 } from '@/icons'
import { useAtomValue } from 'jotai'

export function StatsPopup({}) {
  const player = usePlayer()

  const accuracy = useAtomValue(player.score.accuracy)
  const perfect = useAtomValue(player.score.perfect)
  const early = useAtomValue(player.score.early)
  const late = useAtomValue(player.score.late)
  const missed = useAtomValue(player.score.missed)

  return (
    <MovablePopup
      initialPosition={{ x: '100%', y: 90 }}
      header={
        <div className="flex h-[50px] w-full cursor-grab items-center justify-center relative">
          <div className="flex items-baseline gap-2.5 select-none z-10">
            <span className="text-[17px] font-black uppercase tracking-[0.18em] text-[#6c79f0]">
              Score
            </span>
            <span className="text-[20px] font-black text-white">{accuracy}%</span>
          </div>
        </div>
      }
    >
      <div className="flex flex-col w-full gap-1.5 p-0.5">
        {/* Row 1: Early (Yellow) & Perfect (Green) */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col items-center rounded-xl bg-white/5 border border-white/5 py-1.5 px-2 min-w-0">
            <span className="text-[9px] font-bold text-yellow-400/90 tracking-wider text-center select-none">EARLY</span>
            <span className="text-xl font-bold text-yellow-400 mt-1 leading-none">{early}</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-white/5 border border-white/5 py-1.5 px-2 min-w-0">
            <span className="text-[9px] font-bold text-green-400/90 tracking-wider text-center select-none">PERFECT</span>
            <span className="text-xl font-bold text-green-400 mt-1 leading-none">{perfect}</span>
          </div>
        </div>

        {/* Row 2: Late (Blue) & Missed (Red) */}
        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex flex-col items-center rounded-xl bg-white/5 border border-white/5 py-1.5 px-2 min-w-0">
            <span className="text-[9px] font-bold text-purple-400/90 tracking-wider text-center select-none">LATE</span>
            <span className="text-xl font-bold text-purple-400 mt-1 leading-none">{late}</span>
          </div>
          <div className="flex flex-col items-center rounded-xl bg-white/5 border border-white/5 py-1.5 px-2 min-w-0">
            <span className="text-[9px] font-bold text-red-500/90 tracking-wider text-center select-none">MISSED</span>
            <span className="text-xl font-bold text-red-500 mt-1 leading-none">{missed}</span>
          </div>
        </div>
      </div>
    </MovablePopup>
  )
}
