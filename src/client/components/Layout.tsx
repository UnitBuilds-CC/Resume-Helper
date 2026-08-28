import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Dashboard', icon: '◈' },
  { to: '/systems', label: 'Systems', icon: '⬡' },
  { to: '/blocks', label: 'Blocks', icon: '▤' },
  { to: '/template', label: 'Template CV', icon: '◎' },
  { to: '/jobs', label: 'Job Postings', icon: '◆' },
  { to: '/compiled', label: 'Compiled CVs', icon: '❖' },
  { to: '/red-team', label: 'Red Team', icon: '◉' },
  { to: '/questions', label: 'Questions', icon: '◌' },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const navContent = (
    <>
      <div className="mb-5 px-3">
        <h1 className="text-lg font-semibold text-sapphire-900 tracking-tight">Resume Helper</h1>
        <p className="text-xs text-sapphire-400 mt-0.5">Craft your perfect fit</p>
      </div>
      {navItems.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          onClick={() => setMobileOpen(false)}
          className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
        >
          <span className="text-sm opacity-50">{icon}</span>
          <span>{label}</span>
        </NavLink>
      ))}
      <div className="mt-auto pt-4 border-t border-cream-200">
        <p className="px-3 text-xs text-sapphire-400">Your career, tailored.</p>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-cream-50">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex w-56 border-r border-cream-300 p-4 flex-col gap-0.5 bg-white shrink-0">
        {navContent}
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-sapphire-900/30" onClick={() => setMobileOpen(false)} />
          <nav className="relative w-64 h-full p-4 flex flex-col gap-0.5 bg-white shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-lg text-sapphire-500 hover:bg-cream-100"
            >
              ✕
            </button>
            {navContent}
          </nav>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-cream-300 bg-white">
          <button
            onClick={() => setMobileOpen(true)}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sapphire-600 hover:bg-cream-100"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="2" y1="4" x2="16" y2="4" />
              <line x1="2" y1="9" x2="16" y2="9" />
              <line x1="2" y1="14" x2="16" y2="14" />
            </svg>
          </button>
          <h1 className="text-base font-semibold text-sapphire-900">Resume Helper</h1>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
