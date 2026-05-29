const ICONS = {
  containers: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  alert: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  ),
  humidity: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c-4 6-6 9-6 12a6 6 0 1012 0c0-3-2-6-6-12z" />
    </svg>
  ),
  temp: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 19a3 3 0 106 0M12 3v12" />
    </svg>
  ),
  capacity: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 6h18M6 6v14h12V6M9 10h6" />
    </svg>
  ),
  ai: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M8 13V9a4 4 0 118 0v4" />
    </svg>
  ),
};

const ACCENTS = {
  green: "text-emerald-400 bg-emerald-400/10",
  red: "text-red-400 bg-red-400/10",
  blue: "text-blue-400 bg-blue-400/10",
  amber: "text-amber-400 bg-amber-400/10",
  slate: "text-slate-400 bg-slate-500/10",
  purple: "text-purple-400 bg-purple-400/10",
};

export default function MetricCard({ label, value, subtitle, icon, accent = "green" }) {
  return (
    <div className="card relative overflow-hidden">
      <div className={`absolute top-4 right-4 p-2 rounded-lg ${ACCENTS[accent]}`}>
        {ICONS[icon]}
      </div>
      <p className="text-slate-400 text-sm pr-12">{label}</p>
      <p className="text-3xl font-bold mt-2 tracking-tight">{value}</p>
      {subtitle && <p className="text-slate-500 text-xs mt-2">{subtitle}</p>}
    </div>
  );
}
