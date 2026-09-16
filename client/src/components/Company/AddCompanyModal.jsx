import React, { useState } from 'react';
import { parseJobDescription, createCompany } from '../../services/api';
import { PiBuildings, PiX, PiSparkle, PiSpinnerGap, PiFloppyDisk } from 'react-icons/pi';

const AddCompanyModal = ({ onClose, onSaved }) => {
  const [jdText, setJdText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    cpi: 0,
    skill_set: [],
    internship_role: '',
    min_projects: 0,
    dsa_required: false,
    visits_iit_patna: false,
    jd_text: ''
  });

  const handleParse = async () => {
    if (!jdText.trim()) return;
    setIsParsing(true);
    try {
      const res = await parseJobDescription(jdText);
      const data = res.data;
      setFormData({
        name: data.name || '',
        cpi: data.cpi || 0,
        skill_set: Array.isArray(data.skill_set) ? data.skill_set : [],
        internship_role: data.internship_role || '',
        min_projects: data.min_projects || 0,
        dsa_required: data.dsa_required || false,
        visits_iit_patna: data.visits_iit_patna || false,
        jd_text: jdText
      });
    } catch (e) {
      console.error(e);
      alert("Error parsing Job Description");
    } finally {
      setIsParsing(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name) return alert("Company name is required");
    setIsSaving(true);
    try {
      await createCompany(formData);
      onSaved();
    } catch (e) {
      console.error(e);
      alert(e.response?.data?.detail || "Error saving company");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-bg/80 backdrop-blur-sm">
      <div className="w-full max-w-4xl max-h-full flex flex-col overflow-hidden relative bg-surface border border-line rounded-xl shadow-2xl">
        <div className="absolute top-0 left-0 w-full h-1" style={{ background: 'linear-gradient(90deg, var(--rr-accent), var(--rr-tint))' }} />
        
        <div className="flex justify-between items-center p-6 border-b border-line">
          <h2 className="text-xl font-bold text-text font-display tracking-tight flex items-center gap-2.5 m-0">
            <PiBuildings className="text-accent" size={24} />
            Add Company / Job Description
          </h2>
          <button 
            onClick={onClose} 
            className="w-8 h-8 flex items-center justify-center text-muted hover:text-text rounded-md hover:bg-surface-2 transition-colors border-0 bg-transparent cursor-pointer"
          >
            <PiX size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-surface">
          {/* Left Column: JD Input */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-wider text-muted mb-2">Raw Job Description</label>
              <textarea
                className="w-full h-80 rounded-lg p-4 text-[13px] text-text placeholder:text-muted focus:outline-none focus:border-accent transition-all resize-none bg-surface-2 border border-line"
                placeholder="Paste the raw job description here... Our AI will automatically extract the requirements, skills, and eligibility criteria."
                value={jdText}
                onChange={e => setJdText(e.target.value)}
              />
            </div>
            <button 
              onClick={handleParse} 
              disabled={isParsing || !jdText.trim()}
              className="flex items-center justify-center gap-2 h-11 rounded-lg font-medium transition-all disabled:opacity-50 text-[13px] bg-tint text-accent border border-accent cursor-pointer hover:bg-tint-strong">
              {isParsing ? (
                <PiSpinnerGap className="animate-spin" size={18} />
              ) : (
                <PiSparkle size={18} />
              )}
              {isParsing ? 'Parsing with AI...' : 'Auto-Fill with AI'}
            </button>
          </div>

          {/* Right Column: Parsed Form */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1 uppercase tracking-wider">Company Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full h-9 rounded-md px-3 text-[13px] text-text focus:outline-none focus:border-accent bg-surface-2 border border-line"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1 uppercase tracking-wider">Role</label>
                <input
                  type="text"
                  value={formData.internship_role}
                  onChange={e => setFormData({...formData, internship_role: e.target.value})}
                  className="w-full h-9 rounded-md px-3 text-[13px] text-text focus:outline-none focus:border-accent bg-surface-2 border border-line"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1 uppercase tracking-wider">Min GPA/CPI</label>
                <input
                  type="number" step="0.1"
                  value={formData.cpi}
                  onChange={e => setFormData({...formData, cpi: parseFloat(e.target.value) || 0})}
                  className="w-full h-9 rounded-md px-3 text-[13px] text-text focus:outline-none focus:border-accent bg-surface-2 border border-line"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-muted mb-1 uppercase tracking-wider">Min Projects</label>
                <input
                  type="number"
                  value={formData.min_projects}
                  onChange={e => setFormData({...formData, min_projects: parseInt(e.target.value) || 0})}
                  className="w-full h-9 rounded-md px-3 text-[13px] text-text focus:outline-none focus:border-accent bg-surface-2 border border-line"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1 uppercase tracking-wider">Required Skills (Comma separated)</label>
              <input
                type="text"
                value={formData.skill_set.join(', ')}
                onChange={e => setFormData({...formData, skill_set: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                className="w-full h-9 rounded-md px-3 text-[13px] text-text focus:outline-none focus:border-accent bg-surface-2 border border-line"
              />
            </div>

            <div className="flex items-center gap-3 mt-2">
              <input
                type="checkbox"
                id="dsa"
                checked={formData.dsa_required}
                onChange={e => setFormData({...formData, dsa_required: e.target.checked})}
                className="w-4 h-4 rounded text-accent bg-surface-2 border-line focus:ring-accent"
              />
              <label htmlFor="dsa" className="text-[13px] text-text">Data Structures &amp; Algorithms Required</label>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="visitsIitPatna"
                checked={formData.visits_iit_patna}
                onChange={e => setFormData({...formData, visits_iit_patna: e.target.checked})}
                className="w-4 h-4 rounded text-accent bg-surface-2 border-line focus:ring-accent"
              />
              <label htmlFor="visitsIitPatna" className="text-[13px] text-text">Visits Campus for Hiring</label>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-muted mb-1 mt-2 uppercase tracking-wider">Job Description Text</label>
              <textarea
                className="w-full h-24 rounded-lg p-3 text-[13px] text-text focus:outline-none focus:border-accent resize-none bg-surface-2 border border-line"
                value={formData.jd_text}
                onChange={e => setFormData({...formData, jd_text: e.target.value})}
              />
            </div>
            
            <div className="mt-auto pt-4 flex justify-end gap-3 border-t border-line">
              <button 
                onClick={onClose} 
                className="px-4 py-2 rounded-md text-[13px] font-medium text-muted hover:text-text transition-colors bg-transparent border-0 cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving || !formData.name}
                className="h-9 px-4 rounded-md bg-accent text-bg font-sans text-[13px] font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity border-0 cursor-pointer"
              >
                {isSaving ? <PiSpinnerGap className="animate-spin" size={16} /> : <PiFloppyDisk size={16} />}
                {isSaving ? 'Saving...' : 'Save Company'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AddCompanyModal;
