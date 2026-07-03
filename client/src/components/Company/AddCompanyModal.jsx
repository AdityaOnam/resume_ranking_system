import React, { useState } from 'react';

const AddCompanyModal = ({ onClose, onSaved }) => {
  const [jdText, setJdText] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [parsedData, setParsedData] = useState(null);

  // Form fields
  const [formData, setFormData] = useState({
    name: '',
    cpi: 0,
    skill_set: [],
    internship_role: '',
    min_projects: 0,
    dsa_required: false,
    description: ''
  });

  const handleParse = async () => {
    if (!jdText.trim()) return;
    setIsParsing(true);
    try {
      const res = await fetch('http://127.0.0.1:5000/api/companies/parse-jd', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: jdText })
      });
      if (res.ok) {
        const data = await res.json();
        setParsedData(data);
        setFormData({
          name: data.name || '',
          cpi: data.cpi || 0,
          skill_set: Array.isArray(data.skill_set) ? data.skill_set : [],
          internship_role: data.internship_role || '',
          min_projects: data.min_projects || 0,
          dsa_required: data.dsa_required || false,
          description: data.description || ''
        });
      } else {
        alert("Failed to parse Job Description");
      }
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
      const res = await fetch('http://127.0.0.1:5000/api/companies/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (res.ok) {
        onSaved();
      } else {
        const err = await res.json();
        alert(err.detail || "Failed to save company");
      }
    } catch (e) {
      console.error(e);
      alert("Error saving company");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" style={{ background: 'rgba(15, 16, 35, 0.8)', backdropFilter: 'blur(8px)' }}>
      <div className="cyber-panel w-full max-w-4xl max-h-full flex flex-col overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1" style={{ background: 'linear-gradient(90deg, #6C63FF, #8B5CF6)' }} />
        
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-on-surface font-display tracking-tight flex items-center gap-2">
            <span className="material-symbols-outlined text-primary">add_business</span>
            Add Company / Job Description
          </h2>
          <button onClick={onClose} className="text-on-surface-variant hover:text-white transition-colors p-1 rounded hover:bg-white/10">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: JD Input */}
          <div className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-semibold uppercase tracking-wider text-outline mb-2">Raw Job Description</label>
              <textarea
                className="w-full h-80 rounded-lg p-4 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
                style={{ background: '#1C1F3F', border: '1px solid #343753' }}
                placeholder="Paste the raw job description here... Our AI will automatically extract the requirements, skills, and eligibility criteria."
                value={jdText}
                onChange={e => setJdText(e.target.value)}
              />
            </div>
            <button 
              onClick={handleParse} 
              disabled={isParsing || !jdText.trim()}
              className="flex items-center justify-center gap-2 py-3 rounded-lg font-medium transition-all disabled:opacity-50"
              style={{ background: 'rgba(108, 99, 255, 0.1)', border: '1px solid rgba(108, 99, 255, 0.4)', color: '#6C63FF' }}>
              {isParsing ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                <span className="material-symbols-outlined">auto_awesome</span>
              )}
              {isParsing ? 'Parsing with Llama 3.1...' : 'Auto-Fill with AI'}
            </button>
          </div>

          {/* Right Column: Parsed Form */}
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-outline mb-1 uppercase tracking-wider">Company Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  style={{ background: '#1C1F3F', border: '1px solid #343753' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-outline mb-1 uppercase tracking-wider">Role</label>
                <input
                  type="text"
                  value={formData.internship_role}
                  onChange={e => setFormData({...formData, internship_role: e.target.value})}
                  className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  style={{ background: '#1C1F3F', border: '1px solid #343753' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-outline mb-1 uppercase tracking-wider">Min GPA/CPI</label>
                <input
                  type="number" step="0.1"
                  value={formData.cpi}
                  onChange={e => setFormData({...formData, cpi: parseFloat(e.target.value) || 0})}
                  className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  style={{ background: '#1C1F3F', border: '1px solid #343753' }}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-outline mb-1 uppercase tracking-wider">Min Projects</label>
                <input
                  type="number"
                  value={formData.min_projects}
                  onChange={e => setFormData({...formData, min_projects: parseInt(e.target.value) || 0})}
                  className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  style={{ background: '#1C1F3F', border: '1px solid #343753' }}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-outline mb-1 uppercase tracking-wider">Required Skills (Comma separated)</label>
              <input
                type="text"
                value={formData.skill_set.join(', ')}
                onChange={e => setFormData({...formData, skill_set: e.target.value.split(',').map(s => s.trim()).filter(s => s)})}
                className="w-full rounded-lg px-3 py-2 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                style={{ background: '#1C1F3F', border: '1px solid #343753' }}
              />
            </div>

            <div className="flex items-center gap-3 mt-2">
              <input
                type="checkbox"
                id="dsa"
                checked={formData.dsa_required}
                onChange={e => setFormData({...formData, dsa_required: e.target.checked})}
                className="w-4 h-4 rounded text-primary focus:ring-primary"
                style={{ background: '#1C1F3F', border: '1px solid #343753' }}
              />
              <label htmlFor="dsa" className="text-sm text-on-surface">Data Structures &amp; Algorithms Required</label>
            </div>

            <div>
              <label className="block text-xs font-semibold text-outline mb-1 mt-2 uppercase tracking-wider">Brief Description</label>
              <textarea
                className="w-full h-24 rounded-lg p-3 text-sm text-on-surface focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-none"
                style={{ background: '#1C1F3F', border: '1px solid #343753' }}
                value={formData.description}
                onChange={e => setFormData({...formData, description: e.target.value})}
              />
            </div>
            
            <div className="mt-auto pt-4 flex justify-end gap-3 border-t border-outline-variant/30">
              <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium text-on-surface-variant hover:text-white transition-colors">
                Cancel
              </button>
              <button 
                onClick={handleSave}
                disabled={isSaving || !formData.name}
                className="btn-primary flex items-center gap-2">
                {isSaving ? <span className="material-symbols-outlined animate-spin text-[18px]">sync</span> : <span className="material-symbols-outlined text-[18px]">save</span>}
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
