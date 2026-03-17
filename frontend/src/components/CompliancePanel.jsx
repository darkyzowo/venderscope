const DOC_LABELS = {
  privacy_policy: 'Privacy Policy',
  terms:          'Terms of Service',
  security:       'Security Page',
  dpa:            'Data Processing Agreement',
  cookie_policy:  'Cookie Policy',
}

const CERT_LABELS = {
  iso_27001:       'ISO 27001',
  soc2:            'SOC 2',
  gdpr:            'GDPR Compliant',
  cyber_essentials:'Cyber Essentials',
  pci_dss:         'PCI DSS',
}

const Found    = () => <span className="text-green-400 font-semibold">✅ Found</span>
const Missing  = () => <span className="text-slate-500">❌ Not found</span>
const Evidence = () => <span className="text-green-400 font-semibold">✅ Evidence found</span>
const NoEvidence = () => <span className="text-yellow-500">⚠️ No public evidence</span>

export default function CompliancePanel({ compliance }) {
  if (!compliance || Object.keys(compliance).length === 0) return (
    <p className="text-slate-500 text-sm">
      No compliance data yet — run a scan to discover this vendor's compliance posture.
    </p>
  )

  const { documents = {}, trust_centre, certifications = {}, security_contact } = compliance

  return (
    <div className="space-y-6">

      {/* Documents */}
      <div>
        <h4 className="text-slate-300 font-semibold text-sm mb-3 uppercase tracking-wider">
          📋 Compliance Documents
        </h4>
        <div className="space-y-2">
          {Object.entries(DOC_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-300 text-sm">{label}</span>
              {documents[key]
                ? <a href={documents[key]} target="_blank" rel="noreferrer"
                     className="text-indigo-400 hover:text-indigo-300 text-sm underline">
                    ✅ View →
                  </a>
                : <Missing />
              }
            </div>
          ))}
        </div>
      </div>

      {/* Trust Centre */}
      <div>
        <h4 className="text-slate-300 font-semibold text-sm mb-3 uppercase tracking-wider">
          🔐 Trust Centre
        </h4>
        {trust_centre ? (
          <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
            <span className="text-slate-300 text-sm">
              {trust_centre.accessible ? 'Publicly Accessible' : 'Access Required'}
            </span>
            <a href={trust_centre.url} target="_blank" rel="noreferrer"
               className="text-indigo-400 hover:text-indigo-300 text-sm underline">
              {trust_centre.accessible ? '✅ View →' : '🔒 Request Access →'}
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
            <span className="text-slate-300 text-sm">Trust Centre</span>
            <Missing />
          </div>
        )}

        {/* Security contact for requesting access */}
        {security_contact && (
          <div className="mt-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-3">
            <p className="text-indigo-300 text-xs">
              📧 <strong>Security contact:</strong>{' '}
              <a href={`mailto:${security_contact}?subject=Trust Centre Access Request — [Your Company]`}
                 className="underline hover:text-indigo-200">
                {security_contact}
              </a>
              {' '}— click to draft a trust centre access request email.
            </p>
          </div>
        )}
      </div>

      {/* Certifications */}
      <div>
        <h4 className="text-slate-300 font-semibold text-sm mb-1 uppercase tracking-wider">
          🏅 Certifications
        </h4>
        <p className="text-slate-600 text-xs mb-3">
          Based on public evidence found on vendor website — not a verified certification check.
        </p>
        <div className="space-y-2">
          {Object.entries(CERT_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-2 border-b border-slate-700/50">
              <span className="text-slate-300 text-sm">{label}</span>
              {certifications[key] === 'found' ? <Evidence /> : <NoEvidence />}
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}