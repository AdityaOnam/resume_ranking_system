import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { apiDocsUrl, getResumes } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { parseJson, toPercentScore } from '../../utils/scoring';

const scoreTone = (score) => {
  if (score >= 85) return 'text-[#a78bfa]';
  if (score >= 70) return 'text-secondary';
  if (score >= 50) return 'text-[#fbbf24]';
  return 'text-[#fb7185]';
};

const ProfileModal = ({ user, onClose, onLogout, resumes }) => {
  const sorted = [...resumes].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const recent3 = sorted.slice(0, 3);
  const bestAts = resumes.length ? Math.max(...resumes.map(r => r.ats_score || 0)) : null;
  const latestAts = sorted[0]?.ats_score ?? null;

  // Top company match across all resumes
  let topMatchName = '—';
  let topMatchScore = 0;
  resumes.forEach(r => {
    parseJson(r.rankings).forEach(rank => {
      const score = toPercentScore(rank.score);
      if (rank.eligible && score > topMatchScore) {
        topMatchScore = score;
        topMatchName = rank.companyName || (typeof rank.company === 'object' ? rank.company?.name : rank.company) || '—';
      }
    });
  });

  const initials = user?.email?.[0]?.toUpperCase() || 'U';
  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        className="relative w-full max-w-sm mx-4 rounded-2xl border border-outline-variant bg-surface shadow-2xl overflow-hidden"
        style={{ boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header gradient strip */}
        <div className="h-20 w-full" style={{ background: 'linear-gradient(135deg, rgba(108,99,255,0.3), rgba(137,206,255,0.15))' }} />

        {/* Avatar */}
        <div className="absolute top-10 left-6">
          <div className="w-16 h-16 rounded-full bg-primary border-4 border-surface flex items-center justify-center text-2xl font-bold text-white shadow-lg">
            {initials}
          </div>
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">close</span>
        </button>

        <div className="px-6 pt-10 pb-6 flex flex-col gap-5">
          {/* Name & email */}
          <div>
            <h3 className="text-lg font-bold text-on-surface">{user?.email?.split('@')[0] || 'User'}</h3>
            <p className="text-sm text-on-surface-variant font-mono">{user?.email}</p>
            {joinDate && <p className="text-xs text-outline mt-1">Member since {joinDate}</p>}
          </div>

          {/* ATS score summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-outline-variant bg-surface-container-high p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">Current ATS</p>
              <p className={`text-2xl font-bold font-display ${latestAts !== null ? scoreTone(latestAts) : 'text-outline'}`}>
                {latestAts !== null ? latestAts : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant bg-surface-container-high p-3 text-center">
              <p className="text-[10px] uppercase tracking-wider text-on-surface-variant mb-1">Best ATS</p>
              <p className={`text-2xl font-bold font-display ${bestAts !== null ? scoreTone(bestAts) : 'text-outline'}`}>
                {bestAts !== null ? bestAts : '—'}
              </p>
            </div>
          </div>

          {/* Top company match */}
          {topMatchName !== '—' && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-container-high border border-outline-variant">
              <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[16px] text-secondary">workspace_premium</span>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-on-surface-variant">Top Company Match</p>
                <p className="text-sm font-medium text-on-surface truncate">{topMatchName}</p>
              </div>
              <span className="text-xs font-mono text-secondary ml-auto shrink-0">{Math.round(topMatchScore)}%</span>
            </div>
          )}

          {/* ATS score history */}
          {recent3.length > 0 && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-on-surface-variant mb-2">Recent ATS History</p>
              <div className="flex flex-col gap-2">
                {recent3.map((r, i) => {
                  const s = r.ats_score || 0;
                  return (
                    <div key={r.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-surface-container-high border border-outline-variant/40">
                      <div className="w-6 h-6 rounded-full bg-surface-variant flex items-center justify-center text-[10px] font-bold text-on-surface-variant shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-on-surface truncate">{r.name || 'Resume'}</p>
                        <p className="text-[10px] text-outline font-mono">
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-16 h-1.5 rounded-full bg-surface-variant overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${s}%`,
                              background: s >= 85 ? '#a78bfa' : s >= 70 ? '#34d399' : s >= 50 ? '#fbbf24' : '#fb7185'
                            }}
                          />
                        </div>
                        <span className={`text-xs font-bold font-mono ${scoreTone(s)}`}>{s}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1 border-t border-outline-variant/40">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-medium text-on-surface-variant hover:text-[#fb7185] hover:bg-[#fb7185]/10 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const Logo = () => (
  <Link to="/" className="flex items-center gap-2.5 shrink-0">
    <div className="w-8 h-8 rounded-lg bg-primary text-white flex items-center justify-center font-bold text-lg leading-none">
      R
    </div>
    <span className="text-lg font-bold tracking-tight text-on-surface font-display">ResumeRanker</span>
  </Link>
);

const TopBar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const { data: resumesData } = useQuery({
    queryKey: ['resumes'],
    queryFn: () => getResumes().then(r => r.data),
    enabled: !!user,
  });
  const resumes = Array.isArray(resumesData) ? resumesData : [];

  const links = [
    { path: '/', icon: 'cloud_upload', label: 'Upload Resume' },
    { path: '/companies', icon: 'business', label: 'Companies' },
    { path: '/ats', icon: 'analytics', label: 'ATS Dashboard' },
    { path: '/leaderboard', icon: 'leaderboard', label: 'Leaderboard' },
  ];
  
  const isActive = (path) =>
    path === '/' ? location.pathname === '/' || location.pathname === '/upload' : location.pathname.startsWith(path);

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
      <header className="flex justify-between items-center h-16 px-6 md:px-8 w-full border-b border-outline-variant bg-background shrink-0 z-30">
        <div className="flex items-center gap-4 md:gap-10">
          <button
            className="md:hidden w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
          >
            <span className="material-symbols-outlined text-[24px]">menu</span>
          </button>
          
          <Logo />
          
          <nav className="hidden md:flex items-center gap-7 h-16">
            {links.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`h-16 flex items-center text-sm transition-colors border-b-2 ${
                  isActive(path)
                    ? 'text-primary border-primary font-semibold'
                    : 'text-on-surface-variant border-transparent hover:text-on-surface'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button
                aria-label="Notifications"
                className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors relative"
              >
                <span className="material-symbols-outlined text-[20px]">notifications</span>
                <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-error ring-2 ring-background" />
              </button>
              <button
                id="user-avatar-btn"
                onClick={() => setProfileOpen(true)}
                className="w-8 h-8 rounded-full bg-primary/20 text-primary border border-primary/30 flex items-center justify-center ml-1 font-bold text-sm hover:bg-primary/30 transition-colors"
                title="View profile"
              >
                {user.email?.[0].toUpperCase() || 'U'}
              </button>
            </>
          ) : (
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 bg-primary text-primary-content rounded-lg text-sm font-medium hover:bg-primary-focus transition-colors"
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
            className="fixed inset-0 bg-background/80 backdrop-blur-sm" 
            onClick={() => setMobileNavOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full bg-surface-container-low border-r border-outline-variant flex flex-col py-6 px-3 shadow-2xl animate-in slide-in-from-left">
            <div className="flex justify-between items-center mb-8 px-3">
              <Logo />
              <button
                className="w-8 h-8 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close navigation menu"
              >
                <span className="material-symbols-outlined text-[20px]">close</span>
              </button>
            </div>
            <nav className="flex-1 flex flex-col gap-1">
              {links.map(({ path, icon, label }) => (
                <button 
                  key={path} 
                  onClick={() => handleNav(path)} 
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive(path) ? 'bg-primary/10 text-primary' : 'text-on-surface-variant hover:bg-surface-variant hover:text-on-surface'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">{icon}</span>
                  {label}
                </button>
              ))}
            </nav>
            <div className="mt-auto pt-4 border-t border-outline-variant/60">
              {user && (
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-on-surface-variant hover:text-error hover:bg-error/10 transition-colors"
                >
                  <span className="material-symbols-outlined text-[20px]">logout</span>
                  Logout
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Profile Modal */}
      {profileOpen && user && (
        <ProfileModal
          user={user}
          resumes={resumes}
          onClose={() => setProfileOpen(false)}
          onLogout={handleLogout}
        />
      )}
    </>
  );
};





const Sidebar = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const isActive = (path) => location.pathname.startsWith(path);

  const navItems = [
    { path: '/', icon: 'dashboard', label: 'Dashboard', exact: true },
    { path: '/upload', icon: 'cloud_upload', label: 'Upload Resume' },
    { path: '/companies', icon: 'business', label: 'Companies' },
    { path: '/ats', icon: 'analytics', label: 'ATS Dashboard' },
    { path: '/leaderboard', icon: 'leaderboard', label: 'Leaderboard' },
  ];

  const systemItems = [
    { path: '/settings', icon: 'settings', label: 'Settings' },
    { path: '/logs', icon: 'list_alt', label: 'Logs' },
    { path: apiDocsUrl, icon: 'api', label: 'API Docs', external: true },
  ];

  const linkClass = (path, exact) => {
    const active = exact ? location.pathname === path : isActive(path);
    return active ? 'nav-link-active' : 'nav-link';
  };

  return (
    <aside className="hidden md:flex flex-col w-60 shrink-0 py-6 px-3 border-r border-outline-variant bg-surface-container-low overflow-y-auto">
      <nav className="flex-1 flex flex-col gap-1">
        {navItems.map(({ path, icon, label, exact }) => (
          <Link key={path} to={path} className={linkClass(path, exact)}>
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
            {label}
          </Link>
        ))}

        <p className="px-4 pt-6 pb-2 text-[11px] font-semibold uppercase tracking-widest text-outline">System</p>

        {systemItems.map(({ path, icon, label, external }) =>
          external ? (
            <a key={path} href={path} target="_blank" rel="noreferrer" className="nav-link">
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
              {label}
            </a>
          ) : (
            <Link key={path} to={path} className={linkClass(path)}>
              <span className="material-symbols-outlined text-[20px]">{icon}</span>
              {label}
            </Link>
          )
        )}
      </nav>

      <div className="mt-auto pt-4 border-t border-outline-variant/60">
        {user && (
          <button 
            onClick={async () => {
              await signOut();
              navigate('/login');
            }}
            className="nav-link w-full hover:!text-error"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            Logout
          </button>
        )}
      </div>
    </aside>
  );
};

export { Sidebar, TopBar };
