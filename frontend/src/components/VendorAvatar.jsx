// Deterministic gradient avatar using first letter of vendor name
const GRADIENTS = [
  ['#7c3aed', '#4f46e5'],
  ['#0ea5e9', '#0891b2'],
  ['#10b981', '#059669'],
  ['#f59e0b', '#d97706'],
  ['#ef4444', '#dc2626'],
  ['#8b5cf6', '#6d28d9'],
  ['#06b6d4', '#0e7490'],
  ['#f97316', '#ea580c'],
]

const getGradient = (name = '') => {
  const idx = (name.charCodeAt(0) || 0) % GRADIENTS.length
  return GRADIENTS[idx]
}

export default function VendorAvatar({ name = 'V', size = 36 }) {
  const [from, to] = getGradient(name)
  const letter = name[0].toUpperCase()
  const fontSize = Math.round(size * 0.42)

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: `linear-gradient(135deg, ${from}, ${to})`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize,
        fontWeight: 700,
        color: '#fff',
        flexShrink: 0,
        letterSpacing: '-0.02em',
        userSelect: 'none',
      }}
      aria-hidden="true"
    >
      {letter}
    </div>
  )
}
