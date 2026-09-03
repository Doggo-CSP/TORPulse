'use client'

import {
  Menu,
  MenuButton,
  MenuItem,
  MenuItems,
  MenuSeparator,
} from '@headlessui/react'
import clsx from 'clsx'
import React from 'react'

export function Dropdown({ children }: { children: React.ReactNode }) {
  return <Menu>{children}</Menu>
}


export function DropdownButton<T extends React.ElementType = 'button'>({
  as: Tag = 'button' as T,
  className,
  children,
  ...props
}: {
  as?: T
  className?: string
  children: React.ReactNode
} & Omit<React.ComponentPropsWithoutRef<T>, 'as' | 'className' | 'children'>) {
  return (
    <MenuButton
      as={Tag as React.ElementType}
      {...(props as Record<string, unknown>)}
      className={clsx('cursor-pointer', className)}
    >
      {children}
    </MenuButton>
  )
}

export function DropdownMenu({
  anchor = 'bottom',
  className,
  children,
}: {
  anchor?: 'bottom' | 'bottom start' | 'bottom end' | 'top' | 'top start' | 'top end'
  className?: string
  children: React.ReactNode
}) {
  return (
    <MenuItems
      anchor={anchor}
      transition
      className={clsx(
        className,
        // layout & shape
        'z-50 mt-1 rounded-xl p-1',
        // colour — uses CSS custom properties defined in globals.css
        'border border-border bg-surface shadow-lg shadow-black/5',
        // open/close animation
        'origin-top-right transition duration-100 ease-out',
        'data-[closed]:scale-95 data-[closed]:opacity-0',
      )}
    >
      {children}
    </MenuItems>
  )
}

export function DropdownItem({
  href,
  className,
  children,
  onClick,
}: {
  href?: string
  className?: string
  children: React.ReactNode
  onClick?: () => void
}) {
  const Comp = href ? 'a' : 'button'
  return (
    <MenuItem>
      {({ focus }: { focus: boolean }) => (
        <Comp
          href={href}
          onClick={onClick}
          className={clsx(
            className,
            'group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
            'text-foreground',
            focus ? 'bg-surface-2' : 'bg-transparent',
          )}
        >
          {children}
        </Comp>
      )}
    </MenuItem>
  )
}

export function DropdownLabel({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <span className={clsx(className, 'flex-1 text-sm font-medium text-foreground')}>
      {children}
    </span>
  )
}

export function DropdownDivider({ className }: { className?: string }) {
  return (
    <MenuSeparator
      className={clsx(className, 'my-1 h-px bg-border')}
    />
  )
}