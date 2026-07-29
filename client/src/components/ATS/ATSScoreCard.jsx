import React, { useState } from 'react';
import { PiChartBar, PiSparkle, PiCaretRight } from 'react-icons/pi';

const CATEGORY_META = {
  contact_info: { label: 'Contact Info', max: 15 },
  formatting_and_ordering: { label: 'Formatting & Ordering', max: 20 },
  quantifiable_metrics: { label: 'Quantifiable Metrics', max: 25 },
  action_verbs: { label: 'Action Verbs', max: 25 },
  keyword_density: { label: 'Keyword Density', max: 15 },
};

const scoreTone = (score) => {
  if (score >= 80) return { text: 'text-success', bar: 'bg-success' };
  if (score >= 60) return { text: 'text-[#fbbf24]', bar: 'bg-[#fbbf24]' };
  return { text: 'text-error', bar: 'bg-error' };
};

const CategoryBar = ({ label, value, max }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div>
      <div className="flex justify-between items-baseline mb-1.5">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs font-mono text-muted">{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const ATSScoreCard = ({ score, breakdown, feedback, gapAnalysis }) => {
  const [showAllFeedback, setShowAllFeedback] = useState(false);

  if (score === null || score === undefined) {
    return (
      <div className="border border-line bg-surface rounded-xl p-6 h-full flex flex-col items-center justify-center text-center gap-2 py-10">
        <PiChartBar className="text-3xl text-muted" />
        <p className="text-sm text-muted">ATS score not available for this resume.</p>
      </div>
    );
  }

  const tone = scoreTone(score);
  const feedbackList = feedback || [];
  const visibleFeedback = showAllFeedback ? feedbackList : feedbackList.slice(0, 3);

  return (
    <div className="border border-line bg-surface rounded-xl p-6 h-full flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <PiChartBar className="text-accent" size={20} />
        <h2 className="text-base font-semibold text-text m-0">ATS Score</h2>
      </div>

      <div className="flex items-center gap-5">
        <div className={`text-[44px] leading-none font-bold font-display ${tone.text}`}>{score}</div>
        <div className="text-[13px] text-muted leading-snug">
          out of 100 — based on contact completeness, formatting, quantifiable<br />impact, action verbs, and keyword usage.
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {Object.entries(CATEGORY_META).map(([key, meta]) => (
          <CategoryBar key={key} label={meta.label} value={breakdown?.[key] ?? 0} max={meta.max} />
        ))}
      </div>

      {feedbackList.length > 0 && (
        <div className="pt-4 border-t border-line flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted m-0">Feedback</h3>
          <ul className="flex flex-col gap-2 m-0 p-0 list-none">
            {visibleFeedback.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted">
                <PiCaretRight className="mt-1 text-muted shrink-0" size={12} />
                {f}
              </li>
            ))}
          </ul>
          {feedbackList.length > 3 && (
            <button
              onClick={() => setShowAllFeedback(!showAllFeedback)}
              className="text-[13px] text-accent text-left mt-1 hover:underline w-fit bg-transparent border-none cursor-pointer p-0 font-medium"
            >
              {showAllFeedback ? 'Show less' : `Show ${feedbackList.length - 3} more`}
            </button>
          )}
        </div>
      )}

      {gapAnalysis && (
        <div className="pt-4 border-t border-line flex flex-col gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted flex items-center gap-1.5 m-0">
            <PiSparkle size={14} />
            AI Analysis
          </h3>
          <p className="text-sm text-muted leading-relaxed whitespace-pre-line m-0">{gapAnalysis}</p>
        </div>
      )}
    </div>
  );
};

export default ATSScoreCard;
