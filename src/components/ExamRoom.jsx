import React, { useState, useEffect } from 'react';
import {
  Clock,
  Bookmark,
  Flag,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calculator,
  X,
  Zap,
  Layers,
  ShieldCheck
} from 'lucide-react';

export default function ExamRoom({
  sessionConfig,
  questions,
  bookmarks,
  onToggleBookmark,
  onReportQuestion,
  onCompleteExam,
  onCancelExam
}) {
  const STORAGE_KEY = 'aia_active_exam_state';

  const isSpeedDrill = sessionConfig.mode === 'PRACTICE';
  const isBundledMarathon = sessionConfig.mode === 'BUNDLED';

  const [prepCountdown, setPrepCountdown] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && JSON.parse(saved).sessionId === sessionConfig.sessionId) {
      return 0;
    }
    return 3;
  });

  const [currentIndex, setCurrentIndex] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).currentIndex || 0 : 0;
  });

  const [answers, setAnswers] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).answers || {} : {};
  });

  const [flaggedReview, setFlaggedReview] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved).flaggedReview || [] : [];
  });

  const [timeLeft, setTimeLeft] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.sessionId === sessionConfig.sessionId && parsed.timeLeft > 0) {
        return parsed.timeLeft;
      }
    }
    return sessionConfig.durationSeconds;
  });

  // Unique to Speed Drill: toggle instant answer check
  const [instantFeedbackEnabled, setInstantFeedbackEnabled] = useState(true);

  // Unique to Bundled Marathon: distinct course codes in the session
  const distinctSubjects = Array.from(new Set(questions.map((q) => q.courseCode)));

  // Calculator State
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('0');
  const [calcPrev, setCalcPrev] = useState(null);
  const [calcOp, setCalcOp] = useState(null);
  const [resetNext, setResetNext] = useState(false);

  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('Typo in question or options');
  const [reportNote, setReportNote] = useState('');
  const [reportSent, setReportSent] = useState(false);

  const currentQ = questions[currentIndex] || questions[0];
  const totalQuestions = questions.length;
  const answeredCount = Object.keys(answers).length;

  useEffect(() => {
    if (prepCountdown <= 0) return;
    const timer = setTimeout(() => {
      setPrepCountdown((prev) => prev - 1);
    }, 850);
    return () => clearTimeout(timer);
  }, [prepCountdown]);

  useEffect(() => {
    if (prepCountdown > 0) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sessionId: sessionConfig.sessionId,
        currentIndex,
        answers,
        flaggedReview,
        timeLeft,
        updatedAt: Date.now()
      })
    );
  }, [currentIndex, answers, flaggedReview, timeLeft, prepCountdown, sessionConfig.sessionId]);

  useEffect(() => {
    if (prepCountdown > 0) return;
    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [timeLeft, prepCountdown]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (prepCountdown > 0 || showReportModal || showSubmitModal) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const key = e.key.toUpperCase();
      if (key === 'A') handleSelectOption(0);
      if (key === 'B') handleSelectOption(1);
      if (key === 'C') handleSelectOption(2);
      if (key === 'D') handleSelectOption(3);
      if (key === 'N' || e.key === 'ArrowRight') {
        setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1));
      }
      if (key === 'P' || e.key === 'ArrowLeft') {
        setCurrentIndex((prev) => Math.max(0, prev - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [prepCountdown, currentIndex, totalQuestions, showReportModal, showSubmitModal]);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  };

  const handleSelectOption = (optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: optionIndex
    }));
  };

  const toggleReviewFlag = (qId) => {
    setFlaggedReview((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );
  };

  const inputDigit = (digit) => {
    if (resetNext) {
      setCalcDisplay(String(digit));
      setResetNext(false);
    } else {
      setCalcDisplay(calcDisplay === '0' ? String(digit) : calcDisplay + digit);
    }
  };

  const inputDecimal = () => {
    if (resetNext) {
      setCalcDisplay('0.');
      setResetNext(false);
      return;
    }
    if (!calcDisplay.includes('.')) setCalcDisplay(calcDisplay + '.');
  };

  const clearCalc = () => {
    setCalcDisplay('0');
    setCalcPrev(null);
    setCalcOp(null);
    setResetNext(false);
  };

  const handleUnaryOp = (type) => {
    const val = parseFloat(calcDisplay);
    if (isNaN(val)) return;
    let res = val;
    if (type === 'sqrt') res = val >= 0 ? Math.sqrt(val) : 0;
    if (type === 'sq') res = val * val;
    if (type === 'pct') res = val / 100;
    setCalcDisplay(String(Number(res.toFixed(6))));
    setResetNext(true);
  };

  const performOperation = (nextOp) => {
    const inputValue = parseFloat(calcDisplay);
    if (calcPrev === null) {
      setCalcPrev(inputValue);
    } else if (calcOp) {
      const currentValue = calcPrev || 0;
      let newValue = currentValue;
      if (calcOp === '+') newValue = currentValue + inputValue;
      if (calcOp === '-') newValue = currentValue - inputValue;
      if (calcOp === '×') newValue = currentValue * inputValue;
      if (calcOp === '÷') newValue = inputValue !== 0 ? currentValue / inputValue : 0;

      const formatted = Number(newValue.toFixed(6));
      setCalcPrev(formatted);
      setCalcDisplay(String(formatted));
    }
    setResetNext(true);
    setCalcOp(nextOp);
  };

  const handleSendReport = (e) => {
    e.preventDefault();
    onReportQuestion({
      questionId: currentQ.id,
      courseCode: currentQ.courseCode,
      reason: reportReason,
      note: reportNote,
      timestamp: new Date().toISOString()
    });
    setReportSent(true);
    setTimeout(() => {
      setReportSent(false);
      setReportNote('');
      setShowReportModal(false);
    }, 900);
  };

  const handleFinalSubmit = () => {
    const timeSpent = Math.max(1, sessionConfig.durationSeconds - timeLeft);
    let correctCount = 0;
    const missedQuestions = [];

    questions.forEach((q) => {
      if (answers[q.id] === q.correctIndex) {
        correctCount += 1;
      } else {
        missedQuestions.push(q);
      }
    });

    const percentage = Math.round((correctCount / totalQuestions) * 100);
    localStorage.removeItem(STORAGE_KEY);

    onCompleteExam({
      sessionId: sessionConfig.sessionId,
      sittingId: sessionConfig.sittingId,
      sittingTitle: sessionConfig.sittingTitle,
      mode: sessionConfig.mode,
      title: sessionConfig.title,
      totalQuestions,
      correctCount,
      percentage,
      timeSpentSeconds: timeSpent,
      answers,
      questions,
      missedQuestions,
      completedAt: new Date().toISOString()
    });
  };

  if (prepCountdown > 0) {
    return (
      <div className="fixed inset-0 z-50 bg-[#09090b] text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="pointer-events-none absolute w-96 h-96 rounded-full bg-orange-600/20 blur-3xl" />
        <span className="text-xs font-mono uppercase tracking-[0.25em] text-teal-400 mb-3">
          {sessionConfig.mode === 'PRACTICE'
            ? 'Speed Drill • Instant Feedback Active'
            : sessionConfig.mode === 'BUNDLED'
            ? 'Multi-Course Marathon • Subject Tabs Active'
            : 'Official Timed Mock • Strict Exam Conditions'}
        </span>
        <h2 className="text-lg sm:text-xl font-semibold text-zinc-300 mb-8 text-center">
          {sessionConfig.title}
        </h2>
        <div
          key={prepCountdown}
          className="w-32 h-32 rounded-3xl bg-orange-600 text-white font-mono text-6xl font-extrabold flex items-center justify-center shadow-2xl shadow-orange-600/40 animate-view"
        >
          {prepCountdown}
        </div>
        <p className="text-xs text-zinc-500 mt-8 font-mono">
          Keyboard shortcuts active: [A] [B] [C] [D] to answer • [N] / [P] to navigate
        </p>
      </div>
    );
  }

  const isLowTime = timeLeft <= 60;
  const isBookmarked = bookmarks.some((b) => b.id === currentQ.id);
  const isFlaggedForReview = flaggedReview.includes(currentQ.id);
  const selectedAnswerForCurrent = answers[currentQ.id];
  const showSpeedDrillCorrection =
    isSpeedDrill && instantFeedbackEnabled && selectedAnswerForCurrent !== undefined;

  return (
    <div className="min-h-screen flex flex-col justify-between pb-16 animate-view relative">
      {/* Top Exam Bar */}
      <header className="sticky top-0 z-40 bg-zinc-950 text-white border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                onCancelExam();
              }}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              title="Exit Session"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-orange-600 text-white font-bold">
                  {sessionConfig.mode}
                </span>
                {isSpeedDrill ? (
                  <button
                    type="button"
                    onClick={() => setInstantFeedbackEnabled(!instantFeedbackEnabled)}
                    className={`text-[10px] font-mono px-2 py-0.5 rounded border transition-colors ${
                      instantFeedbackEnabled
                        ? 'bg-teal-500/20 border-teal-500/40 text-teal-300'
                        : 'bg-zinc-900 border-zinc-700 text-zinc-400'
                    }`}
                  >
                    <Zap className="w-3 h-3 inline mr-1" />
                    {instantFeedbackEnabled ? 'Instant Check: ON' : 'Instant Check: OFF'}
                  </button>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-mono text-teal-400">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>Strict Lock</span>
                  </span>
                )}
              </div>
              <h1 className="font-semibold text-xs sm:text-sm truncate text-zinc-100 mt-0.5">
                {sessionConfig.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowCalculator(!showCalculator)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
                showCalculator
                  ? 'bg-teal-600 border-teal-500 text-white'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
              title="Toggle CBT Calculator"
            >
              <Calculator className="w-4 h-4 text-teal-400" />
              <span className="hidden sm:inline">Calculator</span>
            </button>

            <div
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold border ${
                isLowTime
                  ? 'bg-red-600 text-white border-red-500 animate-pulse'
                  : 'bg-zinc-900 border-zinc-800 text-orange-400'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>{formatTime(timeLeft)}</span>
            </div>

            <button
              onClick={() => setShowSubmitModal(true)}
              className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs sm:text-sm transition-colors"
            >
              Submit ({answeredCount}/{totalQuestions})
            </button>
          </div>
        </div>

        {/* UNIQUE TO BUNDLED MARATHON: JAMB-Style Multi-Subject Switcher Tabs */}
        {isBundledMarathon && distinctSubjects.length > 1 && (
          <div className="bg-zinc-900/90 border-t border-zinc-800 px-4 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-mono uppercase text-zinc-400 flex items-center gap-1 mr-1">
              <Layers className="w-3 h-3 text-orange-500" />
              Subjects:
            </span>
            {distinctSubjects.map((code) => {
              const firstIdxForSubject = questions.findIndex((q) => q.courseCode === code);
              const subjectQs = questions.filter((q) => q.courseCode === code);
              const subjectAnswered = subjectQs.filter((q) => answers[q.id] !== undefined).length;
              const isCurrentSubject = currentQ.courseCode === code;

              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setCurrentIndex(firstIdxForSubject)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-colors whitespace-nowrap ${
                    isCurrentSubject
                      ? 'bg-orange-600 text-white'
                      : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                  }`}
                >
                  {code} ({subjectAnswered}/{subjectQs.length})
                </button>
              );
            })}
          </div>
        )}

        <div className="w-full h-1 bg-zinc-900">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-teal-400 transition-all duration-300"
            style={{ width: `${((currentIndex + 1) / totalQuestions) * 100}%` }}
          />
        </div>
      </header>

      {/* FLOATING JAMB CALCULATOR */}
      {showCalculator && (
        <div className="fixed right-4 sm:right-8 top-20 z-50 w-72 rounded-3xl bg-zinc-950 text-white border border-zinc-800 shadow-2xl p-4 space-y-3 animate-view select-none">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300">
                CBT Calculator
              </span>
            </div>
            <button
              onClick={() => setShowCalculator(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-3 rounded-2xl bg-black border border-zinc-800 text-right font-mono">
            <div className="text-[11px] text-zinc-500 h-4">
              {calcPrev !== null ? `${calcPrev} ${calcOp || ''}` : ''}
            </div>
            <div className="text-2xl font-bold text-teal-400 truncate">{calcDisplay}</div>
          </div>

          <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
            <button
              type="button"
              onClick={clearCalc}
              className="py-2 rounded-xl bg-red-500/20 text-red-400 font-bold hover:bg-red-500/30"
            >
              AC
            </button>
            <button
              type="button"
              onClick={() => handleUnaryOp('sqrt')}
              className="py-2 rounded-xl bg-zinc-900 text-teal-300 hover:bg-zinc-800"
            >
              √x
            </button>
            <button
              type="button"
              onClick={() => handleUnaryOp('sq')}
              className="py-2 rounded-xl bg-zinc-900 text-teal-300 hover:bg-zinc-800"
            >
              x²
            </button>
            <button
              type="button"
              onClick={() => handleUnaryOp('pct')}
              className="py-2 rounded-xl bg-zinc-900 text-teal-300 hover:bg-zinc-800"
            >
              %
            </button>

            {[7, 8, 9].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => inputDigit(n)}
                className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-sm"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => performOperation('÷')}
              className="py-2.5 rounded-xl bg-orange-600/20 text-orange-400 font-bold hover:bg-orange-600/30"
            >
              ÷
            </button>

            {[4, 5, 6].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => inputDigit(n)}
                className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-sm"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => performOperation('×')}
              className="py-2.5 rounded-xl bg-orange-600/20 text-orange-400 font-bold hover:bg-orange-600/30"
            >
              ×
            </button>

            {[1, 2, 3].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => inputDigit(n)}
                className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-sm"
              >
                {n}
              </button>
            ))}
            <button
              type="button"
              onClick={() => performOperation('-')}
              className="py-2.5 rounded-xl bg-orange-600/20 text-orange-400 font-bold hover:bg-orange-600/30"
            >
              −
            </button>

            <button
              type="button"
              onClick={() => inputDigit(0)}
              className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-semibold text-sm"
            >
              0
            </button>
            <button
              type="button"
              onClick={inputDecimal}
              className="py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 font-bold text-sm"
            >
              .
            </button>
            <button
              type="button"
              onClick={() => performOperation(null)}
              className="py-2.5 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-500"
            >
              =
            </button>
            <button
              type="button"
              onClick={() => performOperation('+')}
              className="py-2.5 rounded-xl bg-orange-600/20 text-orange-400 font-bold hover:bg-orange-600/30"
            >
              +
            </button>
          </div>
        </div>
      )}

      {/* Main Split Question Canvas */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 pt-6 sm:pt-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        <div className="lg:col-span-8 space-y-6">
          <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-4">
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-lg bg-orange-600 text-white font-mono text-xs font-bold">
                Q{currentIndex + 1} / {totalQuestions}
              </span>
              <span className="font-mono text-xs font-semibold text-teal-600 dark:text-teal-400">
                {currentQ.courseCode}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleReviewFlag(currentQ.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                  isFlaggedForReview
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                }`}
              >
                {isFlaggedForReview ? 'Flagged for Review' : 'Review Later'}
              </button>

              <button
                onClick={() => onToggleBookmark(currentQ)}
                className={`p-2 rounded-xl transition-colors ${
                  isBookmarked
                    ? 'bg-orange-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-500'
                }`}
                title="Save Question"
              >
                <Bookmark className="w-4 h-4" />
              </button>

              <button
                onClick={() => setShowReportModal(true)}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-500 hover:text-red-500"
                title="Report Question Error"
              >
                <Flag className="w-4 h-4" />
              </button>
            </div>
          </div>

          {currentQ.passage && (
            <div className="p-4 rounded-2xl bg-teal-500/[0.06] border-l-4 border-teal-500 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed">
              <span className="block font-mono text-[10px] uppercase tracking-wider font-bold text-teal-600 dark:text-teal-400 mb-1">
                Case Passage
              </span>
              {currentQ.passage}
            </div>
          )}

          <h2 className="text-lg sm:text-xl font-bold leading-relaxed py-2">
            {currentQ.question}
          </h2>

          {/* Options List */}
          <div className="divide-y divide-zinc-200/80 dark:divide-zinc-800/80 border-y border-zinc-200/80 dark:border-zinc-800/80">
            {currentQ.options.map((optionText, idx) => {
              const isSelected = selectedAnswerForCurrent === idx;
              const isCorrectOption = idx === currentQ.correctIndex;
              const optionLabel = ['A', 'B', 'C', 'D'][idx];

              let rowClass = 'hover:bg-zinc-100/70 dark:hover:bg-zinc-900/60';
              if (showSpeedDrillCorrection) {
                if (isCorrectOption) {
                  rowClass = 'bg-teal-600 text-white font-semibold';
                } else if (isSelected && !isCorrectOption) {
                  rowClass = 'bg-red-600 text-white font-semibold';
                }
              } else if (isSelected) {
                rowClass = 'bg-orange-600 text-white font-semibold';
              }

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectOption(idx)}
                  className={`w-full text-left py-4 px-4 transition-colors flex items-center justify-between gap-4 ${rowClass}`}
                >
                  <div className="flex items-center gap-4">
                    <span
                      className={`w-7 h-7 rounded-lg font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                        isSelected || (showSpeedDrillCorrection && isCorrectOption)
                          ? 'bg-black text-white'
                          : 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300'
                      }`}
                    >
                      {optionLabel}
                    </span>
                    <span className="text-sm sm:text-base leading-snug">{optionText}</span>
                  </div>

                  {showSpeedDrillCorrection && isCorrectOption && (
                    <CheckCircle2 className="w-5 h-5 text-white flex-shrink-0" />
                  )}
                  {showSpeedDrillCorrection && isSelected && !isCorrectOption && (
                    <XCircle className="w-5 h-5 text-white flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* UNIQUE TO SPEED DRILL: Instant Rationale Reveal */}
          {showSpeedDrillCorrection && currentQ.explanation && (
            <div className="p-4 rounded-2xl bg-teal-500/10 border border-teal-500/30 text-xs sm:text-sm leading-relaxed animate-view">
              <strong className="text-teal-700 dark:text-teal-300 block mb-0.5 font-mono uppercase text-[11px]">
                Speed Drill Instant Rationale:
              </strong>
              <span className="text-zinc-700 dark:text-zinc-200">{currentQ.explanation}</span>
            </div>
          )}

          <div className="flex items-center justify-between pt-4">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              className="px-5 py-2.5 rounded-xl bg-zinc-200/80 dark:bg-zinc-900 text-xs sm:text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous [P]</span>
            </button>

            {currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((prev) => Math.min(totalQuestions - 1, prev + 1))}
                className="px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-black text-xs sm:text-sm font-bold flex items-center gap-1.5"
              >
                <span>Next Question [N]</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs sm:text-sm font-bold flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Exam</span>
              </button>
            )}
          </div>
        </div>

        {/* Right 4 Columns: CBT Question Map */}
        <aside className="lg:col-span-4 lg:border-l lg:border-zinc-200 dark:lg:border-zinc-800 lg:pl-8 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500">
              CBT Question Map
            </h3>
            <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
              {answeredCount}/{totalQuestions} Done
            </span>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {questions.map((q, idx) => {
              const isCurrent = idx === currentIndex;
              const isAnswered = answers[q.id] !== undefined;
              const isReview = flaggedReview.includes(q.id);

              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={`h-10 rounded-xl font-mono text-xs font-bold transition-all ${
                    isCurrent
                      ? 'ring-2 ring-orange-600 bg-orange-500/15 text-orange-600 dark:text-orange-400'
                      : isReview
                      ? 'bg-amber-500 text-black'
                      : isAnswered
                      ? 'bg-orange-600 text-white'
                      : 'bg-zinc-200/70 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-xs text-zinc-500">
            <div className="flex items-center justify-between">
              <span>Answered</span>
              <span className="font-mono font-bold text-orange-600">{answeredCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Unanswered</span>
              <span className="font-mono font-bold">{totalQuestions - answeredCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Marked for Review</span>
              <span className="font-mono font-bold text-amber-500">{flaggedReview.length}</span>
            </div>
          </div>
        </aside>
      </main>

      {showSubmitModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="app-surface rounded-3xl max-w-md w-full p-6 space-y-4 animate-view">
            <h3 className="font-bold text-lg">Submit Assessment?</h3>
            <p className="text-xs sm:text-sm text-zinc-500 leading-relaxed">
              You have answered <strong>{answeredCount}</strong> of <strong>{totalQuestions}</strong>{' '}
              questions with <strong className="font-mono text-orange-600">{formatTime(timeLeft)}</strong>{' '}
              left on the clock.
            </p>
            {answeredCount < totalQuestions && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center gap-2 text-xs text-amber-600">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{totalQuestions - answeredCount} question(s) are still unanswered.</span>
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold"
              >
                Return to Exam
              </button>
              <button
                onClick={handleFinalSubmit}
                className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-semibold"
              >
                Submit & Grade
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="app-surface rounded-3xl max-w-md w-full p-6 space-y-4 animate-view">
            <h3 className="font-bold text-base">Flag Question #{currentIndex + 1}</h3>
            {reportSent ? (
              <p className="py-6 text-center text-sm font-semibold text-teal-500">
                Logged to Coordinator Queue ✓
              </p>
            ) : (
              <form onSubmit={handleSendReport} className="space-y-3.5 text-xs">
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                >
                  <option>Typo in question or options</option>
                  <option>Wrong answer marked as correct</option>
                  <option>Incomplete clinical vignette</option>
                </select>
                <textarea
                  rows={2}
                  placeholder="Optional note..."
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2 rounded-xl bg-orange-600 text-white font-semibold"
                  >
                    Send Flag
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}