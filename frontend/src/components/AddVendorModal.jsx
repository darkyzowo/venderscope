import { useState } from 'react'

export default function AddVendorModal({ onAdd, onClose }) {
  const [form, setForm] = useState({ name: '', domain: '', company_number: '' })
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!form.name || !form.domain) return
    setLoading(true)
    await onAdd({
      name: form.name,
      domain: form.domain,
      company_number: form.company_number || null
    })
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#1a1d27] rounded-2xl p-8 w-full max-w-md border border-slate-700">
        <h2 className="text-white text-xl font-bold mb-6">Add Vendor</h2>

        <div className="space-y-4">
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Vendor Name *</label>
            <input
              className="w-full bg-slate-800 text-white rounded-lg px-4 py-2.5 border border-slate-600 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. Salesforce"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">Domain *</label>
            <input
              className="w-full bg-slate-800 text-white rounded-lg px-4 py-2.5 border border-slate-600 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. salesforce.com"
              value={form.domain}
              onChange={e => setForm({ ...form, domain: e.target.value })}
            />
          </div>
          <div>
            <label className="text-slate-400 text-sm mb-1 block">
              Companies House Number <span className="text-slate-600">(UK only, optional)</span>
            </label>
            <input
              className="w-full bg-slate-800 text-white rounded-lg px-4 py-2.5 border border-slate-600 focus:outline-none focus:border-indigo-500"
              placeholder="e.g. 12345678"
              value={form.company_number}
              onChange={e => setForm({ ...form, company_number: e.target.value })}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-8">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-400 hover:text-white hover:border-slate-400 transition"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !form.name || !form.domain}
            className="flex-1 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold disabled:opacity-50 transition"
          >
            {loading ? 'Adding...' : 'Add Vendor'}
          </button>
        </div>
      </div>
    </div>
  )
}