import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { uploadResume, getUploadStatus, getResumes, getCompanies } from '../../services/api';
import FeaturesSection from './FeaturesSection';
import PopularCompanies from './PopularCompanies';
const UploadStep = ({ title, desc, status, progress }) => {
  // status: 'done' | 'active' | 'pending'
  return (
    <div className="flex gap-4">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 z-10 transition-all ${
          status === 'done'
            ? 'bg-primary text-white'
            : status === 'active'
            ? 'border-2 border-primary bg-background'
            : 'border-2 border-outline-variant bg-background'
        }`}
      >
        {status === 'done' && (
          <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            check
          </span>
        )}
        {status === 'active' && <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />}
      </div>
      <div className={status === 'pending' ? 'opacity-50' : ''}>
        <h4 className={`text-[15px] font-semibold ${status === 'active' ? 'text-primary' : 'text-on-surface'}`}>
          {title}
        </h4>
        <p className="text-sm text-on-surface-variant mt-1">{desc}</p>
        {status === 'active' && (
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-surface-container-highest">
              <div className="h-full rounded-full bg-primary animate-pulse" style={{ width: '100%' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const StatCard = ({ icon, label, value }) => (
  <div className="card card-hover flex items-center gap-4 p-5">
    <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center shrink-0">
      <span className="material-symbols-outlined text-primary">{icon}</span>
    </div>
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-on-surface-variant mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <h4 className="text-2xl font-bold text-on-surface">{value}</h4>
        <span className="text-xs font-mono text-secondary inline-flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-secondary animate-pulse" />
          Live
        </span>
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | done
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadStep, setUploadStep] = useState(0); // 0=none, 1=uploaded, 2=parsing, 3=embedding, 4=ranked
  const fileInputRef = useRef();
  const navigate = useNavigate();
  const isMountedRef = useRef(true);
  const pollTimeoutRef = useRef(null);

  const { data: resumesData } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => getResumes().then((r) => r.data),
    initialData: [],
  });

  const { data: companiesData } = useQuery({
    queryKey: ['companies'],
    queryFn: () => getCompanies().then((r) => r.data),
    initialData: [],
  });

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (pollTimeoutRef.current) clearTimeout(pollTimeoutRef.current);
    };
  }, []);

  const resumes = Array.isArray(resumesData) ? resumesData : [];
  const companies = Array.isArray(companiesData) ? companiesData : [];
  const rankingsCount = resumes.reduce((acc, res) => {
    const rj = typeof res.rankings === 'string' ? JSON.parse(res.rankings || '[]') : res.rankings || [];
    return acc + (Array.isArray(rj) ? rj.length : 0);
  }, 0);
  
  const stats = { resumes: resumes.length, companies: companies.length, rankings: rankingsCount };

  const ACCEPTED_EXTENSIONS = ['.pdf', '.docx', '.doc'];
  const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      alert('Please upload a PDF or DOCX file.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      alert('File is too large. Max size is 10MB.');
      return;
    }
    setUploadedFile(file);
    setUploadStep(1);
    setUploadStatus('uploading');

    const formData = new FormData();
    formData.append('resume', file);

    try {
      const res = await uploadResume(formData);
      if (res.status === 200 || res.status === 201) {
        const jobId = res.data.job_id;
        const MAX_POLL_ATTEMPTS = 100; // ~5 minutes at 3s intervals

        const pollStatus = async (attempt = 0) => {
          if (!isMountedRef.current) return;
          if (attempt >= MAX_POLL_ATTEMPTS) {
            setUploadStatus('idle');
            setUploadStep(0);
            alert('Upload is taking too long. Please try again later.');
            return;
          }
          try {
            const statusRes = await getUploadStatus(jobId);
            if (!isMountedRef.current) return;
            const { status, step, error } = statusRes.data;

            if (status === 'completed') {
               setUploadStep(4);
               setUploadStatus('done');
               // Add a tiny delay so user sees the 'done' state before navigating
               pollTimeoutRef.current = setTimeout(() => {
                 navigate(`/resumes/${statusRes.data.resume_id}`);
               }, 1000);
            } else if (status === 'error') {
               setUploadStatus('idle');
               setUploadStep(0);
               alert('Upload failed: ' + error);
            } else {
               if (step === 'Parsing resume with AI...') setUploadStep(1);
               else if (step === 'Generating Embeddings...') setUploadStep(2);
               else if (step === 'Calculating ATS Score...') setUploadStep(2);
               else if (step === 'Matching Companies...') setUploadStep(3);
               else if (step === 'Saving to Database...') setUploadStep(3);

               pollTimeoutRef.current = setTimeout(() => pollStatus(attempt + 1), 3000);
            }
          } catch (err) {
            if (!isMountedRef.current) return;
            setUploadStatus('idle');
            setUploadStep(0);
            alert('Polling failed: ' + err.message);
          }
        };

        pollStatus();
      } else {
        setUploadStatus('idle');
        setUploadStep(0);
        alert('Upload failed. Please try again.');
      }
    } catch (e) {
      setUploadStatus('idle');
      setUploadStep(0);
      alert('Server error: ' + e.message);
    }
  };

  const getStepStatus = (step) => {
    if (uploadStep > step) return 'done';
    if (uploadStep === step) return 'active';
    return 'pending';
  };

  return (
    <div className="flex-1 overflow-y-auto relative">
      {/* one soft ambient wash — quiet, not neon */}
      <div
        className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'rgba(108,99,255,0.06)', filter: 'blur(140px)' }}
      />

      <div className="relative z-10 max-w-6xl mx-auto px-6 md:px-8 py-10 flex flex-col gap-10 min-h-full">
        {/* Hero + Upload / Stepper */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1 items-center">
          {/* Left */}
          <div className="lg:col-span-7 flex flex-col gap-8">
            <div className="space-y-4 max-w-xl">
              <h2 className="text-[38px] leading-[1.15] font-bold tracking-tight text-on-surface font-display">
                Find Your Perfect{' '}
                <span
                  className="bg-clip-text text-transparent"
                  style={{ backgroundImage: 'linear-gradient(90deg, #6c63ff, #89ceff)' }}
                >
                  Company Match
                </span>
              </h2>
              <p className="text-base text-on-surface-variant leading-relaxed">
                Upload your resume and let our AI match you with the best companies. Our parsing and embedding engine
                ranks you exactly where your skills shine.
              </p>
            </div>

            {/* Upload Zone */}
            <div
              role="button"
              tabIndex={0}
              className="relative flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-200 p-10 h-64 group"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='16' ry='16' stroke='%23${
                  dragOver ? '6c63ff' : '3d416d'
                }' stroke-width='2' stroke-dasharray='7%2c 8' stroke-linecap='round'/%3e%3c/svg%3e")`,
                backgroundColor: dragOver ? 'rgba(108,99,255,0.06)' : 'rgba(26,29,58,0.4)',
                borderRadius: '16px',
              }}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFile(e.dataTransfer.files[0]);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
              <div
                className="w-16 h-16 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center mb-5 transition-colors group-hover:border-primary/40"
              >
                <span className="material-symbols-outlined text-4xl text-primary">cloud_upload</span>
              </div>
              {uploadedFile ? (
                <>
                  <h3 className="text-lg font-semibold text-primary mb-1">{uploadedFile.name}</h3>
                  <p className="text-sm text-on-surface-variant">
                    {uploadStatus === 'done' ? 'Uploaded successfully' : 'Processing…'}
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-lg font-semibold text-on-surface mb-1 group-hover:text-primary transition-colors">
                    Drag &amp; drop your resume here
                  </h3>
                  <p className="text-sm text-on-surface-variant">
                    or <span className="text-tertiary underline underline-offset-4 decoration-tertiary/40">click to browse</span>
                  </p>
                  <p className="text-xs text-on-surface-variant mt-5">Supports PDF or DOCX files (Max 10MB)</p>
                </>
              )}
            </div>
          </div>

          {/* Right: Status Stepper */}
          <div className="lg:col-span-5">
            <div className="panel p-6 h-full min-h-[380px] flex flex-col justify-center relative overflow-hidden">
              <div
                className="absolute top-0 right-0 w-48 h-48 rounded-full pointer-events-none"
                style={{ background: 'rgba(108,99,255,0.08)', filter: 'blur(60px)', transform: 'translate(30%,-30%)' }}
              />
              <div className="relative z-10 flex flex-col gap-2">
                {[
                  { s: 1, t: 'Upload Resume', d: 'Your resume has been uploaded.' },
                  { s: 2, t: 'Parsing Resume', d: 'Extracting text, skills, and structure.' },
                  { s: 3, t: 'AI Embedding', d: 'Generating vector embeddings for matching.' },
                  { s: 4, t: 'Ranked', d: 'Matching with top-tier companies.' },
                ].map((step, i, arr) => (
                  <React.Fragment key={step.s}>
                    <UploadStep status={getStepStatus(step.s)} title={step.t} desc={step.d} />
                    {i < arr.length - 1 && (
                      <div
                        className="w-0.5 h-6 ml-3 rounded-full transition-colors"
                        style={{ background: uploadStep > step.s ? '#6c63ff' : '#343753' }}
                      />
                    )}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard icon="description" label="Total Resumes" value={stats.resumes.toLocaleString()} />
          <StatCard icon="domain" label="Total Companies" value={stats.companies.toLocaleString()} />
          <StatCard icon="trending_up" label="Active Rankings" value={stats.rankings.toLocaleString()} />
        </div>
        
        {/* Features Section */}
        <FeaturesSection />
        
        {/* Popular Companies Section */}
        <PopularCompanies />
      </div>
    </div>
  );
};

export default Dashboard;
