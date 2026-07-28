import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCompanies } from '../../services/api';
import AddCompanyModal from './AddCompanyModal';
import LOGO_MAP from './logoMap.json';

const getCompanyLogo = (name) => {
  if (!name) return null;
  const lowerName = name.toLowerCase();

  if (LOGO_MAP[lowerName]) return LOGO_MAP[lowerName];

  for (const [key, path] of Object.entries(LOGO_MAP)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
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
    <div className="card card-hover p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 border border-outline-variant/40 overflow-hidden group ${logo ? 'bg-white p-1' : 'bg-surface-container-highest'}`}>
          {logo
            ? <img src={logo} alt={company.name} className="object-contain w-full h-full transition-transform duration-300 group-hover:scale-110 mix-blend-multiply" />
            : <span className="text-xl font-bold text-primary">{(company.name || '?')[0].toUpperCase()}</span>
          }
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-on-surface leading-tight truncate">{company.name}</h3>
            {visitsCampus && (
              <span className="material-symbols-outlined text-secondary text-[16px] shrink-0" title="Visits campus for hiring">
                verified
              </span>
            )}
          </div>
          {!!company.cpi && (
            <p className="text-[13px] font-mono text-primary mt-0.5">Min GPA: {company.cpi}</p>
          )}
        </div>
      </div>

      {/* Role */}
      {company.internship_role && (
        <p className="text-sm text-on-surface-variant -mt-2">{company.internship_role}</p>
      )}

      {/* Skills */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Skills</p>
        <div className="flex flex-wrap gap-1.5">
          {skills.length > 0 ? (
            <>
              {skills.slice(0, 4).map((skill, i) => (
                <span key={i} className="chip">{skill}</span>
              ))}
              {skills.length > 4 && (
                <span className="chip" title={skills.slice(4).join(', ')}>+{skills.length - 4}</span>
              )}
            </>
          ) : (
            <span className="text-xs text-on-surface-variant italic">No skills listed</span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-outline-variant/60 flex flex-col gap-2">
        <div className="flex justify-between items-center text-sm">
          <span className="text-on-surface-variant">DSA Required</span>
          <span
            className="px-2 py-0.5 rounded text-[11px] font-bold border"
            style={
              dsaRequired
                ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)' }
                : { background: 'rgba(244,63,94,0.1)', color: '#fb7185', borderColor: 'rgba(244,63,94,0.3)' }
            }
          >
            {dsaRequired ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
    </div>
  );
};

const FilterPanel = ({ filters, setFilters, allBranches }) => (
  <div className="cyber-panel !p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Branch</label>
      <select
        value={filters.branch}
        onChange={e => setFilters(f => ({ ...f, branch: e.target.value }))}
        className="w-full bg-surface-container-high border border-outline-variant rounded-lg py-2 px-3 text-sm text-on-surface focus:outline-none focus:border-primary"
      >
        <option value="">Any branch</option>
        {allBranches.map(b => <option key={b} value={b}>{b}</option>)}
      </select>
    </div>
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">DSA Required</label>
      <select
        value={filters.dsa}
        onChange={e => setFilters(f => ({ ...f, dsa: e.target.value }))}
        className="w-full bg-surface-container-high border border-outline-variant rounded-lg py-2 px-3 text-sm text-on-surface focus:outline-none focus:border-primary"
      >
        <option value="">Any</option>
        <option value="yes">Required</option>
        <option value="no">Not required</option>
      </select>
    </div>
    <div>
      <label className="block text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1.5">Max Min-GPA</label>
      <input
        type="number" step="0.1" min="0" max="10"
        value={filters.maxCpi}
        onChange={e => setFilters(f => ({ ...f, maxCpi: e.target.value }))}
        placeholder="e.g. 8.0"
        className="w-full bg-surface-container-high border border-outline-variant rounded-lg py-2 px-3 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary"
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
    <div className="flex-1 overflow-y-auto px-6 md:px-8 py-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-on-surface tracking-tight font-display">Companies</h2>
          <p className="text-sm text-on-surface-variant mt-1">Browse hiring partners and their requirements</p>
        </div>

        {/* Search */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-[20px]">search</span>
            <input
              className="w-full bg-surface-container-high border border-outline-variant rounded-lg py-3 pl-12 pr-4 text-sm text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors"
              placeholder="Search companies..."
              value={search}
              onChange={e => { setSearch(e.target.value); resetPage(); }}
            />
          </div>
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`flex items-center gap-2 border rounded-lg px-6 py-3 text-sm shrink-0 transition-colors ${
              showFilters || activeFilterCount > 0
                ? 'border-primary text-primary bg-primary/10'
                : 'border-outline-variant text-on-surface hover:border-primary hover:text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filters
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center">{activeFilterCount}</span>
            )}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg px-6 py-3 text-white transition-all text-sm shrink-0 font-medium btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Company / JD
          </button>
        </div>

        {showFilters && (
          <FilterPanel filters={filters} setFilters={(fn) => { setFilters(fn); resetPage(); }} allBranches={allBranches} />
        )}

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card h-48 animate-pulse" />
            ))}
          </div>
        ) : paged.length === 0 ? (
          <div className="text-center py-16 text-on-surface-variant">
            <span className="material-symbols-outlined text-[48px] block mb-3 text-outline">business_center</span>
            {search || activeFilterCount > 0 ? 'No companies match your search/filters.' : 'No companies found. Add some companies first!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paged.map((company, i) => (
              <CompanyCard key={company.id || i} company={company} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center pt-4 border-t border-outline-variant/60">
            <span className="text-sm text-on-surface-variant">
              Showing {(page - 1) * PER_PAGE + 1} to {Math.min(page * PER_PAGE, filtered.length)} of {filtered.length} companies
            </span>
            <div className="flex gap-1.5">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-container-high border border-outline-variant/40 text-on-surface-variant hover:text-on-surface disabled:opacity-40 transition-colors">
                <span className="material-symbols-outlined text-[16px]">chevron_left</span>
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)}
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold font-mono transition-colors border ${
                    page === p
                      ? 'bg-primary text-white border-primary'
                      : 'bg-surface-container-high text-on-surface-variant border-outline-variant/40 hover:text-on-surface'
                  }`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="w-8 h-8 rounded-lg flex items-center justify-center bg-surface-container-high border border-outline-variant/40 text-on-surface-variant hover:text-on-surface disabled:opacity-40 transition-colors">
                <span className="material-symbols-outlined text-[16px]">chevron_right</span>
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
