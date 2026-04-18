import { useEffect, useMemo, useState } from 'react'

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

const cleanDomain = (domain = '') =>
  domain.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].trim().toLowerCase()

const getLogoCandidates = (domain = '') => {
  const base = cleanDomain(domain)
  if (!base) return []
  return [
    `https://${base}/favicon.ico`,
    `https://www.${base}/favicon.ico`,
    `https://www.google.com/s2/favicons?domain=${encodeURIComponent(base)}&sz=64`,
  ]
}

export default function VendorAvatar({ name = 'V', domain = '', size = 36 }) {
  const [from, to] = getGradient(name)
  const letter = name[0].toUpperCase()
  const fontSize = Math.round(size * 0.42)
  const logoCandidates = useMemo(() => getLogoCandidates(domain), [domain])
  const [logoIndex, setLogoIndex] = useState(0)

  useEffect(() => {
    setLogoIndex(0)
  }, [domain])

  const activeLogo = logoCandidates[logoIndex] || null

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
        overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      aria-hidden="true"
    >
      {activeLogo ? (
        <img
          src={activeLogo}
          alt=""
          width={size}
          height={size}
          loading="lazy"
          referrerPolicy="no-referrer"
          style={{
            width: size,
            height: size,
            objectFit: 'cover',
            background: 'rgba(255,255,255,0.03)',
          }}
          onError={() => setLogoIndex((idx) => idx + 1)}
        />
      ) : (
        letter
      )}
    </div>
  )
}
