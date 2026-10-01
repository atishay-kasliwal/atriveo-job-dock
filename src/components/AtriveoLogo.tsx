import { cn } from '@/lib/utils'

const atriveoLogoSrc = new URL('../../src-tauri/icons/128x128.png', import.meta.url).href

interface AtriveoLogoProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const SIZE_CLASSES = {
  sm: 'size-5',
  md: 'size-7',
  lg: 'size-9',
} as const

export function AtriveoLogo({ className, size = 'md' }: AtriveoLogoProps) {
  return (
    <img
      src={atriveoLogoSrc}
      alt=""
      aria-hidden="true"
      className={cn(
        'shrink-0 rounded-md object-cover ring-1 ring-white/10 shadow-[0_4px_14px_-8px_rgb(0_0_0/0.6)]',
        SIZE_CLASSES[size],
        className,
      )}
      draggable={false}
    />
  )
}
