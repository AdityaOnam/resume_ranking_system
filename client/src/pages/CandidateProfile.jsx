import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import ATSScoreCard from '../components/ATS/ATSScoreCard';
import ScoreBreakdown from '../components/CompanyMatch/ScoreBreakdown';
import SkillGapTable from '../components/CompanyMatch/SkillGapTable';
import { deleteResume } from '../services/api';
import { parseJson, toPercentScore } from '../utils/scoring';
import { exportAtsReportPdf } from '../utils/exportPdf';
import {
  PiArrowLeft, PiCheckCircle, PiTrash, PiX, PiCode, PiBuildings,
  PiMedal, PiSparkle, PiCaretDown, PiExport
} from 'react-icons/pi';

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

const QuickStat = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3">
    <div className="w-9 h-9 rounded-lg bg-surface-2 flex items-center justify-center shrink-0">
      <Icon size={18} className="text-accent" />
    </div>
    <div className="min-w-0">
      <p className="m-0 text-[11px] text-muted uppercase tracking-[0.08em] mb-0.5">{label}</p>
      <p className="m-0 text-[13px] font-medium text-text truncate">{value}</p>
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
    <div className="flex-1 overflow-y-auto p-6 md:p-8 relative bg-bg">
      <div className="max-w-[1000px] mx-auto flex flex-col gap-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button 
              onClick={onClose || (() => navigate(-1))}
              className="w-10 h-10 shrink-0 flex items-center justify-center rounded-lg bg-surface border border-line text-muted hover:text-text hover:border-accent transition-colors"
            >
              <PiArrowLeft size={20} />
            </button>
            <div className="min-w-0">
              <h1 className="m-0 text-2xl font-bold text-text tracking-tight font-display truncate">{candidate.name || 'Unknown'}</h1>
              <p className="m-0 text-[13px] text-muted mt-1 truncate">{candidate.email || '—'}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium uppercase tracking-wider bg-success/10 text-success border border-success/20">
              <PiCheckCircle size={14} weight="fill" />
              Vector Stored
            </div>
            <button
              onClick={() => exportAtsReportPdf(candidate)}
              className="flex items-center gap-1.5 h-9 px-3.5 border border-accent rounded-lg bg-transparent text-accent font-sans text-[13px] font-medium hover:bg-tint transition-colors cursor-pointer whitespace-nowrap"
            >
              <PiExport size={15} />Export report
            </button>
            <button
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              title="Delete resume"
              aria-label="Delete resume"
              className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-error hover:bg-error/10 transition-colors disabled:opacity-50"
            >
              <PiTrash size={18} className={deleteMutation.isPending ? 'animate-spin' : ''} />
            </button>
            {onClose && (
              <button 
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-lg text-muted hover:text-text hover:bg-surface-2 transition-colors"
              >
                <PiX size={18} />
              </button>
            )}
          </div>
        </div>

        {/* ATS Score + Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <ATSScoreCard score={candidate.ats_score} breakdown={candidate.ats_breakdown} feedback={parseJson(candidate.ats_feedback)} gapAnalysis={candidate.ats_gap_analysis} />
          </div>
          <div className="border border-line bg-surface rounded-xl p-6 flex flex-col gap-5 justify-center">
            <QuickStat icon={PiCode} label="Skills Extracted" value={skills.length} />
            <QuickStat icon={PiBuildings} label="Eligible Companies" value={`${eligibleCount} of ${rankings.length}`} />
            <QuickStat
              icon={PiMedal}
              label="Best Match"
              value={bestMatch ? `${companyName(bestMatch)} (${Math.round(toPercentScore(bestMatch.score))}%)` : '—'}
            />
          </div>
        </div>

        {/* Skills */}
        <div className="border border-line bg-surface rounded-xl p-6">
          <div className="flex items-center gap-2 mb-5">
            <PiCode className="text-accent" size={20} />
            <h2 className="text-base font-semibold text-text m-0">Extracted Skills</h2>
          </div>
          <div className="flex flex-wrap gap-2.5">
            {visibleSkills.length > 0
              ? visibleSkills.map((skill, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-full bg-tint text-accent text-xs font-medium whitespace-nowrap" title={skill.sources ? skill.sources.join(', ') : undefined}>
                    {skill.name}
                  </span>
                ))
              : <span className="text-muted text-[13px] italic">No skills extracted</span>
            }
          </div>
          {skills.length > 12 && (
            <button
              onClick={() => setShowAllSkills(!showAllSkills)}
              className="text-[13px] text-accent mt-4 hover:underline bg-transparent border-none p-0 cursor-pointer"
            >
              {showAllSkills ? 'Show fewer skills' : `Show ${skills.length - 12} more`}
            </button>
          )}
        </div>

        {/* Education / Experience / Projects tabs */}
        <div className="border border-line bg-surface rounded-xl p-6">
          <div className="flex items-center gap-1 mb-5 border-b border-line -mx-6 px-6">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors bg-transparent cursor-pointer ${
                  activeTab === tab
                    ? 'text-accent border-accent'
                    : 'text-muted border-transparent hover:text-text'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeTab === 'Experience' && (
            experience.length > 0 ? (
              <div className="relative pl-6 border-l border-line space-y-6 ml-2">
                {experience.map((exp, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full ring-4 ring-surface"
                      style={{ background: i === 0 ? 'var(--rr-accent)' : 'var(--rr-muted)', boxShadow: i === 0 ? '0 0 10px var(--rr-tint-strong)' : 'none' }} />
                    <h3 className="font-medium text-text text-[15px] m-0">{exp.role || exp.title || 'Role'} — {exp.company || ''}</h3>
                    <p className="text-[13px] text-muted mt-1 m-0">{exp.duration || exp.dates || ''}</p>
                  </div>
                ))}
              </div>
            ) : <p className="text-[13px] text-muted italic m-0">No work experience data</p>
          )}

          {activeTab === 'Education' && (
            education.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {education.map((edu, i) => (
                  <div key={i} className="p-4 rounded-lg border border-line bg-surface-2">
                    <h3 className="font-medium text-text mb-1 text-[13px] m-0">{edu.degree || edu.institution || 'Degree'}</h3>
                    <p className="text-xs text-muted mb-3 m-0">{edu.institution || edu.field || ''}</p>
                    <div className="flex justify-between items-center text-xs">
                      {edu.gpa && <span className="px-2 py-1 rounded bg-surface text-text font-mono">GPA: {edu.gpa}</span>}
                      {edu.year && <span className="text-muted">{edu.year}</span>}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-[13px] text-muted italic m-0">No education data</p>
          )}

          {activeTab === 'Projects' && (
            projects.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {projects.map((proj, i) => (
                  <div key={i} className="p-4 rounded-lg border border-line bg-surface-2">
                    <h3 className="font-medium text-text mb-1.5 text-[13px] m-0">{proj.title || `Project ${i + 1}`}</h3>
                    <p className="text-xs text-muted mb-3 line-clamp-2 m-0">{proj.description || ''}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(proj.technologies || []).slice(0, 5).map((t, j) => (
                        <span key={j} className="px-2 py-1 rounded-full bg-surface text-text text-[10px] whitespace-nowrap">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="text-[13px] text-muted italic m-0">No project data</p>
          )}
        </div>

        {/* AI Ranking Table */}
        <div className="border border-line bg-surface rounded-xl overflow-hidden shadow-sm">
          <div className="p-5 border-b border-line flex items-center justify-between bg-surface-2">
            <div className="flex items-center gap-2">
              <PiSparkle className="text-accent" size={20} />
              <h2 className="text-base font-semibold text-text m-0">AI Match Ranking</h2>
            </div>
            <span className="text-xs text-muted px-3 py-1 rounded-full bg-surface">{rankings.length} companies evaluated</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-line text-[11px] font-semibold uppercase tracking-wider text-muted bg-surface-2">
                  <th className="py-3 px-5 w-16">Rank</th>
                  <th className="py-3 px-5">Company</th>
                  <th className="py-3 px-5">Match Score</th>
                  <th className="py-3 px-5">Eligibility</th>
                  <th className="py-3 px-5 w-10"></th>
                </tr>
              </thead>
              <tbody className="text-[13px] divide-y divide-line">
                {rankings.length > 0 ? rankings.map((r, i) => {
                  const score = Math.round(toPercentScore(r.score));
                  const isExpanded = expandedRanking === i;
                  return (
                    <React.Fragment key={i}>
                      <tr
                        onClick={() => setExpandedRanking(isExpanded ? null : i)}
                        className="hover:bg-surface-2 transition-colors cursor-pointer"
                      >
                        <td className="py-3.5 px-5">
                          <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-text bg-surface-2 border border-line">
                            {r.rank || i + 1}
                          </span>
                        </td>
                        <td className="py-3.5 px-5 font-medium text-text">{companyName(r)}</td>
                        <td className="py-3.5 px-5">
                          <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-[11px] font-medium bg-tint text-accent border border-tint-strong whitespace-nowrap">
                            {score}% Match
                          </span>
                        </td>
                        <td className="py-3.5 px-5">
                          {r.eligible ? (
                            <span className="bg-success/10 text-success border border-success/20 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap">Eligible</span>
                          ) : (
                            <span className="bg-error/10 text-error border border-error/20 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap">Not Eligible</span>
                          )}
                        </td>
                        <td className="py-3.5 px-5 text-right text-muted">
                          <PiCaretDown size={16} className={`transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr>
                          <td colSpan={5} className="px-5 pb-5 pt-1 bg-surface-2/50 border-t-0">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                              <div>
                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2 px-1 m-0">Score Breakdown</h4>
                                <ScoreBreakdown breakdown={r.score_breakdown} />
                              </div>
                              <div>
                                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2 px-1 m-0">Eligibility</h4>
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
                    <td colSpan={5} className="py-10 text-center text-muted italic">No rankings generated yet</td>
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
