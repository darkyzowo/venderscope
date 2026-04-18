const RISK = {
  high:   { label: 'High',   dot: 'var(--risk-high)',   bg: 'var(--risk-high-tint)',   text: '#FCA5A5' },
  medium: { label: 'Medium', dot: 'var(--risk-medium)', bg: 'var(--risk-medium-tint)', text: '#FCD34D' },
  low:    { label: 'Low',    dot: 'var(--risk-low)',    bg: 'var(--risk-low-tint)',    text: '#6EE7B7' },
}

export function riskLevel(score) {
  if (score >= 70) return 'high'
  if (score >= 40) return 'medium'
  return 'low'
}

export default function RiskBadge({ score, level: _level, size = 'md' }) {
  const level = _level ?? riskLevel(score ?? 0)
  const cfg = RISK[level] ?? RISK.low
  const px = size === 'sm' ? '6px 8px' : '4px 10px'
  const fs = size === 'sm' ? '10px' : '11px'

  return (
    <span
      role="status"
      aria-label={`${cfg.label} risk`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: px,
        borderRadius: '9999px',
        background: cfg.bg,
        fontSize: fs,
        fontWeight: 600,
        color: cfg.text,
        letterSpacing: '0.02em',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.dot, flexShrink: 0 }} />
      {cfg.label}
    </span>
  )
}
