'use client'

import clsx from 'clsx'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import React from 'react'

export function Navbar({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <header
      className={clsx(
        className,
        'sticky top-0 z-30 flex items-center border-b border-zinc-200 bg-white/85 px-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/85',
        'h-16',
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center gap-4">
        {children}
      </div>
    </header>
  )
}

export function NavbarDivider({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={clsx(className, 'h-6 w-px bg-zinc-200 dark:bg-zinc-700')}
    />
  )
}

export function NavbarSection({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={clsx(className, 'flex items-center gap-1')}>
      {children}
    </div>
  )
}

export function NavbarSpacer({ className }: { className?: string }) {
  return <div aria-hidden="true" className={clsx(className, 'flex-1')} />
}

export function NavbarItem({
  href,
  current,
  className,
  children,
  'aria-label': ariaLabel,
  ...props
}: {
  href?: string
  current?: boolean
  className?: string
  children: React.ReactNode
  'aria-label'?: string
} & React.ComponentPropsWithoutRef<'button'>) {
  const pathname = usePathname()
  const isActive = current ?? (href ? pathname === href : false)

  const baseClass = clsx(
    'relative flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'text-zinc-900 dark:text-white'
      : 'text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white',
    className,
  )

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel} className={baseClass} data-current={isActive ? true : undefined}>
        {children}
        {isActive && (
          <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#4a7c59]" />
        )}
      </Link>
    )
  }

  return (
    <button aria-label={ariaLabel} className={baseClass} {...props}>
      {children}
    </button>
  )
}

export function NavbarLabel({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span className={clsx(className, 'text-sm font-medium')}>
      {children}
    </span>
  )
}
