import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getVendors, getVendorEvents, getScoreHistory, scanVendor } from '../api/client'
import ScoreChart from '../components/ScoreChart'
import EventFeed from '../components/EventFeed'

export default function VendorDetail() {
  const { id }  = useParams()
  const nav     = useNavigate()
  const [vendor,  setVendor]  = useState(null)
  const [events,  setEvents]  = useState([])
  const [history, setHistory] = useState([])
  const [scanning, setScan]   = useState(false)

  useEffect(() => {
    const load = async () => {
      const [vRes, eRes, hRes] = await Promise.all([
        getVendors(),
        getVendorEvents(id),
        getScoreHistory(id)
      ])
      setVendor(vRes.data.find(v => v.id === parseInt(id)))
      setEvents(eRes.data)
      setHistory(hRes.data)
    }
    load()
  }, [id])

  const load = async () => {
    const [vRes, eRes, hRes] = await Promise.all([
      getVendors(),
      getVendorEvents(id),
      getScoreHistory(id)
    ])
    setVendor(vRes.data.find(v => v.id === parseInt(id)))
    setEvents(eRes.data)
    setHistory(hRes.data)
  }

  const handleScan = async () => {
    setScan(true)
    await scanVendor(id)
    await load()
    setScan(false)
  }

  if (!vendor) return (
    <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
      <p className="text-slate-500">Loading...</p>
    </div>
  )

  const scoreColor = vendor.risk_score >= 70 ? 'text-red-400'
    : vendor.risk_score >= 35 ? 'text-yellow-400' : 'text-green-400'

  return (
    <div className="min-h-screen bg-[#0f1117] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Back + header */}
        <button onClick={() => nav('/')} className="text-slate-400 hover:text-white text-sm mb-6 transition">
          ← Back to Dashboard
        </button>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{vendor.name}</h1>
            <p className="text-slate-400 mt-1">{vendor.domain}</p>
            {vendor.company_number && (
              <p className="text-slate-500 text-sm mt-1">Companies House: {vendor.company_number}</p>
            )}
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${scoreColor}`}>{vendor.risk_score}</div>
            <div className="text-slate-400 text-sm mt-1">Risk Score</div>
            <button
              onClick={handleScan}
              disabled={scanning}
              className="mt-3 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm disabled:opacity-50 transition"
            >
              {scanning ? 'Scanning...' : '⚡ Scan Now'}
            </button>
            <a
              href={`http://127.0.0.1:8000/api/export/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm text-center transition"
            >
              📄 Export PDF Report
            </a>
          </div>
        </div>

        {/* Chart */}
        <div className="mb-8">
          <ScoreChart history={history} />
        </div>

        {/* Events */}
        <div className="bg-[#1a1d27] rounded-xl border border-slate-700 p-6">
          <h3 className="text-white font-semibold mb-4">
            Risk Events <span className="text-slate-500 font-normal text-sm">({events.length} total)</span>
          </h3>
          <EventFeed events={events} />
        </div>
      </div>
    </div>
  )
}