import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getResumes, getCompanies } from '../services/api';
import { getAtsHistory, getBenchmark, getMissingSkills } from '../services/analyticsApi';
import { parseJson, toPercentScore } from '../utils/scoring';
import { exportAtsReportPdf } from '../utils/exportPdf';
import { MissingSkills, AiInsights, AtsTrendChart, CompanyDemand } from '../components/Dashboard/AnalyticsPanels';
import {
  PiFiles, PiBuildings,
  PiCaretLeft, PiCaretRight, PiCheckCircle, PiXCircle,
  PiClock, PiArrowRight, PiTarget, PiExport, PiTrendUp, PiWarningCircle
} from 'react-icons/pi';
import { useNavigate } from 'react-router-dom';

// delta is optional - omitted entirely when there's no honest number to show
// (matches the design's KPI strip, which pairs each metric with a small
// up/warning-icon delta badge, rather than fabricating one where the data
// doesn't support it).
// One cell of the KPI strip. The strip itself is a single bordered card whose
// 1px grid gap shows the line colour through as hairline dividers (the design's
// construction) - so cells must not carry their own border or radius.
const KPI = ({ label, value, delta, good, sub }) => (
  <div className="bg-surface px-[18px] py-4 flex flex-col gap-[7px] min-w-0">
    <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted truncate">{label}</span>
    <div className="flex items-baseline gap-2 min-w-0">
      <span className="text-[27px] font-display font-bold text-text leading-none tracking-tight truncate min-w-0" title={String(value)}>{value}</span>
      {delta != null && (
        <span className={`inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] shrink-0 ${good ? 'text-accent-text' : 'text-muted'}`}>
          {good ? <PiTrendUp size={12} /> : <PiWarningCircle size={12} />}
          {delta}
        </span>
      )}
    </div>
    {sub && <span className="text-[11.5px] text-muted leading-tight">{sub}</span>}
  </div>
);

const BenchmarkCard = ({ latestBreakdown }) => {
  const { data: benchmark, isLoading } = useQuery({
    queryKey: ['benchmark'],
    queryFn: () => getBenchmark().then(r => r.data),
  });

  return (
    <div className="rounded-xl border border-line bg-surface p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <PiTarget className="text-accent" size={20} />
        <h3 className="text-sm font-semibold text-text m-0">Category vs. top-decile resumes</h3>
      </div>
      <div className="flex-1 min-h-0 flex flex-col gap-3.5 overflow-y-auto">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-muted">Loading...</div>
        ) : !latestBreakdown || !benchmark ? (
          <div className="flex-1 flex items-center justify-center text-[13px] text-muted italic">No breakdown available.</div>
        ) : (
          Object.entries(benchmark)
            .filter(([key]) => key !== 'overall_top10')
            .map(([key, cat]) => {
              const myScore = latestBreakdown[key] || 0;
              const myPct = (myScore / cat.max) * 100;
              const topPct = (cat.top10 / cat.max) * 100;
              return (
                <div key={key} className="flex flex-col gap-1.5">
                  <div className="flex justify-between items-baseline text-[12.5px]">
                    <span className="text-text">{cat.label}</span>
                    <span className="text-muted">{myScore} / {cat.max}</span>
                  </div>
                  <div className="relative h-2.5">
                    <div className="absolute inset-y-[3px] left-0 right-0 rounded-full bg-surface-2" />
                    <div className="absolute top-[3px] left-0 h-1 rounded-full bg-accent" style={{ width: `${myPct}%` }} />
                    <div className="absolute top-0 w-0.5 h-2.5 rounded-sm bg-muted" style={{ left: `${topPct}%` }} title={`Top 10%: ${cat.top10}`} />
                  </div>
                </div>
              );
            })
        )}
      </div>
      <span className="text-[11.5px] text-muted leading-relaxed mt-3 shrink-0">The tick shows where the top 10% of scored resumes sit.</span>
    </div>
  );
};

const FixNextList = ({ feedback }) => {
  const list = Array.isArray(feedback) ? feedback : [];
  return (
    <div className="rounded-xl border border-line bg-surface p-6 h-full flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 mb-6 shrink-0">
        <PiCheckCircle className="text-accent" size={20} />
        <h3 className="text-sm font-semibold text-text m-0">Fix these next</h3>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto pr-2">
        {list.length === 0 ? (
          <p className="text-[13px] text-muted m-0 italic flex items-center justify-center h-full">No feedback available.</p>
        ) : (
          <ul className="flex flex-col gap-3 m-0 p-0 list-none">
            {list.slice(0, 5).map((f, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-surface-2 text-muted text-[11px] font-bold shrink-0 mt-0.5">
                  {i+1}
                </span>
                <span className="text-[13px] text-text leading-relaxed">{f}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

const UploadHistory = ({ history, selectedIdx, onSelect }) => {
  const navigate = useNavigate();
  const ordered = [...history].reverse(); // newest first for display
  return (
    <div className="rounded-xl border border-line bg-surface flex flex-col overflow-hidden h-full">
      <div className="flex items-center justify-between p-5 border-b border-line bg-surface-2 shrink-0">
        <div className="flex items-center gap-2">
          <PiClock className="text-accent" size={20} />
          <h3 className="text-sm font-semibold text-text m-0">Upload history</h3>
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{history.length} version{history.length === 1 ? '' : 's'}</span>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        <table className="w-full text-left border-collapse">
          <tbody className="divide-y divide-line">
            {ordered.map((h, i) => {
              const isLatest = i === 0;
              const isSelected = selectedIdx === i;
              return (
                <tr
                  key={`${h.resume_id || 'v'}-${h.created_at}`}
                  className={`hover:bg-surface-2 transition-colors cursor-pointer group ${isSelected ? 'bg-tint' : ''}`}
                  onClick={() => {
                    onSelect(i);
                    if (h.resume_id) navigate(`/resumes/${h.resume_id}`);
                  }}
                >
                  <td className="py-3 px-5">
                    <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md bg-surface-2 border border-line text-[11px] font-mono font-medium text-text group-hover:border-accent transition-colors">
                      {isLatest ? 'Latest' : `v${history.length - i}`}
                    </span>
                  </td>
                  <td className="py-3 px-5 text-[13px] text-muted whitespace-nowrap">
                    {new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </td>
                  <td className="py-3 px-5 text-[13px] text-text font-medium truncate max-w-[150px]">
                    {h.original_filename || h.name || `Resume v${history.length - i}`}
                  </td>
                  <td className="py-3 px-5 text-right">
                    <span className={`text-[13px] font-bold font-mono ${h.ats_score >= 70 ? 'text-success' : h.ats_score >= 50 ? 'text-warning' : 'text-error'}`}>
                      {h.ats_score}
                    </span>
                  </td>
                  <td className="py-3 px-5 w-8 text-right text-muted opacity-0 group-hover:opacity-100 transition-opacity">
                    <PiArrowRight size={16} />
                  </td>
                </tr>
              );
            })}
            {history.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[13px] text-muted italic">No uploads found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const ATSDashboard = () => {
  const { data: resumesData, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => getResumes().then(r => r.data),
  });
  // Shares the ['atsHistory'] cache entry with AtsTrendChart - one real network request either way.
  const { data: historyData } = useQuery({
    queryKey: ['atsHistory'],
    queryFn: () => getAtsHistory().then(r => r.data),
  });
  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => getCompanies().then(r => r.data),
  });
  // Shares the ['missingSkills'] cache entry with the MissingSkills panel below.
  const { data: missingSkillsData } = useQuery({
    queryKey: ['missingSkills'],
    queryFn: () => getMissingSkills().then(r => r.data),
  });

  const resumes = Array.isArray(resumesData) ? resumesData : [];
  const latestResume = resumes[0]; // backend sorts by created_at DESC
  // ats_history holds one row per upload event (unlike `resumes`, which holds
  // one row per candidate email and gets overwritten on re-upload), ordered
  // oldest -> newest. It's the real version timeline the switcher and the
  // "since first upload" delta need.
  const history = Array.isArray(historyData) ? historyData : [];
  const companies = Array.isArray(companiesData) ? companiesData : [];
  const missingSkills = Array.isArray(missingSkillsData) ? missingSkillsData : [];

  // Version switcher: index into `orderedHistory` (newest-first). 0 = latest.
  // Only the "Your ATS score" KPI reacts to the selected version - every other
  // section always reflects the latest upload, since ats_history only keeps
  // score + date for older versions (no historical breakdown/skills/rankings
  // snapshot exists to show for them).
  const [selectedVersionIdx, setSelectedVersionIdx] = useState(0);
  const orderedHistory = [...history].reverse();
  const selectedScore = orderedHistory[selectedVersionIdx]?.ats_score ?? latestResume?.ats_score ?? 0;
  const firstEverScore = history[0]?.ats_score;
  const scoreDelta = firstEverScore != null ? selectedScore - firstEverScore : null;

  // Filter state for the All Companies table (derived from latest resume)
  const [tableFilter, setTableFilter] = useState('all'); // all | eligible | blocked
  const [page, setPage] = useState(1);
  const PER_PAGE = 8;

  const latestRankings = parseJson(latestResume?.rankings || '[]').sort((a, b) => {
    const sa = typeof a.score === 'number' ? a.score : parseFloat(a.score) || 0;
    const sb = typeof b.score === 'number' ? b.score : parseFloat(b.score) || 0;
    return sb - sa;
  });

  const filteredRankings = latestRankings.filter(r => {
    if (tableFilter === 'eligible') return r.eligible;
    if (tableFilter === 'blocked') return !r.eligible;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRankings.length / PER_PAGE));
  const pagedRankings = filteredRankings.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  // KPI values, matching the design's 5 metrics - a delta badge is only shown
  // where it's honestly derivable from real data, never a placeholder number.
  const eligibleCount = latestRankings.filter(r => r.eligible).length;
  const blockedCount = latestRankings.length - eligibleCount;
  const bestMatch = latestRankings[0];
  const bestMatchName = bestMatch ? (bestMatch.companyName || (typeof bestMatch.company === 'object' ? bestMatch.company?.name : bestMatch.company)) : null;
  const matchScores = latestRankings.map(r => Math.round(toPercentScore(r.score))).sort((a, b) => a - b);
  const medianMatch = matchScores.length
    ? (matchScores.length % 2 === 1
        ? matchScores[(matchScores.length - 1) / 2]
        : Math.round((matchScores[matchScores.length / 2 - 1] + matchScores[matchScores.length / 2]) / 2))
    : null;

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-bg">
        <span className="text-muted text-[13px]">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-8 py-8 bg-bg">
      <div className="max-w-[1180px] mx-auto flex flex-col gap-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <h2 className="m-0 text-[32px] font-bold text-text tracking-[-0.02em] font-display">Your ATS dashboard</h2>
            <p className="m-0 text-[13.5px] text-muted mt-1.5 flex items-center gap-2">
              {latestResume?.name || 'User'} <span className="w-1 h-1 rounded-full bg-line-strong" />
              {latestResume?.original_filename || latestResume?.name || 'Latest Upload'} <span className="w-1 h-1 rounded-full bg-line-strong" />
              Showing metrics for your profile
            </p>
          </div>
          <div className="flex items-center gap-3">
            {orderedHistory.length > 0 && (
              <div className="flex bg-surface-2 rounded-lg p-1 border border-line">
                {orderedHistory.slice(0, 4).map((h, i) => (
                  <button
                    key={`${h.resume_id || 'v'}-${h.created_at}`}
                    onClick={() => setSelectedVersionIdx(i)}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors border-0 cursor-pointer whitespace-nowrap ${
                      selectedVersionIdx === i ? 'bg-surface text-text shadow-sm' : 'bg-transparent text-muted hover:text-text'
                    }`}
                  >
                    {i === 0 ? 'Latest' : `v${orderedHistory.length - i}`}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={() => exportAtsReportPdf(latestResume)}
              disabled={!latestResume}
              className="flex items-center gap-1.5 h-9 px-3.5 border border-accent rounded-lg bg-transparent text-accent font-sans text-[13px] font-medium hover:bg-tint transition-colors disabled:opacity-40 cursor-pointer"
            >
              <PiExport size={15} />Export report
            </button>
          </div>
        </div>

        {/* KPI Strip - single card, hairline-divided columns (see KPI above).
            Reflows to 2/3/5 columns rather than scrolling sideways, so the last
            metric is never sliced off at the viewport edge. */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-line border border-line rounded-xl overflow-hidden">
          <KPI
            label="Your ATS score"
            value={selectedScore}
            delta={scoreDelta != null ? `${scoreDelta >= 0 ? '+' : ''}${scoreDelta}` : null}
            good={scoreDelta >= 0}
            sub="Since your first upload"
          />
          <KPI
            label="Eligible companies"
            value={companies.length ? `${eligibleCount} of ${companies.length}` : eligibleCount}
            sub={blockedCount > 0 ? `${blockedCount} blocked on requirements` : 'All scored companies'}
          />
          <KPI
            label="Best match"
            value={bestMatchName || '—'}
            delta={bestMatch ? `${Math.round(toPercentScore(bestMatch.score))}%` : null}
            good
            sub={bestMatch?.companyRole}
          />
          <KPI
            label="Median match"
            value={medianMatch != null ? `${medianMatch}%` : '—'}
            sub={latestRankings.length ? `Across all ${latestRankings.length} companies` : undefined}
          />
          <KPI
            label="Missing skills"
            value={missingSkills.length}
            delta={blockedCount > 0 ? `${blockedCount} blocking` : null}
            good={false}
            sub="Named in job descriptions you match"
          />
        </div>

        {resumes.length > 0 ? (
          <>
            {/* 2-col: Trend & Benchmark - 1.35fr/1fr per the design, so the
                chart gets the wider column it was drawn for. */}
            <div className="grid grid-cols-1 lg:grid-cols-[1.35fr_1fr] gap-6 lg:h-[360px]">
              <AtsTrendChart />
              <BenchmarkCard latestBreakdown={latestResume?.ats_breakdown} />
            </div>

            {/* Companies Table */}
            <div className="border border-line bg-surface rounded-xl overflow-hidden shadow-sm">
              <div className="flex items-center justify-between p-5 border-b border-line bg-surface-2">
                <div className="flex items-center gap-2">
                  <PiBuildings className="text-accent" size={20} />
                  <h3 className="text-base font-semibold text-text m-0">All companies</h3>
                </div>
                <div className="flex bg-surface rounded-lg p-1 border border-line">
                  {['all', 'eligible', 'blocked'].map(f => (
                    <button 
                      key={f}
                      onClick={() => { setTableFilter(f); setPage(1); }}
                      className={`px-3 py-1.5 rounded-md text-[11px] font-semibold uppercase tracking-wider transition-colors border-0 cursor-pointer ${
                        tableFilter === f ? 'bg-surface-2 text-text shadow-sm' : 'bg-transparent text-muted hover:text-text'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-muted bg-surface-2">
                      <th className="py-3 px-5">Company</th>
                      <th className="py-3 px-5">Role</th>
                      <th className="py-3 px-5">Your match</th>
                      <th className="py-3 px-5">Status</th>
                      <th className="py-3 px-5">What is holding you back</th>
                    </tr>
                  </thead>
                  <tbody className="text-[13px] divide-y divide-line">
                    {pagedRankings.map((r, i) => {
                      const name = r.companyName || (typeof r.company === 'object' ? r.company?.name : r.company) || '—';
                      const role = r.companyRole || (typeof r.company === 'object' ? r.company?.internship_role : null) || '—';
                      const score = Math.round(toPercentScore(r.score));
                      const blocker = r.eligible ? '—' : (r.eligibility_reasons?.[0] || 'Missing criteria');
                      return (
                        <tr key={i} className="hover:bg-surface-2 transition-colors">
                          <td className="py-3.5 px-5 font-medium text-text">{name}</td>
                          <td className="py-3.5 px-5 text-muted truncate max-w-[160px]">{role}</td>
                          <td className="py-3.5 px-5">
                            <div className="flex items-center gap-3">
                              <span className="w-8 text-right font-mono font-bold text-muted">{score}</span>
                              <div className="w-24 h-1.5 bg-surface rounded-full overflow-hidden border border-line">
                                <div className="h-full bg-accent" style={{ width: `${score}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-5">
                            {r.eligible ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success/10 text-success border border-success/20 text-[11px] font-medium whitespace-nowrap">
                                <PiCheckCircle size={14} weight="fill" /> Eligible
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-error/10 text-error border border-error/20 text-[11px] font-medium whitespace-nowrap">
                                <PiXCircle size={14} weight="fill" /> Blocked
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-5 text-muted truncate max-w-[200px]" title={blocker}>
                            {blocker}
                          </td>
                        </tr>
                      );
                    })}
                    {pagedRankings.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-muted italic">No companies found for this filter.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div className="flex justify-between items-center px-5 py-3 border-t border-line bg-surface-2">
                  <span className="text-[13px] text-muted">
                    Showing {(page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, filteredRankings.length)} of {filteredRankings.length}
                  </span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="w-7 h-7 rounded flex items-center justify-center border border-line bg-surface text-muted disabled:opacity-40 hover:text-text cursor-pointer"><PiCaretLeft /></button>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="w-7 h-7 rounded flex items-center justify-center border border-line bg-surface text-muted disabled:opacity-40 hover:text-text cursor-pointer"><PiCaretRight /></button>
                  </div>
                </div>
              )}
            </div>

            {/* 2-col: Missing Skills & Fix Next */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[320px]">
              <MissingSkills />
              <FixNextList feedback={parseJson(latestResume?.ats_feedback)} />
            </div>

            {/* 2-col: History & Insights */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:h-[320px]">
              <UploadHistory history={history} selectedIdx={selectedVersionIdx} onSelect={setSelectedVersionIdx} />
              <AiInsights />
            </div>

            {/* Bonus */}
            <CompanyDemand />
          </>
        ) : (
          <div className="border border-line border-dashed rounded-xl p-16 flex flex-col items-center justify-center text-center">
            <PiFiles size={48} className="text-muted mb-4 opacity-50" />
            <h3 className="text-lg font-semibold text-text m-0">No resumes uploaded</h3>
            <p className="text-muted mt-2 max-w-[40ch]">Upload a resume to see your personalized ATS dashboard, benchmarking, and market insights.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ATSDashboard;
