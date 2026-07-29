import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { uploadResume, getUploadStatus, getResumes, getCompanies } from '../../services/api';
import FeaturesSection from './FeaturesSection';
import PopularCompanies from './PopularCompanies';
import { 
  PiFileArrowUp, PiFilePdf, PiHardDrives, PiLockSimple, 
  PiFileMagnifyingGlass, PiGraph, PiRanking, PiCheckCircle,
  PiArrowRight, PiArrowCounterClockwise, PiCheck
} from 'react-icons/pi';

const Dashboard = () => {
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | done
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [uploadStep, setUploadStep] = useState(0); // 0=none, 1=uploaded, 2=parsing, 3=embedding, 4=ranked
  const [completedResumeId, setCompletedResumeId] = useState(null);
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
        const MAX_POLL_ATTEMPTS = 100;

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
               setCompletedResumeId(statusRes.data.resume_id);
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

  const stepsData = [
    { id: 1, title: 'Parse', desc: 'Extracting sections, skills and dates.', icon: PiFileMagnifyingGlass },
    { id: 2, title: 'Embed', desc: 'Generating vectors and the ATS score.', icon: PiGraph },
    { id: 3, title: 'Rank', desc: 'Scoring against 96 indexed companies.', icon: PiRanking },
  ];

  const getStepState = (stepId) => {
    // 0=none, 1=uploaded/parsing, 2=embedding/scoring, 3=matching, 4=done
    if (uploadStatus === 'done' || uploadStep > stepId) return 'done';
    if (uploadStep === stepId) return 'active';
    return 'pending';
  };

  const resetPipeline = () => {
    setUploadStatus('idle');
    setUploadStep(0);
    setUploadedFile(null);
    setCompletedResumeId(null);
  };

  return (
    <div className="flex-1 overflow-y-auto relative w-full bg-bg">
      <div className="max-w-[1180px] mx-auto px-6 md:px-8 py-10 flex flex-col gap-10 min-h-full">
        {/* Upload & Pipeline */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 items-start">
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-2 text-[11px] tracking-[0.10em] uppercase text-muted">
              <span className="w-[18px] h-[1px] bg-accent"></span>Resume intelligence
            </div>
            <h1 className="m-0 text-[44px] leading-[1.08] tracking-[-0.025em] max-w-[15ch] text-text font-display">
              Find the companies your resume already fits.
            </h1>
            <p className="m-0 max-w-[46ch] text-muted leading-[1.6] text-base">
              Upload once. We parse the document, embed your skills, score it against every open role in the index, and rank the matches — with the gaps spelled out.
            </p>

            <div
              role="button"
              tabIndex="0"
              className={`p-5 rounded-xl border flex items-center gap-4 transition-all duration-200 cursor-pointer ${
                dragOver 
                  ? 'border-accent bg-tint border-dashed' 
                  : uploadStatus === 'idle'
                  ? 'border-line bg-surface-2 hover:border-line-strong'
                  : 'border-line-strong bg-surface pointer-events-none'
              }`}
              onClick={() => uploadStatus === 'idle' && fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (uploadStatus === 'idle') setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (uploadStatus === 'idle') handleFile(e.dataTransfer.files[0]);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.doc"
                className="hidden"
                onChange={(e) => handleFile(e.target.files[0])}
              />
              <div className="w-[46px] h-[46px] shrink-0 rounded-md border border-line-strong flex items-center justify-center text-accent bg-surface">
                {uploadStatus === 'done' ? <PiCheckCircle size={22} /> : <PiFileArrowUp size={22} />}
              </div>
              <div className="flex flex-col gap-1 min-w-0">
                <span className="font-sans font-medium text-[15px] text-text truncate">
                  {uploadedFile ? uploadedFile.name : 'Upload your resume'}
                </span>
                <span className="text-[13px] text-muted">
                  {uploadStatus === 'uploading' ? 'Processing...' : uploadStatus === 'done' ? 'Complete' : 'Drag and drop or click to browse'}
                </span>
              </div>
              {uploadStatus === 'idle' && (
                <div className="ml-auto hidden sm:flex items-center gap-1.5 h-8 px-3.5 border border-accent rounded-md text-accent font-sans font-medium text-[13px] whitespace-nowrap">
                  Browse files
                </div>
              )}
            </div>

            <div className="flex items-center flex-wrap gap-x-[18px] gap-y-2 text-xs text-muted">
              <span className="flex items-center gap-1.5 whitespace-nowrap"><PiFilePdf size={14} />PDF or DOCX</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap"><PiHardDrives size={14} />Max 10 MB</span>
              <span className="flex items-center gap-1.5 whitespace-nowrap"><PiLockSimple size={14} />Private to your account</span>
            </div>
          </div>

          <div className="border border-line rounded-xl bg-surface overflow-hidden shadow-lg" style={{ boxShadow: 'var(--rr-shadow)' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-line">
              <span className="font-sans font-medium text-[13px] text-text">Pipeline</span>
              <span className="flex items-center gap-1.5 text-[11px] tracking-[0.08em] uppercase text-muted">
                {uploadStatus === 'uploading' ? (
                  <><span className="relative flex w-1.5 h-1.5"><span className="absolute -inset-1 rounded-full bg-accent/40 animate-ping"></span><span className="w-1.5 h-1.5 rounded-full bg-accent"></span></span> RUNNING</>
                ) : uploadStatus === 'done' ? (
                  <><span className="w-1.5 h-1.5 rounded-full bg-success"></span> DONE</>
                ) : (
                  <><span className="w-1.5 h-1.5 rounded-full bg-line-strong"></span> IDLE</>
                )}
              </span>
            </div>
            
            <div className="px-5 pt-[22px] pb-6 flex flex-col gap-0.5">
              {stepsData.map((step, i) => {
                const state = getStepState(step.id);
                const Icon = step.icon;
                const isLast = i === stepsData.length - 1;
                
                return (
                  <div key={step.id} className="grid grid-cols-[22px_1fr] gap-3.5">
                    <div className="flex flex-col items-center gap-1">
                      <div className={`w-[22px] h-[22px] rounded-full flex items-center justify-center shrink-0 border ${
                        state === 'done' ? 'border-accent bg-tint text-accent' :
                        state === 'active' ? 'border-accent bg-transparent text-accent animate-pulse-slow' :
                        'border-line-strong bg-transparent text-muted'
                      }`}>
                        {state === 'done' ? <PiCheck size={12} /> : <Icon size={12} />}
                      </div>
                      <div className={`w-px flex-1 min-h-[34px] ${isLast ? 'min-h-[0px] hidden' : ''} ${
                        state === 'done' || (state === 'active' && uploadStep > step.id) ? 'bg-accent' : 'bg-line-strong'
                      }`} />
                    </div>
                    <div className="pb-[18px]">
                      <div className={`font-sans font-medium text-sm ${state !== 'pending' ? 'text-text' : 'text-muted'}`}>
                        {step.title}
                      </div>
                      <div className="text-[13px] text-muted mt-0.5">{step.desc}</div>
                      {state === 'active' && (
                        <div className="mt-2.5 h-[3px] rounded-full bg-line-strong overflow-hidden relative">
                          <div className="absolute top-0 bottom-0 left-0 w-2/5 bg-accent rounded-full animate-[rr-sweep_1.2s_ease-in-out_infinite]" />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            
            <div className="px-5 py-3.5 border-t border-line bg-surface-2 flex items-center justify-between gap-3">
              <span className="text-xs text-muted">
                {uploadStatus === 'done' ? 'Results saved.' : uploadStatus === 'uploading' ? 'Please wait...' : 'Awaiting upload.'}
              </span>
              <div className="flex items-center gap-3 ml-auto">
                {uploadStatus === 'done' && completedResumeId && (
                  <button onClick={() => navigate(`/resumes/${completedResumeId}`)} className="flex items-center gap-1.5 h-7 px-3 border border-accent rounded-md bg-transparent text-accent font-sans text-xs hover:bg-tint transition-colors">
                    View ranking<PiArrowRight size={13} />
                  </button>
                )}
                {(uploadStatus === 'done' || uploadStatus === 'error') && (
                  <button onClick={resetPipeline} className="border-0 bg-transparent text-muted font-sans text-xs flex items-center gap-1.5 hover:text-accent transition-colors">
                    <PiArrowCounterClockwise size={13} />Reset
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-px bg-line border border-line rounded-xl overflow-hidden">
          <div className="bg-surface px-6 py-5 flex flex-col gap-1.5">
            <span className="text-[11px] tracking-[0.09em] uppercase text-muted">Resumes analysed</span>
            <span className="font-display text-[30px] tracking-[-0.02em] text-text">{stats.resumes.toLocaleString()}</span>
            <span className="text-xs text-muted">Uploaded by you</span>
          </div>
          <div className="bg-surface px-6 py-5 flex flex-col gap-1.5">
            <span className="text-[11px] tracking-[0.09em] uppercase text-muted">Companies indexed</span>
            <span className="font-display text-[30px] tracking-[-0.02em] text-text">{stats.companies.toLocaleString()}</span>
            <span className="text-xs text-muted">In the index</span>
          </div>
          <div className="bg-surface px-6 py-5 flex flex-col gap-1.5">
            <span className="text-[11px] tracking-[0.09em] uppercase text-muted">Active rankings</span>
            <span className="font-display text-[30px] tracking-[-0.02em] text-text">{stats.rankings.toLocaleString()}</span>
            <span className="text-xs text-muted">Across your resumes</span>
          </div>
        </section>

        {/* Features & Popular Companies */}
        <FeaturesSection />
        <PopularCompanies />
      </div>
    </div>
  );
};

export default Dashboard;
