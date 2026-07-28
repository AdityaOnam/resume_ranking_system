import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ATSScoreCard from '../components/ATS/ATSScoreCard';
import ScoreBreakdown from '../components/CompanyMatch/ScoreBreakdown';
import SkillGapTable from '../components/CompanyMatch/SkillGapTable';
import { deleteResume } from '../services/api';
import { parseJson, toPercentScore } from '../utils/scoring';

const parseSkill = (raw) => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === 'object') return parsed;
      } catch {
        // not JSON — treat as a plain skill name
      }
    }
    return { name: raw };
  }
  return null;
};

const dedupeSkills = (skills) => {
  const byName = new Map();
  for (const skill of skills) {
    const name = (skill.name || '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const existing = byName.get(key);
    if (!existing || (skill.confidence || 0) > (existing.confidence || 0)) {
      byName.set(key, skill);
    }
  }
  return [...byName.values()].sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
};

const QuickStat = ({ icon, label, value }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-surface-variant/60 flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-[18px] text-primary">{icon}</span>
    </div>
    <div className="min-w-0">
      <p className="text-[11px] text-on-surface-variant uppercase tracking-wider">{label}</p>
      <p className="text-sm font-medium text-on-surface truncate">{value}</p>
    </div>
  </div>
);

const TABS = ['Experience', 'Education', 'Projects'];

const CandidateProfile = ({ candidate, onClose }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('Experience');
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [expandedRanking, setExpandedRanking] = useState(null);

  const deleteMutation = useMutation({
    mutationFn: () => deleteResume(candidate.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['resumes'] });
      queryClient.removeQueries({ queryKey: ['resume', candidate.id] });
      if (onClose) onClose(); else navigate('/');
    },
    onError: (err) => {
      alert('Failed to delete resume: ' + (err.response?.data?.detail || err.message));
    },
  });

  const handleDelete = () => {
    if (window.confirm(`Delete ${candidate?.name || 'this resume'}? This cannot be undone.`)) {
      deleteMutation.mutate();
    }
  };

  const skills = useMemo(
    () => dedupeSkills(parseJson(candidate?.skills).map(parseSkill).filter(Boolean)),
    [candidate]
  );
  const rankings = useMemo(() => {
    const list = parseJson(candidate?.rankings);
    return [...list].sort((a, b) => {
      const scoreA = typeof a.score === 'number' ? a.score : parseFloat(a.score) || 0;
      const scoreB = typeof b.score === 'number' ? b.score : parseFloat(b.score) || 0;
      return scoreB - scoreA;
    });
  }, [candidate]);
  const education = parseJson(candidate?.education);
  const experience = parseJson(candidate?.experience);
  const projects = parseJson(candidate?.projects);

  if (!candidate) return null;

  const eligibleCount = rankings.filter((r) => r.eligible).length;
  const bestMatch = rankings[0];
  const visibleSkills = showAllSkills ? skills : skills.slice(0, 12);

  const companyName = (r) => {
    if (r.companyName) return r.companyName;
    if (r.company && typeof r.company === 'object') return r.company.name;
    return typeof r.company === 'string' ? r.company : 'Unknown Company';
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button onClick={onClose || (() => navigate(-1))}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-surface border border-outline-variant text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-on-surface tracking-tight font-display truncate">{candidate.name || 'Unknown'}</h1>
              <p className="text-sm text-on-surface-variant mt-1 truncate">{candidate.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium uppercase tracking-wider bg-secondary/10 text-secondary border border-secondary/20">
              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
              Vector Stored
            </div>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              title="Delete resume"
              aria-label="Delete resume"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">
                {deleteMutation.isPending ? 'sync' : 'delete'}
              </span>
            </button>
            {onClose && (
              <button onClick={onClose}
                className="text-on-surface-variant hover:text-on-surface p-2 hover:bg-surface-variant rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>
        </div>

        {/* ATS Score + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ATSScoreCard score={candidate.ats_score} breakdown={candidate.ats_breakdown} feedback={candidate.ats_feedback} gapAnalysis={candidate.ats_gap_analysis} />
          </div>
          <div className="cyber-panel flex flex-col gap-5 justify-center">
            <QuickStat icon="code" label="Skills Extracted" value={skills.length} />
            <QuickStat icon="domain" label="Eligible Companies" value={`${eligibleCount} of ${rankings.length}`} />
            <QuickStat
              icon="workspace_premium"
              label="Best Match"
              value={bestMatch ? `${companyName(bestMatch)} (${Math.round(toPercentScore(bestMatch.score))}%)` : '—'}
            />
          </div>
        </div>

        {/* Skills */}
        <div className="cyber-panel">
          <div className="flex items-center gap-2 mb-5">
            <span className="material-symbols-outlined text-primary">code</span>
            <h2 className="text-base font-semibold text-on-surface">Extracted Skills</h2>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {visibleSkills.length > 0
              ? visibleSkills.map((skill, i) => (
                  <span key={i} className="skill-tag" title={skill.sources ? skill.sources.join(', ') : undefined}>
                    {skill.name}
                  </span>
                ))
              : <span className="text-on-surface-variant text-sm italic">No skills extracted</span>
            }
          </div>
          {skills.length > 12 && (
            <button
              onClick={() => setShowAllSkills(!showAllSkills)}
              className="text-xs text-primary mt-4 hover:underline"
            >
              {showAllSkills ? 'Show fewer skills' : `Show ${skills.length - 12} more`}
            </button>
          )}
        </div>

        {/* Education / Experience / Projects tabs */}
        <div className="cyber-panel">
          <div className="flex items-center gap-1 mb-5 border-b border-outline-variant/40 -mx-6 px-6">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                  activeTab === tab
                    ? 'text-primary border-primary'
                    : 'text-on-surface-variant border-transparent hover:text-on-surface'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Experience' && (
            experience.length > 0 ? (
              <div className="relative pl-6 border-l border-outline-variant/60 space-y-6 ml-2">
                {experience.map((exp, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full ring-4 ring-surface"
                      style={{ background: i === 0 ? '#6c63ff' : '#4a4d66', boxShadow: i === 0 ? '0 0 10px rgba(108,99,255,0.5)' : 'none' }} />
                    <h3 className="font-medium text-on-surface text-base">{exp.role || exp.title || 'Role'} — {exp.company || ''}</h3>
                    <p className="text-sm text-on-surface-variant mt-1">{exp.duration || exp.dates || ''}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-on-surface-variant italic">No work experience data</p>
          )}

          {activeTab === 'Education' && (
            education.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {education.map((edu, i) => (
                  <div key={i} className="p-4 rounded-lg border border-outline-variant/50 bg-surface-variant/40">
                    <h3 className="font-medium text-on-surface mb-1 text-sm">{edu.degree || edu.institution || 'Degree'}</h3>
                    <p className="text-xs text-on-surface-variant mb-3">{edu.institution || edu.field || ''}</p>
                    <div className="flex justify-between items-center text-xs">
                      {edu.gpa && <span className="px-2 py-1 rounded bg-surface-variant text-on-surface font-mono">GPA: {edu.gpa}</span>}
                      {edu.year && <span className="text-on-surface-variant">{edu.year}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-on-surface-variant italic">No education data</p>
          )}

          {activeTab === 'Projects' && (
            projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj, i) => (
                  <div key={i} className="p-4 rounded-lg border border-outline-variant/50 bg-surface-variant/40">
                    <h3 className="font-medium text-on-surface mb-1.5 text-sm">{proj.title || `Project ${i + 1}`}</h3>
                    <p className="text-xs text-on-surface-variant mb-3 line-clamp-2">{proj.description || ''}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(proj.technologies || []).slice(0, 5).map((t, j) => (
                        <span key={j} className="chip">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-on-surface-variant italic">No project data</p>
          )}
        </div>

        {/* AI Ranking Table */}
        <div className="cyber-panel !p-0 overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-high/30">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">auto_awesome</span>
              <h2 className="text-base font-semibold text-on-surface">AI Match Ranking</h2>
            </div>
            <span className="text-xs text-on-surface-variant px-3 py-1 rounded-full bg-surface-variant">{rankings.length} companies evaluated</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-variant/20">
                  <th className="py-4 px-6 w-16">Rank</th>
                  <th className="py-4 px-6">Company</th>
                  <th className="py-4 px-6">Match Score</th>
                  <th className="py-4 px-6">Eligibility</th>
                  <th className="py-4 px-6 w-10"></th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-outline-variant/30">
                {rankings.length > 0 ? rankings.map((r, i) => {
                  const score = Math.round(toPercentScore(r.score));
                  const isExpanded = expandedRanking === i;
                  return (
                    <React.Fragment key={i}>
                      <tr
                        onClick={() => setExpandedRanking(isExpanded ? null : i)}
                        className="hover:bg-surface-variant/30 transition-colors cursor-pointer"
                      >
                        <td className="py-4 px-6">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-on-surface bg-surface-variant border border-outline-variant">
                            {r.rank || i + 1}
                          </span>
                        </td>
                        <td className="py-4 px-6 font-medium text-on-surface">{companyName(r)}</td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
                            {score}% Match
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {r.eligible ? (
                            <span className="score-badge-high">Eligible</span>
                          ) : (
                            <span className="score-badge-low">Not Eligible</span>
                          )}
                        </td>
                        <td className="py-4 px-6 text-right">
                          <span className={`material-symbols-outlined text-outline transition-transform ${isExpanded ? 'rotate-180' : ''}`}>
                            expand_more
                          </span>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-6 pb-5 pt-1 bg-surface-container-high/20">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                              <div>
                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2 px-1">Score Breakdown</h4>
                                <ScoreBreakdown breakdown={r.score_breakdown} />
                              </div>
                              <div>
                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2 px-1">Eligibility</h4>
                                <SkillGapTable eligible={r.eligible} reasons={r.eligibility_reasons} />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                }) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-on-surface-variant italic">No rankings generated yet</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateProfile;
