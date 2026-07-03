import React from 'react';
import { useNavigate } from 'react-router-dom';

const CandidateProfile = ({ candidate, onClose }) => {
  const navigate = useNavigate();

  if (!candidate) return null;

  const parseJson = (data) => {
    if (!data) return [];
    if (typeof data === 'string') {
      try { const p = JSON.parse(data); return Array.isArray(p) ? p : []; } catch { return []; }
    }
    return Array.isArray(data) ? data : [];
  };

  const skills = parseJson(candidate.skills);
  const rankings = parseJson(candidate.rankings);
  const education = parseJson(candidate.education);
  const experience = parseJson(candidate.experience);

  return (
    <div className="flex-1 overflow-y-auto p-6 md:p-8 relative">
      <div className="max-w-5xl mx-auto">
        {/* Profile Header */}
        <div className="flex items-center justify-between mb-8 gap-4">
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
            {onClose && (
              <button onClick={onClose}
                className="text-on-surface-variant hover:text-on-surface p-2 hover:bg-surface-variant rounded-lg transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>
        </div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Skills - 2/3 width */}
          <div className="lg:col-span-2 cyber-panel">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-primary">code</span>
              <h2 className="text-base font-semibold text-on-surface">Extracted Skills</h2>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {skills.length > 0
                ? skills.map((skill, i) => (
                    <span key={i} className="skill-tag">{skill}</span>
                  ))
                : <span className="text-on-surface-variant text-sm italic">No skills extracted</span>
              }
            </div>
          </div>

          {/* Education - 1/3 width */}
          <div className="cyber-panel flex flex-col justify-center">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined" style={{ color: '#b4a3ff' }}>school</span>
              <h2 className="text-base font-semibold text-on-surface">Education</h2>
            </div>
            {education.length > 0 ? education.map((edu, i) => (
              <div key={i} className="p-4 rounded-lg border border-outline-variant/50 bg-surface-variant/40">
                <h3 className="font-medium text-on-surface mb-1 text-sm">{edu.degree || edu.institution || 'Degree'}</h3>
                <p className="text-xs text-on-surface-variant mb-3">{edu.institution || ''}</p>
                <div className="flex justify-between items-center text-xs">
                  {edu.gpa && <span className="px-2 py-1 rounded bg-surface-variant text-on-surface font-mono">GPA: {edu.gpa}</span>}
                  {edu.year && <span className="text-on-surface-variant">{edu.year}</span>}
                </div>
              </div>
            )) : (
              <div className="p-4 rounded-lg border border-outline-variant/50 text-center bg-surface-variant/40">
                <p className="text-sm text-on-surface-variant">No education data</p>
              </div>
            )}
          </div>

          {/* Work Experience - full width */}
          <div className="lg:col-span-3 cyber-panel relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none transition-opacity opacity-50 group-hover:opacity-100"
              style={{ background: 'rgba(108,99,255,0.1)', filter: 'blur(48px)', transform: 'translate(30%,-30%)' }} />
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-primary">work</span>
              <h2 className="text-base font-semibold text-on-surface">Work Experience</h2>
            </div>
            {experience.length > 0 ? (
              <div className="relative pl-6 border-l border-outline-variant/60 space-y-8 ml-2">
                {experience.map((exp, i) => (
                  <div key={i} className="relative">
                    <div className="absolute -left-[31px] top-1.5 w-3.5 h-3.5 rounded-full ring-4 ring-surface"
                      style={{ background: i === 0 ? '#6c63ff' : '#4a4d66', boxShadow: i === 0 ? '0 0 10px rgba(108,99,255,0.5)' : 'none' }} />
                    <h3 className="font-medium text-on-surface text-base">{exp.role || exp.title || 'Role'} — {exp.company || ''}</h3>
                    <p className="text-sm text-on-surface-variant mt-1">{exp.duration || exp.dates || ''}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-on-surface-variant italic">No work experience data</p>
            )}
          </div>
        </div>

        {/* AI Ranking Table */}
        <div className="cyber-panel !p-0 overflow-hidden">
          <div className="p-5 border-b border-outline-variant flex items-center justify-between bg-surface-container-high/30">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-secondary">auto_awesome</span>
              <h2 className="text-base font-semibold text-on-surface">AI Match Ranking</h2>
            </div>
            <span className="text-xs text-on-surface-variant px-3 py-1 rounded-full bg-surface-variant">Top {rankings.length} Matches</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant bg-surface-variant/20">
                  <th className="py-4 px-6 w-16">#</th>
                  <th className="py-4 px-6">Company</th>
                  <th className="py-4 px-6">Match Score</th>
                  <th className="py-4 px-6">Role Rank</th>
                  <th className="py-4 px-6 w-1/2">Why Matched</th>
                </tr>
              </thead>
              <tbody className="text-sm divide-y divide-outline-variant/30">
                {rankings.length > 0 ? rankings.map((r, i) => {
                  const score = typeof r.score === 'number' ? (r.score * 100).toFixed(0) : r.score;
                  return (
                    <tr key={i} className="hover:bg-surface-variant/30 transition-colors group">
                      <td className="py-4 px-6 text-on-surface-variant">{i + 1}</td>
                      <td className="py-4 px-6 font-medium text-on-surface">{r.companyName || r.company || '—'}</td>
                      <td className="py-4 px-6">
                        <span className="inline-flex items-center justify-center px-2.5 py-1 rounded-full text-xs font-medium bg-secondary/10 text-secondary border border-secondary/20">
                          {score}% Match
                        </span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-on-surface bg-surface-variant border border-outline-variant">
                          {r.rank || i + 1}
                        </span>
                      </td>
                      <td className="py-4 px-6 text-on-surface-variant group-hover:text-on-surface transition-colors">
                        {r.reason || r.why || '—'}
                      </td>
                    </tr>
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

        {/* Download Button */}
        <div className="mt-8 flex justify-end">
          <button className="btn-primary">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Download Report
          </button>
        </div>
      </div>
    </div>
  );
};

export default CandidateProfile;
