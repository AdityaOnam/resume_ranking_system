import React from 'react';
import { Link, useLocation } from 'react-router-dom';

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
  const links = [
    { path: '/', label: 'Upload Resume' },
    { path: '/companies', label: 'Companies' },
    { path: '/ats', label: 'ATS Dashboard' },
  ];
  const isActive = (path) =>
    path === '/' ? location.pathname === '/' || location.pathname === '/upload' : location.pathname.startsWith(path);

  return (
    <header className="flex justify-between items-center h-16 px-6 md:px-8 w-full border-b border-outline-variant bg-background shrink-0 z-30">
      <div className="flex items-center gap-10">
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
        <button
          aria-label="Toggle theme"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">dark_mode</span>
        </button>
        <button
          aria-label="Notifications"
          className="w-10 h-10 rounded-full flex items-center justify-center text-on-surface-variant hover:text-on-surface hover:bg-surface-variant transition-colors relative"
        >
          <span className="material-symbols-outlined text-[20px]">notifications</span>
          <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 rounded-full bg-error ring-2 ring-background" />
        </button>
        <div className="w-8 h-8 rounded-full bg-surface-variant border border-outline-variant flex items-center justify-center text-on-surface-variant ml-1">
          <span className="material-symbols-outlined text-[18px]">person</span>
        </div>
      </div>
    </header>
  );
};

const Sidebar = () => {
  const location = useLocation();
  const isActive = (path) => location.pathname.startsWith(path);

  const navItems = [
    { path: '/', icon: 'dashboard', label: 'Dashboard', exact: true },
    { path: '/upload', icon: 'cloud_upload', label: 'Upload Resume' },
    { path: '/companies', icon: 'business', label: 'Companies' },
    { path: '/ats', icon: 'analytics', label: 'ATS Dashboard' },
  ];

  const systemItems = [
    { path: '/settings', icon: 'settings', label: 'Settings' },
    { path: '/logs', icon: 'list_alt', label: 'Logs' },
    { path: 'http://127.0.0.1:5000/docs', icon: 'api', label: 'API Docs', external: true },
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
        <button className="nav-link w-full hover:!text-error">
          <span className="material-symbols-outlined text-[20px]">logout</span>
          Logout
        </button>
      </div>
    </aside>
  );
};

export { Sidebar, TopBar };
