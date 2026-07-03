import React, { useState, useEffect } from 'react';
import CandidateProfile from './CandidateProfile';

const SkillBadge = ({ skill, highlighted }) => (
  <span className={`px-2 py-0.5 rounded text-[11px] font-mono ${
    highlighted
      ? 'bg-primary/15 border border-primary/30 text-primary-fixed-dim'
      : 'bg-surface-variant border border-outline-variant/40 text-on-surface-variant'
  }`}>
    {skill}
  </span>
);

const ScoreBadge = ({ score }) => {
  const num = parseFloat(score) || 0;
  const cls = num >= 85 ? 'score-badge-high' : num >= 70 ? 'score-badge-mid' : 'score-badge-low';
  return <span className={cls}>{num.toFixed(1)}</span>;
};

const parseJson = (data) => {
  if (!data) return [];
  if (typeof data === 'string') {
    try { const p = JSON.parse(data); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return Array.isArray(data) ? data : [];
};

const ATSDashboard = () => {
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState(null);

  useEffect(() => {
    const fetchResumes = async () => {
      try {
        const res = await fetch('http://127.0.0.1:5000/api/resumes/');
        const data = await res.json();
        setCandidates(Array.isArray(data) ? data : []);
      } catch (e) {
        console.error('Failed to fetch resumes:', e);
      } finally {
        setLoading(false);
      }
    };
    fetchResumes();
  }, []);

  const filtered = candidates.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden relative">
      {/* Main table area — shifts left when panel open */}
      <div className={`flex-1 overflow-y-auto px-6 md:px-8 py-8 transition-all duration-300 ${selectedCandidate ? 'lg:mr-[520px]' : ''}`}>
        <div className="max-w-6xl mx-auto flex flex-col gap-6">
          {/* Page header */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
            <div>
              <h2 className="text-3xl font-bold text-on-surface tracking-tight">Candidate Pipeline</h2>
              <p className="text-on-surface-variant text-sm mt-1">Manage and review all uploaded candidates</p>
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
              <button className="btn-ghost">
                <span className="material-symbols-outlined text-[18px]">filter_list</span>
                Filters
              </button>
            </div>
          </div>

          {/* Table card */}
          <div className="rounded-xl overflow-hidden border border-outline-variant bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse whitespace-nowrap">
                <thead>
                  <tr className="border-b border-outline-variant text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-container-high/50">
                    <th className="py-4 px-4 w-10"></th>
                    <th className="py-4 px-4">Name</th>
                    <th className="py-4 px-4">Email</th>
                    <th className="py-4 px-4">Skills</th>
                    <th className="py-4 px-4 text-center">AI Score</th>
                    <th className="py-4 px-4 text-center">Ranked For</th>
                    <th className="py-4 px-4 text-right">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant/40">
                  {loading
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i}>
                          {[1,2,3,4,5,6,7].map(j => (
                            <td key={j} className="py-4 px-4">
                              <div className="h-3.5 rounded animate-pulse bg-surface-container-highest" style={{ width: `${50 + j * 7}%` }} />
                            </td>
                          ))}
                        </tr>
                      ))
                    : filtered.length === 0
                    ? (
                        <tr>
                          <td colSpan={7} className="py-20 text-center text-on-surface-variant">
                            <span className="material-symbols-outlined text-[52px] block mb-3 text-outline">person_search</span>
                            <p className="text-sm">No candidates found</p>
                          </td>
                        </tr>
                      )
                    : filtered.map((candidate) => {
                        const skills = parseJson(candidate.skills);
                        const rankings = parseJson(candidate.rankings);
                        const topScore = rankings.length > 0
                          ? Math.max(...rankings.map(r => typeof r.score === 'number' ? r.score * 100 : parseFloat(r.score) || 0))
                          : null;
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
                            <td className="py-3.5 px-4 font-medium text-on-surface text-sm">
                              {candidate.name || '—'}
                            </td>
                            <td className="py-3.5 px-4 font-mono text-xs text-on-surface-variant">
                              {candidate.email || '—'}
                            </td>
                            <td className="py-3.5 px-4">
                              <div className="flex gap-1.5 flex-wrap">
                                {skills.slice(0, 3).map((skill, i) => (
                                  <SkillBadge key={i} skill={skill} highlighted={i === 0} />
                                ))}
                                {skills.length > 3 && (
                                  <span className="px-2 py-1 rounded-full text-[10px] bg-surface-container-highest border border-outline-variant text-on-surface-variant">
                                    +{skills.length - 3}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-center">
                              {topScore !== null
                                ? <ScoreBadge score={topScore} />
                                : <span className="text-outline text-xs">—</span>
                              }
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
                {filtered.length} of {candidates.length} candidates
              </span>
              <div className="flex gap-1.5">
                {[1, 2, 3].map(p => (
                  <button key={p}
                    className={`w-8 h-8 rounded-lg text-[11px] font-mono font-bold transition-colors border ${
                      p === 1
                        ? 'bg-primary text-white border-primary'
                        : 'bg-surface-container-high border-outline-variant/40 text-on-surface-variant hover:text-on-surface'
                    }`}>
                    {p}
                  </button>
                ))}
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
