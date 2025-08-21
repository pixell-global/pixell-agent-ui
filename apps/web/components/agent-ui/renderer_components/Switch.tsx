import React from 'react'

interface SwitchProps {
  label?: string
  bind?: boolean
  onChange?: (value: boolean) => void
}

export const Switch: React.FC<SwitchProps> = ({ label, bind, onChange }) => {
  const checked = Boolean(bind)
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange && onChange(e.target.checked)}
      />
      {label ? <span>{label}</span> : null}
    </label>
  )
}


