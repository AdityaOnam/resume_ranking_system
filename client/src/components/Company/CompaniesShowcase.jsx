import React, { useState, useEffect } from 'react';
import { getCompanies } from '../../services/api';
import AddCompanyModal from './AddCompanyModal';

const LOGO_MAP = {
  'microsoft': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBlaf-dZJPUwIYoyQWl6pdQWvp9TOzVFM7fT88FqzRnnxKIGINB2SlvSRIjpA-bSG3car9Lw8Vf4IOohHaz1ExWNJjNgwxh9Q1AioxlV4nlb0cm-pJuLJemAJ8lUgZG3r4wPy_XYzOCqmQnWFWk0TvOKEI6fIjC-xCD-gSpQJxnvDsjQlVTuZVRACPJHqDJgzxkbvNE31-rvooK0_POUQ9M2HCkXZpk3gQ9Sbg4-dRzU-E25SdrHeoiwwvVnP8A7Bi_6sd0kY5A3eg',
  'google': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCw0dBIRsK7ViL6s2iZEFOsbXYGzmW6rClFviL0rTnl8fzdX9Jhgfahm5EN3dkPlxYDa93S6QfNvpDkiMRl3WPARsnEoRS0xcmsgMz5twDvCV971-LuW3oKncirPMiiJN7XYoMx3OcwfX165TE4RXmpgaLolKkgrYsD34CHhX_hgbcRvPM8YsD2-3AXx6a1EgYMP5XmJKVW_NV-VqCVTmUzpVCH7C91RhTmTorbLQYbfP4QGVX7JXnx0F4_Pi25ZxP2mqJksfuTIVg',
  'amazon': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBPtyNl26QTCa_eSwNJgk_F1d3O7uYOHZ0uUkBXaePy_1KOHxFZF0yJpVMr2SywPXLxv1AoQqZbSzrLmRvPZ7_psm_GVsGhu5MuU9WzFrea0romqkAFX0xbTJPF41du3xnJjNAAKWfhiX1TQWhNuXxWDC2dmmTwoLt4YrLLSCw7X83wU2knGv9h2DlP1_XPVY84WoD7BqoSZg0NaVLzz9QNd7tbkntyfYUdp_EzzJaqq30wSca5BFDDcDjXCeT7opOr0INUnnQM39g',
  'adobe': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCmZirKxBbN6Nwvm9Gm_1oJsV_g3qwyB1c2d-urZG5KhfHCb_axA7ZocBGwbQnMkkUWA1fXChrzfRPcX-NdvkRDBaCZYdCF-QGLTWIQhbnGwWTUvx8IDm8w-LY0230tFxg2IPfqehRhH69YQb154mi0zCGvy4S-SxH89SxNAjVEe3IeCBBzK4jqrV8bCCefXrG6ghHaQZADImgiL-5Pu-7HweJB_J7p74YR1Q0NAR0fz9xgtii7nQZLlTqzMxx1CvZ3vIdDUfTzrCI',
  'flipkart': 'https://lh3.googleusercontent.com/aida-public/AB6AXuCazbWaHy2Q9vIdHM_LDFIvLhbBBBmopN_1sehAyRhtKEY1hGuovLH2HtaEJTKPsz5SShuX62ZkoZ8PyK97U9mxjWfQ9nnGNZT1EZiDH4qIJZXx8t5mFubfVOrs4ZyQyPBNLHI1BxBx3gno18BXyWdmWVIgwgs1rwlGvwGBo0pI0gDzwjcfQd9rjxOaEt6VdS7c62gDIrB0F1IgfurZxyA_wFWX2c5aV80J_N7GjoQItsm29M24pBRYtNdLpmwSdkYMrvQ4GcQtZmI',
  'zomato': 'https://lh3.googleusercontent.com/aida-public/AB6AXuBJlhQMc0Vruyn9j5KEd7md-RuHf-ZJdWFmztXVvHAwWelM3RHvo0q0FvJVNue5utOuqC-1zrDvUHzf2rAMmeMDBa-ZxXLtg33rs5IgxvG4Kg9-5G2auBikkK8mtkPkJjd7TBPlpCO3dm63tWF9Iv_EKFDjQiC3zbr4yP5cPDd2W4c5JWTfvnsT6jIjwp73o08NVrtveRYlv0Zw3rteOJU670stzDPXAVX192yktp9uppPmnSCGuLOnpPP4RUDpbq0X34h2owV2myc',
};

const getCompanyLogo = (name) => {
  if (!name) return null;
  return LOGO_MAP[name.toLowerCase()] || null;
};

const CompanyCard = ({ company }) => {
  const skills = Array.isArray(company.skillSet) ? company.skillSet : (Array.isArray(company.skills) ? company.skills : []);
  const logo = getCompanyLogo(company.name);
  const dsaRequired = company.dsaRequired;

  const dsaYes = dsaRequired === true || dsaRequired === 'true' || dsaRequired === 1;

  return (
    <div className="card card-hover p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-lg bg-surface-container-highest flex items-center justify-center shrink-0 border border-outline-variant/40 overflow-hidden">
          {logo
            ? <img src={logo} alt={company.name} className="object-contain w-8 h-8" />
            : <span className="text-xl font-bold text-primary">{(company.name || '?')[0].toUpperCase()}</span>
          }
        </div>
        <div>
          <h3 className="text-lg font-semibold text-on-surface leading-tight">{company.name}</h3>
          {company.cpi && (
            <p className="text-[13px] font-mono text-primary mt-0.5">Min GPA: {company.cpi}</p>
          )}
        </div>
      </div>

      {/* Skills */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Skills</p>
        <div className="flex flex-wrap gap-1.5">
          {skills.slice(0, 4).map((skill, i) => (
            <span key={i} className="chip">{skill}</span>
          ))}
          {skills.length > 4 && <span className="chip">+{skills.length - 4}</span>}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-auto pt-4 border-t border-outline-variant/60 flex flex-col gap-2">
        {company.internshipRole && (
          <div className="flex justify-between items-center text-sm">
            <span className="text-on-surface-variant">Role</span>
            <span className="text-on-surface font-medium">{company.internshipRole}</span>
          </div>
        )}
        <div className="flex justify-between items-center text-sm">
          <span className="text-on-surface-variant">DSA Required</span>
          <span
            className="px-2 py-0.5 rounded text-[11px] font-bold border"
            style={
              dsaYes
                ? { background: 'rgba(34,197,94,0.1)', color: '#4ade80', borderColor: 'rgba(34,197,94,0.3)' }
                : { background: 'rgba(244,63,94,0.1)', color: '#fb7185', borderColor: 'rgba(244,63,94,0.3)' }
            }
          >
            {dsaYes ? 'Yes' : 'No'}
          </span>
        </div>
      </div>
    </div>
  );
};

const CompaniesShowcase = () => {
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);
  const PER_PAGE = 6;

  const fetchCompanies = async () => {
    setLoading(true);
    try {
      const res = await getCompanies();
      setCompanies(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanies();
  }, []);

  const filtered = companies.filter(c =>
    (c.name || '').toLowerCase().includes(search.toLowerCase())
  );
  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paged = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

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
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
          <button className="flex items-center gap-2 border border-outline-variant rounded-lg px-6 py-3 text-on-surface hover:border-primary hover:text-primary transition-colors text-sm shrink-0"
            style={{ background: '#2A2E50' }}>
            <span className="material-symbols-outlined text-[18px]">filter_list</span>
            Filters
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 rounded-lg px-6 py-3 text-white transition-all text-sm shrink-0 font-medium btn-primary">
            <span className="material-symbols-outlined text-[18px]">add</span>
            Add Company / JD
          </button>
        </div>

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
            {search ? 'No companies match your search.' : 'No companies found. Add some companies first!'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {paged.map((company, i) => (
              <CompanyCard key={company._id || i} company={company} />
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
            fetchCompanies();
          }} 
        />
      )}
    </div>
  );
};

export default CompaniesShowcase;
