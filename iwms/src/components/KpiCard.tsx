import React from 'react'
import { LucideIcon } from 'lucide-react'

interface KpiCardProps {
  icon: LucideIcon
  iconColor: string
  iconBg: string
  label: string
  value: string | number
  subLabel?: string
  subValue?: string | number
  subColor?: string
  linkLabel?: string
  onLinkClick?: () => void
}

export function KpiCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  subLabel,
  subValue,
  subColor,
  linkLabel,
  onLinkClick,
}: KpiCardProps) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '0.5px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '1rem 1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="kpi-label">{label}</p>
          <p className="kpi-value">{value}</p>
          {subLabel && (
            <p className="kpi-sub">
              {subValue !== undefined && (
                <span style={{ color: subColor || 'var(--text-2)', marginRight: '4px' }}>{subValue}</span>
              )}
              {subLabel}
            </p>
          )}
        </div>
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: '50%',
            background: iconBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            marginLeft: 12,
          }}
        >
          <Icon size={20} color={iconColor} />
        </div>
      </div>
      {linkLabel && (
        <button
          type="button"
          onClick={onLinkClick}
          style={{
            marginTop: '0.75rem',
            paddingTop: '0.75rem',
            borderTop: '0.5px solid var(--border)',
            background: 'none',
            border: 'none',
            color: 'var(--accent-text)',
            fontSize: '0.75rem',
            fontWeight: 500,
            cursor: 'pointer',
            textAlign: 'left',
            padding: '0.75rem 0 0 0',
            width: '100%',
          }}
        >
          {linkLabel} →
        </button>
      )}
    </div>
  )
}

export default KpiCard;
