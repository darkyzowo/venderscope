const severityStyle = {
  CRITICAL: 'bg-red-500/10 text-red-400 border-red-500/30',
  HIGH:     'bg-orange-500/10 text-orange-400 border-orange-500/30',
  MEDIUM:   'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  LOW:      'bg-green-500/10 text-green-400 border-green-500/30',
}

const severityDot = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-500',
  MEDIUM:   'bg-yellow-500',
  LOW:      'bg-green-500',
}

const getCVELink = (title) => {
  const id = title?.split(' ')[0]
  return id?.startsWith('CVE-') ? `https://nvd.nist.gov/vuln/detail/${id}` : null
}

export default function EventFeed({ events }) {
  if (!events.length) return (
    <p className="text-slate-500 text-sm">No risk events detected yet.</p>
  )

  return (
    <div className="space-y-2.5">
      {events.map(evt => {
        const cveLink = evt.severity === 'CRITICAL' ? getCVELink(evt.title) : null
        const style = severityStyle[evt.severity] || severityStyle.LOW
        const dot = severityDot[evt.severity] || severityDot.LOW
        return (
          <div key={evt.id} className={`rounded-lg border p-4 ${style}`}>
            <div className="flex items-start justify-between gap-3 mb-1.5">
              <span className="font-semibold text-sm leading-snug">
                {cveLink ? (
                  <a href={cveLink} target="_blank" rel="noreferrer" className="hover:underline underline-offset-2">
                    {evt.title}
                    <svg className="inline ml-1 mb-0.5" width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
                      <path d="M2 8L8 2M8 2H4M8 2V6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </a>
                ) : evt.title}
              </span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
                <span className={`text-xs font-bold tracking-wider px-2 py-0.5 rounded-full border ${style}`}>
                  {evt.severity}
                </span>
              </div>
            </div>
            <p className="text-xs opacity-75 mb-2 leading-relaxed">{evt.description}</p>
            <div className="flex items-center gap-2 text-xs opacity-40">
              <span className="font-medium">{evt.source}</span>
              <span>·</span>
              <span>{new Date(evt.detected_at).toLocaleString()}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
