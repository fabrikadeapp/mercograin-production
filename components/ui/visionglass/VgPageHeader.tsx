/**
 * VgPageHeader — header de página no estilo VisionGlass.
 * Eyebrow + título display-lg + subtitle + actions.
 */
import React from 'react'

interface Props {
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
}

export function VgPageHeader({ eyebrow, title, subtitle, actions }: Props) {
  return (
    <header className="flex items-end justify-between gap-6 mb-8 flex-wrap">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-vg-caption uppercase tracking-wider text-vg-fg-3 mb-2">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-vg-display-lg leading-tight">{title}</h1>
        {subtitle ? (
          <p className="text-vg-body text-vg-fg-2 mt-2 max-w-2xl">{subtitle}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </header>
  )
}
