import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getResumes, getCompanies } from '../services/api';
import CandidateProfile from './CandidateProfile';
import { parseJson, toPercentScore } from '../utils/scoring';

const Leaderboard = () => {
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [companyId, setCompanyId] = useState('');
  const [companySearch, setCompanySearch] = useState('');

  const { data: resumesData, isLoading } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => getResumes().then(r => r.data),
  });
  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => getCompanies().then(r => r.data),
    initialData: [],
  });

  const candidates = useMemo(() => (Array.isArray(resumesData) ? resumesData : []), [resumesData]);
  const companies = useMemo(() => (Array.isArray(companiesData) ? companiesData : []), [companiesData]);
  const selectedCompany = companies.find(c => c.id === companyId);

  const filteredCompanyOptions = companySearch
    ? companies.filter(c => (c.name || '').toLowerCase().includes(companySearch.toLowerCase()))
    : companies;

  // Two modes:
  // - No company selected: rank every candidate by their single best score
  //   across any company (previous/default behavior).
  // - Company selected: rank only candidates who have a ranking entry for
  //   that specific company, by that company's score - candidates with no
  //   entry for it are omitted entirely rather than shown at 0.
  const rankedCandidates = useMemo(() => {
    if (companyId) {
      return candidates
        .map(candidate => {
          const rankings = parseJson(candidate.rankings);
          const entry = rankings.find(r => {
            const cid = r.company && typeof r.company === 'object' ? (r.company.id || r.company._id) : r.company;
            return String(cid) === String(companyId);
          });
          if (!entry) return null;
          return { ...candidate, topScore: toPercentScore(entry.score), eligible: entry.eligible };
        })
        .filter(Boolean)
        .sort((a, b) => b.topScore - a.topScore);
    }

    return candidates
      .map(candidate => {
        const rankings = parseJson(candidate.rankings);
        const topScore = rankings.length > 0
          ? Math.max(...rankings.map(r => toPercentScore(r.score)))
          : (candidate.ats_score || 0); // fallback
        return { ...candidate, topScore, eligible: undefined };
      })
      .sort((a, b) => b.topScore - a.topScore);
  }, [candidates, companyId]);

  return (
    <div className="flex-1 flex min-w-0 h-full overflow-hidden relative">
      <div className={`flex-1 overflow-y-auto px-6 md:px-8 py-8 transition-all duration-300 ${selectedCandidate ? 'lg:mr-[520px]' : ''}`}>
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          <div>
            <h2 className="text-3xl font-display font-bold text-on-surface tracking-tight">Leaderboard</h2>
            <p className="text-on-surface-variant text-sm mt-1">
              {selectedCompany
                ? `Candidates ranked by their match score for ${selectedCompany.name}`
                : 'Top candidates ranked by their highest company match score'}
            </p>
          </div>

          {/* Company picker */}
          <div className="cyber-panel !p-4 flex flex-col sm:flex-row gap-3 sm:items-center">
            <label className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant shrink-0">Rank for company</label>
            <div className="relative flex-1">
              <input
                type="text"
                list="leaderboard-company-options"
                value={companyId ? selectedCompany?.name || '' : companySearch}
                onChange={e => {
                  const val = e.target.value;
                  setCompanySearch(val);
                  const match = companies.find(c => c.name === val);
                  setCompanyId(match ? match.id : '');
                }}
                placeholder="All companies (best score per candidate)"
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg py-2.5 px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
              />
              <datalist id="leaderboard-company-options">
                {filteredCompanyOptions.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </div>
            {companyId && (
              <button
                onClick={() => { setCompanyId(''); setCompanySearch(''); }}
                className="text-xs text-on-surface-variant hover:text-on-surface px-3 py-2 rounded-lg border border-outline-variant/60 hover:border-outline-variant transition-colors shrink-0"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex flex-col gap-4">
            {isLoading ? (
              <div className="flex justify-center py-20 text-on-surface-variant">
                <span className="material-symbols-outlined text-4xl animate-spin">refresh</span>
              </div>
            ) : rankedCandidates.length === 0 ? (
              <div className="py-20 text-center text-on-surface-variant">
                <p className="text-sm">
                  {companyId ? 'No candidates have been ranked for this company yet.' : 'No candidates available'}
                </p>
              </div>
            ) : (
              rankedCandidates.map((candidate, idx) => {
                const isSelected = selectedCandidate?.id === candidate.id;
                const skills = parseJson(candidate.skills);

                return (
                  <div
                    key={candidate.id}
                    onClick={() => setSelectedCandidate(isSelected ? null : candidate)}
                    className={`card card-hover p-4 flex items-center gap-6 cursor-pointer transition-colors ${
                      isSelected ? 'ring-2 ring-primary bg-primary/[0.04]' : ''
                    }`}
                  >
                    <div className="w-10 h-10 shrink-0 flex items-center justify-center font-display font-bold text-lg rounded-full bg-surface-container-highest text-on-surface">
                      #{idx + 1}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-base font-semibold text-on-surface truncate">{candidate.name || 'Unknown Candidate'}</h4>
                        {candidate.eligible === false && <span className="score-badge-low shrink-0">Not Eligible</span>}
                        {candidate.eligible === true && <span className="score-badge-high shrink-0">Eligible</span>}
                      </div>
                      <div className="text-xs text-on-surface-variant font-mono truncate mt-0.5">{candidate.email || 'No email provided'}</div>
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {skills.slice(0, 3).map((skill, i) => (
                          <span key={i} className="px-2 py-0.5 rounded text-[10px] font-mono bg-surface-variant border border-outline-variant/40 text-on-surface-variant">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-col items-end">
                      <div className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-1">
                        {companyId ? 'Match' : 'Top Match'}
                      </div>
                      <div className="text-2xl font-bold text-primary">{candidate.topScore.toFixed(1)}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

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

export default Leaderboard;
