const DOC_LABELS = {
  privacy_policy: 'Privacy Policy',
  terms: 'Terms of Service',
  security: 'Security Page',
  cookie_policy: 'Cookie Policy',
}

const CERT_LABELS = {
  iso_27001: 'ISO 27001',
  soc2: 'SOC 2',
  gdpr: 'GDPR',
  cyber_essentials: 'Cyber Essentials',
  pci_dss: 'PCI DSS',
  dpa: 'DPA',
}

const SectionHeading = ({ children }) => (
  <h4
    className="text-[10px] font-bold uppercase tracking-[0.14em] mb-3"
    style={{ color: '#8080aa' }}
  >
    {children}
  </h4>
)

const Row = ({ label, children }) => (
  <div
    className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 py-2.5"
    style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
  >
    <span className="text-sm" style={{ color: '#b8b8d0' }}>{label}</span>
    {children}
  </div>
)

const ViewLink = ({ href, label = 'View' }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full transition-colors duration-150"
    style={{
      background: 'rgba(139,92,246,0.1)',
      border: '1px solid rgba(139,92,246,0.2)',
      color: '#a78bfa',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = 'rgba(139,92,246,0.18)'
      e.currentTarget.style.color = '#c4b5fd'
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = 'rgba(139,92,246,0.1)'
      e.currentTarget.style.color = '#a78bfa'
    }}
  >
    {label}
    <svg width="9" height="9" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </a>
)

const EmptyDash = () => (
  <span className="text-xs" style={{ color: '#44445a' }}>—</span>
)

// Certification grid card
const CertCard = ({ label, cert }) => {
  const normalised = !cert || cert.status === 'not_found'
    ? { status: 'not_found' }
    : typeof cert === 'string'
    ? { status: cert === 'found' ? 'found' : 'not_found', source: 'site' }
    : cert

  const configs = {
    not_found: {
      bg: 'rgba(255,255,255,0.02)',
      border: 'rgba(255,255,255,0.06)',
      icon: '—',
      iconColor: '#8080aa',
      text: 'No evidence',
      textColor: '#8080aa',
    },
    found: {
      bg: 'rgba(34,197,94,0.06)',
      border: 'rgba(34,197,94,0.15)',
      icon: '✓',
      iconColor: '#22c55e',
      text: 'Verified',
      textColor: '#22c55e',
    },
    third_party: {
      bg: 'rgba(251,191,36,0.06)',
      border: 'rgba(251,191,36,0.15)',
      icon: '↗',
      iconColor: '#fbbf24',
      text: 'Via partners',
      textColor: '#fbbf24',
    },
    external: {
      bg: 'rgba(14,165,233,0.06)',
      border: 'rgba(14,165,233,0.15)',
      icon: '◎',
      iconColor: '#38bdf8',
      text: 'External',
      textColor: '#38bdf8',
    },
  }

  const status = normalised.source === 'external' ? 'external' : normalised.status
  const cfg = configs[status] || configs.not_found

  const inner = (
    <div
      className="rounded-lg p-3 flex flex-col gap-1.5 h-full"
      style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
    >
      <span className="text-sm font-bold leading-none" style={{ color: cfg.iconColor }}>
        {cfg.icon}
      </span>
      <span className="text-xs font-semibold leading-tight" style={{ color: '#b8b8d0' }}>
        {label}
      </span>
      <span className="text-[10px] font-medium" style={{ color: cfg.textColor }}>
        {cfg.text}
      </span>
    </div>
  )

  if (normalised.url && status !== 'not_found') {
    return (
      <a
        href={normalised.url}
        target="_blank"
        rel="noreferrer"
        title={
          status === 'third_party'
            ? "Vendor's infrastructure providers hold this cert — not the vendor directly."
            : undefined
        }
        className="block transition-opacity hover:opacity-80"
      >
        {inner}
      </a>
    )
  }

  return inner
}

const sourceLabel = (src) => {
  if (src === 'security.txt') return 'security.txt'
  if (src === 'web_search') return 'web search'
  return 'vendor site'
}

export default function CompliancePanel({ compliance }) {
  if (!compliance || Object.keys(compliance).length === 0)
    return (
      <p className="text-sm py-2" style={{ color: '#8080aa' }}>
        No compliance data yet — run a scan to discover this vendor's compliance posture.
      </p>
    )

  const {
    documents = {},
    trust_centre,
    certifications = {},
    security_contact,
  } = compliance

  const verifiedContact = security_contact?.verified ? security_contact.email : null

  const normaliseCert = (val) => {
    if (!val) return { status: 'not_found' }
    if (typeof val === 'string')
      return { status: val === 'found' ? 'found' : 'not_found', source: 'site' }
    return val
  }

  return (
    <div className="space-y-7">
      {/* Compliance documents */}
      <div>
        <SectionHeading>Compliance Documents</SectionHeading>
        <div>
          {Object.entries(DOC_LABELS).map(([key, label]) => (
            <Row key={key} label={label}>
              {documents[key] ? <ViewLink href={documents[key]} /> : <EmptyDash />}
            </Row>
          ))}
        </div>
      </div>

      {/* Trust centre */}
      <div>
        <SectionHeading>Trust Centre</SectionHeading>
        {trust_centre ? (
          <Row label={trust_centre.accessible ? 'Publicly Accessible' : 'Login Required'}>
            <ViewLink
              href={trust_centre.url}
              label={trust_centre.accessible ? 'View' : 'Request access'}
            />
          </Row>
        ) : (
          <Row label="Trust Centre"><EmptyDash /></Row>
        )}

        {verifiedContact ? (
          <div
            className="mt-3 rounded-lg px-4 py-3"
            style={{
              background: 'rgba(139,92,246,0.07)',
              border: '1px solid rgba(139,92,246,0.15)',
            }}
          >
            <p className="text-xs" style={{ color: '#b8b8d0' }}>
              <span style={{ color: '#a78bfa', fontWeight: 600 }}>Security contact</span>
              <span style={{ color: '#8080aa' }}> via {sourceLabel(security_contact?.source)}</span>
              <span style={{ color: '#44445a', margin: '0 8px' }}>·</span>
              <a
                href={`mailto:${verifiedContact}?subject=Trust Centre Access Request`}
                className="hover:underline underline-offset-2 transition-colors"
                style={{ color: '#a78bfa' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#c4b5fd'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#a78bfa'}
              >
                {verifiedContact}
              </a>
            </p>
          </div>
        ) : (
          <div
            className="mt-3 rounded-lg px-4 py-3"
            style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <p className="text-xs" style={{ color: '#8080aa' }}>
              <span style={{ color: '#b8b8d0', fontWeight: 500 }}>No verified security contact</span>
              {' '}— no security.txt or recognised contact email found.
            </p>
          </div>
        )}
      </div>

      {/* Certifications grid */}
      <div>
        <SectionHeading>Certifications</SectionHeading>
        <p className="text-[10px] mb-3" style={{ color: '#8080aa' }}>
          Based on public evidence only — not a verified audit. External = found via web search.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {Object.entries(CERT_LABELS).map(([key, label]) => (
            <CertCard
              key={key}
              label={label}
              cert={normaliseCert(certifications[key])}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
