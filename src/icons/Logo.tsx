import type { LucideProps } from '@/icons'
import { cn } from '@/utils'

export default function Logo(props: LucideProps) {
  const { width, height, className, style } = props
  return (
    <div className="rounded-2xl overflow-hidden flex items-center justify-center p-0" style={{ width, height }}>
      <img
        src="/loomo_logo.png?v=7"
        width={width ?? 192}
        height={height ?? 192}
        className={cn(className, 'object-contain')}
        style={{ ...style, imageRendering: 'auto' }}
        alt="Loomo Logo"
      />
    </div>
  )
}
