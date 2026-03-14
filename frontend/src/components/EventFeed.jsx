// src/components/EventFeed.jsx
const severityStyle = {
  CRITICAL: 'bg-red-500/20 text-red-400 border-red-500/40',
  HIGH:     'bg-orange-500/20 text-orange-400 border-orange-500/40',
  MEDIUM:   'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
  LOW:      'bg-green-500/20 text-green-400 border-green-500/40',
}

const sourceIcon = {
  HIBP:           '🔓',
  NVD:            '🛡',
  CompaniesHouse: '🏢',
  News:           '📰',
  Shodan:         '🌐',
}

export default function EventFeed({ events }) {
  if (!events.length) return (
    <p className="text-slate-500 text-sm">No risk events detected yet.</p>
  )

  return (
    <div className="space-y-3">
      {events.map(evt => (
        <div key={evt.id} className={`rounded-lg border p-4 ${severityStyle[evt.severity] || severityStyle.LOW}`}>
          <div className="flex items-center justify-between mb-1">
            <span className="font-semibold text-sm">
              {sourceIcon[evt.source] || '⚠️'} {evt.title}
            </span>
            <span className={`text-xs font-bold tracking-wider px-2 py-0.5 rounded-full border ${severityStyle[evt.severity]}`}>
              {evt.severity}
            </span>
          </div>
          <p className="text-xs opacity-80 mb-2">{evt.description}</p>
          <p className="text-xs opacity-50">
            {new Date(evt.detected_at).toLocaleString()} · {evt.source}
          </p>
        </div>
      ))}
    </div>
  )
}