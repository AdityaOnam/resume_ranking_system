import React from 'react';

const CATEGORY_META = {
  skill_overlap: { label: 'Skill Overlap', max: 30 },
  cross_encoder: { label: 'Resume ↔ JD Match', max: 30 },
  academic_branch_bonus: { label: 'Academic & Branch', max: 15 },
  project_relevance: { label: 'Project Relevance', max: 15 },
  experience_relevance: { label: 'Experience', max: 10 },
};

const ScoreBreakdown = ({ breakdown }) => {
  const entries = Object.entries(CATEGORY_META).filter(([key]) => breakdown && key in breakdown);

  if (entries.length === 0) {
    return <p className="text-[13px] text-muted italic px-1 m-0">No score breakdown available.</p>;
  }

  return (
    <div className="flex flex-col gap-2.5 px-1">
      {entries.map(([key, meta]) => {
        const value = breakdown[key] ?? 0;
        const pct = meta.max > 0 ? Math.min(100, (value / meta.max) * 100) : 0;
        return (
          <div key={key}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-[11px] text-muted">{meta.label}</span>
              <span className="text-[11px] font-mono text-muted">{value}/{meta.max}</span>
            </div>
            <div className="h-1 rounded-full bg-line overflow-hidden">
              <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ScoreBreakdown;
