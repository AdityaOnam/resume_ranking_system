import { useState, useEffect } from 'react';

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    // Check localStorage first
    const saved = localStorage.getItem('rr_theme');
    if (saved === 'dark' || saved === 'light') return saved;
    // Fall back to the existing class on HTML if present (it's hardcoded to 'dark' currently)
    if (document.documentElement.classList.contains('light')) return 'light';
    return 'dark'; // Default to dark per design
  });

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
    localStorage.setItem('rr_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));
  };

  return { theme, toggleTheme };
}
