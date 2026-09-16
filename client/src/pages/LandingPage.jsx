import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiArrowRight, PiFileMagnifyingGlass, PiSparkle, PiMagnifyingGlass } from 'react-icons/pi';

const TICKER = [
  'Aditya just scored 78 on ATS · 2s ago',
  '14 new roles indexed at Texas Instruments · 1m ago',
  'Median turnaround this hour: 34s',
  'Priya moved from 64 → 81 after two fixes · 4m ago',
];

const LAND = [
  ['Nvidia', 'Systems Software Intern', 91, [['Skill overlap', 27, 30], ['Resume ↔ JD match', 26, 30], ['Project relevance', 14, 15]], 'Strong systems signal — CUDA and C++ both matched, plus two GPU-adjacent projects.'],
  ['Texas Instruments', 'Digital Design Intern', 88, [['Skill overlap', 26, 30], ['Resume ↔ JD match', 25, 30], ['Project relevance', 13, 15]], 'Verilog and SystemVerilog matched; no tape-out or DFT exposure listed yet.'],
  ['Google', 'SWE Intern, Infrastructure', 79, [['Skill overlap', 23, 30], ['Resume ↔ JD match', 24, 30], ['Project relevance', 11, 15]], 'Meets the CGPA bar, but distributed-systems coursework was not detected.'],
  ['Goldman Sachs', 'Quant Developer Intern', 63, [['Skill overlap', 17, 30], ['Resume ↔ JD match', 18, 30], ['Project relevance', 9, 15]], 'Python and NumPy matched — no finance exposure and statistics is missing.'],
];
const LAND_EXTRA = [
  ['Quantified impact in bullets', 3],
  ['Tape-out / DFT exposure', 6],
  ['Distributed systems coursework', 18],
  ['Statistics & derivatives depth', 41],
];

// Custom hook for mount-only count up
function useCountUp(durationMs = 1200) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    let startTime = null;
    let animationFrameId;

    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const p = Math.min(1, elapsed / durationMs);
      
      setProgress(p);
      
      if (p < 1) {
        animationFrameId = requestAnimationFrame(step);
      }
    };

    animationFrameId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animationFrameId);
  }, [durationMs]);

  const ease = 1 - Math.pow(1 - progress, 3);
  return ease;
}

const LandingPage = () => {
  const navigate = useNavigate();
  const ease = useCountUp(1200);
  
  // Ticker state
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 3000);
    return () => clearInterval(interval);
  }, []);

  // Card stack state
  const [landCo, setLandCo] = useState(0);
  const [landFrom, setLandFrom] = useState(0);
  const [landT, setLandT] = useState(1);
  const landRafRef = useRef(null);

  const pickLand = useCallback((i) => {
    if (i === landCo) return;
    if (landRafRef.current) cancelAnimationFrame(landRafRef.current);
    
    setLandFrom(landCo);
    setLandCo(i);
    setLandT(0);
    
    let startTime = null;
    const step = (timestamp) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const p = Math.min(1, elapsed / 620);
      setLandT(p);
      if (p < 1) {
        landRafRef.current = requestAnimationFrame(step);
      }
    };
    landRafRef.current = requestAnimationFrame(step);
  }, [landCo]);

  // Tilt state
  const [mx, setMx] = useState(0.5);
  const [my, setMy] = useState(0.5);
  const currentTiltRef = useRef({ x: 0.5, y: 0.5 });
  const targetMx = useRef(0.5);
  const targetMy = useRef(0.5);
  const tiltRafRef = useRef(null);

  const runTiltLoop = useCallback(() => {
    if (tiltRafRef.current) return;
    const step = () => {
      const { x: cx, y: cy } = currentTiltRef.current;
      const nx = cx + (targetMx.current - cx) * 0.09;
      const ny = cy + (targetMy.current - cy) * 0.09;
      currentTiltRef.current = { x: nx, y: ny };
      setMx(nx);
      setMy(ny);

      if (Math.abs(nx - targetMx.current) > 0.0008 || Math.abs(ny - targetMy.current) > 0.0008) {
        tiltRafRef.current = requestAnimationFrame(step);
      } else {
        tiltRafRef.current = null;
      }
    };
    tiltRafRef.current = requestAnimationFrame(step);
  }, []);

  const onStage = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    targetMx.current = (e.clientX - r.left) / r.width;
    targetMy.current = (e.clientY - r.top) / r.height;
    runTiltLoop();
  };

  const offStage = () => {
    targetMx.current = 0.5;
    targetMy.current = 0.5;
    runTiltLoop();
  };

  useEffect(() => {
    return () => {
      if (landRafRef.current) cancelAnimationFrame(landRafRef.current);
      if (tiltRafRef.current) cancelAnimationFrame(tiltRafRef.current);
    };
  }, []);

  const landEase = 1 - Math.pow(1 - landT, 3);
  const fromCard = LAND[landFrom];
  const toCard = LAND[landCo];
  const animatedScore = Math.round(fromCard[2] + (toCard[2] - fromCard[2]) * landEase);
  
  const ry = (mx - 0.5) * 22;
  const rx = -(my - 0.5) * 14;

  const n = LAND.length;
  const depth = [
    { x: 0, y: 0, z: 90, s: 1, o: 1, b: 0 },
    { x: 40, y: 34, z: 10, s: 0.95, o: 0.72, b: 0.6 },
    { x: 74, y: 66, z: -70, s: 0.9, o: 0.44, b: 1.4 },
    { x: 102, y: 96, z: -150, s: 0.86, o: 0.24, b: 2.2 },
  ];

  return (
    <div className="flex flex-col min-h-full overflow-y-auto w-full">
      <section className="max-w-[1180px] w-full mx-auto px-7 pt-[60px] pb-[70px] grid grid-cols-1 lg:grid-cols-[1.05fr_1fr] gap-12 items-center">
        <div className="flex flex-col gap-[22px]">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.10em] uppercase text-muted">
            <span className="w-[18px] h-[1px] bg-accent"></span>For final-year engineering students
          </div>
          <h1 className="m-0 text-5xl lg:text-[52px] leading-[1.06] tracking-[-0.03em] max-w-[14ch] text-text font-display">
            Know exactly which companies your resume already fits.
          </h1>
          <p className="m-0 max-w-[46ch] text-base leading-[1.65] text-muted">
            Upload once. We parse it, score it against real ATS criteria, and rank you against every open role in the index — with the exact gaps standing between you and the next tier.
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/login')}
              className="h-11 px-[22px] border border-accent rounded-md bg-accent text-bg font-sans font-medium text-sm cursor-pointer flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              Sign in to get started<PiArrowRight size={16} />
            </button>
          </div>
          <div className="flex items-center gap-[22px] text-[12.5px] text-muted pt-1.5">
            <span><strong className="text-text font-sans font-medium">{Math.round(1284 * ease).toLocaleString('en-US')}</strong> resumes scored</span>
            <span><strong className="text-text font-sans font-medium">{Math.round(96 * ease)}</strong> companies indexed</span>
            <span><strong className="text-text font-sans font-medium">{Math.round(38 * ease)}s</strong> median turnaround</span>
          </div>
          <div className="flex items-center gap-[9px] h-[22px] text-[12.5px] text-muted overflow-hidden relative">
            <span className="relative flex w-[7px] h-[7px] shrink-0">
              <span className="absolute -inset-[3px] rounded-full bg-tint-strong animate-pulse-slow"></span>
              <span className="w-[7px] h-[7px] rounded-full bg-accent relative z-10"></span>
            </span>
            <div className="relative w-full h-full flex items-center">
              <span
                key={tick} // Force re-render animation
                className="absolute whitespace-nowrap animate-ticker"
              >
                {TICKER[tick % TICKER.length]}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[14px]">
          <div className="flex flex-wrap gap-1.5 justify-end">
            {LAND.map((c, i) => {
              const on = i === landCo;
              return (
                <button
                  key={c[0]}
                  onClick={() => pickLand(i)}
                  className={`h-7 px-[11px] border rounded-full font-sans font-medium text-xs transition-all duration-180 ${
                    on ? 'border-accent bg-tint text-accent-text' : 'border-line-strong bg-transparent text-muted hover:border-line'
                  }`}
                >
                  {c[0]}
                </button>
              );
            })}
          </div>
          
          <div 
            onMouseMove={onStage} 
            onMouseLeave={offStage} 
            className="relative h-[430px]" 
            style={{ perspective: '1500px' }}
          >
            <div style={{ position: 'absolute', inset: 0, transformStyle: 'preserve-3d', transform: `rotateX(${rx}deg) rotateY(${ry}deg) translateZ(0)` }}>
              <div style={{ position: 'absolute', left: '30px', top: '60px', width: '300px', height: '260px', borderRadius: '40px', background: 'radial-gradient(closest-side, var(--rr-tint-strong), transparent 75%)', transform: 'translateZ(-200px)' }}></div>

              {LAND.map((c, i) => {
                const k = (i - landCo + n) % n;
                const d = depth[k];
                const pct = (c[2] / 100) * 360;
                const isFront = k === 0;

                return (
                  <div 
                    key={c[0]}
                    onClick={isFront ? undefined : () => pickLand(i)}
                    style={{
                      position: 'absolute', top: '20px', left: '8px', width: '330px', boxSizing: 'border-box', padding: '18px 20px', 
                      display: 'flex', flexDirection: 'column', gap: '7px', 
                      border: `1px solid ${isFront ? 'var(--rr-line-strong)' : 'var(--rr-line)'}`, 
                      borderRadius: 'var(--radius-lg)', 
                      background: `linear-gradient(155deg, ${isFront ? 'var(--rr-tint-strong)' : 'var(--rr-tint)'}, transparent 40%), var(--rr-surface)`, 
                      boxShadow: isFront ? 'var(--rr-shadow), 0 1px 0 var(--rr-tint) inset' : `0 ${10 + k * 4}px ${20 + k * 6}px var(--rr-shadow)`, 
                      transform: `translate3d(${d.x}px, ${d.y}px, ${d.z}px) scale(${d.s})`, 
                      opacity: d.o, 
                      zIndex: 10 - k, 
                      cursor: isFront ? 'default' : 'pointer', 
                      transition: 'transform 620ms cubic-bezier(.2,.7,.3,1), opacity 500ms ease, border-color 300ms ease, box-shadow 400ms ease'
                    }}
                  >
                    <div className="flex items-baseline justify-between gap-2.5">
                      <span className="font-sans font-medium text-sm text-text">{c[0]}</span>
                      <span className="text-[10.5px] tracking-[0.06em] uppercase text-muted">Match</span>
                    </div>
                    <div className="text-[11.5px] text-muted">{c[1]}</div>
                    <div className="flex items-center gap-4 mt-1">
                      <div style={{ position: 'relative', width: '62px', height: '62px', flexShrink: 0, borderRadius: '999px', background: `conic-gradient(var(--rr-accent) ${isFront ? (animatedScore / 100) * 360 * ease : pct}deg, var(--rr-line-strong) 0deg)`, boxShadow: '0 0 0 1px var(--rr-line) inset' }}>
                        <div className="absolute inset-[5px] rounded-full bg-surface flex items-center justify-center font-sans text-[19px] tracking-[-0.02em] text-text" style={{ fontVariantNumeric: 'tabular-nums' }}>
                          {isFront ? animatedScore : c[2]}
                        </div>
                      </div>
                      <div className="flex-1 flex flex-col gap-2">
                        {c[3].map((r, j) => {
                          const fromRow = fromCard[3][j];
                          const rowValue = isFront ? Math.round(fromRow[1] + (r[1] - fromRow[1]) * landEase) : r[1];
                          return (
                            <div key={r[0]}>
                              <div className="flex justify-between text-[11px] text-muted mb-1">
                                <span>{r[0]}</span>
                                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{rowValue} / {r[2]}</span>
                              </div>
                              <div className="h-[3px] rounded-full bg-line-strong overflow-hidden">
                                <div style={{ width: `${(rowValue / r[2]) * 100 * (isFront ? ease : 1)}%`, height: '100%', borderRadius: '999px', background: 'var(--rr-accent)', transition: 'width 600ms ease' }}></div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="border-t border-line pt-[11px] mt-0.5 text-xs text-muted leading-[1.5]">
                      {c[4]}
                    </div>
                  </div>
                );
              })}

              <div style={{ position: 'absolute', right: '-18px', bottom: '46px', display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '190px', padding: '11px 14px', border: '1px solid var(--rr-line-strong)', borderRadius: 'var(--radius-md)', background: 'var(--rr-surface)', boxShadow: 'var(--rr-shadow)', transform: 'translateZ(140px)', animation: 'float-2 6.5s ease-in-out infinite', zIndex: 20 }}>
                <span className="text-[10.5px] tracking-[0.06em] uppercase text-muted">Top gap</span>
                <span className="text-xs text-text">{LAND_EXTRA[landCo][0]}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-[1180px] w-full mx-auto px-7 pb-[88px] grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="border border-line rounded-xl bg-surface p-6 flex flex-col gap-3 transition-all duration-200 hover:border-accent hover:shadow-lg hover:[transform:perspective(800px)_rotateX(5deg)_translateY(-6px)]" style={{ transformStyle: 'preserve-3d' }}>
          <PiFileMagnifyingGlass size={24} className="text-accent" />
          <h3 className="m-0 text-[17px] font-display text-text">One upload, every company</h3>
          <p className="m-0 text-[13.5px] leading-[1.6] text-muted">Parse once, get scored against 96 job descriptions at once — no separate applications to tailor.</p>
        </div>
        <div className="border border-line rounded-xl bg-surface p-6 flex flex-col gap-3 transition-all duration-200 hover:border-accent hover:shadow-lg hover:[transform:perspective(800px)_rotateX(5deg)_translateY(-6px)]" style={{ transformStyle: 'preserve-3d' }}>
          <PiMagnifyingGlass size={24} className="text-accent" />
          <h3 className="m-0 text-[17px] font-display text-text">Real ATS scoring</h3>
          <p className="m-0 text-[13.5px] leading-[1.6] text-muted">The same five categories applicant-tracking systems check — contact info, formatting, quantified impact, verbs and keywords.</p>
        </div>
        <div className="border border-line rounded-xl bg-surface p-6 flex flex-col gap-3 transition-all duration-200 hover:border-accent hover:shadow-lg hover:[transform:perspective(800px)_rotateX(5deg)_translateY(-6px)]" style={{ transformStyle: 'preserve-3d' }}>
          <PiSparkle size={24} className="text-accent" />
          <h3 className="m-0 text-[17px] font-display text-text">Told what to fix</h3>
          <p className="m-0 text-[13.5px] leading-[1.6] text-muted">Every match comes with the specific skills and phrasing gaps holding your score back — not just a number.</p>
        </div>
      </section>

      <section className="bg-tint border-y border-line mt-auto">
        <div className="max-w-[1180px] w-full mx-auto py-14 px-7 flex items-center justify-between gap-6 flex-wrap">
          <div>
            <h2 className="m-0 text-[26px] tracking-[-0.02em] font-display text-text">Ready to see your matches?</h2>
            <p className="mt-1.5 text-sm text-muted">Sign in and upload a resume — results in under a minute.</p>
          </div>
          <button
            onClick={() => navigate('/login')}
            className="h-11 px-[22px] border border-accent rounded-md bg-accent text-bg font-sans font-medium text-sm cursor-pointer whitespace-nowrap hover:opacity-90 transition-opacity"
          >
            Sign in to get started
          </button>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
