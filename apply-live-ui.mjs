// Run from your project root:   node apply-live-ui.mjs
// It edits src/components/AdminConsole.jsx (a backup is saved first) and stops with a clear message
// if any line it needs cannot be found, without changing anything.
import fs from 'node:fs';

const FILE = 'src/components/AdminConsole.jsx';
if (!fs.existsSync(FILE)) {
  console.error('Could not find ' + FILE + '. Run this from the project root.');
  process.exit(1);
}
let src = fs.readFileSync(FILE, 'utf8');

if (src.includes('LiveSittingsPanel')) {
  console.log('Already applied. Nothing to do.');
  process.exit(0);
}

const edits = [];

// 1. import the new panel
edits.push({
  name: 'import',
  find: "import { NIGERIAN_COURSES_OF_STUDY } from '../lib/nigeriaAcademicData';",
  replace: String.raw`import { NIGERIAN_COURSES_OF_STUDY } from '../lib/nigeriaAcademicData';
import LiveSittingsPanel from './LiveSittingsPanel';`
});

// 2. state for the phone menu
edits.push({
  name: 'mobile menu state',
  find: "const [activeNav, setActiveNav] = useState('overview');",
  replace: String.raw`const [activeNav, setActiveNav] = useState('overview');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);`
});

// 3. phone top bar + slide-in menu, and a desktop-only sidebar
edits.push({
  name: 'sidebar',
  find: '<aside className="w-full md:w-64 bg-[#fbfaf8] border-b md:border-b-0 md:border-r border-zinc-200/80 p-5 flex flex-col justify-between flex-shrink-0">',
  replace: String.raw`{/* PHONE: top bar */}
      <header className="md:hidden sticky top-0 z-40 bg-[#fbfaf8]/95 backdrop-blur border-b border-zinc-200/80 px-4 py-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          aria-label="Open menu"
          className="relative w-10 h-10 rounded-xl border border-zinc-200 bg-white flex items-center justify-center"
        >
          <LayoutGrid className="w-5 h-5 text-zinc-700" />
          {lockedCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-[#d9531e] text-white text-[10px] font-mono font-bold flex items-center justify-center">
              {lockedCount}
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-mono tracking-[0.2em] uppercase text-zinc-400">Organiser</p>
          <p className="text-sm font-bold text-zinc-900 truncate">
            {String((NAV_ITEMS.find((n) => n.id === activeNav) || {}).label || '').split(' (')[0]}
          </p>
        </div>
        <AiaLogo className="h-6" />
      </header>

      {/* PHONE: slide-in menu */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNavOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[84%] max-w-xs bg-[#fbfaf8] shadow-2xl flex flex-col">
            <div className="px-5 pt-5 pb-3 flex items-center justify-between border-b border-zinc-200/80">
              <div>
                <AiaLogo className="h-7" />
                <span className="block text-[10px] font-mono tracking-[0.24em] uppercase text-zinc-500 mt-1 font-semibold">
                  ORGANISER
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="w-10 h-10 rounded-xl border border-zinc-200 bg-white flex items-center justify-center"
              >
                <X className="w-5 h-5 text-zinc-600" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeNav === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveNav(item.id);
                      setMobileNavOpen(false);
                    }}
                    className={
                      'w-full flex items-center gap-3 px-3.5 h-12 rounded-xl text-sm font-medium ' +
                      (isActive ? 'bg-[#efece6] text-zinc-950 font-semibold' : 'text-zinc-600 active:bg-zinc-100')
                    }
                  >
                    <Icon className="w-5 h-5 text-zinc-700" />
                    <span className="truncate">{item.label}</span>
                    {item.badge > 0 && (
                      <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[#d9531e] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-zinc-200/80 flex items-center justify-between">
              <a href="/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600">
                <span>Student View</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              <button
                type="button"
                onClick={() => {
                  sessionStorage.removeItem('aia_admin_unlocked');
                  setIsUnlocked(false);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* LAPTOP: sidebar stays in view while the page scrolls */}
      <aside className="hidden md:flex md:flex-col md:w-64 md:sticky md:top-0 md:h-screen md:overflow-y-auto bg-[#fbfaf8] border-r border-zinc-200/80 p-5 justify-between flex-shrink-0">`
});

// 4. page area: tighter padding on phones
edits.push({
  name: 'main area',
  find: '<main className="flex-1 p-6 sm:p-10 max-w-6xl w-full mx-auto space-y-8 overflow-y-auto">',
  replace: '<main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-10 pb-10 max-w-6xl w-full mx-auto space-y-6 sm:space-y-8">'
});

// 5. swap the old big-card page for the new panel (the old block is kept but switched off)
edits.push({
  name: 'live sittings page',
  find: "{activeNav === 'live' && (",
  replace: String.raw`{activeNav === 'live' && (
          <LiveSittingsPanel
            sessions={liveSessions}
            loading={liveLoading}
            error={liveError}
            onRefresh={() => loadLiveSessions(false)}
            onReadmit={openReadmitModal}
            onSubmitScript={handleSubmitScriptNow}
            onCancel={handleCancelAttempt}
            onLock={handleLockNow}
            getRemainingSecs={getRemainingSecs}
            isTimeOver={isTimeOver}
            busyId={actionBusyId}
          />
        )}
        {false && (`
});

// Check everything first, change nothing unless all five lines are found exactly once
for (const e of edits) {
  const count = src.split(e.find).length - 1;
  if (count !== 1) {
    console.error('Stopped. For "' + e.name + '" I found ' + count + ' matches (need exactly 1). Nothing was changed.');
    process.exit(1);
  }
}

fs.writeFileSync(FILE + '.backup-before-live-ui', src);
for (const e of edits) src = src.replace(e.find, () => e.replace);
fs.writeFileSync(FILE, src);
console.log('Done. 5 edits applied. Backup saved as ' + FILE + '.backup-before-live-ui');