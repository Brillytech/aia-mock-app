import React, { useState } from 'react';
import AiaLogo from './AiaLogo';
import {
  RotateCcw,
  Share2,
  Bookmark,
  CheckCircle2,
  XCircle,
  ArrowLeft,
  Sparkles,
  Check,
  ChevronLeft,
  ChevronRight,
  Trophy,
  Search,
  Link2
} from 'lucide-react';

export default function ResultView({
  result,
  user,
  standings = [],
  bookmarks,
  onToggleBookmark,
  onRetryMistakes,
  onReturnHome
}) {
  const [copiedSlip, setCopiedSlip] = useState(false);
  const [copiedExamLink, setCopiedExamLink] = useState(false);
  const [activeResultTab, setActiveResultTab] = useState('standings'); // 'standings' | 'review'
  const [reviewFilter, setReviewFilter] = useState('all');
  const [reviewPage, setReviewPage] = useState(0);

  // Per-Test Standings Search & Pagination (Not just Top 10!)
  const [standingsSearch, setStandingsSearch] = useState('');
  const [standingsPage, setStandingsPage] = useState(0);

  const QUESTIONS_PER_PAGE = 3;
  const STANDINGS_PER_PAGE = 8;

  const formatDuration = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  // Filter standings specifically for THIS test/sitting
  const testStandings = standings
    .filter(
      (s) =>
        (result.sittingId && s.sittingId === result.sittingId) ||
        s.sittingTitle === result.sittingTitle ||
        s.mode === result.mode
    )
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.timeSecs - b.timeSecs));

  const totalParticipants = Math.max(1, testStandings.length);
  const userRankIndex = testStandings.findIndex((s) => s.id === result.entryId);
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

  const shareableExamUrl = `${window.location.origin}/?exam=${encodeURIComponent(
    result.sittingId || 'sit-mock-1'
  )}`;

  const handleCopyExamLink = () => {
    navigator.clipboard.writeText(shareableExamUrl);
    setCopiedExamLink(true);
    setTimeout(() => setCopiedExamLink(false), 2200);
  };

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

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 sm:pt-10 pb-20 space-y-8 animate-view">
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
          >
            {copiedExamLink ? (
              <>
                <Check className="w-3.5 h-3.5 text-teal-500" />
                <span>Exam Link Copied!</span>
              </>
            ) : (
              <>
                <Link2 className="w-3.5 h-3.5 text-orange-600" />
                <span>Share Exam Link</span>
              </>
            )}
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

      {/* Hero Breakdown + Brag Slip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
        <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono uppercase tracking-widest px-2.5 py-1 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
                RANKED #{userRank} OF {totalParticipants} ON THIS TEST
              </span>
              <span className="text-[11px] font-mono px-2.5 py-1 rounded bg-orange-500/10 text-orange-600 font-bold">
                Top {100 - percentile + 1}%
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight mt-3">
              {result.percentage >= 85
                ? 'Distinction Performance.'
                : result.percentage >= 60
                ? 'Solid Pass.'
                : 'Needs Revision.'}
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
                Your Position
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
              <span className="text-[11px] text-zinc-500">Questions</span>
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
      <div className="flex items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-3">
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

      {/* ====================================================================
          TAB 1: PER-TEST STANDINGS (Full Paginated & Pinned Personal Row)
      ==================================================================== */}
      {activeResultTab === 'standings' ? (
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="font-extrabold text-base">
                Standings for {result.sittingTitle || result.title}
              </h2>
              <p className="text-xs text-zinc-500">
                Compare your accuracy and finish speed against everyone who sat for this exam.
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

          {/* Pinned Personal Standing Banner */}
          <div className="p-4 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-between text-xs sm:text-sm">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-1 rounded-lg bg-orange-600 text-white font-mono text-xs font-bold">
                YOUR RANK #{userRank}
              </span>
              <div>
                <span className="font-extrabold block">{user.fullName} (You)</span>
                <span className="text-xs text-zinc-500">{user.department}</span>
              </div>
            </div>
            <div className="text-right font-mono">
              <span className="font-extrabold text-orange-600 dark:text-orange-400 block">
                {result.percentage}% ({result.correctCount}/{result.totalQuestions})
              </span>
              <span className="text-xs text-teal-600 dark:text-teal-400">
                {formatDuration(result.timeSpentSeconds)}
              </span>
            </div>
          </div>

          {/* Full Orderly Leaderboard Table */}
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
            {paginatedTestStandings.map((row) => {
              const globalRank = testStandings.findIndex((item) => item.id === row.id) + 1;
              const isMe = row.id === result.entryId || row.name === user.fullName;

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
                          ? 'bg-orange-600 text-white'
                          : globalRank <= 3
                          ? 'bg-teal-600 text-white'
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
        /* ====================================================================
            TAB 2: PAGINATED 3-PER-PAGE QUESTION CORRECTIONS
        ==================================================================== */
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
                            {['A', 'B', 'C', 'D'][optIdx]}.
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