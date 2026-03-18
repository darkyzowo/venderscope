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
      <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-1.5 text-xs text-red-400">
        <span>🚫</span>
        <span className="font-medium">Full scans exhausted</span>
        <span className="text-red-400/50">·</span>
        <span className="text-red-400/70">Resets at {resetTime} UTC · Standard scans still available</span>
      </div>
    );

  const barColor =
    full_scans_remaining <= 1
      ? "bg-red-500"
      : full_scans_remaining <= 3
        ? "bg-yellow-500"
        : "bg-indigo-500";

  const countColor =
    full_scans_remaining <= 1
      ? "text-red-400"
      : full_scans_remaining <= 3
        ? "text-yellow-400"
        : "text-indigo-400";

  return (
    <div className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/40 rounded-md px-3 py-1.5 text-xs">
      <span className="text-slate-400">🔍</span>
      <span className="text-slate-400 font-medium whitespace-nowrap">Full scans</span>
      <div className="flex-1 bg-slate-700/50 rounded-full h-1">
        <div className={`h-1 rounded-full transition-all ${barColor}`} style={{ width: `${usedPct}%` }} />
      </div>
      <span className="text-slate-500 whitespace-nowrap">{limit - remaining}/{limit} units</span>
      <span className="text-slate-600">·</span>
      <span className={`font-semibold whitespace-nowrap ${countColor}`}>{full_scans_remaining} left</span>
      <span className="text-slate-600">·</span>
      <span className="text-slate-500 whitespace-nowrap">resets {resetTime} UTC</span>
      {full_scans_remaining <= 2 && (
        <>
          <span className="text-slate-600">·</span>
          <span className="text-yellow-500/80 whitespace-nowrap">⚠️ running low</span>
        </>
      )}
    </div>
  );
}
