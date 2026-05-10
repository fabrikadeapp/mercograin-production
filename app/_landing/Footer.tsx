import Link from 'next/link'
import { Brand } from '@/components/ui/phb'
import { FOOTER_LINKS } from './data'

export function Footer() {
  return (
    <footer className="bg-bg-0">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-8 md:py-20">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <Brand size="lg" />
            <p className="mt-4 max-w-xs text-small text-fg-3">
              A mesa de operações para tradings de grãos brasileiras.
            </p>
          </div>

          <FooterColumn title="Produto" links={FOOTER_LINKS.produto} />
          <FooterColumn title="Empresa" links={FOOTER_LINKS.empresa} />
          <FooterColumn title="Legal" links={FOOTER_LINKS.legal} />
        </div>

        <div className="mt-16 border-t border-border-1 pt-8 text-center text-micro text-fg-3">
          © 2026 BH Grain · Grain Intelligence · Feito no Brasil
        </div>
      </div>
    </footer>
  )
}

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string }[]
}) {
  return (
    <div>
      <h4 className="eyebrow mb-4 text-fg-3">{title}</h4>
      <ul className="flex flex-col gap-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-small text-fg-2 transition-colors hover:text-fg-1"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
