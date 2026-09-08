import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getResumes } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../hooks/useTheme';
import { useQuery } from '@tanstack/react-query';
import { parseJson, toPercentScore } from '../../utils/scoring';
import {
  PiCloudArrowUp,
  PiBuildings,
  PiChartLine,
  PiBell,
  PiSignOut,
  PiList,
  PiX,
  PiSun,
  PiMoon,
  PiSealCheck
} from 'react-icons/pi';

const scoreTone = (score) => {
  if (score >= 85) return 'text-[#a78bfa]';
  if (score >= 70) return 'text-success';
  if (score >= 50) return 'text-[#fbbf24]';
  return 'text-error';
};

const ProfileDropdown = ({ user, onClose, onLogout, resumes }) => {
  const sorted = [...resumes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const latestAts = sorted[0]?.ats_score ?? null;

  // Top company match across all resumes

  let topMatchScore = 0;
  resumes.forEach(r => {
    parseJson(r.rankings).forEach(rank => {
      const score = toPercentScore(rank.score);
      if (rank.eligible && score > topMatchScore) {
        topMatchScore = score;
      }
    });
  });

  const initials = user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute top-14 right-0 w-[280px] z-50 bg-surface border border-line rounded-xl overflow-hidden" style={{ boxShadow: 'var(--rr-shadow)' }}>
        {/* Header gradient strip */}
        <div className="h-16 w-full" style={{ background: 'linear-gradient(135deg, var(--rr-tint-strong), rgba(137,206,255,0.05))' }} />

        {/* Avatar */}
        <div className="absolute top-8 left-4">
          <div className="w-12 h-12 rounded-full bg-accent border-2 border-surface flex items-center justify-center text-lg font-bold text-[#14121f] shadow-lg">
            {initials}
          </div>
        </div>

        <div className="px-5 pt-8 pb-4 flex flex-col gap-4">
          {/* Name & email */}
          <div>
            <h3 className="text-base font-bold text-text truncate">{user?.email?.split('@')[0] || 'User'}</h3>
            <p className="text-xs text-muted font-mono truncate">{user?.email}</p>
          </div>

          {/* ATS score summary */}
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line bg-surface-2 p-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Current ATS</p>
              <p className={`text-xl font-bold font-sans ${latestAts !== null ? scoreTone(latestAts) : 'text-muted'}`}>
                {latestAts !== null ? latestAts : '—'}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-surface-2 p-2 text-center">
              <p className="text-[10px] uppercase tracking-wider text-muted mb-1">Best Match</p>
              <p className={`text-xl font-bold font-sans ${topMatchScore > 0 ? scoreTone(topMatchScore) : 'text-muted'}`}>
                {topMatchScore > 0 ? `${Math.round(topMatchScore)}%` : '—'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-2 border-t border-line">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium text-muted hover:text-error hover:bg-error/10 transition-colors"
            >
              <PiSignOut size={18} />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
    <svg width="24" height="24" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" className="group-hover:scale-105 transition-transform">
      <path d="M12.5 7L21 14L12.5 21" stroke="var(--rr-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.5 7L14 14L5.5 21" stroke="var(--rr-muted)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
    <span className="text-lg font-bold tracking-tight text-text font-sans">ResumeRanker</span>
  </Link>
);

const TopBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const { data: resumesData } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => getResumes().then(r => r.data),
    enabled: !!user,
  });
  const resumes = Array.isArray(resumesData) ? resumesData : [];

  const links = [
    { path: '/upload', icon: <PiCloudArrowUp size={20} />, label: 'Upload' },
    { path: '/companies', icon: <PiBuildings size={20} />, label: 'Companies' },
    { path: '/ats', icon: <PiChartLine size={20} />, label: 'ATS Dashboard' },
  ];
  
  const isActive = (path) =>
    path === '/upload' ? location.pathname === '/' || location.pathname === '/upload' : location.pathname.startsWith(path);

  const handleNav = (path) => {
    navigate(path);
    setMobileNavOpen(false);
  };

  const handleLogout = async () => {
    setProfileOpen(false);
    await signOut();
    navigate('/login');
  };

  return (
    <>
      <header className="flex justify-between items-center h-16 px-6 md:px-8 w-full border-b border-line bg-bg shrink-0 z-30">
        <div className="flex items-center gap-4 md:gap-10">
          <button
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <PiList size={24} />
          </button>
          
          <Logo />
          
          {user && (
            <nav className="hidden md:flex items-center gap-7 h-16">
              {links.map(({ path, label }) => (
                <Link
                  key={path}
                  to={path}
                  className={`h-16 flex items-center text-sm transition-colors border-b-2 ${
                    isActive(path)
                      ? 'text-accent border-accent font-semibold'
                      : 'text-muted border-transparent hover:text-text'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </nav>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={toggleTheme} 
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-surface-2 hover:bg-surface text-xs font-medium text-muted hover:text-text transition-colors"
          >
            {theme === 'dark' ? <PiSun size={16} /> : <PiMoon size={16} />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>

          {user ? (
            <>
              <div className="relative">
                <button
                  aria-label="Notifications"
                  onClick={() => {
                    setNotificationsOpen(!notificationsOpen);
                    setProfileOpen(false);
                  }}
                  className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors relative"
                >
                  <PiBell size={20} />
                  <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-accent ring-2 ring-bg" />
                </button>
                
                {notificationsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setNotificationsOpen(false)} />
                    <div className="absolute top-12 right-0 w-72 bg-surface border border-line rounded-xl p-4 z-50" style={{ boxShadow: 'var(--rr-shadow)' }}>
                      <p className="text-sm font-semibold text-text mb-3">Notifications</p>
                      <div className="flex flex-col gap-3">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-full bg-tint flex items-center justify-center text-accent shrink-0">
                            <PiSealCheck size={16} />
                          </div>
                          <div>
                            <p className="text-xs text-text">Resume parsing complete.</p>
                            <p className="text-[10px] text-muted mt-0.5">Just now</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="relative ml-1">
                <button
                  id="user-avatar-btn"
                  onClick={() => {
                    setProfileOpen(!profileOpen);
                    setNotificationsOpen(false);
                  }}
                  className="w-8 h-8 rounded-full bg-tint text-accent border border-tint-strong flex items-center justify-center font-bold text-sm hover:bg-tint-strong transition-colors"
                  title="View profile"
                >
                  {user.email?.[0].toUpperCase() || 'U'}
                </button>

                {profileOpen && (
                  <ProfileDropdown
                    user={user}
                    resumes={resumes}
                    onClose={() => setProfileOpen(false)}
                    onLogout={handleLogout}
                  />
                )}
              </div>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-accent text-[#14121f] rounded-lg text-sm font-medium hover:brightness-110 transition-colors"
            >
              Sign In
            </button>
          )}
        </div>
      </header>

      {/* Mobile Drawer */}
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div 
            className="fixed inset-0 bg-bg/80 backdrop-blur-sm" 
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full bg-surface-2 border-r border-line flex flex-col py-6 px-3 shadow-2xl animate-in slide-in-from-left">
            <div className="flex justify-between items-center mb-8 px-3">
              <Logo />
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface transition-colors"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
              >
                <PiX size={20} />
              </button>
            </div>
            
            <nav className="flex-1 flex flex-col gap-1">
              {user && links.map(({ path, icon, label }) => (
                <button 
                  key={path} 
                  onClick={() => handleNav(path)} 
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive(path) ? 'bg-tint text-accent' : 'text-muted hover:bg-surface hover:text-text'
                  }`}
                >
                  {icon}
                  {label}
                </button>
              ))}
            </nav>
            
            <div className="mt-auto pt-4 border-t border-line/60 flex flex-col gap-2">
              <button 
                onClick={toggleTheme} 
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:bg-surface hover:text-text transition-colors"
              >
                {theme === 'dark' ? <PiSun size={20} /> : <PiMoon size={20} />}
                Switch to {theme === 'dark' ? 'Light' : 'Dark'}
              </button>

              {user && (
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted hover:text-error hover:bg-error/10 transition-colors"
                >
                  <PiSignOut size={20} />
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export { TopBar };
