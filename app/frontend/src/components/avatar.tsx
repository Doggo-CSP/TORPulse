import clsx from 'clsx'
import React from 'react'

type AvatarProps = {
  src?: string | null
  initials?: string
  alt?: string
  className?: string
  square?: boolean
  slot?: string
}

export function Avatar({
  src = null,
  initials,
  alt = '',
  square = false,
  className,
  ...props
}: AvatarProps & React.ComponentPropsWithoutRef<'span'>) {
  // Remember which src failed to load, so a new src is tried again without an effect
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null)
  const hasError = src !== null && failedSrc === src

  const showImage = Boolean(src && src.trim() && !hasError)

  return (
    <span
      data-slot="avatar"
      className={clsx(
        className,
        'inline-grid shrink-0 align-middle [--avatar-radius:20%] [--ring-opacity:20%] *:col-start-1 *:row-start-1 overflow-hidden',
        square
          ? 'rounded-[--avatar-radius] *:rounded-[--avatar-radius]'
          : 'rounded-full *:rounded-full',
        'outline outline-1 -outline-offset-1 outline-black/[--ring-opacity]',
        'size-8',
      )}
      {...props}
    >
      {(!showImage || initials) && (
        <svg
          className="size-full select-none fill-current text-[48px] font-medium uppercase"
          viewBox="0 0 100 100"
          aria-hidden={alt ? undefined : 'true'}
        >
          {alt && <title>{alt}</title>}
          <text
            x="50%"
            y="50%"
            alignmentBaseline="middle"
            dominantBaseline="middle"
            textAnchor="middle"
            dy=".125em"
          >
            {initials || 'U'}
          </text>
        </svg>
      )}
      {showImage && (
        <img
          className="size-full object-cover"
          src={src!}
          alt={alt}
          onError={() => setFailedSrc(src)}
        />
      )}
    </span>
  )
}

