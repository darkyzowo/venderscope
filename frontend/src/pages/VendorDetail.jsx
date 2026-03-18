import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getVendors,
  getVendorEvents,
  getScoreHistory,
  scanVendor,
} from "../api/client";
import api from "../api/client";
import ScoreChart from "../components/ScoreChart";
import EventFeed from "../components/EventFeed";
import CompliancePanel from "../components/CompliancePanel";
import QuotaBanner from "../components/QuotaBanner";

const SEVERITY_ORDER = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const EVENTS_SHOWN = 10;

const parseEPSS = (desc) => {
  const m = desc?.match(/\[EPSS: ([\d.]+)%/);
  return m ? parseFloat(m[1]) : 0;
};

const sortEvents = (evts) =>
  [...evts].sort((a, b) => {
    const sevDiff =
      (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4);
    if (sevDiff !== 0) return sevDiff;
    return parseEPSS(b.description) - parseEPSS(a.description);
  });

export default function VendorDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [vendor, setVendor] = useState(null);
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [scanning, setScan] = useState(false);
  const [quotaExhausted, setQuotaEx] = useState(false);

  const fetchData = async () => {
    const [vRes, eRes, hRes] = await Promise.all([
      getVendors(),
      getVendorEvents(id),
      getScoreHistory(id),
    ]);
    setVendor(vRes.data.find((v) => v.id === parseInt(id)));
    setEvents(sortEvents(eRes.data));
    setHistory(hRes.data);
  };

  useEffect(() => {
    const load = async () => {
      const [vRes, eRes, hRes] = await Promise.all([
        getVendors(),
        getVendorEvents(id),
        getScoreHistory(id),
      ]);
      setVendor(vRes.data.find((v) => v.id === parseInt(id)));
      setEvents(sortEvents(eRes.data));
      setHistory(hRes.data);
    };
    load();
    // Check quota on mount so scan button reflects current state
    api
      .get("/quota")
      .then((r) => setQuotaEx(r.data.exhausted))
      .catch(() => {});
  }, [id]);

  const handleScan = async () => {
    setScan(true);
    try {
      await scanVendor(id);
      await fetchData();
      // Refresh quota state after scan
      api
        .get("/quota/")
        .then((r) => setQuotaEx(r.data.exhausted))
        .catch(() => {});
    } catch (e) {
      console.error("Scan failed:", e);
    } finally {
      setScan(false);
    }
  };

  if (!vendor)
    return (
      <div className="min-h-screen bg-[#0f1117] flex items-center justify-center">
        <p className="text-slate-500">Loading...</p>
      </div>
    );

  const scoreColor =
    vendor.risk_score >= 70
      ? "text-red-400"
      : vendor.risk_score >= 35
        ? "text-yellow-400"
        : "text-green-400";
  const displayedEvents = events.slice(0, EVENTS_SHOWN);
  const hiddenCount = events.length - EVENTS_SHOWN;
  const apiBase =
    import.meta.env.VITE_API_URL || "https://venderscope-api.onrender.com/api";

  return (
    <div className="min-h-screen bg-[#0f1117] p-8">
      <div className="max-w-5xl mx-auto">
        {/* Back */}
        <button
          onClick={() => nav("/")}
          className="text-slate-400 hover:text-white text-sm mb-6 transition"
        >
          ← Back to Dashboard
        </button>

        {/* Quota banner */}
        <div className="mb-6">
          <QuotaBanner />
        </div>

        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">{vendor.name}</h1>
            <p className="text-slate-400 mt-1">{vendor.domain}</p>
            {vendor.company_number && (
              <p className="text-slate-500 text-sm mt-1">
                Companies House: {vendor.company_number}
              </p>
            )}
          </div>
          <div className="text-right">
            <div className={`text-5xl font-bold ${scoreColor}`}>
              {vendor.risk_score}
            </div>
            <div className="text-slate-400 text-sm mt-1">Risk Score</div>
            <div className="group relative mt-1">
              <span className="text-xs text-slate-500 cursor-help border-b border-dotted border-slate-600">
                How is this calculated?
              </span>
              <div className="absolute right-0 top-5 w-72 bg-slate-800 border border-slate-600 text-slate-300 text-xs rounded-lg p-3 shadow-lg hidden group-hover:block z-50">
                This score is estimated from the{" "}
                <strong className="text-white">top 10 most recent CVEs</strong>{" "}
                detected via NVD, plus breach data from HIBP, Companies House
                signals, and Shodan exposure. Each event is weighted by severity
                (CRITICAL=25, HIGH=15, MEDIUM=7, LOW=2), capped at 100.{" "}
                <span className="text-indigo-400">
                  The full PDF export contains all detected events for a
                  complete picture.
                </span>
              </div>
            </div>

            {/* Scan button — disabled and labelled when quota exhausted */}
            <button
              onClick={handleScan}
              disabled={scanning || quotaExhausted}
              title={
                quotaExhausted
                  ? "Daily scan quota exhausted — resets at midnight UTC"
                  : ""
              }
              className={`mt-3 px-4 py-2 rounded-lg text-white text-sm transition block w-full
                ${
                  quotaExhausted
                    ? "bg-slate-700 opacity-40 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50"
                }`}
            >
              {scanning
                ? "Scanning..."
                : quotaExhausted
                  ? "Quota Exhausted"
                  : "Scan Now"}
            </button>

            <a
              href={`${apiBase}/export/${id}/pdf`}
              target="_blank"
              rel="noreferrer"
              className="mt-2 block px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm text-center transition"
            >
              Export PDF Report
            </a>
            {hiddenCount > 0 && (
              <p className="text-xs text-slate-500 mt-2">
                PDF includes {hiddenCount} more event
                {hiddenCount > 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Score Drift Chart */}
        <div className="mb-8">
          <ScoreChart history={history} />
        </div>

        {/* Compliance Posture */}
        <div className="bg-[#1a1d27] rounded-xl border border-slate-700 p-6 mb-8">
          <h3 className="text-white font-semibold mb-4">
            Compliance Posture
            <span className="text-slate-500 font-normal text-sm ml-2">
              (auto-discovered from public sources)
            </span>
          </h3>
          <CompliancePanel compliance={vendor.compliance} />
        </div>

        {/* Risk Events */}
        <div className="bg-[#1a1d27] rounded-xl border border-slate-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white font-semibold">
              Risk Events{" "}
              <span className="text-slate-500 font-normal text-sm">
                (top {displayedEvents.length} by severity · {events.length}{" "}
                total in PDF)
              </span>
            </h3>
            {hiddenCount > 0 && (
              <span className="text-xs text-indigo-400 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full">
                📄 +{hiddenCount} more in PDF
              </span>
            )}
          </div>
          <EventFeed events={displayedEvents} />
        </div>
      </div>
    </div>
  );
}
