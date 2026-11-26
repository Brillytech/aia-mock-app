import React, {
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useMemo,
  useRef
} from 'react';
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
  ShieldCheck,
  LayoutGrid,
  Info,
  Lock
} from 'lucide-react';

const STORAGE_KEY = 'aia_active_exam_state';

// Only returns saved progress if it belongs to THIS exam session
const readSaved = (sessionId) => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && parsed.sessionId === sessionId ? parsed : null;
  } catch {
    return null;
  }
};

const formatDuration = (secs) => {
  const total = Math.round(secs || 0);
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m === 0) return `${s} sec${s === 1 ? '' : 's'}`;
  if (s === 0) return `${m} min${m === 1 ? '' : 's'}`;
  return `${m} min ${s} sec`;
};

const MODE_LABELS = {
  PRACTICE: 'Speed Drill',
  OFFICIAL: 'Official Mock',
  BUNDLED: 'Combo Mock'
};

// Question + options always try to fit on one screen. If they do not fit,
// the text steps down one size at a time (level 0 = biggest, last = smallest).
const FIT = [
  { q: 'text-base sm:text-xl', o: 'text-sm sm:text-base', pad: 'p-3', gap: 'gap-2.5', top: 'gap-3' },
  { q: 'text-base sm:text-lg', o: 'text-sm sm:text-[15px]', pad: 'p-2.5', gap: 'gap-2', top: 'gap-2.5' },
  { q: 'text-sm sm:text-base', o: 'text-sm', pad: 'p-2', gap: 'gap-1.5', top: 'gap-2' },
  { q: 'text-sm', o: 'text-xs sm:text-sm', pad: 'px-2 py-1.5', gap: 'gap-1.5', top: 'gap-1.5' },
  { q: 'text-xs sm:text-sm', o: 'text-xs', pad: 'px-2 py-1', gap: 'gap-1', top: 'gap-1' }
];

function Rule({ icon: Icon, color, title, children }) {
  return (
    <div className="flex gap-3">
      <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${color}`} />
      <p className="leading-relaxed">
        <strong className="text-white">{title}</strong> {children}
      </p>
    </div>
  );
}

function CalcBtn({ onClick, className = '', children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`py-2.5 rounded-xl font-semibold text-sm ${className}`}
    >
      {children}
    </button>
  );
}

const noop = () => {};

export default function ExamRoom({
  sessionConfig = {},
  questions = [],
  bookmarks = [],
  onToggleBookmark = noop,
  onReportQuestion = noop,
  onCompleteExam = noop,
  onCancelExam = noop,
  onProgress = null,
  onLeaveExam = null,
  onLock = null
}) {
  const isSpeedDrill = sessionConfig.mode === 'PRACTICE';
  const isBundledMarathon = sessionConfig.mode === 'BUNDLED';
  const maxAllowedLeaves = Number(sessionConfig.maxTabSwitches || 3);
  const hasServerSession = Boolean(sessionConfig.serverSession && !isSpeedDrill);
  const resumeData = sessionConfig.resume || null;

  const [saved] = useState(() => (resumeData ? null : readSaved(sessionConfig.sessionId)));
  const [showInstructions, setShowInstructions] = useState(!resumeData && !saved);
  const [prepCountdown, setPrepCountdown] = useState(resumeData || saved ? 0 : 3);

  const [currentIndex, setCurrentIndex] = useState(() => {
    const idx = resumeData ? resumeData.currentIndex || 0 : saved?.currentIndex || 0;
    return Math.min(idx, Math.max(0, (questions?.length || 1) - 1));
  });
  const [answers, setAnswers] = useState(
    () => (resumeData ? resumeData.answers || {} : saved?.answers || {})
  );
  const [flaggedReview, setFlaggedReview] = useState(
    () => (resumeData ? resumeData.flagged || [] : saved?.flaggedReview || [])
  );

  // Timer runs on the real clock: refresh / close / logout never resets or pauses it
  const endsAtRef = useRef(
    resumeData?.endsAtClient || saved?.endsAt || null
  );
  const [timeLeft, setTimeLeft] = useState(() => {
    if (resumeData?.endsAtClient) {
      return Math.max(0, Math.ceil((resumeData.endsAtClient - Date.now()) / 1000));
    }
    if (saved) {
      if (saved.endsAt) return Math.max(0, Math.ceil((saved.endsAt - Date.now()) / 1000));
      if (saved.timeLeft > 0) return saved.timeLeft;
    }
    return sessionConfig.durationSeconds;
  });

  // Anti-cheat
  const initialWarnings = resumeData
    ? Number(resumeData.cheatWarnings || 0)
    : Number(saved?.cheatWarnings || 0);
  const leaveCountRef = useRef(initialWarnings);
  const [cheatWarnings, setCheatWarnings] = useState(initialWarnings);
  const [leaveNotice, setLeaveNotice] = useState(null);
  const [windowBlurred, setWindowBlurred] = useState(false);
  const [docHidden, setDocHidden] = useState(false);
  const [flashShield, setFlashShield] = useState(false);
  const flashTimerRef = useRef(null);

  // Server sync & lock states
  const [reconnecting, setReconnecting] = useState(false);
  const [closedByServer, setClosedByServer] = useState(null); // 'LOCKED' | 'SUBMITTED' | 'CANCELLED'
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [lockingNow, setLockingNow] = useState(false);
  const lastSentSnapshotRef = useRef('');

  const [showMobileMap, setShowMobileMap] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const [instantFeedbackEnabled, setInstantFeedbackEnabled] = useState(true);

  // Calculator
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

  const lastIndexBySubject = useRef({});

  // Auto-fit (no scrolling for question + options)
  const fitRef = useRef(null);
  const [fitLevel, setFitLevel] = useState(0);
  const [vpTick, setVpTick] = useState(0);

  const safeQuestions = questions || [];
  const totalQuestions = safeQuestions.length;
  const currentQ = safeQuestions[currentIndex] || safeQuestions[0];

  const distinctSubjects = useMemo(
    () => Array.from(new Set(safeQuestions.map((q) => q.courseCode))),
    [safeQuestions]
  );
  const isCombo = isBundledMarathon && distinctSubjects.length > 1;
  const answeredCount = safeQuestions.filter((q) => answers[q.id] !== undefined).length;

  const running =
    !showInstructions &&
    prepCountdown <= 0 &&
    !isSubmitting &&
    !closedByServer &&
    !lockingNow;
  const shieldVisible = running && (windowBlurred || docHidden || flashShield);

  // Keep latest snapshot in a ref so timers and event listeners never read stale state
  const snapshotRef = useRef({
    answers,
    flagged: flaggedReview,
    currentIndex,
    cheatWarnings
  });
  snapshotRef.current = {
    answers,
    flagged: flaggedReview,
    currentIndex,
    cheatWarnings
  };

  // Watermark (candidate name / email, faint diagonal pattern)
  const watermarkStyle = useMemo(() => {
    const label =
      [sessionConfig.candidateName, sessionConfig.candidateEmail || sessionConfig.email]
        .filter(Boolean)
        .join(' · ')
        .slice(0, 48) || 'AIA ACADEMY';
    const esc = label.replace(/&/g, '&').replace(/</g, '<').replace(/>/g, '>');
    const svg =
      `<svg xmlns='http://www.w3.org/2000/svg' width='420' height='260'>` +
      `<text x='210' y='130' text-anchor='middle' transform='rotate(-25 210 130)' ` +
      `font-family='Arial, sans-serif' font-size='13' font-weight='600' ` +
      `fill='rgba(120,120,120,0.17)'>${esc}</text></svg>`;
    return { backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")` };
  }, [sessionConfig.candidateName, sessionConfig.candidateEmail, sessionConfig.email]);

  // ---------- Server Progress Sync ----------
  const pushProgress = useCallback(
    async (force = false) => {
      if (!hasServerSession || !onProgress || submittedRef.current || closedByServer) return;
      const snap = snapshotRef.current;
      const serialized = JSON.stringify(snap);
      if (!force && serialized === lastSentSnapshotRef.current) return;

      try {
        const res = await onProgress(snap);
        if (!res) return;
        if (res.networkError) {
          setReconnecting(true);
          return;
        }
        setReconnecting(false);

        if (res.ok) {
          lastSentSnapshotRef.current = serialized;
          if (res.ends_at && res.server_now) {
            const serverMsLeft =
              new Date(res.ends_at).getTime() - new Date(res.server_now).getTime();
            endsAtRef.current = Date.now() + serverMsLeft;
          }
        } else if (['LOCKED', 'SUBMITTED', 'CANCELLED'].includes(res.status)) {
          localStorage.removeItem(STORAGE_KEY);
          setClosedByServer(res.status);
        }
      } catch {
        setReconnecting(true);
      }
    },
    [hasServerSession, onProgress, closedByServer]
  );

  const pushProgressRef = useRef(pushProgress);
  pushProgressRef.current = pushProgress;

  // Debounced save (~3 seconds) whenever answers, flags, index, or leave count change
  useEffect(() => {
    if (!running || !hasServerSession) return;
    const timer = setTimeout(() => {
      pushProgressRef.current(false);
    }, 3000);
    return () => clearTimeout(timer);
  }, [running, hasServerSession, answers, flaggedReview, currentIndex, cheatWarnings]);

  // Heartbeat every 20 seconds (catches admin lock/close or another device taking over)
  useEffect(() => {
    if (!running || !hasServerSession) return;
    const id = setInterval(() => {
      pushProgressRef.current(true);
    }, 20000);
    return () => clearInterval(id);
  }, [running, hasServerSession]);

  // ---------- Submit ----------
  const handleFinalSubmit = useCallback(
    (reason = 'MANUAL') => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      setIsSubmitting(true);
      setShowSubmitModal(false);

      const submitReason = typeof reason === 'string' ? reason : 'MANUAL';
      const remaining = endsAtRef.current
        ? Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000))
        : timeLeft;
      const timeSpent = Math.min(
        sessionConfig.durationSeconds,
        Math.max(1, sessionConfig.durationSeconds - remaining)
      );

      let correctCount = 0;
      const missedQuestions = [];
      safeQuestions.forEach((q) => {
        if (answers[q.id] === q.correctIndex) correctCount += 1;
        else missedQuestions.push(q);
      });

      const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
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
        questions: safeQuestions,
        missedQuestions,
        submitReason,
        completedAt: new Date().toISOString()
      });
    },
    [sessionConfig, timeLeft, safeQuestions, answers, totalQuestions, onCompleteExam]
  );

  const submitRef = useRef(handleFinalSubmit);
  submitRef.current = handleFinalSubmit;

  const lockRef = useRef(onLock);
  lockRef.current = onLock;

  // ---------- Prep countdown ----------
  useEffect(() => {
    if (showInstructions || prepCountdown <= 0) return;
    const timer = setTimeout(() => setPrepCountdown((p) => p - 1), 850);
    return () => clearTimeout(timer);
  }, [prepCountdown, showInstructions]);

  // ---------- Real-clock timer ----------
  useEffect(() => {
    if (!running) return;
    if (!endsAtRef.current) endsAtRef.current = Date.now() + timeLeft * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((endsAtRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  useEffect(() => {
    if (running && timeLeft <= 0) submitRef.current('TIME_UP');
  }, [running, timeLeft]);

  // ---------- Save local progress ----------
  useEffect(() => {
    if (!running || submittedRef.current) return;
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        sessionId: sessionConfig.sessionId,
        currentIndex,
        answers,
        flaggedReview,
        timeLeft,
        endsAt: endsAtRef.current,
        cheatWarnings,
        updatedAt: Date.now()
      })
    );
  }, [running, currentIndex, answers, flaggedReview, timeLeft, cheatWarnings, sessionConfig.sessionId]);

  useEffect(() => {
    if (currentQ) lastIndexBySubject.current[currentQ.courseCode] = currentIndex;
  }, [currentIndex, currentQ]);

  // ---------- Auto-fit: step the text size down until question + options fit ----------
  useEffect(() => {
    const onResize = () => setVpTick((v) => v + 1);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useLayoutEffect(() => {
    setFitLevel(0);
  }, [currentIndex, vpTick, showCalculator]);

  useLayoutEffect(() => {
    const el = fitRef.current;
    if (el && fitLevel < FIT.length - 1 && el.scrollHeight > el.clientHeight + 1) {
      setFitLevel((l) => Math.min(FIT.length - 1, l + 1));
    }
  });

  // ---------- Print CSS body class ----------
  useEffect(() => {
    if (!running) return;
    document.body.classList.add('exam-active');
    return () => document.body.classList.remove('exam-active');
  }, [running]);

  const triggerFlash = useCallback((ms = 1500) => {
    setFlashShield(true);
    clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashShield(false), ms);
  }, []);
  useEffect(() => () => clearTimeout(flashTimerRef.current), []);

  const clearClipboard = () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(' ').catch(() => {});
      }
    } catch {
      /* ignore */
    }
  };

  // Black shield when the window loses focus + save progress when hidden
  useEffect(() => {
    if (!running) return;
    const onBlur = () => setWindowBlurred(true);
    const onFocus = () => setWindowBlurred(false);
    const onVisibility = () => {
      setDocHidden(document.hidden);
      if (document.hidden && hasServerSession) {
        pushProgressRef.current(true);
      }
    };
    const onBeforePrint = () => triggerFlash(2500);
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('beforeprint', onBeforePrint);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('beforeprint', onBeforePrint);
    };
  }, [running, hasServerSession, triggerFlash]);

  // Block screenshot / print / save / DevTools shortcuts
  useEffect(() => {
    if (!running) return;
    const isBlockedCombo = (e) => {
      const k = (e.key || '').toLowerCase();
      const ctrl = e.ctrlKey || e.metaKey;
      if (e.key === 'PrintScreen' || e.key === 'F12') return true;
      if (ctrl && (k === 'p' || k === 's' || k === 'u')) return true;
      if (ctrl && e.shiftKey && ['i', 'j', 'c', 's'].includes(k)) return true;
      if (e.metaKey && e.shiftKey && ['Digit3', 'Digit4', 'Digit5'].includes(e.code)) return true;
      return false;
    };
    const onKeyDown = (e) => {
      if (isBlockedCombo(e)) {
        e.preventDefault();
        e.stopPropagation();
        clearClipboard();
        triggerFlash(1500);
      }
    };
    const onKeyUp = (e) => {
      if (e.key === 'PrintScreen') {
        clearClipboard();
        triggerFlash(2000);
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    };
  }, [running, triggerFlash]);

  // Screen-leave counter + refresh warning (Official & Combo)
  useEffect(() => {
    if (!running || isSpeedDrill) return;
    const onVis = () => {
      if (!document.hidden) return;
      leaveCountRef.current += 1;
      const next = leaveCountRef.current;
      setCheatWarnings(next);
      if (next >= maxAllowedLeaves) {
        if (sessionConfig.leaveAction === 'LOCK' && hasServerSession && lockRef.current) {
          setLockingNow(true);
          lockRef.current('TOO_MANY_LEAVES', {
            ...snapshotRef.current,
            cheatWarnings: next
          });
        } else {
          submitRef.current('TOO_MANY_LEAVES');
        }
      } else {
        setLeaveNotice(next);
      }
    };
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [running, isSpeedDrill, maxAllowedLeaves, sessionConfig.leaveAction, hasServerSession]);

  // ---------- Answering ----------
  const handleSelectOption = useCallback(
    (optionIndex) => {
      if (!currentQ || optionIndex >= currentQ.options.length) return;
      setAnswers((prev) => {
        // Speed Drill: an answer is locked once picked (keeps the leaderboard fair)
        if (isSpeedDrill && prev[currentQ.id] !== undefined) return prev;
        return { ...prev, [currentQ.id]: optionIndex };
      });
    },
    [currentQ, isSpeedDrill]
  );

  // ---------- Keyboard shortcuts ----------
  useEffect(() => {
    if (!running) return;
    const handleKeyDown = (e) => {
      if (
        shieldVisible ||
        showReportModal ||
        showSubmitModal ||
        showMobileMap ||
        showLeaveModal ||
        leaveNotice
      ) {
        return;
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const key = e.key.toUpperCase();
      const letterIdx = ['A', 'B', 'C', 'D', 'E'].indexOf(key);
      if (letterIdx !== -1) {
        handleSelectOption(letterIdx);
        return;
      }
      if (key === 'N' || e.key === 'ArrowRight') {
        setCurrentIndex((p) => Math.min(totalQuestions - 1, p + 1));
      }
      if (key === 'P' || e.key === 'ArrowLeft') {
        setCurrentIndex((p) => Math.max(0, p - 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    running,
    shieldVisible,
    showReportModal,
    showSubmitModal,
    showMobileMap,
    showLeaveModal,
    leaveNotice,
    totalQuestions,
    handleSelectOption
  ]);

  // ---------- Helpers ----------
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remSecs = secs % 60;
    return `${String(mins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`;
  };

  const toggleReviewFlag = (qId) =>
    setFlaggedReview((prev) =>
      prev.includes(qId) ? prev.filter((id) => id !== qId) : [...prev, qId]
    );

  const exitExam = () => {
    localStorage.removeItem(STORAGE_KEY);
    onCancelExam();
  };

  const handleHeaderCloseClick = () => {
    if (isSpeedDrill || !hasServerSession || !onLeaveExam) {
      exitExam();
      return;
    }
    setShowLeaveModal(true);
  };

  const handleConfirmLeave = async () => {
    setShowLeaveModal(false);
    setLockingNow(true);
    await onLeaveExam(snapshotRef.current);
  };

  const jumpToSubject = (code) => {
    const remembered = lastIndexBySubject.current[code];
    const target =
      remembered !== undefined ? remembered : safeQuestions.findIndex((q) => q.courseCode === code);
    if (target >= 0) setCurrentIndex(target);
  };

  // ---------- Calculator ----------
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
      const cur = calcPrev || 0;
      let nv = cur;
      if (calcOp === '+') nv = cur + inputValue;
      if (calcOp === '-') nv = cur - inputValue;
      if (calcOp === '×') nv = cur * inputValue;
      if (calcOp === '÷') nv = inputValue !== 0 ? cur / inputValue : 0;
      const formatted = Number(nv.toFixed(6));
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

  // =====================================================================
  // SCREENS
  // =====================================================================

  if (closedByServer) {
    const isLockedStatus = closedByServer === 'LOCKED';
    return (
      <div className="fixed inset-0 z-[110] bg-[#09090b] text-white flex flex-col items-center justify-center p-6 text-center">
        <div className="max-w-md w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-8 space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-600/15 text-orange-500 flex items-center justify-center mx-auto">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-xl font-extrabold">
            {isLockedStatus ? 'Your exam is locked' : 'The organiser has closed your exam'}
          </h2>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {isLockedStatus
              ? 'Your timer is paused and your answers are saved. Go back to the dashboard to ask the organiser to re-admit you.'
              : closedByServer === 'SUBMITTED'
              ? 'Your script has been submitted by the organiser. Go back to the dashboard to check My Results.'
              : 'This exam attempt was cancelled by the organiser.'}
          </p>
          <button
            type="button"
            onClick={exitExam}
            className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (!currentQ) {
    return (
      <div className="fixed inset-0 z-50 bg-[#09090b] text-white flex flex-col items-center justify-center p-6 text-center">
        <AlertTriangle className="w-10 h-10 text-amber-500 mb-3" />
        <h2 className="text-lg font-bold mb-1">No questions found for this exam</h2>
        <p className="text-sm text-zinc-400 mb-6">Please go back and try again, or contact the organiser.</p>
        <button
          onClick={exitExam}
          className="px-6 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  // ---------- 1. INSTRUCTIONS (scrolls properly on every screen) ----------
  if (showInstructions) {
    const passMarkText =
      sessionConfig.passMark !== undefined && sessionConfig.passMark !== null && sessionConfig.passMark !== ''
        ? `${sessionConfig.passMark}%`
        : '—';

    return (
      <div className="fixed inset-0 z-50 bg-[#09090b] text-white overflow-y-auto">
        <div className="min-h-full flex items-center justify-center p-4 sm:p-6">
          <div className="max-w-2xl w-full bg-zinc-900 border border-zinc-800 rounded-3xl p-6 sm:p-10 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
              <ShieldCheck className="w-48 h-48" />
            </div>

            <div className="relative z-10 space-y-7">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/10 text-orange-500 font-mono text-[10px] font-bold uppercase tracking-widest mb-3">
                  <Info className="w-3.5 h-3.5" /> Exam Instructions
                </span>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{sessionConfig.title}</h1>
                <p className="text-sm text-zinc-400 mt-2">Please read these rules carefully before you begin.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-5 rounded-2xl bg-black border border-zinc-800">
                <div>
                  <span className="text-[10px] uppercase font-mono text-zinc-500 block">Time Limit</span>
                  <span className="text-base font-bold text-teal-400">
                    {formatDuration(sessionConfig.durationSeconds)}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-zinc-500 block">Questions</span>
                  <span className="text-base font-bold text-white">{totalQuestions}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-zinc-500 block">Pass Mark</span>
                  <span className="text-base font-bold text-orange-400">{passMarkText}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-mono text-zinc-500 block">Mode</span>
                  <span className="text-base font-bold text-white block truncate">
                    {MODE_LABELS[sessionConfig.mode] || sessionConfig.mode}
                  </span>
                  <span className="text-[10px] font-mono text-zinc-500">{sessionConfig.mode}</span>
                </div>
              </div>

              {isCombo && (
                <div className="flex flex-wrap gap-2">
                  {distinctSubjects.map((code) => (
                    <span
                      key={code}
                      className="px-3 py-1 rounded-lg bg-zinc-800 text-xs font-mono font-bold text-zinc-200"
                    >
                      {code} · {safeQuestions.filter((q) => q.courseCode === code).length} Qs
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-4 text-sm text-zinc-300">
                <h3 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">Exam Rules</h3>

                <Rule icon={Clock} color="text-amber-500" title="Timer never stops.">
                  The clock runs on real time. Refreshing does <strong className="text-white">not</strong> pause
                  or reset it. Your answers are saved automatically. When time reaches zero, your paper is
                  submitted automatically.
                </Rule>

                {isSpeedDrill ? (
                  <Rule icon={ShieldCheck} color="text-red-500" title="Leaving the screen:">
                    You will not be penalised for leaving this screen, but the timer keeps running and the exam
                    screen goes black while you are away.
                  </Rule>
                ) : (
                  <Rule icon={ShieldCheck} color="text-red-500" title="Leaving the screen:">
                    Switching tabs, minimising the browser or answering a call counts as leaving. You may leave
                    a maximum of <strong className="text-white">{maxAllowedLeaves} times</strong>.{' '}
                    {sessionConfig.leaveAction === 'LOCK'
                      ? `Your exam will be locked when you reach ${maxAllowedLeaves} until the organiser lets you back in.`
                      : `Your exam is auto-submitted when you reach ${maxAllowedLeaves}.`}
                  </Rule>
                )}

                <Rule icon={ShieldCheck} color="text-red-500" title="Screen protection:">
                  Screenshots, copying, right-click and printing are blocked. The screen turns black when you
                  leave this window, and your name is faintly printed across the paper.
                </Rule>
              </div>

              <div className="space-y-4 text-sm text-zinc-300">
                <h3 className="text-[11px] font-mono uppercase tracking-widest text-zinc-500">
                  {MODE_LABELS[sessionConfig.mode] || 'Mode'} Rules
                </h3>

                {isSpeedDrill && (
                  <>
                    <Rule icon={Zap} color="text-teal-500" title="Instant feedback:">
                      You see the correct answer and explanation straight after you answer. You can switch this
                      on or off at the top of the screen.
                    </Rule>
                    <Rule icon={Zap} color="text-teal-500" title="Answers are locked:">
                      Once you pick an option, you cannot change it.
                    </Rule>
                    <Rule icon={Zap} color="text-teal-500" title="Leaderboard:">
                      You are ranked by highest score first, then by fastest finish. Only your first attempt on
                      this sitting counts.
                    </Rule>
                  </>
                )}

                {isBundledMarathon && (
                  <>
                    <Rule icon={Layers} color="text-orange-500" title="Subject tabs:">
                      {isCombo
                        ? `This paper has ${distinctSubjects.length} subjects, each with its own set of questions. Use the tabs at the top to switch between them any time.`
                        : 'Use the tabs at the top to switch between subjects any time.'}
                    </Rule>
                    <Rule icon={Layers} color="text-orange-500" title="One timer:">
                      All subjects share the same clock. The question map shows the subject you are on.
                    </Rule>
                  </>
                )}

                {sessionConfig.mode === 'OFFICIAL' && (
                  <>
                    <Rule icon={ShieldCheck} color="text-orange-500" title="Strict lock:">
                      There is no instant feedback. You can move freely between questions and change answers
                      until you submit.
                    </Rule>
                    <Rule icon={ShieldCheck} color="text-orange-500" title="Results:">
                      Your score may be held until the organiser releases results.
                    </Rule>
                  </>
                )}
              </div>

              <div className="flex gap-3 text-sm text-zinc-300">
                <LayoutGrid className="w-5 h-5 text-zinc-500 flex-shrink-0 mt-0.5" />
                <p className="leading-relaxed">
                  <strong className="text-white">Keyboard shortcuts:</strong> Press{' '}
                  <strong className="text-white">A–E</strong> to select an option. Press{' '}
                  <strong className="text-white">N</strong> or <strong className="text-white">→</strong> for
                  next, and <strong className="text-white">P</strong> or <strong className="text-white">←</strong>{' '}
                  for previous.
                </p>
              </div>

              <div className="pt-5 flex flex-col-reverse sm:flex-row gap-3 items-center justify-between border-t border-zinc-800">
                <button
                  onClick={handleHeaderCloseClick}
                  className="w-full sm:w-auto px-5 py-3 rounded-xl text-zinc-400 hover:text-white font-semibold text-sm transition-colors"
                >
                  Cancel & Go Back
                </button>
                <button
                  onClick={() => setShowInstructions(false)}
                  className="w-full sm:w-auto px-8 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm transition-colors shadow-lg shadow-orange-600/20"
                >
                  I Understand, Start Exam
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- 2. 3-2-1 COUNTDOWN ----------
  if (prepCountdown > 0) {
    return (
      <div className="fixed inset-0 z-50 bg-[#09090b] text-white flex flex-col items-center justify-center p-6 select-none">
        <div className="pointer-events-none absolute w-96 h-96 rounded-full bg-orange-600/20 blur-3xl" />
        <span className="text-xs font-mono uppercase tracking-[0.25em] text-teal-400 mb-3 text-center">
          {sessionConfig.mode === 'PRACTICE'
            ? 'Speed Drill • Instant Feedback Active'
            : sessionConfig.mode === 'BUNDLED'
            ? 'Combo Mock • Subject Tabs Active'
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
        <p className="text-xs text-zinc-500 mt-8 font-mono text-center">
          Keyboard shortcuts active: [A]–[E] to answer • [N] / [P] to navigate
        </p>
      </div>
    );
  }

  // ---------- 3. LIVE EXAM ----------
  const fit = FIT[fitLevel];
  const isLowTime = timeLeft <= (isSpeedDrill && sessionConfig.durationSeconds <= 120 ? 10 : 60);
  const isBookmarked = bookmarks.some((b) => b.id === currentQ.id);
  const isFlaggedForReview = flaggedReview.includes(currentQ.id);
  const selectedAnswerForCurrent = answers[currentQ.id];
  const showSpeedDrillCorrection =
    isSpeedDrill && instantFeedbackEnabled && selectedAnswerForCurrent !== undefined;

  const scopedEntries = safeQuestions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !isCombo || q.courseCode === currentQ.courseCode);
  const scopedTotal = scopedEntries.length;
  const scopedAnswered = scopedEntries.filter(({ q }) => answers[q.id] !== undefined).length;
  const scopedFlagged = scopedEntries.filter(({ q }) => flaggedReview.includes(q.id)).length;
  const localNumber = scopedEntries.findIndex(({ idx }) => idx === currentIndex) + 1;

  const mapBtn = (isCurrent, isReview, isAnswered, size) =>
    `${size} w-full min-w-0 rounded-xl font-mono text-xs font-bold border transition-colors ${
      isCurrent
        ? 'ring-2 ring-inset ring-orange-600 bg-orange-50 border-orange-300 text-orange-600 dark:bg-orange-500/15 dark:border-orange-500/40 dark:text-orange-400'
        : isReview
        ? 'bg-amber-500 border-amber-600 text-black'
        : isAnswered
        ? 'bg-zinc-800 border-zinc-900 text-white dark:bg-teal-600 dark:border-teal-500'
        : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'
    }`;

  const Legend = () => (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-zinc-500 font-mono">
      <span className="flex items-center gap-1">
        <i className="w-2.5 h-2.5 rounded bg-zinc-800 dark:bg-teal-600 inline-block" /> Answered
      </span>
      <span className="flex items-center gap-1">
        <i className="w-2.5 h-2.5 rounded bg-amber-500 inline-block" /> Review
      </span>
      <span className="flex items-center gap-1">
        <i className="w-2.5 h-2.5 rounded border-2 border-orange-600 inline-block" /> Current
      </span>
    </div>
  );

  return (
    <div
      className="exam-protected select-none h-[100dvh] overflow-hidden flex flex-col bg-[#fbfaf8] dark:bg-zinc-950 animate-view relative font-sans"
      onContextMenu={(e) => e.preventDefault()}
      onCopy={(e) => e.preventDefault()}
      onCut={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      <div
        className="pointer-events-none fixed inset-0 z-[45]"
        style={{ ...watermarkStyle, backgroundRepeat: 'repeat' }}
        aria-hidden="true"
      />

      {shieldVisible && (
        <div className="fixed inset-0 z-[100] bg-black text-white flex flex-col items-center justify-center p-6 text-center">
          <ShieldCheck className="w-12 h-12 text-orange-500 mb-4" />
          <h2 className="text-lg font-bold mb-1">Exam hidden</h2>
          <p className="text-sm text-zinc-400 max-w-xs">
            The exam is hidden while you are away from this window. The timer is still running. Return to this
            window to continue.
          </p>
        </div>
      )}

      {leaveNotice && !shieldVisible && (
        <div className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-sm w-full p-6 space-y-4 border border-zinc-200 dark:border-zinc-800 text-center">
            <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
            <h3 className="font-bold text-lg dark:text-zinc-100">
              Warning ({leaveNotice}/{maxAllowedLeaves})
            </h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              You left the exam screen. If you leave {maxAllowedLeaves - leaveNotice} more time
              {maxAllowedLeaves - leaveNotice === 1 ? '' : 's'},{' '}
              {sessionConfig.leaveAction === 'LOCK'
                ? 'your exam will be locked until the organiser lets you back in.'
                : 'your exam will be submitted automatically.'}
            </p>
            <button
              onClick={() => setLeaveNotice(null)}
              className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold"
            >
              Return to Exam
            </button>
          </div>
        </div>
      )}

      {/* Top Exam Bar */}
      <header className="flex-shrink-0 z-40 bg-zinc-950 text-white border-b border-zinc-800">
        <div className="max-w-6xl mx-auto px-3 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              onClick={handleHeaderCloseClick}
              className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-900 transition-colors"
              title="Leave Exam"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
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
                    <span>Strict Lock {cheatWarnings > 0 ? `(${cheatWarnings}/${maxAllowedLeaves})` : ''}</span>
                  </span>
                )}
                {reconnecting && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Reconnecting...
                  </span>
                )}
                {sessionConfig.offlineWarning && (
                  <span className="hidden md:inline-flex items-center gap-1 text-[10px] font-mono text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded">
                    Offline mode: organiser cannot re-admit you
                  </span>
                )}
              </div>
              <h1 className="font-semibold text-xs sm:text-sm truncate text-zinc-100 mt-0.5">
                {sessionConfig.title}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <button
              type="button"
              onClick={() => setShowCalculator(!showCalculator)}
              className={`px-2.5 sm:px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
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
              className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl font-mono text-sm font-bold border ${
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
              className="px-3 sm:px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs sm:text-sm transition-colors"
            >
              Submit ({answeredCount}/{totalQuestions})
            </button>
          </div>
        </div>

        {isCombo && (
          <div className="bg-zinc-900/90 border-t border-zinc-800 px-3 sm:px-6 py-2 flex items-center gap-2 overflow-x-auto">
            <span className="text-[10px] font-mono uppercase text-zinc-400 flex items-center gap-1 mr-1 flex-shrink-0">
              <Layers className="w-3 h-3 text-orange-500" />
              Subjects:
            </span>
            {distinctSubjects.map((code) => {
              const subjectQs = safeQuestions.filter((q) => q.courseCode === code);
              const subjectAnswered = subjectQs.filter((q) => answers[q.id] !== undefined).length;
              const isCurrentSubject = currentQ.courseCode === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => jumpToSubject(code)}
                  className={`px-3 py-1 rounded-lg text-xs font-mono font-bold transition-colors whitespace-nowrap flex-shrink-0 ${
                    isCurrentSubject ? 'bg-orange-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
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

      {/* Floating calculator */}
      {showCalculator && (
        <div className="fixed right-3 sm:right-8 top-20 z-50 w-72 max-w-[calc(100vw-1.5rem)] rounded-3xl bg-zinc-950 text-white border border-zinc-800 shadow-2xl p-4 space-y-3 animate-view select-none">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-teal-400" />
              <span className="text-xs font-mono uppercase tracking-wider font-semibold text-zinc-300">
                CBT Calculator
              </span>
            </div>
            <button onClick={() => setShowCalculator(false)} className="p-1 rounded-lg text-zinc-400 hover:text-white">
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
            <CalcBtn onClick={clearCalc} className="bg-red-500/20 text-red-400 hover:bg-red-500/30">AC</CalcBtn>
            <CalcBtn onClick={() => handleUnaryOp('sqrt')} className="bg-zinc-900 text-teal-300 hover:bg-zinc-800">√x</CalcBtn>
            <CalcBtn onClick={() => handleUnaryOp('sq')} className="bg-zinc-900 text-teal-300 hover:bg-zinc-800">x²</CalcBtn>
            <CalcBtn onClick={() => handleUnaryOp('pct')} className="bg-zinc-900 text-teal-300 hover:bg-zinc-800">%</CalcBtn>

            {[[7, 8, 9, '÷'], [4, 5, 6, '×'], [1, 2, 3, '-']].map((row) =>
              row.map((cell) =>
                typeof cell === 'number' ? (
                  <CalcBtn key={cell} onClick={() => inputDigit(cell)} className="bg-zinc-900 hover:bg-zinc-800">
                    {cell}
                  </CalcBtn>
                ) : (
                  <CalcBtn
                    key={cell}
                    onClick={() => performOperation(cell)}
                    className="bg-orange-600/20 text-orange-400 font-bold hover:bg-orange-600/30"
                  >
                    {cell === '-' ? '−' : cell}
                  </CalcBtn>
                )
              )
            )}

            <CalcBtn onClick={() => inputDigit(0)} className="bg-zinc-900 hover:bg-zinc-800">0</CalcBtn>
            <CalcBtn onClick={inputDecimal} className="bg-zinc-900 hover:bg-zinc-800 font-bold">.</CalcBtn>
            <CalcBtn onClick={() => performOperation(null)} className="bg-orange-600 text-white font-bold hover:bg-orange-500">=</CalcBtn>
            <CalcBtn onClick={() => performOperation('+')} className="bg-orange-600/20 text-orange-400 font-bold hover:bg-orange-600/30">+</CalcBtn>
          </div>
        </div>
      )}

      {/* Main: question + options always fit on one screen (no scrolling) */}
      <main className="flex-1 min-h-0 w-full max-w-6xl mx-auto px-3 sm:px-6 py-3 sm:py-5 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-8 grid-rows-[minmax(0,1fr)]">
        <section className="lg:col-span-8 min-h-0 flex flex-col">
          <div
            ref={fitRef}
            className={`flex-1 min-h-0 flex flex-col ${fit.top} ${
              fitLevel >= FIT.length - 1 ? 'overflow-y-auto' : 'overflow-hidden'
            }`}
          >
            {/* Top row */}
            <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2 flex-shrink-0">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                <span className="px-2.5 py-1 rounded-lg bg-orange-600 text-white font-mono text-xs font-bold flex-shrink-0">
                  Q{localNumber} / {scopedTotal}
                </span>
                <span className="font-mono text-xs font-semibold text-teal-600 dark:text-teal-400 truncate">
                  {currentQ.courseCode}
                </span>
              </div>
              <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                <button
                  onClick={() => toggleReviewFlag(currentQ.id)}
                  className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                    isFlaggedForReview
                      ? 'bg-amber-500 text-black'
                      : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800'
                  }`}
                >
                  {isFlaggedForReview ? 'Flagged' : 'Review Later'}
                </button>
                <button
                  onClick={() => onToggleBookmark(currentQ)}
                  className={`p-2 rounded-xl transition-colors ${
                    isBookmarked
                      ? 'bg-orange-600 text-white border border-orange-600'
                      : 'bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800'
                  }`}
                  title="Save Question"
                >
                  <Bookmark className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setShowReportModal(true)}
                  className="p-2 rounded-xl bg-white dark:bg-zinc-900 text-zinc-500 border border-zinc-200 dark:border-zinc-800 hover:text-red-500"
                  title="Report Question Error"
                >
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </div>

            {currentQ.passage && (
              <div className="p-3 rounded-2xl bg-teal-50 dark:bg-teal-500/10 border-l-4 border-teal-500 text-xs sm:text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed max-h-[22vh] overflow-y-auto flex-shrink-0">
                <span className="block font-mono text-[10px] font-bold text-teal-600 dark:text-teal-400 mb-1 uppercase tracking-wider">
                  Passage
                </span>
                {currentQ.passage}
              </div>
            )}

            <h2 className={`font-bold leading-snug dark:text-zinc-100 flex-shrink-0 ${fit.q}`}>
              {currentQ.question}
            </h2>

            <div className={`flex flex-col flex-shrink-0 ${fit.gap}`}>
              {currentQ.options.map((optionText, idx) => {
                const isSelected = selectedAnswerForCurrent === idx;
                const isCorrectOption = idx === currentQ.correctIndex;
                const optionLabel = ['A', 'B', 'C', 'D', 'E'][idx];
                const isLocked = isSpeedDrill && selectedAnswerForCurrent !== undefined;

                let rowClass =
                  'bg-white border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 hover:border-orange-400 text-zinc-800 dark:text-zinc-200';
                let badgeClass = 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400';

                if (showSpeedDrillCorrection) {
                  if (isCorrectOption) {
                    rowClass = 'bg-teal-50 border-teal-500 text-teal-900 dark:bg-teal-500/10 dark:text-teal-300';
                    badgeClass = 'bg-teal-600 text-white';
                  } else if (isSelected) {
                    rowClass = 'bg-red-50 border-red-500 text-red-900 dark:bg-red-500/10 dark:text-red-300';
                    badgeClass = 'bg-red-600 text-white';
                  }
                } else if (isSelected) {
                  rowClass =
                    'bg-orange-50 border-orange-500 text-orange-900 dark:bg-orange-500/10 dark:text-orange-400';
                  badgeClass = 'bg-orange-600 text-white';
                }

                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSelectOption(idx)}
                    className={`w-full text-left rounded-xl border-2 transition-colors flex items-start gap-3 flex-shrink-0 ${fit.pad} ${rowClass} ${
                      isLocked ? 'cursor-default' : ''
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-lg font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 ${badgeClass}`}
                    >
                      {optionLabel}
                    </span>
                    <span className={`leading-snug flex-1 min-w-0 pt-0.5 ${fit.o}`}>{optionText}</span>
                    {showSpeedDrillCorrection && isCorrectOption && (
                      <CheckCircle2 className="w-5 h-5 text-teal-600 flex-shrink-0" />
                    )}
                    {showSpeedDrillCorrection && isSelected && !isCorrectOption && (
                      <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>

            {showSpeedDrillCorrection && currentQ.explanation && (
              <div className="p-2.5 rounded-xl bg-teal-50 dark:bg-teal-500/10 border border-teal-200 dark:border-teal-500/30 text-xs max-h-20 overflow-y-auto flex-shrink-0">
                <strong className="text-teal-700 dark:text-teal-400 mr-1.5 uppercase tracking-wider text-[10px]">
                  Rationale:
                </strong>
                <span className="text-teal-900 dark:text-teal-200">{currentQ.explanation}</span>
              </div>
            )}
          </div>

          {/* Desktop navigation */}
          <div className="hidden lg:flex items-center justify-between pt-3 mt-2 border-t border-zinc-200 dark:border-zinc-800 flex-shrink-0">
            <button
              type="button"
              disabled={currentIndex === 0}
              onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
              className="px-5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm font-semibold disabled:opacity-40 flex items-center gap-1.5 dark:text-zinc-200"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous [P]</span>
            </button>

            {currentIndex < totalQuestions - 1 ? (
              <button
                type="button"
                onClick={() => setCurrentIndex((p) => Math.min(totalQuestions - 1, p + 1))}
                className="px-6 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-bold flex items-center gap-1.5"
              >
                <span>Next Question [N]</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowSubmitModal(true)}
                className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Submit Exam</span>
              </button>
            )}
          </div>
        </section>

        {/* Desktop question palette */}
        <aside className="hidden lg:flex lg:col-span-4 min-h-0 min-w-0 flex-col border-l border-zinc-200 dark:border-zinc-800 pl-6">
          <div className="flex items-center justify-between flex-shrink-0 mb-3">
            <h3 className="font-bold text-sm uppercase tracking-wider text-zinc-500 truncate">
              {isCombo ? `${currentQ.courseCode} Map` : 'Question Map'}
            </h3>
            <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400 flex-shrink-0">
              {scopedAnswered}/{scopedTotal}
            </span>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5 -m-1.5">
            <div className="grid grid-cols-5 gap-2 content-start">
              {scopedEntries.map(({ q, idx }, pos) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  className={mapBtn(
                    idx === currentIndex,
                    flaggedReview.includes(q.id),
                    answers[q.id] !== undefined,
                    'h-10'
                  )}
                >
                  {pos + 1}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2 text-xs text-zinc-500 flex-shrink-0">
            <Legend />
            <div className="flex items-center justify-between">
              <span>Answered</span>
              <span className="font-mono font-bold text-orange-600">{scopedAnswered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Unanswered</span>
              <span className="font-mono font-bold">{scopedTotal - scopedAnswered}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>Marked for Review</span>
              <span className="font-mono font-bold text-amber-500">{scopedFlagged}</span>
            </div>
          </div>
        </aside>
      </main>

      {/* Mobile bottom bar */}
      <footer className="lg:hidden flex-shrink-0 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 px-3 py-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((p) => Math.max(0, p - 1))}
          className="px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs font-semibold disabled:opacity-40 flex items-center gap-1 dark:text-zinc-200"
        >
          <ChevronLeft className="w-4 h-4" />
          <span>Prev</span>
        </button>

        <button
          type="button"
          onClick={() => setShowMobileMap(true)}
          className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 dark:bg-zinc-900 dark:border-zinc-800 font-mono text-xs font-bold flex items-center gap-2 dark:text-zinc-200"
        >
          <LayoutGrid className="w-4 h-4 text-orange-500" />
          <span>
            Map ({scopedAnswered}/{scopedTotal})
          </span>
        </button>

        {currentIndex < totalQuestions - 1 ? (
          <button
            type="button"
            onClick={() => setCurrentIndex((p) => Math.min(totalQuestions - 1, p + 1))}
            className="px-3.5 py-2.5 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold flex items-center gap-1"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowSubmitModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-1"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>Finish</span>
          </button>
        )}
      </footer>

      {/* Mobile question map drawer */}
      {showMobileMap && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex flex-col justify-end"
          onClick={() => setShowMobileMap(false)}
        >
          <div
            className="bg-white dark:bg-zinc-950 rounded-t-3xl p-5 pb-6 max-h-[75vh] flex flex-col gap-3 animate-view border-t border-zinc-200 dark:border-zinc-800"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto flex-shrink-0" />

            {isCombo && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 flex-shrink-0">
                {distinctSubjects.map((code) => {
                  const subjectQs = safeQuestions.filter((q) => q.courseCode === code);
                  const subjectAnswered = subjectQs.filter((q) => answers[q.id] !== undefined).length;
                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => jumpToSubject(code)}
                      className={`px-3 py-1 rounded-lg text-xs font-mono font-bold whitespace-nowrap flex-shrink-0 ${
                        currentQ.courseCode === code
                          ? 'bg-orange-600 text-white'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                      }`}
                    >
                      {code} ({subjectAnswered}/{subjectQs.length})
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-sm uppercase tracking-wider dark:text-zinc-100">
                  {isCombo ? `${currentQ.courseCode} Map` : 'Question Map'}
                </h3>
                <p className="text-xs text-zinc-500 font-mono">
                  {scopedAnswered} Answered • {scopedTotal - scopedAnswered} Remaining
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowMobileMap(false)}
                className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 dark:text-zinc-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden p-1.5 -m-1.5">
              <div className="grid grid-cols-5 sm:grid-cols-8 gap-2.5">
                {scopedEntries.map(({ q, idx }, pos) => (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setCurrentIndex(idx);
                      setShowMobileMap(false);
                    }}
                    className={mapBtn(
                      idx === currentIndex,
                      flaggedReview.includes(q.id),
                      answers[q.id] !== undefined,
                      'h-11'
                    )}
                  >
                    {pos + 1}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex-shrink-0">
              <Legend />
            </div>
          </div>
        </div>
      )}

      {/* Leave & Lock confirm modal */}
      {showLeaveModal && (
        <div className="fixed inset-0 z-[65] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 animate-view border border-zinc-200 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-orange-600/15 text-orange-600 flex items-center justify-center flex-shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-lg dark:text-zinc-100">Leave the exam?</h3>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              Your exam will be <strong>locked</strong> until the organiser lets you back in. Your answers are
              saved and your timer will pause while it is locked.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold dark:text-zinc-200"
              >
                Stay in Exam
              </button>
              <button
                type="button"
                disabled={lockingNow}
                onClick={handleConfirmLeave}
                className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold"
              >
                {lockingNow ? 'Locking...' : 'Leave & Lock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Submit modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 animate-view border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-xl dark:text-zinc-100">Submit Assessment?</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
              You have answered <strong>{answeredCount}</strong> of <strong>{totalQuestions}</strong> questions
              with <strong className="font-mono text-orange-600">{formatTime(timeLeft)}</strong> left on the
              clock.
            </p>

            {isCombo && (
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {distinctSubjects.map((code) => {
                  const subjectQs = safeQuestions.filter((q) => q.courseCode === code);
                  const subjectAnswered = subjectQs.filter((q) => answers[q.id] !== undefined).length;
                  return (
                    <div key={code} className="flex items-center justify-between px-3 py-2">
                      <span className="font-mono font-bold dark:text-zinc-200">{code}</span>
                      <span
                        className={`font-mono ${
                          subjectAnswered < subjectQs.length ? 'text-amber-500' : 'text-teal-500'
                        }`}
                      >
                        {subjectAnswered}/{subjectQs.length}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {answeredCount < totalQuestions && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 dark:bg-amber-500/10 dark:border-amber-500/20 flex items-center gap-2 text-xs text-amber-700 dark:text-amber-500">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{totalQuestions - answeredCount} question(s) are still unanswered.</span>
              </div>
            )}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-3 rounded-xl border border-zinc-200 dark:border-zinc-800 text-sm font-semibold dark:text-zinc-200"
              >
                Return to Exam
              </button>
              <button
                onClick={() => handleFinalSubmit('MANUAL')}
                className="flex-1 py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-sm font-bold shadow-lg shadow-orange-600/20"
              >
                Submit & Grade
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report modal */}
      {showReportModal && (
        <div className="fixed inset-0 z-[60] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl max-w-md w-full p-6 space-y-4 animate-view border border-zinc-200 dark:border-zinc-800">
            <h3 className="font-bold text-base dark:text-zinc-100">Flag Question #{localNumber}</h3>
            {reportSent ? (
              <p className="py-6 text-center text-sm font-semibold text-teal-600">Logged to Coordinator Queue ✓</p>
            ) : (
              <form onSubmit={handleSendReport} className="space-y-3.5 text-xs">
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:text-zinc-200"
                >
                  <option>Typo in question or options</option>
                  <option>Wrong answer marked as correct</option>
                  <option>Incomplete clinical vignette</option>
                </select>
                <textarea
                  rows={3}
                  placeholder="Optional note..."
                  value={reportNote}
                  onChange={(e) => setReportNote(e.target.value)}
                  className="w-full px-3.5 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 dark:text-zinc-200"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 font-semibold dark:text-zinc-200"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white font-semibold">
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