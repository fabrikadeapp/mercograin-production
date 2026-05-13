interface Props {
  on: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}

/** Toggle NewDB v2 — .tg / .tg.on */
export function Toggle({ on, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!on)}
      disabled={disabled}
      className="inline-flex items-center gap-2"
      style={{ background: 'transparent', border: 0, padding: 0, cursor: disabled ? 'default' : 'pointer' }}
      role="switch"
      aria-checked={on}
    >
      <span className={on ? 'tg on' : 'tg'} />
      {label && <span style={{ fontSize: 12, color: on ? 'var(--text)' : 'var(--text-mute)' }}>{label}</span>}
    </button>
  )
}
