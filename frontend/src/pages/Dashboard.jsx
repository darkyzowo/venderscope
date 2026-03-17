import { useEffect, useState } from "react";
import { getVendors, addVendor, deleteVendor, scanVendor } from "../api/client";
import VendorCard from "../components/VendorCard";
import AddVendorModal from "../components/AddVendorModal";
import QuotaBanner from "../components/QuotaBanner";

export default function Dashboard() {
  const [vendors, setVendors] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [scanning, setScanning] = useState({});
  const [scanningAll, setScanAll] = useState(false);

  const load = () => getVendors().then((r) => setVendors(r.data));

  useEffect(() => {
    load();
  }, []);

  const handleAdd = async (data) => {
    await addVendor(data);
    await load();
  };

  const handleDelete = async (id) => {
    if (!confirm("Remove this vendor?")) return;
    await deleteVendor(id);
    await load();
  };

  const handleScan = async (id) => {
    setScanning((s) => ({ ...s, [id]: true }));
    try {
      await scanVendor(id);
      await load();
    } catch (e) {
      console.error("Scan failed:", e);
    } finally {
      setScanning((s) => ({ ...s, [id]: false }));
    }
  };

  const handleScanAll = async () => {
    setScanAll(true);
    try {
      const current = await getVendors();
      for (const v of current.data) {
        try {
          await scanVendor(v.id);
        } catch (e) {
          console.error(`Scan failed for ${v.name}:`, e);
        }
      }
    } catch (e) {
      console.error("Scan all failed:", e);
    } finally {
      setScanAll(false);
      window.location.reload();
    }
  };

  const high = vendors.filter((v) => v.risk_score >= 70).length;
  const medium = vendors.filter(
    (v) => v.risk_score >= 35 && v.risk_score < 70,
  ).length;
  const low = vendors.filter((v) => v.risk_score < 35).length;

  return (
    <div className="min-h-screen bg-[#0f1117] p-8">
      {/* Demo banner */}
      <div className="mb-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg px-4 py-3 text-yellow-400 text-sm">
        ⚠️ <strong>Demo instance</strong> — this is a shared database for
        portfolio demonstration. Vendors added here are visible to all visitors.
        To use VenderScope privately,{" "}
        <a
          href="https://github.com/darkyzowo/venderscope"
          target="_blank"
          rel="noreferrer"
          className="underline hover:text-yellow-300"
        >
          self-host your own instance
        </a>
        .
      </div>

      {/* Quota banner */}
      <div className="mb-6">
        <QuotaBanner />
      </div>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Vender<span className="text-indigo-400">Scope</span>
            </h1>
            <p className="text-slate-400 mt-1">
              Still running annual vendor audits?{" "}
              <span className="text-indigo-400">
                Your next breach won't wait 12 months.
              </span>
            </p>
          </div>
          <div className="flex gap-3">
            <div className="relative group">
              <button
                onClick={handleScanAll}
                disabled={scanningAll || vendors.length === 0}
                className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm disabled:opacity-50 transition"
              >
                {scanningAll ? "Scanning all..." : "⚡ Scan All"}
              </button>
              <div className="absolute right-0 top-10 w-72 bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded-lg p-3 shadow-lg hidden group-hover:block z-50">
                ⚠️{" "}
                <span className="text-yellow-400 font-semibold">Heads up:</span>{" "}
                Scan All works best with 1–2 vendors on the free tier. Each scan
                hits multiple external APIs sequentially. On Render's free tier,
                scanning 3+ vendors can take 3–5 minutes or time out.{" "}
                <span className="text-indigo-400">
                  Use individual Scan Now buttons for reliable results.
                </span>
              </div>
            </div>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold transition"
            >
              + Add Vendor
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-4 gap-4 mb-10">
          {[
            {
              label: "Total Vendors",
              value: vendors.length,
              color: "text-white",
            },
            { label: "High Risk", value: high, color: "text-red-400" },
            { label: "Medium Risk", value: medium, color: "text-yellow-400" },
            { label: "Low Risk", value: low, color: "text-green-400" },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-[#1a1d27] rounded-xl border border-slate-700 p-5"
            >
              <div className={`text-3xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-slate-400 text-sm mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Vendor grid */}
        {vendors.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-500 text-lg">No vendors yet.</p>
            <p className="text-slate-600 text-sm mt-2">
              Add your first vendor to start monitoring.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {vendors.map((v) => (
              <VendorCard
                key={v.id}
                vendor={v}
                onDelete={handleDelete}
                onScan={handleScan}
                scanning={!!scanning[v.id]}
              />
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <AddVendorModal onAdd={handleAdd} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
}
