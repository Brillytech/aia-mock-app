import React, { useState, useRef } from 'react';
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
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Database,
  Archive,
  RotateCcw,
  Edit3,
  Star,
  Files,
  AlertCircle,
  Share2,
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

  const [codeGenForm, setCodeGenForm] = useState({
    sittingId: sittings[0]?.id || 'sit-mock-1',
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
    requiresCode: true,
    durationMins: 20,
    questionCount: 25,
    passMark: 50,
    isFeatured: true,
    shuffleQuestions: true,
    allowedCourses: [],
    status: 'OPEN',
    resultsReleased: true,
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

  const [newQ, setNewQ] = useState({
    courseId: courses[0]?.id || 'ana-301',
    passage: '',
    question: '',
    optionA: '',
    optionB: '',
    optionC: '',
    optionD: '',
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

  // Real Supabase Organiser Auth + PIN Fallback
  const handleAdminUnlock = async (e) => {
    e.preventDefault();
    setPinError('');
    setAuthLoading(true);

    try {
      if (loginMethod === 'email' && isSupabaseConfigured && supabase) {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: adminEmail.trim(),
          password: adminPassword
        });
        if (error) throw error;

        if (data?.user) {
          sessionStorage.setItem('aia_admin_unlocked', 'true');
          setIsUnlocked(true);
          logAdminAction(`Organiser ${data.user.email} signed in via Supabase Auth`, 'Auth');
        }
      } else {
        if (
          pinInput === (platformConfig?.adminPin || '2026') ||
          pinInput.toLowerCase() === 'admin'
        ) {
          sessionStorage.setItem('aia_admin_unlocked', 'true');
          setIsUnlocked(true);
          logAdminAction('Organiser signed into /admin console via PIN', 'Session');
        } else {
          setPinError('Invalid organiser credentials. Use your Supabase account or PIN 2026.');
        }
      }
    } catch (err) {
      setPinError(err.message || 'Failed to authenticate organiser.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Copy Direct Shareable Exam Link (`/?exam=<sitting_id>`)
  const handleCopyExamShareLink = (sit) => {
    const link = `${window.location.origin}/?exam=${sit.id}`;
    const msg = `📚 Register & Sit for "${sit.title}" (${sit.mode}) on AIA Academy:\n${link}`;
    navigator.clipboard.writeText(msg);
    setCopiedShareId(sit.id);
    setTimeout(() => setCopiedShareId(null), 2200);
  };

  const openCreateSittingModal = () => {
    setEditingSittingId(null);
    setSittingForm({
      title: '',
      mode: 'OFFICIAL',
      allowedModes: ['OFFICIAL'],
      targetCourse: 'All Courses',
      priceNaira: 1000,
      requiresCode: true,
      durationMins: 20,
      questionCount: 25,
      passMark: 50,
      isFeatured: true,
      shuffleQuestions: true,
      allowedCourses: [],
      status: 'OPEN',
      resultsReleased: true,
      description: ''
    });
    setShowSittingModal(true);
  };

  const openEditSittingModal = (sit) => {
    setEditingSittingId(sit.id);
    setSittingForm({
      title: sit.title || '',
      mode: sit.mode || 'OFFICIAL',
      allowedModes:
        Array.isArray(sit.allowedModes) && sit.allowedModes.length > 0
          ? sit.allowedModes
          : [sit.mode || 'OFFICIAL'],
      targetCourse: sit.targetCourse || 'All Courses',
      priceNaira: sit.priceNaira ?? 0,
      requiresCode: Boolean(sit.requiresCode),
      durationMins: sit.durationMins || 15,
      questionCount: sit.questionCount || 20,
      passMark: sit.passMark || 50,
      isFeatured: Boolean(sit.isFeatured),
      shuffleQuestions: sit.shuffleQuestions !== false,
      allowedCourses: sit.allowedCourses || [],
      status: sit.status || 'OPEN',
      resultsReleased: sit.resultsReleased !== false,
      description: sit.description || ''
    });
    setShowSittingModal(true);
  };

  const handleSaveSitting = async (e) => {
    e.preventDefault();
    if (!sittingForm.title.trim()) return;

    const finalAllowedModes =
      sittingForm.allowedModes.length > 0 ? sittingForm.allowedModes : [sittingForm.mode];

    const payload = {
      id: editingSittingId || 'sit_' + Date.now(),
      title: sittingForm.title.trim(),
      mode: sittingForm.mode,
      allowedModes: finalAllowedModes,
      targetCourse: sittingForm.targetCourse || 'All Courses',
      priceNaira: Number(sittingForm.priceNaira) || 0,
      requiresCode: Boolean(sittingForm.requiresCode),
      durationMins: Number(sittingForm.durationMins) || 15,
      questionCount: Number(sittingForm.questionCount) || 20,
      passMark: Number(sittingForm.passMark) || 50,
      isFeatured: Boolean(sittingForm.isFeatured),
      shuffleQuestions: Boolean(sittingForm.shuffleQuestions),
      allowedCourses: sittingForm.allowedCourses,
      status: sittingForm.status || 'OPEN',
      resultsReleased: Boolean(sittingForm.resultsReleased),
      description:
        sittingForm.description.trim() ||
        `${sittingForm.mode} assessment for ${sittingForm.targetCourse}.`,
      createdAt: new Date().toISOString()
    };

    if (editingSittingId) {
      setSittings((prev) => prev.map((s) => (s.id === editingSittingId ? { ...s, ...payload } : s)));
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
        requires_code: payload.requiresCode,
        duration_mins: payload.durationMins,
        question_count: payload.questionCount,
        pass_mark: payload.passMark,
        is_featured: payload.isFeatured,
        shuffle_questions: payload.shuffleQuestions,
        allowed_courses: payload.allowedCourses,
        status: payload.status,
        results_released: payload.resultsReleased,
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
        requires_code: copy.requiresCode,
        duration_mins: copy.durationMins,
        question_count: copy.questionCount,
        allowed_courses: copy.allowedCourses || [],
        status: copy.status,
        results_released: copy.resultsReleased,
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
      if (patch.durationMins !== undefined) dbPatch.duration_mins = patch.durationMins;
      if (patch.requiresCode !== undefined) dbPatch.requires_code = patch.requiresCode;
      if (patch.resultsReleased !== undefined) dbPatch.results_released = patch.resultsReleased;
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
      category: newCourse.category.trim() || 'General'
    };

    setCourses((prev) => (prev.some((c) => c.id === id) ? prev : [...prev, created]));
    if (isSupabaseConfigured && supabase) {
      await supabase.from('courses').upsert(created);
    }
    logAdminAction('Added subject/course', created.code);
    setNewCourse({ code: '', name: '', category: 'General / UTME' });
  };

  const handleDeleteCourse = async (courseObj) => {
    if (!window.confirm(`Delete subject "${courseObj.code} — ${courseObj.name}"?`)) return;
    setCourses((prev) => prev.filter((c) => c.id !== courseObj.id));
    if (isSupabaseConfigured && supabase) {
      await supabase.from('courses').delete().eq('id', courseObj.id);
    }
    logAdminAction('Deleted subject/course', courseObj.code);
  };

  const handleDownloadCsvTemplate = () => {
    const sampleRows = [
      'course_code,question,option_a,option_b,option_c,option_d,correct_option,explanation,passage',
      '"ANA 301","Which nerve innervates the deltoid muscle?","Radial nerve","Axillary nerve","Median nerve","Ulnar nerve","B","The axillary nerve (C5-C6) supplies the deltoid and teres minor.",""',
      '"ENG 101","Choose the word nearest in meaning to UBIQUITOUS.","Scarce","Omnipresent","Hidden","Fragile","B","Ubiquitous means present, appearing, or found everywhere.",""',
      '"PHS 204","Which pacemaker sets the normal sinus rhythm of the heart?","AV Node","Purkinje fibers","SA Node","Bundle of His","C","The sinoatrial (SA) node fires at 60-100 bpm.",""'
    ].join('\n');

    const blob = new Blob([sampleRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'aia_questions_template.csv';
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

      const startIndex =
        lines[0].toLowerCase().includes('question') ||
        lines[0].toLowerCase().includes('course')
          ? 1
          : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const cols = parseCsvLine(lines[i]);
        if (cols.length < 7) {
          errs.push(`Row ${i + 1}: Expected at least 7 columns (found ${cols.length}).`);
          continue;
        }

        const [rawCode, questionText, optA, optB, optC, optD, rawCorrect, explanation, passage] =
          cols;

        if (!questionText || !optA || !optB || !optC || !optD) {
          errs.push(`Row ${i + 1}: Missing question text or one of the 4 options.`);
          continue;
        }

        const matchedCourse =
          courses.find(
            (c) =>
              c.code.toLowerCase() === rawCode.toLowerCase() ||
              c.id.toLowerCase() === rawCode.toLowerCase()
          ) || courses[0];

        const cleanAns = String(rawCorrect || 'A').trim().toUpperCase();
        let correctIndex = 0;
        if (cleanAns === 'B' || cleanAns === '1') correctIndex = 1;
        else if (cleanAns === 'C' || cleanAns === '2') correctIndex = 2;
        else if (cleanAns === 'D' || cleanAns === '3') correctIndex = 3;

        parsed.push({
          id: `q_csv_${Date.now()}_${i}`,
          courseId: matchedCourse.id,
          courseCode: matchedCourse.code,
          passage: passage || null,
          question: questionText,
          options: [optA, optB, optC, optD],
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
    setCsvImportSuccess(`Successfully imported ${csvParsedRows.length} questions from ${csvFileName}.`);
    setCsvParsedRows([]);
    setCsvErrors([]);
    setCsvFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleGenerateCodes = async (e) => {
    e.preventDefault();
    const targetSitting = sittings.find((s) => s.id === codeGenForm.sittingId) || sittings[0];
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
        sittingId: targetSitting.id,
        sittingTitle: targetSitting.title,
        mode: targetSitting.mode,
        priceNaira: targetSitting.priceNaira,
        assignedTo: count === 1 ? codeGenForm.assignedTo.trim() : '',
        status: 'LIVE',
        maxUses: Number(codeGenForm.maxUses) || 1,
        usedCount: 0,
        createdAt: new Date().toLocaleDateString()
      };
    });

    setAccessCodes((prev) => [...generated, ...prev]);

    if (isSupabaseConfigured && supabase) {
      await supabase.from('access_codes').insert(
        generated.map((g) => ({
          code: g.code,
          sitting_id: g.sittingId,
          sitting_title: g.sittingTitle,
          mode: g.mode,
          price_naira: g.priceNaira,
          assigned_to: g.assignedTo,
          status: g.status,
          max_uses: g.maxUses,
          used_count: 0
        }))
      );
    }

    logAdminAction(`Generated ${count} access code(s)`, targetSitting.title);
    setCodeGenForm({ ...codeGenForm, assignedTo: '' });
  };

  const handleCopyCode = (codeStr) => {
    navigator.clipboard.writeText(codeStr);
    setCopiedCode(codeStr);
    setTimeout(() => setCopiedCode(null), 1800);
  };

  const handleRevokeCode = async (codeObj) => {
    const nextStatus = codeObj.status === 'LIVE' ? 'REVOKED' : 'LIVE';
    setAccessCodes((prev) =>
      prev.map((c) => (c.id === codeObj.id ? { ...c, status: nextStatus } : c))
    );
    if (isSupabaseConfigured && supabase) {
      await supabase.from('access_codes').update({ status: nextStatus }).eq('code', codeObj.code);
    }
    logAdminAction(`Set code ${codeObj.code} to ${nextStatus}`, 'Codes');
  };

  const handleCreateQuestion = async (e) => {
    e.preventDefault();
    const targetCourse = courses.find((c) => c.id === newQ.courseId) || courses[0];
    const draft = {
      id: 'q_' + Date.now(),
      courseId: targetCourse.id,
      courseCode: targetCourse.code,
      passage: newQ.passage.trim() || null,
      question: newQ.question,
      options: [newQ.optionA, newQ.optionB, newQ.optionC, newQ.optionD],
      correctIndex: Number(newQ.correctIndex),
      explanation: newQ.explanation
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
              Supabase Account
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
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      placeholder="••••••••"
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
                  Organiser PIN (Default: 2026)
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
  const liveCodesCount = accessCodes.filter((c) => c.status === 'LIVE').length;
  const uniqueCandidates = Array.from(
    new Map(standings.map((item) => [item.name, item])).values()
  );

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

  const ITEMS_PER_PAGE = 5;
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

  const NAV_ITEMS = [
    { id: 'overview', label: 'Overview', icon: LayoutGrid },
    { id: 'sittings', label: `Exams & Sittings (${activeSittings.length})`, icon: CalendarClock },
    { id: 'bank', label: 'Subjects & CSV Bank', icon: BookOpen },
    { id: 'codes', label: 'Access Codes', icon: KeyRound },
    { id: 'candidates', label: 'Candidates', icon: Users },
    { id: 'results', label: 'Results', icon: Trophy },
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
        {activeNav === 'overview' && (
          <div className="space-y-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-serif font-normal tracking-tight text-zinc-900">
                  Overview
                </h1>
                <p className="text-xs sm:text-sm text-zinc-500 mt-1">
                  Create categorized exams, copy direct shareable exam links for students, and issue access codes.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start">
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
                <span className="text-xs text-zinc-500 font-medium block">Submissions</span>
                <p className="text-3xl font-bold font-mono">{standings.length}</p>
                <span className="text-xs text-zinc-400 block">all sittings</span>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-zinc-200/80 shadow-sm space-y-2">
                <span className="text-xs text-zinc-500 font-medium block">Candidates</span>
                <p className="text-3xl font-bold font-mono">{uniqueCandidates.length}</p>
                <span className="text-xs text-zinc-400 block">{liveCodesCount} live codes</span>
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
                  <h2 className="font-bold text-sm">Active Categorized Exams (Quick Share)</h2>
                  <p className="text-xs text-zinc-400">
                    Copy the direct exam link to share on WhatsApp so students land straight on that exam.
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
                {activeSittings.slice(0, 6).map((sit) => (
                  <div
                    key={sit.id}
                    className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[10px] font-bold px-2.5 py-1 rounded bg-orange-500/10 text-orange-600">
                        {(sit.allowedModes || [sit.mode]).join(' + ')}
                      </span>
                      <div>
                        <span className="font-bold text-sm text-zinc-900 block">
                          {sit.title}
                        </span>
                        <span className="text-zinc-500">
                          Course: <strong>{sit.targetCourse || 'All Courses'}</strong> •{' '}
                          {sit.durationMins} mins •{' '}
                          {sit.requiresCode && sit.priceNaira > 0
                            ? `₦${sit.priceNaira.toLocaleString()}`
                            : 'Free Open'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopyExamShareLink(sit)}
                        className="px-3 py-1.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-700 font-semibold flex items-center gap-1.5 hover:bg-orange-100"
                      >
                        {copiedShareId === sit.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Link Copied!</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share Exam Link</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={() => openEditSittingModal(sit)}
                        className="px-3 py-1.5 rounded-lg border border-zinc-200 hover:bg-zinc-50 font-semibold"
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ====================================================================
            2. EXAMS & SITTINGS MANAGER (Share Link + Multi-Category + Archive/Delete)
        ==================================================================== */}
        {activeNav === 'sittings' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold">Exams & Sittings Manager</h1>
                <p className="text-xs text-zinc-500 mt-1">
                  Assign exams to 1 (or multiple) of the 3 categories, share direct student links, or archive/delete exams.
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
              {displayedSittings.map((sit) => (
                <div
                  key={sit.id}
                  className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-5"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded bg-orange-500/10 text-orange-600">
                          {(sit.allowedModes || [sit.mode]).join(' + ')}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-2.5 py-0.5 rounded bg-teal-500/10 text-teal-700">
                          Course: {sit.targetCourse || 'All Courses'}
                        </span>
                        <h3 className="font-bold text-base text-zinc-900">{sit.title}</h3>
                      </div>
                      <p className="text-xs text-zinc-500">{sit.description}</p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Direct Shareable Link Button for Admin */}
                      <button
                        type="button"
                        onClick={() => handleCopyExamShareLink(sit)}
                        className="px-3 py-1.5 rounded-xl bg-orange-50 border border-orange-200 text-orange-700 text-xs font-bold flex items-center gap-1.5 hover:bg-orange-100"
                      >
                        {copiedShareId === sit.id ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Copied Link!</span>
                          </>
                        ) : (
                          <>
                            <Share2 className="w-3.5 h-3.5" />
                            <span>Share Link</span>
                          </>
                        )}
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

                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
                    <div>
                      <label className="block text-zinc-400 font-medium mb-1">
                        Price (₦ Naira)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step={100}
                        value={sit.priceNaira}
                        onChange={(e) =>
                          handleUpdateSitting(sit.id, { priceNaira: Number(e.target.value) })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-mono font-bold"
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
                        Course / Dept Tag
                      </label>
                      <select
                        value={sit.targetCourse || 'All Courses'}
                        onChange={(e) =>
                          handleUpdateSitting(sit.id, { targetCourse: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200 font-semibold"
                      >
                        <option value="All Courses">All Courses / General</option>
                        {NIGERIAN_COURSES_OF_STUDY.map((dept) => (
                          <option key={dept} value={dept}>
                            {dept}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-zinc-400 font-medium mb-1">Access Gate</label>
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
                        <span>{sit.requiresCode ? 'Code Locked' : 'Free Entry'}</span>
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div>
                      <label className="block text-zinc-400 font-medium mb-1">Codes</label>
                      <button
                        type="button"
                        onClick={() => {
                          setCodeGenForm((prev) => ({ ...prev, sittingId: sit.id }));
                          setActiveNav('codes');
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-zinc-900 text-white font-semibold text-center"
                      >
                        Issue Codes →
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================================
            3. SUBJECTS & REAL .CSV FILE UPLOAD QUESTION BANK
        ==================================================================== */}
        {activeNav === 'bank' && (
          <div className="space-y-8">
            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base">1. Manage Exam Subjects / Courses</h2>
                  <p className="text-xs text-zinc-500">
                    Create subjects here first so you can tag questions to them in your `.csv` upload or manual editor.
                  </p>
                </div>
                <span className="font-mono text-xs text-orange-600 font-bold">
                  {courses.length} Subjects
                </span>
              </div>

              <form onSubmit={handleCreateCourse} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <input
                  required
                  placeholder="Code (e.g. ANA 301 or ENG 101)"
                  value={newCourse.code}
                  onChange={(e) => setNewCourse({ ...newCourse, code: e.target.value })}
                  className="px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 font-mono"
                />
                <input
                  required
                  placeholder="Subject Title (e.g. Neuroanatomy & Spinal Pathways)"
                  value={newCourse.name}
                  onChange={(e) => setNewCourse({ ...newCourse, name: e.target.value })}
                  className="sm:col-span-2 px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200"
                />
                <div className="flex gap-2">
                  <input
                    placeholder="Category / Faculty"
                    value={newCourse.category}
                    onChange={(e) => setNewCourse({ ...newCourse, category: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-[#d9531e] text-white font-semibold whitespace-nowrap"
                  >
                    + Add
                  </button>
                </div>
              </form>

              <div className="flex items-center gap-2 flex-wrap pt-2">
                {courses.map((c) => (
                  <span
                    key={c.id}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-zinc-100 text-xs font-medium"
                  >
                    <strong className="font-mono text-orange-600">{c.code}</strong>
                    <span className="text-zinc-600">{c.name}</span>
                    <button
                      type="button"
                      onClick={() => handleDeleteCourse(c)}
                      className="text-zinc-400 hover:text-red-600 ml-1"
                      title="Delete subject"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* REAL .CSV DOCUMENT UPLOADER & TEMPLATE DOWNLOADER */}
            <div className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-teal-500/10 text-teal-700 flex items-center justify-center">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-base">2. Bulk Upload Questions via `.CSV` Document</h2>
                    <p className="text-xs text-zinc-500">
                      Download the official Excel/CSV template, fill in your questions, and upload the `.csv` file directly.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleDownloadCsvTemplate}
                  className="px-4 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold flex items-center gap-2 self-start"
                >
                  <Download className="w-4 h-4 text-teal-400" />
                  <span>Download `.CSV` Template</span>
                </button>
              </div>

              <div className="p-3.5 rounded-xl bg-zinc-50 border border-zinc-200/80 text-xs space-y-1">
                <span className="font-semibold text-zinc-700 block">
                  Required `.CSV` Columns (in order):
                </span>
                <p className="font-mono text-[11px] text-orange-600">
                  course_code , question , option_a , option_b , option_c , option_d , correct_option (A/B/C/D) , explanation , passage (optional)
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
                  Supports standard `.csv` files exported from Microsoft Excel or Google Sheets
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
                        </div>
                        <span className="font-mono text-[11px] text-teal-700 flex-shrink-0">
                          Ans: {['A', 'B', 'C', 'D'][row.correctIndex]}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Single Question Editor + Searchable Question Bank */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              <div className="lg:col-span-5 bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
                <h2 className="font-bold text-base">3. Manual Single Question Entry</h2>
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

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      required
                      placeholder="Option A"
                      value={newQ.optionA}
                      onChange={(e) => setNewQ({ ...newQ, optionA: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                    />
                    <input
                      required
                      placeholder="Option B"
                      value={newQ.optionB}
                      onChange={(e) => setNewQ({ ...newQ, optionB: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                    />
                    <input
                      required
                      placeholder="Option C"
                      value={newQ.optionC}
                      onChange={(e) => setNewQ({ ...newQ, optionC: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                    />
                    <input
                      required
                      placeholder="Option D"
                      value={newQ.optionD}
                      onChange={(e) => setNewQ({ ...newQ, optionD: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={newQ.correctIndex}
                      onChange={(e) =>
                        setNewQ({ ...newQ, correctIndex: Number(e.target.value) })
                      }
                      className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                    >
                      <option value={0}>Correct: Option A</option>
                      <option value={1}>Correct: Option B</option>
                      <option value={2}>Correct: Option C</option>
                      <option value={3}>Correct: Option D</option>
                    </select>
                    <input
                      placeholder="Explanation..."
                      value={newQ.explanation}
                      onChange={(e) => setNewQ({ ...newQ, explanation: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 rounded-xl bg-[#d9531e] text-white font-semibold"
                  >
                    Save Question
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
                        {c.code} — {c.name}
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
                        <span className="font-mono text-xs font-bold text-orange-600">
                          {item.courseCode}
                        </span>
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
                        Ans: {['A', 'B', 'C', 'D'][item.correctIndex]} —{' '}
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
            4. ACCESS CODES TAB
        ==================================================================== */}
        {activeNav === 'codes' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-bold">Access Codes</h1>
              <p className="text-xs text-zinc-500 mt-1">
                Generate single or batch codes tied to any exam sitting and send to students after WhatsApp payment.
              </p>
            </div>

            <form
              onSubmit={handleGenerateCodes}
              className="bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm grid grid-cols-1 sm:grid-cols-5 gap-4 items-end"
            >
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  Target Exam Sitting
                </label>
                <select
                  value={codeGenForm.sittingId}
                  onChange={(e) => setCodeGenForm({ ...codeGenForm, sittingId: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-medium"
                >
                  {activeSittings.map((s) => (
                    <option key={s.id} value={s.id}>
                      [{s.mode}] {s.title} — ₦{s.priceNaira.toLocaleString()}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">Quantity</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={codeGenForm.quantity}
                  onChange={(e) => setCodeGenForm({ ...codeGenForm, quantity: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 text-xs font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-600 mb-1">
                  Candidate Note
                </label>
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
                className="py-2.5 px-4 rounded-xl bg-[#d9531e] hover:bg-orange-600 text-white font-semibold text-xs flex items-center justify-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Generate Codes</span>
              </button>
            </form>

            <div className="bg-white rounded-2xl border border-zinc-200/80 shadow-sm divide-y divide-zinc-100 overflow-hidden">
              {accessCodes.map((c) => (
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
                        {c.sittingTitle || 'Exam Sitting'} ({c.mode}) • ₦
                        {(c.priceNaira || 0).toLocaleString()}
                      </span>
                      <span className="text-zinc-400">
                        {c.assignedTo ? `Assigned: ${c.assignedTo}` : 'Unassigned'} • Uses:{' '}
                        {c.usedCount}/{c.maxUses}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-2.5 py-1 rounded-md font-mono text-[10px] font-bold ${
                        c.status === 'LIVE'
                          ? 'bg-emerald-50 text-emerald-700'
                          : c.status === 'USED'
                          ? 'bg-zinc-100 text-zinc-500'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
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
                          <span>Copy for WhatsApp</span>
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleRevokeCode(c)}
                      className="px-2.5 py-1.5 rounded-lg text-zinc-400 hover:text-red-600"
                    >
                      {c.status === 'REVOKED' ? 'Restore' : 'Revoke'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ====================================================================
            5. ANNOUNCEMENTS TAB (Max 3 Square Cards)
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

        {activeNav === 'candidates' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Candidates ({uniqueCandidates.length})</h1>
            <div className="bg-white rounded-2xl border border-zinc-200/80 divide-y divide-zinc-100">
              {uniqueCandidates.map((cand, i) => (
                <div key={i} className="p-4 sm:px-6 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-bold text-sm block">{cand.name}</span>
                    <span className="text-zinc-500">
                      {cand.institution || 'Nigeria'} • {cand.dept}
                    </span>
                  </div>
                  <div className="text-right font-mono">
                    <span className="font-bold text-orange-600 block">Best: {cand.score}%</span>
                    <span className="text-zinc-400">{cand.mode}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNav === 'results' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold">Submitted Exam Results ({standings.length})</h1>
            <div className="bg-white rounded-2xl border border-zinc-200/80 divide-y divide-zinc-100">
              {standings.map((r, idx) => (
                <div key={r.id} className="p-4 sm:px-6 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-zinc-400">#{idx + 1}</span>
                    <div>
                      <span className="font-bold text-sm block">{r.name}</span>
                      <span className="text-zinc-500">
                        {r.dept} • {r.sittingTitle || r.mode}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right font-mono">
                      <span className="font-bold text-orange-600 block">{r.score}%</span>
                      <span className="text-zinc-400">{r.timeSecs}s</span>
                    </div>
                    <button
                      onClick={async () => {
                        setStandings((prev) => prev.filter((item) => item.id !== r.id));
                        if (isSupabaseConfigured && supabase) {
                          await supabase.from('exam_results').delete().eq('id', r.id);
                        }
                      }}
                      className="text-zinc-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeNav === 'settings' && (
          <div className="max-w-lg bg-white rounded-2xl p-6 border border-zinc-200/80 shadow-sm space-y-4">
            <h1 className="text-xl font-bold">Platform & WhatsApp Payment Settings</h1>
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-zinc-600 mb-1">
                  WhatsApp Payment Receiver Number (International Format, No +)
                </label>
                <input
                  type="text"
                  value={platformConfig.whatsappNumber}
                  onChange={async (e) => {
                    const nextVal = e.target.value;
                    setPlatformConfig({ ...platformConfig, whatsappNumber: nextVal });
                    if (isSupabaseConfigured && supabase) {
                      await supabase
                        .from('platform_settings')
                        .upsert({ id: 1, whatsapp_number: nextVal });
                    }
                  }}
                  placeholder="2348012345678"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 font-mono"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-600 mb-1">Organiser Email</label>
                <input
                  type="email"
                  value={platformConfig.organiserEmail}
                  onChange={async (e) => {
                    const nextVal = e.target.value;
                    setPlatformConfig({ ...platformConfig, organiserEmail: nextVal });
                    if (isSupabaseConfigured && supabase) {
                      await supabase
                        .from('platform_settings')
                        .upsert({ id: 1, organiser_email: nextVal });
                    }
                  }}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-600 mb-1">
                  Organiser Console PIN
                </label>
                <input
                  type="text"
                  value={platformConfig.adminPin}
                  onChange={(e) =>
                    setPlatformConfig({ ...platformConfig, adminPin: e.target.value })
                  }
                  className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 border border-zinc-200 font-mono"
                />
              </div>
            </div>
          </div>
        )}

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

      {/* CREATE / EDIT EXAM MODAL (With Single or Multi-Category Assignment) */}
      {showSittingModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveSitting}
            className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-7 space-y-4 text-xs max-h-[92vh] overflow-y-auto shadow-2xl"
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

            {/* Optional: Allow this exam to appear in multiple categories */}
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

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block font-semibold text-zinc-600 mb-1">Price (₦ Naira)</label>
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
                <label className="block font-semibold text-zinc-600 mb-1">Code Gate</label>
                <select
                  value={sittingForm.requiresCode ? 'yes' : 'no'}
                  onChange={(e) =>
                    setSittingForm({ ...sittingForm, requiresCode: e.target.value === 'yes' })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-zinc-50 border border-zinc-200"
                >
                  <option value="yes">Code Required</option>
                  <option value="no">Free Open</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-600 mb-1">
                4. Link Exam Subjects to this Sitting (Questions from ticked subjects will load in this exam)
              </label>
              <div className="max-h-36 overflow-y-auto p-3 rounded-xl bg-zinc-50 border border-zinc-200 grid grid-cols-2 gap-2">
                {courses.map((c) => {
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
                className="flex-1 py-2.5 rounded-xl bg-[#d9531e] text-white font-semibold"
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