'use client'
import { useState } from 'react'
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

export interface NavSubItem {
  label: string
  description: string
  icon: React.ElementType
  href: string
}

export interface NavItem {
  id: number
  label: string
  link?: string
  subMenus?: {
    title: string
    items: NavSubItem[]
  }[]
}

interface Props {
  navItems: NavItem[]
}

export function DropdownNavigation({ navItems }: Props) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [isHover, setIsHover] = useState<number | null>(null)
  const pathname = usePathname() ?? '/'

  const handleHover = (menuLabel: string | null) => setOpenMenu(menuLabel)

  function isItemActive(item: NavItem): boolean {
    if (item.link) return pathname === item.link || pathname.startsWith(`${item.link}/`)
    if (!item.subMenus) return false
    return item.subMenus.some((g) =>
      g.items.some((sub) => pathname === sub.href || pathname.startsWith(`${sub.href}/`))
    )
  }

  return (
    <ul className="relative flex items-center space-x-0">
      {navItems.map((navItem) => {
        const active = isItemActive(navItem)
        return (
          <li
            key={navItem.label}
            className="relative"
            onMouseEnter={() => handleHover(navItem.label)}
            onMouseLeave={() => handleHover(null)}
          >
            {navItem.link ? (
              <Link
                href={navItem.link}
                className={`text-small py-2 px-4 flex group transition-colors duration-300 items-center justify-center gap-1 relative ${
                  active ? 'text-fg-1' : 'text-fg-3 hover:text-fg-1'
                }`}
                onMouseEnter={() => setIsHover(navItem.id)}
                onMouseLeave={() => setIsHover(null)}
              >
                <span>{navItem.label}</span>
                {(isHover === navItem.id || active) && (
                  <motion.div
                    layoutId="hover-bg"
                    className="absolute inset-0 size-full"
                    style={{ borderRadius: 99, background: 'var(--bg-2)' }}
                  />
                )}
              </Link>
            ) : (
              <button
                className={`text-small py-2 px-4 flex cursor-pointer group transition-colors duration-300 items-center justify-center gap-1 relative ${
                  active ? 'text-fg-1' : 'text-fg-3 hover:text-fg-1'
                }`}
                onMouseEnter={() => setIsHover(navItem.id)}
                onMouseLeave={() => setIsHover(null)}
                type="button"
              >
                <span>{navItem.label}</span>
                {navItem.subMenus && (
                  <ChevronDown
                    className={`h-4 w-4 group-hover:rotate-180 duration-300 transition-transform ${
                      openMenu === navItem.label ? 'rotate-180' : ''
                    }`}
                  />
                )}
                {(isHover === navItem.id || openMenu === navItem.label || active) && (
                  <motion.div
                    layoutId="hover-bg"
                    className="absolute inset-0 size-full"
                    style={{ borderRadius: 99, background: 'var(--bg-2)' }}
                  />
                )}
              </button>
            )}

            <AnimatePresence>
              {openMenu === navItem.label && navItem.subMenus && (
                <div className="w-auto absolute left-0 top-full pt-2 z-50">
                  <motion.div
                    className="border p-4 w-max shadow-xl"
                    style={{
                      borderRadius: 16,
                      background: 'var(--bg-1)',
                      borderColor: 'var(--border-1)',
                    }}
                    layoutId="menu"
                  >
                    <div className="w-fit shrink-0 flex space-x-9 overflow-hidden">
                      {navItem.subMenus.map((sub) => (
                        <motion.div layout className="w-full" key={sub.title}>
                          <h3 className="mb-4 text-micro font-medium uppercase tracking-wider text-fg-3">
                            {sub.title}
                          </h3>
                          <ul className="space-y-4">
                            {sub.items.map((item) => {
                              const Icon = item.icon
                              const itemActive =
                                pathname === item.href || pathname.startsWith(`${item.href}/`)
                              return (
                                <li key={item.label}>
                                  <Link
                                    href={item.href}
                                    className="flex items-start space-x-3 group"
                                    onClick={() => setOpenMenu(null)}
                                  >
                                    <div
                                      className="rounded-md flex items-center justify-center size-9 shrink-0 transition-colors duration-300 border"
                                      style={{
                                        borderColor: 'var(--border-1)',
                                        background: itemActive ? 'var(--accent)' : 'transparent',
                                        color: itemActive
                                          ? 'var(--accent-ink)'
                                          : 'var(--fg-1)',
                                      }}
                                    >
                                      <Icon className="h-5 w-5 flex-none" />
                                    </div>
                                    <div className="leading-5 w-max">
                                      <p
                                        className={`text-small font-medium shrink-0 ${
                                          itemActive ? 'text-accent' : 'text-fg-1'
                                        }`}
                                      >
                                        {item.label}
                                      </p>
                                      <p className="text-micro text-fg-3 shrink-0 group-hover:text-fg-1 transition-colors duration-300">
                                        {item.description}
                                      </p>
                                    </div>
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </li>
        )
      })}
    </ul>
  )
}
