import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Inbox,
  Lock,
  RefreshCw,
  Search,
  Unlock,
  X
} from 'lucide-react';

// Why a live exam was locked (coloured badge)
const LOCK_REASON_META = {
  LEFT_EXAM: { label: 'Left exam', cls: 'bg-amber-100 text-amber-800' },
  SIGNED_OUT: { label: 'Signed out', cls: 'bg-zinc-200 text-zinc-700' },
  TOO_MANY_LEAVES: { label: 'Too many leaves', cls: 'bg-red-100 text-red-700' },
  DEVICE_CHANGE: { label: 'Device change', cls: 'bg-purple-100 text-purple-700' },
  ADMIN: { label: 'Admin', cls: 'bg-teal-100 text-teal-800' }
};

const PAGE_SIZES = [10, 25, 50];

// 754 -> "12:34", 4000 -> "1:06:40"
function formatClock(totalSecs) {
  const t = Math.max(0, Math.floor(Number(totalSecs) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? h + ':' + mm + ':' + ss : m + ':' + ss;
}

function initials(name) {
  return String(name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

// The moment that matters for this row: submitted, locked, or last seen
function whenOf(s) {
  if (s.status === 'SUBMITTED') return s.submitted_at || s.updated_at;
  if (s.status === 'LOCKED') return s.locked_at || s.updated_at;
  if (s.status === 'CANCELLED') return s.updated_at;
  return s.updated_at;
}

function fmtWhen(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export default function LiveSittingsPanel({
  sessions = [],
  loading = false,
  error = '',
  onRefresh,
  onReadmit,
  onSubmitScript,
  onCancel,
  onLock,
  getRemainingSecs,
  isTimeOver,
  busyId
}) {
  const [tab, setTab] = useState('locked');
  const [search, setSearch] = useState('');
  const [exam, setExam] = useState('ALL');
  const [sort, setSort] = useState('recent');
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState(null);

  const groups = useMemo(
    () => ({
      locked: sessions.filter((s) => s.status === 'LOCKED'),
      active: sessions.filter((s) => s.status === 'ACTIVE'),
      finished: sessions.filter((s) => s.status === 'SUBMITTED' || s.status === 'CANCELLED')
    }),
    [sessions]
  );

  const examOptions = useMemo(() => {
    const seen = new Map();
    sessions.forEach((s) => {
      if (s.sitting_id && !seen.has(String(s.sitting_id))) {
        seen.set(String(s.sitting_id), s.sitting_title || String(s.sitting_id));
      }
    });
    return Array.from(seen.entries())
      .map(([id, title]) => ({ id, title }))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [sessions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = groups[tab].filter((s) => {
      const okExam = exam === 'ALL' || String(s.sitting_id) === String(exam);
      const okText =
        !q ||
        String(s.student_name || '').toLowerCase().includes(q) ||
        String(s.email || '').toLowerCase().includes(q);
      return okExam && okText;
    });
    const time = (s) => new Date(whenOf(s)).getTime() || 0;
    const prog = (s) => (Number(s.total) > 0 ? Number(s.answered) / Number(s.total) : 0);
    const sorted = [...rows];
    if (sort === 'name') sorted.sort((a, b) => String(a.student_name).localeCompare(String(b.student_name)));
    else if (sort === 'progress') sorted.sort((a, b) => prog(b) - prog(a));
    else if (sort === 'leaves') sorted.sort((a, b) => (Number(b.cheat_warnings) || 0) - (Number(a.cheat_warnings) || 0));
    else sorted.sort((a, b) => time(b) - time(a));
    return sorted;
  }, [groups, tab, search, exam, sort]);

  // Back to page 1 whenever the list changes shape
  useEffect(() => {
    setPage(0);
    setOpenId(null);
  }, [tab, search, exam, sort, pageSize]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const start = safePage * pageSize;
  const rows = filtered.slice(start, start + pageSize);

  const tabs = [
    {
      id: 'locked',
      label: 'Locked',
      count: groups.locked.length,
      on: 'border-[#d9531e] bg-orange-50 text-orange-700',
      num: 'text-[#d9531e]'
    },
    {
      id: 'active',
      label: 'Active now',
      count: groups.active.length,
      on: 'border-emerald-500 bg-emerald-50 text-emerald-700',
      num: 'text-emerald-600'
    },
    {
      id: 'finished',
      label: 'Finished',
      count: groups.finished.length,
      on: 'border-zinc-900 bg-zinc-900 text-white',
      num: 'text-white'
    }
  ];

  const timeText = (s) => {
    if (s.status === 'SUBMITTED') {
      const d = Number(s.duration_seconds);
      const r = Number(s.remaining_seconds);
      if (d > 0 && Number.isFinite(r)) return formatClock(Math.max(0, d - Math.max(0, r)));
      return '—';
    }
    if (s.status === 'CANCELLED') return '—';
    return formatClock(getRemainingSecs(s));
  };
  const timeLabel = tab === 'finished' ? 'Time used' : tab === 'locked' ? 'Time left (frozen)' : 'Time left';

  const chipFor = (s) => {
    if (s.status === 'LOCKED') {
      const r = LOCK_REASON_META[s.lock_reason];
      return r || { label: 'Locked', cls: 'bg-orange-100 text-orange-700' };
    }
    if (s.status === 'ACTIVE') return { label: 'Writing now', cls: 'bg-emerald-100 text-emerald-700' };
    if (s.status === 'SUBMITTED') return { label: 'Submitted', cls: 'bg-emerald-100 text-emerald-700' };
    return { label: 'Cancelled', cls: 'bg-zinc-200 text-zinc-600' };
  };

  const avatarCls = (s) =>
    s.status === 'LOCKED'
      ? 'bg-orange-100 text-orange-700'
      : s.status === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-700'
      : 'bg-zinc-100 text-zinc-600';

  const barCls = (s) => (s.status === 'LOCKED' ? 'bg-[#d9531e]' : s.status === 'CANCELLED' ? 'bg-zinc-300' : 'bg-teal-600');

  const pctOf = (s) => {
    const total = Number(s.total) || 0;
    const answered = Number(s.answered) || 0;
    return total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;
  };

  // Buttons for one row. "compact" = laptop table (icons for the secondary actions)
  const renderActions = (s, compact) => {
    const busy = busyId === s.id;
    const isLocked = s.status === 'LOCKED';
    const isActive = s.status === 'ACTIVE';
    const over = isTimeOver(s);
    if (!isLocked && !isActive) return null;

    const base = compact
      ? 'h-9 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50'
      : 'h-11 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-50';
    const icoBtn = 'w-9 h-9 rounded-lg border flex items-center justify-center disabled:opacity-50';

    if (compact) {
      return (
        <div className="flex items-center justify-end gap-1.5">
          {isLocked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onReadmit(s)}
              className={base + ' px-3 bg-[#d9531e] hover:bg-orange-600 text-white'}
            >
              <Unlock className="w-3.5 h-3.5" />
              <span>Re-admit</span>
            </button>
          )}
          {isActive && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onLock(s)}
              className={base + ' px-3 border border-zinc-300 hover:bg-zinc-50'}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Lock</span>
            </button>
          )}
          {(isLocked || over) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onSubmitScript(s)}
              title="Submit script now"
              aria-label="Submit script now"
              className={icoBtn + ' border-zinc-300 text-zinc-700 hover:bg-zinc-50'}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          {isLocked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onCancel(s)}
              title="Cancel attempt"
              aria-label="Cancel attempt"
              className={icoBtn + ' border-red-200 bg-red-50/60 text-red-600 hover:bg-red-100'}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 gap-2">
        {isLocked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onReadmit(s)}
            className={base + ' col-span-2 bg-[#d9531e] hover:bg-orange-600 text-white'}
          >
            <Unlock className="w-4 h-4" />
            <span>Re-admit</span>
          </button>
        )}
        {isActive && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onLock(s)}
            className={base + ' col-span-2 border border-zinc-300 bg-white'}
          >
            <Lock className="w-4 h-4" />
            <span>Lock now</span>
          </button>
        )}
        {(isLocked || over) && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSubmitScript(s)}
            className={base + ' border border-zinc-300 bg-white'}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{busy ? 'Working...' : 'Submit script'}</span>
          </button>
        )}
        {isLocked && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onCancel(s)}
            className={base + ' border border-red-200 bg-red-50/60 text-red-600'}
          >
            <X className="w-4 h-4" />
            <span>Cancel attempt</span>
          </button>
        )}
      </div>
    );
  };

  const renderChips = (s) => {
    const chip = chipFor(s);
    const over = isTimeOver(s);
    return (
      <div className="flex items-center gap-1 flex-wrap">
        <span className={'font-mono text-[10px] font-bold px-2 py-0.5 rounded-md ' + chip.cls}>{chip.label}</span>
        {over && (
          <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800">
            Time over
          </span>
        )}
      </div>
    );
  };

  const emptyText =
    sessions.length === 0 && loading
      ? 'Loading sittings...'
      : search.trim() || exam !== 'ALL'
      ? 'Nothing matches your search or filter.'
      : tab === 'locked'
      ? 'No locked students right now.'
      : tab === 'active'
      ? 'Nobody is writing an exam right now.'
      : 'No finished sittings yet.';

  const showingFrom = filtered.length === 0 ? 0 : start + 1;
  const showingTo = Math.min(filtered.length, start + pageSize);

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-bold">Live Sittings</h1>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-500 opacity-60 animate-ping" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-500" />
              </span>
              LIVE
            </span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
            Students writing right now, plus locked and finished sittings. Updates every 10 seconds.
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          disabled={loading}
          aria-label="Refresh"
          className="flex-shrink-0 h-10 px-3 sm:px-4 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-50 disabled:opacity-60 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
        >
          <RefreshCw className={'w-4 h-4 ' + (loading ? 'animate-spin' : '')} />
          <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 min-w-0">
            <p className="font-bold break-words">{error}</p>
            {error.toLowerCase().includes('invalid admin pin') && (
              <p className="text-red-600">
                The Console PIN here does not match the one saved in the cloud. Open Settings, save the Console PIN
                again, then press Refresh.
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tabs as big tappable counters */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {tabs.map((t) => {
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                'rounded-2xl border-2 px-3 py-2.5 sm:py-3 text-left transition-colors ' +
                (on ? t.on : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300')
              }
            >
              <span className={'block text-xl sm:text-2xl font-bold font-mono leading-none ' + (on ? t.num : 'text-zinc-900')}>
                {t.count}
              </span>
              <span className="block text-[11px] sm:text-xs font-semibold mt-1 truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search, exam filter, sort */}
      <div className="grid grid-cols-2 sm:grid-cols-[minmax(0,1fr)_auto_auto] gap-2">
        <div className="relative col-span-2 sm:col-span-1">
          <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or email..."
            className="w-full h-11 pl-9 pr-3 rounded-xl bg-white border border-zinc-200 text-sm focus:outline-none focus:border-orange-500"
          />
        </div>
        <select
          value={exam}
          onChange={(e) => setExam(e.target.value)}
          className="h-11 px-3 rounded-xl bg-white border border-zinc-200 text-xs font-semibold min-w-0 sm:max-w-[13rem]"
          aria-label="Filter by exam"
        >
          <option value="ALL">All exams</option>
          {examOptions.map((o) => (
            <option key={o.id} value={o.id}>
              {o.title}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="h-11 px-3 rounded-xl bg-white border border-zinc-200 text-xs font-semibold min-w-0"
          aria-label="Sort"
        >
          <option value="recent">Newest first</option>
          <option value="name">Name A to Z</option>
          <option value="progress">Most answered</option>
          <option value="leaves">Most screen leaves</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-zinc-200/80 py-14 px-4 text-center">
          <Inbox className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
          <p className="text-xs text-zinc-400">{emptyText}</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
          {/* PHONE: compact rows, tap to open */}
          <ul className="md:hidden divide-y divide-zinc-100">
            {rows.map((s) => {
              const open = openId === s.id;
              const pct = pctOf(s);
              const isLocked = s.status === 'LOCKED';
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : s.id)}
                    className="w-full text-left px-4 pt-3 pb-2.5 flex items-center gap-3 active:bg-zinc-50"
                    aria-expanded={open}
                  >
                    <span
                      className={
                        'w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ' +
                        avatarCls(s)
                      }
                    >
                      {initials(s.student_name)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-bold text-zinc-900 truncate">{s.student_name}</span>
                      <span className="block text-[11px] text-zinc-500 truncate">{s.sitting_title}</span>
                      <span className="mt-1.5 flex items-center gap-2">
                        <span className="flex-1 h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                          <span className={'block h-full rounded-full ' + barCls(s)} style={{ width: pct + '%' }} />
                        </span>
                        <span className="text-[10px] font-mono text-zinc-400 flex-shrink-0">
                          {Number(s.answered) || 0}/{Number(s.total) || 0}
                        </span>
                      </span>
                    </span>
                    <span className="flex flex-col items-end gap-1 flex-shrink-0">
                      {renderChips(s)}
                      <span className="text-[11px] font-mono font-bold text-zinc-700">{timeText(s)}</span>
                    </span>
                    <ChevronDown
                      className={'w-4 h-4 text-zinc-400 flex-shrink-0 transition-transform ' + (open ? 'rotate-180' : '')}
                    />
                  </button>

                  {/* Locked students: the main action is always one tap away */}
                  {isLocked && !open && (
                    <div className="px-4 pb-3">
                      <button
                        type="button"
                        disabled={busyId === s.id}
                        onClick={() => onReadmit(s)}
                        className="w-full h-10 rounded-xl bg-[#d9531e] hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                      >
                        <Unlock className="w-4 h-4" />
                        <span>Re-admit</span>
                      </button>
                    </div>
                  )}

                  {open && (
                    <div className="px-4 pb-4 pt-1 space-y-3 bg-zinc-50/60">
                      <p className="text-[11px] text-zinc-500 break-all">{s.email}</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[11px] font-mono">
                        <div>
                          <span className="block text-zinc-400">{timeLabel}</span>
                          <span className="block text-sm font-bold text-zinc-800">{timeText(s)}</span>
                        </div>
                        <div>
                          <span className="block text-zinc-400">Screen leaves</span>
                          <span className="block text-sm font-bold text-zinc-800">{Number(s.cheat_warnings) || 0}</span>
                        </div>
                        <div>
                          <span className="block text-zinc-400">Re-admitted</span>
                          <span className="block text-sm font-bold text-zinc-800">{Number(s.readmit_count) || 0}x</span>
                        </div>
                        <div>
                          <span className="block text-zinc-400">
                            {s.status === 'SUBMITTED' ? 'Submitted' : isLocked ? 'Locked at' : 'Last seen'}
                          </span>
                          <span className="block text-zinc-800">{fmtWhen(whenOf(s))}</span>
                        </div>
                        {s.department && (
                          <div className="col-span-2">
                            <span className="block text-zinc-400">Department</span>
                            <span className="block text-zinc-800">{s.department}</span>
                          </div>
                        )}
                      </div>
                      {s.admin_note && (
                        <p className="text-[11px] text-zinc-600 bg-white border border-zinc-200 rounded-xl px-3 py-2">
                          Note: {s.admin_note}
                        </p>
                      )}
                      {renderActions(s, false)}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>

          {/* LAPTOP: one tidy table */}
          <div className="hidden md:block">
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_76px_56px_minmax(0,1.3fr)_auto] gap-3 px-4 py-2.5 bg-zinc-50 border-b border-zinc-200/80 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
              <div>Student</div>
              <div>Exam</div>
              <div>Progress</div>
              <div>{tab === 'finished' ? 'Used' : 'Time'}</div>
              <div>Leaves</div>
              <div>Status</div>
              <div className="text-right">{tab === 'finished' ? '' : 'Actions'}</div>
            </div>
            <div className="divide-y divide-zinc-100">
              {rows.map((s) => {
                const pct = pctOf(s);
                const over = isTimeOver(s);
                return (
                  <div
                    key={s.id}
                    className="grid grid-cols-[minmax(0,2fr)_minmax(0,1.6fr)_minmax(0,1.2fr)_76px_56px_minmax(0,1.3fr)_auto] gap-3 items-center px-4 py-2.5 text-xs hover:bg-zinc-50/70"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={
                          'w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ' +
                          avatarCls(s)
                        }
                      >
                        {initials(s.student_name)}
                      </span>
                      <div className="min-w-0">
                        <span className="block font-bold text-zinc-900 truncate">{s.student_name}</span>
                        <span className="block text-[11px] text-zinc-500 truncate" title={s.email}>
                          {s.email}
                        </span>
                      </div>
                    </div>

                    <div className="min-w-0">
                      <span className="block font-semibold text-zinc-800 truncate" title={s.sitting_title}>
                        {s.sitting_title}
                      </span>
                      <span className="block text-[11px] text-zinc-400 truncate">
                        {s.mode === 'BUNDLED' ? 'Combo' : s.department || 'Exam'}
                      </span>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 mb-1">
                        <span>
                          {Number(s.answered) || 0}/{Number(s.total) || 0}
                        </span>
                        <span>{pct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-100 overflow-hidden">
                        <div className={'h-full rounded-full ' + barCls(s)} style={{ width: pct + '%' }} />
                      </div>
                    </div>

                    <div
                      className={
                        'font-mono font-bold ' +
                        (over ? 'text-amber-700' : s.status === 'ACTIVE' ? 'text-emerald-700' : 'text-zinc-800')
                      }
                    >
                      {timeText(s)}
                    </div>

                    <div className="font-mono font-bold text-zinc-800">
                      {Number(s.cheat_warnings) || 0}
                      {Number(s.readmit_count) > 0 && (
                        <span className="ml-1 text-[10px] font-normal text-zinc-400" title="Times re-admitted">
                          ·{Number(s.readmit_count)}x
                        </span>
                      )}
                    </div>

                    <div className="min-w-0 space-y-1">
                      {renderChips(s)}
                      <span className="block text-[10px] font-mono text-zinc-400 truncate">{fmtWhen(whenOf(s))}</span>
                    </div>

                    <div>{renderActions(s, true)}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pagination */}
          <div className="px-4 py-3 bg-zinc-50 border-t border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs">
            <div className="flex items-center justify-between sm:justify-start gap-3 text-zinc-500 font-mono">
              <span>
                {showingFrom}-{showingTo} of {filtered.length}
              </span>
              <label className="flex items-center gap-1.5">
                <span className="text-zinc-400">Rows</span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg bg-white border border-zinc-200 font-semibold"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="flex items-center justify-between sm:justify-end gap-2">
              <button
                type="button"
                disabled={safePage === 0}
                onClick={() => setPage(safePage - 1)}
                className="h-9 px-3 rounded-lg bg-white border border-zinc-200 font-semibold flex items-center gap-1 disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev</span>
              </button>
              <span className="font-mono text-zinc-500">
                {safePage + 1} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage >= pageCount - 1}
                onClick={() => setPage(safePage + 1)}
                className="h-9 px-3 rounded-lg bg-white border border-zinc-200 font-semibold flex items-center gap-1 disabled:opacity-40"
              >
                <span>Next</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}