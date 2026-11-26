import React, { useState, useRef, useMemo, useEffect } from 'react';
import AiaLogo from './AiaLogo';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { NIGERIAN_COURSES_OF_STUDY } from '../lib/nigeriaAcademicData';
import {
  LayoutGrid,
  CalendarClock,
  BookOpen,
  Users,
  KeyRound,
  Trophy,
  Settings,
  History,
  UserCheck,
  LogOut,
  Plus,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  Search,
  Upload,
  FileSpreadsheet,
  Download,
  Megaphone,
  Lock,
  Unlock,
  Clock,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Database,
  Archive,
  RotateCcw,
  Edit3,
  Files,
  AlertCircle,
  Share2,
  Link2,
  Mail,
  Layers,
  Zap,
  X,
  Activity,
  RefreshCw
} from 'lucide-react';

const MAX_ANNOUNCEMENTS = 5;

const EMPTY_SITTING = {
  title: '',
  mode: 'OFFICIAL',
  allowedModes: ['OFFICIAL'],
  targetCourse: 'All Courses',
  priceNaira: 1000,
  retakePriceNaira: 0,
  requiresCode: true,
  durationMins: 20,
  questionCount: 25,
  passMark: 50,
  maxTabSwitches: 3,
  leaveAction: 'SUBMIT',
  isFeatured: true,
  shuffleQuestions: true,
  allowedCourses: [],
  comboSittingIds: [],
  status: 'OPEN',
  resultsReleased: true,
  releaseMode: 'INSTANT',
  releaseAt: '',
  description: ''
};

// Why a live exam was locked (shown as a coloured badge)
const LOCK_REASON_META = {
  LEFT_EXAM: { label: 'Left exam', cls: 'bg-amber-100 text-amber-800' },
  SIGNED_OUT: { label: 'Signed out', cls: 'bg-zinc-200 text-zinc-700' },
  TOO_MANY_LEAVES: { label: 'Too many screen leaves', cls: 'bg-red-100 text-red-700' },
  DEVICE_CHANGE: { label: 'Device change', cls: 'bg-purple-100 text-purple-700' },
  ADMIN: { label: 'Admin', cls: 'bg-teal-100 text-teal-800' }
};

function parseCsvLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

// Turns the text of a question .csv into question objects. Used by BOTH the Subjects & CSV tab
// and the Create / Edit Exam window, so the two always read the file the same way.
function parseQuestionsCsv(text, courses) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    return { parsed: [], errs: ['The selected .csv file is empty.'], unmatched: 0 };
  }

  const parsed = [];
  const errs = [];
  let unmatched = 0;
  const headerLower = lines[0].toLowerCase();
  const hasHeader = headerLower.includes('question') || headerLower.includes('course');
  const hasOptionEColumn = headerLower.includes('option_e') || headerLower.includes('option e');
  const startIndex = hasHeader ? 1 : 0;

  for (let i = startIndex; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols.length < 4) {
      errs.push(`Row ${i + 1}: Not enough columns.`);
      continue;
    }

    let rawCode, questionText, optA, optB, optC, optD, optE, rawCorrect, explanation, passage;
    if (hasOptionEColumn || cols.length >= 10) {
      [rawCode, questionText, optA, optB, optC, optD, optE, rawCorrect, explanation, passage] = cols;
    } else {
      [rawCode, questionText, optA, optB, optC, optD, rawCorrect, explanation, passage] = cols;
      optE = '';
    }

    if (!questionText || !optA || !optB) {
      errs.push(`Row ${i + 1}: Missing question text or Options A & B.`);
      continue;
    }

    const exactCourse = courses.find(
      (c) =>
        c.code.toLowerCase() === String(rawCode).trim().toLowerCase() ||
        c.id.toLowerCase() === String(rawCode).trim().toLowerCase()
    );
    if (!exactCourse) unmatched += 1;
    const matchedCourse = exactCourse || courses[0];

    const options = [optA, optB, optC, optD, optE]
      .map((o) => (o ? String(o).trim() : ''))
      .filter(Boolean);

    const cleanAns = String(rawCorrect || 'A').trim().toUpperCase();
    let correctIndex = 0;
    if (['A', '0', 'TRUE', 'T'].includes(cleanAns)) correctIndex = 0;
    else if (['B', '1', 'FALSE', 'F'].includes(cleanAns)) correctIndex = 1;
    else if (['C', '2'].includes(cleanAns)) correctIndex = 2;
    else if (['D', '3'].includes(cleanAns)) correctIndex = 3;
    else if (['E', '4'].includes(cleanAns)) correctIndex = 4;
    correctIndex = Math.min(correctIndex, Math.max(0, options.length - 1));

    parsed.push({
      id: `q_csv_${Date.now()}_${i}`,
      courseId: matchedCourse?.id || 'gen-101',
      courseCode: matchedCourse?.code || String(rawCode).trim().toUpperCase(),
      passage: passage || null,
      question: questionText.trim(),
      options,
      correctIndex,
      explanation: explanation || ''
    });
  }

  return { parsed, errs, unmatched };
}

// 0.5 -> "30 secs", 1.5 -> "1m 30s", 15 -> "15 mins"
function formatMins(mins) {
  const secs = Math.round(Number(mins || 0) * 60);
  if (secs < 60) return `${secs} secs`;
  if (secs % 60 === 0) return `${secs / 60} mins`;
  return `${Math.floor(secs / 60)}m ${secs % 60}s`;
}

// 754 -> "12:34", 4000 -> "1:06:40"
function formatClock(totalSecs) {
  const t = Math.max(0, Math.floor(Number(totalSecs) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

export default function AdminConsole({
  courses,
  setCourses,
  sittings,
  setSittings,
  accessCodes,
  setAccessCodes,
  questionBank,
  setQuestionBank,
  standings,
  setStandings,
  announcements,
  setAnnouncements,
  flaggedReports,
  setFlaggedReports,
  platformConfig,
  setPlatformConfig,
  auditLogs,
  logAdminAction
}) {
  const [isUnlocked, setIsUnlocked] = useState(
    () => sessionStorage.getItem('aia_admin_unlocked') === 'true'
  );
  const [loginMethod, setLoginMethod] = useState('email');
  const [adminEmail, setAdminEmail] = useState(
    platformConfig?.organiserEmail || 'ayodejiakin2020@gmail.com'
  );
  const [adminPassword, setAdminPassword] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [pinError, setPinError] = useState('');

  const [activeNav, setActiveNav] = useState('overview');
  const [sittingLifecycleTab, setSittingLifecycleTab] = useState('active');
  const [sittingCategoryFilter, setSittingCategoryFilter] = useState('ALL');
  const [sittingSearch, setSittingSearch] = useState('');

  const [copiedCode, setCopiedCode] = useState(null);
  const [copyToast, setCopyToast] = useState('');
  const [copiedShareId, setCopiedShareId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bankCourseFilter, setBankCourseFilter] = useState('ALL');
  // 'ALL' = every question, 'SHARED' = shared bank only, otherwise a mock (sitting) id
  const [bankSittingFilter, setBankSittingFilter] = useState('ALL');
  const [bankPage, setBankPage] = useState(0);
  const [cleaningDupes, setCleaningDupes] = useState(false);

  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectCategoryFilter, setSubjectCategoryFilter] = useState('ALL');
  const [modalSubjectSearch, setModalSubjectSearch] = useState('');

  // Access codes
  const [codesSearch, setCodesSearch] = useState('');
  const [codesTab, setCodesTab] = useState('available');
  const [codeGenBusy, setCodeGenBusy] = useState(false);
  const [openCodeGroups, setOpenCodeGroups] = useState({});

  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateDeptFilter, setCandidateDeptFilter] = useState('ALL');
  const [candidatePage, setCandidatePage] = useState(0);

  const [resultsSittingFilter, setResultsSittingFilter] = useState('ALL');
  const [resultsCandidateSearch, setResultsCandidateSearch] = useState('');
  const [resultsDeptFilter, setResultsDeptFilter] = useState('ALL');
  const [resultsPage, setResultsPage] = useState(0);
  const [scheduleDateTimeInput, setScheduleDateTimeInput] = useState('');

  const [settingsSavedBanner, setSettingsSavedBanner] = useState(false);

  // Live Sittings (server exam sessions)
  const [liveSessions, setLiveSessions] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState('');
  const [liveTab, setLiveTab] = useState('locked');
  const [liveSearch, setLiveSearch] = useState('');
  const [liveExamFilter, setLiveExamFilter] = useState('ALL');
  const [serverOffsetMs, setServerOffsetMs] = useState(0); // server time minus this device's time
  const [clockNow, setClockNow] = useState(() => Date.now());
  const [actionBusyId, setActionBusyId] = useState(null);
  const [readmitTarget, setReadmitTarget] = useState(null);
  const [readmitExtra, setReadmitExtra] = useState('0');
  const [readmitNote, setReadmitNote] = useState('');

  // scope: 'EXAM' (one exam or an admin-made combo) | 'CUSTOM' (student-built combo) | 'ALL'
  const [codeGenForm, setCodeGenForm] = useState({
    quantity: 5,
    assignedTo: '',
    scope: 'EXAM',
    examId: '',
    comboIds: []
  });

  const [showSittingModal, setShowSittingModal] = useState(false);
  const [editingSittingId, setEditingSittingId] = useState(null);
  const [sittingForm, setSittingForm] = useState({ ...EMPTY_SITTING });
  const [savingSitting, setSavingSitting] = useState(false);
  // Duration is typed in minutes OR seconds, stored as minutes
  const [durationUnit, setDurationUnit] = useState('MINS');
  const [durationText, setDurationText] = useState('20');

  // Questions chosen inside the Create / Edit Exam window
  // 'DEDICATED' = this exam has its own questions, 'SHARED' = it draws from the shared subject bank
  const [modalQSource, setModalQSource] = useState('DEDICATED');
  const [modalCsvRows, setModalCsvRows] = useState([]);
  const [modalCsvErrors, setModalCsvErrors] = useState([]);
  const [modalCsvFileName, setModalCsvFileName] = useState('');
  const [modalCsvUnmatched, setModalCsvUnmatched] = useState(0);
  const modalFileInputRef = useRef(null);

  const [newCourse, setNewCourse] = useState({ code: '', name: '', category: 'General / UTME' });

  const fileInputRef = useRef(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvParsedRows, setCsvParsedRows] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvImportSuccess, setCsvImportSuccess] = useState('');
  const [csvImporting, setCsvImporting] = useState(false);
  // '' = shared course bank, otherwise the id of the mock that will own the uploaded questions
  const [selectedCsvSittingId, setSelectedCsvSittingId] = useState('');

  const [newQType, setNewQType] = useState('MCQ');
  const [newQ, setNewQ] = useState({
    courseId: courses[0]?.id || 'ana-301',
    sittingId: '',
    passage: '',
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
    optionE: '',
    correctIndex: 0,
    explanation: ''
  });

  const [newAnn, setNewAnn] = useState({
    title: '',
    body: '',
    imageUrl: '',
    ctaLabel: 'Register Now',
    ctaUrl: ''
  });

  const formatSecs = (secs) => {
    const sNum = Number(secs || 0);
    const m = Math.floor(sNum / 60);
    const s = sNum % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  // ---------------------------------------------------------------- QUESTION BANK HELPERS
  // The same question (same id) can never be counted or shown twice, even if the app state holds it twice
  const bankQuestions = useMemo(() => {
    const seen = new Set();
    return questionBank.filter((q) => {
      if (q.id === undefined || q.id === null) return true;
      const key = String(q.id);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [questionBank]);

  // How many questions are dedicated to each mock (sitting). Questions with no sittingId are the shared bank.
  const questionCountBySitting = useMemo(() => {
    const counts = {};
    bankQuestions.forEach((q) => {
      if (q.sittingId) {
        const key = String(q.sittingId);
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [bankQuestions]);

  // Real duplicates: same question text and options, in the same place (same mock or both shared)
  const duplicateQuestionIds = useMemo(() => {
    const seen = new Set();
    const extras = [];
    bankQuestions.forEach((q) => {
      const key = [
        q.sittingId || 'shared',
        q.courseId,
        String(q.question || '').trim().toLowerCase().replace(/\s+/g, ' '),
        (q.options || []).map((o) => String(o).trim().toLowerCase()).join('|')
      ].join('::');
      if (seen.has(key)) extras.push(q.id);
      else seen.add(key);
    });
    return extras;
  }, [bankQuestions]);

  const fromDbQuestionRow = (q) => ({
    id: q.id,
    courseId: q.course_id,
    courseCode: q.course_code,
    sittingId: q.sitting_id || null,
    passage: q.passage,
    question: q.question,
    options: q.options,
    correctIndex: q.correct_index,
    explanation: q.explanation
  });

  const mergeIntoBank = (newRows) => {
    setQuestionBank((prev) => {
      const have = new Set(prev.map((q) => String(q.id)));
      return [...newRows.filter((r) => !have.has(String(r.id))), ...prev];
    });
  };

  // Saves a batch of questions (to one mock, or to the shared bank when sittingId is empty).
  // Returns how many were really saved, and a cloud error message if something went wrong.
  const saveQuestionsToBank = async (rows, sittingId) => {
    const target = sittingId || null;
    const prepared = rows.map((q) => ({ ...q, sittingId: target }));
    let cloudError = '';
    let finalRows = prepared;

    if (isSupabaseConfigured && supabase) {
      const savedAll = [];
      for (let i = 0; i < prepared.length; i += 200) {
        const chunk = prepared.slice(i, i + 200);
        const { data, error } = await supabase
          .from('questions')
          .insert(
            chunk.map((q) => ({
              course_id: q.courseId,
              course_code: q.courseCode,
              sitting_id: q.sittingId || null,
              passage: q.passage,
              question: q.question,
              options: q.options,
              correct_index: q.correctIndex,
              explanation: q.explanation
            }))
          )
          .select();
        if (error) {
          cloudError = error.message || 'Unknown cloud error';
          break;
        }
        (data || []).forEach((r) => savedAll.push(fromDbQuestionRow(r)));
      }
      if (cloudError) finalRows = savedAll;
      else finalRows = savedAll.length > 0 ? savedAll : prepared;
    }

    mergeIntoBank(finalRows);
    return { count: finalRows.length, cloudError };
  };

  const goAddQuestions = (sit) => {
    setSelectedCsvSittingId(String(sit.id));
    setNewQ((p) => ({ ...p, sittingId: String(sit.id) }));
    setBankSittingFilter(String(sit.id));
    setBankPage(0);
    setCsvImportSuccess('');
    setActiveNav('bank');
  };

  // ---------------------------------------------------------------- AUTH
  const handleAdminUnlock = async (e) => {
    e.preventDefault();
    setPinError('');
    setAuthLoading(true);

    const savedPin = String(platformConfig?.adminPin || '2026').trim();
    const savedOrgEmail = String(platformConfig?.organiserEmail || 'ayodejiakin2020@gmail.com')
      .trim()
      .toLowerCase();

    try {
      if (loginMethod === 'email') {
        const cleanEmail = adminEmail.trim().toLowerCase();
        const cleanPass = adminPassword.trim();

        if (
          cleanEmail === savedOrgEmail &&
          (cleanPass === savedPin || cleanPass === 'Brilly2405' || cleanPass === '2026')
        ) {
          sessionStorage.setItem('aia_admin_unlocked', 'true');
          setIsUnlocked(true);
          logAdminAction(`Organiser ${cleanEmail} signed in`, 'Auth');
          return;
        }

        if (isSupabaseConfigured && supabase) {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: adminPassword
          });
          if (!error && data?.user) {
            sessionStorage.setItem('aia_admin_unlocked', 'true');
            setIsUnlocked(true);
            logAdminAction(`Organiser ${data.user.email} signed in via Supabase`, 'Auth');
            return;
          }
        }

        setPinError(
          'Invalid email or password. Use your Organiser Email with your Console PIN (e.g. Brilly2405 or 2026), or switch to Quick PIN.'
        );
      } else {
        const cleanPin = pinInput.trim();
        if (
          cleanPin === savedPin ||
          cleanPin === 'Brilly2405' ||
          cleanPin === '2026' ||
          cleanPin.toLowerCase() === 'admin'
        ) {
          sessionStorage.setItem('aia_admin_unlocked', 'true');
          setIsUnlocked(true);
          logAdminAction('Organiser signed into /admin console via PIN', 'Session');
        } else {
          setPinError('Invalid Organiser PIN.');
        }
      }
    } catch (err) {
      setPinError(err.message || 'Failed to authenticate organiser.');
    } finally {
      setAuthLoading(false);
    }
  };

  // ---------------------------------------------------------------- SHARE LINKS
  const handleCopyExamShareLink = (sit) => {
    navigator.clipboard.writeText(`${window.location.origin}/?exam=${sit.id}`);
    setCopiedShareId(sit.id);
    setTimeout(() => setCopiedShareId(null), 2200);
  };

  const handleNativeShareExamLink = async (sit) => {
    const link = `${window.location.origin}/?exam=${sit.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: sit.title,
          text: `Take "${sit.title}" on AIA Academy`,
          url: link
        });
        return;
      } catch (e) {}
    }
    handleCopyExamShareLink(sit);
  };

  // ---------------------------------------------------------------- SITTINGS
  const setDuration = (text, unit = durationUnit) => {
    setDurationText(text);
    setDurationUnit(unit);
    const n = Number(text);
    setSittingForm((prev) => ({
      ...prev,
      durationMins: n > 0 ? (unit === 'SECS' ? n / 60 : n) : ''
    }));
  };

  const switchDurationUnit = (unit) => {
    const mins = Number(sittingForm.durationMins) || 0;
    const nextText =
      mins > 0
        ? String(unit === 'SECS' ? Math.round(mins * 60) : Math.round(mins * 100) / 100)
        : '';
    setDurationUnit(unit);
    setDurationText(nextText);
  };

  const resetModalQuestionFile = () => {
    setModalCsvRows([]);
    setModalCsvErrors([]);
    setModalCsvFileName('');
    setModalCsvUnmatched(0);
    if (modalFileInputRef.current) modalFileInputRef.current.value = '';
  };

  const openCreateSittingModal = () => {
    setEditingSittingId(null);
    setModalSubjectSearch('');
    setSittingForm({ ...EMPTY_SITTING, leaveAction: 'SUBMIT' });
    setDurationUnit('MINS');
    setDurationText('20');
    setModalQSource('DEDICATED');
    resetModalQuestionFile();
    setShowSittingModal(true);
  };

  const openEditSittingModal = (sit) => {
    const mins = Number(sit.durationMins) || 15;
    const useSecs = sit.mode === 'PRACTICE' && mins < 3;
    setEditingSittingId(sit.id);
    setModalSubjectSearch('');
    setDurationUnit(useSecs ? 'SECS' : 'MINS');
    setDurationText(useSecs ? String(Math.round(mins * 60)) : String(mins));
    setModalQSource((questionCountBySitting[String(sit.id)] || 0) > 0 ? 'DEDICATED' : 'SHARED');
    resetModalQuestionFile();
    setSittingForm({
      title: sit.title || '',
      mode: sit.mode || 'OFFICIAL',
      allowedModes:
        Array.isArray(sit.allowedModes) && sit.allowedModes.length > 0
          ? sit.allowedModes
          : [sit.mode || 'OFFICIAL'],
      targetCourse: sit.targetCourse || 'All Courses',
      priceNaira: sit.priceNaira ?? 0,
      retakePriceNaira: sit.retakePriceNaira ?? 0,
      requiresCode: Boolean(sit.requiresCode),
      durationMins: mins,
      questionCount: sit.questionCount || 20,
      passMark: sit.passMark || 50,
      maxTabSwitches: sit.maxTabSwitches || 3,
      leaveAction: sit.leaveAction || 'SUBMIT',
      isFeatured: Boolean(sit.isFeatured),
      shuffleQuestions: sit.shuffleQuestions !== false,
      allowedCourses: sit.allowedCourses || [],
      comboSittingIds: sit.comboSittingIds || [],
      status: sit.status || 'OPEN',
      resultsReleased: sit.resultsReleased !== false,
      releaseMode: sit.releaseMode || (sit.resultsReleased === false ? 'HELD' : 'INSTANT'),
      releaseAt: sit.releaseAt ? String(sit.releaseAt).slice(0, 16) : '',
      description: sit.description || ''
    });
    setShowSittingModal(true);
  };

  // Changing the category: Speed Drills get sensible short defaults
  const handleModeChange = (nextMode) => {
    setSittingForm((prev) => {
      const isDefaultShape = Number(prev.durationMins) === 20 && Number(prev.questionCount) === 25;
      const next = {
        ...prev,
        mode: nextMode,
        allowedModes: [nextMode]
      };
      if (nextMode === 'PRACTICE' && !editingSittingId && isDefaultShape) {
        next.durationMins = 1.5;
        next.questionCount = 10;
        next.priceNaira = 0;
        next.requiresCode = false;
        next.releaseMode = 'INSTANT';
      }
      return next;
    });
    if (nextMode === 'PRACTICE' && !editingSittingId && Number(sittingForm.durationMins) === 20) {
      setDurationUnit('SECS');
      setDurationText('90');
    }
  };

  const comboPickPool = sittings.filter(
    (s) =>
      s.id !== editingSittingId &&
      s.mode !== 'BUNDLED' &&
      s.mode !== 'PRACTICE' &&
      s.status !== 'ARCHIVED'
  );

  // If a mock has its own questions, that is its pool. Otherwise it uses the shared course bank.
  const poolSizeFor = (sit) => {
    const dedicated = questionCountBySitting[String(sit.id)] || 0;
    if (dedicated > 0) return dedicated;
    const ids = sit.allowedCourses || [];
    return ids.length > 0
      ? bankQuestions.filter((q) => !q.sittingId && ids.includes(q.courseId)).length
      : bankQuestions.filter((q) => !q.sittingId).length;
  };

  const comboPicked = sittingForm.comboSittingIds
    .map((id) => sittings.find((s) => String(s.id) === String(id)))
    .filter(Boolean);

  const comboTotals = {
    price: comboPicked.reduce((n, s) => n + (Number(s.priceNaira) || 0), 0),
    mins: comboPicked.reduce((n, s) => n + (Number(s.durationMins) || 0), 0),
    qs: comboPicked.reduce(
      (n, s) => n + Math.min(poolSizeFor(s), Number(s.questionCount) || poolSizeFor(s)),
      0
    )
  };

  const toggleComboExam = (id) => {
    setSittingForm((prev) => ({
      ...prev,
      comboSittingIds: prev.comboSittingIds.includes(id)
        ? prev.comboSittingIds.filter((x) => x !== id)
        : [...prev.comboSittingIds, id]
    }));
  };

  const useComboTotals = () => {
    setSittingForm((prev) => ({ ...prev, priceNaira: comboTotals.price }));
    setDurationUnit('MINS');
    setDurationText(String(comboTotals.mins));
    setSittingForm((prev) => ({ ...prev, durationMins: comboTotals.mins }));
  };

  // Reads the question file picked inside the Create / Edit Exam window
  const handleModalCsvSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { parsed, errs, unmatched } = parseQuestionsCsv(String(ev.target?.result || ''), courses);
      setModalCsvRows(parsed);
      setModalCsvErrors(errs);
      setModalCsvUnmatched(unmatched);
      setModalCsvFileName(file.name);
    };
    reader.readAsText(file);
  };

  const handleRemoveDedicatedQuestions = async (sittingId) => {
    const n = questionCountBySitting[String(sittingId)] || 0;
    if (n === 0) return;
    if (
      !window.confirm(
        `Delete all ${n} questions that belong to this exam?\n\nThis cannot be undone. The exam will then use the shared subject bank unless you upload new questions.`
      )
    ) {
      return;
    }
    setQuestionBank((prev) => prev.filter((q) => String(q.sittingId || '') !== String(sittingId)));
    if (isSupabaseConfigured && supabase) {
      await supabase.from('questions').delete().eq('sitting_id', String(sittingId));
    }
    setModalQSource('SHARED');
    logAdminAction(
      `Deleted ${n} dedicated questions`,
      sittings.find((s) => String(s.id) === String(sittingId))?.title || String(sittingId)
    );
  };

  const handleSaveSitting = async (e) => {
    e.preventDefault();
    if (!sittingForm.title.trim() || savingSitting) return;

    const isCombo = sittingForm.mode === 'BUNDLED';
    const comboIds = isCombo ? sittingForm.comboSittingIds : [];

    if (isCombo && comboIds.length < 2 && sittingForm.allowedCourses.length < 2) {
      alert('A combo needs at least 2 exams (tick them under "Exams in this combo").');
      return;
    }
    if (!(Number(sittingForm.durationMins) > 0)) {
      alert('Enter a time limit greater than zero.');
      return;
    }

    // Where do this exam's questions come from?
    const existingOwn =
      editingSittingId && !isCombo ? questionCountBySitting[String(editingSittingId)] || 0 : 0;
    const ownMode = !isCombo && (existingOwn > 0 || modalQSource === 'DEDICATED');
    const newOwnRows = ownMode ? modalCsvRows : [];
    const willHaveOwn = existingOwn + newOwnRows.length;

    // Shared mode with no subjects would pull from the ENTIRE bank, so we ask first
    if (!isCombo && !ownMode && sittingForm.allowedCourses.length === 0) {
      const goOn = window.confirm(
        'You have not picked any subjects.\n\nThis exam will draw its questions from the ENTIRE shared bank (every subject mixed together).\n\nPress OK to save it like that, or Cancel to go back and pick subjects or upload questions for this exam.'
      );
      if (!goOn) return;
    }

    // An exam that owns questions but has none yet must not go live (it would fall back to the whole bank)
    let finalStatus = sittingForm.status || 'OPEN';
    let keptAsDraft = false;
    if (ownMode && willHaveOwn === 0 && finalStatus === 'OPEN') {
      finalStatus = 'DRAFT';
      keptAsDraft = true;
    }

    const isReleasedBool = sittingForm.releaseMode === 'INSTANT';
    const isoReleaseAt =
      sittingForm.releaseMode === 'SCHEDULED' && sittingForm.releaseAt
        ? new Date(sittingForm.releaseAt).toISOString()
        : null;

    const existing = sittings.find((s) => s.id === editingSittingId);

    // For a combo built from exams, keep the linked subjects in sync (info only)
    const comboCourses = Array.from(
      new Set(comboPicked.flatMap((s) => s.allowedCourses || []))
    );

    const payload = {
      id: editingSittingId || 'sit_' + Date.now(),
      title: sittingForm.title.trim(),
      mode: sittingForm.mode,
      allowedModes: [sittingForm.mode],
      targetCourse: sittingForm.targetCourse || 'All Courses',
      priceNaira: Number(sittingForm.priceNaira) || 0,
      retakePriceNaira: Number(sittingForm.retakePriceNaira) || 0,
      requiresCode: Boolean(sittingForm.requiresCode),
      durationMins: Number(sittingForm.durationMins),
      questionCount:
        isCombo && comboIds.length >= 2 ? comboTotals.qs : Number(sittingForm.questionCount) || 20,
      passMark: Number(sittingForm.passMark) || 50,
      maxTabSwitches: Math.max(1, Number(sittingForm.maxTabSwitches) || 3),
      leaveAction:
        sittingForm.mode === 'PRACTICE' ? 'SUBMIT' : sittingForm.leaveAction === 'LOCK' ? 'LOCK' : 'SUBMIT',
      isFeatured: Boolean(sittingForm.isFeatured),
      shuffleQuestions: Boolean(sittingForm.shuffleQuestions),
      allowedCourses:
        isCombo && comboIds.length >= 2 ? comboCourses : sittingForm.allowedCourses,
      comboSittingIds: comboIds,
      status: finalStatus,
      // Speed Drills always show results at once
      resultsReleased: sittingForm.mode === 'PRACTICE' ? true : isReleasedBool,
      releaseMode: sittingForm.mode === 'PRACTICE' ? 'INSTANT' : sittingForm.releaseMode || 'INSTANT',
      releaseAt: sittingForm.mode === 'PRACTICE' ? null : isoReleaseAt,
      description:
        sittingForm.description.trim() ||
        `${sittingForm.mode} assessment for ${sittingForm.targetCourse}.`,
      createdAt: existing?.createdAt || new Date().toISOString()
    };

    setSavingSitting(true);

    if (isSupabaseConfigured && supabase) {
      const { error } = await supabase.from('sittings').upsert({
        id: payload.id,
        title: payload.title,
        mode: payload.mode,
        allowed_modes: payload.allowedModes,
        target_course: payload.targetCourse,
        price_naira: payload.priceNaira,
        retake_price_naira: payload.retakePriceNaira,
        requires_code: payload.requiresCode,
        duration_mins: payload.durationMins,
        question_count: payload.questionCount,
        pass_mark: payload.passMark,
        max_tab_switches: payload.maxTabSwitches,
        leave_action: payload.leaveAction,
        is_featured: payload.isFeatured,
        shuffle_questions: payload.shuffleQuestions,
        allowed_courses: payload.allowedCourses,
        combo_sitting_ids: payload.comboSittingIds,
        status: payload.status,
        results_released: payload.resultsReleased,
        release_mode: payload.releaseMode,
        release_at: payload.releaseAt,
        description: payload.description
      });

      if (error) {
        setSavingSitting(false);
        alert(
          'Could not save this exam to the cloud, so nothing was changed.\n\n' +
            error.message +
            '\n\nIf it mentions "combo_sitting_ids" or "duration_mins", run the new SQL in Supabase first.'
        );
        return;
      }
    }

    if (editingSittingId) {
      setSittings((prev) => prev.map((s) => (s.id === editingSittingId ? { ...s, ...payload } : s)));
      logAdminAction('Edited exam sitting', payload.title);
    } else {
      setSittings((prev) => [payload, ...prev]);
      logAdminAction(`Created ${payload.mode} exam`, payload.title);
    }

    // Import the questions picked in the window, straight onto this exam
    let importedCount = 0;
    if (newOwnRows.length > 0) {
      const { count, cloudError } = await saveQuestionsToBank(newOwnRows, payload.id);
      importedCount = count;
      if (cloudError) {
        alert(
          `The exam was saved, but only ${count} of ${newOwnRows.length} questions reached the cloud.\n\n` +
            cloudError +
            '\n\nOpen the exam again and upload the missing questions.'
        );
      } else {
        logAdminAction(`Imported ${count} questions into the exam`, payload.title);
      }
    }

    if (keptAsDraft) {
      showCopyToast('Saved as DRAFT because it has no questions yet. Add questions, then set it to OPEN.');
    } else if (importedCount > 0) {
      showCopyToast(`Saved "${payload.title}" with ${importedCount} questions.`);
    }

    setSavingSitting(false);
    setShowSittingModal(false);
    setEditingSittingId(null);
    resetModalQuestionFile();
  };

  const handleDuplicateSitting = async (sit) => {
    const copy = {
      ...sit,
      id: 'sit_' + Date.now(),
      title: `${sit.title} (Copy)`,
      leaveAction: sit.leaveAction || 'SUBMIT',
      status: 'DRAFT',
      createdAt: new Date().toISOString()
    };
    setSittings((prev) => [copy, ...prev]);
    if (isSupabaseConfigured && supabase) {
      await supabase.from('sittings').upsert({
        id: copy.id,
        title: copy.title,
        mode: copy.mode,
        allowed_modes: copy.allowedModes || [copy.mode],
        target_course: copy.targetCourse || 'All Courses',
        price_naira: copy.priceNaira,
        retake_price_naira: copy.retakePriceNaira || 0,
        requires_code: copy.requiresCode,
        duration_mins: copy.durationMins,
        question_count: copy.questionCount || 20,
        pass_mark: copy.passMark || 50,
        max_tab_switches: copy.maxTabSwitches || 3,
        leave_action: copy.leaveAction || 'SUBMIT',
        is_featured: Boolean(copy.isFeatured),
        shuffle_questions: copy.shuffleQuestions !== false,
        allowed_courses: copy.allowedCourses || [],
        combo_sitting_ids: copy.comboSittingIds || [],
        status: copy.status,
        results_released: copy.resultsReleased,
        release_mode: copy.releaseMode || 'INSTANT',
        release_at: copy.releaseAt || null,
        description: copy.description
      });
    }
    logAdminAction('Duplicated sitting', copy.title);
  };

  const handleUpdateSitting = async (id, patch) => {
    setSittings((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    if (isSupabaseConfigured && supabase) {
      const dbPatch = {};
      if (patch.priceNaira !== undefined) dbPatch.price_naira = patch.priceNaira;
      if (patch.retakePriceNaira !== undefined) dbPatch.retake_price_naira = patch.retakePriceNaira;
      if (patch.durationMins !== undefined) dbPatch.duration_mins = patch.durationMins;
      if (patch.questionCount !== undefined) dbPatch.question_count = patch.questionCount;
      if (patch.maxTabSwitches !== undefined) dbPatch.max_tab_switches = patch.maxTabSwitches;
      if (patch.leaveAction !== undefined) dbPatch.leave_action = patch.leaveAction;
      if (patch.requiresCode !== undefined) dbPatch.requires_code = patch.requiresCode;
      if (patch.resultsReleased !== undefined) dbPatch.results_released = patch.resultsReleased;
      if (patch.releaseMode !== undefined) dbPatch.release_mode = patch.releaseMode;
      if (patch.releaseAt !== undefined) dbPatch.release_at = patch.releaseAt;
      if (patch.status !== undefined) dbPatch.status = patch.status;
      if (patch.isFeatured !== undefined) dbPatch.is_featured = patch.isFeatured;
      if (patch.targetCourse !== undefined) dbPatch.target_course = patch.targetCourse;
      if (Object.keys(dbPatch).length > 0) {
        await supabase.from('sittings').update(dbPatch).eq('id', id);
      }
    }
  };

  const handleToggleArchiveSitting = async (sit) => {
    const nextStatus = sit.status === 'ARCHIVED' ? 'OPEN' : 'ARCHIVED';
    await handleUpdateSitting(sit.id, { status: nextStatus });
    logAdminAction(
      nextStatus === 'ARCHIVED' ? 'Archived exam sitting' : 'Restored exam sitting',
      sit.title
    );
  };

  const handleDeleteSitting = async (sit) => {
    const ownQs = questionCountBySitting[String(sit.id)] || 0;
    if (
      !window.confirm(
        `Permanently delete "${sit.title}"${
          ownQs > 0 ? ` and its ${ownQs} dedicated questions` : ''
        }? To hide it without deleting, use Archive instead.`
      )
    ) {
      return;
    }
    setSittings((prev) => prev.filter((s) => s.id !== sit.id));
    if (ownQs > 0) {
      setQuestionBank((prev) => prev.filter((q) => String(q.sittingId || '') !== String(sit.id)));
    }
    if (isSupabaseConfigured && supabase) {
      await supabase.from('sittings').delete().eq('id', sit.id);
      if (ownQs > 0) {
        await supabase.from('questions').delete().eq('sitting_id', String(sit.id));
      }
    }
    logAdminAction('Deleted exam sitting permanently', sit.title);
  };

  // "PHY 101 · MAT 101 · BIO 101" for a combo
  const getComboSubjectsLine = (sit) => {
    if (sit.mode !== 'BUNDLED') return '';
    const ids = sit.comboSittingIds || [];
    if (ids.length > 1) {
      return ids
        .map((id) => sittings.find((s) => String(s.id) === String(id))?.title)
        .filter(Boolean)
        .join(' · ');
    }
    return (sit.allowedCourses || [])
      .map((cid) => courses.find((c) => c.id === cid)?.code)
      .filter(Boolean)
      .join(' · ');
  };

  // ---------------------------------------------------------------- COURSES
  const handleCreateCourse = async (e) => {
    e.preventDefault();
    if (!newCourse.code.trim() || !newCourse.name.trim()) return;
    const id = newCourse.code.trim().toLowerCase().replace(/\s+/g, '-');
    const created = {
      id,
      code: newCourse.code.trim().toUpperCase(),
      name: newCourse.name.trim(),
      category: newCourse.category.trim() || 'General / UTME'
    };
    setCourses((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, created]));
    if (isSupabaseConfigured && supabase) {
      await supabase.from('courses').upsert(created);
    }
    logAdminAction('Added subject/course', created.code);
    setNewCourse({ code: '', name: '', category: newCourse.category });
  };

  const handleDeleteCourse = async (courseObj) => {
    if (!window.confirm(`Delete subject "${courseObj.code} — ${courseObj.name}"?`)) return;
    setCourses((prev) => prev.filter((c) => c.id !== courseObj.id));
    if (isSupabaseConfigured && supabase) {
      await supabase.from('courses').delete().eq('id', courseObj.id);
    }
    logAdminAction('Deleted subject/course', courseObj.code);
  };

  // ---------------------------------------------------------------- CSV
  const handleDownloadCsvTemplate = () => {
    const sampleRows = [
      'course_code,question,option_a,option_b,option_c,option_d,option_e,correct_option,explanation,passage',
      '"ANA 301","Which nerve innervates the deltoid muscle?","Radial nerve","Axillary nerve","Median nerve","Ulnar nerve","Musculocutaneous nerve","B","The axillary nerve (C5-C6) supplies the deltoid and teres minor.",""',
      '"ANA 201","True or False: The femur is the longest and strongest bone in the human body.","True","False","","","","A","The femur is the longest, heaviest, and strongest bone.",""',
      '"PHS 204","Which pacemaker sets the normal sinus rhythm of the heart?","AV Node","Purkinje fibers","SA Node","Bundle of His","","C","The sinoatrial (SA) node fires at 60-100 bpm.",""'
    ].join('\n');
    const blob = new Blob([sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aia_questions_template_A_to_E_and_TF.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCsvFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvImportSuccess('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const { parsed, errs } = parseQuestionsCsv(String(event.target?.result || ''), courses);
      setCsvParsedRows(parsed);
      setCsvErrors(errs);
    };
    reader.readAsText(file);
  };

  const handleCommitCsvUpload = async () => {
    if (csvParsedRows.length === 0 || csvImporting) return;

    // The target mock is read at the moment of import, so changing the dropdown after picking the file still works
    setCsvImporting(true);
    const targetSittingId = selectedCsvSittingId || null;
    const targetSitting = targetSittingId
      ? sittings.find((s) => String(s.id) === String(targetSittingId))
      : null;
    const total = csvParsedRows.length;

    const { count, cloudError } = await saveQuestionsToBank(csvParsedRows, targetSittingId);
    setCsvImporting(false);

    if (cloudError) {
      alert(
        `Only ${count} of ${total} questions were saved to the cloud.\n\n${cloudError}` +
          (count === 0 ? '\n\nNothing was saved. Your file is still loaded, so you can try again.' : '')
      );
      if (count === 0) return;
    }

    logAdminAction(
      `Uploaded ${count} questions via .CSV file to ${
        targetSitting ? targetSitting.title : 'the shared course bank'
      }`,
      csvFileName
    );
    setCsvImportSuccess(
      `Successfully imported ${count} questions from ${csvFileName} into ${
        targetSitting ? `"${targetSitting.title}" (dedicated)` : 'the shared course bank'
      }.`
    );
    setCsvParsedRows([]);
    setCsvErrors([]);
    setCsvFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Deletes repeated questions (same text and options in the same place), keeping one of each
  const handleRemoveDuplicateQuestions = async () => {
    const ids = duplicateQuestionIds;
    if (ids.length === 0 || cleaningDupes) return;
    if (
      !window.confirm(
        `Remove ${ids.length} repeated question(s)?\n\nOne copy of each question is kept. Questions only count as repeats when the text and options match and they sit in the same place (same mock, or both in the shared bank).`
      )
    ) {
      return;
    }
    setCleaningDupes(true);
    const idSet = new Set(ids.map(String));
    if (isSupabaseConfigured && supabase) {
      const realIds = ids.filter((id) => !String(id).startsWith('q_'));
      for (let i = 0; i < realIds.length; i += 100) {
        const { error } = await supabase
          .from('questions')
          .delete()
          .in('id', realIds.slice(i, i + 100));
        if (error) {
          setCleaningDupes(false);
          alert('Could not remove the repeats from the cloud.\n\n' + error.message);
          return;
        }
      }
    }
    setQuestionBank((prev) => prev.filter((q) => !idSet.has(String(q.id))));
    logAdminAction(`Removed ${ids.length} repeated questions`, 'Question bank');
    setCleaningDupes(false);
    showCopyToast(`Removed ${ids.length} repeated question(s).`);
  };

  // ---------------------------------------------------------------- ACCESS CODES
  const getCodeScopeIds = (c) => {
    if (Array.isArray(c.sittingIds) && c.sittingIds.length > 0) return c.sittingIds.map(String);
    if (c.sittingId && c.sittingId !== 'ALL') return [String(c.sittingId)];
    return [];
  };
  const getCodeScopeKey = (c) => {
    const ids = getCodeScopeIds(c);
    return ids.length === 0 ? 'ALL' : [...ids].sort().join('+');
  };
  const isComboScope = (ids) =>
    ids.length > 1 ||
    (ids.length === 1 && sittings.find((s) => String(s.id) === String(ids[0]))?.mode === 'BUNDLED');
  const getCodeScopeLabel = (c) => {
    const ids = getCodeScopeIds(c);
    if (ids.length === 0) return 'Any exam (universal)';
    const titles = ids.map(
      (id) => sittings.find((s) => String(s.id) === id)?.title || c.sittingTitle || id
    );
    return ids.length > 1 ? `Custom combo: ${titles.join(' + ')}` : titles[0];
  };

  const showCopyToast = (msg) => {
    setCopyToast(msg);
    setTimeout(() => setCopyToast(''), 3500);
  };

  const handleGenerateCodes = async (e) => {
    e.preventDefault();
    if (codeGenBusy) return;

    const count = Math.min(50, Math.max(1, Number(codeGenForm.quantity) || 1));
    const scope = codeGenForm.scope;

    let scopeIds = [];
    let title = 'Universal 1-Use Pass (Any Exam)';
    let price = 0;
    let mode = 'ALL';

    if (scope === 'EXAM') {
      const sit = sittings.find((s) => String(s.id) === String(codeGenForm.examId));
      if (!sit) {
        alert('Pick the exam or combo these codes are for.');
        return;
      }
      scopeIds = [sit.id];
      title = sit.title;
      price = Number(sit.priceNaira) || 0;
      mode = sit.mode || 'OFFICIAL';
    } else if (scope === 'CUSTOM') {
      const picks = codeGenForm.comboIds
        .map((id) => sittings.find((s) => String(s.id) === String(id)))
        .filter(Boolean);
      if (picks.length < 2) {
        alert('Pick at least 2 exams for a custom combo code.');
        return;
      }
      scopeIds = picks.map((s) => s.id);
      title = `Custom combo: ${picks.map((s) => s.title).join(' + ')}`;
      price = picks.reduce((sum, s) => sum + (Number(s.priceNaira) || 0), 0);
      mode = 'BUNDLED';
    }

    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const existing = new Set(accessCodes.map((c) => c.code));
    const rand = (n) =>
      Array.from({ length: n })
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('');

    const generated = [];
    while (generated.length < count) {
      const code = `AIA-${rand(4)}-${rand(3)}`;
      if (existing.has(code)) continue;
      existing.add(code);
      generated.push({
        id: 'code_' + Date.now() + '_' + generated.length,
        code,
        sittingId: scope === 'EXAM' ? scopeIds[0] : 'ALL',
        sittingIds: scope === 'ALL' ? null : scopeIds,
        sittingTitle: title,
        mode,
        priceNaira: price,
        assignedTo: codeGenForm.assignedTo.trim(),
        status: 'LIVE',
        maxUses: 1,
        usedCount: 0,
        createdAt: new Date().toLocaleDateString()
      });
    }

    setCodeGenBusy(true);
    let finalCodes = generated;

    if (isSupabaseConfigured && supabase) {
      const { data: inserted, error } = await supabase
        .from('access_codes')
        .insert(
          generated.map((g) => ({
            code: g.code,
            sitting_id: scope === 'EXAM' ? g.sittingId : null,
            sitting_ids: scope === 'ALL' ? null : scopeIds,
            sitting_title: g.sittingTitle,
            mode: g.mode,
            price_naira: g.priceNaira,
            assigned_to: g.assignedTo,
            status: 'LIVE',
            max_uses: 1,
            used_count: 0
          }))
        )
        .select();

      if (error) {
        setCodeGenBusy(false);
        alert(
          'Could not save the codes to the cloud, so none were created.\n\n' +
            error.message +
            '\n\nMake sure you ran the new SQL in Supabase first.'
        );
        return;
      }
      if (inserted?.length) {
        const idByCode = new Map(inserted.map((r) => [r.code, r.id]));
        finalCodes = generated.map((g) => ({ ...g, id: idByCode.get(g.code) || g.id }));
      }
    }

    setAccessCodes((prev) => [...finalCodes, ...prev]);
    setCodesTab('available');
    setCodeGenBusy(false);
    logAdminAction(
      `Generated ${count} code(s) for ${
        scope === 'ALL' ? 'any exam' : scope === 'CUSTOM' ? 'a custom combo' : 'one exam'
      }`,
      title
    );
    setCodeGenForm({ ...codeGenForm, assignedTo: '' });
  };

  const markCodeIssued = async (codeObj) => {
    setAccessCodes((prev) =>
      prev.map((c) => (c.code === codeObj.code ? { ...c, status: 'ISSUED' } : c))
    );
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('access_codes')
        .update({ status: 'ISSUED' })
        .eq('code', codeObj.code)
        .eq('status', 'LIVE');
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      return false;
    }
  };

  // Copy = the code leaves "Available" right away, so it can never be copied twice
  const handleCopyCode = async (codeObj) => {
    const ok = await copyToClipboard(codeObj.code);
    if (!ok) alert('Could not copy automatically. Your code is: ' + codeObj.code);
    if (codeObj.status === 'LIVE') {
      await markCodeIssued(codeObj);
      showCopyToast(`${codeObj.code} copied. It moved to "Issued" so it can't be copied twice.`);
      logAdminAction(`Issued code ${codeObj.code}`, getCodeScopeLabel(codeObj));
    } else {
      setCopiedCode(codeObj.code);
      setTimeout(() => setCopiedCode(null), 1800);
    }
  };

  const handleCopyNextCode = async (group) => {
    if (group.items[0]) await handleCopyCode(group.items[0]);
  };

  const handlePutBackCode = async (codeObj) => {
    setAccessCodes((prev) =>
      prev.map((c) => (c.code === codeObj.code ? { ...c, status: 'LIVE' } : c))
    );
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('access_codes')
        .update({ status: 'LIVE' })
        .eq('code', codeObj.code)
        .eq('status', 'ISSUED');
    }
    logAdminAction(`Put code ${codeObj.code} back to Available`, 'Codes');
  };

  const handleDeleteOrRevokeCode = async (codeObj) => {
    setAccessCodes((prev) => prev.filter((c) => c.code !== codeObj.code));
    if (isSupabaseConfigured && supabase) {
      await supabase.from('access_codes').delete().eq('code', codeObj.code);
    }
    logAdminAction(`Removed code ${codeObj.code}`, 'Codes');
  };

  const toggleCustomComboExam = (id) => {
    setCodeGenForm((prev) => ({
      ...prev,
      comboIds: prev.comboIds.includes(id)
        ? prev.comboIds.filter((x) => x !== id)
        : [...prev.comboIds, id]
    }));
  };

  // ---------------------------------------------------------------- QUESTIONS / ANNOUNCEMENTS / SETTINGS
  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    const targetCourse = courses.find((c) => c.id === newQ.courseId) || courses[0];
    const targetMock = newQ.sittingId
      ? sittings.find((s) => String(s.id) === String(newQ.sittingId))
      : null;

    const builtOptions =
      newQType === 'TF'
        ? ['True', 'False']
        : [newQ.optionA, newQ.optionB, newQ.optionC, newQ.optionD, newQ.optionE]
            .map((o) => o.trim())
            .filter(Boolean);

    const safeCorrectIdx = Math.min(Number(newQ.correctIndex) || 0, Math.max(0, builtOptions.length - 1));

    const draft = {
      id: 'q_' + Date.now(),
      courseId: targetCourse.id,
      courseCode: targetCourse.code,
      sittingId: newQ.sittingId || null,
      passage: newQ.passage.trim() || null,
      question: newQ.question.trim(),
      options: builtOptions,
      correctIndex: safeCorrectIdx,
      explanation: newQ.explanation.trim()
    };

    if (isSupabaseConfigured && supabase) {
      const { data: savedRow } = await supabase
        .from('questions')
        .insert({
          course_id: draft.courseId,
          course_code: draft.courseCode,
          sitting_id: draft.sittingId || null,
          passage: draft.passage,
          question: draft.question,
          options: draft.options,
          correct_index: draft.correctIndex,
          explanation: draft.explanation
        })
        .select()
        .single();
      if (savedRow) draft.id = savedRow.id;
    }

    mergeIntoBank([draft]);
    logAdminAction(
      `Added question to ${targetMock ? `mock "${targetMock.title}"` : 'shared bank'}`,
      targetCourse.code
    );
    setNewQ({
      ...newQ,
      passage: '',
      question: '',
      optionA: '',
      optionB: '',
      optionC: '',
      optionD: '',
      optionE: '',
      correctIndex: 0,
      explanation: ''
    });
  };

  const handleAnnouncementImageUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setNewAnn((prev) => ({ ...prev, imageUrl: String(reader.result) }));
    reader.readAsDataURL(file);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const cleanedPhone = String(platformConfig.whatsappNumber || '').replace(/\D/g, '');
    const updatedConfig = {
      ...platformConfig,
      whatsappNumber: cleanedPhone || '2348000000000',
      organiserEmail: (platformConfig.organiserEmail || adminEmail).trim(),
      adminPin: String(platformConfig.adminPin || '2026').trim()
    };

    setPlatformConfig(updatedConfig);
    setAdminEmail(updatedConfig.organiserEmail);
    localStorage.setItem('aia_platform_config', JSON.stringify(updatedConfig));

    try {
      if (isSupabaseConfigured && supabase) {
        await supabase.from('platform_settings').upsert({
          id: 1,
          whatsapp_number: updatedConfig.whatsappNumber,
          organiser_email: updatedConfig.organiserEmail,
          admin_pin: updatedConfig.adminPin
        });
      }
      setSettingsSavedBanner(true);
      setTimeout(() => setSettingsSavedBanner(false), 3000);
      logAdminAction('Updated WhatsApp & Console PIN settings', 'Settings');
    } catch (err) {
      alert('Saved locally. Cloud sync warning: ' + err.message);
    }
  };

  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    if (!newAnn.title.trim() || !newAnn.imageUrl.trim()) return;
    if (announcements.length >= MAX_ANNOUNCEMENTS) {
      alert(`Maximum of ${MAX_ANNOUNCEMENTS} announcements allowed in the carousel. Delete one first.`);
      return;
    }
    const created = {
      id: 'ann_' + Date.now(),
      title: newAnn.title.trim(),
      body: newAnn.body.trim(),
      imageUrl: newAnn.imageUrl.trim(),
      ctaLabel: newAnn.ctaLabel.trim() || 'Learn More',
      ctaUrl: newAnn.ctaUrl.trim() || '#'
    };

    if (isSupabaseConfigured && supabase) {
      const { data: savedAnn } = await supabase
        .from('announcements')
        .insert({
          title: created.title,
          body: created.body,
          image_url: created.imageUrl,
          cta_label: created.ctaLabel,
          cta_url: created.ctaUrl
        })
        .select()
        .single();
      if (savedAnn) created.id = savedAnn.id;
    }

    setAnnouncements((prev) => [created, ...prev].slice(0, MAX_ANNOUNCEMENTS));
    logAdminAction('Published dashboard announcement', created.title);
    setNewAnn({ title: '', body: '', imageUrl: '', ctaLabel: 'Register Now', ctaUrl: '' });
  };

  const handleExportResultsCsv = (rowsToExport, sittingTitle) => {
    const header = 'Rank,Candidate Name,Institution,Department,Exam Sitting,Score (%),Finish Time (Secs)';
    const body = rowsToExport
      .map(
        (r, i) =>
          `${i + 1},"${r.name}","${r.institution || 'Nigeria'}","${r.dept}","${
            r.sittingTitle || sittingTitle
          }",${r.score},${r.timeSecs}`
      )
      .join('\n');
    const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aia_results_${(sittingTitle || 'all').toLowerCase().replace(/\s+/g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ---------------------------------------------------------------- LIVE SITTINGS
  const adminPinValue = String(platformConfig?.adminPin || '2026').trim();
  // Server time right now = this device's clock + the gap we measured from the server
  const serverNow = clockNow + serverOffsetMs;

  const callAdminRpc = async (fn, args = {}) => {
    if (!isSupabaseConfigured || !supabase) {
      throw new Error('Live Sittings needs the cloud database (Supabase) to be connected.');
    }
    const { data, error } = await supabase.rpc(fn, { p_pin: adminPinValue, ...args });
    if (error) throw new Error(error.message || 'The request failed.');
    return data;
  };

  const loadLiveSessions = async (silent = false) => {
    if (!silent) setLiveLoading(true);
    try {
      const data = await callAdminRpc('admin_list_sessions', { p_status: null });
      setLiveSessions(Array.isArray(data?.sessions) ? data.sessions : []);
      if (data?.server_now) {
        const serverMs = new Date(data.server_now).getTime();
        if (!Number.isNaN(serverMs)) setServerOffsetMs(serverMs - Date.now());
      }
      setLiveError('');
    } catch (err) {
      setLiveError(err.message || 'Could not load live sittings.');
    } finally {
      if (!silent) setLiveLoading(false);
    }
  };

  // Load once when the console opens (so the Locked badge shows)
  useEffect(() => {
    if (!isUnlocked) return;
    loadLiveSessions(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, adminPinValue]);

  // Poll every 10 seconds ONLY while the Live Sittings tab is open. Tick the clock every second.
  useEffect(() => {
    if (!isUnlocked || activeNav !== 'live') return undefined;
    loadLiveSessions(true);
    setClockNow(Date.now());
    const poll = setInterval(() => loadLiveSessions(true), 10000);
    const clock = setInterval(() => setClockNow(Date.now()), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnlocked, activeNav, adminPinValue]);

  // Seconds left. Active = counts down from ends_at. Locked/finished = frozen value from the server.
  const getRemainingSecs = (s) => {
    if (s.status === 'ACTIVE' && s.ends_at) {
      const endMs = new Date(s.ends_at).getTime();
      if (!Number.isNaN(endMs)) return Math.max(0, Math.floor((endMs - serverNow) / 1000));
    }
    return Math.max(0, Number(s.remaining_seconds ?? 0));
  };

  // "Time over, not submitted"
  const isTimeOver = (s) => {
    if (s.status === 'ACTIVE') return getRemainingSecs(s) <= 0;
    if (s.status === 'LOCKED') {
      return s.remaining_seconds !== null && s.remaining_seconds !== undefined && Number(s.remaining_seconds) <= 0;
    }
    return false;
  };

  const sessionLabel = (s) => `${s.student_name} • ${s.sitting_title}`;

  const runSessionAction = async (s, work) => {
    setActionBusyId(s.id);
    setLiveError('');
    try {
      await work();
    } catch (err) {
      setLiveError(err.message || 'That action failed.');
    } finally {
      setActionBusyId(null);
    }
  };

  const openReadmitModal = (s) => {
    setLiveError('');
    setReadmitTarget(s);
    setReadmitExtra('0');
    setReadmitNote('');
  };

  const handleConfirmReadmit = async () => {
    const s = readmitTarget;
    if (!s) return;
    const extraMins = Math.max(0, Number(readmitExtra) || 0);
    await runSessionAction(s, async () => {
      await callAdminRpc('admin_readmit_session', {
        p_id: s.id,
        p_extra_seconds: Math.round(extraMins * 60),
        p_note: readmitNote.trim() || null
      });
      setReadmitTarget(null);
      await loadLiveSessions(true);
      showCopyToast('Re-admitted. They can press Resume now.');
      logAdminAction('Re-admitted student', sessionLabel(s));
    });
  };

  const handleSubmitScriptNow = async (s) => {
    if (
      !window.confirm(
        `Submit ${s.student_name}'s script for "${s.sitting_title}" now?\n\nIt will be marked with the answers saved so far, and added to the results.`
      )
    ) {
      return;
    }
    await runSessionAction(s, async () => {
      const full = await callAdminRpc('admin_get_session', { p_id: s.id });
      const row = full?.session;
      if (!row) throw new Error('Could not load this script from the server.');

      const questions = Array.isArray(row.questions_json) ? row.questions_json : [];
      const answers =
        row.answers_json && typeof row.answers_json === 'object' && !Array.isArray(row.answers_json)
          ? row.answers_json
          : {};

      const totalQuestions = questions.length || Number(s.total) || 0;
      const correctCount = questions.filter((q) => answers[q.id] === q.correctIndex).length;
      const percentage = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
      const durationSeconds = Number(row.duration_seconds ?? s.duration_seconds) || 0;
      const remainingSeconds = row.remaining_seconds ?? s.remaining_seconds;
      const timeSpentSeconds = Math.max(1, durationSeconds - Math.max(0, Number(remainingSeconds ?? 0)));

      const sittingIdRaw = row.sitting_id || s.sitting_id || '';
      const email = row.email || s.email || '';
      const studentName = row.student_name || s.student_name;
      const department = row.department || s.department || 'General';
      const sittingTitle = row.sitting_title || s.sitting_title;
      const mode = row.mode || s.mode;

      // Institution is not on the session, so reuse it from this student's earlier results if we have it
      const knownRow = standings.find(
        (r) => String(r.email || '').toLowerCase() === String(email).toLowerCase() && r.institution
      );
      const institution = row.institution || row.config_json?.institution || knownRow?.institution || '';

      const { data: saved, error: insertError } = await supabase
        .from('exam_results')
        .insert({
          user_id: row.user_id,
          email,
          student_name: studentName,
          institution,
          department,
          sitting_id: String(sittingIdRaw).startsWith('combo__') ? null : sittingIdRaw || null,
          mode,
          title: sittingTitle,
          total_questions: totalQuestions,
          correct_count: correctCount,
          percentage,
          time_spent_seconds: timeSpentSeconds,
          answers_json: answers,
          questions_json: questions
        })
        .select()
        .single();

      if (insertError) {
        throw new Error('Could not save the result, so the script was NOT submitted. ' + insertError.message);
      }

      // Show it in Results straight away (only if this student has no entry for this exam yet)
      const emailKey = String(email).toLowerCase();
      const sitKey = String(sittingIdRaw);
      setStandings((prev) => {
        const alreadyThere = prev.some(
          (r) => String(r.sittingId) === sitKey && String(r.email || '').toLowerCase() === emailKey
        );
        if (alreadyThere) return prev;
        const entry = {
          id: saved?.id || 'res_' + Date.now(),
          name: studentName,
          email,
          institution,
          dept: department,
          sittingId: sittingIdRaw,
          sittingTitle,
          mode,
          score: percentage,
          timeSecs: timeSpentSeconds
        };
        return [...prev, entry].sort((a, b) =>
          b.score !== a.score ? b.score - a.score : a.timeSecs - b.timeSecs
        );
      });

      await callAdminRpc('admin_mark_submitted', { p_id: s.id });
      await loadLiveSessions(true);
      showCopyToast(`Submitted ${studentName}'s script: ${correctCount}/${totalQuestions} (${percentage}%).`);
      logAdminAction('Submitted locked script', sessionLabel(s));
    });
  };

  const handleCancelAttempt = async (s) => {
    if (
      !window.confirm(
        `Cancel ${s.student_name}'s attempt on "${s.sitting_title}"?\n\nWARNING: they lose this attempt and will need a NEW access code to try again. This cannot be undone.`
      )
    ) {
      return;
    }
    await runSessionAction(s, async () => {
      await callAdminRpc('admin_cancel_session', { p_id: s.id });
      await loadLiveSessions(true);
      showCopyToast('Attempt cancelled.');
      logAdminAction('Cancelled exam attempt', sessionLabel(s));
    });
  };

  const handleLockNow = async (s) => {
    if (
      !window.confirm(
        `Lock ${s.student_name}'s exam "${s.sitting_title}" right now?\n\nThey will be stopped at once. You can re-admit them later.`
      )
    ) {
      return;
    }
    await runSessionAction(s, async () => {
      await callAdminRpc('admin_lock_session', { p_id: s.id });
      await loadLiveSessions(true);
      showCopyToast('Exam locked.');
      logAdminAction('Locked active exam', sessionLabel(s));
    });
  };

  // ---------------------------------------------------------------- DERIVED DATA
  const questionCountByCourse = useMemo(() => {
    const counts = {};
    bankQuestions.forEach((q) => {
      counts[q.courseId] = (counts[q.courseId] || 0) + 1;
    });
    return counts;
  }, [bankQuestions]);

  const distinctSubjectCategories = useMemo(
    () => ['ALL', ...Array.from(new Set(courses.map((c) => c.category || 'General / UTME')))],
    [courses]
  );

  const organizedCourses = useMemo(
    () =>
      [...courses]
        .filter((c) => {
          const matchesCat =
            subjectCategoryFilter === 'ALL' || (c.category || 'General / UTME') === subjectCategoryFilter;
          const matchesSearch =
            c.code.toLowerCase().includes(subjectSearch.toLowerCase()) ||
            c.name.toLowerCase().includes(subjectSearch.toLowerCase());
          return matchesCat && matchesSearch;
        })
        .sort((a, b) => a.code.localeCompare(b.code)),
    [courses, subjectCategoryFilter, subjectSearch]
  );

  const aggregatedCandidates = useMemo(() => {
    const map = new Map();
    standings.forEach((row) => {
      const key = (row.email || row.name || '').toLowerCase().trim();
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, {
          name: row.name,
          email: row.email || '',
          institution: row.institution || 'Lagos State University (LASU / LASUCOM)',
          dept: row.dept || 'General',
          attempts: 0,
          totalScore: 0,
          bestScore: 0,
          fastestSecs: row.timeSecs || 0
        });
      }
      const entry = map.get(key);
      entry.attempts += 1;
      entry.totalScore += Number(row.score || 0);
      if (Number(row.score || 0) > entry.bestScore) entry.bestScore = Number(row.score || 0);
      if (row.timeSecs && row.timeSecs < entry.fastestSecs) entry.fastestSecs = row.timeSecs;
    });
    return Array.from(map.values()).sort((a, b) => b.bestScore - a.bestScore);
  }, [standings]);

  // ---------------------------------------------------------------- LOGIN SCREEN
  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-[#f5f3ef] text-zinc-900 flex items-center justify-center p-4">
        <div className="max-w-sm w-full bg-white border border-zinc-200/90 rounded-3xl p-8 shadow-xl space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <AiaLogo className="h-7" />
              <span className="block text-[10px] font-mono tracking-[0.22em] uppercase text-zinc-400 mt-1">
                ORGANISER
              </span>
            </div>
            <span className="text-[11px] font-mono px-2.5 py-1 rounded-lg bg-orange-500/10 text-orange-600 font-bold">
              /admin
            </span>
          </div>

          <div className="grid grid-cols-2 p-1 rounded-xl bg-zinc-100 text-xs font-bold">
            {[
              ['email', 'Organiser Login'],
              ['pin', 'Quick PIN']
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setLoginMethod(id);
                  setPinError('');
                }}
                className={`py-2 rounded-lg ${
                  loginMethod === id ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {pinError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">{pinError}</p>
          )}

          <form onSubmit={handleAdminUnlock} className="space-y-4">
            {loginMethod === 'email' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Organiser Email</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:border-orange-600"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Password or Console PIN
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="Enter password or PIN..."
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs focus:outline-none focus:border-orange-600"
                    />
                  </div>
                </div>
              </>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5">Organiser Quick PIN</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    placeholder="••••"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-sm font-mono focus:outline-none focus:border-orange-600"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-3 rounded-xl bg-[#d9531e] hover:bg-orange-600 text-white font-semibold text-xs uppercase tracking-wider"
            >
              {authLoading ? 'Verifying...' : 'Open Organiser Console'}
            </button>
          </form>

          <a
            href="/"
            className="block text-center text-xs text-zinc-500 hover:text-zinc-900 pt-2 border-t border-zinc-100"
          >
            ← Back to Student Portal
          </a>
        </div>
      </div>
    );
  }

  const activeSittings = sittings.filter((s) => s.status !== 'ARCHIVED');
  const archivedSittings = sittings.filter((s) => s.status === 'ARCHIVED');
  const openSittingsCount = activeSittings.filter((s) => s.status === 'OPEN').length;

  // Mocks that can own dedicated questions: active, non-combo (Official Mocks and Speed Drills)
  const mockTargetOptions = activeSittings.filter((s) => s.mode !== 'BUNDLED');
  const mockLabel = (s) => `${s.title} (${s.mode === 'PRACTICE' ? 'Speed Drill' : 'Official Mock'})`;
  const sittingTitleById = (id) =>
    sittings.find((s) => String(s.id) === String(id))?.title || '';
  const selectedCsvSitting = selectedCsvSittingId
    ? sittings.find((s) => String(s.id) === String(selectedCsvSittingId))
    : null;
  const selectedManualSitting = newQ.sittingId
    ? sittings.find((s) => String(s.id) === String(newQ.sittingId))
    : null;

  // Mock filter for the question bank list: active mocks, plus any (even archived) that already own questions
  const bankMockOptions = sittings.filter(
    (s) =>
      s.mode !== 'BUNDLED' &&
      (s.status !== 'ARCHIVED' || (questionCountBySitting[String(s.id)] || 0) > 0)
  );
  const sharedQuestionCount = bankQuestions.filter((q) => !q.sittingId).length;

  const availableCodes = accessCodes.filter((c) => c.status === 'LIVE');
  const issuedCodes = accessCodes.filter((c) => c.status === 'ISSUED');
  const usedCodes = accessCodes.filter((c) => c.status === 'USED');
  const liveCodesCount = availableCodes.length;

  const singleExamOptions = activeSittings.filter((s) => s.mode !== 'BUNDLED');
  const comboExamOptions = activeSittings.filter((s) => s.mode === 'BUNDLED');
  const customComboPool = activeSittings.filter((s) => s.mode !== 'BUNDLED' && s.mode !== 'PRACTICE');

  const codeGenPrice = (() => {
    if (codeGenForm.scope === 'EXAM') {
      const sit = sittings.find((s) => String(s.id) === String(codeGenForm.examId));
      return sit ? Number(sit.priceNaira) || 0 : 0;
    }
    if (codeGenForm.scope === 'CUSTOM') {
      return codeGenForm.comboIds.reduce((sum, id) => {
        const sit = sittings.find((s) => String(s.id) === String(id));
        return sum + (sit ? Number(sit.priceNaira) || 0 : 0);
      }, 0);
    }
    return 0;
  })();

  const displayedSittings = (sittingLifecycleTab === 'archived' ? archivedSittings : activeSittings).filter(
    (sit) => {
      const matchesCat =
        sittingCategoryFilter === 'ALL' ||
        sit.mode === sittingCategoryFilter ||
        (Array.isArray(sit.allowedModes) && sit.allowedModes.includes(sittingCategoryFilter));
      const matchesQuery =
        sit.title.toLowerCase().includes(sittingSearch.toLowerCase()) ||
        (sit.targetCourse || '').toLowerCase().includes(sittingSearch.toLowerCase());
      return matchesCat && matchesQuery;
    }
  );

  const ITEMS_PER_PAGE = 6;
  const filteredQuestions = bankQuestions.filter((q) => {
    const matchesCourse = bankCourseFilter === 'ALL' || q.courseId === bankCourseFilter;
    const matchesMock =
      bankSittingFilter === 'ALL' ||
      (bankSittingFilter === 'SHARED' && !q.sittingId) ||
      (bankSittingFilter !== 'SHARED' && String(q.sittingId || '') === String(bankSittingFilter));
    const matchesText =
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCourse && matchesMock && matchesText;
  });
  const totalBankPages = Math.max(1, Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE));
  const paginatedQuestions = filteredQuestions.slice(
    bankPage * ITEMS_PER_PAGE,
    (bankPage + 1) * ITEMS_PER_PAGE
  );

  // Results: release controls only work when ONE exam is picked
  const selectedResultSitting =
    resultsSittingFilter === 'ALL'
      ? null
      : sittings.find((s) => String(s.id) === String(resultsSittingFilter)) || null;

  const resultsForSelectedSitting = standings
    .filter((r) => {
      const matchesSit =
        resultsSittingFilter === 'ALL' || String(r.sittingId) === String(resultsSittingFilter);
      const matchesDept = resultsDeptFilter === 'ALL' || r.dept === resultsDeptFilter;
      const matchesSearch =
        r.name.toLowerCase().includes(resultsCandidateSearch.toLowerCase()) ||
        (r.dept || '').toLowerCase().includes(resultsCandidateSearch.toLowerCase()) ||
        (r.institution || '').toLowerCase().includes(resultsCandidateSearch.toLowerCase());
      return matchesSit && matchesDept && matchesSearch;
    })
    .sort((a, b) => (b.score !== a.score ? b.score - a.score : a.timeSecs - b.timeSecs));

  const RESULTS_PER_PAGE = 10;
  const totalResultPages = Math.max(1, Math.ceil(resultsForSelectedSitting.length / RESULTS_PER_PAGE));
  const paginatedResultsRows = resultsForSelectedSitting.slice(
    resultsPage * RESULTS_PER_PAGE,
    (resultsPage + 1) * RESULTS_PER_PAGE
  );

  const passMarkInView = selectedResultSitting?.passMark || 50;
  const highestScoreInView =
    resultsForSelectedSitting.length > 0 ? Math.max(...resultsForSelectedSitting.map((r) => r.score)) : 0;
  const avgScoreInView =
    resultsForSelectedSitting.length > 0
      ? Math.round(
          resultsForSelectedSitting.reduce((acc, r) => acc + r.score, 0) / resultsForSelectedSitting.length
        )
      : 0;
  const passCountInView = resultsForSelectedSitting.filter((r) => r.score >= passMarkInView).length;

  // Live Sittings groups
  const lockedSessions = liveSessions.filter((s) => s.status === 'LOCKED');
  const activeLiveSessions = liveSessions.filter((s) => s.status === 'ACTIVE');
  const finishedSessions = liveSessions.filter((s) => s.status === 'SUBMITTED' || s.status === 'CANCELLED');
  const lockedCount = lockedSessions.length;

  const liveExamOptions = (() => {
    const seen = new Map();
    liveSessions.forEach((s) => {
      if (s.sitting_id && !seen.has(String(s.sitting_id))) {
        seen.set(String(s.sitting_id), s.sitting_title || String(s.sitting_id));
      }
    });
    return Array.from(seen.entries()).map(([id, title]) => ({ id, title }));
  })();

  const liveCurrentPool =
    liveTab === 'locked' ? lockedSessions : liveTab === 'active' ? activeLiveSessions : finishedSessions;
  const liveQuery = liveSearch.trim().toLowerCase();
  const liveFiltered = liveCurrentPool.filter((s) => {
    const matchesExam = liveExamFilter === 'ALL' || String(s.sitting_id) === String(liveExamFilter);
    const matchesText =
      !liveQuery ||
      String(s.student_name || '').toLowerCase().includes(liveQuery) ||
      String(s.email || '').toLowerCase().includes(liveQuery);
    return matchesExam && matchesText;
  });

  const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'sittings', label: `Exams & Sittings (${activeSittings.length})`, icon: CalendarClock },
    { id: 'live', label: 'Live Sittings', icon: Activity, badge: lockedCount },
    { id: 'bank', label: `Subjects & CSV (${courses.length})`, icon: BookOpen },
    { id: 'codes', label: `Access Codes (${liveCodesCount})`, icon: KeyRound },
    { id: 'candidates', label: `Candidates (${aggregatedCandidates.length})`, icon: Users },
    { id: 'results', label: 'Results & Release', icon: Trophy },
    {
      id: 'announcements',
      label: `Announcements (${announcements.length}/${MAX_ANNOUNCEMENTS})`,
      icon: Megaphone
    },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'audit', label: 'Audit log', icon: History },
    { id: 'team', label: 'Team', icon: UserCheck }
  ];

  const isComboForm = sittingForm.mode === 'BUNDLED';
  const isSpeedForm = sittingForm.mode === 'PRACTICE';
  const formSecsPerQ =
    Number(sittingForm.durationMins) > 0 && Number(sittingForm.questionCount) > 0
      ? Math.round((Number(sittingForm.durationMins) * 60) / Number(sittingForm.questionCount))
      : 0;

  // Questions inside the Create / Edit Exam window
  // formOwnMode = this exam has (or is about to get) its own questions
  const formDedicatedCount =
    editingSittingId && !isComboForm ? questionCountBySitting[String(editingSittingId)] || 0 : 0;
  const formOwnMode = !isComboForm && (formDedicatedCount > 0 || modalQSource === 'DEDICATED');
  const pendingModalQs = formOwnMode ? modalCsvRows.length : 0;
  const formOwnTotal = formDedicatedCount + pendingModalQs;
  const formPoolSize = formOwnMode
    ? formOwnTotal
    : sittingForm.allowedCourses.length > 0
    ? bankQuestions.filter((q) => !q.sittingId && sittingForm.allowedCourses.includes(q.courseId)).length
    : bankQuestions.filter((q) => !q.sittingId).length;

  const subjectHelperText = isComboForm
    ? sittingForm.allowedCourses.length === 0
      ? 'None picked: the combo uses the whole shared bank.'
      : 'Each picked subject becomes a tab with its own questions.'
    : sittingForm.allowedCourses.length === 0
    ? 'None picked: this exam would draw from the ENTIRE shared bank. Pick the subjects it should use.'
    : `${formPoolSize} shared-bank questions available from these subjects.`;

  const subjectPickerEl = (
    <div className="space-y-2 pt-1">
      <div className="flex items-center justify-between gap-3">
        <span
          className={`text-[11px] ${
            !isComboForm && sittingForm.allowedCourses.length === 0 ? 'text-red-600 font-semibold' : 'text-zinc-500'
          }`}
        >
          {subjectHelperText}
        </span>
        <input
          type="text"
          value={modalSubjectSearch}
          onChange={(e) => setModalSubjectSearch(e.target.value)}
          placeholder="Search subjects..."
          className="px-2.5 py-1 rounded-lg bg-white border border-zinc-200 text-xs w-44 flex-shrink-0"
        />
      </div>

      <div className="max-h-36 overflow-y-auto p-3 rounded-xl bg-white border border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {[...courses]
          .sort((a, b) => a.code.localeCompare(b.code))
          .filter(
            (c) =>
              c.code.toLowerCase().includes(modalSubjectSearch.toLowerCase()) ||
              c.name.toLowerCase().includes(modalSubjectSearch.toLowerCase())
          )
          .map((c) => {
            const checked = sittingForm.allowedCourses.includes(c.id);
            return (
              <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() =>
                    setSittingForm((prev) => ({
                      ...prev,
                      allowedCourses: checked
                        ? prev.allowedCourses.filter((id) => id !== c.id)
                        : [...prev.allowedCourses, c.id]
                    }))
                  }
                />
                <span className="truncate">
                  <strong>{c.code}</strong> — {c.name}{' '}
                  <span className="text-zinc-400">({questionCountByCourse[c.id] || 0})</span>
                </span>
              </label>
            );
          })}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-zinc-900 flex flex-col md:flex-row font-sans">
      {copyToast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[70] px-5 py-3 rounded-2xl bg-zinc-900 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 max-w-[92vw]">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{copyToast}</span>
        </div>
      )}

      <aside className="w-full md:w-64 bg-[#fbfaf8] border-b md:border-b-0 md:border-r border-zinc-200/80 p-5 flex flex-col justify-between flex-shrink-0">
        <div className="space-y-6">
          <div className="px-2 flex items-center justify-between">
            <div>
              <AiaLogo className="h-7" />
              <span className="block text-[10px] font-mono tracking-[0.24em] uppercase text-zinc-500 mt-1 font-semibold">
                ORGANISER
              </span>
            </div>
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                isSupabaseConfigured
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              <Database className="w-3 h-3" />
              {isSupabaseConfigured ? 'CLOUD' : 'LOCAL'}
            </span>
          </div>

          <nav className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = activeNav === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveNav(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-medium ${
                    isActive
                      ? 'bg-[#efece6] text-zinc-950 font-semibold shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                  }`}
                >
                  <Icon className="w-4 h-4 text-zinc-700" />
                  <span>{item.label}</span>
                  {item.badge > 0 && (
                    <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-[#d9531e] text-white text-[10px] font-mono font-bold flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="pt-6 border-t border-zinc-200/80 space-y-3 px-2 mt-6">
          <p className="text-xs text-zinc-500 truncate">{platformConfig.organiserEmail}</p>
          <div className="flex items-center justify-between">
            <a
              href="/"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-orange-600 hover:underline"
            >
              <span>Student View</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
            <button
              onClick={() => {
                sessionStorage.removeItem('aia_admin_unlocked');
                setIsUnlocked(false);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 hover:text-red-600"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6 sm:p-10 max-w-6xl w-full mx-auto space-y-8 overflow-y-auto">
        {/* ============================ 1. OVERVIEW ============================ */}
        {activeNav === 'overview' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-serif font-normal tracking-tight text-zinc-900">Overview</h1>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                  Create exams and combos, issue exam-specific codes, control result releases and share direct links.
                </p>
              </div>
              <div className="flex items-center gap-3 self-start flex-wrap">
                <button
                  onClick={() => setActiveNav('results')}
                  className="px-4 py-2.5 rounded-full bg-white border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-2 shadow-sm"
                >
                  <Trophy className="w-3.5 h-3.5 text-orange-600" />
                  <span>Release Results</span>
                </button>
                <button
                  onClick={() => setActiveNav('codes')}
                  className="px-4 py-2.5 rounded-full bg-white border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-2 shadow-sm"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>Issue Codes</span>
                </button>
                <button
                  onClick={openCreateSittingModal}
                  className="px-5 py-2.5 rounded-full bg-[#d9531e] hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>New exam sitting</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Live exams', openSittingsCount, `${archivedSittings.length} archived`],
                ['1st-Try Submissions', standings.length, 'verified rankings'],
                [
                  'Candidates',
                  aggregatedCandidates.length,
                  `${liveCodesCount} available codes • ${issuedCodes.length} issued`
                ],
                ['Question bank', bankQuestions.length, `${courses.length} subjects`]
              ].map(([label, value, sub]) => (
                <div
                  key={label}
                  className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-2"
                >
                  <span className="text-xs text-zinc-500 font-medium block">{label}</span>
                  <p className="text-3xl font-bold font-mono">{value}</p>
                  <span className="text-xs text-zinc-400 block">{sub}</span>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm">Active Exams (Quick Share & Release Status)</h2>
                  <p className="text-xs text-zinc-400">
                    Copy the strict exam URL or use Share to broadcast to candidates on WhatsApp.
                  </p>
                </div>
                <button
                  onClick={() => setActiveNav('sittings')}
                  className="text-xs font-semibold text-orange-600 hover:underline"
                >
                  Manage All Exams →
                </button>
              </div>

              <div className="divide-y divide-zinc-100">
                {activeSittings.slice(0, 6).map((sit) => {
                  const relMode = sit.releaseMode || (sit.resultsReleased === false ? 'HELD' : 'INSTANT');
                  const dedicatedQs = questionCountBySitting[String(sit.id)] || 0;
                  return (
                    <div
                      key={sit.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded bg-orange-500/10 text-orange-600 flex-shrink-0">
                          {sit.mode}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-zinc-900">{sit.title}</span>
                            <span
                              className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                                relMode === 'INSTANT'
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : relMode === 'SCHEDULED'
                                  ? 'bg-amber-50 text-amber-700'
                                  : 'bg-zinc-100 text-zinc-600'
                              }`}
                            >
                              {relMode === 'INSTANT'
                                ? 'Results: Instant'
                                : relMode === 'SCHEDULED'
                                ? 'Results: Scheduled'
                                : 'Results: Held'}
                            </span>
                            {sit.mode !== 'BUNDLED' && (
                              <span
                                className={`font-mono text-[10px] px-2 py-0.5 rounded font-bold ${
                                  dedicatedQs > 0
                                    ? 'bg-teal-100 text-teal-800'
                                    : 'bg-zinc-100 text-zinc-500'
                                }`}
                              >
                                {dedicatedQs > 0 ? `${dedicatedQs} dedicated Qs` : 'Shared bank'}
                              </span>
                            )}
                          </div>
                          <span className="text-zinc-500">
                            {sit.mode === 'BUNDLED'
                              ? getComboSubjectsLine(sit) || 'Combo'
                              : `${sit.questionCount} Qs`}{' '}
                            • {formatMins(sit.durationMins)}
                            {sit.mode === 'PRACTICE' ? '' : ` • Max Leaves: ${sit.maxTabSwitches || 3}`} •{' '}
                            {sit.requiresCode && sit.priceNaira > 0
                              ? `₦${sit.priceNaira.toLocaleString()}`
                              : Number(sit.retakePriceNaira || 0) > 0
                              ? `1st Free (Retake ₦${Number(sit.retakePriceNaira).toLocaleString()})`
                              : 'Free Open'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleCopyExamShareLink(sit)}
                          className="px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 font-semibold flex items-center gap-1.5 hover:bg-orange-100"
                        >
                          {copiedShareId === sit.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>URL Copied!</span>
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNativeShareExamLink(sit)}
                          className="px-2.5 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 font-semibold flex items-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Share</span>
                        </button>
                        <button
                          onClick={() => openEditSittingModal(sit)}
                          className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 font-semibold"
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ============================ 2. EXAMS & SITTINGS ============================ */}
        {activeNav === 'sittings' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Exams & Sittings Manager</h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Speed Drills, Official Mocks and Combos are all created here. You can upload an exam's own questions right inside the Create Exam window.
                </p>
              </div>
              <button
                onClick={openCreateSittingModal}
                className="px-5 py-2.5 rounded-full bg-[#d9531e] hover:bg-orange-600 text-white text-xs font-semibold flex items-center gap-1.5 self-start"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Exam</span>
              </button>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-zinc-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setSittingLifecycleTab('active')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                    sittingLifecycleTab === 'active' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  Active Exams ({activeSittings.length})
                </button>
                <button
                  onClick={() => setSittingLifecycleTab('archived')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                    sittingLifecycleTab === 'archived' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  <Archive className="w-3.5 h-3.5" />
                  <span>Archived ({archivedSittings.length})</span>
                </button>

                <div className="h-4 w-[1px] bg-zinc-200 mx-1 hidden sm:block" />

                {['ALL', 'PRACTICE', 'OFFICIAL', 'BUNDLED'].map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setSittingCategoryFilter(cat)}
                    className={`px-3 py-1 rounded-lg text-[11px] font-mono font-bold ${
                      sittingCategoryFilter === cat
                        ? 'bg-orange-600 text-white'
                        : 'bg-zinc-50 text-zinc-500 hover:text-zinc-900'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <div className="relative w-full lg:w-64">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={sittingSearch}
                  onChange={(e) => setSittingSearch(e.target.value)}
                  placeholder="Search exam or course..."
                  className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs"
                />
              </div>
            </div>

            <div className="space-y-4">
              {displayedSittings.map((sit) => {
                const relMode = sit.releaseMode || (sit.resultsReleased === false ? 'HELD' : 'INSTANT');
                const isSpeed = sit.mode === 'PRACTICE';
                const isCombo = sit.mode === 'BUNDLED';
                const comboFromExams = (sit.comboSittingIds || []).length > 1;
                const dedicatedQs = questionCountBySitting[String(sit.id)] || 0;

                return (
                  <div
                    key={sit.id}
                    className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-600">
                            {sit.mode}
                          </span>
                          <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded bg-teal-500/10 text-teal-700">
                            Course: {sit.targetCourse || 'All Courses'}
                          </span>
                          {!isCombo && (
                            <span
                              className={`font-mono text-[10px] font-bold px-2.5 py-0.5 rounded ${
                                dedicatedQs > 0
                                  ? 'bg-teal-100 text-teal-800'
                                  : 'bg-zinc-100 text-zinc-500'
                              }`}
                              title={
                                dedicatedQs > 0
                                  ? 'This mock uses only its own uploaded questions.'
                                  : 'This mock draws from the shared course bank.'
                              }
                            >
                              {dedicatedQs > 0 ? `${dedicatedQs} dedicated Qs` : 'Shared bank'}
                            </span>
                          )}
                          <h3 className="font-bold text-base text-zinc-900">{sit.title}</h3>
                        </div>
                        <p className="text-xs text-zinc-500">{sit.description}</p>
                        {isCombo && (
                          <p className="text-[11px] text-teal-700 font-semibold flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5" />
                            <span>{getComboSubjectsLine(sit) || 'No exams linked yet. Edit to add them.'}</span>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        {!isCombo && (
                          <button
                            type="button"
                            onClick={() => goAddQuestions(sit)}
                            className="px-3 py-1.5 rounded-xl bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold flex items-center gap-1.5 hover:bg-teal-100"
                            title="Upload or add questions that belong only to this exam"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                            <span>Add questions</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleCopyExamShareLink(sit)}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold flex items-center gap-1.5 hover:bg-orange-100"
                        >
                          {copiedShareId === sit.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span>Copied URL!</span>
                            </>
                          ) : (
                            <>
                              <Link2 className="w-3.5 h-3.5" />
                              <span>Copy Link</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleNativeShareExamLink(sit)}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-1"
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Share</span>
                        </button>

                        <select
                          value={sit.status}
                          onChange={(e) => handleUpdateSitting(sit.id, { status: e.target.value })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border ${
                            sit.status === 'OPEN'
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : sit.status === 'ARCHIVED'
                              ? 'bg-zinc-200 border-zinc-300 text-zinc-700'
                              : 'bg-amber-50 border-amber-200 text-amber-700'
                          }`}
                        >
                          <option value="OPEN">OPEN (Live)</option>
                          <option value="PAUSED">PAUSED</option>
                          <option value="DRAFT">DRAFT</option>
                          <option value="CLOSED">CLOSED</option>
                          <option value="ARCHIVED">ARCHIVED</option>
                        </select>

                        <button
                          type="button"
                          onClick={() => openEditSittingModal(sit)}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-1"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDuplicateSitting(sit)}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-1"
                        >
                          <Files className="w-3.5 h-3.5" />
                          <span>Clone</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleArchiveSitting(sit)}
                          className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-1 text-zinc-600"
                        >
                          {sit.status === 'ARCHIVED' ? (
                            <>
                              <RotateCcw className="w-3.5 h-3.5" />
                              <span>Restore</span>
                            </>
                          ) : (
                            <>
                              <Archive className="w-3.5 h-3.5" />
                              <span>Archive</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteSitting(sit)}
                          className="p-2 rounded-xl border border-red-200 bg-red-50/60 text-red-600 hover:bg-red-100"
                          title="Delete Exam Permanently"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3 text-xs">
                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">1st Try Price (₦)</label>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={sit.priceNaira ?? 0}
                          onChange={(e) => handleUpdateSitting(sit.id, { priceNaira: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">2nd Try Retake (₦)</label>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={sit.retakePriceNaira ?? 0}
                          onChange={(e) =>
                            handleUpdateSitting(sit.id, { retakePriceNaira: Number(e.target.value) })
                          }
                          placeholder="0 = Free"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold text-orange-600"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">Duration (Mins)</label>
                        <input
                          type="number"
                          min={0.1}
                          step="any"
                          value={sit.durationMins}
                          onChange={(e) => handleUpdateSitting(sit.id, { durationMins: Number(e.target.value) })}
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold"
                          title="Use decimals for seconds. E.g. 0.5 = 30 seconds."
                        />
                        <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                          = {formatMins(sit.durationMins)}
                        </span>
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1 truncate">
                          {comboFromExams
                            ? 'Questions'
                            : isCombo
                            ? 'Qs PER Subject'
                            : 'Total Questions'}
                        </label>
                        {comboFromExams ? (
                          <div className="px-3 py-2 rounded-xl bg-zinc-100 border border-zinc-200 font-mono text-[11px] text-zinc-500">
                            From each exam
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={1}
                            value={sit.questionCount || 20}
                            onChange={(e) =>
                              handleUpdateSitting(sit.id, { questionCount: Number(e.target.value) })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">Max Leaves</label>
                        {isSpeed ? (
                          <div className="px-3 py-2 rounded-xl bg-zinc-100 border border-zinc-200 font-mono text-[11px] text-zinc-500">
                            Not used
                          </div>
                        ) : (
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={sit.maxTabSwitches || 3}
                            onChange={(e) =>
                              handleUpdateSitting(sit.id, { maxTabSwitches: Math.max(1, Number(e.target.value)) })
                            }
                            className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold text-teal-700"
                          />
                        )}
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">Result Release</label>
                        {isSpeed ? (
                          <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 font-bold text-[11px] text-emerald-700">
                            Always instant
                          </div>
                        ) : (
                          <select
                            value={relMode}
                            onChange={(e) => {
                              const nextMode = e.target.value;
                              handleUpdateSitting(sit.id, {
                                releaseMode: nextMode,
                                resultsReleased: nextMode === 'INSTANT'
                              });
                            }}
                            className={`w-full px-3 py-2 rounded-xl border font-bold ${
                              relMode === 'INSTANT'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                : relMode === 'SCHEDULED'
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-zinc-100 border-zinc-300 text-zinc-700'
                            }`}
                          >
                            <option value="INSTANT">Show at Once</option>
                            <option value="HELD">Hold (Manual)</option>
                            <option value="SCHEDULED">Scheduled</option>
                          </select>
                        )}
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">1st Try Gate</label>
                        <button
                          type="button"
                          onClick={() => handleUpdateSitting(sit.id, { requiresCode: !sit.requiresCode })}
                          className={`w-full py-2 px-3 rounded-xl font-semibold border flex items-center justify-between ${
                            sit.requiresCode
                              ? 'bg-orange-50 border-orange-200 text-orange-700'
                              : 'bg-zinc-50 border-zinc-200 text-zinc-600'
                          }`}
                        >
                          <span>{sit.requiresCode ? 'Code Locked' : '1st Try Free'}</span>
                          <KeyRound className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ============================ 3. SUBJECTS & CSV ============================ */}
        {activeNav === 'bank' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-base">1. Manage Exam Subjects / Courses</h2>
                  <p className="text-xs text-zinc-500">
                    Organized alphabetically with question counts and faculty filters so your catalog stays clean as it grows.
                  </p>
                </div>
                <span className="font-mono text-xs px-3 py-1 rounded-full bg-orange-500/10 text-orange-600 font-bold self-start">
                  {courses.length} Subjects • {bankQuestions.length} Total Questions
                </span>
              </div>

              <form
                onSubmit={handleCreateCourse}
                className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs p-4 rounded-2xl bg-zinc-50 border border-zinc-200/80"
              >
                <input
                  required
                  placeholder="Code (e.g. ANA 201 or ENG 101)"
                  value={newCourse.code}
                  onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200 font-mono uppercase"
                />
                <input
                  required
                  placeholder="Subject Title (e.g. Anatomy of Upper & Lower Limb)"
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                  className="sm:col-span-2 px-3.5 py-2.5 rounded-xl bg-white border border-zinc-200"
                />
                <div className="flex gap-2">
                  <input
                    placeholder="Category (e.g. Medical / Basic)"
                    value={newCourse.category}
                    onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-white border border-zinc-200"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-[#d9531e] hover:bg-orange-600 text-white font-semibold whitespace-nowrap"
                  >
                    + Add
                  </button>
                </div>
              </form>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {distinctSubjectCategories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSubjectCategoryFilter(cat)}
                      className={`px-3 py-1 rounded-lg text-[11px] font-bold transition-colors ${
                        subjectCategoryFilter === cat
                          ? 'bg-zinc-900 text-white'
                          : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={subjectSearch}
                    onChange={(e) => setSubjectSearch(e.target.value)}
                    placeholder="Filter subjects by code or title..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs"
                  />
                </div>
              </div>

              <div className="max-h-64 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {organizedCourses.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 rounded-xl border border-zinc-200/90 bg-[#fbfaf8] hover:border-orange-400 flex items-center justify-between gap-2 text-xs transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="font-mono text-orange-600">{c.code}</strong>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/80 text-zinc-700 font-bold">
                          {questionCountByCourse[c.id] || 0} Qs
                        </span>
                      </div>
                      <p className="text-zinc-700 font-medium truncate mt-0.5" title={c.name}>
                        {c.name}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(c)}
                      className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600 hover:bg-red-50 flex-shrink-0"
                      title="Delete subject"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">
                      2. Bulk Upload Questions via `.CSV` (Option A–E & True/False)
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Mix 5-option MCQs (A–E), 4-option MCQs (A–D), and True/False questions inside the same `.csv` file.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 self-start"
                >
                  <Download className="w-4 h-4 text-teal-400" />
                  <span>Download 10-Col `.CSV` Template</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs space-y-1.5">
                <span className="font-semibold text-zinc-700 block">Required `.CSV` Columns (in order):</span>
                <p className="font-mono text-[11px] text-orange-600 break-all">
                  course_code , question , option_a , option_b , option_c , option_d , option_e , correct_option (A/B/C/D/E or TRUE/FALSE) , explanation , passage
                </p>
                <p className="text-[11px] text-zinc-500">
                  • <strong>True/False:</strong> put <code>True</code> in <code>option_a</code>, <code>False</code> in{' '}
                  <code>option_b</code>, leave C, D and E blank, and put <code>A</code> or <code>B</code> in{' '}
                  <code>correct_option</code>.
                </p>
              </div>

              {/* Target mock for this upload */}
              <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 space-y-2">
                <label className="block text-xs font-semibold text-teal-800">Target Mock (Optional)</label>
                <select
                  value={selectedCsvSittingId}
                  onChange={(e) => setSelectedCsvSittingId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-teal-200 text-xs font-semibold"
                >
                  <option value="">Shared course bank (any mock using this subject)</option>
                  {mockTargetOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {mockLabel(s)}
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-teal-800 leading-relaxed">
                  {selectedCsvSitting ? (
                    <>
                      Every question in your next upload will belong <strong>only</strong> to{' '}
                      <strong>{selectedCsvSitting.title}</strong>. Other mocks, even with the same subject, will not
                      see them. You do not need to put a mock ID in the CSV file.
                    </>
                  ) : (
                    <>
                      Questions go into the shared course bank. Any mock that has no questions of its own will pick
                      from here.
                    </>
                  )}
                </p>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-zinc-300 hover:border-orange-500 rounded-2xl p-8 text-center cursor-pointer bg-zinc-50/50 hover:bg-orange-500/[0.02]"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleCsvFileSelected}
                  className="hidden"
                />
                <Upload className="w-7 h-7 text-orange-600 mx-auto mb-2" />
                <p className="font-bold text-sm text-zinc-800">
                  {csvFileName ? `Selected File: ${csvFileName}` : 'Click to select a .CSV document from your computer'}
                </p>
                <p className="text-xs text-zinc-400 mt-1">Supports both 10-column (A–E) and 9-column (A–D) `.csv` files</p>
              </div>

              {csvImportSuccess && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{csvImportSuccess}</span>
                </div>
              )}

              {csvErrors.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4" />
                    <span>Skipped {csvErrors.length} invalid row(s):</span>
                  </div>
                  {csvErrors.slice(0, 4).map((err, i) => (
                    <p key={i} className="font-mono text-[11px]">
                      • {err}
                    </p>
                  ))}
                </div>
              )}

              {csvParsedRows.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <span className="text-xs font-bold text-teal-700">
                      Ready to import {csvParsedRows.length} verified question(s) from {csvFileName} into{' '}
                      {selectedCsvSitting ? `"${selectedCsvSitting.title}"` : 'the shared course bank'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={csvImporting}
                        onClick={() => {
                          setCsvParsedRows([]);
                          setCsvFileName('');
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-semibold disabled:opacity-40"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={csvImporting}
                        onClick={handleCommitCsvUpload}
                        className="px-5 py-2 rounded-xl bg-[#d9531e] hover:bg-orange-600 disabled:opacity-60 disabled:cursor-not-allowed text-white text-xs font-bold"
                      >
                        {csvImporting
                          ? 'Importing... please wait'
                          : `Confirm & Import ${csvParsedRows.length} Questions`}
                      </button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-zinc-200 rounded-xl divide-y divide-zinc-100 text-xs">
                    {csvParsedRows.slice(0, 8).map((row, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-orange-600 mr-2">[{row.courseCode}]</span>
                          <span className="font-medium">{row.question}</span>
                          <span className="ml-2 text-[10px] font-mono text-zinc-400">({row.options.length} opts)</span>
                        </div>
                        <span className="font-mono text-[11px] text-teal-700 flex-shrink-0">
                          Ans: {['A', 'B', 'C', 'D', 'E'][row.correctIndex]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-bold text-base">3. Manual Question Entry</h2>
                  <div className="flex p-0.5 rounded-xl bg-zinc-100 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => setNewQType('MCQ')}
                      className={`px-2.5 py-1 rounded-lg ${
                        newQType === 'MCQ' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'
                      }`}
                    >
                      Options (A–E)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNewQType('TF');
                        setNewQ((p) => ({ ...p, correctIndex: 0 }));
                      }}
                      className={`px-2.5 py-1 rounded-lg ${
                        newQType === 'TF' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'
                      }`}
                    >
                      True / False
                    </button>
                  </div>
                </div>

                <form onSubmit={handleCreateQuestion} className="space-y-3 text-xs">
                  <select
                    value={newQ.courseId}
                    onChange={(e) => setNewQ({ ...newQ, courseId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 font-semibold"
                  >
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>

                  <div className="p-3 rounded-xl bg-teal-50/60 border border-teal-200 space-y-1.5">
                    <label className="block font-semibold text-teal-800">Target Mock (Optional)</label>
                    <select
                      value={newQ.sittingId}
                      onChange={(e) => setNewQ({ ...newQ, sittingId: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-teal-200 font-semibold"
                    >
                      <option value="">Shared course bank (any mock using this subject)</option>
                      {mockTargetOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {mockLabel(s)}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-teal-800">
                      {selectedManualSitting
                        ? `This question will belong only to "${selectedManualSitting.title}".`
                        : 'This question goes into the shared course bank.'}
                    </p>
                  </div>

                  <textarea
                    rows={2}
                    value={newQ.passage}
                    onChange={(e) => setNewQ({ ...newQ, passage: e.target.value })}
                    placeholder="Optional clinical vignette or passage..."
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                  />
                  <textarea
                    required
                    rows={2}
                    value={newQ.question}
                    onChange={(e) => setNewQ({ ...newQ, question: e.target.value })}
                    placeholder="Question stem..."
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                  />

                  {newQType === 'TF' ? (
                    <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between">
                      <span className="font-semibold text-zinc-600">Correct Answer:</span>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setNewQ({ ...newQ, correctIndex: 0 })}
                          className={`px-4 py-1.5 rounded-lg font-bold ${
                            newQ.correctIndex === 0 ? 'bg-teal-600 text-white' : 'bg-white border border-zinc-200'
                          }`}
                        >
                          A: True
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewQ({ ...newQ, correctIndex: 1 })}
                          className={`px-4 py-1.5 rounded-lg font-bold ${
                            newQ.correctIndex === 1 ? 'bg-orange-600 text-white' : 'bg-white border border-zinc-200'
                          }`}
                        >
                          B: False
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          required
                          placeholder="Option A (Required)"
                          value={newQ.optionA}
                          onChange={(e) => setNewQ({ ...newQ, optionA: e.target.value })}
                          className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                        />
                        <input
                          required
                          placeholder="Option B (Required)"
                          value={newQ.optionB}
                          onChange={(e) => setNewQ({ ...newQ, optionB: e.target.value })}
                          className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                        />
                        <input
                          placeholder="Option C (Optional)"
                          value={newQ.optionC}
                          onChange={(e) => setNewQ({ ...newQ, optionC: e.target.value })}
                          className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                        />
                        <input
                          placeholder="Option D (Optional)"
                          value={newQ.optionD}
                          onChange={(e) => setNewQ({ ...newQ, optionD: e.target.value })}
                          className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                        />
                        <input
                          placeholder="Option E (Optional 5th Option)"
                          value={newQ.optionE}
                          onChange={(e) => setNewQ({ ...newQ, optionE: e.target.value })}
                          className="col-span-2 px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                        />
                      </div>

                      <select
                        value={newQ.correctIndex}
                        onChange={(e) => setNewQ({ ...newQ, correctIndex: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-semibold"
                      >
                        {['A', 'B', 'C', 'D', 'E'].map((l, i) => (
                          <option key={l} value={i}>
                            Correct: Option {l}
                          </option>
                        ))}
                      </select>
                    </>
                  )}

                  <input
                    placeholder="Explanation / Rationale (Optional)..."
                    value={newQ.explanation}
                    onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                  />

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#d9531e] hover:bg-orange-600 text-white font-semibold"
                  >
                    Save Question to Bank
                  </button>
                </form>
              </div>

              <div className="lg:col-span-7 space-y-4">
                {duplicateQuestionIds.length > 0 && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-2 text-amber-900">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        Found <strong>{duplicateQuestionIds.length}</strong> repeated question(s): same text and
                        options in the same place. This usually happens when an upload is confirmed more than once.
                      </span>
                    </div>
                    <button
                      type="button"
                      disabled={cleaningDupes}
                      onClick={handleRemoveDuplicateQuestions}
                      className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white font-bold flex-shrink-0"
                    >
                      {cleaningDupes ? 'Removing...' : 'Remove repeats'}
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={bankCourseFilter}
                      onChange={(e) => {
                        setBankCourseFilter(e.target.value);
                        setBankPage(0);
                      }}
                      className="px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold max-w-[14rem]"
                    >
                      <option value="ALL">All Subjects ({bankQuestions.length})</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.name} ({questionCountByCourse[c.id] || 0})
                        </option>
                      ))}
                    </select>

                    <select
                      value={bankSittingFilter}
                      onChange={(e) => {
                        setBankSittingFilter(e.target.value);
                        setBankPage(0);
                      }}
                      className="px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold max-w-[14rem]"
                    >
                      <option value="ALL">All Questions ({bankQuestions.length})</option>
                      <option value="SHARED">Shared Bank Only ({sharedQuestionCount})</option>
                      {bankMockOptions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.title} ({questionCountBySitting[String(s.id)] || 0} dedicated)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 flex-1">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Search questions..."
                        value={searchQuery}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setBankPage(0);
                        }}
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <button
                        disabled={bankPage === 0}
                        onClick={() => setBankPage((p) => Math.max(0, p - 1))}
                        className="p-2 rounded-xl bg-white border border-zinc-200 disabled:opacity-40"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-2">
                        {bankPage + 1}/{totalBankPages}
                      </span>
                      <button
                        disabled={bankPage >= totalBankPages - 1}
                        onClick={() => setBankPage((p) => Math.min(totalBankPages - 1, p + 1))}
                        className="p-2 rounded-xl bg-white border border-zinc-200 disabled:opacity-40"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-200/80 divide-y divide-zinc-100">
                  {paginatedQuestions.map((item) => (
                    <div key={item.id} className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2 flex-wrap min-w-0">
                          <span className="font-mono text-xs font-bold text-orange-600">{item.courseCode}</span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">
                            {item.options.length === 2 ? 'True/False' : `${item.options.length} Options`}
                          </span>
                          {item.sittingId ? (
                            <span
                              className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800 max-w-[14rem] truncate"
                              title={`Dedicated to: ${sittingTitleById(item.sittingId) || 'Removed mock'}`}
                            >
                              {sittingTitleById(item.sittingId) || 'Removed mock'}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-400">
                              Shared bank
                            </span>
                          )}
                        </div>
                        <button
                          onClick={async () => {
                            setQuestionBank((prev) => prev.filter((q) => q.id !== item.id));
                            if (isSupabaseConfigured && supabase) {
                              await supabase.from('questions').delete().eq('id', item.id);
                            }
                            logAdminAction('Deleted question from bank', item.courseCode);
                          }}
                          className="text-zinc-400 hover:text-red-500 flex-shrink-0"
                          title="Delete Question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs font-medium">{item.question}</p>
                      <p className="text-[11px] font-mono text-teal-700">
                        Ans: {['A', 'B', 'C', 'D', 'E'][item.correctIndex]} — {item.options[item.correctIndex]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================ 4. ACCESS CODES ============================ */}
        {activeNav === 'codes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">Access Codes</h1>
                <p className="text-xs text-zinc-500 mt-1 max-w-2xl leading-relaxed">
                  Each code opens <strong>only the exam or combo it was made for</strong>. When you click Copy, the
                  code moves from <strong>Available</strong> to <strong>Issued</strong>, so it can never be copied
                  twice. Once the student uses it, it moves to <strong>Used</strong>.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-start">
                <span className="font-mono text-[11px] px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                  {availableCodes.length} Available
                </span>
                <span className="font-mono text-[11px] px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-bold">
                  {issuedCodes.length} Issued
                </span>
                <span className="font-mono text-[11px] px-3 py-1.5 rounded-full bg-zinc-100 border border-zinc-200 text-zinc-600 font-bold">
                  {usedCodes.length} Used
                </span>
              </div>
            </div>

            <form
              onSubmit={handleGenerateCodes}
              className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-5"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-2">1. What should these codes open?</label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: 'EXAM', label: 'An exam or a combo exam', hint: 'Works only on the one you pick' },
                    {
                      id: 'CUSTOM',
                      label: 'A custom combo',
                      hint: 'For students who mix their own exams'
                    },
                    { id: 'ALL', label: 'Any exam', hint: 'Universal. Use only for giveaways' }
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setCodeGenForm({ ...codeGenForm, scope: opt.id })}
                      className={`text-left p-3.5 rounded-2xl border transition-colors ${
                        codeGenForm.scope === opt.id
                          ? 'border-orange-500 bg-orange-50'
                          : 'border-zinc-200 hover:border-orange-300'
                      }`}
                    >
                      <span className="block text-xs font-bold text-zinc-900">{opt.label}</span>
                      <span className="block text-[11px] text-zinc-500 mt-0.5">{opt.hint}</span>
                    </button>
                  ))}
                </div>
              </div>

              {codeGenForm.scope === 'EXAM' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
                    2. Pick the exam or combo
                  </label>
                  <select
                    value={codeGenForm.examId}
                    onChange={(e) => setCodeGenForm({ ...codeGenForm, examId: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-semibold"
                  >
                    <option value="">Select an exam or combo...</option>
                    {singleExamOptions.length > 0 && (
                      <optgroup label="Single exams">
                        {singleExamOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} (₦{Number(s.priceNaira || 0).toLocaleString()})
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {comboExamOptions.length > 0 && (
                      <optgroup label="Combo exams">
                        {comboExamOptions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title} (₦{Number(s.priceNaira || 0).toLocaleString()})
                          </option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
              )}

              {codeGenForm.scope === 'CUSTOM' && (
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
                    2. Tick the exams this student mixed ({codeGenForm.comboIds.length} selected)
                  </label>
                  <div className="max-h-48 overflow-y-auto p-3 rounded-xl bg-zinc-50 border border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    {customComboPool.map((s) => (
                      <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={codeGenForm.comboIds.includes(s.id)}
                          onChange={() => toggleCustomComboExam(s.id)}
                        />
                        <span className="truncate">
                          <strong>{s.title}</strong>{' '}
                          <span className="text-zinc-400">(₦{Number(s.priceNaira || 0).toLocaleString()})</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1.5">
                    Tick the exams the student pays for. If you sell a fixed bundle, create it as a combo exam instead
                    (Exams & Sittings → Create New Exam → Combo).
                  </p>
                </div>
              )}

              {codeGenForm.scope === 'ALL' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-800 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>
                    A universal code opens <strong>any</strong> exam, so a student could pay for a cheap exam and use
                    it on an expensive one. Prefer a specific exam for normal sales.
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">How many codes? (1–50)</label>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={codeGenForm.quantity}
                    onChange={(e) => setCodeGenForm({ ...codeGenForm, quantity: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">Note (optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Paid via WhatsApp"
                    value={codeGenForm.assignedTo}
                    onChange={(e) => setCodeGenForm({ ...codeGenForm, assignedTo: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs"
                  />
                </div>
                <button
                  type="submit"
                  disabled={codeGenBusy}
                  className="py-2.5 px-4 rounded-xl bg-[#d9531e] hover:bg-orange-600 disabled:opacity-50 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{codeGenBusy ? 'Saving...' : 'Generate Codes'}</span>
                </button>
              </div>

              {codeGenForm.scope !== 'ALL' && (
                <p className="text-[11px] text-zinc-500 font-mono">
                  Price for the student: ₦{codeGenPrice.toLocaleString()}
                </p>
              )}
            </form>

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'available', label: `Available (${availableCodes.length})` },
                  { id: 'issued', label: `Issued, not yet used (${issuedCodes.length})` },
                  { id: 'used', label: `Used (${usedCodes.length})` }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setCodesTab(t.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                      codesTab === t.id ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative w-full lg:w-72">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={codesSearch}
                  onChange={(e) => setCodesSearch(e.target.value)}
                  placeholder="Search code, exam, or note..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs"
                />
              </div>
            </div>

            {(() => {
              const pool =
                codesTab === 'available' ? availableCodes : codesTab === 'issued' ? issuedCodes : usedCodes;
              const q = codesSearch.toLowerCase();
              const filtered = pool.filter(
                (c) =>
                  c.code.toLowerCase().includes(q) ||
                  (c.assignedTo || '').toLowerCase().includes(q) ||
                  getCodeScopeLabel(c).toLowerCase().includes(q)
              );

              const groupMap = new Map();
              filtered.forEach((c) => {
                const key = getCodeScopeKey(c);
                if (!groupMap.has(key)) {
                  groupMap.set(key, {
                    key,
                    label: getCodeScopeLabel(c),
                    ids: getCodeScopeIds(c),
                    price: Number(c.priceNaira) || 0,
                    items: []
                  });
                }
                groupMap.get(key).items.push(c);
              });
              const groups = Array.from(groupMap.values());

              if (groups.length === 0) {
                return (
                  <div className="bg-white rounded-2xl border border-zinc-200/80 py-14 text-center text-xs text-zinc-400">
                    {codesTab === 'available'
                      ? 'No available codes. Generate some above.'
                      : codesTab === 'issued'
                      ? 'No issued codes waiting to be used.'
                      : 'No used codes yet.'}
                  </div>
                );
              }

              const stateKey = (g) => `${codesTab}|${g.key}`;
              const isOpen = (g) => Boolean(codesSearch.trim()) || Boolean(openCodeGroups[stateKey(g)]);
              const toggle = (g) =>
                setOpenCodeGroups((prev) => ({ ...prev, [stateKey(g)]: !prev[stateKey(g)] }));
              const allOpen = groups.every((g) => openCodeGroups[stateKey(g)]);
              const setAll = (value) =>
                setOpenCodeGroups((prev) => {
                  const next = { ...prev };
                  groups.forEach((g) => {
                    next[stateKey(g)] = value;
                  });
                  return next;
                });

              return (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <span>{groups.length} group(s) • click a row to see its codes</span>
                    <button
                      type="button"
                      onClick={() => setAll(!allOpen)}
                      className="font-semibold text-orange-600 hover:underline"
                    >
                      {allOpen ? 'Collapse all' : 'Expand all'}
                    </button>
                  </div>

                  {groups.map((group) => {
                    const open = isOpen(group);
                    return (
                      <div
                        key={group.key}
                        className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden"
                      >
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => toggle(group)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggle(group);
                            }
                          }}
                          className={`px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none hover:bg-zinc-50 ${
                            open ? 'bg-zinc-50 border-b border-zinc-100' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <ChevronDown
                              className={`w-4 h-4 text-zinc-500 flex-shrink-0 transition-transform ${
                                open ? 'rotate-180' : ''
                              }`}
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                                    group.ids.length === 0
                                      ? 'bg-amber-100 text-amber-800'
                                      : isComboScope(group.ids)
                                      ? 'bg-teal-100 text-teal-800'
                                      : 'bg-orange-100 text-orange-700'
                                  }`}
                                >
                                  {group.ids.length === 0
                                    ? 'ANY EXAM'
                                    : isComboScope(group.ids)
                                    ? 'COMBO'
                                    : 'ONE EXAM'}
                                </span>
                                <h3 className="font-bold text-sm text-zinc-900 truncate">{group.label}</h3>
                              </div>
                              <p className="text-[11px] text-zinc-500 mt-0.5 font-mono">
                                {group.items.length} code(s)
                                {group.price > 0 ? ` • ₦${group.price.toLocaleString()} each` : ''}
                              </p>
                            </div>
                          </div>

                          {codesTab === 'available' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyNextCode(group);
                              }}
                              className="px-5 py-2.5 rounded-xl bg-[#d9531e] hover:bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-2 flex-shrink-0"
                            >
                              <Copy className="w-4 h-4" />
                              <span>Copy next code</span>
                            </button>
                          )}
                        </div>

                        {open && (
                          <div className="divide-y divide-zinc-100">
                            {group.items.map((c) => (
                              <div
                                key={c.id || c.code}
                                className="px-5 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <span className="font-mono text-sm font-bold px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-900 flex-shrink-0">
                                    {c.code}
                                  </span>
                                  <span className="text-zinc-400 truncate">
                                    {c.assignedTo ? `Note: ${c.assignedTo}` : 'No note'}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                  {codesTab === 'available' && (
                                    <button
                                      type="button"
                                      onClick={() => handleCopyCode(c)}
                                      className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 font-semibold flex items-center gap-1"
                                    >
                                      <Copy className="w-3.5 h-3.5" />
                                      <span>Copy</span>
                                    </button>
                                  )}

                                  {codesTab === 'issued' && (
                                    <>
                                      <span className="px-2.5 py-1 rounded-md font-mono text-[10px] font-bold bg-amber-50 text-amber-700">
                                        ISSUED
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyCode(c)}
                                        className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 font-semibold flex items-center gap-1"
                                      >
                                        {copiedCode === c.code ? (
                                          <>
                                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                                            <span>Copied</span>
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3.5 h-3.5" />
                                            <span>Copy again</span>
                                          </>
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handlePutBackCode(c)}
                                        className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 font-semibold flex items-center gap-1"
                                        title="Copied by mistake? Move it back to Available"
                                      >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                        <span>Put back</span>
                                      </button>
                                    </>
                                  )}

                                  {codesTab === 'used' && (
                                    <span className="px-2.5 py-1 rounded-md font-mono text-[10px] font-bold bg-zinc-100 text-zinc-500">
                                      USED
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => handleDeleteOrRevokeCode(c)}
                                    className="p-1.5 rounded-lg text-zinc-400 hover:text-red-600"
                                    title="Delete Code"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}

        {/* ============================ 5. CANDIDATES ============================ */}
        {activeNav === 'candidates' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Registered Candidates ({aggregatedCandidates.length})</h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Complete directory of candidates across institutions, courses of study, and verified exam sittings.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-60">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={candidateSearch}
                    onChange={(e) => {
                      setCandidateSearch(e.target.value);
                      setCandidatePage(0);
                    }}
                    placeholder="Search name, school, or course..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs"
                  />
                </div>

                <select
                  value={candidateDeptFilter}
                  onChange={(e) => {
                    setCandidateDeptFilter(e.target.value);
                    setCandidatePage(0);
                  }}
                  className="px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold"
                >
                  <option value="ALL">All Departments</option>
                  {Array.from(new Set(aggregatedCandidates.map((c) => c.dept))).map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(() => {
              const filteredCands = aggregatedCandidates.filter((c) => {
                const matchesDept = candidateDeptFilter === 'ALL' || c.dept === candidateDeptFilter;
                const matchesQ =
                  c.name.toLowerCase().includes(candidateSearch.toLowerCase()) ||
                  (c.institution || '').toLowerCase().includes(candidateSearch.toLowerCase()) ||
                  (c.dept || '').toLowerCase().includes(candidateSearch.toLowerCase());
                return matchesDept && matchesQ;
              });
              const CANDS_PER_PAGE = 10;
              const totalCandPages = Math.max(1, Math.ceil(filteredCands.length / CANDS_PER_PAGE));
              const pageCands = filteredCands.slice(
                candidatePage * CANDS_PER_PAGE,
                (candidatePage + 1) * CANDS_PER_PAGE
              );

              return (
                <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
                  <div className="grid grid-cols-12 px-6 py-3 bg-zinc-50 border-b border-zinc-200/80 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
                    <div className="col-span-1">#</div>
                    <div className="col-span-4">Candidate & Institution</div>
                    <div className="col-span-3">Department</div>
                    <div className="col-span-2 text-center">Sittings</div>
                    <div className="col-span-2 text-right">Best / Avg</div>
                  </div>

                  <div className="divide-y divide-zinc-100">
                    {pageCands.map((cand, i) => {
                      const rankNum = candidatePage * CANDS_PER_PAGE + i + 1;
                      const avg = Math.round(cand.totalScore / Math.max(1, cand.attempts));
                      return (
                        <div
                          key={cand.name + i}
                          className="grid grid-cols-12 items-center px-6 py-3.5 text-xs hover:bg-zinc-50/70"
                        >
                          <div className="col-span-1 font-mono font-bold text-zinc-400">{rankNum}</div>
                          <div className="col-span-4 pr-3 min-w-0">
                            <span className="font-bold text-zinc-900 block truncate">{cand.name}</span>
                            <span className="text-[11px] text-zinc-500 block truncate">{cand.institution}</span>
                          </div>
                          <div className="col-span-3 pr-2 truncate font-medium text-zinc-700">{cand.dept}</div>
                          <div className="col-span-2 text-center font-mono font-bold">{cand.attempts}</div>
                          <div className="col-span-2 text-right font-mono">
                            <span className="font-extrabold text-orange-600 block">{cand.bestScore}%</span>
                            <span className="text-[11px] text-zinc-400">Avg: {avg}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {totalCandPages > 1 && (
                    <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs font-mono">
                      <span>
                        Page {candidatePage + 1} of {totalCandPages}
                      </span>
                      <div className="flex gap-1.5">
                        <button
                          disabled={candidatePage === 0}
                          onClick={() => setCandidatePage((p) => Math.max(0, p - 1))}
                          className="px-2.5 py-1 rounded border bg-white disabled:opacity-40"
                        >
                          Prev
                        </button>
                        <button
                          disabled={candidatePage >= totalCandPages - 1}
                          onClick={() => setCandidatePage((p) => Math.min(totalCandPages - 1, p + 1))}
                          className="px-2.5 py-1 rounded border bg-white disabled:opacity-40"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}

        {/* ============================ 6. RESULTS & RELEASE ============================ */}
        {activeNav === 'results' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-zinc-500 max-w-xl leading-relaxed">
                Scores are calculated on the server. When a sitting is set to <strong>Held</strong> or{' '}
                <strong>Scheduled</strong>, candidates see a locked submission receipt until you release results.
              </p>

              <div className="flex items-center gap-2.5 flex-wrap">
                <select
                  value={resultsSittingFilter}
                  onChange={(e) => {
                    setResultsSittingFilter(e.target.value);
                    setResultsPage(0);
                  }}
                  className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200/90 text-xs font-bold shadow-sm"
                >
                  <option value="ALL">All Exam Sittings ({standings.length})</option>
                  {sittings.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.title} ({s.mode})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() =>
                    handleExportResultsCsv(resultsForSelectedSitting, selectedResultSitting?.title || 'All_Sittings')
                  }
                  className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200/90 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {selectedResultSitting ? (
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-zinc-200/80 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-4">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                      (selectedResultSitting.releaseMode || 'INSTANT') === 'INSTANT'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : (selectedResultSitting.releaseMode || 'INSTANT') === 'SCHEDULED'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-zinc-100 text-zinc-700 border border-zinc-300'
                    }`}
                  >
                    {(selectedResultSitting.releaseMode || 'INSTANT') === 'INSTANT' ? (
                      <Unlock className="w-5 h-5" />
                    ) : (selectedResultSitting.releaseMode || 'INSTANT') === 'SCHEDULED' ? (
                      <Clock className="w-5 h-5" />
                    ) : (
                      <Lock className="w-5 h-5" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-base text-zinc-900">
                        {(selectedResultSitting.releaseMode || 'INSTANT') === 'INSTANT'
                          ? 'Released (Live to Candidates)'
                          : (selectedResultSitting.releaseMode || 'INSTANT') === 'SCHEDULED'
                          ? 'Scheduled Release Active'
                          : 'Withheld / Embargoed'}
                      </h3>
                      <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700">
                        {selectedResultSitting.title}
                      </span>
                    </div>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {selectedResultSitting.mode === 'PRACTICE'
                        ? 'Speed Drills always show results at once.'
                        : (selectedResultSitting.releaseMode || 'INSTANT') === 'SCHEDULED' &&
                          selectedResultSitting.releaseAt
                        ? `Unlocks automatically on ${new Date(selectedResultSitting.releaseAt).toLocaleString()}`
                        : 'Controls candidate access to percentage scores, positions, and question corrections'}
                    </p>
                  </div>
                </div>

                {selectedResultSitting.mode !== 'PRACTICE' && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5 bg-zinc-50 border border-zinc-200 rounded-xl px-2.5 py-1.5">
                      <input
                        type="datetime-local"
                        value={scheduleDateTimeInput}
                        onChange={(e) => setScheduleDateTimeInput(e.target.value)}
                        className="bg-transparent text-xs font-mono outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (!scheduleDateTimeInput) {
                            alert('Pick a release date and time first.');
                            return;
                          }
                          handleUpdateSitting(selectedResultSitting.id, {
                            releaseMode: 'SCHEDULED',
                            resultsReleased: false,
                            releaseAt: new Date(scheduleDateTimeInput).toISOString()
                          });
                          logAdminAction(
                            `Scheduled results release for ${selectedResultSitting.title}`,
                            scheduleDateTimeInput
                          );
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold"
                      >
                        Schedule
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        handleUpdateSitting(selectedResultSitting.id, { releaseMode: 'HELD', resultsReleased: false });
                        logAdminAction('Withdrew / Held results', selectedResultSitting.title);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-xs font-bold"
                    >
                      Withdraw / Hold
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleUpdateSitting(selectedResultSitting.id, {
                          releaseMode: 'INSTANT',
                          resultsReleased: true,
                          releaseAt: null
                        });
                        logAdminAction('Released results immediately', selectedResultSitting.title);
                      }}
                      className="px-5 py-2.5 rounded-xl bg-[#d9531e] hover:bg-orange-600 text-white text-xs font-bold shadow-sm"
                    >
                      Release Now
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm text-xs text-zinc-500 flex items-center gap-3">
                <Lock className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                <span>
                  Pick one exam above to hold, schedule or release its results. Showing every sitting right now.
                </span>
              </div>
            )}

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[
                ['Submitted (1st Try)', resultsForSelectedSitting.length, ''],
                [`Passed (≥${passMarkInView}%)`, passCountInView, 'text-emerald-700'],
                ['Average Score', `${avgScoreInView}%`, ''],
                ['Highest Score', `${highestScoreInView}%`, 'text-orange-600']
              ].map(([label, value, color]) => (
                <div
                  key={label}
                  className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-1"
                >
                  <span className="text-xs text-zinc-500 font-medium block">{label}</span>
                  <p className={`text-3xl font-bold font-mono ${color}`}>{value}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <h2 className="font-bold text-base">Candidates Standings Overview</h2>
                <p className="text-xs text-zinc-500">Positions ordered by 1st-attempt score, then fastest finish.</p>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-60">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={resultsCandidateSearch}
                    onChange={(e) => {
                      setResultsCandidateSearch(e.target.value);
                      setResultsPage(0);
                    }}
                    placeholder="Search candidate or course..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs"
                  />
                </div>

                <select
                  value={resultsDeptFilter}
                  onChange={(e) => {
                    setResultsDeptFilter(e.target.value);
                    setResultsPage(0);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold"
                >
                  <option value="ALL">All combinations / courses</option>
                  {Array.from(new Set(standings.map((s) => s.dept))).map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm overflow-hidden">
              <div className="grid grid-cols-12 px-6 py-3.5 bg-zinc-50/80 border-b border-zinc-200/80 text-[10px] font-mono uppercase tracking-wider text-zinc-500 font-bold">
                <div className="col-span-2"># Position</div>
                <div className="col-span-4">Candidate</div>
                <div className="col-span-3">Course / Combination</div>
                <div className="col-span-1 text-right">Time</div>
                <div className="col-span-2 text-right">Score / Action</div>
              </div>

              <div className="divide-y divide-zinc-100">
                {paginatedResultsRows.length === 0 ? (
                  <div className="py-12 text-center text-xs text-zinc-400">
                    No candidate submissions match this sitting filter yet.
                  </div>
                ) : (
                  paginatedResultsRows.map((r, idx) => {
                    const globalRank = resultsPage * RESULTS_PER_PAGE + idx + 1;
                    const topPct = Math.max(
                      1,
                      Math.round((globalRank / Math.max(1, resultsForSelectedSitting.length)) * 100)
                    );

                    return (
                      <div
                        key={r.id}
                        className="grid grid-cols-12 items-center px-6 py-4 text-xs hover:bg-zinc-50/70"
                      >
                        <div className="col-span-2 flex items-center gap-2 font-mono">
                          <span
                            className={`w-6 h-6 rounded-lg text-xs font-bold flex items-center justify-center ${
                              globalRank === 1
                                ? 'bg-amber-500 text-black'
                                : globalRank === 2
                                ? 'bg-zinc-300 text-zinc-900'
                                : globalRank === 3
                                ? 'bg-orange-800 text-amber-100'
                                : 'bg-zinc-100 text-zinc-600'
                            }`}
                          >
                            {globalRank}
                          </span>
                          <span className="text-[10px] text-zinc-400">top {topPct}%</span>
                        </div>

                        <div className="col-span-4 pr-3 min-w-0">
                          <span className="font-bold text-zinc-900 block truncate">{r.name}</span>
                          <span className="text-[11px] text-zinc-400 font-mono truncate block">
                            {r.sittingTitle || r.mode}
                          </span>
                        </div>

                        <div className="col-span-3 pr-2 truncate text-zinc-700 font-medium">{r.dept}</div>

                        <div className="col-span-1 text-right font-mono text-zinc-500">{formatSecs(r.timeSecs)}</div>

                        <div className="col-span-2 flex items-center justify-end gap-3 font-mono">
                          <span className="font-extrabold text-sm text-orange-600">{r.score}%</span>
                          <button
                            onClick={async () => {
                              if (!window.confirm(`Delete result entry for ${r.name}?`)) return;
                              setStandings((prev) => prev.filter((item) => item.id !== r.id));
                              if (isSupabaseConfigured && supabase) {
                                await supabase.from('exam_results').delete().eq('id', r.id);
                              }
                              logAdminAction('Deleted candidate result', r.name);
                            }}
                            className="text-zinc-400 hover:text-red-600"
                            title="Remove Result Entry"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {totalResultPages > 1 && (
                <div className="px-6 py-3 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between text-xs font-mono">
                  <span>
                    Page {resultsPage + 1} of {totalResultPages}
                  </span>
                  <div className="flex gap-1.5">
                    <button
                      disabled={resultsPage === 0}
                      onClick={() => setResultsPage((p) => Math.max(0, p - 1))}
                      className="px-2.5 py-1 rounded border bg-white disabled:opacity-40"
                    >
                      Prev
                    </button>
                    <button
                      disabled={resultsPage >= totalResultPages - 1}
                      onClick={() => setResultsPage((p) => Math.min(totalResultPages - 1, p + 1))}
                      className="px-2.5 py-1 rounded border bg-white disabled:opacity-40"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================ 7. ANNOUNCEMENTS ============================ */}
        {activeNav === 'announcements' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-base">Post Square Dashboard Announcement</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Appears in the 1:1 square carousel directly above General Standings on the student homepage (Max{' '}
                  {MAX_ANNOUNCEMENTS} slides).
                </p>
              </div>

              <form onSubmit={handleAddAnnouncement} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-600 mb-1">
                    Square Flyer / Image (Upload or Paste URL)
                  </label>
                  <input type="file" accept="image/*" onChange={handleAnnouncementImageUpload} className="w-full text-xs mb-2" />
                  <input
                    type="url"
                    placeholder="Or paste image URL (https://...)"
                    value={newAnn.imageUrl}
                    onChange={(e) => setNewAnn({ ...newAnn, imageUrl: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-600 mb-1">Headline</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. National UTME & University Mock 2.0 Live"
                    value={newAnn.title}
                    onChange={(e) => setNewAnn({ ...newAnn, title: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-zinc-600 mb-1">Short Caption Below Square Image</label>
                  <textarea
                    rows={2}
                    required
                    placeholder="Get your access code via WhatsApp to join this weekend's prize mock..."
                    value={newAnn.body}
                    onChange={(e) => setNewAnn({ ...newAnn, body: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block font-semibold text-zinc-600 mb-1">Button Text</label>
                    <input
                      type="text"
                      value={newAnn.ctaLabel}
                      onChange={(e) => setNewAnn({ ...newAnn, ctaLabel: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-zinc-600 mb-1">Click Destination URL</label>
                    <input
                      type="text"
                      placeholder="https://wa.me/..."
                      value={newAnn.ctaUrl}
                      onChange={(e) => setNewAnn({ ...newAnn, ctaUrl: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={announcements.length >= MAX_ANNOUNCEMENTS}
                  className="w-full py-2.5 rounded-xl bg-[#d9531e] disabled:opacity-40 text-white font-semibold"
                >
                  {announcements.length >= MAX_ANNOUNCEMENTS
                    ? `Max ${MAX_ANNOUNCEMENTS} Active Slides Reached`
                    : 'Publish to Student Carousel'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <h3 className="font-bold text-sm">
                Active Carousel Slides ({announcements.length} / {MAX_ANNOUNCEMENTS} Max)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {announcements.map((ann, idx) => (
                  <div
                    key={ann.id}
                    className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-full aspect-square bg-zinc-100 relative overflow-hidden">
                        <img src={ann.imageUrl} alt={ann.title} className="w-full h-full object-cover" />
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-white font-mono text-[10px]">
                          Slide {idx + 1}/{MAX_ANNOUNCEMENTS}
                        </span>
                      </div>
                      <div className="p-4 space-y-1">
                        <h4 className="font-bold text-xs line-clamp-1">{ann.title}</h4>
                        <p className="text-[11px] text-zinc-500 line-clamp-2">{ann.body}</p>
                      </div>
                    </div>
                    <div className="px-4 pb-3 flex justify-end">
                      <button
                        onClick={async () => {
                          setAnnouncements((prev) => prev.filter((a) => a.id !== ann.id));
                          if (isSupabaseConfigured && supabase) {
                            await supabase.from('announcements').delete().eq('id', ann.id);
                          }
                          logAdminAction('Removed announcement slide', ann.title);
                        }}
                        className="text-xs text-red-600 font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete Slide</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============================ 8. SETTINGS ============================ */}
        {activeNav === 'settings' && (
          <div className="max-w-2xl">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-zinc-200/80 space-y-6">
              <div>
                <h2 className="text-xl font-extrabold">Platform & WhatsApp Payment Settings</h2>
                <p className="text-xs text-zinc-500 mt-1">
                  Changes saved here immediately update the student WhatsApp payment redirect and Organiser PIN across Localhost and Vercel.
                </p>
              </div>

              {settingsSavedBanner && (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Settings saved and synced!</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                    WhatsApp Payment Receiver Number (International Format, No +)
                  </label>
                  <input
                    type="text"
                    required
                    value={platformConfig?.whatsappNumber ?? ''}
                    onChange={(e) => setPlatformConfig((p) => ({ ...p, whatsappNumber: e.target.value }))}
                    placeholder="e.g. 2348000000000"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-orange-500 outline-none font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Organiser Email</label>
                  <input
                    type="email"
                    required
                    value={platformConfig?.organiserEmail ?? ''}
                    onChange={(e) => setPlatformConfig((p) => ({ ...p, organiserEmail: e.target.value }))}
                    placeholder="ayodejiakin2020@gmail.com"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-orange-500 outline-none text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                    Organiser Console Quick PIN / Password
                  </label>
                  <input
                    type="text"
                    required
                    value={platformConfig?.adminPin ?? ''}
                    onChange={(e) => setPlatformConfig((p) => ({ ...p, adminPin: e.target.value }))}
                    placeholder="Enter new PIN (e.g. Brilly2405)"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-orange-500 outline-none font-mono text-sm"
                  />
                </div>

                <div className="pt-4 border-t border-zinc-100 flex justify-end">
                  <button
                    type="submit"
                    className="px-8 py-3 bg-[#d9531e] hover:bg-orange-600 text-white font-bold text-xs uppercase tracking-wider rounded-xl shadow-md transition-all"
                  >
                    Save Settings
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ============================ 9. AUDIT ============================ */}
        {activeNav === 'audit' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Organiser Audit Log</h1>
            <div className="bg-white rounded-2xl border border-zinc-200/80 divide-y divide-zinc-100 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-900">{log.action}</span>
                    {log.target && <span className="ml-2 font-mono text-orange-600">[{log.target}]</span>}
                  </div>
                  <span className="font-mono text-zinc-400">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ============================ 10. TEAM ============================ */}
        {activeNav === 'team' && (
          <div className="max-w-lg bg-white rounded-2xl p-6 border border-zinc-200/80 space-y-4">
            <h1 className="text-xl font-bold">Organiser Team</h1>
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold block">{platformConfig.organiserEmail}</span>
                <span className="text-zinc-500">Lead Organiser • Full Access</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-mono font-bold">ACTIVE</span>
            </div>
          </div>
        )}

        {/* ============================ 11. LIVE SITTINGS ============================ */}
        {activeNav === 'live' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">Live Sittings</h1>
                <p className="text-xs text-zinc-500 mt-1 max-w-2xl leading-relaxed">
                  Watch students who are writing right now. When a student is <strong>locked</strong> (they left the
                  exam, signed out, or went over the screen-leave limit), you can <strong>re-admit</strong> them,
                  submit their script, or cancel the attempt. This page refreshes every 10 seconds.
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap self-start">
                <span className="font-mono text-[11px] px-3 py-1.5 rounded-full bg-orange-50 border border-orange-200 text-orange-700 font-bold">
                  {lockedSessions.length} Locked
                </span>
                <span className="font-mono text-[11px] px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold">
                  {activeLiveSessions.length} Active
                </span>
                <button
                  type="button"
                  onClick={() => loadLiveSessions(false)}
                  disabled={liveLoading}
                  className="px-4 py-1.5 rounded-full bg-white border border-zinc-200 hover:bg-zinc-50 disabled:opacity-50 text-xs font-semibold flex items-center gap-1.5 shadow-sm"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${liveLoading ? 'animate-spin' : ''}`} />
                  <span>{liveLoading ? 'Refreshing...' : 'Refresh'}</span>
                </button>
              </div>
            </div>

            {liveError && (
              <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">{liveError}</p>
                  {liveError.toLowerCase().includes('invalid admin pin') && (
                    <p className="text-red-600">
                      The Console PIN here does not match the one saved in the cloud. Open Settings, save the Console
                      PIN again, then press Refresh.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                {[
                  { id: 'locked', label: `Locked (${lockedSessions.length})`, hot: true },
                  { id: 'active', label: `Active now (${activeLiveSessions.length})` },
                  { id: 'finished', label: `Finished (${finishedSessions.length})` }
                ].map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setLiveTab(t.id)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold ${
                      liveTab === t.id
                        ? t.hot
                          ? 'bg-[#d9531e] text-white'
                          : 'bg-zinc-900 text-white'
                        : t.hot && lockedSessions.length > 0
                        ? 'bg-orange-50 border border-orange-200 text-orange-700'
                        : 'bg-white border border-zinc-200 text-zinc-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={liveExamFilter}
                  onChange={(e) => setLiveExamFilter(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold max-w-[14rem]"
                >
                  <option value="ALL">All exams</option>
                  {liveExamOptions.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.title}
                    </option>
                  ))}
                </select>
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={liveSearch}
                    onChange={(e) => setLiveSearch(e.target.value)}
                    placeholder="Search student name or email..."
                    className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs"
                  />
                </div>
              </div>
            </div>

            {liveFiltered.length === 0 ? (
              <div className="bg-white rounded-2xl border border-zinc-200/80 py-14 text-center text-xs text-zinc-400">
                {liveLoading
                  ? 'Loading sittings...'
                  : liveTab === 'locked'
                  ? 'No locked students right now.'
                  : liveTab === 'active'
                  ? 'Nobody is writing an exam right now.'
                  : 'No finished sittings yet.'}
              </div>
            ) : (
              <div className="space-y-3">
                {liveFiltered.map((s) => {
                  const total = Number(s.total) || 0;
                  const answered = Number(s.answered) || 0;
                  const pct = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0;
                  const timeOver = isTimeOver(s);
                  const remaining = getRemainingSecs(s);
                  const reason = LOCK_REASON_META[s.lock_reason];
                  const busy = actionBusyId === s.id;
                  const isLocked = s.status === 'LOCKED';
                  const isActive = s.status === 'ACTIVE';

                  return (
                    <div
                      key={s.id}
                      className={`bg-white rounded-2xl border shadow-sm p-5 space-y-4 ${
                        isLocked ? 'border-orange-200' : 'border-zinc-200/80'
                      }`}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                        <div className="min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-sm text-zinc-900">{s.student_name}</h3>
                            {s.department && (
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-100 text-zinc-600">
                                {s.department}
                              </span>
                            )}
                            {isLocked && reason && (
                              <span className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${reason.cls}`}>
                                {reason.label}
                              </span>
                            )}
                            {isLocked && !reason && (
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100 text-orange-700">
                                Locked
                              </span>
                            )}
                            {isActive && (
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                Writing now
                              </span>
                            )}
                            {s.status === 'SUBMITTED' && (
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                Submitted
                              </span>
                            )}
                            {s.status === 'CANCELLED' && (
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-zinc-200 text-zinc-600">
                                Cancelled
                              </span>
                            )}
                            {timeOver && (
                              <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                                Time over, not submitted
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 truncate">{s.email}</p>
                          <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span
                              className={`font-mono text-[10px] font-bold px-2 py-0.5 rounded ${
                                s.mode === 'BUNDLED' ? 'bg-teal-100 text-teal-800' : 'bg-orange-100 text-orange-700'
                              }`}
                            >
                              {s.mode === 'BUNDLED' ? 'COMBO' : 'EXAM'}
                            </span>
                            <span className="font-semibold text-zinc-800">{s.sitting_title}</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-[11px] font-mono flex-shrink-0">
                          <div>
                            <span className="block text-zinc-400">
                              {isActive ? 'Time left' : isLocked ? 'Time left (frozen)' : 'Time left'}
                            </span>
                            <span
                              className={`block text-sm font-bold ${
                                timeOver ? 'text-amber-700' : isActive ? 'text-emerald-700' : 'text-zinc-800'
                              }`}
                            >
                              {formatClock(remaining)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-zinc-400">Screen leaves</span>
                            <span className="block text-sm font-bold text-zinc-800">
                              {Number(s.cheat_warnings) || 0}
                            </span>
                          </div>
                          <div>
                            <span className="block text-zinc-400">Re-admitted</span>
                            <span className="block text-sm font-bold text-zinc-800">
                              {Number(s.readmit_count) || 0}x
                            </span>
                          </div>
                          <div>
                            <span className="block text-zinc-400">
                              {s.status === 'SUBMITTED' ? 'Submitted' : isLocked ? 'Locked at' : 'Last seen'}
                            </span>
                            <span className="block text-zinc-800">
                              {(() => {
                                const when =
                                  s.status === 'SUBMITTED'
                                    ? s.submitted_at
                                    : isLocked
                                    ? s.locked_at
                                    : s.updated_at;
                                return when ? new Date(when).toLocaleString() : '—';
                              })()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center justify-between text-[11px] font-mono text-zinc-500 mb-1">
                          <span>
                            Answered {answered} / {total}
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-zinc-100 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isLocked ? 'bg-[#d9531e]' : 'bg-teal-600'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      {s.admin_note && (
                        <p className="text-[11px] text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-2">
                          Note: {s.admin_note}
                        </p>
                      )}

                      {(isLocked || isActive) && (
                        <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-zinc-100">
                          {isLocked && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => openReadmitModal(s)}
                              className="px-4 py-2 rounded-xl bg-[#d9531e] hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1.5"
                            >
                              <Unlock className="w-3.5 h-3.5" />
                              <span>Re-admit</span>
                            </button>
                          )}
                          {(isLocked || timeOver) && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleSubmitScriptNow(s)}
                              className="px-4 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{busy ? 'Working...' : 'Submit script now'}</span>
                            </button>
                          )}
                          {isActive && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleLockNow(s)}
                              className="px-4 py-2 rounded-xl border border-zinc-300 hover:bg-zinc-50 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5"
                            >
                              <Lock className="w-3.5 h-3.5" />
                              <span>Lock now</span>
                            </button>
                          )}
                          {isLocked && (
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => handleCancelAttempt(s)}
                              className="ml-auto px-4 py-2 rounded-xl border border-red-200 bg-red-50/60 text-red-600 hover:bg-red-100 disabled:opacity-50 text-xs font-bold flex items-center gap-1.5"
                            >
                              <X className="w-3.5 h-3.5" />
                              <span>Cancel attempt</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>

      {/* ======================================================================
          RE-ADMIT MODAL
      ====================================================================== */}
      {readmitTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 text-xs shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold">Re-admit student</h3>
              <button
                type="button"
                onClick={() => setReadmitTarget(null)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3.5 rounded-2xl bg-zinc-50 border border-zinc-200 space-y-1">
              <p className="font-bold text-sm text-zinc-900">{readmitTarget.student_name}</p>
              <p className="text-zinc-600">{readmitTarget.sitting_title}</p>
              <p className="font-mono text-[11px] text-zinc-500">
                Answered {Number(readmitTarget.answered) || 0} / {Number(readmitTarget.total) || 0} • Time left:{' '}
                {formatClock(getRemainingSecs(readmitTarget))}
              </p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-600 mb-1.5">Add extra time (minutes)</label>
              <div className="flex items-center gap-2 flex-wrap">
                {[0, 2, 5, 10].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setReadmitExtra(String(n))}
                    className={`px-3.5 py-1.5 rounded-lg font-mono font-bold border ${
                      Number(readmitExtra) === n && readmitExtra !== ''
                        ? 'bg-orange-50 border-orange-500 text-orange-700'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:border-orange-300'
                    }`}
                  >
                    +{n}
                  </button>
                ))}
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={readmitExtra}
                  onChange={(e) => setReadmitExtra(e.target.value)}
                  placeholder="Custom"
                  className="w-24 px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 font-mono font-bold"
                />
              </div>
              <p className="text-[11px] text-zinc-400 mt-1.5">
                The student keeps their frozen time left, plus whatever you add here.
              </p>
            </div>

            <div>
              <label className="block font-semibold text-zinc-600 mb-1.5">Note (optional)</label>
              <input
                type="text"
                value={readmitNote}
                onChange={(e) => setReadmitNote(e.target.value)}
                placeholder="e.g. Phone call dropped the internet"
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200"
              />
            </div>

            {liveError && (
              <p className="text-red-600 bg-red-50 border border-red-200 rounded-xl p-3 font-semibold">{liveError}</p>
            )}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setReadmitTarget(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionBusyId === readmitTarget.id}
                onClick={handleConfirmReadmit}
                className="flex-1 py-2.5 rounded-xl bg-[#d9531e] hover:bg-orange-600 disabled:opacity-50 text-white font-semibold"
              >
                {actionBusyId === readmitTarget.id ? 'Re-admitting...' : 'Confirm re-admit'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================
          CREATE / EDIT EXAM MODAL
      ====================================================================== */}
      {showSittingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSitting}
            className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-7 space-y-4 text-xs max-h-[92vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold">
                {editingSittingId ? 'Edit Exam Sitting' : 'Create Exam Sitting'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSittingModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* 1. Category */}
            <div>
              <label className="block font-semibold text-zinc-600 mb-1.5">1. What kind of exam is this?</label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                {[
                  {
                    id: 'PRACTICE',
                    label: 'Speed Drill',
                    hint: 'Short, timed in seconds, instant answers'
                  },
                  { id: 'OFFICIAL', label: 'Official Mock', hint: 'Strict timed exam, ranked' },
                  {
                    id: 'BUNDLED',
                    label: 'Combo',
                    hint: 'Several exams in one sitting, with subject tabs'
                  }
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleModeChange(m.id)}
                    className={`text-left p-3 rounded-2xl border transition-colors ${
                      sittingForm.mode === m.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-zinc-200 hover:border-orange-300'
                    }`}
                  >
                    <span className="block text-xs font-bold text-zinc-900">{m.label}</span>
                    <span className="block text-[11px] text-zinc-500 mt-0.5">{m.hint}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-600 mb-1">2. Exam title</label>
                <input
                  type="text"
                  required
                  placeholder={
                    isComboForm
                      ? 'e.g. Science Combo: MAT + PHY + BIO'
                      : isSpeedForm
                      ? 'e.g. Physics Speed Drill 1'
                      : 'e.g. Neuroanatomy Mid-Semester Mock 1.0'
                  }
                  value={sittingForm.title}
                  onChange={(e) => setSittingForm({ ...sittingForm, title: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200"
                />
              </div>
              <div>
                <label className="block font-semibold text-zinc-600 mb-1">3. Course / Department</label>
                <select
                  value={sittingForm.targetCourse}
                  onChange={(e) => setSittingForm({ ...sittingForm, targetCourse: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 font-semibold"
                >
                  <option value="All Courses">All Courses / General Exam</option>
                  {NIGERIAN_COURSES_OF_STUDY.map((dept) => (
                    <option key={dept} value={dept}>
                      {dept}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4. QUESTIONS for a single exam (Official Mock or Speed Drill) */}
            {!isComboForm && (
              <div className="space-y-3 p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200">
                <label className="font-semibold text-teal-800 flex items-center gap-1.5">
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  4. Where do this exam's questions come from?
                </label>

                {formDedicatedCount > 0 ? (
                  <div className="p-3 rounded-xl bg-white border border-teal-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="text-[11px] text-teal-900 leading-relaxed">
                      <strong>{formDedicatedCount} questions</strong> belong to this exam. It uses only those. You can
                      add more below.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemoveDedicatedQuestions(editingSittingId)}
                      className="px-3 py-1.5 rounded-lg border border-red-200 bg-red-50/60 text-red-600 hover:bg-red-100 font-bold flex-shrink-0"
                    >
                      Delete its {formDedicatedCount} questions
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setModalQSource('DEDICATED')}
                      className={`text-left p-3 rounded-2xl border transition-colors ${
                        modalQSource === 'DEDICATED'
                          ? 'border-teal-600 bg-white'
                          : 'border-teal-200 bg-white/60 hover:border-teal-400'
                      }`}
                    >
                      <span className="block text-xs font-bold text-zinc-900">Its own questions (recommended)</span>
                      <span className="block text-[11px] text-zinc-500 mt-0.5">
                        Upload a .csv for this exam. No other exam can use them, so nothing repeats.
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalQSource('SHARED')}
                      className={`text-left p-3 rounded-2xl border transition-colors ${
                        modalQSource === 'SHARED'
                          ? 'border-teal-600 bg-white'
                          : 'border-teal-200 bg-white/60 hover:border-teal-400'
                      }`}
                    >
                      <span className="block text-xs font-bold text-zinc-900">Shared subject bank</span>
                      <span className="block text-[11px] text-zinc-500 mt-0.5">
                        Pick subjects. Questions are drawn from the shared pool, so other exams may repeat them.
                      </span>
                    </button>
                  </div>
                )}

                {formOwnMode && (
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => modalFileInputRef.current?.click()}
                        className="px-3.5 py-2 rounded-xl bg-white border border-teal-300 text-teal-800 font-bold flex items-center gap-1.5 hover:bg-teal-50"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>{modalCsvFileName ? 'Choose a different .CSV' : 'Choose .CSV file'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleDownloadCsvTemplate}
                        className="px-3.5 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-600 font-semibold flex items-center gap-1.5 hover:bg-zinc-50"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Template</span>
                      </button>
                      <input
                        ref={modalFileInputRef}
                        type="file"
                        accept=".csv,text/csv"
                        onChange={handleModalCsvSelected}
                        className="hidden"
                      />
                      {modalCsvFileName && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-mono text-teal-900">
                          {modalCsvFileName}
                          <button
                            type="button"
                            onClick={resetModalQuestionFile}
                            className="text-zinc-400 hover:text-red-600"
                            title="Remove this file"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </span>
                      )}
                    </div>

                    {modalCsvRows.length > 0 && (
                      <p className="text-[11px] font-semibold text-teal-800">
                        {modalCsvRows.length} questions ready. They are saved to this exam when you press the save
                        button below.
                      </p>
                    )}
                    {modalCsvErrors.length > 0 && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        Skipped {modalCsvErrors.length} invalid row(s). First problem: {modalCsvErrors[0]}
                      </p>
                    )}
                    {modalCsvUnmatched > 0 && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        {modalCsvUnmatched} row(s) have a course_code that is not in your subjects, so they were filed
                        under the first subject. This does not affect which exam they belong to.
                      </p>
                    )}
                    {modalCsvRows.length > 0 &&
                      Number(sittingForm.questionCount) !== formOwnTotal &&
                      formOwnTotal > 0 && (
                        <button
                          type="button"
                          onClick={() => setSittingForm((prev) => ({ ...prev, questionCount: formOwnTotal }))}
                          className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-[11px] font-bold"
                        >
                          Use all {formOwnTotal} as the total questions
                        </button>
                      )}
                    {formOwnTotal === 0 && (
                      <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                        No questions yet. If you save now, the exam is kept as DRAFT so students cannot open it. Add
                        questions later with the "Add questions" button on the exam card, then set it to OPEN.
                      </p>
                    )}
                  </div>
                )}

                {!formOwnMode && (
                  <div>
                    <span className="block text-[11px] font-semibold text-teal-800 mb-1">
                      Subjects this exam draws from ({sittingForm.allowedCourses.length} selected)
                    </span>
                    {subjectPickerEl}
                  </div>
                )}
              </div>
            )}

            {/* COMBO: pick the exams */}
            {isComboForm && (
              <div className="space-y-2 p-3.5 rounded-2xl bg-teal-50/60 border border-teal-200">
                <div className="flex items-center justify-between gap-2">
                  <label className="font-semibold text-teal-800 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5" />
                    4. Exams in this combo ({sittingForm.comboSittingIds.length} picked)
                  </label>
                </div>

                {comboPickPool.length === 0 ? (
                  <p className="text-[11px] text-teal-800">
                    Create the single exams first (Official Mocks), then come back and tick them here.
                  </p>
                ) : (
                  <div className="max-h-44 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {comboPickPool.map((s) => (
                      <label
                        key={s.id}
                        className="flex items-center gap-2 cursor-pointer p-2 rounded-xl bg-white border border-teal-100"
                      >
                        <input
                          type="checkbox"
                          checked={sittingForm.comboSittingIds.includes(s.id)}
                          onChange={() => toggleComboExam(s.id)}
                        />
                        <span className="min-w-0">
                          <strong className="block truncate">{s.title}</strong>
                          <span className="text-[10px] text-zinc-500 font-mono">
                            ₦{Number(s.priceNaira || 0).toLocaleString()} • {formatMins(s.durationMins)} •{' '}
                            {Math.min(poolSizeFor(s), Number(s.questionCount) || poolSizeFor(s))} Qs
                            {(questionCountBySitting[String(s.id)] || 0) > 0 ? ' • dedicated' : ''}
                          </span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                <p className="text-[11px] text-teal-800 leading-relaxed">
                  Each picked exam brings its <strong>own full set of questions</strong> and shows as its own subject
                  tab. The student switches between them freely, with one shared timer.
                </p>

                {comboPicked.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-teal-200">
                    <span className="text-[11px] font-mono text-teal-900">
                      Together: ₦{comboTotals.price.toLocaleString()} • {formatMins(comboTotals.mins)} •{' '}
                      {comboTotals.qs} Qs
                    </span>
                    <button
                      type="button"
                      onClick={useComboTotals}
                      className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-600 text-white text-[11px] font-bold"
                    >
                      Use these price & time
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Pricing / time / questions */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-zinc-600 mb-1">1st Attempt Price (₦)</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={sittingForm.priceNaira}
                  onChange={(e) => setSittingForm({ ...sittingForm, priceNaira: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-orange-600 mb-1">2nd Try Retake (₦)</label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  placeholder="0 = Free Retakes"
                  value={sittingForm.retakePriceNaira}
                  onChange={(e) => setSittingForm({ ...sittingForm, retakePriceNaira: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-orange-50/50 border border-orange-200 font-mono font-bold text-orange-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-600 mb-1">1st Attempt Gate</label>
                <select
                  value={sittingForm.requiresCode ? 'yes' : 'no'}
                  onChange={(e) => setSittingForm({ ...sittingForm, requiresCode: e.target.value === 'yes' })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-semibold"
                >
                  <option value="yes">Code Required on 1st Try</option>
                  <option value="no">Free 1st Try (No Code)</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-semibold text-zinc-600">Time Limit</label>
                  <div className="flex p-0.5 rounded-lg bg-zinc-100 text-[10px] font-bold">
                    {['MINS', 'SECS'].map((u) => (
                      <button
                        key={u}
                        type="button"
                        onClick={() => switchDurationUnit(u)}
                        className={`px-1.5 py-0.5 rounded-md ${
                          durationUnit === u ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'
                        }`}
                      >
                        {u === 'MINS' ? 'mins' : 'secs'}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  type="number"
                  min={0.1}
                  step="any"
                  value={durationText}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono"
                />
                <span className="text-[10px] text-zinc-400 font-mono block mt-0.5">
                  {Number(sittingForm.durationMins) > 0 ? `= ${formatMins(sittingForm.durationMins)}` : ''}
                </span>
              </div>

              {!(isComboForm && sittingForm.comboSittingIds.length > 1) && (
                <div>
                  <label className="block font-semibold text-zinc-600 mb-1 truncate">
                    {isComboForm ? 'Qs PER Subject' : 'Total Questions'}
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={sittingForm.questionCount}
                    onChange={(e) => setSittingForm({ ...sittingForm, questionCount: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold"
                  />
                  {!isComboForm && (
                    <span
                      className={`text-[10px] font-mono block mt-0.5 ${
                        Number(sittingForm.questionCount) > formPoolSize ? 'text-red-600' : 'text-zinc-400'
                      }`}
                    >
                      {formPoolSize} {formOwnMode ? 'dedicated to this mock' : 'available in bank'}
                    </span>
                  )}
                </div>
              )}

              <div>
                <label className="block font-semibold text-zinc-600 mb-1">Pass Mark (%)</label>
                <input
                  type="number"
                  min={10}
                  max={100}
                  value={sittingForm.passMark}
                  onChange={(e) => setSittingForm({ ...sittingForm, passMark: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono"
                />
              </div>

              {!isSpeedForm && (
                <div>
                  <label className="block font-semibold text-teal-700 mb-1">Max Screen Leaves</label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={sittingForm.maxTabSwitches}
                    onChange={(e) => setSittingForm({ ...sittingForm, maxTabSwitches: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-teal-50/50 border border-teal-200 font-mono font-bold text-teal-700"
                  />
                </div>
              )}
            </div>

            {/* What happens when the leave limit is reached (not for Speed Drills) */}
            {!isSpeedForm && (
              <div className="p-3.5 rounded-xl bg-teal-50/50 border border-teal-200">
                <label className="block font-semibold text-teal-800 mb-1">
                  If a student leaves the screen too many times
                </label>
                <select
                  value={sittingForm.leaveAction || 'SUBMIT'}
                  onChange={(e) => setSittingForm({ ...sittingForm, leaveAction: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl bg-white border border-teal-200 font-semibold"
                >
                  <option value="SUBMIT">Auto-submit the exam</option>
                  <option value="LOCK">Lock the exam so I can re-admit them</option>
                </select>
                <p className="text-[11px] text-teal-800 mt-1.5">
                  Locked students show up under Live Sittings, where you can re-admit them.
                </p>
              </div>
            )}

            {/* Speed Drill helper */}
            {isSpeedForm && (
              <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 space-y-2">
                <div className="flex items-center gap-1.5 font-semibold text-orange-800">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Speed Drill tips</span>
                  {formSecsPerQ > 0 && (
                    <span className="ml-auto font-mono text-[11px] text-orange-700">
                      ≈ {formSecsPerQ} secs per question
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[30, 60, 90, 120, 180, 300].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setDuration(String(s), 'SECS')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-orange-200 text-[11px] font-mono font-bold text-orange-700 hover:bg-orange-100"
                    >
                      {s < 60 ? `${s}s` : `${s / 60} min`}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-orange-800 leading-relaxed">
                  Speed Drills show the right answer straight away, lock each answer once picked, show results at
                  once, and rank by score first, then fastest finish (first attempt only). Leaving the screen is not
                  penalised.
                </p>
              </div>
            )}

            {/* Result release (not for Speed Drills) */}
            {!isSpeedForm && (
              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-zinc-600 mb-1">Result Release Mode</label>
                  <select
                    value={sittingForm.releaseMode}
                    onChange={(e) => setSittingForm({ ...sittingForm, releaseMode: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-white border border-zinc-200 font-semibold"
                  >
                    <option value="INSTANT">Show Immediately After Submit</option>
                    <option value="HELD">Hold Results Until Admin Releases</option>
                    <option value="SCHEDULED">Schedule Automatic Release Time</option>
                  </select>
                </div>

                {sittingForm.releaseMode === 'SCHEDULED' && (
                  <div>
                    <label className="block font-semibold text-orange-600 mb-1">
                      Scheduled Release Date & Time
                    </label>
                    <input
                      type="datetime-local"
                      required
                      value={sittingForm.releaseAt}
                      onChange={(e) => setSittingForm({ ...sittingForm, releaseAt: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-orange-300 font-mono"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Combos with fewer than 2 exams picked can still be built from subjects (advanced) */}
            {isComboForm && sittingForm.comboSittingIds.length < 2 && (
              <details className="space-y-2">
                <summary className="font-semibold text-zinc-600 cursor-pointer">
                  Advanced: build this combo from subjects instead of exams
                </summary>
                <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200">{subjectPickerEl}</div>
              </details>
            )}

            <div>
              <label className="block font-semibold text-zinc-600 mb-1">Instructions / Description</label>
              <input
                type="text"
                placeholder="Shown on the exam row on the student dashboard..."
                value={sittingForm.description}
                onChange={(e) => setSittingForm({ ...sittingForm, description: e.target.value })}
                className="w-full px-3.5 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSittingModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingSitting}
                className="flex-1 py-2.5 rounded-xl bg-[#d9531e] hover:bg-orange-600 disabled:opacity-50 text-white font-semibold"
              >
                {savingSitting
                  ? 'Saving...'
                  : `${editingSittingId ? 'Save Changes' : 'Publish Exam Sitting'}${
                      pendingModalQs > 0 ? ` + ${pendingModalQs} Questions` : ''
                    }`}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}