'use client'

import * as React from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui/phb'
import { FAQ } from './data'

function FaqRow({
  question,
  answer,
  defaultOpen,
}: {
  question: string
  answer: string
  defaultOpen?: boolean
}) {
  const [open, setOpen] = React.useState(!!defaultOpen)
  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-bg-3"
        aria-expanded={open}
      >
        <span className="text-body font-medium text-fg-1">{question}</span>
        <ChevronDown
          className={
            'h-4 w-4 shrink-0 text-fg-3 transition-transform duration-200 ' +
            (open ? 'rotate-180' : '')
          }
        />
      </button>
      <div
        className={
          'grid transition-[grid-template-rows] duration-200 ease-out ' +
          (open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')
        }
      >
        <div className="overflow-hidden">
          <p className="border-t border-border-1 px-6 py-5 text-body text-fg-2">
            {answer}
          </p>
        </div>
      </div>
    </Card>
  )
}

export function Faq() {
  return (
    <section id="faq" className="border-b border-border-1 bg-bg-1">
      <div className="mx-auto max-w-3xl px-4 py-24 md:px-8 md:py-32">
        <div className="mb-12">
          <p className="eyebrow mb-3 text-fg-3">FAQ</p>
          <h2 className="font-sans text-h1 font-semibold tracking-tight text-fg-1">
            Perguntas frequentes.
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {FAQ.map((item, i) => (
            <FaqRow
              key={item.question}
              question={item.question}
              answer={item.answer}
              defaultOpen={i === 0}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
