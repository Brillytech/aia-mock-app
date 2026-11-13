import React, { useState, useEffect } from 'react';
import { useTheme } from './context/ThemeContext';
import { supabase, isSupabaseConfigured } from './lib/supabase';
import {
  NIGERIAN_INSTITUTIONS,
  NIGERIAN_COURSES_OF_STUDY,
  DEFAULT_SUBJECT_CATALOG
} from './lib/nigeriaAcademicData';
import AiaLogo from './components/AiaLogo';
import SearchableSelect from './components/SearchableSelect';
import ExamRoom from './components/ExamRoom';
import ResultView from './components/ResultView';
import AdminConsole from './components/AdminConsole';
import {
  Sun,
  Moon,
  Zap,
  Layers,
  Trophy,
  Medal,
  Award,
  Bookmark,
  Bell,
  User,
  LogOut,
  ArrowRight,
  Clock,
  CheckCircle2,
  Flame,
  Eye,
  EyeOff,
  Lock,
  Building2,
  GraduationCap,
  Mail,
  KeyRound,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Trash2,
  RotateCcw,
  Sparkles,
  MessageCircle,
  ExternalLink,
  Search,
  LayoutGrid,
  Share2,
  Link2,
  Check,
  X,
  FileCheck2
} from 'lucide-react';

const HERO_BG = {
  local: '/images/hero-bg.jpg',
  fallback:
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=1400&q=85'
};

const MODE_VISUALS = {
  PRACTICE: {
    name: 'Speed Drill',
    uniqueFeature: 'Blitz Multiplier • Speed + Accuracy',
    summary: 'Rapid recall sprints against the clock.',
    icon: Zap,
    accent:
      'from-white/95 via-white/80 to-orange-500/20 dark:from-zinc-950/95 dark:via-zinc-950/75 dark:to-orange-500/25',
    activeRing: 'border-orange-500 ring-2 ring-orange-500/20 shadow-lg shadow-orange-500/10',
    badgeClass: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
    localImage: '/images/mode-speed.jpg',
    fallbackImage:
      'https://images.unsplash.com/photo-1508739773434-c26b3d09e071?auto=format&fit=crop&w=800&q=80'
  },
  OFFICIAL: {
    name: 'Official Timed Mock',
    uniqueFeature: 'Proctored Pass-Mark Gate • Verified Slip',
    summary: 'Standard timed exam conditions with verified ranking.',
    icon: Clock,
    accent:
      'from-white/95 via-white/80 to-teal-500/20 dark:from-zinc-950/95 dark:via-zinc-950/75 dark:to-teal-500/25',
    activeRing: 'border-teal-500 ring-2 ring-teal-500/20 shadow-lg shadow-teal-500/10',
    badgeClass: 'bg-teal-500/15 text-teal-800 dark:text-teal-300 border-teal-500/30',
    localImage: '/images/mode-official.jpg',
    fallbackImage:
      'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=800&q=80'
  },
  BUNDLED: {
    name: 'Multi-Course Combo',
    uniqueFeature: 'Multi-Subject Marathon • Endurance Mode',
    summary: 'Combine multiple subjects in one marathon sitting.',
    icon: Layers,
    accent:
      'from-white/95 via-white/80 to-amber-500/20 dark:from-zinc-950/95 dark:via-zinc-950/75 dark:to-amber-500/25',
    activeRing: 'border-orange-500 ring-2 ring-orange-500/20 shadow-lg shadow-orange-500/10',
    badgeClass:
      'bg-zinc-900/10 dark:bg-white/15 text-zinc-900 dark:text-zinc-100 border-zinc-400/30',
    localImage: '/images/mode-combo.jpg',
    fallbackImage:
      'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?auto=format&fit=crop&w=800&q=80'
  }
};

const INITIAL_SITTINGS = [
  {
    id: 'sit-drill',
    title: 'Neuroanatomy Rapid Recall Sprint 1.0',
    mode: 'PRACTICE',
    allowedModes: ['PRACTICE'],
    targetCourse: 'Physiotherapy',
    priceNaira: 0,
    retakePriceNaira: 500,
    requiresCode: false,
    durationMins: 3,
    questionCount: 5,
    passMark: 50,
    maxTabSwitches: 3,
    isFeatured: true,
    shuffleQuestions: true,
    allowedCourses: ['ana-301'],
    status: 'OPEN',
    resultsReleased: true,
    releaseMode: 'INSTANT',
    releaseAt: null,
    description: 'Rapid 3-minute recall sprint on spinal pathways and ascending tracts.',
    createdAt: '2026-11-05T10:00:00Z'
  },
  {
    id: 'sit-drill-2',
    title: 'Use of English Speed Lexis Drill',
    mode: 'PRACTICE',
    allowedModes: ['PRACTICE'],
    targetCourse: 'All Courses',
    priceNaira: 0,
    retakePriceNaira: 0,
    requiresCode: false,
    durationMins: 5,
    questionCount: 10,
    passMark: 50,
    maxTabSwitches: 3,
    isFeatured: false,
    shuffleQuestions: true,
    allowedCourses: ['eng-101'],
    status: 'OPEN',
    resultsReleased: true,
    releaseMode: 'INSTANT',
    releaseAt: null,
    description: 'Fast-paced vocabulary, concord, and comprehension speed drill.',
    createdAt: '2026-11-06T08:00:00Z'
  },
  {
    id: 'sit-mock-1',
    title: 'AIA Official Pre-Clinical Mock 1.0',
    mode: 'OFFICIAL',
    allowedModes: ['OFFICIAL'],
    targetCourse: 'Physiotherapy',
    priceNaira: 1000,
    retakePriceNaira: 1000,
    requiresCode: true,
    durationMins: 15,
    questionCount: 20,
    passMark: 60,
    maxTabSwitches: 3,
    isFeatured: true,
    shuffleQuestions: true,
    allowedCourses: ['ana-301', 'phs-204', 'msk-402'],
    status: 'OPEN',
    resultsReleased: true,
    releaseMode: 'INSTANT',
    releaseAt: null,
    description: 'Standard proctored exam conditions with verified leaderboard entry.',
    createdAt: '2026-11-06T12:00:00Z'
  },
  {
    id: 'sit-combo-1',
    title: 'National Multi-Subject Marathon 1.0',
    mode: 'BUNDLED',
    allowedModes: ['BUNDLED'],
    targetCourse: 'All Courses',
    priceNaira: 1500,
    retakePriceNaira: 1500,
    requiresCode: true,
    durationMins: 30,
    questionCount: 40,
    passMark: 55,
    maxTabSwitches: 3,
    isFeatured: true,
    shuffleQuestions: true,
    allowedCourses: ['ana-301', 'phs-204', 'eng-101', 'mth-101'],
    status: 'OPEN',
    resultsReleased: true,
    releaseMode: 'INSTANT',
    releaseAt: null,
    description: 'Combined multi-course marathon sitting across core subjects.',
    createdAt: '2026-11-07T09:00:00Z'
  }
];

const INITIAL_CODES = [
  {
    id: 'c_demo_1',
    code: 'AIA-2026-VIP',
    sittingId: 'ALL',
    sittingTitle: 'Universal Single-Use Pass (All Exams)',
    mode: 'ALL',
    priceNaira: 1000,
    assignedTo: 'Demo Candidate',
    status: 'LIVE',
    maxUses: 1,
    usedCount: 0,
    createdAt: 'Today'
  }
];

const INITIAL_ANNOUNCEMENTS = [
  {
    id: 'ann_1',
    title: 'AIA Official Mock 1.0 Live Sitting',
    body: 'Get your access code via WhatsApp to compete across Nigerian universities this week.',
    imageUrl:
      'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&w=800&q=80',
    ctaLabel: 'Get Access Code',
    ctaUrl: 'https://wa.me/2348000000000'
  },
  {
    id: 'ann_2',
    title: 'Expanded Nationwide Subject Bank',
    body: 'Practice questions across Medical, Engineering, Sciences, Law, and UTME courses.',
    imageUrl:
      'https://images.unsplash.com/photo-1576091160550-2173dba999ef?auto=format&fit=crop&w=800&q=80',
    ctaLabel: 'Browse All Exams',
    ctaUrl: '#all-mocks'
  }
];

const INITIAL_QUESTION_BANK = [
  {
    id: 'q1',
    courseId: 'ana-301',
    courseCode: 'ANA 301',
    question:
      'Which ascending spinal tract is primarily responsible for transmitting conscious proprioception, two-point discrimination, and vibration sense from the lower limb?',
    options: [
      'Anterior spinothalamic tract',
      'Fasciculus gracilis',
      'Fasciculus cuneatus',
      'Lateral spinothalamic tract'
    ],
    correctIndex: 1,
    explanation:
      'Fasciculus gracilis carries dorsal column modalities from levels below T6 (lower extremities).'
  },
  {
    id: 'q2',
    courseId: 'ana-301',
    courseCode: 'ANA 301',
    question:
      'A lesion of the right subthalamic nucleus of Luys most characteristically produces which motor deficit?',
    options: [
      'Ipsilateral resting tremor',
      'Contralateral hemiballismus',
      'Bilateral choreoathetosis',
      'Ipsilateral dysdiadochokinesia'
    ],
    correctIndex: 1,
    explanation:
      'Damage to the subthalamic nucleus reduces excitatory drive to the globus pallidus internus, causing contralateral hemiballismus.'
  },
  {
    id: 'q3',
    courseId: 'msk-402',
    courseCode: 'MSK 402',
    question:
      'Which rotator cuff muscle initiates the first 15 degrees of glenohumeral abduction and is tested clinically via the "Empty Can" (Jobe) test?',
    options: ['Infraspinatus', 'Teres minor', 'Supraspinatus', 'Subscapularis'],
    correctIndex: 2,
    explanation:
      'Supraspinatus abducts the arm for the initial 15 degrees before the deltoid takes over.'
  },
  {
    id: 'q4',
    courseId: 'phs-204',
    courseCode: 'PHS 204',
    question:
      'During the cardiac cycle, the first heart sound (S1) corresponds directly with which mechanical event?',
    options: [
      'Closure of the aortic and pulmonary semilunar valves',
      'Rapid ventricular filling during diastole',
      'Closure of the mitral and tricuspid atrioventricular valves',
      'Atrial systole following the P wave'
    ],
    correctIndex: 2,
    explanation:
      'S1 marks the onset of isovolumetric ventricular contraction when the mitral and tricuspid valves snap shut.'
  },
  {
    id: 'q5',
    courseId: 'eng-101',
    courseCode: 'ENG 101',
    question:
      'Choose the option nearest in meaning to the capitalized word: The professor’s lecture was remarkably LUCID.',
    options: [
      'Ambiguous and lengthy',
      'Clear and easily understood',
      'Hostile and controversial',
      'Brief and inaudible'
    ],
    correctIndex: 1,
    explanation: 'Lucid means expressed clearly; easy to understand.'
  },
  {
    id: 'q6',
    courseId: 'mth-101',
    courseCode: 'MTH 101',
    question: 'Find the derivative of f(x) = 3x² - 5x + 7 with respect to x.',
    options: ['6x - 5', '3x - 5', '6x + 7', 'x³ - 5'],
    correctIndex: 0,
    explanation: 'By power rule, d/dx(3x²) = 6x and d/dx(-5x) = -5.'
  }
];

const INITIAL_STANDINGS = [
  {
    id: 's1',
    name: 'Darasimi A.',
    email: 'darasimi@student.edu.ng',
    institution: 'Lagos State University (LASU / LASUCOM)',
    dept: 'Physiotherapy',
    sittingId: 'sit-mock-1',
    sittingTitle: 'AIA Official Pre-Clinical Mock 1.0',
    score: 98,
    timeSecs: 114,
    mode: 'OFFICIAL'
  },
  {
    id: 's2',
    name: 'Korede A.',
    email: 'korede@student.edu.ng',
    institution: 'University of Lagos (UNILAG)',
    dept: 'Medicine & Surgery (MBBS)',
    sittingId: 'sit-mock-1',
    sittingTitle: 'AIA Official Pre-Clinical Mock 1.0',
    score: 96,
    timeSecs: 142,
    mode: 'OFFICIAL'
  },
  {
    id: 's3',
    name: 'Zainab O.',
    email: 'zainab@student.edu.ng',
    institution: 'University of Ibadan (UI)',
    dept: 'Physiotherapy',
    sittingId: 'sit-mock-1',
    sittingTitle: 'AIA Official Pre-Clinical Mock 1.0',
    score: 96,
    timeSecs: 165,
    mode: 'OFFICIAL'
  },
  {
    id: 's4',
    name: 'Chibuike N.',
    email: 'chibuike@student.edu.ng',
    institution: 'University of Nigeria, Nsukka (UNN)',
    dept: 'Nursing Science',
    sittingId: 'sit-drill',
    sittingTitle: 'Neuroanatomy Rapid Recall Sprint 1.0',
    score: 94,
    timeSecs: 88,
    mode: 'PRACTICE'
  },
  {
    id: 's5',
    name: 'Toluwalase B.',
    email: 'tolu@student.edu.ng',
    institution: 'Obafemi Awolowo University (OAU), Ile-Ife',
    dept: 'Computer Science',
    sittingId: 'sit-combo-1',
    sittingTitle: 'National Multi-Subject Marathon 1.0',
    score: 92,
    timeSecs: 178,
    mode: 'BUNDLED'
  }
];

function sittingMatchesCategory(sit, categoryMode) {
  if (!sit) return false;
  if (Array.isArray(sit.allowedModes) && sit.allowedModes.length > 0) {
    return sit.allowedModes.includes(categoryMode);
  }
  return sit.mode === categoryMode;
}

function getUniqueFirstAttempts(rows, isSingleSitting = false) {
  const seen = new Set();
  const unique = [];
  const chronological = [...rows].sort((a, b) =>
    String(a.createdAt || a.id).localeCompare(String(b.createdAt || b.id))
  );
  for (const r of chronological) {
    const personKey = (r.userId || r.email || r.name || '').toLowerCase().trim();
    const key = isSingleSitting ? personKey : `${personKey}__${r.sittingId || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(r);
    }
  }
  return unique.sort((a, b) => (b.score !== a.score ? b.score - a.score : a.timeSecs - b.timeSecs));
}

// ============================================================================
// OVERFLOW-PROOF PODIUM FOR 1ST, 2ND, AND 3RD PLACE
// ============================================================================
function TopThreePodium({ topThree, formatSecs, currentUserName }) {
  if (!topThree || topThree.length === 0) return null;

  const slots = [
    { rank: 2, item: topThree[1], isCenter: false },
    { rank: 1, item: topThree[0], isCenter: true },
    { rank: 3, item: topThree[2], isCenter: false }
  ].filter((s) => Boolean(s.item));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 items-stretch sm:items-end pt-2 pb-1">
      {slots.map(({ rank, item, isCenter }) => {
        const isMe =
          currentUserName && item.name.toLowerCase() === currentUserName.toLowerCase();

        const cardStyle =
          rank === 1
            ? 'bg-gradient-to-b from-amber-500/20 via-orange-500/10 to-transparent border-2 border-amber-500/60 shadow-xl shadow-orange-500/10 sm:py-5 order-1 sm:order-2'
            : rank === 2
            ? 'bg-gradient-to-b from-zinc-300/25 via-zinc-200/10 to-transparent dark:from-zinc-700/30 border border-zinc-300 dark:border-zinc-700 sm:py-4 order-2 sm:order-1'
            : 'bg-gradient-to-b from-orange-700/20 via-orange-800/5 to-transparent border border-orange-500/30 sm:py-4 order-3';

        const iconWrap =
          rank === 1
            ? 'w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 text-white shadow-lg shadow-orange-500/30'
            : rank === 2
            ? 'w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-gradient-to-br from-zinc-200 to-zinc-400 dark:from-zinc-600 dark:to-zinc-800 text-zinc-900 dark:text-white'
            : 'w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-700 to-orange-900 text-amber-100';

        return (
          <div
            key={item.id}
            className={`relative overflow-hidden rounded-3xl p-4 flex sm:flex-col items-center justify-between sm:justify-center text-left sm:text-center gap-3 min-w-0 max-w-full ${cardStyle}`}
          >
            <div className="flex sm:flex-col items-center gap-3 sm:gap-2 min-w-0 flex-1 sm:w-full">
              <div className="relative flex-shrink-0">
                <div className={`flex items-center justify-center ${iconWrap}`}>
                  {rank === 1 ? (
                    <Trophy className="w-6 h-6 sm:w-7 sm:h-7" />
                  ) : rank === 2 ? (
                    <Medal className="w-5 h-5" />
                  ) : (
                    <Award className="w-5 h-5" />
                  )}
                </div>
                <span
                  className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full font-mono text-[10px] font-extrabold ${
                    rank === 1
                      ? 'bg-black text-amber-400 border border-amber-400'
                      : rank === 2
                      ? 'bg-zinc-800 text-white'
                      : 'bg-orange-950 text-orange-300'
                  }`}
                >
                  #{rank}
                </span>
              </div>

              <div className="min-w-0 flex-1 sm:w-full px-1">
                <div className="flex items-center sm:justify-center gap-1 min-w-0">
                  <h4
                    className={`font-extrabold truncate max-w-full ${
                      isCenter ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                    }`}
                    title={item.name}
                  >
                    {item.name}
                  </h4>
                  {isMe && (
                    <span className="flex-shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-600 text-white font-bold">
                      YOU
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-zinc-500 truncate max-w-full" title={item.dept}>
                  {item.dept}
                </p>
              </div>
            </div>

            <div className="text-right sm:text-center font-mono sm:pt-1 flex-shrink-0">
              <span
                className={`font-extrabold block ${
                  rank === 1
                    ? 'text-lg sm:text-xl text-orange-600 dark:text-amber-400'
                    : 'text-base text-orange-600 dark:text-orange-400'
                }`}
              >
                {item.score}%
              </span>
              <span className="text-[11px] text-teal-600 dark:text-teal-400 font-semibold whitespace-nowrap">
                ⚡ {formatSecs(item.timeSecs)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function App() {
  const { darkMode, toggleTheme } = useTheme();
  const isAdminRoute = window.location.pathname.startsWith('/admin');

  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('signin');
  const [showPassword, setShowPassword] = useState(false);
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [authError, setAuthError] = useState('');
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    institution: 'Lagos State University (LASU / LASUCOM)',
    department: 'Physiotherapy'
  });

  // Main Tabs: 'tests' | 'all-mocks' | 'my-results' | 'leaderboard' | 'saved' | 'profile'
  const [activeTab, setActiveTab] = useState('tests');
  const [selectedMode, setSelectedMode] = useState('PRACTICE');
  const [selectedSittingId, setSelectedSittingId] = useState('sit-drill');
  const [examSearch, setExamSearch] = useState('');
  const [examPage, setExamPage] = useState(0);
  const EXAMS_PER_PAGE = 4;

  const [pendingSharedExamId, setPendingSharedExamId] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('exam') || null;
  });

  const [userAttemptHistory, setUserAttemptHistory] = useState(() => {
    const saved = localStorage.getItem('aia_user_attempt_history');
    return saved ? JSON.parse(saved) : {};
  });

  // Persisted Full Student Scripts so candidates can re-open Held Results later without needing a code!
  const [studentResultsHistory, setStudentResultsHistory] = useState(() => {
    const saved = localStorage.getItem('aia_student_results_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [homeRankingTab, setHomeRankingTab] = useState('students');
  const [rankingFilter, setRankingFilter] = useState('overall');
  const [standingsPage, setStandingsPage] = useState(0);
  const STANDINGS_PER_PAGE = 8;

  const [leaderboardModalConfig, setLeaderboardModalConfig] = useState(null);

  const [mockDirectorySearch, setMockDirectorySearch] = useState('');
  const [mockDirectoryCategory, setMockDirectoryCategory] = useState('ALL');
  const [mockDirectoryCourse, setMockDirectoryCourse] = useState('ALL');
  const [mockDirectorySort, setMockDirectorySort] = useState('latest');

  const [copiedExamLinkId, setCopiedExamLinkId] = useState(null);
  const [savedPage, setSavedPage] = useState(0);

  const [courses, setCourses] = useState(() => {
    const saved = localStorage.getItem('aia_courses');
    return saved ? JSON.parse(saved) : DEFAULT_SUBJECT_CATALOG;
  });
  const [sittings, setSittings] = useState(() => {
    const saved = localStorage.getItem('aia_sittings');
    return saved ? JSON.parse(saved) : INITIAL_SITTINGS;
  });
  const [accessCodes, setAccessCodes] = useState(() => {
    const saved = localStorage.getItem('aia_access_codes');
    return saved ? JSON.parse(saved) : INITIAL_CODES;
  });
  const [announcements, setAnnouncements] = useState(() => {
    const saved = localStorage.getItem('aia_announcements');
    return saved ? JSON.parse(saved) : INITIAL_ANNOUNCEMENTS;
  });
  const [platformConfig, setPlatformConfig] = useState(() => {
    const saved = localStorage.getItem('aia_platform_config');
    return saved
      ? JSON.parse(saved)
      : {
          whatsappNumber: '2348000000000',
          organiserEmail: 'ayodejiakin2020@gmail.com',
          adminPin: '2026'
        };
  });
  const [auditLogs, setAuditLogs] = useState(() => {
    const saved = localStorage.getItem('aia_audit_logs');
    return saved
      ? JSON.parse(saved)
      : [{ id: 'al_1', action: 'Initialized AIA Mock Platform', target: 'System', time: 'Today' }];
  });

  const [questionBank, setQuestionBank] = useState(() => {
    const saved = localStorage.getItem('aia_question_bank');
    return saved ? JSON.parse(saved) : INITIAL_QUESTION_BANK;
  });
  const [standings, setStandings] = useState(() => {
    const saved = localStorage.getItem('aia_standings');
    return saved ? JSON.parse(saved) : INITIAL_STANDINGS;
  });
  const [bookmarks, setBookmarks] = useState(() => {
    const saved = localStorage.getItem('aia_bookmarks');
    return saved ? JSON.parse(saved) : [];
  });
  const [flaggedReports, setFlaggedReports] = useState(() => {
    const saved = localStorage.getItem('aia_reports');
    return saved ? JSON.parse(saved) : [];
  });
  const [notifications] = useState([
    { id: 'n1', title: 'AIA Official Mock 1.0 is open for attempts', time: 'Just now' },
    { id: 'n2', title: 'Re-open any past or held exam result from "My Results"', time: '1h ago' }
  ]);
  const [showNotifDropdown, setShowNotifDropdown] = useState(false);

  const [showCodeGateModal, setShowCodeGateModal] = useState(false);
  const [enteredCode, setEnteredCode] = useState('');
  const [codeGateError, setCodeGateError] = useState('');

  const [annSlide, setAnnSlide] = useState(0);
  const [selectedAnnouncementModal, setSelectedAnnouncementModal] = useState(null);

  const [activeExamSession, setActiveExamSession] = useState(null);
  const [lastExamResult, setLastExamResult] = useState(null);

  // Supabase Auth & Cloud Sync
  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('aia_active_user');
      if (savedUser) setUser(JSON.parse(savedUser));
    } catch (e) {
      localStorage.removeItem('aia_active_user');
    }

    if (isSupabaseConfigured && supabase) {
      supabase.auth.getSession().then(async ({ data: { session } }) => {
        if (session?.user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          const activeProfile = {
            id: session.user.id,
            email: session.user.email,
            fullName:
              prof?.full_name ||
              session.user.user_metadata?.full_name ||
              session.user.email.split('@')[0],
            institution:
              prof?.institution ||
              session.user.user_metadata?.institution ||
              'Lagos State University (LASU / LASUCOM)',
            department:
              prof?.department ||
              session.user.user_metadata?.department ||
              'Physiotherapy'
          };
          setUser(activeProfile);
          localStorage.setItem('aia_active_user', JSON.stringify(activeProfile));
        }
      });

      const fetchCloudData = async () => {
        const [
          { data: dbCourses },
          { data: dbSittings },
          { data: dbCodes },
          { data: dbQuestions },
          { data: dbResults },
          { data: dbAnns },
          { data: dbSettings }
        ] = await Promise.all([
          supabase.from('courses').select('*').order('code'),
          supabase.from('sittings').select('*').order('created_at', { ascending: false }),
          supabase.from('access_codes').select('*').order('created_at', { ascending: false }),
          supabase.from('questions').select('*').order('created_at', { ascending: false }),
          supabase.from('exam_results').select('*').order('created_at', { ascending: true }),
          supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(3),
          supabase.from('platform_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        if (dbSettings) {
          setPlatformConfig((prev) => ({
            ...prev,
            whatsappNumber: dbSettings.whatsapp_number || prev.whatsappNumber,
            organiserEmail: dbSettings.organiser_email || prev.organiserEmail,
            adminPin: dbSettings.admin_pin || prev.adminPin
          }));
        }

        if (dbCourses?.length) setCourses(dbCourses);
        if (dbSittings?.length) {
          setSittings(
            dbSittings.map((s) => ({
              id: s.id,
              title: s.title,
              mode: s.mode,
              allowedModes: s.allowed_modes || [s.mode],
              targetCourse: s.target_course || 'All Courses',
              priceNaira: s.price_naira || 0,
              retakePriceNaira: s.retake_price_naira || 0,
              requiresCode: s.requires_code,
              durationMins: s.duration_mins,
              questionCount: s.question_count,
              passMark: s.pass_mark || 50,
              maxTabSwitches: s.max_tab_switches || 3,
              isFeatured: Boolean(s.is_featured),
              shuffleQuestions: s.shuffle_questions !== false,
              allowedCourses: s.allowed_courses || [],
              status: s.status,
              resultsReleased: s.results_released !== false,
              releaseMode:
                s.release_mode || (s.results_released === false ? 'HELD' : 'INSTANT'),
              releaseAt: s.release_at || null,
              description: s.description,
              createdAt: s.created_at
            }))
          );
        }
        if (dbCodes?.length) {
          setAccessCodes(
            dbCodes.map((c) => ({
              id: c.id,
              code: c.code,
              sittingId: c.sitting_id || 'ALL',
              sittingTitle: c.sitting_title || 'Universal Pass (All Exams)',
              mode: c.mode || 'ALL',
              priceNaira: c.price_naira,
              assignedTo: c.assigned_to,
              status: c.status,
              maxUses: c.max_uses,
              usedCount: c.used_count
            }))
          );
        }
        if (dbQuestions?.length) {
          setQuestionBank(
            dbQuestions.map((q) => ({
              id: q.id,
              courseId: q.course_id,
              courseCode: q.course_code,
              passage: q.passage,
              question: q.question,
              options: q.options,
              correctIndex: q.correct_index,
              explanation: q.explanation
            }))
          );
        }
        if (dbResults?.length) {
          const mapped = dbResults.map((r) => ({
            id: r.id,
            userId: r.user_id,
            email: r.email || '',
            name: r.student_name,
            institution: r.institution || 'Lagos State University (LASU / LASUCOM)',
            dept: r.department,
            sittingId: r.sitting_id || 'sit-mock-1',
            sittingTitle: r.title || 'Mock Assessment',
            score: r.percentage,
            totalQuestions: r.total_questions || 20,
            correctCount: r.correct_count || 0,
            timeSecs: r.time_spent_seconds,
            mode: r.mode,
            answers: r.answers_json || {},
            questions: r.questions_json || [],
            createdAt: r.created_at
          }));
          setStandings(getUniqueFirstAttempts(mapped, false));
        }
        if (dbAnns?.length) {
          setAnnouncements(
            dbAnns.map((a) => ({
              id: a.id,
              title: a.title,
              body: a.body,
              imageUrl: a.image_url,
              ctaLabel: a.cta_label,
              ctaUrl: a.cta_url
            }))
          );
        }
      };

      fetchCloudData();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('aia_courses', JSON.stringify(courses));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem('aia_sittings', JSON.stringify(sittings));
  }, [sittings]);

  useEffect(() => {
    localStorage.setItem('aia_access_codes', JSON.stringify(accessCodes));
  }, [accessCodes]);

  useEffect(() => {
    localStorage.setItem('aia_announcements', JSON.stringify(announcements));
  }, [announcements]);

  useEffect(() => {
    localStorage.setItem('aia_platform_config', JSON.stringify(platformConfig));
  }, [platformConfig]);

  useEffect(() => {
    localStorage.setItem('aia_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  useEffect(() => {
    localStorage.setItem('aia_question_bank', JSON.stringify(questionBank));
  }, [questionBank]);

  useEffect(() => {
    localStorage.setItem('aia_standings', JSON.stringify(standings));
  }, [standings]);

  useEffect(() => {
    localStorage.setItem('aia_bookmarks', JSON.stringify(bookmarks));
  }, [bookmarks]);

  useEffect(() => {
    localStorage.setItem('aia_reports', JSON.stringify(flaggedReports));
  }, [flaggedReports]);

  useEffect(() => {
    localStorage.setItem('aia_user_attempt_history', JSON.stringify(userAttemptHistory));
  }, [userAttemptHistory]);

  useEffect(() => {
    localStorage.setItem('aia_student_results_history', JSON.stringify(studentResultsHistory));
  }, [studentResultsHistory]);

  useEffect(() => {
    if (announcements.length <= 1) return;
    const timer = setInterval(() => {
      setAnnSlide((prev) => (prev + 1) % announcements.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [announcements.length]);

  // Retrieve a student's saved result for a specific sitting (from local history or cloud standings)
  const getSavedResultForSitting = (sitId) => {
    if (!user || !sitId) return null;
    const myEmail = (user.email || '').toLowerCase().trim();
    const myName = (user.fullName || '').toLowerCase().trim();

    const localMatch = studentResultsHistory.find(
      (r) =>
        String(r.sittingId) === String(sitId) &&
        ((r.userEmail && r.userEmail.toLowerCase() === myEmail) ||
          (r.userName && r.userName.toLowerCase() === myName))
    );
    if (localMatch) return localMatch;

    const standingMatch = standings.find(
      (s) =>
        String(s.sittingId) === String(sitId) &&
        ((s.email && myEmail && s.email.toLowerCase() === myEmail) ||
          s.name.toLowerCase() === myName)
    );

    if (standingMatch) {
      const sitObj = sittings.find((item) => String(item.id) === String(sitId));
      const fallbackQs =
        Array.isArray(standingMatch.questions) && standingMatch.questions.length > 0
          ? standingMatch.questions
          : questionBank.filter((q) => (sitObj?.allowedCourses || []).includes(q.courseId));
      const finalQs = fallbackQs.length > 0 ? fallbackQs : questionBank;
      const ansMap = standingMatch.answers || {};

      return {
        entryId: standingMatch.id,
        sittingId: standingMatch.sittingId,
        sittingTitle: standingMatch.sittingTitle,
        title: standingMatch.sittingTitle,
        mode: standingMatch.mode,
        passMark: sitObj?.passMark || 50,
        totalQuestions: standingMatch.totalQuestions || finalQs.length,
        correctCount:
          standingMatch.correctCount ||
          Math.round((standingMatch.score / 100) * (standingMatch.totalQuestions || finalQs.length)),
        percentage: standingMatch.score,
        timeSpentSeconds: standingMatch.timeSecs,
        answers: ansMap,
        questions: finalQs,
        missedQuestions: finalQs.filter((q) => ansMap[q.id] !== q.correctIndex),
        isFirstAttempt: true,
        attemptNumber: 1,
        completedAt: standingMatch.createdAt || new Date().toISOString()
      };
    }

    return null;
  };

  // All results belonging to the currently logged-in student
  const myAllSavedResults = (() => {
    if (!user) return [];
    const map = new Map();
    sittings.forEach((s) => {
      const found = getSavedResultForSitting(s.id);
      if (found) map.set(s.id, found);
    });
    studentResultsHistory.forEach((r) => {
      const myEmail = (user.email || '').toLowerCase().trim();
      const myName = (user.fullName || '').toLowerCase().trim();
      if (
        (r.userEmail && r.userEmail.toLowerCase() === myEmail) ||
        (r.userName && r.userName.toLowerCase() === myName)
      ) {
        if (!map.has(r.sittingId)) map.set(r.sittingId, r);
      }
    });
    return Array.from(map.values());
  })();

  const getUserAttemptsForSitting = (sitId) => {
    if (!user || !sitId) return 0;
    const userKey = (user.email || user.fullName || '').toLowerCase().trim();
    const localCount = Number(userAttemptHistory[`${userKey}__${sitId}`] || 0);
    const hasSavedResult = Boolean(getSavedResultForSitting(sitId));
    return Math.max(localCount, hasSavedResult ? 1 : 0);
  };

  const getSittingGateDetails = (sit) => {
    if (!sit) return { needsCode: false, effectivePrice: 0, isPaidRetake: false, attemptsMade: 0 };
    const attemptsMade = getUserAttemptsForSitting(sit.id);
    const baseRequiresCode = Boolean(sit.requiresCode && Number(sit.priceNaira || 0) > 0);
    const retakeFee = Number(sit.retakePriceNaira || 0);

    if (attemptsMade === 0) {
      return {
        needsCode: baseRequiresCode,
        effectivePrice: baseRequiresCode ? Number(sit.priceNaira || 0) : 0,
        isPaidRetake: false,
        attemptsMade
      };
    }

    if (retakeFee > 0 || baseRequiresCode) {
      return {
        needsCode: true,
        effectivePrice: retakeFee > 0 ? retakeFee : Number(sit.priceNaira || 0),
        isPaidRetake: !baseRequiresCode && retakeFee > 0,
        attemptsMade
      };
    }

    return { needsCode: false, effectivePrice: 0, isPaidRetake: false, attemptsMade };
  };

  // DEEP LINKING: If student already took this exam, open their result directly (no code needed!); otherwise open code gate or exam
  useEffect(() => {
    if (!pendingSharedExamId || sittings.length === 0) return;

    const targetExam = sittings.find((s) => String(s.id) === String(pendingSharedExamId));
    if (targetExam) {
      setSelectedMode(targetExam.mode);
      setSelectedSittingId(targetExam.id);
      setActiveTab('tests');

      if (user) {
        const existingResult = getSavedResultForSitting(targetExam.id);
        if (existingResult) {
          setLastExamResult(existingResult);
        } else {
          setEnteredCode('');
          setCodeGateError('');
          const gate = getSittingGateDetails(targetExam);
          if (gate.needsCode) {
            setShowCodeGateModal(true);
          } else {
            launchExamRoomForSitting(targetExam);
          }
        }
        setPendingSharedExamId(null);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, [pendingSharedExamId, sittings, user]);

  const logAdminAction = (action, target = '') => {
    setAuditLogs((prev) => [
      {
        id: 'al_' + Date.now(),
        action,
        target,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      },
      ...prev
    ]);
  };

  if (isAdminRoute) {
    return (
      <AdminConsole
        courses={courses}
        setCourses={setCourses}
        sittings={sittings}
        setSittings={setSittings}
        accessCodes={accessCodes}
        setAccessCodes={setAccessCodes}
        questionBank={questionBank}
        setQuestionBank={setQuestionBank}
        standings={standings}
        setStandings={setStandings}
        announcements={announcements}
        setAnnouncements={setAnnouncements}
        flaggedReports={flaggedReports}
        setFlaggedReports={setFlaggedReports}
        platformConfig={platformConfig}
        setPlatformConfig={setPlatformConfig}
        auditLogs={auditLogs}
        logAdminAction={logAdminAction}
      />
    );
  }

  const formatSecs = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  };

  const handleTabChange = (tabId) => {
    setLastExamResult(null);
    setActiveTab(tabId);
  };

  const handleCopyShareableExamLink = (e, sit) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/?exam=${sit.id}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedExamLinkId(sit.id);
    setTimeout(() => setCopiedExamLinkId(null), 2000);
  };

  const handleNativeShareExam = async (e, sit) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/?exam=${sit.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: sit.title,
          text: `Attempt "${sit.title}" on AIA Academy`,
          url: shareUrl
        });
        return;
      } catch (err) {}
    }
    handleCopyShareableExamLink(e, sit);
  };

  const handleOpenLeaderboardBadge = (e, config) => {
    e.stopPropagation();
    setLeaderboardModalConfig(config);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (!formData.email || !formData.password) {
      setAuthError('Enter both your email address and password.');
      return;
    }
    if (authMode === 'signup' && !formData.fullName.trim()) {
      setAuthError('Enter your full name for your academic profile.');
      return;
    }

    setAuthSubmitting(true);

    try {
      if (isSupabaseConfigured && supabase) {
        if (authMode === 'signup') {
          const { data, error } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
              data: {
                full_name: formData.fullName.trim(),
                institution: formData.institution,
                department: formData.department
              }
            }
          });
          if (error) throw error;

          if (data?.user) {
            await supabase.from('profiles').upsert({
              id: data.user.id,
              full_name: formData.fullName.trim(),
              email: formData.email,
              institution: formData.institution,
              department: formData.department
            });

            const profile = {
              id: data.user.id,
              email: formData.email,
              fullName: formData.fullName.trim(),
              institution: formData.institution,
              department: formData.department
            };
            localStorage.setItem('aia_active_user', JSON.stringify(profile));
            setUser(profile);
          }
        } else {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: formData.email,
            password: formData.password
          });
          if (error) throw error;

          if (data?.user) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', data.user.id)
              .single();

            const profile = {
              id: data.user.id,
              email: data.user.email,
              fullName:
                prof?.full_name ||
                data.user.user_metadata?.full_name ||
                data.user.email.split('@')[0],
              institution:
                prof?.institution ||
                data.user.user_metadata?.institution ||
                'Lagos State University (LASU / LASUCOM)',
              department:
                prof?.department ||
                data.user.user_metadata?.department ||
                'Physiotherapy'
            };
            localStorage.setItem('aia_active_user', JSON.stringify(profile));
            setUser(profile);
          }
        }
      } else {
        const profile = {
          id: 'usr_' + Date.now(),
          email: formData.email,
          fullName: authMode === 'signup' ? formData.fullName.trim() : formData.email.split('@')[0],
          institution: formData.institution,
          department: formData.department
        };
        localStorage.setItem('aia_active_user', JSON.stringify(profile));
        setUser(profile);
      }
    } catch (err) {
      setAuthError(err.message || 'Authentication failed. Check your credentials.');
    } finally {
      setAuthSubmitting(false);
    }
  };

  const handleSignOut = async () => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    localStorage.removeItem('aia_active_user');
    setUser(null);
    setActiveExamSession(null);
    setLastExamResult(null);
  };

  const liveStudentSittings = sittings.filter((s) => s.status === 'OPEN');
  const examsInSelectedCategory = liveStudentSittings.filter((s) => {
    const inCat = sittingMatchesCategory(s, selectedMode);
    const matchesQuery =
      s.title.toLowerCase().includes(examSearch.toLowerCase()) ||
      (s.targetCourse || '').toLowerCase().includes(examSearch.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(examSearch.toLowerCase());
    return inCat && matchesQuery;
  });

  const activeSittingForMode =
    liveStudentSittings.find((s) => s.id === selectedSittingId) ||
    examsInSelectedCategory[0] ||
    liveStudentSittings[0] ||
    INITIAL_SITTINGS[0];

  const activeSittingGate = getSittingGateDetails(activeSittingForMode);
  const activeSittingSavedResult = getSavedResultForSitting(activeSittingForMode?.id);

  const totalExamPages = Math.max(1, Math.ceil(examsInSelectedCategory.length / EXAMS_PER_PAGE));
  const visibleExamsInSlot = examsInSelectedCategory.slice(
    examPage * EXAMS_PER_PAGE,
    (examPage + 1) * EXAMS_PER_PAGE
  );

  const handleSelectSittingCard = (sit, launchImmediately = false) => {
    setSelectedMode(sit.mode);
    setSelectedSittingId(sit.id);
    if (activeTab !== 'tests') {
      setActiveTab('tests');
    }
    if (launchImmediately) {
      setTimeout(() => {
        const gate = getSittingGateDetails(sit);
        if (gate.needsCode) {
          setEnteredCode('');
          setCodeGateError('');
          setShowCodeGateModal(true);
        } else {
          launchExamRoomForSitting(sit);
        }
      }, 40);
    }
  };

  const handleInitiateAssessment = () => {
    if (activeSittingForMode.status !== 'OPEN') {
      alert(`This exam (${activeSittingForMode.title}) is currently ${activeSittingForMode.status}.`);
      return;
    }
    const gate = getSittingGateDetails(activeSittingForMode);
    if (gate.needsCode) {
      setEnteredCode('');
      setCodeGateError('');
      setShowCodeGateModal(true);
    } else {
      launchExamRoomForSitting(activeSittingForMode);
    }
  };

  // UNIVERSAL 1-USE CODE VERIFICATION (Works across all paid sittings!)
  const handleVerifyAccessCode = async (e) => {
    e.preventDefault();
    setCodeGateError('');
    const cleanInput = enteredCode.trim().toUpperCase();

    // 1. Server-Side Universal Verification via Supabase RPC
    if (isSupabaseConfigured && supabase) {
      const { data: rpcResult, error: rpcErr } = await supabase.rpc(
        'verify_and_use_access_code',
        {
          input_code: cleanInput,
          target_sitting_id: String(activeSittingForMode.id)
        }
      );

      if (!rpcErr && rpcResult) {
        if (!rpcResult.valid) {
          setCodeGateError(
            rpcResult.message ||
              'Invalid or already used access code. Click the WhatsApp button below to get a new code.'
          );
          return;
        }
        setAccessCodes((prev) => prev.filter((c) => c.code.toUpperCase() !== cleanInput));
        setShowCodeGateModal(false);
        launchExamRoomForSitting(activeSittingForMode);
        return;
      }
    }

    // 2. Local Universal Fallback (Any LIVE unused code unlocks any sitting once)
    const matched = accessCodes.find(
      (c) =>
        c.code.toUpperCase() === cleanInput &&
        c.status === 'LIVE' &&
        c.usedCount < c.maxUses
    );

    if (!matched) {
      setCodeGateError(
        'Invalid or already used access code. Click the WhatsApp button below to get a new code.'
      );
      return;
    }

    // Immediately remove from local pool once used
    setAccessCodes((prev) => prev.filter((c) => c.code !== matched.code));
    if (isSupabaseConfigured && supabase) {
      await supabase
        .from('access_codes')
        .update({ used_count: matched.usedCount + 1, status: 'USED' })
        .eq('code', matched.code);
    }

    setShowCodeGateModal(false);
    launchExamRoomForSitting(activeSittingForMode);
  };

  const launchExamRoomForSitting = (sitObj, customQuestions = null, customTitle = null) => {
    const targetSitting = sitObj || activeSittingForMode;
    let filteredQuestions = customQuestions;

    if (!filteredQuestions) {
      const allowedIds = targetSitting.allowedCourses || [];
      filteredQuestions =
        allowedIds.length > 0
          ? questionBank.filter((q) => allowedIds.includes(q.courseId))
          : questionBank;

      if (filteredQuestions.length === 0) filteredQuestions = questionBank;

      if (targetSitting.shuffleQuestions !== false) {
        filteredQuestions = [...filteredQuestions].sort(() => Math.random() - 0.5);
      }

      if (targetSitting.questionCount && filteredQuestions.length > targetSitting.questionCount) {
        filteredQuestions = filteredQuestions.slice(0, targetSitting.questionCount);
      }
    }

    setLastExamResult(null);
    setActiveExamSession({
      sessionId: 'sess_' + Date.now(),
      sittingId: targetSitting.id,
      sittingTitle: targetSitting.title,
      passMark: targetSitting.passMark || 50,
      maxTabSwitches: targetSitting.maxTabSwitches || 3,
      releaseMode:
        targetSitting.releaseMode || (targetSitting.resultsReleased === false ? 'HELD' : 'INSTANT'),
      releaseAt: targetSitting.releaseAt || null,
      mode: targetSitting.mode,
      title: customTitle || targetSitting.title,
      durationSeconds: (targetSitting.durationMins || 15) * 60,
      questions: filteredQuestions
    });
  };

  const handleCompleteExam = async (resultData) => {
    const finishedSittingId = activeExamSession?.sittingId || activeSittingForMode.id;
    const finishedSittingTitle = activeExamSession?.sittingTitle || activeSittingForMode.title;
    const finishedPassMark = activeExamSession?.passMark || activeSittingForMode.passMark || 50;

    setActiveExamSession(null);

    const alreadyOnLeaderboard = standings.some(
      (s) =>
        String(s.sittingId) === String(finishedSittingId) &&
        (s.name.toLowerCase() === user.fullName.toLowerCase() ||
          (s.email && user.email && s.email.toLowerCase() === user.email.toLowerCase()))
    );

    const isFirstAttempt = !alreadyOnLeaderboard && getUserAttemptsForSitting(finishedSittingId) === 0;

    const userKey = (user.email || user.fullName || '').toLowerCase().trim();
    const historyKey = `${userKey}__${finishedSittingId}`;
    const nextAttemptNumber = Number(userAttemptHistory[historyKey] || 0) + 1;
    setUserAttemptHistory((prev) => ({
      ...prev,
      [historyKey]: nextAttemptNumber
    }));

    const entryId = 'st_' + Date.now();

    const fullResultRecord = {
      ...resultData,
      entryId,
      userEmail: user.email,
      userName: user.fullName,
      sittingId: finishedSittingId,
      sittingTitle: finishedSittingTitle,
      passMark: finishedPassMark,
      isFirstAttempt,
      attemptNumber: nextAttemptNumber
    };

    // Save full script in studentResultsHistory so they can always re-open held results later!
    setStudentResultsHistory((prev) => [
      fullResultRecord,
      ...prev.filter(
        (item) =>
          !(
            String(item.sittingId) === String(finishedSittingId) &&
            (item.userEmail || '').toLowerCase() === (user.email || '').toLowerCase()
          )
      )
    ]);

    if (isFirstAttempt) {
      const newEntry = {
        id: entryId,
        userId: user.id,
        email: user.email,
        name: user.fullName,
        institution: user.institution || 'Lagos State University (LASU / LASUCOM)',
        dept: user.department,
        sittingId: finishedSittingId,
        sittingTitle: finishedSittingTitle,
        score: resultData.percentage,
        totalQuestions: resultData.totalQuestions,
        correctCount: resultData.correctCount,
        timeSecs: resultData.timeSpentSeconds,
        mode: resultData.mode,
        answers: resultData.answers,
        questions: resultData.questions,
        createdAt: new Date().toISOString()
      };

      const updatedStandings = [...standings, newEntry].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.timeSecs - b.timeSecs;
      });

      setStandings(updatedStandings);

      if (isSupabaseConfigured && supabase) {
        await supabase.from('exam_results').insert({
          user_id: user.id.startsWith('usr_') ? null : user.id,
          email: user.email,
          student_name: user.fullName,
          institution: user.institution || 'Lagos State University (LASU / LASUCOM)',
          department: user.department,
          sitting_id: finishedSittingId,
          mode: resultData.mode,
          title: finishedSittingTitle,
          total_questions: resultData.totalQuestions,
          correct_count: resultData.correctCount,
          percentage: resultData.percentage,
          time_spent_seconds: resultData.timeSpentSeconds,
          answers_json: resultData.answers || {},
          questions_json: resultData.questions || []
        });
      }
    }

    setLastExamResult(fullResultRecord);
  };

  const handleToggleBookmark = (questionObj) => {
    setBookmarks((prev) =>
      prev.some((b) => b.id === questionObj.id)
        ? prev.filter((b) => b.id !== questionObj.id)
        : [questionObj, ...prev]
    );
  };

  const getWhatsAppPaymentUrl = () => {
    const feeToPay = activeSittingGate.effectivePrice || activeSittingForMode.priceNaira || 0;
    const attemptTag = activeSittingGate.isPaidRetake ? 'Retake Access Code' : 'Universal Access Code';
    const message = `Hello AIA Academy Organiser, I want to pay ₦${feeToPay.toLocaleString()} for a ${attemptTag}.\n\n• Candidate: ${user?.fullName}\n• Course of Study: ${user?.department}\n• Exam: ${activeSittingForMode.title} (${selectedMode})`;
    const phone = (platformConfig.whatsappNumber || '2348000000000').replace(/\D/g, '');
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  const directoryMocks = liveStudentSittings
    .filter((sit) => {
      const matchesCategory =
        mockDirectoryCategory === 'ALL' || sittingMatchesCategory(sit, mockDirectoryCategory);
      const matchesCourse =
        mockDirectoryCourse === 'ALL' ||
        (sit.targetCourse || 'All Courses') === mockDirectoryCourse ||
        (sit.allowedCourses || []).includes(mockDirectoryCourse);
      const matchesSearch =
        sit.title.toLowerCase().includes(mockDirectorySearch.toLowerCase()) ||
        (sit.description || '').toLowerCase().includes(mockDirectorySearch.toLowerCase()) ||
        (sit.targetCourse || '').toLowerCase().includes(mockDirectorySearch.toLowerCase());
      return matchesCategory && matchesCourse && matchesSearch;
    })
    .sort((a, b) => {
      if (mockDirectorySort === 'featured') {
        return Number(Boolean(b.isFeatured)) - Number(Boolean(a.isFeatured));
      }
      if (mockDirectorySort === 'free') {
        return (a.priceNaira || 0) - (b.priceNaira || 0);
      }
      return String(b.createdAt || b.id).localeCompare(String(a.createdAt || a.id));
    });

  const deptRankings = Object.values(
    standings.reduce((acc, row) => {
      if (!acc[row.dept]) acc[row.dept] = { dept: row.dept, totalScore: 0, count: 0 };
      acc[row.dept].totalScore += row.score;
      acc[row.dept].count += 1;
      return acc;
    }, {})
  )
    .map((d) => ({
      dept: d.dept,
      avgNum: +(d.totalScore / d.count).toFixed(1),
      avg: `${(d.totalScore / d.count).toFixed(1)}%`,
      students: d.count
    }))
    .sort((a, b) => b.avgNum - a.avgNum);

  const totalStandingsPages = Math.max(1, Math.ceil(standings.length / STANDINGS_PER_PAGE));
  const paginatedOverallStandings = standings.slice(
    standingsPage * STANDINGS_PER_PAGE,
    (standingsPage + 1) * STANDINGS_PER_PAGE
  );

  const totalSavedPages = Math.max(1, Math.ceil(bookmarks.length / EXAMS_PER_PAGE));
  const visibleBookmarks = bookmarks.slice(
    savedPage * EXAMS_PER_PAGE,
    (savedPage + 1) * EXAMS_PER_PAGE
  );

  const modalLeaderboardRows = leaderboardModalConfig
    ? getUniqueFirstAttempts(
        standings.filter((s) =>
          leaderboardModalConfig.type === 'exam'
            ? s.sittingId === leaderboardModalConfig.id
            : s.mode === leaderboardModalConfig.id
        ),
        leaderboardModalConfig.type === 'exam'
      )
    : [];

  const activeAnnouncement = announcements[annSlide] || announcements[0] || null;

  // ============================================================================
  // 1. LOCKED AUTHENTICATION GATE
  // ============================================================================
  if (!user) {
    const sharedSittingPreview = pendingSharedExamId
      ? sittings.find((s) => String(s.id) === String(pendingSharedExamId))
      : null;

    return (
      <div className="min-h-screen flex flex-col justify-between">
        <header className="w-full max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between border-b border-zinc-200/80 dark:border-zinc-900">
          <AiaLogo className="h-7 sm:h-8" />

          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl app-surface text-zinc-600 dark:text-zinc-400"
          >
            {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <div className="lg:col-span-5">
            <div className="app-surface rounded-3xl p-6 sm:p-8 space-y-6">
              {sharedSittingPreview && (
                <div className="p-3.5 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center gap-3 text-xs">
                  <Clock className="w-5 h-5 text-orange-600 flex-shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-[10px] uppercase font-bold text-orange-600 block">
                      Direct Exam Invite Link
                    </span>
                    <span className="font-bold text-zinc-900 dark:text-white truncate block">
                      Sign in to open "{sharedSittingPreview.title}"
                    </span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signin');
                    setAuthError('');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold ${
                    authMode === 'signin'
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-zinc-500'
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode('signup');
                    setAuthError('');
                  }}
                  className={`py-2 rounded-xl text-xs font-bold ${
                    authMode === 'signup'
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-zinc-500'
                  }`}
                >
                  Create Account
                </button>
              </div>

              <div>
                <h1 className="text-2xl font-extrabold tracking-tight">
                  {authMode === 'signin' ? 'Student Sign In' : 'Student Registration'}
                </h1>
                <p className="text-xs text-zinc-500 mt-1">
                  {authMode === 'signin'
                    ? 'Enter your credentials to access your CBT workspace.'
                    : 'Select your Nigerian institution and course of study to join the rankings.'}
                </p>
              </div>

              {authError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-500">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="space-y-3.5">
                {authMode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold mb-1.5">Full Name</label>
                    <div className="relative">
                      <User className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        placeholder="Oluwadarasimi Anibaba"
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:border-orange-600"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      placeholder="name@student.edu.ng"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:border-orange-600"
                    />
                  </div>
                </div>

                {authMode === 'signup' && (
                  <>
                    <SearchableSelect
                      label="School / University (Search across Nigeria)"
                      icon={GraduationCap}
                      value={formData.institution}
                      options={NIGERIAN_INSTITUTIONS}
                      onChange={(val) => setFormData({ ...formData, institution: val })}
                      placeholder="Search UNILAG, LASU, UI, OAU, UNILORIN..."
                    />

                    <SearchableSelect
                      label="Course of Study / Department"
                      icon={Building2}
                      value={formData.department}
                      options={NIGERIAN_COURSES_OF_STUDY}
                      onChange={(val) => setFormData({ ...formData, department: val })}
                      placeholder="Search Physiotherapy, MBBS, Law, Computer Science..."
                    />
                  </>
                )}

                <div>
                  <label className="block text-xs font-semibold mb-1.5">Password</label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm focus:outline-none focus:border-orange-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={authSubmitting}
                  className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm flex items-center justify-center gap-2 mt-2"
                >
                  <span>
                    {authSubmitting
                      ? 'Authenticating...'
                      : authMode === 'signin'
                      ? 'Enter Student Portal'
                      : 'Complete Registration'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6 min-w-0">
            <div className="relative overflow-hidden rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-white/20 bg-zinc-900">
              <img
                src={HERO_BG.local}
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = HERO_BG.fallback;
                }}
                alt=""
                className="absolute inset-0 w-full h-full object-cover object-center opacity-65 pointer-events-none"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-zinc-950/75 to-orange-600/35" />

              <div className="relative z-10 space-y-3">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-mono font-bold">
                  <Lock className="w-3.5 h-3.5 text-teal-400" />
                  <span>NATIONWIDE CBT MOCK PLATFORM</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                  Timed CBT simulations across Nigerian Universities & UTME courses.
                </h2>
                <p className="text-sm text-zinc-200 leading-relaxed max-w-xl">
                  Register with your school and department to sit for Speed Drills, Official Timed Mocks, and Multi-Subject Marathons.
                </p>
              </div>
            </div>

            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono uppercase tracking-wider font-bold text-zinc-500">
                  General Top 3 Podium (1st Attempts)
                </span>
                <span className="text-xs font-mono font-bold text-teal-600 dark:text-teal-400">
                  Score + Speed
                </span>
              </div>
              <TopThreePodium topThree={standings.slice(0, 3)} formatSecs={formatSecs} />
            </div>
          </div>
        </main>

        <footer className="py-4 text-center text-xs text-zinc-400">
          AIA Academy Assessment Platform • Nationwide Student Portal
        </footer>
      </div>
    );
  }

  // ============================================================================
  // 2. ACTIVE EXAM ROOM
  // ============================================================================
  if (activeExamSession) {
    return (
      <ExamRoom
        sessionConfig={activeExamSession}
        questions={activeExamSession.questions}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
        onReportQuestion={(rep) => setFlaggedReports((prev) => [rep, ...prev])}
        onCompleteExam={handleCompleteExam}
        onCancelExam={() => setActiveExamSession(null)}
      />
    );
  }

  // ============================================================================
  // 3. POST-EXAM RESULTS VIEW
  // ============================================================================
  if (lastExamResult) {
    return (
      <ResultView
        result={lastExamResult}
        user={user}
        sittings={sittings}
        standings={standings}
        bookmarks={bookmarks}
        onToggleBookmark={handleToggleBookmark}
        onRetryMistakes={(missedQs, oldTitle) =>
          launchExamRoomForSitting(activeSittingForMode, missedQs, `Retry Mistakes: ${oldTitle}`)
        }
        onReturnHome={() => setLastExamResult(null)}
      />
    );
  }

  // ============================================================================
  // 4. STUDENT WORKSPACE
  // ============================================================================
  return (
    <div className="min-h-screen pb-24 md:pb-12">
      <header className="sticky top-0 z-40 glass-nav">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-2">
          <AiaLogo className="h-7 sm:h-8 flex-shrink-0" />

          <nav className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-zinc-100 dark:bg-zinc-900">
            {[
              { id: 'tests', label: 'Assessments', icon: Clock },
              {
                id: 'all-mocks',
                label: `All Exams (${liveStudentSittings.length})`,
                icon: LayoutGrid
              },
              {
                id: 'my-results',
                label: `My Results (${myAllSavedResults.length})`,
                icon: FileCheck2
              },
              { id: 'leaderboard', label: 'Standings', icon: Trophy },
              { id: 'saved', label: `Saved (${bookmarks.length})`, icon: Bookmark },
              { id: 'profile', label: 'Profile', icon: User }
            ].map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${
                    isActive
                      ? 'bg-orange-600 text-white shadow-sm'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-2 relative">
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-teal-500/10 text-teal-700 dark:text-teal-300 text-xs font-bold">
              <Flame className="w-3.5 h-3.5 fill-teal-500 text-teal-500" />
              <span className="font-mono">3d</span>
            </div>

            <button
              onClick={() => setShowNotifDropdown(!showNotifDropdown)}
              className="relative p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-orange-600" />
            </button>

            {showNotifDropdown && (
              <div className="absolute right-0 top-12 w-72 app-surface rounded-2xl p-4 shadow-xl z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-2">
                  <span className="font-bold text-xs">Alerts</span>
                  <button
                    onClick={() => setShowNotifDropdown(false)}
                    className="text-[11px] text-orange-600 font-semibold"
                  >
                    Close
                  </button>
                </div>
                {notifications.map((n) => (
                  <div key={n.id} className="text-xs space-y-0.5">
                    <p className="font-semibold">{n.title}</p>
                    <span className="text-[10px] text-zinc-400">{n.time}</span>
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:hover:text-white"
              title="Instant Theme Switch"
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            <button
              onClick={handleSignOut}
              className="p-2 rounded-xl text-zinc-500 hover:text-red-600"
              title="Sign Out"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">
        {activeTab === 'tests' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            <div className="lg:col-span-8 space-y-6 min-w-0">
              {/* COMPACT HERO BANNER */}
              <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl px-5 py-4 sm:px-7 sm:py-5 text-white shadow-lg border border-orange-500/30 bg-zinc-900">
                <img
                  src={HERO_BG.local}
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src = HERO_BG.fallback;
                  }}
                  alt=""
                  className="absolute inset-0 w-full h-full object-cover object-center opacity-60 pointer-events-none"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-zinc-950/95 via-orange-950/80 to-orange-600/35" />

                <div className="relative z-10 flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white font-mono text-[10px] uppercase tracking-wider font-semibold max-w-full truncate">
                      <Sparkles className="w-3 h-3 text-teal-300 flex-shrink-0" />
                      <span className="truncate">{user.department}</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white truncate">
                      Ready, {user.fullName.split(' ')[0]}?
                    </h1>
                    <p className="text-xs text-zinc-200 max-w-md leading-snug">
                      Select an exam below to start, or click "View Result" on any completed sitting to check released scores without needing a code again.
                    </p>
                  </div>

                  {myAllSavedResults.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleTabChange('my-results')}
                      className="hidden sm:flex items-center gap-2 bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 px-4 py-2.5 rounded-2xl flex-shrink-0 text-xs font-bold transition-colors"
                    >
                      <FileCheck2 className="w-4 h-4 text-teal-400" />
                      <span>My Results ({myAllSavedResults.length})</span>
                    </button>
                  )}
                </div>
              </div>

              {/* STEP 1: SELECT EXAM CATEGORY */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    1. Select Exam Category
                  </span>
                  <button
                    type="button"
                    onClick={() => handleTabChange('all-mocks')}
                    className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline flex items-center gap-1"
                  >
                    <span>View All Exams ({liveStudentSittings.length})</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                  {['PRACTICE', 'OFFICIAL', 'BUNDLED'].map((modeKey) => {
                    const vis = MODE_VISUALS[modeKey];
                    const Icon = vis.icon;
                    const isSelected = selectedMode === modeKey;
                    const modeSittings = liveStudentSittings.filter((s) =>
                      sittingMatchesCategory(s, modeKey)
                    );

                    return (
                      <div
                        key={modeKey}
                        onClick={() => {
                          setSelectedMode(modeKey);
                          setExamPage(0);
                          if (modeSittings[0]) setSelectedSittingId(modeSittings[0].id);
                        }}
                        className={`group cursor-pointer relative overflow-hidden text-left p-4 sm:p-5 rounded-3xl border min-w-0 ${
                          isSelected
                            ? vis.activeRing
                            : 'border-zinc-200/90 dark:border-zinc-800 hover:border-orange-500/50'
                        }`}
                      >
                        <img
                          src={vis.localImage}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = vis.fallbackImage;
                          }}
                          alt=""
                          className={`absolute inset-0 w-full h-full object-cover object-center pointer-events-none ${
                            isSelected ? 'opacity-45 dark:opacity-50' : 'opacity-25 dark:opacity-30'
                          }`}
                        />

                        <div
                          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${vis.accent} backdrop-blur-[1.5px]`}
                        />

                        <div className="relative z-10 min-w-0">
                          <div className="flex items-center justify-between gap-2 mb-2.5">
                            <div
                              className={`w-8 h-8 rounded-xl flex items-center justify-center backdrop-blur-md flex-shrink-0 ${
                                isSelected
                                  ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30'
                                  : 'bg-white/80 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-200 border border-zinc-200/60 dark:border-zinc-700'
                              }`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>

                            <button
                              type="button"
                              onClick={(e) =>
                                handleOpenLeaderboardBadge(e, {
                                  type: 'category',
                                  id: modeKey,
                                  title: `${vis.name} Leaderboard`,
                                  subtitle: `1st-Attempt Standings under ${vis.name}`
                                })
                              }
                              className="inline-flex items-center gap-1 text-[10px] font-mono font-bold px-2.5 py-1 rounded-full bg-black/70 hover:bg-orange-600 text-white backdrop-blur-md transition-colors flex-shrink-0"
                              title={`View ${vis.name} Leaderboard`}
                            >
                              <Trophy className="w-3 h-3 text-amber-400" />
                              <span>{modeSittings.length} Exams</span>
                            </button>
                          </div>

                          <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white truncate">
                            {vis.name}
                          </h3>
                          <p className="text-[11px] font-mono font-bold text-orange-600 dark:text-orange-400 mt-0.5 truncate">
                            {vis.uniqueFeature}
                          </p>
                          <p className="text-xs text-zinc-700 dark:text-zinc-300 font-medium mt-1 leading-snug line-clamp-2">
                            {vis.summary}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* STEP 2: EXAMS IN SELECTED CATEGORY (With Direct "View My Result" Button!) */}
              <section id="courses" className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <span className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    2. Select {MODE_VISUALS[selectedMode]?.name} Exam ({examsInSelectedCategory.length})
                  </span>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1 sm:w-56">
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={examSearch}
                        onChange={(e) => {
                          setExamSearch(e.target.value);
                          setExamPage(0);
                        }}
                        placeholder={`Search ${MODE_VISUALS[selectedMode]?.name} exams...`}
                        className="w-full pl-8 pr-3 py-1.5 rounded-xl app-surface text-xs focus:outline-none focus:border-orange-500"
                      />
                    </div>

                    <div className="flex items-center gap-1 font-mono text-xs">
                      <button
                        disabled={examPage === 0}
                        onClick={() => setExamPage((p) => Math.max(0, p - 1))}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-1">
                        {examPage + 1}/{totalExamPages}
                      </span>
                      <button
                        disabled={examPage >= totalExamPages - 1}
                        onClick={() => setExamPage((p) => Math.min(totalExamPages - 1, p + 1))}
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {visibleExamsInSlot.length === 0 ? (
                  <div className="py-10 text-center border-y border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500">
                    No active exams found under {MODE_VISUALS[selectedMode]?.name}.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
                    {visibleExamsInSlot.map((sit) => {
                      const isSelected = activeSittingForMode.id === sit.id;
                      const isCopied = copiedExamLinkId === sit.id;
                      const attemptsCount = getUniqueFirstAttempts(
                        standings.filter((s) => s.sittingId === sit.id),
                        true
                      ).length;
                      const sitGate = getSittingGateDetails(sit);
                      const savedResultForThisSit = getSavedResultForSitting(sit.id);

                      return (
                        <div
                          key={sit.id}
                          onClick={() => handleSelectSittingCard(sit, false)}
                          className={`py-4 px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer ${
                            isSelected
                              ? 'bg-orange-500/[0.08] dark:bg-orange-500/[0.12]'
                              : 'hover:bg-zinc-100/60 dark:hover:bg-zinc-900/40'
                          }`}
                        >
                          <div className="flex items-start gap-3.5 min-w-0 flex-1">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                isSelected
                                  ? 'bg-orange-600 text-white'
                                  : 'border border-zinc-300 dark:border-zinc-700'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5" />}
                            </div>

                            <div className="min-w-0 flex-1 space-y-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-mono text-[10px] uppercase px-2 py-0.5 rounded bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold truncate max-w-[180px]">
                                  {sit.targetCourse || 'All Courses'}
                                </span>
                                <span className="font-mono text-xs font-extrabold text-orange-600 dark:text-orange-400">
                                  {sitGate.isPaidRetake
                                    ? `₦${sitGate.effectivePrice.toLocaleString()} (2nd Try)`
                                    : sitGate.needsCode
                                    ? `₦${sitGate.effectivePrice.toLocaleString()}`
                                    : Number(sit.retakePriceNaira || 0) > 0
                                    ? '1ST TRY FREE'
                                    : 'FREE'}
                                </span>
                                <span className="text-[11px] font-mono text-zinc-400">
                                  • {sit.durationMins} mins
                                </span>
                              </div>
                              <h4 className="font-bold text-sm truncate">{sit.title}</h4>
                              <p className="text-xs text-zinc-500 truncate">{sit.description}</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 flex-shrink-0 self-end sm:self-center">
                            {/* IF STUDENT ALREADY SUBMITTED THIS SITTING: Show "View Result" button (no code needed!) */}
                            {savedResultForThisSit && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setLastExamResult(savedResultForThisSit);
                                }}
                                className="px-2.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm"
                                title="Open your submitted result or check if held results have been released"
                              >
                                <FileCheck2 className="w-3.5 h-3.5" />
                                <span>View Result</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={(e) =>
                                handleOpenLeaderboardBadge(e, {
                                  type: 'exam',
                                  id: sit.id,
                                  title: sit.title,
                                  subtitle: `${sit.targetCourse || 'All Courses'} • 1st-Attempt Standings`
                                })
                              }
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 hover:bg-orange-600 hover:text-white border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono font-bold flex items-center gap-1 transition-colors"
                              title="View Leaderboard for this Exam"
                            >
                              <Trophy className="w-3.5 h-3.5 text-orange-500" />
                              <span>{attemptsCount}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleCopyShareableExamLink(e, sit)}
                              className="px-2.5 py-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-orange-600 text-[11px] font-mono font-bold flex items-center gap-1"
                              title="Copy Direct Exam URL Only"
                            >
                              {isCopied ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                  <span className="hidden sm:inline text-emerald-500">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Link2 className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Copy</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleNativeShareExam(e, sit)}
                              className="p-1.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-orange-600"
                              title="Share Exam"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* LAUNCH ACTION STRIP (Includes Free "View My Result" Button if already attempted!) */}
              <div className="relative overflow-hidden p-4 sm:px-6 rounded-3xl bg-zinc-950/95 dark:bg-zinc-900/90 backdrop-blur-xl border border-zinc-800 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg">
                <div className="relative z-10 min-w-0 flex-1">
                  <span className="text-[11px] font-mono uppercase tracking-wider text-teal-400 block truncate">
                    {activeSittingForMode.mode} •{' '}
                    {activeSittingSavedResult
                      ? 'Completed • Result Saved on Your Profile'
                      : activeSittingGate.isPaidRetake
                      ? `2nd Attempt Retake Fee: ₦${activeSittingGate.effectivePrice.toLocaleString()}`
                      : activeSittingGate.needsCode
                      ? `₦${activeSittingGate.effectivePrice.toLocaleString()} (Code Required)`
                      : Number(activeSittingForMode.retakePriceNaira || 0) > 0
                      ? `Free 1st Attempt (Retakes: ₦${Number(activeSittingForMode.retakePriceNaira).toLocaleString()})`
                      : 'Free Open Sitting'}
                  </span>
                  <span className="font-bold text-sm sm:text-base truncate block">
                    {activeSittingForMode.title}
                  </span>
                </div>

                <div className="relative z-10 flex items-center gap-2 flex-wrap sm:flex-nowrap flex-shrink-0">
                  {activeSittingSavedResult && (
                    <button
                      type="button"
                      onClick={() => setLastExamResult(activeSittingSavedResult)}
                      className="px-4 py-3 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold flex items-center gap-1.5 whitespace-nowrap shadow-md"
                    >
                      <FileCheck2 className="w-4 h-4" />
                      <span>View My Result</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) =>
                      handleOpenLeaderboardBadge(e, {
                        type: 'exam',
                        id: activeSittingForMode.id,
                        title: activeSittingForMode.title,
                        subtitle: `${activeSittingForMode.mode} • 1st-Attempt Leaderboard`
                      })
                    }
                    className="px-3.5 py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Trophy className="w-4 h-4 text-orange-400" />
                    <span className="hidden sm:inline">Rankings</span>
                  </button>

                  <button
                    onClick={handleInitiateAssessment}
                    className="flex-1 sm:flex-initial px-5 py-3 rounded-xl bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white font-bold text-xs uppercase tracking-wider shadow-md shadow-orange-600/25 flex items-center justify-center gap-1.5 whitespace-nowrap"
                  >
                    {activeSittingGate.needsCode && <KeyRound className="w-3.5 h-3.5" />}
                    <span>
                      {activeSittingSavedResult
                        ? activeSittingGate.needsCode
                          ? `Retake (₦${activeSittingGate.effectivePrice.toLocaleString()})`
                          : 'Retake Exam'
                        : activeSittingGate.needsCode
                        ? 'Verify Code & Start'
                        : 'Start Exam'}
                    </span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* RIGHT 4 COLUMNS: GENERAL STANDINGS + SQUARE CAROUSEL */}
            <aside className="lg:col-span-4 lg:border-l lg:border-zinc-200 dark:lg:border-zinc-800 lg:pl-8 space-y-7 min-w-0">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Trophy className="w-4 h-4 text-orange-600 flex-shrink-0" />
                    <div className="min-w-0">
                      <h2 className="font-bold text-sm truncate">General Standings</h2>
                      <span className="text-[10px] font-mono text-zinc-400 block">
                        1st Attempts Only
                      </span>
                    </div>
                  </div>

                  <div className="flex p-0.5 rounded-xl bg-zinc-200/70 dark:bg-zinc-900 text-[10px] font-bold flex-shrink-0">
                    <button
                      onClick={() => setHomeRankingTab('students')}
                      className={`px-2.5 py-1 rounded-lg ${
                        homeRankingTab === 'students'
                          ? 'bg-orange-600 text-white'
                          : 'text-zinc-500'
                      }`}
                    >
                      Top 5
                    </button>
                    <button
                      onClick={() => setHomeRankingTab('courses')}
                      className={`px-2.5 py-1 rounded-lg ${
                        homeRankingTab === 'courses'
                          ? 'bg-orange-600 text-white'
                          : 'text-zinc-500'
                      }`}
                    >
                      Courses
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
                  {homeRankingTab === 'students'
                    ? standings.slice(0, 5).map((student, idx) => (
                        <div
                          key={student.id}
                          className="py-3 flex items-center justify-between gap-2 text-xs min-w-0"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span
                              className={`w-6 h-6 rounded-lg font-mono font-bold flex items-center justify-center text-[11px] flex-shrink-0 ${
                                idx === 0
                                  ? 'bg-amber-500 text-black shadow-sm'
                                  : idx === 1
                                  ? 'bg-zinc-300 dark:bg-zinc-700 text-zinc-900 dark:text-white'
                                  : idx === 2
                                  ? 'bg-orange-800 text-amber-100'
                                  : 'bg-zinc-200 dark:bg-zinc-900 text-zinc-500'
                              }`}
                            >
                              {idx === 0 ? <Trophy className="w-3.5 h-3.5" /> : idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold block truncate">{student.name}</span>
                              <span className="text-[11px] text-zinc-500 block truncate">
                                {student.dept}
                              </span>
                            </div>
                          </div>
                          <div className="text-right font-mono flex-shrink-0">
                            <span className="font-bold text-orange-600 block">
                              {student.score}%
                            </span>
                            <span className="text-[11px] text-teal-600 dark:text-teal-400">
                              {formatSecs(student.timeSecs)}
                            </span>
                          </div>
                        </div>
                      ))
                    : deptRankings.slice(0, 5).map((d, idx) => (
                        <div
                          key={d.dept}
                          className="py-3 flex items-center justify-between gap-2 text-xs min-w-0"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span
                              className={`w-5 h-5 rounded-md font-mono font-bold flex items-center justify-center text-[11px] flex-shrink-0 ${
                                idx === 0
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-zinc-200 dark:bg-zinc-900 text-zinc-500'
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <span className="font-bold block truncate">{d.dept}</span>
                              <span className="text-[11px] text-zinc-500">
                                {d.students} ranked
                              </span>
                            </div>
                          </div>
                          <span className="font-mono font-bold text-teal-600 dark:text-teal-400 flex-shrink-0">
                            {d.avg}
                          </span>
                        </div>
                      ))}
                </div>
              </div>

              {/* 1:1 SQUARE IMAGE ANNOUNCEMENT CAROUSEL */}
              {activeAnnouncement && (
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono uppercase tracking-wider font-bold text-zinc-400">
                      Noticeboard ({(annSlide % announcements.length) + 1}/{announcements.length})
                    </span>

                    {announcements.length > 1 && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            setAnnSlide(
                              (prev) => (prev - 1 + announcements.length) % announcements.length
                            )
                          }
                          className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-orange-600"
                        >
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setAnnSlide((prev) => (prev + 1) % announcements.length)
                          }
                          className="p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-orange-600"
                        >
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div
                    onClick={() => setSelectedAnnouncementModal(activeAnnouncement)}
                    className="group cursor-pointer rounded-3xl overflow-hidden app-surface hover:border-orange-500/50"
                  >
                    <div className="w-full aspect-square bg-zinc-900 relative overflow-hidden">
                      <img
                        src={activeAnnouncement.imageUrl}
                        alt={activeAnnouncement.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="p-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-sm leading-snug group-hover:text-orange-600 truncate">
                          {activeAnnouncement.title}
                        </h3>
                        <ExternalLink className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0" />
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed line-clamp-2">
                        {activeAnnouncement.body}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </aside>
          </div>
        ) : activeTab === 'my-results' ? (
          /* ====================================================================
             "MY RESULTS" TAB — Check Held or Released Results Anytime Without a Code!
          ==================================================================== */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <h1 className="text-2xl font-extrabold">My Submitted Exam Results</h1>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Re-open any exam sitting you have completed to check released scores, rankings, and corrections—no access code required.
                </p>
              </div>
              <button
                onClick={() => handleTabChange('tests')}
                className="text-xs font-bold text-orange-600 hover:underline self-start sm:self-center"
              >
                ← Back to Assessments
              </button>
            </div>

            {myAllSavedResults.length === 0 ? (
              <div className="py-16 text-center space-y-2 app-surface rounded-3xl">
                <FileCheck2 className="w-8 h-8 text-orange-600 mx-auto" />
                <p className="font-bold text-base">No submitted exam scripts yet</p>
                <p className="text-xs text-zinc-500">
                  Once you complete an Official Mock or Speed Drill, your script will be saved here permanently.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myAllSavedResults.map((res, idx) => {
                  const liveSitting = sittings.find(
                    (s) => String(s.id) === String(res.sittingId)
                  );
                  const relPolicy =
                    liveSitting?.releaseMode ||
                    (liveSitting?.resultsReleased === false ? 'HELD' : 'INSTANT');
                  const isCurrentlyHeld =
                    res.mode !== 'PRACTICE' &&
                    (relPolicy === 'HELD' ||
                      (relPolicy === 'SCHEDULED' &&
                        liveSitting?.releaseAt &&
                        new Date(liveSitting.releaseAt).getTime() > Date.now()));

                  return (
                    <div
                      key={res.sittingId || idx}
                      className="app-surface rounded-3xl p-5 flex flex-col justify-between gap-4 border border-zinc-200 dark:border-zinc-800"
                    >
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase px-2.5 py-1 rounded bg-orange-500/10 text-orange-600">
                            {res.mode}
                          </span>
                          <span
                            className={`font-mono text-[10px] font-bold px-2.5 py-1 rounded ${
                              isCurrentlyHeld
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                                : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            }`}
                          >
                            {isCurrentlyHeld ? 'Awaiting Organiser Release' : 'Results Released ✓'}
                          </span>
                        </div>
                        <h3 className="font-extrabold text-base truncate">
                          {res.sittingTitle || res.title}
                        </h3>
                        <p className="text-xs text-zinc-500 font-mono">
                          {isCurrentlyHeld
                            ? `Submitted • Finish Time: ${formatSecs(res.timeSpentSeconds)}`
                            : `Score: ${res.percentage}% (${res.correctCount}/${res.totalQuestions}) • Time: ${formatSecs(res.timeSpentSeconds)}`}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setLastExamResult(res)}
                        className="w-full py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold flex items-center justify-center gap-2"
                      >
                        <FileCheck2 className="w-4 h-4" />
                        <span>
                          {isCurrentlyHeld ? 'Check Release Status' : 'Open Full Result & Corrections'}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'all-mocks' ? (
          /* "ALL EXAMS" DIRECTORY */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-5">
              <div>
                <h1 className="text-2xl font-extrabold">All Categorized Exams</h1>
                <p className="text-xs sm:text-sm text-zinc-500 mt-0.5">
                  Browse exams by category or course. Tap Copy for the direct exam link, or View Result if you already completed it.
                </p>
              </div>

              <button
                onClick={() => handleTabChange('tests')}
                className="text-xs font-bold text-orange-600 hover:underline self-start sm:self-center"
              >
                ← Back to Workspace
              </button>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {[
                { id: 'ALL', label: `All Exams (${liveStudentSittings.length})` },
                {
                  id: 'PRACTICE',
                  label: `Speed Drills (${
                    liveStudentSittings.filter((s) => sittingMatchesCategory(s, 'PRACTICE')).length
                  })`
                },
                {
                  id: 'OFFICIAL',
                  label: `Official Mocks (${
                    liveStudentSittings.filter((s) => sittingMatchesCategory(s, 'OFFICIAL')).length
                  })`
                },
                {
                  id: 'BUNDLED',
                  label: `Combo Marathons (${
                    liveStudentSittings.filter((s) => sittingMatchesCategory(s, 'BUNDLED')).length
                  })`
                }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setMockDirectoryCategory(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${
                    mockDirectoryCategory === tab.id
                      ? 'bg-orange-600 text-white'
                      : 'app-surface text-zinc-600 dark:text-zinc-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="app-surface rounded-2xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="relative">
                <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={mockDirectorySearch}
                  onChange={(e) => setMockDirectorySearch(e.target.value)}
                  placeholder="Search exam title or keyword..."
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                />
              </div>

              <select
                value={mockDirectoryCourse}
                onChange={(e) => setMockDirectoryCourse(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-semibold"
              >
                <option value="ALL">All Courses & Departments</option>
                <option value="All Courses">General / Open to All Courses</option>
                {NIGERIAN_COURSES_OF_STUDY.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>

              <select
                value={mockDirectorySort}
                onChange={(e) => setMockDirectorySort(e.target.value)}
                className="px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 font-semibold"
              >
                <option value="latest">Sort: Latest Created</option>
                <option value="featured">Sort: Pinned First</option>
                <option value="free">Sort: Free Entry First</option>
              </select>
            </div>

            {directoryMocks.length === 0 ? (
              <div className="app-surface rounded-3xl p-12 text-center space-y-2">
                <p className="font-bold text-base">No exams match this filter</p>
                <p className="text-xs text-zinc-500">
                  Switch the category tab above or clear your search query.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {directoryMocks.map((sit) => {
                  const attemptsCount = getUniqueFirstAttempts(
                    standings.filter((s) => s.sittingId === sit.id),
                    true
                  ).length;
                  const sitGate = getSittingGateDetails(sit);
                  const savedRes = getSavedResultForSitting(sit.id);

                  return (
                    <div
                      key={sit.id}
                      className="app-surface rounded-3xl p-6 flex flex-col justify-between gap-5 hover:border-orange-500/50 min-w-0 overflow-hidden"
                    >
                      <div className="space-y-3 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[10px] font-bold uppercase px-2.5 py-1 rounded-md bg-orange-500/10 text-orange-600 dark:text-orange-400 truncate">
                            {MODE_VISUALS[sit.mode]?.name || sit.mode}
                          </span>

                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={(e) =>
                                handleOpenLeaderboardBadge(e, {
                                  type: 'exam',
                                  id: sit.id,
                                  title: sit.title,
                                  subtitle: `${sit.targetCourse || 'All Courses'} • 1st-Attempt Standings`
                                })
                              }
                              className="px-2.5 py-1 rounded-lg bg-zinc-100 dark:bg-zinc-900 hover:bg-orange-600 hover:text-white border border-zinc-200 dark:border-zinc-800 text-[11px] font-mono font-bold flex items-center gap-1 transition-colors"
                            >
                              <Trophy className="w-3.5 h-3.5 text-orange-500" />
                              <span>{attemptsCount}</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleCopyShareableExamLink(e, sit)}
                              className="px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 text-[11px] font-mono font-bold flex items-center gap-1"
                              title="Copy Strict Exam URL"
                            >
                              {copiedExamLinkId === sit.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-500" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={(e) => handleNativeShareExam(e, sit)}
                              className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500"
                              title="Share Exam"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <span className="text-[11px] font-semibold text-teal-600 dark:text-teal-400 block truncate">
                            {sit.targetCourse || 'All Courses'}
                          </span>
                          <h3 className="font-extrabold text-base mt-0.5 truncate">{sit.title}</h3>
                        </div>

                        <p className="text-xs text-zinc-500 leading-relaxed line-clamp-2">
                          {sit.description}
                        </p>
                      </div>

                      <div className="space-y-2.5 pt-3 border-t border-zinc-200/70 dark:border-zinc-800">
                        <div className="flex items-center justify-between text-xs font-mono">
                          <span className="text-zinc-500">
                            {sit.durationMins} mins • Pass: {sit.passMark || 50}%
                          </span>
                          <span className="font-extrabold text-orange-600 dark:text-orange-400">
                            {sitGate.isPaidRetake
                              ? `₦${sitGate.effectivePrice.toLocaleString()} (Retake)`
                              : sitGate.needsCode
                              ? `₦${sitGate.effectivePrice.toLocaleString()}`
                              : Number(sit.retakePriceNaira || 0) > 0
                              ? '1ST TRY FREE'
                              : 'FREE'}
                          </span>
                        </div>

                        <div className="flex gap-2">
                          {savedRes && (
                            <button
                              type="button"
                              onClick={() => setLastExamResult(savedRes)}
                              className="flex-1 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs flex items-center justify-center gap-1.5"
                            >
                              <FileCheck2 className="w-3.5 h-3.5" />
                              <span>View Result</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleSelectSittingCard(sit, true)}
                            className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5"
                          >
                            {sitGate.needsCode && <KeyRound className="w-3.5 h-3.5" />}
                            <span>
                              {savedRes
                                ? 'Retake'
                                : sitGate.needsCode
                                ? 'Verify & Start'
                                : 'Start Exam'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : activeTab === 'leaderboard' ? (
          /* GENERAL STANDINGS TAB WITH TOP 3 PODIUM + 4TH+ TABLE */
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="text-2xl font-extrabold">General Standings</h1>
                  <span className="text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full bg-teal-500/10 text-teal-600 dark:text-teal-400 font-bold">
                    1st Attempts Only
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">
                  Official rankings log each candidate's first attempt per exam sitting.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setRankingFilter('overall');
                    setStandingsPage(0);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${
                    rankingFilter === 'overall'
                      ? 'bg-orange-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-900 text-zinc-500'
                  }`}
                >
                  All-Time Challengers
                </button>
                <button
                  onClick={() => {
                    setRankingFilter('courses');
                    setStandingsPage(0);
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold ${
                    rankingFilter === 'courses'
                      ? 'bg-orange-600 text-white'
                      : 'bg-zinc-200 dark:bg-zinc-900 text-zinc-500'
                  }`}
                >
                  Course Standings
                </button>
              </div>
            </div>

            {rankingFilter === 'courses' ? (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
                {deptRankings.map((d, idx) => (
                  <div key={d.dept} className="py-4 flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-4 min-w-0">
                      <span
                        className={`w-7 h-7 rounded-xl font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                          idx === 0
                            ? 'bg-orange-600 text-white'
                            : 'bg-zinc-200 dark:bg-zinc-900 text-zinc-500'
                        }`}
                      >
                        {idx + 1}
                      </span>
                      <div className="min-w-0">
                        <span className="font-bold block truncate">{d.dept}</span>
                        <span className="text-xs text-zinc-500">{d.students} ranked 1st attempts</span>
                      </div>
                    </div>
                    <span className="font-mono font-extrabold text-teal-600 dark:text-teal-400 flex-shrink-0">
                      Avg: {d.avg}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-6">
                {standingsPage === 0 && standings.length > 0 && (
                  <TopThreePodium
                    topThree={standings.slice(0, 3)}
                    formatSecs={formatSecs}
                    currentUserName={user?.fullName}
                  />
                )}

                <div className="flex items-center justify-between text-xs text-zinc-500 pt-2">
                  <span>Showing {standings.length} verified first attempt(s)</span>
                  <div className="flex items-center gap-1.5 font-mono">
                    <button
                      disabled={standingsPage === 0}
                      onClick={() => setStandingsPage((p) => Math.max(0, p - 1))}
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span>
                      Page {standingsPage + 1} of {totalStandingsPages}
                    </span>
                    <button
                      disabled={standingsPage >= totalStandingsPages - 1}
                      onClick={() =>
                        setStandingsPage((p) => Math.min(totalStandingsPages - 1, p + 1))
                      }
                      className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
                  {paginatedOverallStandings.map((s, idx) => {
                    const globalRank = standingsPage * STANDINGS_PER_PAGE + idx + 1;
                    const isMe =
                      user && s.name.toLowerCase() === user.fullName.toLowerCase();

                    return (
                      <div
                        key={s.id}
                        className={`py-4 px-3 flex items-center justify-between gap-3 text-sm ${
                          isMe ? 'bg-orange-500/[0.08] dark:bg-orange-500/[0.14]' : ''
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <span
                            className={`w-7 h-7 rounded-xl font-mono text-xs font-bold flex items-center justify-center flex-shrink-0 ${
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
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-bold truncate">{s.name}</span>
                              {isMe && (
                                <span className="flex-shrink-0 text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-orange-600 text-white font-bold">
                                  YOU
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-zinc-500 block truncate">
                              {s.dept} • {s.sittingTitle || s.mode}
                            </span>
                          </div>
                        </div>
                        <div className="text-right font-mono flex-shrink-0">
                          <span className="font-extrabold text-orange-600 block">
                            {s.score}%
                          </span>
                          <span className="text-xs text-teal-600 dark:text-teal-400">
                            {formatSecs(s.timeSecs)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : activeTab === 'saved' ? (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div>
                <h1 className="text-2xl font-extrabold">Saved Revision Deck</h1>
                <p className="text-xs text-zinc-500">
                  Paginated revision deck of your bookmarked questions.
                </p>
              </div>

              <div className="flex items-center gap-3">
                {bookmarks.length > 0 && (
                  <>
                    <div className="flex items-center gap-1 font-mono text-xs">
                      <button
                        disabled={savedPage === 0}
                        onClick={() => setSavedPage((p) => Math.max(0, p - 1))}
                        className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 disabled:opacity-30"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <span className="px-2">
                        {savedPage + 1}/{totalSavedPages}
                      </span>
                      <button
                        disabled={savedPage >= totalSavedPages - 1}
                        onClick={() => setSavedPage((p) => Math.min(totalSavedPages - 1, p + 1))}
                        className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 disabled:opacity-30"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    <button
                      onClick={() =>
                        launchExamRoomForSitting(
                          activeSittingForMode,
                          bookmarks,
                          'Saved Questions Drill'
                        )
                      }
                      className="px-4 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Drill Saved ({bookmarks.length})</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {bookmarks.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <Bookmark className="w-8 h-8 text-orange-600 mx-auto" />
                <p className="font-bold text-base">No saved questions yet</p>
                <p className="text-xs text-zinc-500">
                  Bookmark tough questions inside the CBT exam room or review screen.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
                {visibleBookmarks.map((q) => (
                  <div key={q.id} className="py-5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-teal-600 dark:text-teal-400">
                        {q.courseCode}
                      </span>
                      <button
                        onClick={() => handleToggleBookmark(q)}
                        className="text-xs text-red-500 font-semibold flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove</span>
                      </button>
                    </div>
                    <p className="font-bold text-sm sm:text-base">{q.question}</p>
                    <p className="text-xs font-mono text-orange-600 dark:text-orange-400">
                      Correct Answer: {q.options[q.correctIndex]}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-6 space-y-5">
              <h2 className="text-xl font-extrabold border-b border-zinc-200 dark:border-zinc-800 pb-3">
                Academic Identity
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-zinc-500 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    value={user.fullName}
                    onChange={(e) => {
                      const updated = { ...user, fullName: e.target.value };
                      setUser(updated);
                      localStorage.setItem('aia_active_user', JSON.stringify(updated));
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-sm font-medium"
                  />
                </div>

                <SearchableSelect
                  label="School / University"
                  icon={GraduationCap}
                  value={user.institution}
                  options={NIGERIAN_INSTITUTIONS}
                  onChange={async (val) => {
                    const updated = { ...user, institution: val };
                    setUser(updated);
                    localStorage.setItem('aia_active_user', JSON.stringify(updated));
                    if (isSupabaseConfigured && supabase && !user.id.startsWith('usr_')) {
                      await supabase.from('profiles').update({ institution: val }).eq('id', user.id);
                    }
                  }}
                />

                <SearchableSelect
                  label="Course of Study / Department"
                  icon={Building2}
                  value={user.department}
                  options={NIGERIAN_COURSES_OF_STUDY}
                  onChange={async (val) => {
                    const updated = { ...user, department: val };
                    setUser(updated);
                    localStorage.setItem('aia_active_user', JSON.stringify(updated));
                    if (isSupabaseConfigured && supabase && !user.id.startsWith('usr_')) {
                      await supabase.from('profiles').update({ department: val }).eq('id', user.id);
                    }
                  }}
                />
              </div>
            </div>

            <div className="lg:col-span-6 space-y-5">
              <h2 className="text-xl font-extrabold border-b border-zinc-200 dark:border-zinc-800 pb-3">
                Earned Milestones
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 text-white shadow-md">
                  <Zap className="w-5 h-5 text-orange-100 mb-2" />
                  <h4 className="font-bold text-xs">Speed Demon</h4>
                  <p className="text-[11px] text-orange-100/90 mt-0.5">Sub-2m drill finish</p>
                </div>
                <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-md">
                  <CheckCircle2 className="w-5 h-5 text-teal-200 mb-2" />
                  <h4 className="font-bold text-xs">Sharpshooter</h4>
                  <p className="text-[11px] text-teal-100/90 mt-0.5">90%+ accuracy</p>
                </div>
                <div className="relative overflow-hidden p-4 rounded-2xl bg-gradient-to-br from-zinc-800 to-zinc-950 text-white border border-zinc-700 shadow-md">
                  <Flame className="w-5 h-5 text-orange-500 mb-2" />
                  <h4 className="font-bold text-xs">3-Day Streak</h4>
                  <p className="text-[11px] text-zinc-400 mt-0.5">Consistent practice</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* PER-EXAM / PER-CATEGORY LEADERBOARD MODAL */}
      {leaderboardModalConfig && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="app-surface rounded-3xl max-w-xl w-full p-6 space-y-4 max-h-[88vh] flex flex-col overflow-hidden">
            <div className="flex items-start justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-orange-600/15 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <Trophy className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-teal-600 dark:text-teal-400 font-bold block truncate">
                    {leaderboardModalConfig.subtitle} • 1st Attempts Only
                  </span>
                  <h3 className="font-extrabold text-base sm:text-lg truncate">
                    {leaderboardModalConfig.title}
                  </h3>
                </div>
              </div>
              <button
                onClick={() => setLeaderboardModalConfig(null)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalLeaderboardRows.length > 0 && (
              <TopThreePodium
                topThree={modalLeaderboardRows.slice(0, 3)}
                formatSecs={formatSecs}
                currentUserName={user?.fullName}
              />
            )}

            <div className="flex-1 overflow-y-auto divide-y divide-zinc-200 dark:divide-zinc-800 border-y border-zinc-200 dark:border-zinc-800">
              {modalLeaderboardRows.length === 0 ? (
                <div className="py-12 text-center space-y-1">
                  <p className="font-bold text-sm">No attempts recorded yet</p>
                  <p className="text-xs text-zinc-500">
                    Be the first student to set the #1 record on this exam!
                  </p>
                </div>
              ) : (
                modalLeaderboardRows.slice(3).map((row, i) => {
                  const rankNum = i + 4;
                  const isMe = row.name.toLowerCase() === user.fullName.toLowerCase();
                  return (
                    <div
                      key={row.id}
                      className={`py-3 px-2 flex items-center justify-between gap-2 text-xs ${
                        isMe ? 'bg-orange-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <span className="w-6 h-6 rounded-lg font-mono font-bold flex items-center justify-center bg-zinc-200 dark:bg-zinc-900 text-zinc-500 flex-shrink-0">
                          {rankNum}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-bold truncate">{row.name}</span>
                            {isMe && (
                              <span className="flex-shrink-0 text-[9px] font-mono px-1.5 py-0.5 rounded bg-orange-600 text-white font-bold">
                                YOU
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-zinc-500 block truncate">{row.dept}</span>
                        </div>
                      </div>

                      <div className="text-right font-mono flex-shrink-0">
                        <span className="font-extrabold text-orange-600 block">{row.score}%</span>
                        <span className="text-[11px] text-teal-600 dark:text-teal-400">
                          {formatSecs(row.timeSecs)}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => setLeaderboardModalConfig(null)}
                className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold"
              >
                Close
              </button>
              {leaderboardModalConfig.type === 'exam' && (
                <button
                  type="button"
                  onClick={() => {
                    const targetSit = sittings.find((s) => s.id === leaderboardModalConfig.id);
                    setLeaderboardModalConfig(null);
                    if (targetSit) handleSelectSittingCard(targetSit, true);
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white text-xs font-bold"
                >
                  Attempt This Exam Now
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ACCESS CODE & WHATSAPP PAYMENT GATE MODAL */}
      {showCodeGateModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="app-surface rounded-3xl max-w-md w-full p-6 sm:p-7 space-y-5 overflow-hidden">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-orange-600/15 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-teal-600 dark:text-teal-400 font-bold block truncate">
                    {activeSittingGate.isPaidRetake
                      ? `Retake Access Gate (Attempt #${activeSittingGate.attemptsMade + 1})`
                      : `${activeSittingForMode.mode} • Universal Code Gate`}
                  </span>
                  <h3 className="font-extrabold text-base truncate">{activeSittingForMode.title}</h3>
                </div>
              </div>
              <button
                onClick={() => setShowCodeGateModal(false)}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-900 dark:hover:text-white flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* If candidate already completed this exam and just wants to check their result, let them open it free! */}
            {activeSittingSavedResult && (
              <div className="p-3.5 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-bold text-teal-700 dark:text-teal-300 block">
                    Already wrote this sitting?
                  </span>
                  <span className="text-[11px] text-zinc-500">
                    Open your submitted result without a code.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowCodeGateModal(false);
                    setLastExamResult(activeSittingSavedResult);
                  }}
                  className="px-3 py-2 rounded-xl bg-teal-600 text-white font-bold whitespace-nowrap flex-shrink-0"
                >
                  View Result
                </button>
              </div>
            )}

            {activeSittingGate.isPaidRetake && (
              <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300 space-y-1">
                <span className="font-bold block">Free 1st Attempt Completed</span>
                <p className="text-[11px] leading-relaxed">
                  Your first attempt on this exam was free and has been logged on the leaderboard. Additional retake attempts require a 1-use access code (₦{activeSittingGate.effectivePrice.toLocaleString()}).
                </p>
              </div>
            )}

            <div className="p-4 rounded-2xl bg-zinc-100/80 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-zinc-500 block">
                  {activeSittingGate.isPaidRetake ? '2nd Attempt / Retake Fee' : 'Sitting Entry Fee'}
                </span>
                <span className="font-mono text-2xl font-extrabold text-orange-600 dark:text-orange-400">
                  ₦{activeSittingGate.effectivePrice.toLocaleString()}
                </span>
              </div>
              <div className="text-right font-mono text-xs">
                <span className="text-zinc-500 block">Duration</span>
                <span className="font-bold">{activeSittingForMode.durationMins} Mins</span>
              </div>
            </div>

            {codeGateError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-500 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{codeGateError}</span>
              </div>
            )}

            <form onSubmit={handleVerifyAccessCode} className="space-y-3">
              <div>
                <label className="block text-xs font-bold mb-1.5">
                  Enter Your 1-Time Access Code
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AIA-2026-VIP"
                  value={enteredCode}
                  onChange={(e) => setEnteredCode(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 font-mono text-sm uppercase tracking-wider focus:outline-none focus:border-orange-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-xs uppercase tracking-wider"
              >
                Verify Code & Launch Exam
              </button>
            </form>

            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
              <span className="flex-shrink mx-3 text-[11px] text-zinc-400 uppercase font-mono">
                Need a code?
              </span>
              <div className="flex-grow border-t border-zinc-200 dark:border-zinc-800" />
            </div>

            <a
              href={getWhatsAppPaymentUrl()}
              target="_blank"
              rel="noreferrer"
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20"
            >
              <MessageCircle className="w-4 h-4 flex-shrink-0" />
              <span className="truncate">
                Pay ₦{activeSittingGate.effectivePrice.toLocaleString()} & Get Code on WhatsApp
              </span>
            </a>
          </div>
        </div>
      )}

      {selectedAnnouncementModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="app-surface rounded-3xl max-w-md w-full overflow-hidden">
            <div className="w-full aspect-square bg-zinc-900 relative">
              <img
                src={selectedAnnouncementModal.imageUrl}
                alt={selectedAnnouncementModal.title}
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => setSelectedAnnouncementModal(null)}
                className="absolute top-3 right-3 p-2 rounded-full bg-black/70 text-white hover:bg-black"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <h3 className="font-extrabold text-lg">{selectedAnnouncementModal.title}</h3>
              <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {selectedAnnouncementModal.body}
              </p>
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setSelectedAnnouncementModal(null)}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-bold"
                >
                  Close
                </button>
                {selectedAnnouncementModal.ctaUrl && (
                  <a
                    href={selectedAnnouncementModal.ctaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 py-2.5 rounded-xl bg-orange-600 text-white text-xs font-bold flex items-center justify-center gap-1.5"
                  >
                    <span>{selectedAnnouncementModal.ctaLabel || 'Open Link'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="md:hidden fixed bottom-3 inset-x-4 z-50 glass-dock rounded-2xl px-2 py-1.5 flex items-center justify-around">
        {[
          { id: 'tests', label: 'Home', icon: Clock },
          { id: 'all-mocks', label: 'Exams', icon: LayoutGrid },
          { id: 'my-results', label: 'Results', icon: FileCheck2 },
          { id: 'leaderboard', label: 'Standings', icon: Trophy },
          { id: 'profile', label: 'Profile', icon: User }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={`flex flex-col items-center justify-center py-1 px-2 rounded-xl ${
                isActive ? 'text-orange-600 dark:text-orange-400 font-bold' : 'text-zinc-400'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] mt-0.5">{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}