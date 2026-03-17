import { useEffect, useState } from "react";
import axios from "axios";

const api = axios.create({
  baseURL:
    import.meta.env.VITE_API_URL || "https://venderscope-api.onrender.com/api",
});

export default function QuotaBanner() {
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    api
      .get("/quota/")
      .then((r) => setQuota(r.data))
      .catch(() => setQuota(null));
  }, []);

  if (!quota) return null;

  const { full_scans_remaining, remaining, limit, resets_at, exhausted } =
    quota;
  const usedPct = Math.round(((limit - remaining) / limit) * 100);
  const resetTime = new Date(resets_at).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  if (exhausted)
    return (
      <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-3 text-sm">
        <span className="text-red-400 text-base mt-0.5">🚫</span>
        <div>
          <p className="text-red-400 font-semibold">
            Full Intelligence Scans exhausted for today
          </p>
          <p className="text-red-400/70 text-xs mt-0.5">
            All 100 daily Google search quota units have been used. Scans are
            blocked until quota resets at <strong>{resetTime} UTC</strong>.
          </p>
        </div>
      </div>
    );

  const barColor =
    full_scans_remaining <= 1
      ? "bg-red-500"
      : full_scans_remaining <= 3
        ? "bg-yellow-500"
        : "bg-indigo-500";

  return (
    <div className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-4 py-3 text-sm">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span>🔍</span>
          <span className="text-slate-300 font-medium">
            Full Intelligence Scans
          </span>
          <span className="text-xs text-slate-500">
            (includes compliance web search)
          </span>
        </div>
        <div className="text-right">
          <span
            className={`font-bold ${full_scans_remaining <= 1 ? "text-red-400" : full_scans_remaining <= 3 ? "text-yellow-400" : "text-indigo-400"}`}
          >
            {full_scans_remaining}
          </span>
          <span className="text-slate-500 text-xs"> remaining today</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full bg-slate-700/50 rounded-full h-1.5">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${usedPct}%` }}
        />
      </div>

      <div className="flex justify-between mt-1.5">
        <span className="text-slate-600 text-xs">
          {limit - remaining} of {limit} quota units used
        </span>
        <span className="text-slate-600 text-xs">
          Resets at {resetTime} UTC
        </span>
      </div>

      {full_scans_remaining <= 2 && (
        <p className="text-yellow-500/80 text-xs mt-2">
          ⚠️ Running low — Standard Scans (no web search) still available after
          quota is exhausted.
        </p>
      )}
    </div>
  );
}
