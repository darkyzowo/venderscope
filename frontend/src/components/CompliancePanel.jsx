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

const SectionHeading = ({ children }) => (
  <h4 className="text-slate-400 font-medium text-xs uppercase tracking-widest mb-3">
    {children}
  </h4>
);

const Row = ({ label, children }) => (
  <div className="flex items-center justify-between py-2.5 border-b border-slate-700/40 last:border-0">
    <span className="text-slate-300 text-sm">{label}</span>
    {children}
  </div>
);

const Badge = ({ variant = "muted", children }) => {
  const styles = {
    muted:    "bg-slate-700/40 border-slate-600/30 text-slate-500",
    found:    "bg-green-500/10 border-green-500/20 text-green-400",
    external: "bg-sky-500/10 border-sky-500/20 text-sky-400",
    warning:  "bg-slate-700/40 border-slate-600/30 text-slate-400",
  };
  return (
    <span className={`inline-flex items-center text-xs px-2.5 py-0.5 rounded-full border ${styles[variant]}`}>
      {children}
    </span>
  );
};

const ViewLink = ({ href, label = "View" }) => (
  <a
    href={href}
    target="_blank"
    rel="noreferrer"
    className="inline-flex items-center gap-1 text-xs px-2.5 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors"
  >
    {label}
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
      <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  </a>
);

const CertBadge = ({ cert }) => {
  if (!cert || cert.status === "not_found") return <Badge variant="muted">No evidence</Badge>;
  if (cert.source === "external") {
    return cert.url ? (
      <ViewLink href={cert.url} label="External source" />
    ) : (
      <Badge variant="external">External evidence</Badge>
    );
  }
  return <Badge variant="found">Verified</Badge>;
};

const sourceLabel = (source) => {
  if (source === "security.txt") return "security.txt";
  if (source === "web_search") return "web search";
  return "vendor site";
};

export default function CompliancePanel({ compliance }) {
  if (!compliance || Object.keys(compliance).length === 0)
    return (
      <p className="text-slate-500 text-sm">
        No compliance data yet — run a scan to discover this vendor's compliance posture.
      </p>
    );

  const {
    documents = {},
    trust_centre,
    certifications = {},
    security_contact,
  } = compliance;
  const verifiedContact = security_contact?.verified ? security_contact.email : null;

  const normaliseCert = (val) => {
    if (!val) return { status: "not_found" };
    if (typeof val === "string")
      return { status: val === "found" ? "found" : "not_found", source: "site" };
    return val;
  };

  return (
    <div className="space-y-6">
      {/* Compliance Documents */}
      <div>
        <SectionHeading>Compliance Documents</SectionHeading>
        <div>
          {Object.entries(DOC_LABELS).map(([key, label]) => (
            <Row key={key} label={label}>
              {documents[key] ? (
                <ViewLink href={documents[key]} />
              ) : (
                <span className="text-slate-600 text-xs">—</span>
              )}
            </Row>
          ))}
        </div>
      </div>

      {/* Trust Centre */}
      <div>
        <SectionHeading>Trust Centre</SectionHeading>
        {trust_centre ? (
          <Row label={trust_centre.accessible ? "Publicly Accessible" : "Access Required"}>
            {trust_centre.accessible ? (
              <ViewLink href={trust_centre.url} />
            ) : (
              <ViewLink href={trust_centre.url} label="Request access" />
            )}
          </Row>
        ) : (
          <Row label="Trust Centre">
            <span className="text-slate-600 text-xs">—</span>
          </Row>
        )}

        {/* Security contact */}
        {verifiedContact ? (
          <div className="mt-3 bg-indigo-500/8 border border-indigo-500/20 rounded-lg px-4 py-3">
            <p className="text-xs text-indigo-300/80">
              <span className="font-medium text-indigo-300">Security contact</span>
              <span className="text-indigo-400/50 ml-1">
                via {sourceLabel(security_contact?.source)}
              </span>
              <span className="text-indigo-400/40 mx-2">·</span>
              <a
                href={`mailto:${verifiedContact}?subject=Trust Centre Access Request - [Your Company]`}
                className="underline underline-offset-2 hover:text-indigo-200 transition-colors"
              >
                {verifiedContact}
              </a>
            </p>
          </div>
        ) : (
          <div className="mt-3 bg-slate-800/40 border border-slate-700/30 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500">
              <span className="font-medium text-slate-400">No verified security contact</span>
              {" "}— no security.txt or recognised contact email found on vendor's site.
            </p>
          </div>
        )}
      </div>

      {/* Certifications & Compliance */}
      <div>
        <SectionHeading>Certifications & Compliance</SectionHeading>
        <p className="text-slate-600 text-xs mb-3">
          Based on public evidence only — not a verified audit.
          External = found via web search outside the vendor's own site.
        </p>
        <div>
          {Object.entries(CERT_LABELS).map(([key, label]) => (
            <Row key={key} label={label}>
              <CertBadge cert={normaliseCert(certifications[key])} />
            </Row>
          ))}
        </div>
      </div>
    </div>
  );
}
