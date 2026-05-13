interface Props {
  checked: boolean
  onChange: (v: boolean) => void
  label?: string
  disabled?: boolean
}

/** Checkbox NewDB v2 — .cb / .cb.on */
export function Checkbox({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className="inline-flex items-center gap-2"
      style={{ background: 'transparent', border: 0, padding: 0, cursor: disabled ? 'default' : 'pointer' }}
      role="checkbox"
      aria-checked={checked}
    >
      <span className={checked ? 'cb on' : 'cb'}>
        {checked && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden>
            <path d="M5 12l5 5L20 7" />
          </svg>
        )}
      </span>
      {label && <span style={{ fontSize: 12, color: 'var(--text)' }}>{label}</span>}
    </button>
  )
}
