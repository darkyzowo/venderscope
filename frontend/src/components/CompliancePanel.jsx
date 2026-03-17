const DOC_LABELS = {
  privacy_policy: "Privacy Policy",
  terms: "Terms of Service",
  security: "Security Page",
  cookie_policy: "Cookie Policy",
};

const CERT_LABELS = {
  iso_27001: "ISO 27001",
  soc2: "SOC 2",
  gdpr: "GDPR Compliant",
  cyber_essentials: "Cyber Essentials",
  pci_dss: "PCI DSS",
  dpa: "Data Processing Agreement (DPA)",
};

const Missing = () => <span className="text-slate-500">❌ Not found</span>;
const NoEvidence = () => (
  <span className="text-yellow-500">⚠️ No public evidence</span>
);

const CertBadge = ({ cert }) => {
  if (!cert || cert.status === "not_found") return <NoEvidence />;

  if (cert.source === "external") {
    return cert.url ? (
      <a
        href={cert.url}
        target="_blank"
        rel="noreferrer"
        title={cert.title || "External source"}
        className="text-blue-400 hover:text-blue-300 font-semibold text-sm underline"
      >
        🌐 Evidence found (external) →
      </a>
    ) : (
      <span className="text-blue-400 font-semibold">
        🌐 Evidence found (external)
      </span>
    );
  }

  // source === "site"
  return (
    <span className="text-green-400 font-semibold">✅ Evidence found</span>
  );
};

export default function CompliancePanel({ compliance }) {
  if (!compliance || Object.keys(compliance).length === 0)
    return (
      <p className="text-slate-500 text-sm">
        No compliance data yet — run a scan to discover this vendor's compliance
        posture.
      </p>
    );

  const {
    documents = {},
    trust_centre,
    certifications = {},
    security_contact,
  } = compliance;
  const verifiedContact = security_contact?.verified
    ? security_contact.email
    : null;

  // Support both old format (string) and new format ({status, source})
  const normaliseCert = (val) => {
    if (!val) return { status: "not_found" };
    if (typeof val === "string")
      return {
        status: val === "found" ? "found" : "not_found",
        source: "site",
      };
    return val;
  };

  return (
    <div className="space-y-6">
      {/* Compliance Documents */}
      <div>
        <h4 className="text-slate-300 font-semibold text-sm mb-3 uppercase tracking-wider">
          📋 Compliance Documents
        </h4>
        <div className="space-y-2">
          {Object.entries(DOC_LABELS).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between py-2 border-b border-slate-700/50"
            >
              <span className="text-slate-300 text-sm">{label}</span>
              {documents[key] ? (
                <a
                  href={documents[key]}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-400 hover:text-indigo-300 text-sm underline"
                >
                  ✅ View →
                </a>
              ) : (
                <Missing />
              )}
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
              {trust_centre.accessible
                ? "Publicly Accessible"
                : "Access Required"}
            </span>
            <a
              href={trust_centre.url}
              target="_blank"
              rel="noreferrer"
              className="text-indigo-400 hover:text-indigo-300 text-sm underline"
            >
              {trust_centre.accessible ? "✅ View →" : "🔒 Request Access →"}
            </a>
          </div>
        ) : (
          <div className="flex items-center justify-between py-2 border-b border-slate-700/50">
            <span className="text-slate-300 text-sm">Trust Centre</span>
            <Missing />
          </div>
        )}

        {verifiedContact && (
          <div className="mt-3 bg-indigo-500/10 border border-indigo-500/30 rounded-lg px-4 py-3">
            <p className="text-indigo-300 text-xs">
              📧 <strong>Security contact</strong>{" "}
              <span className="text-indigo-400/60 font-normal">
                (verified via security.txt):
              </span>{" "}
              <a
                href={`mailto:${verifiedContact}?subject=Trust Centre Access Request - [Your Company]`}
                className="underline hover:text-indigo-200"
              >
                {verifiedContact}
              </a>{" "}
              — click to draft a trust centre access request email.
            </p>
          </div>
        )}
      </div>

      {/* Certifications & Compliance */}
      <div>
        <h4 className="text-slate-300 font-semibold text-sm mb-1 uppercase tracking-wider">
          🏅 Certifications & Compliance
        </h4>
        <p className="text-slate-600 text-xs mb-3">
          Based on public evidence — not a verified certification check. 🌐
          External = found via web search outside vendor's own site.
        </p>
        <div className="space-y-2">
          {Object.entries(CERT_LABELS).map(([key, label]) => (
            <div
              key={key}
              className="flex items-center justify-between py-2 border-b border-slate-700/50"
            >
              <span className="text-slate-300 text-sm">{label}</span>
              <CertBadge cert={normaliseCert(certifications[key])} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
