import Link from 'next/link'
import { Brand, Button } from '@/components/ui/phb'
import { NAV_LINKS } from './data'

export function LandingNav() {
  return (
    <header className="sticky top-0 z-40 border-b border-border-1 bg-bg-0/85 backdrop-blur-md">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-8">
        <Link href="/" aria-label="PHB Grain — Início">
          <Brand />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <a
                href={link.href}
                className="text-small text-fg-2 transition-colors hover:text-fg-1"
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <Link href="/auth/login">
            <Button variant="ghost" size="sm">Entrar</Button>
          </Link>
          <Link href="/auth/signup?plan=pro" className="hidden sm:inline-flex">
            <Button variant="primary" size="sm">Começar trial</Button>
          </Link>
        </div>
      </nav>
    </header>
  )
}
