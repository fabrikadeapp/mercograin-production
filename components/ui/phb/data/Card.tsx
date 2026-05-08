'use client'
import * as React from 'react'
import { cn } from '@/lib/utils/cn'

export type CardProps = React.HTMLAttributes<HTMLDivElement>

export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={cn('card', className)} {...props}>
      {children}
    </div>
  )
}

export function CardHeader({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('flex items-start justify-between mb-4', className)}
      {...props}
    >
      {children}
    </div>
  )
}

export interface CardTitleProps {
  children: React.ReactNode
  eyebrow?: string
  className?: string
}

export function CardTitle({ children, eyebrow, className }: CardTitleProps) {
  return (
    <div className={cn('space-y-1', className)}>
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h3 className="text-h3 font-sans tracking-tight text-fg-1">{children}</h3>
    </div>
  )
}

export function CardBody({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('space-y-3', className)} {...props}>
      {children}
    </div>
  )
}

export function CardFooter({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'flex items-center justify-between mt-4 pt-4 border-t border-border-1',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  )
}
