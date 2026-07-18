import type { LucideProps } from '@/icons'
import { cn } from '@/utils'

export default function Logo(props: LucideProps) {
  const { width, height, className, style } = props
  return (
    <div className={cn("rounded-2xl overflow-hidden flex items-center justify-center p-0", className)} style={{ width, height, ...style }}>
      <img
        src="/loomo_logo.png?v=9"
        className="w-full h-full object-contain"
        style={{ imageRendering: 'auto' }}
        alt="Loomo Logo"
      />
    </div>
  )
}
