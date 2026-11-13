import React, { useState, useEffect, useMemo } from 'react';
import AiaLogo from './AiaLogo';
import {
  RotateCcw,
  Share2,
  Bookmark,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Clock,
  Lock,
  Check,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Medal,
  Award,
  Search,
  Link2,
  ShieldCheck,
  Sparkles
} from 'lucide-react';

export default function ResultView({
  result,
  user,
  sittings = [],
  standings = [],
  bookmarks = [],
  onToggleBookmark,
  onRetryMistakes,
  onReturnHome
}) {
  const [copiedSlip, setCopiedSlip] = useState(false);
  const [copiedExamLink, setCopiedExamLink] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState('standings'); // 'standings' | 'review'
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewPage, setReviewPage] = useState(0);
  const [nowTick, setNowTick] = useState(Date.now());
  const [showConfetti, setShowConfetti] = useState(false);

  const [standingsSearch, setStandingsSearch] = useState('');
  const [standingsPage, setStandingsPage] = useState(0);

  const QUESTIONS_PER_PAGE = 3;
  const STANDINGS_PER_PAGE = 8;

  const matchedSitting = sittings.find((s) => String(s.id) === String(result.sittingId));
  const passMark = matchedSitting?.passMark || result.passMark || 50;
  const releasePolicy =
    matchedSitting?.releaseMode ||
    (matchedSitting?.resultsReleased === false ? 'HELD' : result.releaseMode || 'INSTANT');
  const releaseTimestamp = matchedSitting?.releaseAt || result.releaseAt || null;

  const isHeldByAdmin =
    result.mode !== 'PRACTICE' &&
    (releasePolicy === 'HELD' ||
      (releasePolicy === 'SCHEDULED' &&
        releaseTimestamp &&
        new Date(releaseTimestamp).getTime() > nowTick));

  const didPass = result.percentage >= passMark;

  // Auto-unlock check when scheduled time arrives
  useEffect(() => {
    if (!isHeldByAdmin) return;
    const timer = setInterval(() => setNowTick(Date.now()), 5000);
    return () => clearInterval(timer);
  }, [isHeldByAdmin]);

  // Trigger lightweight 3.2-second celebration confetti when candidate passes & results are released
  useEffect(() => {
    if (!isHeldByAdmin && didPass) {
      setShowConfetti(true);
      const timer = setTimeout(() => setShowConfetti(false), 3200);
      return () => clearTimeout(timer);
    }
  }, [isHeldByAdmin, didPass]);

  // Pre-compute 36 lightweight confetti particles in AIA brand colors (Orange, Teal, Amber Gold, Emerald)
  const confettiPieces = useMemo(() => {
    const colors = ['#ea580c', '#14b8a6', '#f59e0b', '#10b981', '#fb923c', '#2dd4bf'];
    return Array.from({ length: 36 }).map((_, idx) => ({
      id: idx,
      left: `${(idx * 2.8 + (idx % 3) * 1.5) % 98}%`,
      delay: `${(idx % 7) * 0.12}s`,
      duration: `${2.1 + (idx % 5) * 0.22}s`,
      color: colors[idx % colors.length],
      size: idx % 2 === 0 ? 8 : 6,
      rotate: (idx * 47) % 360
    }));
  }, []);

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  const shareableExamUrl = `${window.location.origin}/?exam=${encodeURIComponent(
    result.sittingId || 'sit-mock-1'
  )}`;

  // STRICT COPY: Copies ONLY the raw exam link
  const handleCopyExamLink = () => {
    navigator.clipboard.writeText(shareableExamUrl);
    setCopiedExamLink(true);
    setTimeout(() => setCopiedExamLink(false), 2200);
  };

  // NATIVE SHARE: Opens system share drawer
  const handleNativeShareLink = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: result.title,
          url: shareableExamUrl
        });
        return;
      } catch (e) {}
    }
    handleCopyExamLink();
  };

  // ============================================================================
  // EMBARGO SCREEN: Shown when Organiser holds or schedules results release
  // ============================================================================
  if (isHeldByAdmin) {
    const formattedSchedule = releaseTimestamp
      ? new Date(releaseTimestamp).toLocaleString([], {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit'
        })
      : null;

    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 sm:pt-14 pb-20 space-y-8 animate-view">
        <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
          <button
            onClick={onReturnHome}
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-orange-600"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Dashboard</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyExamLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold hover:border-orange-500 transition-colors"
            >
              {copiedExamLink ? (
                <>
                  <Check className="w-3.5 h-3.5 text-teal-500" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Link2 className="w-3.5 h-3.5 text-orange-600" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
            <button
              onClick={handleNativeShareLink}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-bold transition-colors"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>Share</span>
            </button>
          </div>
        </div>

        <div className="app-surface rounded-3xl p-6 sm:p-10 border border-zinc-200 dark:border-zinc-800 text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-600 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-widest px-3 py-1 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" /> Official Script Recorded
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Submission Locked & Received
            </h1>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              Your script for <strong className="text-zinc-900 dark:text-white">{result.title}</strong> has been securely saved. To protect exam integrity while other candidates are still writing, scores and question corrections are currently held by the Organiser.
            </p>
          </div>

          {releasePolicy === 'SCHEDULED' && formattedSchedule && (
            <div className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 font-mono text-xs font-bold">
              <Clock className="w-4 h-4" />
              <span>Scheduled Release: {formattedSchedule}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800 py-4 text-left sm:text-center gap-y-3">
            <div className="px-4">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Candidate</span>
              <span className="font-bold text-sm truncate block mt-0.5">{user.fullName}</span>
            </div>
            <div className="px-4 pt-3 sm:pt-0">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Attempted</span>
              <span className="font-mono font-extrabold text-sm text-orange-600 block mt-0.5">
                {Object.keys(result.answers || {}).length} / {result.totalQuestions} Qs
              </span>
            </div>
            <div className="px-4 pt-3 sm:pt-0">
              <span className="text-[10px] font-mono uppercase text-zinc-400 block">Finish Time</span>
              <span className="font-mono font-extrabold text-sm text-teal-600 dark:text-teal-400 block mt-0.5">
                {formatDuration(result.timeSpentSeconds)}
              </span>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={onReturnHome}
              className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold transition-colors"
            >
              Back to Candidate Portal
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Deduplicate standings specifically for THIS sitting (1st attempt per student only)
  const rawTestRows = standings.filter(
    (s) =>
      (result.sittingId && s.sittingId === result.sittingId) ||
      s.sittingTitle === result.sittingTitle
  );
  const seenCandidates = new Set();
  const testStandings = [];
  for (const r of rawTestRows) {
    const k = (r.email || r.name || '').toLowerCase().trim();
    if (!seenCandidates.has(k)) {
      seenCandidates.add(k);
      testStandings.push(r);
    }
  }
  testStandings.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.timeSecs - b.timeSecs));

  const totalParticipants = Math.max(1, testStandings.length);
  const userRankIndex = testStandings.findIndex(
    (s) => s.id === result.entryId || s.name.toLowerCase() === user.fullName.toLowerCase()
  );
  const userRank = userRankIndex !== -1 ? userRankIndex + 1 : 1;

  const avgScore = Math.round(
    testStandings.reduce((acc, s) => acc + s.score, 0) / totalParticipants
  );
  const fastestSecs =
    testStandings.length > 0
      ? Math.min(...testStandings.map((s) => s.timeSecs))
      : result.timeSpentSeconds;
  const percentile =
    totalParticipants > 1
      ? Math.max(1, Math.round(((totalParticipants - userRank) / (totalParticipants - 1)) * 100))
      : 100;

  const filteredTestStandings = testStandings.filter(
    (s) =>
      s.name.toLowerCase().includes(standingsSearch.toLowerCase()) ||
      (s.dept || '').toLowerCase().includes(standingsSearch.toLowerCase())
  );
  const totalStandingPages = Math.max(
    1,
    Math.ceil(filteredTestStandings.length / STANDINGS_PER_PAGE)
  );
  const paginatedTestStandings = filteredTestStandings.slice(
    standingsPage * STANDINGS_PER_PAGE,
    (standingsPage + 1) * STANDINGS_PER_PAGE
  );

  const handleShareBragCard = async () => {
    const shareText = `🔥 AIA Academy Result — Ranked #${userRank} of ${totalParticipants}!\n👤 ${user.fullName} (${user.department})\n📚 ${result.title}\n🎯 Score: ${result.percentage}% (Test Avg: ${avgScore}%)\n⚡ Time: ${formatDuration(result.timeSpentSeconds)}\n\nTake this exact mock here: ${shareableExamUrl}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'My AIA Academy Mock Result', text: shareText });
        return;
      } catch (e) {}
    }
    navigator.clipboard.writeText(shareText);
    setCopiedSlip(true);
    setTimeout(() => setCopiedSlip(false), 2500);
  };

  const filteredQuestions = result.questions.filter((q) => {
    const isCorrect = result.answers[q.id] === q.correctIndex;
    if (reviewFilter === 'missed') return !isCorrect;
    if (reviewFilter === 'correct') return isCorrect;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredQuestions.length / QUESTIONS_PER_PAGE));
  const paginatedReview = filteredQuestions.slice(
    reviewPage * QUESTIONS_PER_PAGE,
    (reviewPage + 1) * QUESTIONS_PER_PAGE
  );

  const topThreeInExam = testStandings.slice(0, 3);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-20 space-y-8 animate-view relative">
      {/* LIGHTWEIGHT ZERO-LAG CONFETTI SPLASH (Auto-unmounts after 3.2s) */}
      {showConfetti && (
        <>
          <style>{`
            @keyframes aiaConfettiFall {
              0% { transform: translate3d(0, -20px, 0) rotate(0deg); opacity: 1; }
              75% { opacity: 1; }
              100% { transform: translate3d(15px, 68vh, 0) rotate(540deg); opacity: 0; }
            }
          `}</style>
          <div className="fixed inset-x-0 top-0 h-[70vh] pointer-events-none z-50 overflow-hidden">
            {confettiPieces.map((p) => (
              <span
                key={p.id}
                style={{
                  position: 'absolute',
                  top: '-12px',
                  left: p.left,
                  width: `${p.size}px`,
                  height: `${p.size * 1.6}px`,
                  backgroundColor: p.color,
                  borderRadius: '2px',
                  animation: `aiaConfettiFall ${p.duration} cubic-bezier(0.22, 1, 0.36, 1) ${p.delay} forwards`
                }}
              />
            ))}
          </div>
        </>
      )}

      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <button
          onClick={onReturnHome}
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-zinc-600 dark:text-zinc-300 hover:text-orange-600"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Return to Dashboard</span>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyExamLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold hover:border-orange-500 transition-colors"
            title="Copy Strict Exam Link Only"
          >
            {copiedExamLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-teal-500" />
                <span>Link Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-orange-600" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          <button
            onClick={handleNativeShareLink}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold hover:border-orange-500 transition-colors"
            title="Share Exam"
          >
            <Share2 className="w-3.5 h-3.5 text-teal-500" />
            <span>Share</span>
          </button>

          {result.missedQuestions.length > 0 && (
            <button
              onClick={() => onRetryMistakes(result.missedQuestions, result.title)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold shadow-sm transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry {result.missedQuestions.length} Missed Qs</span>
            </button>
          )}
        </div>
      </div>

      {/* Notice Banner if this was a Retake (2nd+ attempt) */}
      {result.isFirstAttempt === false && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <span>
              <strong>Retake Practice Attempt (#{result.attemptNumber}):</strong> Your personal score is shown below. Note that the Official Leaderboard strictly preserves each candidate's <strong>1st attempt</strong>.
            </span>
          </div>
        </div>
      )}

      {/* Hero Breakdown + Brag Slip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-1 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
                RANKED #{userRank} OF {totalParticipants} ON THIS TEST
              </span>
              <span
                className={`text-[11px] font-mono px-2.5 py-1 rounded font-bold ${
                  didPass
                    ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                    : 'bg-red-500/15 text-red-500'
                }`}
              >
                {didPass ? `PASSED (Pass Mark: ${passMark}%)` : `BELOW PASS MARK (${passMark}%)`}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">
              {result.percentage >= 85
                ? 'Distinction Performance! 🎉'
                : didPass
                ? 'Congratulations, You Passed! 👏'
                : 'Keep Pushing — Review & Retry.'}
            </h1>
            <p className="text-sm text-zinc-500 mt-1">{result.title}</p>
          </div>

          {/* 4-Column Peer Comparison Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800 py-5 gap-y-4">
            <div className="pr-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                Your Score
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-extrabold text-orange-600 mt-1 block">
                {result.percentage}%
              </span>
              <span className="text-[11px] text-zinc-500">
                Test Avg: <strong className="font-mono">{avgScore}%</strong>
              </span>
            </div>

            <div className="sm:px-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                1st-Try Rank
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-extrabold mt-1 block">
                #{userRank}
              </span>
              <span className="text-[11px] text-zinc-500">of {totalParticipants} candidates</span>
            </div>

            <div className="sm:px-3 pt-3 sm:pt-0">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                Your Time
              </span>
              <span className="font-mono text-xl sm:text-2xl font-extrabold text-teal-600 dark:text-teal-400 mt-1 block">
                {formatDuration(result.timeSpentSeconds)}
              </span>
              <span className="text-[11px] text-zinc-500">
                Fastest: <strong className="font-mono">{formatDuration(fastestSecs)}</strong>
              </span>
            </div>

            <div className="sm:pl-3 pt-3 sm:pt-0">
              <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block">
                Raw Correct
              </span>
              <span className="font-mono text-2xl sm:text-3xl font-extrabold mt-1 block">
                {result.correctCount}/{result.totalQuestions}
              </span>
              <span className="text-[11px] text-zinc-500">
                Top {100 - percentile + 1}%
              </span>
            </div>
          </div>
        </div>

        {/* Shareable Brag Card */}
        <div className="lg:col-span-5 rounded-3xl p-6 bg-orange-600 text-white flex flex-col justify-between shadow-xl shadow-orange-600/20">
          <div className="flex items-center justify-between bg-black px-3.5 py-2.5 rounded-2xl">
            <AiaLogo className="h-6" forceWhiteInk={true} />
            <span className="font-mono text-[10px] font-bold text-teal-400">
              RANK #{userRank}/{totalParticipants}
            </span>
          </div>

          <div className="my-5 space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-orange-100">
                {user.department}
              </p>
              <h3 className="text-2xl font-extrabold tracking-tight text-white">
                {user.fullName}
              </h3>
              <p className="text-xs text-orange-100 truncate mt-0.5">{result.title}</p>
            </div>

            <div className="p-4 rounded-2xl bg-black text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-mono uppercase text-zinc-400 block">
                  Verified Score
                </span>
                <span className="font-mono text-3xl font-extrabold text-orange-400">
                  {result.percentage}%
                </span>
              </div>
              <div className="text-right font-mono">
                <span className="text-[10px] uppercase text-zinc-400 block">Finish Time</span>
                <span className="text-base font-bold text-teal-400">
                  {formatDuration(result.timeSpentSeconds)}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleShareBragCard}
            className="w-full py-3 rounded-xl bg-white text-black hover:bg-zinc-100 font-bold text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2"
          >
            {copiedSlip ? (
              <>
                <Check className="w-4 h-4 text-teal-600" />
                <span>Result + Exam Link Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-4 h-4" />
                <span>Share Brag Slip & Challenge Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Switcher: Per-Test Leaderboard vs. Question-by-Question Review */}
      <div className="flex items-center justify-between flex-wrap gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveResultTab('standings')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
              activeResultTab === 'standings'
                ? 'bg-orange-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500'
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span>This Exam's Leaderboard ({testStandings.length})</span>
          </button>

          <button
            onClick={() => setActiveResultTab('review')}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-colors ${
              activeResultTab === 'review'
                ? 'bg-orange-600 text-white'
                : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Question Corrections ({result.questions.length})</span>
          </button>
        </div>

        <span className="text-[11px] font-mono text-zinc-400">
          ★ Official Leaderboard logs 1st attempts only
        </span>
      </div>

      {/* TAB 1: PER-TEST STANDINGS WITH TOP 3 PODIUM + 4TH+ LIST */}
      {activeResultTab === 'standings' ? (
        <section className="space-y-6">
          {/* TOP 3 PODIUM CARDS */}
          {standingsPage === 0 && !standingsSearch && topThreeInExam.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end pt-2">
              {[
                { rank: 2, item: topThreeInExam[1] },
                { rank: 1, item: topThreeInExam[0] },
                { rank: 3, item: topThreeInExam[2] }
              ]
                .filter((s) => Boolean(s.item))
                .map(({ rank, item }) => {
                  const isMe = item.name.toLowerCase() === user.fullName.toLowerCase();
                  return (
                    <div
                      key={item.id}
                      className={`rounded-3xl p-5 flex sm:flex-col items-center justify-between sm:justify-center text-left sm:text-center gap-3 ${
                        rank === 1
                          ? 'bg-gradient-to-b from-amber-500/20 via-orange-500/10 to-transparent border-2 border-amber-500/60 sm:py-7 order-1 sm:order-2 shadow-lg'
                          : rank === 2
                          ? 'bg-zinc-100/80 dark:bg-zinc-900/90 border border-zinc-300 dark:border-zinc-700 order-2 sm:order-1'
                          : 'bg-orange-950/10 dark:bg-orange-950/30 border border-orange-500/30 order-3'
                      }`}
                    >
                      <div className="flex sm:flex-col items-center gap-3 sm:gap-2">
                        <div
                          className={`flex items-center justify-center rounded-2xl ${
                            rank === 1
                              ? 'w-14 h-14 bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-md'
                              : rank === 2
                              ? 'w-11 h-11 bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white'
                              : 'w-10 h-10 bg-amber-800 text-amber-100'
                          }`}
                        >
                          {rank === 1 ? (
                            <Trophy className="w-7 h-7" />
                          ) : rank === 2 ? (
                            <Medal className="w-5 h-5" />
                          ) : (
                            <Award className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <span className="font-mono text-[10px] uppercase font-extrabold text-orange-600 dark:text-amber-400 block">
                            #{rank} Place
                          </span>
                          <h4 className="font-extrabold text-sm sm:text-base">
                            {item.name} {isMe && <span className="text-orange-600">(You)</span>}
                          </h4>
                          <span className="text-xs text-zinc-500 block">{item.dept}</span>
                        </div>
                      </div>

                      <div className="text-right sm:text-center font-mono">
                        <span className="text-xl font-extrabold text-orange-600 dark:text-amber-400 block">
                          {item.score}%
                        </span>
                        <span className="text-xs text-teal-600 dark:text-teal-400">
                          ⚡ {formatDuration(item.timeSecs)}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-base">
                All Challengers — {result.sittingTitle || result.title}
              </h2>
              <p className="text-xs text-zinc-500">
                Ranked by 1st-attempt accuracy and finish speed.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative w-56">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={standingsSearch}
                  onChange={(e) => {
                    setStandingsSearch(e.target.value);
                    setStandingsPage(0);
                  }}
                  placeholder="Find candidate or course..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl app-surface text-xs"
                />
              </div>

              <div className="flex items-center gap-1 font-mono text-xs">
                <button
                  disabled={standingsPage === 0}
                  onClick={() => setStandingsPage((p) => Math.max(0, p - 1))}
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-1.5">
                  {standingsPage + 1}/{totalStandingPages}
                </span>
                <button
                  disabled={standingsPage >= totalStandingPages - 1}
                  onClick={() =>
                    setStandingsPage((p) => Math.min(totalStandingPages - 1, p + 1))
                  }
                  className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Full Orderly Leaderboard Table */}
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
            {paginatedTestStandings.map((row) => {
              const globalRank = testStandings.findIndex((item) => item.id === row.id) + 1;
              const isMe =
                row.id === result.entryId ||
                row.name.toLowerCase() === user.fullName.toLowerCase();

              return (
                <div
                  key={row.id}
                  className={`py-3.5 px-3 flex items-center justify-between text-xs sm:text-sm ${
                    isMe ? 'bg-orange-500/[0.06] font-semibold' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <span
                      className={`w-7 h-7 rounded-xl font-mono text-xs font-bold flex items-center justify-center ${
                        globalRank === 1
                          ? 'bg-amber-500 text-black'
                          : globalRank === 2
                          ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white'
                          : globalRank === 3
                          ? 'bg-orange-800 text-amber-100'
                          : 'bg-zinc-200 dark:bg-zinc-900 text-zinc-500'
                      }`}
                    >
                      {globalRank}
                    </span>
                    <div>
                      <span className="font-bold block">
                        {row.name} {isMe && <span className="text-orange-600">(You)</span>}
                      </span>
                      <span className="text-xs text-zinc-500">{row.dept}</span>
                    </div>
                  </div>

                  <div className="text-right font-mono">
                    <span className="font-extrabold text-orange-600 dark:text-orange-400 block">
                      {row.score}%
                    </span>
                    <span className="text-xs text-teal-600 dark:text-teal-400">
                      {formatDuration(row.timeSecs)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        /* TAB 2: PAGINATED 3-PER-PAGE QUESTION CORRECTIONS */
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              {[
                { id: 'all', label: `All (${result.questions.length})` },
                { id: 'missed', label: `Missed (${result.missedQuestions.length})` },
                {
                  id: 'correct',
                  label: `Correct (${result.questions.length - result.missedQuestions.length})`
                }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setReviewFilter(tab.id);
                    setReviewPage(0);
                  }}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    reviewFilter === tab.id
                      ? 'bg-zinc-900 dark:bg-white text-white dark:text-black'
                      : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-zinc-500 mr-1">
                Page {reviewPage + 1} of {totalPages}
              </span>
              <button
                disabled={reviewPage === 0}
                onClick={() => setReviewPage((p) => Math.max(0, p - 1))}
                className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold disabled:opacity-35 flex items-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Prev 3</span>
              </button>
              <button
                disabled={reviewPage >= totalPages - 1}
                onClick={() => setReviewPage((p) => Math.min(totalPages - 1, p + 1))}
                className="px-3 py-1.5 rounded-xl bg-orange-600 text-white text-xs font-semibold disabled:opacity-35 flex items-center gap-1"
              >
                <span>Next 3</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
            {paginatedReview.map((q) => {
              const globalNumber = result.questions.findIndex((item) => item.id === q.id) + 1;
              const userSelected = result.answers[q.id];
              const isCorrect = userSelected === q.correctIndex;
              const isSaved = bookmarks.some((b) => b.id === q.id);

              return (
                <div key={q.id} className="py-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-xs font-bold px-2.5 py-1 rounded bg-zinc-900 dark:bg-zinc-800 text-white">
                        Q{globalNumber}
                      </span>
                      <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                        {q.courseCode}
                      </span>
                      {isCorrect ? (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-teal-600 dark:text-teal-400">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Correct
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-red-500">
                          <XCircle className="w-3.5 h-3.5" />{' '}
                          {userSelected === undefined ? 'Unanswered' : 'Missed'}
                        </span>
                      )}
                    </div>

                    <button
                      onClick={() => onToggleBookmark(q)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                        isSaved
                          ? 'bg-orange-600 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      <span>{isSaved ? 'Saved' : 'Bookmark'}</span>
                    </button>
                  </div>

                  <p className="font-bold text-base">{q.question}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs sm:text-sm">
                    {q.options.map((opt, optIdx) => {
                      const isRightAnswer = optIdx === q.correctIndex;
                      const isUserWrongChoice = optIdx === userSelected && !isRightAnswer;

                      return (
                        <div
                          key={optIdx}
                          className={`p-3 rounded-xl border flex items-center gap-2.5 ${
                            isRightAnswer
                              ? 'bg-teal-500/10 border-teal-500 text-teal-800 dark:text-teal-300 font-semibold'
                              : isUserWrongChoice
                              ? 'bg-red-500/10 border-red-500 text-red-600 dark:text-red-400'
                              : 'border-zinc-200 dark:border-zinc-800 text-zinc-500'
                          }`}
                        >
                          <span className="font-mono font-bold">
                            {['A', 'B', 'C', 'D', 'E'][optIdx]}.
                          </span>
                          <span>{opt}</span>
                        </div>
                      );
                    })}
                  </div>

                  {q.explanation && (
                    <p className="text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-100/80 dark:bg-zinc-900/80 p-3.5 rounded-xl border-l-4 border-orange-600">
                      <strong className="text-zinc-900 dark:text-white">Rationale: </strong>
                      {q.explanation}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}