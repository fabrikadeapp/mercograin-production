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
  const [hoverId, setHoverId] = useState<number | null>(null)
  const pathname = usePathname() ?? '/'

  function isItemActive(item: NavItem): boolean {
    if (item.link) return pathname === item.link || pathname.startsWith(`${item.link}/`)
    if (!item.subMenus) return false
    return item.subMenus.some((g) =>
      g.items.some((sub) => pathname === sub.href || pathname.startsWith(`${sub.href}/`))
    )
  }

  return (
    <ul className="relative flex items-center gap-1">
      {navItems.map((navItem) => {
        const active = isItemActive(navItem)
        const isHovered = hoverId === navItem.id || openMenu === navItem.label
        const baseClasses = `text-small py-1.5 px-3 flex group transition-colors duration-200 items-center justify-center gap-1 relative rounded-pill ${
          active ? 'text-fg-1 bg-bg-2' : 'text-fg-3 hover:text-fg-1'
        }`

        return (
          <li
            key={navItem.label}
            className="relative"
            onMouseEnter={() => {
              setOpenMenu(navItem.label)
              setHoverId(navItem.id)
            }}
            onMouseLeave={() => {
              setOpenMenu(null)
              setHoverId(null)
            }}
          >
            {navItem.link ? (
              <Link href={navItem.link} className={baseClasses}>
                {/* hover overlay APENAS quando não-active */}
                {isHovered && !active && (
                  <motion.span
                    layoutId="nav-hover-bg"
                    className="absolute inset-0 rounded-pill bg-bg-2"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{navItem.label}</span>
              </Link>
            ) : (
              <button type="button" className={baseClasses}>
                {isHovered && !active && (
                  <motion.span
                    layoutId="nav-hover-bg"
                    className="absolute inset-0 rounded-pill bg-bg-2"
                    transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1">
                  {navItem.label}
                  {navItem.subMenus && (
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform duration-200 ${
                        openMenu === navItem.label ? 'rotate-180' : ''
                      }`}
                    />
                  )}
                </span>
              </button>
            )}

            <AnimatePresence>
              {openMenu === navItem.label && navItem.subMenus && (
                <div className="w-auto absolute left-0 top-full pt-2 z-50">
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.15 }}
                    className="border p-4 w-max shadow-2xl"
                    style={{
                      borderRadius: 12,
                      background: 'var(--bg-1)',
                      borderColor: 'var(--border-1)',
                    }}
                  >
                    <div className="w-fit shrink-0 flex space-x-8 overflow-hidden">
                      {navItem.subMenus.map((sub) => (
                        <div className="w-full" key={sub.title}>
                          <h3 className="mb-3 text-micro font-medium uppercase tracking-wider text-fg-3">
                            {sub.title}
                          </h3>
                          <ul className="space-y-3">
                            {sub.items.map((item) => {
                              const Icon = item.icon
                              const itemActive =
                                pathname === item.href || pathname.startsWith(`${item.href}/`)
                              return (
                                <li key={item.label}>
                                  <Link
                                    href={item.href}
                                    className="flex items-start space-x-3 group hover:opacity-90"
                                    onClick={() => setOpenMenu(null)}
                                  >
                                    <div
                                      className="rounded-md flex items-center justify-center size-9 shrink-0 transition-colors duration-200 border"
                                      style={{
                                        borderColor: 'var(--border-1)',
                                        background: itemActive ? 'var(--accent)' : 'var(--bg-2)',
                                        color: itemActive
                                          ? 'var(--accent-ink)'
                                          : 'var(--fg-1)',
                                      }}
                                    >
                                      <Icon className="h-4.5 w-4.5 flex-none" />
                                    </div>
                                    <div className="leading-tight">
                                      <p
                                        className={`text-small font-medium ${
                                          itemActive ? 'text-accent' : 'text-fg-1'
                                        }`}
                                      >
                                        {item.label}
                                      </p>
                                      <p className="text-micro text-fg-3 group-hover:text-fg-2 transition-colors duration-200 mt-0.5">
                                        {item.description}
                                      </p>
                                    </div>
                                  </Link>
                                </li>
                              )
                            })}
                          </ul>
                        </div>
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
