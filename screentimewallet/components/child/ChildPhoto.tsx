import Image from 'next/image'

interface Props {
  photoUrl: string | null
  fallbackEmoji: string
  size?: number
  className?: string
}

export function ChildPhoto({ photoUrl, fallbackEmoji, size = 64, className = '' }: Props) {
  if (photoUrl) {
    return (
      <div
        className={`rounded-full overflow-hidden flex-shrink-0 ${className}`}
        style={{ width: size, height: size, position: 'relative' }}
      >
        <Image src={photoUrl} alt="profile" fill className="object-cover" unoptimized />
      </div>
    )
  }
  return (
    <span style={{ fontSize: size * 0.6 }} className={className}>
      {fallbackEmoji}
    </span>
  )
}
