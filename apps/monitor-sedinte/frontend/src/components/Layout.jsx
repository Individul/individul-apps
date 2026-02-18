import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { apiFetch, logout } from '../api/client';

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25a2.25 2.25 0 01-2.25-2.25v-2.25z" />
      </svg>
    )
  },
  {
    to: '/sedinte',
    label: 'Sedinte',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    )
  },
  {
    to: '/calendar',
    label: 'Calendar',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008H16.5v-.008zm0 2.25h.008v.008H16.5V15z" />
      </svg>
    )
  },
  {
    to: '/persoane',
    label: 'Persoane',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
      </svg>
    )
  },
  {
    to: '/hotarari',
    label: 'Hotarari',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
      </svg>
    )
  },
  {
    to: '/setari',
    label: 'Setari',
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  }
];

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyProgress, setVerifyProgress] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState(null);
  const [badge, setBadge] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = () => setShowSearch(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    apiFetch('/dashboard/badge').then(setBadge).catch(() => {});
    const interval = setInterval(() => {
      apiFetch('/dashboard/badge').then(setBadge).catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  function handleSearch(query) {
    if (searchTimeout) clearTimeout(searchTimeout);
    if (!query || query.length < 2) {
      setSearchResults(null);
      setShowSearch(false);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const data = await apiFetch(`/cautare?q=${encodeURIComponent(query)}`);
        setSearchResults(data);
        setShowSearch(true);
      } catch { /* ignore */ }
    }, 300);
    setSearchTimeout(t);
  }

  // Poll verification progress
  useEffect(() => {
    if (!verifying) return;
    const poll = setInterval(async () => {
      try {
        const status = await apiFetch('/verificare/status');
        setVerifyProgress(status);
        if (!status.running) {
          setVerifying(false);
          setVerifyProgress(null);
          clearInterval(poll);
        }
      } catch { /* ignore */ }
    }, 1500);
    return () => clearInterval(poll);
  }, [verifying]);

  async function handleVerify() {
    setVerifying(true);
    setVerifyProgress(null);
    try {
      await apiFetch('/verificare/acum', { method: 'POST', body: {} });
    } catch {
      setVerifying(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-200 ease-in-out ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6" />
            </svg>
          </div>
          <span className="font-semibold text-slate-900">Monitor Sedinte</span>
        </div>

        <nav className="px-3 py-4 space-y-1">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              {item.icon}
              <span className="flex-1">{item.label}</span>
              {item.to === '/sedinte' && badge && badge.sedinte_7_zile > 0 && (
                <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-0.5 rounded-full">
                  {badge.sedinte_7_zile}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Verification failure warning */}
        {badge && badge.ultima_verificare_ok === false && (
          <div className="mx-3 mt-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-600 font-medium">Ultima verificare a esuat</p>
            <p className="text-xs text-red-500 mt-0.5">{badge.ultima_verificare}</p>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-100">
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
            </svg>
            Deconectare
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-4 lg:px-6 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 text-slate-500 hover:text-slate-700"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>

          {/* Global search */}
          <div className="flex-1 max-w-md mx-4 hidden md:block relative">
            <input
              type="text"
              placeholder="Cauta sedinte, persoane..."
              value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
              onFocus={() => searchResults && setShowSearch(true)}
              className="w-full px-3 py-2 pl-9 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <svg className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            {showSearch && searchResults && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-lg shadow-lg border border-slate-200 max-h-80 overflow-y-auto z-50">
                {searchResults.persoane.length === 0 && searchResults.sedinte.length === 0 ? (
                  <p className="p-3 text-sm text-slate-400">Niciun rezultat</p>
                ) : (
                  <>
                    {searchResults.persoane.length > 0 && (
                      <div className="p-2">
                        <p className="text-xs text-slate-500 px-2 py-1">Persoane</p>
                        {searchResults.persoane.map(p => (
                          <div key={p.id} className="px-2 py-1.5 text-sm hover:bg-slate-50 rounded cursor-pointer" onClick={() => { navigate('/persoane'); setShowSearch(false); setSearchQuery(''); }}>
                            {p.nume}
                          </div>
                        ))}
                      </div>
                    )}
                    {searchResults.sedinte.length > 0 && (
                      <div className="p-2 border-t border-slate-100">
                        <p className="text-xs text-slate-500 px-2 py-1">Sedinte</p>
                        {searchResults.sedinte.map(s => (
                          <div key={s.id} className="px-2 py-1.5 text-sm hover:bg-slate-50 rounded cursor-pointer" onClick={() => { navigate('/sedinte'); setShowSearch(false); setSearchQuery(''); }}>
                            <div className="font-medium">{s.numar_dosar} — {s.data_sedinta}</div>
                            <div className="text-xs text-slate-400">{s.instanta_nume} | {s.persoana_nume}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          <button
            onClick={handleVerify}
            disabled={verifying}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <svg className={`w-4 h-4 ${verifying ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
            </svg>
            {verifying ? 'Se verifica...' : 'Verifica acum'}
          </button>
        </header>

        {/* Verification progress bar */}
        {verifying && verifyProgress && verifyProgress.total > 0 && (
          <div className="bg-blue-50 border-b border-blue-100 px-4 lg:px-6 py-2">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-blue-700 font-medium">
                {verifyProgress.phase === 'hotarari' ? 'Hotarari' : 'Sedinte'}: {verifyProgress.current}/{verifyProgress.total}
                {verifyProgress.currentPerson && (
                  <span className="text-blue-500 font-normal ml-2">— {verifyProgress.currentPerson}</span>
                )}
              </span>
              <span className="text-blue-400 text-xs">
                {Math.round((verifyProgress.current / verifyProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-blue-100 rounded-full h-1.5">
              <div
                className="bg-blue-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${(verifyProgress.current / verifyProgress.total) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Page content */}
        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
