import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMissingSkills, getCompanyDemand, getInsights, getAtsHistory, getBenchmark } from '../../services/analyticsApi';
import { PiCode, PiChartLineUp, PiSparkle, PiTrendUp } from 'react-icons/pi';

export const MissingSkills = () => {
  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['missingSkills'],
    queryFn: () => getMissingSkills().then(r => r.data)
  });

  return (
    <div className="rounded-xl border border-line bg-surface p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <PiCode className="text-accent" size={20} />
        <h3 className="text-sm font-semibold text-text m-0">Skills that unlock companies</h3>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted">Loading...</div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-4 overflow-y-auto pr-2">
          {skills.length === 0 && <p className="text-xs text-muted text-center my-auto m-0">No missing skill data.</p>}
          {skills.map((s, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-text font-medium truncate" title={s.skill}>{s.skill}</span>
                <span className="text-muted">Missing in <span className="text-error font-mono font-bold">{s.missing_pct}%</span></span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full bg-error rounded-full transition-all" style={{ width: `${s.missing_pct}%` }} />
                </div>
                <span className="w-24 text-[10px] text-muted text-right truncate" title={`Req by ${s.required_by} companies`}>
                  Req by {s.required_by} cos
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const CompanyDemand = () => {
  const { data: demand = [], isLoading } = useQuery({
    queryKey: ['companyDemand'],
    queryFn: () => getCompanyDemand().then(r => r.data)
  });

  const maxCount = demand[0]?.count || 1;

  return (
    <div className="rounded-xl border border-line bg-surface p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <PiChartLineUp className="text-accent" size={20} />
        <h3 className="text-sm font-semibold text-text m-0">Market Signal: Top Requested Skills</h3>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-muted">Loading...</div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-3 overflow-y-auto pr-2">
          {demand.length === 0 && <p className="text-xs text-muted text-center my-auto m-0">No demand data.</p>}
          {demand.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-24 text-xs text-muted truncate text-right" title={d.skill}>{d.skill}</span>
              <div className="flex-1 h-5 bg-surface-2 rounded flex items-center overflow-hidden">
                <div 
                  className="h-full rounded-r bg-accent" 
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-6 text-xs font-mono text-text font-semibold text-right">{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AiInsights = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['aiInsights'],
    queryFn: () => getInsights().then(r => r.data)
  });

  const insights = data?.insights || [];

  return (
    <div className="rounded-xl border border-accent/30 bg-tint p-6 relative overflow-hidden h-full flex flex-col">
      <div className="absolute top-0 right-0 p-8 opacity-[0.03] pointer-events-none">
        <PiSparkle size={100} className="text-accent" weight="fill" />
      </div>
      <div className="flex items-center gap-2 mb-6 relative z-10 shrink-0">
        <PiSparkle className="text-accent" size={24} />
        <h3 className="text-lg font-bold text-text font-display m-0">AI Insights on your latest version</h3>
      </div>
      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-4 bg-accent/20 rounded w-3/4"></div>
          <div className="h-4 bg-accent/20 rounded w-1/2"></div>
          <div className="h-4 bg-accent/20 rounded w-5/6"></div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 flex flex-col gap-4 relative z-10 overflow-y-auto pr-2">
          {insights.length === 0 && <p className="text-sm text-muted m-0 italic">No AI insights generated yet.</p>}
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3">
              <PiSparkle className="text-accent mt-0.5 shrink-0" size={16} />
              <p className="text-[13px] text-text leading-relaxed m-0">{insight}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Chart is drawn in a fixed 520x170 user-space box and stretched to the card
// (same approach as the design reference), so every coordinate below is in
// those units - nothing is positioned against the DOM box, which is what made
// the old version's dots and labels drift off the line and collide.
const VB_W = 520;
const VB_H = 170;
const PLOT_TOP = 14;
const PLOT_BOTTOM = 156;

// Monotone cubic (Fritsch-Carlson) - smooth, but unlike a plain Catmull-Rom
// spline it never overshoots a data point, so the curve can't dip below a score
// the user never actually had.
const smoothPath = (pts) => {
  const n = pts.length;
  if (n === 0) return '';
  if (n === 1) return `M${pts[0].x},${pts[0].y}`;

  const dx = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1].x - pts[i].x;
    m[i] = (pts[i + 1].y - pts[i].y) / dx[i];
  }

  const t = new Array(n);
  t[0] = m[0];
  t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) {
      t[i] = 0; // local extremum - flatten so the curve turns without bulging
    } else {
      const w1 = 2 * dx[i] + dx[i - 1];
      const w2 = dx[i] + 2 * dx[i - 1];
      t[i] = (w1 + w2) / (w1 / m[i - 1] + w2 / m[i]);
    }
  }

  let d = `M${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i].x + h},${pts[i].y + t[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - t[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
};

export const AtsTrendChart = () => {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['atsHistory'],
    queryFn: () => getAtsHistory().then(r => r.data)
  });
  const { data: benchmark } = useQuery({
    queryKey: ['benchmark'],
    queryFn: () => getBenchmark().then(r => r.data),
  });
  const targetScore = benchmark?.overall_top10;

  const chartData = history.map((item, i) => ({
    label: `v${i + 1}`,
    date: new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    score: item.ats_score,
  })).slice(-10); // last 10 versions

  if (isLoading) return (
    <div className="rounded-xl border border-line bg-surface p-6 h-full flex items-center justify-center text-[13px] text-muted">
      Loading...
    </div>
  );

  if (chartData.length < 2) return (
    <div className="rounded-xl border border-line bg-surface p-6 h-full flex flex-col justify-center items-center text-center">
      <PiTrendUp className="text-muted text-3xl mb-2" />
      <p className="text-[13px] text-muted m-0">Upload another version to see your trend.</p>
    </div>
  );

  const values = targetScore != null ? [...chartData.map(d => d.score), targetScore] : chartData.map(d => d.score);
  // Pad the range so a flat-ish run doesn't hug the top or bottom edge, and
  // floor the span at 10 points so tiny score movements aren't magnified into
  // a dramatic-looking swing.
  const lo = Math.max(0, Math.min(...values) - 5);
  const hi = Math.min(100, Math.max(...values) + 5);
  const range = Math.max(10, hi - lo);
  const yFor = (score) => PLOT_BOTTOM - ((score - lo) / range) * (PLOT_BOTTOM - PLOT_TOP);
  const xFor = (i) => (i / (chartData.length - 1)) * VB_W;

  const points = chartData.map((d, i) => ({ x: xFor(i), y: yFor(d.score) }));
  const line = smoothPath(points);
  const area = `${line} L${VB_W},${VB_H} L0,${VB_H} Z`;
  const targetY = targetScore != null ? yFor(targetScore) : null;
  const gridlines = [0, 0.25, 0.5, 0.75, 1].map(f => PLOT_TOP + f * (PLOT_BOTTOM - PLOT_TOP));

  return (
    <div className="rounded-xl border border-line bg-surface p-6 h-full flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-sm font-semibold text-text m-0 flex items-center gap-2">
          <PiTrendUp className="text-accent" size={20} />
          Your score across versions
        </h3>
        <div className="flex items-center gap-3.5 text-[11px] text-muted">
          <span className="flex items-center gap-1.5"><span className="w-3.5 h-0.5 bg-accent" />Your ATS</span>
          {targetScore != null && (
            <span className="flex items-center gap-1.5"><span className="w-3.5 h-0 border-t-2 border-dashed border-muted" />Top 10%</span>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex gap-2">
        <div className="flex flex-col justify-between text-[10px] text-muted font-mono shrink-0 py-[2px]">
          <span>{Math.round(hi)}</span>
          <span>{Math.round(lo)}</span>
        </div>
        <svg className="flex-1 min-w-0 h-full" viewBox={`0 0 ${VB_W} ${VB_H}`} preserveAspectRatio="none">
          <defs>
            <linearGradient id="trendGradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--rr-accent)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--rr-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {gridlines.map((y, i) => (
            <line key={i} x1="0" y1={y} x2={VB_W} y2={y} stroke="var(--rr-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          <path d={area} fill="url(#trendGradient)" />
          {targetY != null && (
            <line
              x1="0" y1={targetY} x2={VB_W} y2={targetY}
              stroke="var(--rr-muted)" strokeWidth="1.6" strokeDasharray="5 4" strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          )}
          <path
            d={line}
            fill="none"
            stroke="var(--rr-accent)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {/* Full-height hit strips give every version a hover readout without
              putting any marker in the layout that could collide. */}
          {chartData.map((d, i) => (
            <rect
              key={i}
              x={xFor(i) - VB_W / (chartData.length * 2)}
              y="0"
              width={VB_W / chartData.length}
              height={VB_H}
              fill="transparent"
            >
              <title>{`${d.label} - ${d.date}: ${d.score}`}</title>
            </rect>
          ))}
        </svg>
      </div>

      <div className="flex justify-between text-[11px] text-muted pl-[26px]">
        {chartData.map((d, i) => <span key={i}>{d.label}</span>)}
      </div>
    </div>
  );
};
