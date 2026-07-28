import React, { useState } from 'react';

const CATEGORY_META = {
  contact_info: { label: 'Contact Info', max: 15 },
  formatting_and_ordering: { label: 'Formatting & Ordering', max: 20 },
  quantifiable_metrics: { label: 'Quantifiable Metrics', max: 25 },
  action_verbs: { label: 'Action Verbs', max: 25 },
  keyword_density: { label: 'Keyword Density', max: 15 },
};

const scoreTone = (score) => {
  if (score >= 80) return { text: 'text-secondary', bar: 'bg-secondary' };
  if (score >= 60) return { text: 'text-[#fbbf24]', bar: 'bg-[#fbbf24]' };
  return { text: 'text-[#fb7185]', bar: 'bg-[#fb7185]' };
};

const CategoryBar = ({ label, value, max }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs text-on-surface-variant">{label}</span>
        <span className="text-xs font-mono text-on-surface-variant">{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-variant/60 overflow-hidden">
        <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ATSScoreCard = ({ score, breakdown, feedback, gapAnalysis }) => {
  const [showAllFeedback, setShowAllFeedback] = useState(false);

  if (score === null || score === undefined) {
    return (
      <div className="cyber-panel h-full flex flex-col items-center justify-center text-center gap-2 py-10">
        <span className="material-symbols-outlined text-3xl text-outline">query_stats</span>
        <p className="text-sm text-on-surface-variant">ATS score not available for this resume.</p>
      </div>
    );
  }

  const tone = scoreTone(score);
  const feedbackList = feedback || [];
  const visibleFeedback = showAllFeedback ? feedbackList : feedbackList.slice(0, 3);

  return (
    <div className="cyber-panel h-full flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary">query_stats</span>
        <h2 className="text-base font-semibold text-on-surface">ATS Score</h2>
      </div>

      <div className="flex items-center gap-5">
        <div className={`text-4xl font-bold font-display ${tone.text}`}>{score}</div>
        <div className="text-xs text-on-surface-variant leading-snug">
          out of 100 — based on contact completeness, formatting, quantifiable<br />impact, action verbs, and keyword usage.
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <CategoryBar key={key} label={meta.label} value={breakdown?.[key] ?? 0} max={meta.max} />
        ))}
      </div>

      {feedbackList.length > 0 && (
        <div className="pt-4 border-t border-outline-variant/40 flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Feedback</h3>
          <ul className="flex flex-col gap-2">
            {visibleFeedback.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-on-surface-variant">
                <span className="material-symbols-outlined text-[14px] mt-0.5 text-outline">arrow_right</span>
                {f}
              </li>
            ))}
          </ul>
          {feedbackList.length > 3 && (
            <button
              onClick={() => setShowAllFeedback(!showAllFeedback)}
              className="text-xs text-primary text-left mt-1 hover:underline w-fit"
            >
              {showAllFeedback ? 'Show less' : `Show ${feedbackList.length - 3} more`}
            </button>
          )}
        </div>
      )}

      {gapAnalysis && (
        <div className="pt-4 border-t border-outline-variant/40 flex flex-col gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
            AI Analysis
          </h3>
          <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-line">{gapAnalysis}</p>
        </div>
      )}
    </div>
  );
};

export default ATSScoreCard;
