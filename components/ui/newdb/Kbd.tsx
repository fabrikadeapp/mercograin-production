import type { ReactNode } from 'react'

/** Keyboard shortcut badge — .kbd em newdb.css */
export function Kbd({ children }: { children: ReactNode }) {
  return <span className="kbd">{children}</span>
}
