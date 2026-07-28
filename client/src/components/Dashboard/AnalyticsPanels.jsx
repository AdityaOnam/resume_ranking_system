import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMissingSkills, getCompanyDemand, getInsights, getDepartmentComparison, getAtsHistory, getVersionComparison } from '../../services/analyticsApi';
import { parseJson, toPercentScore } from '../../utils/scoring';

// 1.1 Placement Readiness Scorecard
export const PlacementReadiness = ({ candidates }) => {
  if (!candidates.length) return null;
  const avgAts = Math.round(candidates.reduce((s, c) => s + (c.ats_score || 0), 0) / candidates.length);
  const eligiblePct = Math.round((candidates.filter(c => parseJson(c.rankings).some(r => r.eligible)).length / candidates.length) * 100);
  const eliteCount = candidates.filter(c => c.ats_score >= 85).length;
  const elitePct = Math.round((eliteCount / candidates.length) * 100);
  const readinessIndex = Math.round((avgAts * 0.4) + (eligiblePct * 0.4) + (elitePct * 0.2));

  const companyElig = {};
  candidates.forEach(c => {
    parseJson(c.rankings).filter(r => r.eligible).forEach(r => {
      const name = r.companyName || (typeof r.company === 'object' ? r.company?.name : r.company) || 'Unknown';
      companyElig[name] = (companyElig[name] || 0) + 1;
    });
  });
  const topHiring = Object.entries(companyElig).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';

  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (readinessIndex / 100) * circumference;

  return (
    <div className="relative rounded-2xl border border-outline-variant bg-surface p-6 overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
      <div className="absolute left-0 top-0 bottom-0 w-32 bg-gradient-to-r from-primary/20 to-transparent pointer-events-none" />
      
      <div className="flex items-center gap-6 z-10">
        <div className="relative w-24 h-24 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r={radius} stroke="#2a2d52" strokeWidth="6" fill="none" />
            <circle cx="40" cy="40" r={radius} stroke="#6c63ff" strokeWidth="6" fill="none" 
              strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} className="transition-all duration-1000" strokeLinecap="round" />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="text-2xl font-bold font-display text-on-surface">{readinessIndex}%</span>
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold text-on-surface tracking-tight">Placement Readiness</h2>
          <p className="text-sm text-on-surface-variant mt-1">Overall cohort health score</p>
        </div>
      </div>

      <div className="flex gap-4 z-10 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
        <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/50 min-w-[120px] text-center">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold mb-1">Elite Candidates</p>
          <p className="text-2xl font-display font-bold text-[#a78bfa]">{eliteCount}</p>
        </div>
        <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/50 min-w-[120px] text-center">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold mb-1">Eligible Students</p>
          <p className="text-2xl font-display font-bold text-secondary">{eligiblePct}%</p>
        </div>
        <div className="bg-surface-container-high rounded-xl p-4 border border-outline-variant/50 min-w-[120px] text-center">
          <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-semibold mb-1">Average ATS</p>
          <p className="text-2xl font-display font-bold text-primary">{avgAts}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 z-10 shrink-0">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-highest border border-outline-variant text-xs text-on-surface">
          <span className="material-symbols-outlined text-[14px] text-[#fbbf24]">code</span>
          Most Needed: <span className="font-semibold text-primary-fixed">Missing Skills</span>
        </div>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-container-highest border border-outline-variant text-xs text-on-surface">
          <span className="material-symbols-outlined text-[14px] text-secondary">business</span>
          Top Hiring: <span className="font-semibold text-primary-fixed">{topHiring}</span>
        </div>
      </div>
    </div>
  );
};

// 1.2 Hiring Funnel
export const HiringFunnel = ({ candidates }) => {
  if (!candidates.length) return null;
  const total = candidates.length;
  const parsed = total;
  const atsAbove70 = candidates.filter(c => c.ats_score >= 70).length;
  const eligibleAny = candidates.filter(c => parseJson(c.rankings).some(r => r.eligible)).length;
  const topMatch = candidates.filter(c => {
    const r = parseJson(c.rankings);
    return r.some(x => toPercentScore(x.score) >= 90);
  }).length;

  const steps = [
    { label: 'Uploaded', count: total, pct: 100, icon: 'cloud_upload' },
    { label: 'Parsed', count: parsed, pct: Math.round((parsed/total)*100), icon: 'document_scanner' },
    { label: 'ATS ≥ 70', count: atsAbove70, pct: Math.round((atsAbove70/total)*100), icon: 'check_circle' },
    { label: 'Eligible ≥1 Company', count: eligibleAny, pct: Math.round((eligibleAny/total)*100), icon: 'how_to_reg' },
    { label: 'Top Match >90%', count: topMatch, pct: Math.round((topMatch/total)*100), icon: 'workspace_premium' },
  ];

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-primary text-[20px]">filter_alt</span>
        <h3 className="text-sm font-semibold text-on-surface">Hiring Funnel</h3>
      </div>
      <div className="flex-1 flex flex-col justify-between gap-3">
        {steps.map((step, i) => {
          const mix = i / (steps.length - 1); // 0 to 1
          const r = Math.round(108 + (34 - 108) * mix);
          const g = Math.round(99 + (197 - 99) * mix);
          const b = Math.round(255 + (94 - 255) * mix);
          const bg = `rgba(${r}, ${g}, ${b}, 0.2)`;
          const border = `rgba(${r}, ${g}, ${b}, 0.4)`;
          const text = `rgb(${r}, ${g}, ${b})`;

          return (
            <div key={i} className="relative flex items-center justify-center w-full">
              <div 
                className="flex items-center justify-between px-4 py-3 rounded-lg border transition-all"
                style={{ width: `${Math.max(40, step.pct)}%`, backgroundColor: bg, borderColor: border }}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: text }}>{step.icon}</span>
                  <span className="text-sm font-medium text-on-surface truncate">{step.label}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 ml-4">
                  <span className="text-lg font-bold font-display text-on-surface">{step.count}</span>
                  <span className="text-xs font-mono px-2 py-1 rounded bg-black/20 text-on-surface-variant">{step.pct}%</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 1.3 Top Skills Distribution
export const TopSkills = ({ candidates }) => {
  const [showTop20, setShowTop20] = useState(false);
  const skillFreq = {};
  candidates.forEach(c => {
    parseJson(c.skills).forEach(skill => {
      const name = typeof skill === 'object' ? skill.name : skill;
      if (name) skillFreq[name] = (skillFreq[name] || 0) + 1;
    });
  });
  const topSkills = Object.entries(skillFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, showTop20 ? 20 : 10)
    .map(([name, count]) => ({ name, count }));

  const maxCount = topSkills[0]?.count || 1;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-[20px]">code</span>
          <h3 className="text-sm font-semibold text-on-surface">Top Skills Distribution</h3>
        </div>
        <button onClick={() => setShowTop20(!showTop20)} className="text-xs text-primary hover:underline">
          {showTop20 ? 'Show Top 10' : 'Show Top 20'}
        </button>
      </div>
      <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2">
        {topSkills.map((s, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="w-24 text-xs text-on-surface-variant truncate text-right" title={s.name}>{s.name}</span>
            <div className="flex-1 h-5 bg-surface-container-highest rounded flex items-center overflow-hidden">
              <div 
                className="h-full rounded-r bg-gradient-to-r from-primary to-[#a78bfa]" 
                style={{ width: `${(s.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="w-8 text-xs font-mono text-on-surface font-semibold text-right">{s.count}</span>
          </div>
        ))}
        {topSkills.length === 0 && <p className="text-xs text-on-surface-variant text-center my-auto">No skills found.</p>}
      </div>
    </div>
  );
};

// 1.4 Candidate Segmentation Donut
export const CandidateSegmentation = ({ candidates }) => {
  const segments = [
    { label: 'Elite', color: '#a78bfa', count: candidates.filter(c => c.ats_score >= 85).length },
    { label: 'Strong', color: '#22c55e', count: candidates.filter(c => c.ats_score >= 70 && c.ats_score < 85).length },
    { label: 'Average', color: '#fbbf24', count: candidates.filter(c => c.ats_score >= 50 && c.ats_score < 70).length },
    { label: 'Weak', color: '#fb7185', count: candidates.filter(c => c.ats_score < 50).length },
  ];
  const total = candidates.length || 1;

  let cumulativePct = 0;
  const radius = 50;
  const circumference = 2 * Math.PI * radius;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 flex flex-col items-center">
      <div className="flex items-center gap-2 w-full mb-4">
        <span className="material-symbols-outlined text-primary text-[20px]">donut_large</span>
        <h3 className="text-sm font-semibold text-on-surface">Candidate Segmentation</h3>
      </div>
      
      <div className="relative w-40 h-40 flex items-center justify-center mb-6 mt-2">
        <svg viewBox="0 0 120 120" className="w-full h-full transform -rotate-90">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="#2a2d52" strokeWidth="12" />
          {segments.map((seg, i) => {
            if (seg.count === 0) return null;
            const pct = seg.count / total;
            const dashArray = `${pct * circumference} ${circumference}`;
            const dashOffset = -(cumulativePct * circumference);
            cumulativePct += pct;
            return (
              <circle key={i} cx="60" cy="60" r={radius} fill="none" stroke={seg.color} strokeWidth="12"
                strokeDasharray={dashArray} strokeDashoffset={dashOffset} className="transition-all duration-500" />
            );
          })}
        </svg>
        <div className="absolute flex flex-col items-center justify-center">
          <span className="text-3xl font-display font-bold text-on-surface">{candidates.length}</span>
          <span className="text-[10px] uppercase tracking-wider text-on-surface-variant">Total</span>
        </div>
      </div>

      <div className="w-full grid grid-cols-2 gap-3">
        {segments.map((seg, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-surface-container-high border border-outline-variant/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-xs text-on-surface-variant">{seg.label}</span>
            </div>
            <span className="text-xs font-mono font-bold text-on-surface">{seg.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 1.5 Company Success Matrix
export const CompanySuccessMatrix = ({ candidates }) => {
  const companyMatrix = {};
  candidates.forEach(c => {
    parseJson(c.rankings).forEach(r => {
      const name = r.companyName || (typeof r.company === 'object' ? r.company?.name : r.company) || 'Unknown';
      if (!companyMatrix[name]) companyMatrix[name] = { eligible: 0, total: 0 };
      companyMatrix[name].total++;
      if (r.eligible) companyMatrix[name].eligible++;
    });
  });
  
  const matrix = Object.entries(companyMatrix)
    .map(([name, d]) => ({ name, ...d, pct: Math.round((d.eligible/Math.max(1, d.total))*100) }))
    .sort((a, b) => a.eligible - b.eligible)
    .slice(0, 15); // limit to top 15 hardest

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-primary text-[20px]">domain_verification</span>
        <h3 className="text-sm font-semibold text-on-surface">Company Success Matrix (Eligibility Rate)</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
        {matrix.map((c, i) => {
          const color = c.pct < 30 ? '#fb7185' : c.pct < 60 ? '#fbbf24' : '#22c55e';
          return (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-on-surface truncate">{c.name}</span>
                <span className="text-xs font-mono text-on-surface-variant">{c.eligible}/{c.total} ({c.pct}%)</span>
              </div>
              <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all" style={{ width: `${c.pct}%`, backgroundColor: color }} />
              </div>
            </div>
          );
        })}
        {matrix.length === 0 && <p className="text-sm text-on-surface-variant">No company data available.</p>}
      </div>
    </div>
  );
};

// 1.6 Company Eligibility Distribution
export const CompanyEligibilityDist = ({ candidates }) => {
  const buckets = { '0': 0, '1–5': 0, '6–10': 0, '10+': 0 };
  candidates.forEach(c => {
    const eligCount = parseJson(c.rankings).filter(r => r.eligible).length;
    if (eligCount === 0) buckets['0']++;
    else if (eligCount <= 5) buckets['1–5']++;
    else if (eligCount <= 10) buckets['6–10']++;
    else buckets['10+']++;
  });
  
  const max = Math.max(...Object.values(buckets), 1);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-primary text-[20px]">stacked_bar_chart</span>
        <h3 className="text-sm font-semibold text-on-surface">Companies per Candidate</h3>
      </div>
      <div className="flex-1 flex items-end justify-around gap-4 pt-4">
        {Object.entries(buckets).map(([label, count]) => (
          <div key={label} className="flex flex-col items-center gap-2 w-full">
            <span className="text-xs font-mono font-bold text-on-surface">{count}</span>
            <div className="w-full max-w-[40px] bg-primary/20 rounded-t relative overflow-hidden" style={{ height: '120px' }}>
              <div className="absolute bottom-0 w-full bg-primary transition-all duration-500 rounded-t" style={{ height: `${(count/max)*100}%` }} />
            </div>
            <span className="text-[10px] text-on-surface-variant mt-1 whitespace-nowrap">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// 1.7 Resume Quality Breakdown
export const ResumeQualityBreakdown = ({ candidates }) => {
  const total = candidates.length || 1;
  const categories = [
    { key: 'contact_info', label: 'Contact Info', max: 15 },
    { key: 'formatting_and_ordering', label: 'Formatting', max: 20 },
    { key: 'quantifiable_metrics', label: 'Quant. Metrics', max: 25 },
    { key: 'action_verbs', label: 'Action Verbs', max: 25 },
    { key: 'keyword_density', label: 'Keyword Density', max: 15 },
  ];

  const issues = categories.map(cat => {
    const failCount = candidates.filter(c => {
      const score = (c.ats_breakdown || {})[cat.key] || 0;
      return score < (cat.max / 2);
    }).length;
    return { ...cat, failCount, failPct: Math.round((failCount/total)*100) };
  }).sort((a, b) => b.failPct - a.failPct);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 flex flex-col h-full">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-error text-[20px]">warning</span>
        <h3 className="text-sm font-semibold text-on-surface">Biggest Resume Weaknesses</h3>
      </div>
      <div className="flex-1 flex flex-col justify-around gap-4">
        {issues.map(cat => (
          <div key={cat.key} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-on-surface">{cat.label}</span>
              <span className="text-on-surface-variant">Failing in <span className="text-error font-mono font-bold">{cat.failPct}%</span></span>
            </div>
            <div className="w-full h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
              <div className="h-full bg-error rounded-full transition-all" style={{ width: `${cat.failPct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// --- PHASE 2 COMPONENTS ---

// 2.1 Missing Skills Analysis
export const MissingSkills = () => {
  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['missingSkills'],
    queryFn: () => getMissingSkills().then(r => r.data)
  });

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-error text-[20px]">warning</span>
        <h3 className="text-sm font-semibold text-on-surface">Most Missing Skills</h3>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant">Loading...</div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 overflow-y-auto pr-2">
          {skills.length === 0 && <p className="text-xs text-on-surface-variant text-center my-auto">No missing skill data.</p>}
          {skills.map((s, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-on-surface font-medium truncate" title={s.skill}>{s.skill}</span>
                <span className="text-on-surface-variant">Missing in <span className="text-error font-mono font-bold">{s.missing_pct}%</span></span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-1.5 bg-surface-container-highest rounded-full overflow-hidden">
                  <div className="h-full bg-error rounded-full transition-all" style={{ width: `${s.missing_pct}%` }} />
                </div>
                <span className="w-24 text-[10px] text-on-surface-variant text-right truncate" title={`Req by ${s.required_by} companies`}>
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

// 2.2 Company Demand
export const CompanyDemand = () => {
  const { data: demand = [], isLoading } = useQuery({
    queryKey: ['companyDemand'],
    queryFn: () => getCompanyDemand().then(r => r.data)
  });

  const maxCount = demand[0]?.count || 1;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-secondary text-[20px]">trending_up</span>
        <h3 className="text-sm font-semibold text-on-surface">What Companies Are Looking For</h3>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant">Loading...</div>
      ) : (
        <div className="flex-1 flex flex-col gap-3 overflow-y-auto pr-2">
          {demand.length === 0 && <p className="text-xs text-on-surface-variant text-center my-auto">No demand data.</p>}
          {demand.map((d, i) => (
            <div key={i} className="flex items-center gap-3">
              <span className="w-24 text-xs text-on-surface-variant truncate text-right" title={d.skill}>{d.skill}</span>
              <div className="flex-1 h-5 bg-surface-container-highest rounded flex items-center overflow-hidden">
                <div 
                  className="h-full rounded-r bg-secondary/80" 
                  style={{ width: `${(d.count / maxCount) * 100}%` }}
                />
              </div>
              <span className="w-6 text-xs font-mono text-on-surface font-semibold text-right">{d.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 2.3 AI Insights Panel
export const AiInsights = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['aiInsights'],
    queryFn: () => getInsights().then(r => r.data)
  });

  const insights = data?.insights || [];

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
        <span className="material-symbols-outlined text-[100px] text-primary">auto_awesome</span>
      </div>
      <div className="flex items-center gap-2 mb-6 relative z-10">
        <span className="material-symbols-outlined text-primary text-[24px]">auto_awesome</span>
        <h3 className="text-lg font-bold text-on-surface font-display">AI Insights</h3>
      </div>
      {isLoading ? (
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-4 bg-primary/20 rounded w-3/4"></div>
          <div className="h-4 bg-primary/20 rounded w-1/2"></div>
          <div className="h-4 bg-primary/20 rounded w-5/6"></div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 relative z-10">
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-3">
              <span className="material-symbols-outlined text-[18px] text-primary mt-0.5 shrink-0">lightbulb</span>
              <p className="text-sm text-on-surface leading-relaxed">{insight}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// 2.4 Department Comparison
export const DepartmentComparison = () => {
  const { data: depts = [], isLoading } = useQuery({
    queryKey: ['deptComparison'],
    queryFn: () => getDepartmentComparison().then(r => r.data)
  });

  // Only show if we have data for more than one department
  if (!isLoading && depts.length <= 1) return null;

  const maxAts = 100;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-primary text-[20px]">school</span>
        <h3 className="text-sm font-semibold text-on-surface">Department Performance</h3>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant">Loading...</div>
      ) : (
        <div className="flex-1 flex flex-col gap-4 justify-around">
          {depts.map((d, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-end">
                <span className="text-sm font-medium text-on-surface truncate" title={d.department}>{d.department}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-on-surface-variant">{d.count} candidates</span>
                  <span className="text-xs font-mono font-bold text-on-surface">{d.avg_ats}</span>
                </div>
              </div>
              <div className="w-full h-2 bg-surface-container-highest rounded-full overflow-hidden">
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(d.avg_ats / maxAts) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// --- PHASE 3 COMPONENTS ---

// 3.1 ATS Trend Chart
export const AtsTrendChart = () => {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['atsHistory'],
    queryFn: () => getAtsHistory().then(r => r.data)
  });

  // Group by week
  const weekly = {};
  history.forEach(item => {
    const d = new Date(item.created_at);
    // Simple grouping by year-week string
    const week = `${d.getFullYear()}-W${Math.ceil(d.getDate() / 7)}`;
    if (!weekly[week]) weekly[week] = { sum: 0, count: 0, label: d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
    weekly[week].sum += item.ats_score;
    weekly[week].count++;
  });

  const chartData = Object.entries(weekly).map(([week, d]) => ({
    week,
    label: d.label,
    avg: Math.round(d.sum / d.count)
  })).slice(-10); // Last 10 weeks

  if (!isLoading && chartData.length < 2) return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 h-full flex flex-col justify-center items-center text-center">
      <span className="material-symbols-outlined text-outline text-3xl mb-2">show_chart</span>
      <p className="text-sm text-on-surface-variant">Not enough data for trend analysis.</p>
    </div>
  );

  const minAvg = Math.min(...chartData.map(d => d.avg)) - 5;
  const maxAvg = Math.max(...chartData.map(d => d.avg)) + 5;
  const range = Math.max(10, maxAvg - minAvg);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-primary text-[20px]">show_chart</span>
        <h3 className="text-sm font-semibold text-on-surface">ATS Score Trend</h3>
      </div>
      {isLoading ? (
        <div className="flex-1 flex items-center justify-center text-sm text-on-surface-variant">Loading...</div>
      ) : (
        <div className="flex-1 relative flex items-end pt-4 pb-6 mt-4 border-b border-l border-outline-variant/30">
          {/* Y Axis marks roughly */}
          <div className="absolute left-[-24px] top-0 text-[9px] text-outline">{maxAvg}</div>
          <div className="absolute left-[-24px] bottom-6 text-[9px] text-outline">{minAvg}</div>
          
          <svg className="absolute inset-0 w-full h-[calc(100%-1.5rem)] overflow-visible" preserveAspectRatio="none">
            <polyline
              points={chartData.map((d, i) => {
                const x = (i / (chartData.length - 1)) * 100;
                const y = 100 - ((d.avg - minAvg) / range) * 100;
                return `${x}%,${y}%`;
              }).join(' ')}
              fill="none"
              stroke="#6c63ff"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
          {chartData.map((d, i) => {
            const x = (i / (chartData.length - 1)) * 100;
            const y = 100 - ((d.avg - minAvg) / range) * 100;
            return (
              <div key={i} className="absolute w-2 h-2 rounded-full bg-primary transform -translate-x-1/2 -translate-y-1/2 group hover:z-20 cursor-pointer"
                style={{ left: `${x}%`, top: `calc(${y}% - 1.5rem)` }}>
                <div className="hidden group-hover:block absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-surface-container-highest text-on-surface text-xs py-1 px-2 rounded font-mono shadow border border-outline-variant z-10 whitespace-nowrap">
                  {d.label}: {d.avg}
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 text-[9px] text-on-surface-variant whitespace-nowrap">
                  {d.label}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// 3.2 Version Comparison
export const VersionComparison = () => {
  const { data: multiVersions = [], isLoading } = useQuery({
    queryKey: ['versionComparison'],
    queryFn: () => getVersionComparison().then(r => r.data)
  });

  if (!isLoading && multiVersions.length === 0) return null;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-6">
      <div className="flex items-center gap-2 mb-6">
        <span className="material-symbols-outlined text-secondary text-[20px]">history</span>
        <h3 className="text-sm font-semibold text-on-surface">Resume Improvement Tracking</h3>
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center text-sm text-on-surface-variant p-4">Loading...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {multiVersions.slice(0, 6).map((c, i) => {
            // Versions are sorted desc from API, so reverse for chronological
            const chronological = [...c.versions].reverse();
            const first = chronological[0].ats_score;
            const last = chronological[chronological.length - 1].ats_score;
            const diff = last - first;
            const isImproving = diff > 0;
            const colorClass = isImproving ? 'text-secondary' : diff < 0 ? 'text-error' : 'text-on-surface-variant';
            const icon = isImproving ? 'trending_up' : diff < 0 ? 'trending_down' : 'trending_flat';

            return (
              <div key={i} className="bg-surface-container-high rounded-lg p-4 border border-outline-variant">
                <p className="text-sm font-medium text-on-surface truncate mb-1">{c.name}</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant font-mono">v1: {first}</span>
                    <span className="material-symbols-outlined text-[14px] text-outline">arrow_forward</span>
                    <span className="text-xs text-on-surface-variant font-mono">v{chronological.length}: {last}</span>
                  </div>
                  <div className={`flex items-center gap-1 ${colorClass}`}>
                    <span className="text-xs font-bold font-mono">{diff > 0 ? '+' : ''}{diff}</span>
                    <span className="material-symbols-outlined text-[14px]">{icon}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
