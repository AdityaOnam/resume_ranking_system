import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import CandidateProfile from './CandidateProfile';
import { getResumes } from '../services/api';
import { parseJson } from '../utils/scoring';
import {
  PlacementReadiness,
  HiringFunnel,
  TopSkills,
  CandidateSegmentation,
  CompanySuccessMatrix,
  CompanyEligibilityDist,
  ResumeQualityBreakdown,
  MissingSkills,
  CompanyDemand,
  AiInsights,
  DepartmentComparison,
  AtsTrendChart,
  VersionComparison
} from '../components/Dashboard/AnalyticsPanels';

const getTier = (score) => {
  if (score >= 85) return { label: 'Elite', color: 'text-[#a78bfa]', bg: 'bg-[#a78bfa]/10 border-[#a78bfa]/30' };
  if (score >= 70) return { label: 'Strong', color: 'text-secondary', bg: 'bg-secondary/10 border-secondary/30' };
  if (score >= 50) return { label: 'Average', color: 'text-[#fbbf24]', bg: 'bg-[#fbbf24]/10 border-[#fbbf24]/30' };
  return { label: 'Weak', color: 'text-[#fb7185]', bg: 'bg-[#fb7185]/10 border-[#fb7185]/30' };
};

const ScoreBar = ({ score }) => {
  const { color } = getTier(score);
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-1.5 rounded-full bg-surface-variant/60 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            score >= 85 ? 'bg-[#a78bfa]' : score >= 70 ? 'bg-secondary' : score >= 50 ? 'bg-[#fbbf24]' : 'bg-[#fb7185]'
          }`}
          style={{ width: `${Math.min(score, 100)}%` }}
        />
      </div>
      <span className={`text-xs font-mono font-bold ${color}`}>{score}</span>
    </div>
  );
};

const TierBadge = ({ score }) => {
  const { label, color, bg } = getTier(score);
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${bg} ${color}`}>
      {label}
    </span>
  );
};

const SkillBadge = ({ skill, highlighted }) => (
  <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${
    highlighted
      ? 'bg-primary/15 border border-primary/30 text-primary-fixed-dim'
      : 'bg-surface-variant border border-outline-variant/40 text-on-surface-variant'
  }`}>
    {skill}
  </span>
);

// --- Summary stat card ---
const StatCard = ({ icon, label, value, sub, accent }) => (
  <div className="rounded-xl border border-outline-variant bg-surface p-5 flex items-start gap-4 hover:border-primary/30 transition-colors">
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${accent || 'bg-primary/10'}`}>
      <span className="material-symbols-outlined text-[20px] text-primary">{icon}</span>
    </div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">{label}</p>
      <p className="text-2xl font-bold text-on-surface font-display">{value}</p>
      {sub && <p className="text-xs text-on-surface-variant mt-0.5">{sub}</p>}
    </div>
  </div>
);

// --- Inline mini bar chart for score distribution ---
const DistributionChart = ({ candidates }) => {
  const buckets = [
    { label: 'Weak', range: '0–50', color: '#fb7185', count: 0 },
    { label: 'Average', range: '50–70', color: '#fbbf24', count: 0 },
    { label: 'Strong', range: '70–85', color: '#34d399', count: 0 },
    { label: 'Elite', range: '85+', color: '#a78bfa', count: 0 },
  ];

  candidates.forEach(c => {
    const s = c.ats_score || 0;
    if (s >= 85) buckets[3].count++;
    else if (s >= 70) buckets[2].count++;
    else if (s >= 50) buckets[1].count++;
    else buckets[0].count++;
  });

  const max = Math.max(...buckets.map(b => b.count), 1);

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="material-symbols-outlined text-primary text-[20px]">bar_chart</span>
        <h3 className="text-sm font-semibold text-on-surface">ATS Score Distribution</h3>
      </div>
      <div className="flex items-end gap-3 h-24">
        {buckets.map((b) => (
          <div key={b.label} className="flex-1 flex flex-col items-center gap-1.5">
            <span className="text-xs font-bold font-mono" style={{ color: b.color }}>{b.count}</span>
            <div className="w-full rounded-t" style={{
              height: `${(b.count / max) * 72}px`,
              minHeight: b.count > 0 ? '4px' : '2px',
              background: b.count > 0 ? b.color : 'rgba(255,255,255,0.05)',
            }} />
            <span className="text-[10px] text-on-surface-variant text-center leading-tight">{b.label}</span>
            <span className="text-[9px] text-outline font-mono">{b.range}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const ATSDashboard = () => {
  const { data: resumesData, isLoading: loading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => getResumes().then(r => r.data),
  });
  const candidates = Array.isArray(resumesData) ? resumesData : [];

  const [search, setSearch] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => { setPage(1); }, [search]);

  // Derived stats
  const avgAts = candidates.length
    ? Math.round(candidates.reduce((s, c) => s + (c.ats_score || 0), 0) / candidates.length)
    : 0;
  const bestAts = candidates.length ? Math.max(...candidates.map(c => c.ats_score || 0)) : 0;
  const eligibleCount = candidates.filter(c => {
    const r = parseJson(c.rankings);
    return r.some(x => x.eligible);
  }).length;

  const filtered = candidates.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden relative">
      {/* Main content */}
      <div className={`flex-1 overflow-y-auto px-6 md:px-8 py-8 transition-all duration-300 ${selectedCandidate ? 'lg:mr-[520px]' : ''}`}>
        <div className="max-w-6xl mx-auto flex flex-col gap-6">

          {/* Page header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-3xl font-bold text-on-surface tracking-tight">ATS Dashboard</h2>
              <p className="text-on-surface-variant text-sm mt-1">Analytics and scoring overview for all uploaded resumes</p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-80 group">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[20px] group-focus-within:text-primary transition-colors">search</span>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search candidates..."
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-surface-container-high border border-outline-variant text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all"
                />
              </div>
            </div>
          </div>

          {/* Placement Readiness Banner */}
          {!loading && candidates.length > 0 && (
            <PlacementReadiness candidates={candidates} />
          )}

          {/* Summary stat cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon="description" label="Total Resumes" value={loading ? '—' : candidates.length} sub="All uploads" />
            <StatCard icon="query_stats" label="Avg ATS Score" value={loading ? '—' : avgAts} sub="Across all resumes" accent="bg-secondary/10" />
            <StatCard icon="workspace_premium" label="Best ATS Score" value={loading ? '—' : bestAts} sub="Highest recorded" accent="bg-[#a78bfa]/10" />
            <StatCard icon="check_circle" label="Eligible" value={loading ? '—' : eligibleCount} sub="For ≥1 company" accent="bg-[#34d399]/10" />
          </div>

          {!loading && candidates.length > 0 && (
            <>
              {/* Analytics Row 1: Funnel & Skills */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <HiringFunnel candidates={candidates} />
                <TopSkills candidates={candidates} />
              </div>

              {/* Analytics Row 2: Segmentation, Eligibility Dist, Quality Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CandidateSegmentation candidates={candidates} />
                <CompanyEligibilityDist candidates={candidates} />
                <ResumeQualityBreakdown candidates={candidates} />
              </div>
            </>
          )}

          {/* Score distribution chart */}
          {!loading && candidates.length > 0 && (
            <>
              <DistributionChart candidates={candidates} />
              <CompanySuccessMatrix candidates={candidates} />
              
              {/* Analytics Row 3: Missing Skills & Company Demand */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <MissingSkills />
                <CompanyDemand />
              </div>
              
              {/* AI Insights Panel */}
              <AiInsights />
              
              {/* Analytics Row 4: Department Comparison & ATS Trend */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <DepartmentComparison />
                <AtsTrendChart />
              </div>

              {/* Analytics Row 5: Version Comparison */}
              <VersionComparison />
            </>
          )}

          {/* Table card */}
          <div className="rounded-xl overflow-hidden border border-outline-variant bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-outline-variant text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container-high/50">
                    <th className="py-4 px-4 w-10"></th>
                    <th className="py-4 px-4">Name</th>
                    <th className="py-4 px-4">Skills</th>
                    <th className="py-4 px-4">ATS Score</th>
                    <th className="py-4 px-4">Tier</th>
                    <th className="py-4 px-4">Top Match</th>
                    <th className="py-4 px-4 text-center">Ranked For</th>
                    <th className="py-4 px-4 text-right">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          {[1,2,3,4,5,6,7,8].map(j => (
                            <td key={j} className="py-4 px-4">
                              <div className="h-3.5 rounded animate-pulse bg-surface-container-highest" style={{ width: `${50 + j * 6}%` }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : filtered.length === 0
                    ? (
                        <tr>
                          <td colSpan={8} className="py-20 text-center text-on-surface-variant">
                            <span className="material-symbols-outlined text-[52px] block mb-3 text-outline">person_search</span>
                            <p className="text-sm">No candidates found</p>
                          </td>
                        </tr>
                      )
                    : pageRows.map((candidate) => {
                        const skills = parseJson(candidate.skills);
                        const rankings = parseJson(candidate.rankings);
                        const atsScore = candidate.ats_score || 0;

                        // Top eligible match by score
                        const sorted = [...rankings].sort((a, b) => {
                          const sa = typeof a.score === 'number' ? a.score : parseFloat(a.score) || 0;
                          const sb = typeof b.score === 'number' ? b.score : parseFloat(b.score) || 0;
                          return sb - sa;
                        });
                        const topMatch = sorted.find(r => r.eligible) || sorted[0];
                        const topName = topMatch
                          ? (topMatch.companyName || (typeof topMatch.company === 'object' ? topMatch.company?.name : topMatch.company) || '—')
                          : '—';

                        const isSelected = selectedCandidate?.id === candidate.id;

                        return (
                          <tr key={candidate.id}
                            onClick={() => setSelectedCandidate(isSelected ? null : candidate)}
                            className={`cursor-pointer group transition-colors ${
                              isSelected ? 'bg-primary/[0.07]' : 'hover:bg-primary/[0.04]'
                            }`}>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`material-symbols-outlined text-[18px] transition-colors ${isSelected ? 'text-primary' : 'text-outline group-hover:text-primary'}`}>
                                chevron_right
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <p className="font-medium text-on-surface text-sm">{candidate.name || '—'}</p>
                              <p className="text-[11px] font-mono text-on-surface-variant mt-0.5">{candidate.email || ''}</p>
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex gap-1.5 flex-wrap">
                                {skills.slice(0, 3).map((skill, i) => {
                                  const name = typeof skill === 'object' ? skill.name : skill;
                                  return <SkillBadge key={i} skill={name} highlighted={i === 0} />;
                                })}
                                {skills.length > 3 && (
                                  <span className="px-2 py-1 rounded-full text-[10px] bg-surface-container-highest border border-outline-variant text-on-surface-variant">
                                    +{skills.length - 3}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4">
                              <ScoreBar score={atsScore} />
                            </td>
                            <td className="py-3.5 px-4">
                              <TierBadge score={atsScore} />
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-sm text-on-surface truncate max-w-[140px] block">{topName}</span>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              <span className="text-sm text-on-surface">{rankings.length}</span>
                            </td>
                            <td className="py-3.5 px-4 text-right font-mono text-[11px] text-outline">
                              {candidate.created_at
                                ? new Date(candidate.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
                                : '—'}
                            </td>
                          </tr>
                        );
                      })}
                </tbody>
              </table>
            </div>

            {/* Table Footer */}
            <div className="border-t border-outline-variant px-6 py-4 flex justify-between items-center bg-surface-container-high/30">
              <span className="font-mono text-[11px] text-outline">
                Page {page} of {totalPages} — {filtered.length} of {candidates.length} resumes
              </span>
              <div className="flex gap-1.5">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  return (
                    <button key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg text-[11px] font-mono font-bold transition-colors border ${
                        p === page
                          ? 'bg-primary text-white border-primary'
                          : 'bg-surface-container-high border-outline-variant/40 text-on-surface-variant hover:text-on-surface'
                      }`}>
                      {p}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Slide-out Profile Panel */}
      {selectedCandidate && (
        <div className="absolute top-0 right-0 h-full w-full lg:w-[520px] z-20 flex flex-col overflow-y-auto border-l border-outline-variant bg-background"
          style={{ boxShadow: '-12px 0 48px rgba(0,0,0,0.6)' }}>
          <CandidateProfile
            candidate={selectedCandidate}
            onClose={() => setSelectedCandidate(null)}
          />
        </div>
      )}
    </div>
  );
};

export default ATSDashboard;
