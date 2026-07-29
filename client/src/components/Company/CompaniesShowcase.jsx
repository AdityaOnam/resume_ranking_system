import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompanies } from '../../services/api';
import AddCompanyModal from './AddCompanyModal';
import LOGO_MAP from './logoMap.json';
import { 
  PiMagnifyingGlass, PiFaders, PiPlus, PiBriefcase, 
  PiCaretLeft, PiCaretRight, PiSealCheck
} from 'react-icons/pi';

const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Sorted longest-key-first once at module load, so a specific match (e.g.
// "husk power") is tried before a shorter one that happens to also occur
// inside it, rather than winning or losing based on JSON key order.
const LOGO_ENTRIES = Object.entries(LOGO_MAP).sort(([a], [b]) => b.length - a.length);

const getCompanyLogo = (name) => {
  if (!name) return null;
  const lowerName = name.toLowerCase();

  if (LOGO_MAP[lowerName]) return LOGO_MAP[lowerName];

  // Company name must contain the key as a whole word/phrase, not merely as a
  // run of characters - plain .includes() in either direction let short keys
  // like "ey" or "hp" match inside unrelated words ("Morgan Stanl-EY", "RMon-EY",
  // "HP-CL"), and let short company names like "Intel" match purely because
  // they happen to be a substring of an unrelated longer key ("Intel-lipaat").
  for (const [key, path] of LOGO_ENTRIES) {
    if (new RegExp(`\\b${escapeRegex(key)}\\b`).test(lowerName)) {
      return path;
    }
  }

  return null;
};

const CompanyCard = ({ company }) => {
  const skills = Array.isArray(company.skill_set) ? company.skill_set : [];
  const logo = getCompanyLogo(company.name);
  const dsaRequired = company.dsa_required === true;
  const visitsCampus = company.visits_iit_patna === true;

  return (
    <div className="border border-line bg-surface rounded-xl p-5 flex flex-col gap-4 transition-all duration-200 hover:border-accent hover:shadow-lg hover:-translate-y-1">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border border-line overflow-hidden group ${logo ? 'bg-white p-1' : 'bg-surface-2'}`}>
          {logo
            ? <img src={logo} alt={company.name} className="object-contain w-full h-full transition-transform duration-300 group-hover:scale-110 mix-blend-multiply" />
            : <span className="text-xl font-bold text-accent">{(company.name || '?')[0].toUpperCase()}</span>
          }
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-[17px] font-semibold text-text leading-tight truncate m-0 font-display">{company.name}</h3>
            {visitsCampus && (
              <PiSealCheck size={16} weight="fill" className="text-accent shrink-0" title="Visits campus for hiring" />
            )}
          </div>
          {!!company.cpi && (
            <p className="text-[13px] font-mono text-accent mt-0.5 m-0">Min GPA: {company.cpi}</p>
          )}
        </div>
      </div>

      {/* Role */}
      {company.internship_role && (
        <p className="text-[13px] text-muted -mt-2 m-0">{company.internship_role}</p>
      )}

      {/* Skills */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2 m-0">Skills</p>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {skills.length > 0 ? (
            <>
              {skills.slice(0, 4).map((skill, i) => (
                <span key={i} className="px-2 py-1 rounded bg-tint text-accent text-[11px] whitespace-nowrap">{skill}</span>
              ))}
              {skills.length > 4 && (
                <span className="px-2 py-1 rounded bg-tint text-accent text-[11px] whitespace-nowrap" title={skills.slice(4).join(', ')}>+{skills.length - 4}</span>
              )}
            </>
          ) : (
            <span className="text-[11px] text-muted italic">No skills listed</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-line flex flex-col gap-2">
        <div className="flex justify-between items-center text-[13px]">
          <span className="text-muted">DSA Required</span>
          <span
            className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
              dsaRequired 
                ? 'bg-success/10 text-success border-success/30' 
                : 'bg-error/10 text-error border-error/30'
            }`}
          >
            {dsaRequired ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
    </div>
  );
};

const FilterPanel = ({ filters, setFilters, allBranches }) => (
  <div className="border border-line bg-surface rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">Branch</label>
      <select
        value={filters.branch}
        onChange={e => setFilters(f => ({ ...f, branch: e.target.value }))}
        className="w-full h-[38px] bg-surface-2 border border-line rounded-lg px-3 text-[13px] text-text focus:outline-none focus:border-accent"
      >
        <option value="">Any branch</option>
        {allBranches.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
    </div>
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">DSA Required</label>
      <select
        value={filters.dsa}
        onChange={e => setFilters(f => ({ ...f, dsa: e.target.value }))}
        className="w-full h-[38px] bg-surface-2 border border-line rounded-lg px-3 text-[13px] text-text focus:outline-none focus:border-accent"
      >
        <option value="">Any</option>
        <option value="yes">Required</option>
        <option value="no">Not required</option>
      </select>
    </div>
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-1.5">Max Min-GPA</label>
      <input
        type="number" step="0.1" min="0" max="10"
        value={filters.maxCpi}
        onChange={e => setFilters(f => ({ ...f, maxCpi: e.target.value }))}
        placeholder="e.g. 8.0"
        className="w-full h-[38px] bg-surface-2 border border-line rounded-lg px-3 text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-accent"
      />
    </div>
  </div>
);

const CompaniesShowcase = () => {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ branch: '', dsa: '', maxCpi: '' });
  const PER_PAGE = 6;

  const queryClient = useQueryClient();
  const { data: companiesData, isLoading: loading } = useQuery({
    queryKey: ['companies'],
    queryFn: () => getCompanies().then(r => r.data),
    initialData: [],
  });

  const companies = useMemo(() => (Array.isArray(companiesData) ? companiesData : []), [companiesData]);

  const allBranches = useMemo(() => {
    const set = new Set();
    companies.forEach(c => (Array.isArray(c.branch) ? c.branch : []).forEach(b => set.add(b)));
    return [...set].sort();
  }, [companies]);

  const filtered = companies.filter(c => {
    if (!(c.name || '').toLowerCase().includes(search.toLowerCase())) return false;
    if (filters.branch && !(Array.isArray(c.branch) && c.branch.includes(filters.branch))) return false;
    if (filters.dsa === 'yes' && c.dsa_required !== true) return false;
    if (filters.dsa === 'no' && c.dsa_required === true) return false;
    if (filters.maxCpi && Number(c.cpi || 0) > Number(filters.maxCpi)) return false;
    return true;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PER_PAGE));
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  const activeFilterCount = [filters.branch, filters.dsa, filters.maxCpi].filter(Boolean).length;

  const resetPage = () => setPage(1);

  return (
    <div className="flex-1 overflow-y-auto px-6 md:px-8 py-8 bg-bg">
      <div className="max-w-[1180px] mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="m-0 text-[32px] font-bold text-text tracking-[-0.02em] font-display">Companies</h2>
          <p className="m-0 text-[13.5px] text-muted mt-1.5">Browse hiring partners and their requirements</p>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <PiMagnifyingGlass className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" size={18} />
            <input
              className="w-full h-11 bg-surface-2 border border-line rounded-lg pl-11 pr-4 text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-accent transition-colors"
              placeholder="Search companies..."
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 border rounded-lg px-5 h-11 text-[13px] font-medium shrink-0 transition-colors cursor-pointer ${
              showFilters || activeFilterCount > 0
                ? 'border-accent text-accent bg-tint'
                : 'border-line bg-transparent text-text hover:border-accent hover:text-accent'
            }`}
          >
            <PiFaders size={18} />
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-accent text-bg text-[10px] font-bold flex items-center justify-center ml-1">{activeFilterCount}</span>
            )}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg px-5 h-11 bg-accent text-bg transition-opacity hover:opacity-90 text-[13px] font-medium shrink-0 border-0 cursor-pointer">
            <PiPlus size={18} />
            Add Company / JD
          </button>
        </div>

        {showFilters && (
          <FilterPanel filters={filters} setFilters={(fn) => { setFilters(fn); resetPage(); }} allBranches={allBranches} />
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border border-line bg-surface rounded-xl h-48 animate-pulse" />
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="text-center py-16 text-muted flex flex-col items-center">
            <PiBriefcase size={48} className="mb-3 opacity-50" />
            {search || activeFilterCount > 0 ? 'No companies match your search/filters.' : 'No companies found. Add some companies first!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
            {paged.map((company, i) => (
              <CompanyCard key={company.id || i} company={company} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-5 border-t border-line">
            <span className="text-[13px] text-muted">
              Showing {(page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} companies
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface border border-line text-muted hover:text-text hover:border-accent disabled:opacity-40 transition-colors cursor-pointer bg-transparent">
                <PiCaretLeft size={16} />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-medium font-sans transition-colors cursor-pointer ${
                    page === p
                      ? 'bg-accent text-bg border-accent border'
                      : 'bg-surface text-muted border border-line hover:text-text hover:border-accent'
                  }`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface border border-line text-muted hover:text-text hover:border-accent disabled:opacity-40 transition-colors cursor-pointer bg-transparent">
                <PiCaretRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showAddModal && (
        <AddCompanyModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ['companies'] });
          }}
        />
      )}
    </div>
  );
};

export default CompaniesShowcase;
