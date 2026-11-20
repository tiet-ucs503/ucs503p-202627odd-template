import { useState, useEffect } from 'react';
import { Menu, X, User as UserIcon, Shield, LogOut } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const studentLinks = [
  { label: 'Spider Academy', href: '#hero' },
  { label: 'Missions', href: '#missions' },
  { label: 'Boss Battles', href: '#bosses' },
  { label: 'Rewards', href: '#rewards' },
];

// Parents and teachers have a single page, so they get no section links.
const guardianLinks: { label: string; href: string }[] = [];

export default function Navbar({ setView }: { setView: (view: string) => void }) {
  const { user, logout, openAuthModal } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  const isGuardian = user?.role === 'parent' || user?.role === 'teacher';
  const links = isGuardian ? guardianLinks : studentLinks;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handlePortalClick = () => {
    if (!user) {
      openAuthModal();
      return;
    }
    if (isGuardian) {
      setView('parent-dashboard');
    } else {
      setView('dashboard');
    }
  };

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${
        scrolled ? 'bg-ink-900/95 backdrop-blur-md border-b border-hero-600/30' : 'bg-transparent'
      }`}
    >
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <button 
          onClick={() => setView(isGuardian ? 'parent-dashboard' : 'landing')} 
          className="flex items-center gap-2 group"
        >
          <span className="font-comic text-2xl tracking-wide text-white">
            Math<span className="text-hero-500">Verse</span>
          </span>
          {isGuardian && (
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-900/60 border border-blue-400/40 text-blue-300 font-bold">
              {user.role}
            </span>
          )}
        </button>

        <ul className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <li key={l.label}>
              <a
                href={l.href}
                onClick={(e) => {
                  if (isGuardian) {
                    e.preventDefault();
                    setView('parent-dashboard');
                  } else if (l.href.startsWith('#')) {
                    setView('landing');
                  }
                }}
                className="text-sm font-medium text-gray-300 hover:text-hero-400 transition-colors relative after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 hover:after:w-full after:bg-hero-500 after:transition-all"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="hidden md:flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <button
                onClick={handlePortalClick}
                className={`inline-flex items-center gap-1.5 px-4 py-2 border rounded-xl text-xs font-bold uppercase tracking-wider transition-all hover:scale-105 ${
                  user.role === 'parent' || user.role === 'teacher'
                    ? 'bg-blue-950/80 border-blue-500/50 text-blue-300 hover:bg-blue-600 hover:text-white'
                    : 'bg-ink-800 border-hero-500/30 text-white hover:bg-hero-600'
                }`}
              >
                {user.role === 'parent' || user.role === 'teacher' ? (
                  <>
                    <Shield className="w-3.5 h-3.5 text-blue-400" /> {user.role === 'teacher' ? 'Teacher Portal' : 'Parent Portal'}
                  </>
                ) : (
                  <>
                    <UserIcon className="w-3.5 h-3.5 text-hero-400" /> Hero Portal
                  </>
                )}
              </button>

              <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                <span className="text-xs font-semibold text-gray-300">{user.name.split(' ')[0]}</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-mono font-bold uppercase bg-white/10 text-gray-400">
                  {user.role}
                </span>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-white/5 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={handlePortalClick}
                className="inline-flex items-center gap-2 px-4 py-2 bg-ink-800 border border-hero-500/30 hover:bg-hero-600 hover:border-hero-500 text-white text-xs font-bold uppercase tracking-wider rounded-lg transition-all hover:scale-105"
              >
                Portal
              </button>
              
              <button
                onClick={openAuthModal}
                className="inline-flex items-center gap-2 px-5 py-2 bg-hero-600 hover:bg-hero-500 text-white font-semibold text-sm rounded-lg comic-shadow transition-all hover:scale-105 active:scale-95"
              >
                Sign In
              </button>
            </div>
          )}
        </div>

        <button
          className="md:hidden text-white p-2"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </nav>

      {open && (
        <div className="md:hidden bg-ink-800 border-t border-hero-600/30 px-5 py-4 space-y-3">
          {links.map((l) => (
            <a
              key={l.label}
              href={l.href}
              onClick={(e) => {
                if (isGuardian) {
                  e.preventDefault();
                  setView('parent-dashboard');
                } else {
                  setView('landing');
                }
                setOpen(false);
              }}
              className="block text-gray-200 font-medium py-1.5 hover:text-hero-400"
            >
              {l.label}
            </a>
          ))}
          <button
            onClick={() => {
              handlePortalClick();
              setOpen(false);
            }}
            className="block w-full text-center px-5 py-2.5 bg-ink-700 border border-hero-500/30 text-white font-semibold rounded-lg mt-2"
          >
            {user ? (user.role === 'teacher' ? 'Teacher Portal' : user.role === 'parent' ? 'Parent Portal' : 'Hero Portal') : 'Portal'}
          </button>
          {!user ? (
            <button
              onClick={() => {
                openAuthModal();
                setOpen(false);
              }}
              className="block w-full text-center px-5 py-2.5 bg-hero-600 text-white font-semibold rounded-lg"
            >
              Sign In
            </button>
          ) : (
            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="block w-full text-center px-5 py-2 bg-red-900/50 text-red-200 font-semibold rounded-lg text-xs"
            >
              Sign Out ({user.name})
            </button>
          )}
        </div>
      )}
    </header>
  );
}
