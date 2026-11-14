import React, { useState, useRef, useMemo } from 'react';
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
  Database,
  Archive,
  RotateCcw,
  Edit3,
  Files,
  AlertCircle,
  Share2,
  Link2,
  Mail,
  X
} from 'lucide-react';

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
  const [isUnlocked, setIsUnlocked] = useState(() => {
    return sessionStorage.getItem('aia_admin_unlocked') === 'true';
  });
  const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'pin'
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
  const [copiedShareId, setCopiedShareId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [bankCourseFilter, setBankCourseFilter] = useState('ALL');
  const [bankPage, setBankPage] = useState(0);

  // Organized Subject Catalog Filters
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectCategoryFilter, setSubjectCategoryFilter] = useState('ALL');
  const [modalSubjectSearch, setModalSubjectSearch] = useState('');

  // Access Codes Filter
  const [codesSearch, setCodesSearch] = useState('');

  // Candidates Directory Filter & Pagination
  const [candidateSearch, setCandidateSearch] = useState('');
  const [candidateDeptFilter, setCandidateDeptFilter] = useState('ALL');
  const [candidatePage, setCandidatePage] = useState(0);

  // Results Overview Controller State
  const [resultsSittingFilter, setResultsSittingFilter] = useState('ALL');
  const [resultsCandidateSearch, setResultsCandidateSearch] = useState('');
  const [resultsDeptFilter, setResultsDeptFilter] = useState('ALL');
  const [resultsPage, setResultsPage] = useState(0);
  const [scheduleDateTimeInput, setScheduleDateTimeInput] = useState('');

  // Settings Save Feedback
  const [settingsSavedBanner, setSettingsSavedBanner] = useState(false);

  const [codeGenForm, setCodeGenForm] = useState({
    quantity: 5,
    assignedTo: '',
    maxUses: 1
  });

  const [showSittingModal, setShowSittingModal] = useState(false);
  const [editingSittingId, setEditingSittingId] = useState(null);
  const [sittingForm, setSittingForm] = useState({
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
    isFeatured: true,
    shuffleQuestions: true,
    allowedCourses: [],
    status: 'OPEN',
    resultsReleased: true,
    releaseMode: 'INSTANT', // 'INSTANT' | 'HELD' | 'SCHEDULED'
    releaseAt: '',
    description: ''
  });

  const [newCourse, setNewCourse] = useState({
    code: '',
    name: '',
    category: 'General / UTME'
  });

  const fileInputRef = useRef(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvParsedRows, setCsvParsedRows] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvImportSuccess, setCsvImportSuccess] = useState('');

  // Manual Question Entry (Supports True/False or up to Option E)
  const [newQType, setNewQType] = useState('MCQ'); // 'MCQ' | 'TF'
  const [newQ, setNewQ] = useState({
    courseId: courses[0]?.id || 'ana-301',
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

  // UNIFIED ADMIN AUTH: Works with Organiser Email + Password/PIN OR Supabase Auth OR Quick PIN
  const handleAdminUnlock = async (e) => {
    e.preventDefault();
    setPinError('');
    setAuthLoading(true);

    const savedPin = String(platformConfig?.adminPin || '2026').trim();
    const savedOrgEmail = String(
      platformConfig?.organiserEmail || 'ayodejiakin2020@gmail.com'
    )
      .trim()
      .toLowerCase();

    try {
      if (loginMethod === 'email') {
        const cleanEmail = adminEmail.trim().toLowerCase();
        const cleanPass = adminPassword.trim();

        // 1. Direct Organiser Match (Email matches organiser email + Password matches Admin PIN / Brilly2405 / 2026)
        if (
          cleanEmail === savedOrgEmail &&
          (cleanPass === savedPin ||
            cleanPass === 'Brilly2405' ||
            cleanPass === '2026')
        ) {
          sessionStorage.setItem('aia_admin_unlocked', 'true');
          setIsUnlocked(true);
          logAdminAction(`Organiser ${cleanEmail} signed in`, 'Auth');
          return;
        }

        // 2. Try Supabase Auth Sign-In
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

  // STRICT COPY: Copies ONLY the direct exam link (`/?exam=<sitting_id>`)
  const handleCopyExamShareLink = (sit) => {
    const link = `${window.location.origin}/?exam=${sit.id}`;
    navigator.clipboard.writeText(link);
    setCopiedShareId(sit.id);
    setTimeout(() => setCopiedShareId(null), 2200);
  };

  // NATIVE SHARE: Opens system share drawer or falls back to strict copy
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

  const openCreateSittingModal = () => {
    setEditingSittingId(null);
    setModalSubjectSearch('');
    setSittingForm({
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
      isFeatured: true,
      shuffleQuestions: true,
      allowedCourses: [],
      status: 'OPEN',
      resultsReleased: true,
      releaseMode: 'INSTANT',
      releaseAt: '',
      description: ''
    });
    setShowSittingModal(true);
  };

  const openEditSittingModal = (sit) => {
    setEditingSittingId(sit.id);
    setModalSubjectSearch('');
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
      durationMins: sit.durationMins || 15,
      questionCount: sit.questionCount || 20,
      passMark: sit.passMark || 50,
      maxTabSwitches: sit.maxTabSwitches || 3,
      isFeatured: Boolean(sit.isFeatured),
      shuffleQuestions: sit.shuffleQuestions !== false,
      allowedCourses: sit.allowedCourses || [],
      status: sit.status || 'OPEN',
      resultsReleased: sit.resultsReleased !== false,
      releaseMode:
        sit.releaseMode || (sit.resultsReleased === false ? 'HELD' : 'INSTANT'),
      releaseAt: sit.releaseAt ? String(sit.releaseAt).slice(0, 16) : '',
      description: sit.description || ''
    });
    setShowSittingModal(true);
  };

  const handleSaveSitting = async (e) => {
    e.preventDefault();
    if (!sittingForm.title.trim()) return;

    const finalAllowedModes =
      sittingForm.allowedModes.length > 0 ? sittingForm.allowedModes : [sittingForm.mode];

    const isReleasedBool = sittingForm.releaseMode === 'INSTANT';
    const isoReleaseAt =
      sittingForm.releaseMode === 'SCHEDULED' && sittingForm.releaseAt
        ? new Date(sittingForm.releaseAt).toISOString()
        : null;

    const payload = {
      id: editingSittingId || 'sit_' + Date.now(),
      title: sittingForm.title.trim(),
      mode: sittingForm.mode,
      allowedModes: finalAllowedModes,
      targetCourse: sittingForm.targetCourse || 'All Courses',
      priceNaira: Number(sittingForm.priceNaira) || 0,
      retakePriceNaira: Number(sittingForm.retakePriceNaira) || 0,
      requiresCode: Boolean(sittingForm.requiresCode),
      durationMins: Number(sittingForm.durationMins) || 15,
      questionCount: Number(sittingForm.questionCount) || 20,
      passMark: Number(sittingForm.passMark) || 50,
      maxTabSwitches: Math.max(1, Number(sittingForm.maxTabSwitches) || 3),
      isFeatured: Boolean(sittingForm.isFeatured),
      shuffleQuestions: Boolean(sittingForm.shuffleQuestions),
      allowedCourses: sittingForm.allowedCourses,
      status: sittingForm.status || 'OPEN',
      resultsReleased: isReleasedBool,
      releaseMode: sittingForm.releaseMode || 'INSTANT',
      releaseAt: isoReleaseAt,
      description:
        sittingForm.description.trim() ||
        `${sittingForm.mode} assessment for ${sittingForm.targetCourse}.`,
      createdAt: new Date().toISOString()
    };

    if (editingSittingId) {
      setSittings((prev) =>
        prev.map((s) => (s.id === editingSittingId ? { ...s, ...payload } : s))
      );
      logAdminAction('Edited exam sitting', payload.title);
    } else {
      setSittings((prev) => [payload, ...prev]);
      logAdminAction(`Created ${payload.mode} exam`, payload.title);
    }

    if (isSupabaseConfigured && supabase) {
      await supabase.from('sittings').upsert({
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
        is_featured: payload.isFeatured,
        shuffle_questions: payload.shuffleQuestions,
        allowed_courses: payload.allowedCourses,
        status: payload.status,
        results_released: payload.resultsReleased,
        release_mode: payload.releaseMode,
        release_at: payload.releaseAt,
        description: payload.description
      });
    }

    setShowSittingModal(false);
    setEditingSittingId(null);
  };

  const handleDuplicateSitting = async (sit) => {
    const copy = {
      ...sit,
      id: 'sit_' + Date.now(),
      title: `${sit.title} (Copy)`,
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
        question_count: copy.questionCount,
        pass_mark: copy.passMark || 50,
        max_tab_switches: copy.maxTabSwitches || 3,
        allowed_courses: copy.allowedCourses || [],
        status: copy.status,
        results_released: copy.resultsReleased,
        release_mode: copy.releaseMode || 'INSTANT',
        release_at: copy.releaseAt || null,
        description: copy.description
      });
    }
    logAdminAction('Duplicated sitting', copy.title);
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
    if (
      !window.confirm(
        `Permanently delete "${sit.title}"? To hide it without deleting, use Archive instead.`
      )
    ) {
      return;
    }
    setSittings((prev) => prev.filter((s) => s.id !== sit.id));
    if (isSupabaseConfigured && supabase) {
      await supabase.from('sittings').delete().eq('id', sit.id);
    }
    logAdminAction('Deleted exam sitting permanently', sit.title);
  };

  const handleUpdateSitting = async (id, patch) => {
    setSittings((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    if (isSupabaseConfigured && supabase) {
      const dbPatch = {};
      if (patch.priceNaira !== undefined) dbPatch.price_naira = patch.priceNaira;
      if (patch.retakePriceNaira !== undefined) dbPatch.retake_price_naira = patch.retakePriceNaira;
      if (patch.durationMins !== undefined) dbPatch.duration_mins = patch.durationMins;
      if (patch.maxTabSwitches !== undefined) dbPatch.max_tab_switches = patch.maxTabSwitches;
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

  // UPDATED 10-COLUMN CSV TEMPLATE (Supports A-E and True/False in the same sheet!)
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

  // SMART CSV PARSER: Supports both 9-column (A-D) and 10-column (A-E) + True/False rows seamlessly
  const handleCsvFileSelected = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    setCsvImportSuccess('');

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = String(event.target?.result || '');
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        setCsvErrors(['The selected .csv file is empty.']);
        setCsvParsedRows([]);
        return;
      }

      const parsed = [];
      const errs = [];

      const headerLower = lines[0].toLowerCase();
      const hasHeader =
        headerLower.includes('question') || headerLower.includes('course');
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
          [rawCode, questionText, optA, optB, optC, optD, optE, rawCorrect, explanation, passage] =
            cols;
        } else {
          [rawCode, questionText, optA, optB, optC, optD, rawCorrect, explanation, passage] = cols;
          optE = '';
        }

        if (!questionText || !optA || !optB) {
          errs.push(`Row ${i + 1}: Missing question text or Options A & B.`);
          continue;
        }

        const matchedCourse =
          courses.find(
            (c) =>
              c.code.toLowerCase() === String(rawCode).trim().toLowerCase() ||
              c.id.toLowerCase() === String(rawCode).trim().toLowerCase()
          ) || courses[0];

        const options = [];
        if (optA && String(optA).trim()) options.push(String(optA).trim());
        if (optB && String(optB).trim()) options.push(String(optB).trim());
        if (optC && String(optC).trim()) options.push(String(optC).trim());
        if (optD && String(optD).trim()) options.push(String(optD).trim());
        if (optE && String(optE).trim()) options.push(String(optE).trim());

        const cleanAns = String(rawCorrect || 'A').trim().toUpperCase();
        let correctIndex = 0;
        if (cleanAns === 'A' || cleanAns === '0' || cleanAns === 'TRUE' || cleanAns === 'T') {
          correctIndex = 0;
        } else if (
          cleanAns === 'B' ||
          cleanAns === '1' ||
          cleanAns === 'FALSE' ||
          cleanAns === 'F'
        ) {
          correctIndex = 1;
        } else if (cleanAns === 'C' || cleanAns === '2') {
          correctIndex = 2;
        } else if (cleanAns === 'D' || cleanAns === '3') {
          correctIndex = 3;
        } else if (cleanAns === 'E' || cleanAns === '4') {
          correctIndex = 4;
        }

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

      setCsvParsedRows(parsed);
      setCsvErrors(errs);
    };
    reader.readAsText(file);
  };

  const handleCommitCsvUpload = async () => {
    if (csvParsedRows.length === 0) return;

    if (isSupabaseConfigured && supabase) {
      const { data: insertedRows, error } = await supabase
        .from('questions')
        .insert(
          csvParsedRows.map((q) => ({
            course_id: q.courseId,
            course_code: q.courseCode,
            passage: q.passage,
            question: q.question,
            options: q.options,
            correct_index: q.correctIndex,
            explanation: q.explanation
          }))
        )
        .select();

      if (!error && insertedRows?.length) {
        const formatted = insertedRows.map((q) => ({
          id: q.id,
          courseId: q.course_id,
          courseCode: q.course_code,
          passage: q.passage,
          question: q.question,
          options: q.options,
          correctIndex: q.correct_index,
          explanation: q.explanation
        }));
        setQuestionBank((prev) => [...formatted, ...prev]);
      } else {
        setQuestionBank((prev) => [...csvParsedRows, ...prev]);
      }
    } else {
      setQuestionBank((prev) => [...csvParsedRows, ...prev]);
    }

    logAdminAction(`Uploaded ${csvParsedRows.length} questions via .CSV file`, csvFileName);
    setCsvImportSuccess(
      `Successfully imported ${csvParsedRows.length} questions from ${csvFileName}.`
    );
    setCsvParsedRows([]);
    setCsvErrors([]);
    setCsvFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // UNIVERSAL 1-USE CODE GENERATOR: Generates codes that unlock ANY sitting once
  const handleGenerateCodes = async (e) => {
    e.preventDefault();
    const count = Math.min(50, Math.max(1, Number(codeGenForm.quantity) || 1));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

    const generated = Array.from({ length: count }).map((_, idx) => {
      const part1 = Array.from({ length: 4 })
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('');
      const part2 = Array.from({ length: 3 })
        .map(() => chars[Math.floor(Math.random() * chars.length)])
        .join('');
      return {
        id: 'code_' + Date.now() + '_' + idx,
        code: `AIA-${part1}-${part2}`,
        sittingId: 'ALL',
        sittingTitle: 'Universal 1-Use Pass (Any Exam)',
        mode: 'ALL',
        priceNaira: 1000,
        assignedTo: codeGenForm.assignedTo.trim(),
        status: 'LIVE',
        maxUses: 1,
        usedCount: 0,
        createdAt: new Date().toLocaleDateString()
      };
    });

    setAccessCodes((prev) => [...generated, ...prev]);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('access_codes').insert(
        generated.map((g) => ({
          code: g.code,
          sitting_id: null,
          sitting_title: g.sittingTitle,
          mode: 'ALL',
          price_naira: g.priceNaira,
          assigned_to: g.assignedTo,
          status: 'LIVE',
          max_uses: 1,
          used_count: 0
        }))
      );
    }

    logAdminAction(`Generated ${count} universal 1-use access code(s)`, 'Universal Pool');
    setCodeGenForm({ ...codeGenForm, assignedTo: '' });
  };

  const handleCopyCode = (codeStr) => {
    navigator.clipboard.writeText(codeStr);
    setCopiedCode(codeStr);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleDeleteOrRevokeCode = async (codeObj) => {
    setAccessCodes((prev) => prev.filter((c) => c.code !== codeObj.code));
    if (isSupabaseConfigured && supabase) {
      await supabase.from('access_codes').delete().eq('code', codeObj.code);
    }
    logAdminAction(`Removed code ${codeObj.code}`, 'Codes');
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    const targetCourse = courses.find((c) => c.id === newQ.courseId) || courses[0];

    const builtOptions =
      newQType === 'TF'
        ? ['True', 'False']
        : [
            newQ.optionA.trim(),
            newQ.optionB.trim(),
            newQ.optionC.trim(),
            newQ.optionD.trim(),
            newQ.optionE.trim()
          ].filter(Boolean);

    const safeCorrectIdx = Math.min(
      Number(newQ.correctIndex) || 0,
      Math.max(0, builtOptions.length - 1)
    );

    const draft = {
      id: 'q_' + Date.now(),
      courseId: targetCourse.id,
      courseCode: targetCourse.code,
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
          passage: draft.passage,
          question: draft.question,
          options: draft.options,
          correct_index: draft.correctIndex,
          explanation: draft.explanation
        })
        .select()
        .single();

      if (savedRow) {
        draft.id = savedRow.id;
      }
    }

    setQuestionBank((prev) => [draft, ...prev]);
    logAdminAction('Added question to bank', targetCourse.code);
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
    reader.onload = () => {
      setNewAnn((prev) => ({ ...prev, imageUrl: String(reader.result) }));
    };
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
    if (announcements.length >= 3) {
      alert('Maximum of 3 announcements allowed in the carousel. Delete one first.');
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

    setAnnouncements((prev) => [created, ...prev].slice(0, 3));
    logAdminAction('Published dashboard announcement', created.title);
    setNewAnn({ title: '', body: '', imageUrl: '', ctaLabel: 'Register Now', ctaUrl: '' });
  };

  // Export CSV of Results for Selected Sitting
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

  // Question counts per course for organized subject management
  const questionCountByCourse = useMemo(() => {
    const counts = {};
    questionBank.forEach((q) => {
      counts[q.courseId] = (counts[q.courseId] || 0) + 1;
    });
    return counts;
  }, [questionBank]);

  const distinctSubjectCategories = useMemo(() => {
    return ['ALL', ...Array.from(new Set(courses.map((c) => c.category || 'General / UTME')))];
  }, [courses]);

  const organizedCourses = useMemo(() => {
    return [...courses]
      .filter((c) => {
        const matchesCat =
          subjectCategoryFilter === 'ALL' || (c.category || 'General / UTME') === subjectCategoryFilter;
        const matchesSearch =
          c.code.toLowerCase().includes(subjectSearch.toLowerCase()) ||
          c.name.toLowerCase().includes(subjectSearch.toLowerCase());
        return matchesCat && matchesSearch;
      })
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [courses, subjectCategoryFilter, subjectSearch]);

  // Aggregated Candidates Directory
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
            <button
              type="button"
              onClick={() => {
                setLoginMethod('email');
                setPinError('');
              }}
              className={`py-2 rounded-lg ${
                loginMethod === 'email' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'
              }`}
            >
              Organiser Login
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginMethod('pin');
                setPinError('');
              }}
              className={`py-2 rounded-lg ${
                loginMethod === 'pin' ? 'bg-white shadow-sm text-zinc-900' : 'text-zinc-500'
              }`}
            >
              Quick PIN
            </button>
          </div>

          {pinError && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
              {pinError}
            </p>
          )}

          <form onSubmit={handleAdminUnlock} className="space-y-4">
            {loginMethod === 'email' ? (
              <>
                <div>
                  <label className="block text-xs font-semibold text-zinc-600 mb-1">
                    Organiser Email
                  </label>
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
                <label className="block text-xs font-semibold text-zinc-600 mb-1.5">
                  Organiser Quick PIN
                </label>
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
  const unusedCodes = accessCodes.filter((c) => c.status !== 'USED');
  const liveCodesCount = unusedCodes.filter((c) => c.status === 'LIVE').length;

  const displayedSittings = (
    sittingLifecycleTab === 'archived' ? archivedSittings : activeSittings
  ).filter((sit) => {
    const matchesCat =
      sittingCategoryFilter === 'ALL' ||
      sit.mode === sittingCategoryFilter ||
      (Array.isArray(sit.allowedModes) && sit.allowedModes.includes(sittingCategoryFilter));
    const matchesQuery =
      sit.title.toLowerCase().includes(sittingSearch.toLowerCase()) ||
      (sit.targetCourse || '').toLowerCase().includes(sittingSearch.toLowerCase());
    return matchesCat && matchesQuery;
  });

  const ITEMS_PER_PAGE = 6;
  const filteredQuestions = questionBank.filter((q) => {
    const matchesCourse = bankCourseFilter === 'ALL' || q.courseId === bankCourseFilter;
    const matchesText =
      q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      q.courseCode.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCourse && matchesText;
  });
  const totalBankPages = Math.max(1, Math.ceil(filteredQuestions.length / ITEMS_PER_PAGE));
  const paginatedQuestions = filteredQuestions.slice(
    bankPage * ITEMS_PER_PAGE,
    (bankPage + 1) * ITEMS_PER_PAGE
  );

  // Results Tab Computed Data
  const selectedResultSitting =
    resultsSittingFilter === 'ALL'
      ? activeSittings[0] || sittings[0]
      : sittings.find((s) => s.id === resultsSittingFilter) || sittings[0];

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
  const totalResultPages = Math.max(
    1,
    Math.ceil(resultsForSelectedSitting.length / RESULTS_PER_PAGE)
  );
  const paginatedResultsRows = resultsForSelectedSitting.slice(
    resultsPage * RESULTS_PER_PAGE,
    (resultsPage + 1) * RESULTS_PER_PAGE
  );

  const highestScoreInView =
    resultsForSelectedSitting.length > 0
      ? Math.max(...resultsForSelectedSitting.map((r) => r.score))
      : 0;
  const avgScoreInView =
    resultsForSelectedSitting.length > 0
      ? Math.round(
          resultsForSelectedSitting.reduce((acc, r) => acc + r.score, 0) /
            resultsForSelectedSitting.length
        )
      : 0;
  const passCountInView = resultsForSelectedSitting.filter(
    (r) => r.score >= (selectedResultSitting?.passMark || 50)
  ).length;

  const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'sittings', label: `Exams & Sittings (${activeSittings.length})`, icon: CalendarClock },
    { id: 'bank', label: `Subjects & CSV (${courses.length})`, icon: BookOpen },
    { id: 'codes', label: `Access Codes (${liveCodesCount})`, icon: KeyRound },
    { id: 'candidates', label: `Candidates (${aggregatedCandidates.length})`, icon: Users },
    { id: 'results', label: 'Results & Release', icon: Trophy },
    { id: 'announcements', label: `Announcements (${announcements.length}/3)`, icon: Megaphone },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'audit', label: 'Audit log', icon: History },
    { id: 'team', label: 'Team', icon: UserCheck }
  ];

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-zinc-900 flex flex-col md:flex-row font-sans">
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
              onClick={async () => {
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
        {/* ====================================================================
            1. OVERVIEW TAB
        ==================================================================== */}
        {activeNav === 'overview' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-serif font-normal tracking-tight text-zinc-900">
                  Overview
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                  Manage Saturday Official Mocks, control result releases, copy direct student links, and issue universal single-use codes.
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
              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-2">
                <span className="text-xs text-zinc-500 font-medium block">Live exams</span>
                <p className="text-3xl font-bold font-mono">{openSittingsCount}</p>
                <span className="text-xs text-zinc-400 block">
                  {archivedSittings.length} archived
                </span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-2">
                <span className="text-xs text-zinc-500 font-medium block">1st-Try Submissions</span>
                <p className="text-3xl font-bold font-mono">{standings.length}</p>
                <span className="text-xs text-zinc-400 block">verified rankings</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-2">
                <span className="text-xs text-zinc-500 font-medium block">Candidates</span>
                <p className="text-3xl font-bold font-mono">{aggregatedCandidates.length}</p>
                <span className="text-xs text-zinc-400 block">{liveCodesCount} unused codes</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-2">
                <span className="text-xs text-zinc-500 font-medium block">Question bank</span>
                <p className="text-3xl font-bold font-mono">{questionBank.length}</p>
                <span className="text-xs text-zinc-400 block">{courses.length} subjects</span>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-sm">Active Categorized Exams (Quick Share & Release Status)</h2>
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
                  const relMode =
                    sit.releaseMode || (sit.resultsReleased === false ? 'HELD' : 'INSTANT');
                  return (
                    <div
                      key={sit.id}
                      className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded bg-orange-500/10 text-orange-600 flex-shrink-0">
                          {(sit.allowedModes || [sit.mode]).join(' + ')}
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm text-zinc-900 truncate">
                              {sit.title}
                            </span>
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
                          </div>
                          <span className="text-zinc-500 block truncate">
                            Course: <strong>{sit.targetCourse || 'All Courses'}</strong> •{' '}
                            {sit.durationMins} mins • Max Leaves: {sit.maxTabSwitches || 3} •{' '}
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
                          title="Copy Strict Exam URL Only"
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
                          title="Share Exam"
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

        {/* ====================================================================
            2. EXAMS & SITTINGS MANAGER
        ==================================================================== */}
        {activeNav === 'sittings' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Exams & Sittings Manager</h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Configure 1st-attempt & retake pricing, screen-leave anti-cheat limits, result release policies, and direct share links.
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
                    sittingLifecycleTab === 'active'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600'
                  }`}
                >
                  Active Exams ({activeSittings.length})
                </button>
                <button
                  onClick={() => setSittingLifecycleTab('archived')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 ${
                    sittingLifecycleTab === 'archived'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-zinc-100 text-zinc-600'
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
                const relMode =
                  sit.releaseMode || (sit.resultsReleased === false ? 'HELD' : 'INSTANT');

                return (
                  <div
                    key={sit.id}
                    className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-600">
                            {(sit.allowedModes || [sit.mode]).join(' + ')}
                          </span>
                          <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded bg-teal-500/10 text-teal-700">
                            Course: {sit.targetCourse || 'All Courses'}
                          </span>
                          <h3 className="font-bold text-base text-zinc-900 truncate">{sit.title}</h3>
                        </div>
                        <p className="text-xs text-zinc-500">{sit.description}</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={() => handleCopyExamShareLink(sit)}
                          className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold flex items-center gap-1.5 hover:bg-orange-100"
                          title="Copy Strict Exam Link Only"
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

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">
                          1st Try Price (₦)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={sit.priceNaira ?? 0}
                          onChange={(e) =>
                            handleUpdateSitting(sit.id, { priceNaira: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">
                          2nd Try Retake (₦)
                        </label>
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={sit.retakePriceNaira ?? 0}
                          onChange={(e) =>
                            handleUpdateSitting(sit.id, {
                              retakePriceNaira: Number(e.target.value)
                            })
                          }
                          placeholder="0 = Free"
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold text-orange-600"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">
                          Duration (Mins)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={sit.durationMins}
                          onChange={(e) =>
                            handleUpdateSitting(sit.id, { durationMins: Number(e.target.value) })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">
                          Max Screen Leaves
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={20}
                          value={sit.maxTabSwitches || 3}
                          onChange={(e) =>
                            handleUpdateSitting(sit.id, {
                              maxTabSwitches: Math.max(1, Number(e.target.value))
                            })
                          }
                          className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">
                          Result Release
                        </label>
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
                      </div>

                      <div>
                        <label className="block text-zinc-400 font-medium mb-1">
                          1st Try Gate
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            handleUpdateSitting(sit.id, { requiresCode: !sit.requiresCode })
                          }
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

        {/* ====================================================================
            3. SUBJECTS & 10-COLUMN .CSV BANK (Organized & Grouped!)
        ==================================================================== */}
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
                  {courses.length} Subjects • {questionBank.length} Total Questions
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

              {/* Search & Category Filter Bar for Subjects */}
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

              {/* Clean Scrollable Grid of Subject Cards */}
              <div className="max-h-64 overflow-y-auto pr-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {organizedCourses.map((c) => {
                  const qCount = questionCountByCourse[c.id] || 0;
                  return (
                    <div
                      key={c.id}
                      className="p-3 rounded-xl border border-zinc-200/90 bg-[#fbfaf8] hover:border-orange-400 flex items-center justify-between gap-2 text-xs transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <strong className="font-mono text-orange-600">{c.code}</strong>
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-200/80 text-zinc-700 font-bold">
                            {qCount} Qs
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
                  );
                })}
              </div>
            </div>

            {/* 2. BULK .CSV DOCUMENT UPLOADER (Supports A-E & True/False in the same sheet!) */}
            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">
                      2. Bulk Upload Questions via `.CSV` (Supports Option A–E & True/False)
                    </h2>
                    <p className="text-xs text-zinc-500">
                      Mix 5-option MCQs (A–E), 4-option MCQs (A–D), and True/False questions inside the same `.csv` file!
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
                <span className="font-semibold text-zinc-700 block">
                  Required `.CSV` Columns (in order):
                </span>
                <p className="font-mono text-[11px] text-orange-600 break-all">
                  course_code , question , option_a , option_b , option_c , option_d , option_e , correct_option (A/B/C/D/E or TRUE/FALSE) , explanation , passage
                </p>
                <p className="text-[11px] text-zinc-500">
                  • <strong>For True/False questions:</strong> Put <code>True</code> in <code>option_a</code>, <code>False</code> in <code>option_b</code>, leave <code>option_c</code>, <code>option_d</code>, and <code>option_e</code> blank, and put <code>A</code> (or <code>B</code>) in <code>correct_option</code>.
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
                  {csvFileName
                    ? `Selected File: ${csvFileName}`
                    : 'Click to select a .CSV document from your computer'}
                </p>
                <p className="text-xs text-zinc-400 mt-1">
                  Supports both 10-column (A–E) and 9-column (A–D) `.csv` files
                </p>
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
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-teal-700">
                      Ready to import {csvParsedRows.length} verified question(s) from {csvFileName}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCsvParsedRows([]);
                          setCsvFileName('');
                        }}
                        className="px-3 py-1.5 rounded-xl border border-zinc-200 text-xs font-semibold"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleCommitCsvUpload}
                        className="px-5 py-2 rounded-xl bg-[#d9531e] hover:bg-orange-600 text-white text-xs font-bold"
                      >
                        Confirm & Import {csvParsedRows.length} Questions
                      </button>
                    </div>
                  </div>

                  <div className="max-h-56 overflow-y-auto border border-zinc-200 rounded-xl divide-y divide-zinc-100 text-xs">
                    {csvParsedRows.slice(0, 8).map((row, idx) => (
                      <div key={idx} className="p-3 flex items-center justify-between gap-4">
                        <div className="min-w-0">
                          <span className="font-mono font-bold text-orange-600 mr-2">
                            [{row.courseCode}]
                          </span>
                          <span className="font-medium">{row.question}</span>
                          <span className="ml-2 text-[10px] font-mono text-zinc-400">
                            ({row.options.length} opts)
                          </span>
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

            {/* 3. SINGLE QUESTION EDITOR (With MCQ A-E or True/False Toggle) + QUESTION BANK */}
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
                            newQ.correctIndex === 0
                              ? 'bg-teal-600 text-white'
                              : 'bg-white border border-zinc-200'
                          }`}
                        >
                          A: True
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewQ({ ...newQ, correctIndex: 1 })}
                          className={`px-4 py-1.5 rounded-lg font-bold ${
                            newQ.correctIndex === 1
                              ? 'bg-orange-600 text-white'
                              : 'bg-white border border-zinc-200'
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
                        onChange={(e) =>
                          setNewQ({ ...newQ, correctIndex: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-semibold"
                      >
                        <option value={0}>Correct: Option A</option>
                        <option value={1}>Correct: Option B</option>
                        <option value={2}>Correct: Option C</option>
                        <option value={3}>Correct: Option D</option>
                        <option value={4}>Correct: Option E</option>
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
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <select
                    value={bankCourseFilter}
                    onChange={(e) => {
                      setBankCourseFilter(e.target.value);
                      setBankPage(0);
                    }}
                    className="px-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs font-semibold"
                  >
                    <option value="ALL">All Subjects ({questionBank.length})</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name} ({questionCountByCourse[c.id] || 0})
                      </option>
                    ))}
                  </select>

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
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-orange-600">
                            {item.courseCode}
                          </span>
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 text-zinc-500">
                            {item.options.length === 2
                              ? 'True/False'
                              : `${item.options.length} Options`}
                          </span>
                        </div>
                        <button
                          onClick={async () => {
                            setQuestionBank((prev) => prev.filter((q) => q.id !== item.id));
                            if (isSupabaseConfigured && supabase) {
                              await supabase.from('questions').delete().eq('id', item.id);
                            }
                            logAdminAction('Deleted question from bank', item.courseCode);
                          }}
                          className="text-zinc-400 hover:text-red-500"
                          title="Delete Question"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-xs font-medium">{item.question}</p>
                      <p className="text-[11px] font-mono text-teal-700">
                        Ans: {['A', 'B', 'C', 'D', 'E'][item.correctIndex]} —{' '}
                        {item.options[item.correctIndex]}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            4. UNIVERSAL SINGLE-USE ACCESS CODES TAB (Auto-Hides USED Codes)
        ==================================================================== */}
        {activeNav === 'codes' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h1 className="text-2xl font-bold">Universal Single-Use Access Codes</h1>
                <p className="text-xs text-zinc-500 mt-1">
                  One universal code generator for all exams. Each code unlocks any paid sitting once and disappears immediately after use.
                </p>
              </div>
              <span className="font-mono text-xs px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold self-start">
                {unusedCodes.length} Unused Live Code(s)
              </span>
            </div>

            <form
              onSubmit={handleGenerateCodes}
              className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-4 items-end"
            >
              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  Quantity to Generate (1–50)
                </label>
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
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  Candidate Name / Note (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Paid via WhatsApp — Universal 1-Use Code"
                  value={codeGenForm.assignedTo}
                  onChange={(e) => setCodeGenForm({ ...codeGenForm, assignedTo: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs"
                />
              </div>

              <button
                type="submit"
                className="py-2.5 px-4 rounded-xl bg-[#d9531e] hover:bg-orange-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Generate Universal Codes</span>
              </button>
            </form>

            {/* Search Bar for Live Codes */}
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-semibold text-zinc-500">
                Active Unused Pool ({unusedCodes.length})
              </span>
              <div className="relative w-full sm:w-72">
                <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={codesSearch}
                  onChange={(e) => setCodesSearch(e.target.value)}
                  placeholder="Search code or candidate note..."
                  className="w-full pl-8 pr-3 py-2 rounded-xl bg-white border border-zinc-200 text-xs"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm divide-y divide-zinc-100 overflow-hidden">
              {unusedCodes
                .filter((c) => {
                  return (
                    c.code.toLowerCase().includes(codesSearch.toLowerCase()) ||
                    (c.assignedTo || '').toLowerCase().includes(codesSearch.toLowerCase())
                  );
                })
                .map((c) => (
                  <div
                    key={c.id || c.code}
                    className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-sm font-bold px-3 py-1.5 rounded-xl bg-zinc-100 text-zinc-900">
                        {c.code}
                      </span>
                      <div>
                        <span className="font-semibold text-zinc-900 block">
                          Universal 1-Use Pass (Valid on Any Sitting)
                        </span>
                        <span className="text-zinc-400">
                          {c.assignedTo ? `Note: ${c.assignedTo}` : 'Ready to issue'} • Disappears once used
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md font-mono text-[10px] font-bold bg-emerald-50 text-emerald-700">
                        {c.status}
                      </span>

                      <button
                        onClick={() => handleCopyCode(c.code)}
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
                            <span>Copy Code</span>
                          </>
                        )}
                      </button>

                      <button
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
          </div>
        )}

        {/* ====================================================================
            5. CANDIDATES DIRECTORY TAB
        ==================================================================== */}
        {activeNav === 'candidates' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">
                  Registered Candidates ({aggregatedCandidates.length})
                </h1>
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
                const matchesDept =
                  candidateDeptFilter === 'ALL' || c.dept === candidateDeptFilter;
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
                          <div className="col-span-1 font-mono font-bold text-zinc-400">
                            {rankNum}
                          </div>
                          <div className="col-span-4 pr-3 min-w-0">
                            <span className="font-bold text-zinc-900 block truncate">
                              {cand.name}
                            </span>
                            <span className="text-[11px] text-zinc-500 block truncate">
                              {cand.institution}
                            </span>
                          </div>
                          <div className="col-span-3 pr-2 truncate font-medium text-zinc-700">
                            {cand.dept}
                          </div>
                          <div className="col-span-2 text-center font-mono font-bold">
                            {cand.attempts}
                          </div>
                          <div className="col-span-2 text-right font-mono">
                            <span className="font-extrabold text-orange-600 block">
                              {cand.bestScore}%
                            </span>
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
                          onClick={() =>
                            setCandidatePage((p) => Math.min(totalCandPages - 1, p + 1))
                          }
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

        {/* ====================================================================
            6. RESULTS & RELEASE OVERVIEW TAB
        ==================================================================== */}
        {activeNav === 'results' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <p className="text-xs sm:text-sm text-zinc-500 max-w-xl leading-relaxed">
                Scores are calculated on the server. When a sitting is set to <strong>Held</strong> or <strong>Scheduled</strong>, candidates see a locked submission receipt until you release results.
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
                    handleExportResultsCsv(
                      resultsForSelectedSitting,
                      selectedResultSitting?.title || 'All_Sittings'
                    )
                  }
                  className="px-4 py-2.5 rounded-xl bg-white border border-zinc-200/90 hover:bg-zinc-50 text-xs font-semibold flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export CSV</span>
                </button>
              </div>
            </div>

            {selectedResultSitting && (
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
                      {(selectedResultSitting.releaseMode || 'INSTANT') === 'SCHEDULED' &&
                      selectedResultSitting.releaseAt
                        ? `Unlocks automatically on ${new Date(
                            selectedResultSitting.releaseAt
                          ).toLocaleString()} • scores and answer review`
                        : 'Controls candidate access to percentage scores, positions, and question corrections'}
                    </p>
                  </div>
                </div>

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
                      handleUpdateSitting(selectedResultSitting.id, {
                        releaseMode: 'HELD',
                        resultsReleased: false
                      });
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
              </div>
            )}

            {/* 4 KPI Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-1">
                <span className="text-xs text-zinc-500 font-medium block">Submitted (1st Try)</span>
                <p className="text-3xl font-bold font-mono">{resultsForSelectedSitting.length}</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-1">
                <span className="text-xs text-zinc-500 font-medium block">
                  Passed (≥{selectedResultSitting?.passMark || 50}%)
                </span>
                <p className="text-3xl font-bold font-mono text-emerald-700">{passCountInView}</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-1">
                <span className="text-xs text-zinc-500 font-medium block">Average Score</span>
                <p className="text-3xl font-bold font-mono">{avgScoreInView}%</p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-1">
                <span className="text-xs text-zinc-500 font-medium block">Highest Score</span>
                <p className="text-3xl font-bold font-mono text-orange-600">
                  {highestScoreInView}%
                </p>
              </div>
            </div>

            {/* Candidates Result Table Header + Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
              <div>
                <h2 className="font-bold text-base">Candidates Standings Overview</h2>
                <p className="text-xs text-zinc-500">
                  Positions ordered by 1st-attempt score and finish speed.
                </p>
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

            {/* Proper Candidates Table */}
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

                        <div className="col-span-3 pr-2 truncate text-zinc-700 font-medium">
                          {r.dept}
                        </div>

                        <div className="col-span-1 text-right font-mono text-zinc-500">
                          {formatSecs(r.timeSecs)}
                        </div>

                        <div className="col-span-2 flex items-center justify-end gap-3 font-mono">
                          <span className="font-extrabold text-sm text-orange-600">
                            {r.score}%
                          </span>
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

        {/* ====================================================================
            7. ANNOUNCEMENTS TAB (Max 3 Square Cards)
        ==================================================================== */}
        {activeNav === 'announcements' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-6 bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
              <div>
                <h2 className="font-bold text-base">Post Square Dashboard Announcement</h2>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Appears in the 1:1 square carousel directly beneath Top Standings on the student homepage (Max 3 slides).
                </p>
              </div>

              <form onSubmit={handleAddAnnouncement} className="space-y-3.5 text-xs">
                <div>
                  <label className="block font-semibold text-zinc-600 mb-1">
                    Square Flyer / Image (Upload or Paste URL)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleAnnouncementImageUpload}
                    className="w-full text-xs mb-2"
                  />
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
                  <label className="block font-semibold text-zinc-600 mb-1">
                    Short Caption Below Square Image
                  </label>
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
                    <label className="block font-semibold text-zinc-600 mb-1">
                      Click Destination URL
                    </label>
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
                  disabled={announcements.length >= 3}
                  className="w-full py-2.5 rounded-xl bg-[#d9531e] disabled:opacity-40 text-white font-semibold"
                >
                  {announcements.length >= 3
                    ? 'Max 3 Active Slides Reached'
                    : 'Publish to Student Carousel'}
                </button>
              </form>
            </div>

            <div className="lg:col-span-6 space-y-4">
              <h3 className="font-bold text-sm">
                Active Carousel Slides ({announcements.length} / 3 Max)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {announcements.map((ann, idx) => (
                  <div
                    key={ann.id}
                    className="bg-white rounded-2xl border border-zinc-200/80 overflow-hidden shadow-sm flex flex-col justify-between"
                  >
                    <div>
                      <div className="w-full aspect-square bg-zinc-100 relative overflow-hidden">
                        <img
                          src={ann.imageUrl}
                          alt={ann.title}
                          className="w-full h-full object-cover"
                        />
                        <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-md bg-black/75 text-white font-mono text-[10px]">
                          Slide {idx + 1}/3
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

        {/* ====================================================================
            8. SETTINGS TAB (Fixed Backspace Bug with ?? '')
        ==================================================================== */}
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
                    onChange={(e) =>
                      setPlatformConfig((p) => ({ ...p, whatsappNumber: e.target.value }))
                    }
                    placeholder="e.g. 2348000000000"
                    className="w-full px-4 py-3 rounded-xl bg-zinc-50 border border-zinc-200 focus:border-orange-500 outline-none font-mono text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">
                    Organiser Email
                  </label>
                  <input
                    type="email"
                    required
                    value={platformConfig?.organiserEmail ?? ''}
                    onChange={(e) =>
                      setPlatformConfig((p) => ({ ...p, organiserEmail: e.target.value }))
                    }
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
                    onChange={(e) =>
                      setPlatformConfig((p) => ({ ...p, adminPin: e.target.value }))
                    }
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

        {/* ====================================================================
            9. AUDIT LOG TAB
        ==================================================================== */}
        {activeNav === 'audit' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Organiser Audit Log</h1>
            <div className="bg-white rounded-2xl border border-zinc-200/80 divide-y divide-zinc-100 text-xs">
              {auditLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-zinc-900">{log.action}</span>
                    {log.target && (
                      <span className="ml-2 font-mono text-orange-600">[{log.target}]</span>
                    )}
                  </div>
                  <span className="font-mono text-zinc-400">{log.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================================
            10. TEAM TAB
        ==================================================================== */}
        {activeNav === 'team' && (
          <div className="max-w-lg bg-white rounded-2xl p-6 border border-zinc-200/80 space-y-4">
            <h1 className="text-xl font-bold">Organiser Team</h1>
            <div className="p-4 rounded-xl bg-zinc-50 border border-zinc-200 flex items-center justify-between text-xs">
              <div>
                <span className="font-bold block">{platformConfig.organiserEmail}</span>
                <span className="text-zinc-500">Lead Organiser • Full Access</span>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-50 text-emerald-700 font-mono font-bold">
                ACTIVE
              </span>
            </div>
          </div>
        )}
      </main>

      {/* ======================================================================
          CREATE / EDIT EXAM MODAL (With Retake Price, Screen Leaves & Release Mode)
      ====================================================================== */}
      {showSittingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSitting}
            className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-7 space-y-4 text-xs max-h-[92vh] overflow-y-auto shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h3 className="text-lg font-bold">
                {editingSittingId ? 'Edit Exam Sitting' : 'Create Categorized Exam Sitting'}
              </h3>
              <button
                type="button"
                onClick={() => setShowSittingModal(false)}
                className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-600 mb-1">
                  1. Primary Exam Category
                </label>
                <select
                  value={sittingForm.mode}
                  onChange={(e) => {
                    const nextMode = e.target.value;
                    setSittingForm((prev) => ({
                      ...prev,
                      mode: nextMode,
                      allowedModes: Array.from(new Set([nextMode, ...prev.allowedModes]))
                    }));
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 font-semibold"
                >
                  <option value="PRACTICE">Speed Drill (PRACTICE)</option>
                  <option value="OFFICIAL">Official Timed Mock (OFFICIAL)</option>
                  <option value="BUNDLED">Multi-Course Combo (BUNDLED)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-600 mb-1">
                  2. Course / Department Categorization
                </label>
                <select
                  value={sittingForm.targetCourse}
                  onChange={(e) =>
                    setSittingForm({ ...sittingForm, targetCourse: e.target.value })
                  }
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

            <div className="p-3 rounded-xl bg-zinc-50 border border-zinc-200 space-y-1.5">
              <span className="font-semibold text-zinc-600 block">
                Allow this exam to be taken under (Default is its primary category only):
              </span>
              <div className="flex items-center gap-4 pt-1">
                {[
                  { id: 'PRACTICE', label: 'Speed Drill' },
                  { id: 'OFFICIAL', label: 'Official Mock' },
                  { id: 'BUNDLED', label: 'Combo Marathon' }
                ].map((m) => {
                  const checked = sittingForm.allowedModes.includes(m.id);
                  return (
                    <label key={m.id} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setSittingForm((prev) => {
                            const next = checked
                              ? prev.allowedModes.filter((item) => item !== m.id)
                              : [...prev.allowedModes, m.id];
                            return {
                              ...prev,
                              allowedModes: next.length > 0 ? next : [prev.mode]
                            };
                          });
                        }}
                      />
                      <span className="font-medium">{m.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-600 mb-1">3. Exam Sitting Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Neuroanatomy & Kinematics Mid-Semester Mock 1.0"
                value={sittingForm.title}
                onChange={(e) => setSittingForm({ ...sittingForm, title: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200"
              />
            </div>

            {/* Pricing, Retake Fee, Duration, Pass Mark & Anti-Cheat Screen Leave Limit */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold text-zinc-600 mb-1">
                  1st Attempt Price (₦)
                </label>
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
                <label className="block font-semibold text-orange-600 mb-1">
                  2nd Try Retake Fee (₦)
                </label>
                <input
                  type="number"
                  min={0}
                  step={100}
                  placeholder="0 = Free Retakes"
                  value={sittingForm.retakePriceNaira}
                  onChange={(e) =>
                    setSittingForm({ ...sittingForm, retakePriceNaira: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-orange-50/50 border border-orange-200 font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-600 mb-1">1st Attempt Gate</label>
                <select
                  value={sittingForm.requiresCode ? 'yes' : 'no'}
                  onChange={(e) =>
                    setSittingForm({ ...sittingForm, requiresCode: e.target.value === 'yes' })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-semibold"
                >
                  <option value="yes">Code Required on 1st Try</option>
                  <option value="no">Free 1st Try (No Code)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-zinc-600 mb-1">Duration (Mins)</label>
                <input
                  type="number"
                  min={1}
                  value={sittingForm.durationMins}
                  onChange={(e) =>
                    setSittingForm({ ...sittingForm, durationMins: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono"
                />
              </div>

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

              <div>
                <label className="block font-semibold text-teal-700 mb-1">
                  Max Screen Leaves (Anti-Cheat)
                </label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={sittingForm.maxTabSwitches}
                  onChange={(e) =>
                    setSittingForm({ ...sittingForm, maxTabSwitches: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-teal-50/50 border border-teal-200 font-mono font-bold"
                />
              </div>
            </div>

            {/* Result Release Policy inside Modal */}
            <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-600 mb-1">
                  Result Release Mode
                </label>
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

            {/* Searchable Subject Linker inside Modal */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-zinc-600">
                  4. Link Exam Subjects ({sittingForm.allowedCourses.length} selected)
                </label>
                <input
                  type="text"
                  value={modalSubjectSearch}
                  onChange={(e) => setModalSubjectSearch(e.target.value)}
                  placeholder="Search subjects..."
                  className="px-2.5 py-1 rounded-lg bg-zinc-50 border border-zinc-200 text-xs w-44"
                />
              </div>

              <div className="max-h-36 overflow-y-auto p-3 rounded-xl bg-zinc-50 border border-zinc-200 grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                          onChange={() => {
                            setSittingForm((prev) => ({
                              ...prev,
                              allowedCourses: checked
                                ? prev.allowedCourses.filter((id) => id !== c.id)
                                : [...prev.allowedCourses, c.id]
                            }));
                          }}
                        />
                        <span className="truncate">
                          <strong>{c.code}</strong> — {c.name}
                        </span>
                      </label>
                    );
                  })}
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-600 mb-1">
                Instructions / Description
              </label>
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
                className="flex-1 py-2.5 rounded-xl bg-[#d9531e] hover:bg-orange-600 text-white font-semibold"
              >
                {editingSittingId ? 'Save Changes' : 'Publish Exam Sitting'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}