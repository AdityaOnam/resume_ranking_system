// Shared helpers for parsing/display of resume + ranking data returned by the
// API. Previously duplicated verbatim across CandidateProfile, Leaderboard,
// ATSDashboard, AnalyticsPanels, and Header.

/** Postgres jsonb columns can come back as an array, a JSON string, or null
 * depending on the row/driver path - normalize to an array. */
export const parseJson = (data) => {
  if (!data) return [];
  if (typeof data === 'string') {
    try { const p = JSON.parse(data); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return Array.isArray(data) ? data : [];
};

/** Company-match scores are stored 0-100 (see compute_company_score on the
 * backend), but defend against any legacy/historical rows persisted on a
 * 0-1 scale - normalize either into a 0-100 percent number. */
export const toPercentScore = (rawScore) => {
  const n = typeof rawScore === 'number' ? rawScore : parseFloat(rawScore) || 0;
  return n > 0 && n <= 1 ? n * 100 : n;
};
