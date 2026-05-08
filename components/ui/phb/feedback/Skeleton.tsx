'use client'
import * as React from 'react'

export interface SkeletonProps {
  width?: number | string
  height?: number | string
  className?: string
  style?: React.CSSProperties
  rounded?: 'sm' | 'md' | 'lg' | 'pill'
}

export function Skeleton({
  width,
  height,
  className = '',
  style,
  rounded = 'md',
}: SkeletonProps) {
  const r =
    rounded === 'pill'
      ? 'rounded-pill'
      : rounded === 'lg'
        ? 'rounded-lg'
        : rounded === 'sm'
          ? 'rounded-sm'
          : 'rounded-md'
  return (
    <div
      className={`bg-bg-2 animate-pulse ${r} ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width,
        height: typeof height === 'number' ? `${height}px` : height,
        ...style,
      }}
      aria-hidden
    />
  )
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <div className="flex gap-3">
      {Array.from({ length: cols }).map((_, i) => (
        <Skeleton key={i} height={20} className="flex-1" />
      ))}
    </div>
  )
}

export function SkeletonCard({ height = 180 }: { height?: number }) {
  return <Skeleton height={height} rounded="lg" className="w-full" />
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-border-1 bg-bg-2 p-4 text-small text-fg-2">
      <span className="text-neg font-medium">Erro:</span> {message}
    </div>
  )
}
