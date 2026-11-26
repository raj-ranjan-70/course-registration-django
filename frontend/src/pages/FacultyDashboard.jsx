import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getElectives,
  getElectiveDrafts,
  getElectiveById,
  saveElectiveStep1,
  saveElectiveStep2,
  saveElectiveStep3,
  createElectiveGroup,
  publishElectiveGroup,
  deleteElectiveGroup,
  getAllocationRuns,
} from '../api/coursesApi';
import {
  GraduationCap,
  PlusCircle,
  Play,
  Trash2,
  Calendar,
  Users,
  Award,
  Layers,
  Sparkles,
  LogOut,
  Clock,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Search,
  Filter,
  Check,
  ChevronRight,
  ChevronLeft,
  Sliders,
  X,
  FileText,
  Save,
  RotateCcw,
  FileEdit,
  ArrowRight,
  ArrowLeft,
  CheckSquare,
} from 'lucide-react';

const DRAFT_STORAGE_KEY = 'faculty_active_elective_draft_id';

// Helper to format ISO date to date input format (YYYY-MM-DD)
function formatToDateInput(dateString) {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const pad = (num) => String(num).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  } catch {
    return '';
  }
}

export default function FacultyDashboard() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('electives'); // 'electives' | 'drafts' | 'create' | 'roster'
  const [electives, setElectives] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocationRuns, setAllocationRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [publishingId, setPublishingId] = useState(null);

  // Toast feedback state: vanishes automatically after 2000ms
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }
  // Field-level error highlighting state
  const [fieldErrors, setFieldErrors] = useState({});

  // Multi-step Wizard State
  const [wizardStep, setWizardStep] = useState(1); // 1: Details & Schedule | 2: Courses | 3: Whole Criteria
  const [draftId, setDraftId] = useState(null);
  const [lastSavedTime, setLastSavedTime] = useState(null);
  const [savingStep, setSavingStep] = useState(false);

  // Elective Form State
  const [electiveForm, setElectiveForm] = useState({
    title: '',
    description: '',
    department: 'Computer Science',
    term: 'Fall 2026',
    submissionDeadline: '', // REQUIRED on Step 1
    // Whole-elective optional criteria (Step 3):
    minCgpa: '',
    allowedSemesters: [],
    targetDegrees: [],
    targetBranches: [],
    maxPreferences: 5,
    allowPreferenceEditing: true,
    // List of courses (Step 2 - at least 2 courses):
    courses: [
      { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
      { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
    ],
  });

  // Criteria options
  const availableDegrees = ['B.Tech', 'M.Tech', 'Dual Degree', 'B.Sc'];
  const availableBranches = [
    'Computer Science',
    'Electrical Engineering',
    'Mechanical Engineering',
    'Data Science',
    'Civil Engineering',
  ];
  const availableSemesters = [3, 4, 5, 6, 7, 8];

  // Auto-vanish toast feedback after 2 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [electivesData, draftsData, runsData] = await Promise.all([
        getElectives({ is_draft: 'false' }).catch(() => []),
        getElectiveDrafts().catch(() => []),
        getAllocationRuns().catch(() => []),
      ]);
      setElectives(electivesData);
      setDrafts(draftsData);
      setAllocationRuns(runsData);
      if (runsData.length > 0 && !selectedRun) {
        setSelectedRun(runsData[0]);
      }
    } catch (err) {
      console.error('Failed to load faculty portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Check for saved draft ID on mount
  useEffect(() => {
    const savedDraftId = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (savedDraftId && !draftId) {
      handleResumeDraft(Number(savedDraftId), false);
    }
  }, []);

  // Helper to clear specific field error when user edits
  const clearFieldError = (key) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  // Course list handlers in Step 2: PREPENDS AT TOP (Bottom to Top order)
  const handleAddCourseRow = () => {
    setElectiveForm((prev) => ({
      ...prev,
      courses: [
        { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
        ...prev.courses,
      ],
    }));
    // Reset course index field errors since items shifted
    setFieldErrors((prev) => {
      const next = {};
      Object.keys(prev).forEach((k) => {
        if (!k.startsWith('course_')) {
          next[k] = prev[k];
        }
      });
      return next;
    });
    setFeedback({ type: 'success', message: 'New course added at the top of the pool.' });
  };

  const handleRemoveCourseRow = (index) => {
    if (electiveForm.courses.length <= 2) {
      setFeedback({
        type: 'error',
        message: 'Step 2 requires at least 2 courses for students to rank preferences.',
      });
      return;
    }
    setElectiveForm((prev) => ({
      ...prev,
      courses: prev.courses.filter((_, i) => i !== index),
    }));
    setFieldErrors({});
  };

  const handleCourseFieldChange = (index, field, value) => {
    clearFieldError(`course_${index}_${field}`);
    setElectiveForm((prev) => {
      const updated = [...prev.courses];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, courses: updated };
    });
  };

  // Whole criteria toggle handlers
  const handleToggleDegree = (deg) => {
    setElectiveForm((prev) => {
      const exists = prev.targetDegrees.includes(deg);
      return {
        ...prev,
        targetDegrees: exists
          ? prev.targetDegrees.filter((d) => d !== deg)
          : [...prev.targetDegrees, deg],
      };
    });
  };

  const handleToggleBranch = (br) => {
    setElectiveForm((prev) => {
      const exists = prev.targetBranches.includes(br);
      return {
        ...prev,
        targetBranches: exists
          ? prev.targetBranches.filter((b) => b !== br)
          : [...prev.targetBranches, br],
      };
    });
  };

  const handleToggleSemester = (sem) => {
    setElectiveForm((prev) => {
      const exists = prev.allowedSemesters.includes(sem);
      return {
        ...prev,
        allowedSemesters: exists
          ? prev.allowedSemesters.filter((s) => s !== sem)
          : [...prev.allowedSemesters, sem],
      };
    });
  };

  // Reset wizard form state
  const handleResetWizard = () => {
    setDraftId(null);
    setWizardStep(1);
    setLastSavedTime(null);
    setFieldErrors({});
    localStorage.removeItem(DRAFT_STORAGE_KEY);
    setElectiveForm({
      title: '',
      description: '',
      department: 'Computer Science',
      term: 'Fall 2026',
      submissionDeadline: '',
      minCgpa: '',
      allowedSemesters: [],
      targetDegrees: [],
      targetBranches: [],
      maxPreferences: 5,
      allowPreferenceEditing: true,
      courses: [
        { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
        { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
      ],
    });
  };

  // Resume / Restore a draft from backend
  const handleResumeDraft = async (idToResume, navigateToCreate = true) => {
    try {
      const draft = await getElectiveById(idToResume);
      if (!draft) return;

      const restoredCourses =
        draft.courses && draft.courses.length >= 2
          ? draft.courses.map((c) => ({
              code: c.code || '',
              title: c.title || '',
              credits: c.credits || 3,
              capacity: c.capacity || 30,
              minCgpa: c.min_cgpa !== null && c.min_cgpa !== undefined ? String(c.min_cgpa) : '',
            }))
          : draft.courses && draft.courses.length === 1
          ? [
              {
                code: draft.courses[0].code || '',
                title: draft.courses[0].title || '',
                credits: draft.courses[0].credits || 3,
                capacity: draft.courses[0].capacity || 30,
                minCgpa: draft.courses[0].min_cgpa !== null ? String(draft.courses[0].min_cgpa) : '',
              },
              { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
            ]
          : [
              { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
              { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
            ];

      setElectiveForm({
        title: draft.title || '',
        description: draft.description || '',
        department: draft.department || 'Computer Science',
        term: draft.term || 'Fall 2026',
        submissionDeadline: formatToDateInput(draft.submission_deadline),
        minCgpa: draft.min_cgpa !== null && draft.min_cgpa !== undefined ? String(draft.min_cgpa) : '',
        allowedSemesters: draft.allowed_semesters || [],
        targetDegrees: draft.target_degrees || [],
        targetBranches: draft.target_branches || [],
        maxPreferences: draft.max_preferences || 5,
        allowPreferenceEditing: draft.allow_preference_editing !== false,
        courses: restoredCourses,
      });

      setDraftId(draft.id);
      setFieldErrors({});
      localStorage.setItem(DRAFT_STORAGE_KEY, String(draft.id));
      setLastSavedTime(new Date(draft.updated_at).toLocaleTimeString());
      setWizardStep(draft.current_step || 1);

      if (navigateToCreate) {
        setActiveTab('create');
        setFeedback({
          type: 'success',
          message: `Draft "${draft.title || 'Untitled'}" restored at Step ${draft.current_step || 1}.`,
        });
      }
    } catch (err) {
      console.error('Failed to resume draft:', err);
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    }
  };

  // STEP 1: Save Step 1 (Title, Description, Deadline, Term)
  const handleSaveStep1 = async (advanceToStep2 = true) => {
    setFeedback(null);
    const newErrors = {};

    if (!electiveForm.title.trim()) {
      newErrors.title = true;
    }
    if (!electiveForm.submissionDeadline) {
      newErrors.submissionDeadline = true;
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setFeedback({
        type: 'error',
        message: 'Please fill in the required fields (highlighted in red).',
      });
      return false;
    }

    setSavingStep(true);
    try {
      // Convert selected date (YYYY-MM-DD) to 23:59:59 (12 midnight deadline)
      let deadlineIso = '';
      if (electiveForm.submissionDeadline) {
        const datePart = electiveForm.submissionDeadline.split('T')[0];
        const endOfDay = new Date(`${datePart}T23:59:59`);
        deadlineIso = endOfDay.toISOString();
      }

      const payload = {
        draft_id: draftId,
        title: electiveForm.title.trim(),
        description: electiveForm.description.trim(),
        submission_deadline: deadlineIso,
        term: electiveForm.term.trim() || 'Fall 2026',
        department: electiveForm.department || 'Computer Science',
        allow_preference_editing: electiveForm.allowPreferenceEditing,
      };

      const result = await saveElectiveStep1(payload);
      setDraftId(result.id);
      setFieldErrors({});
      localStorage.setItem(DRAFT_STORAGE_KEY, String(result.id));
      setLastSavedTime(new Date().toLocaleTimeString());
      await loadData();

      if (advanceToStep2) {
        setWizardStep(2);
        setFeedback({
          type: 'success',
          message: 'Step 1 saved! Add at least 2 courses in Step 2.',
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Draft "${result.title}" saved at Step 1.`,
        });
      }
      return true;
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save Step 1.' });
      return false;
    } finally {
      setSavingStep(false);
    }
  };

  // STEP 2: Save Step 2 (Dynamic courses list - at least 2 courses)
  const handleSaveStep2 = async (advanceToStep3 = true) => {
    setFeedback(null);
    const newErrors = {};

    if (electiveForm.courses.length < 2) {
      setFeedback({
        type: 'error',
        message: 'Step 2 requires at least 2 courses for students to rank preferences.',
      });
      return false;
    }

    for (let i = 0; i < electiveForm.courses.length; i++) {
      const c = electiveForm.courses[i];
      if (!c.code.trim()) {
        newErrors[`course_${i}_code`] = true;
      }
      if (!c.title.trim()) {
        newErrors[`course_${i}_title`] = true;
      }
      if (!c.capacity || Number(c.capacity) <= 0) {
        newErrors[`course_${i}_capacity`] = true;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors);
      setFeedback({
        type: 'error',
        message: 'Please complete all highlighted course fields (Code, Name, Capacity > 0).',
      });
      return false;
    }

    if (!draftId) {
      const s1Ok = await handleSaveStep1(false);
      if (!s1Ok) return false;
    }

    setSavingStep(true);
    try {
      const payload = {
        courses: electiveForm.courses.map((c) => ({
          code: c.code.trim().toUpperCase(),
          title: c.title.trim(),
          credits: Number(c.credits) || 3,
          capacity: Number(c.capacity) || 30,
          min_cgpa: c.minCgpa !== '' ? parseFloat(c.minCgpa) : null,
        })),
      };

      const result = await saveElectiveStep2(draftId, payload);
      setFieldErrors({});
      setLastSavedTime(new Date().toLocaleTimeString());
      await loadData();

      if (advanceToStep3) {
        setWizardStep(3);
        setFeedback({
          type: 'success',
          message: `Step 2 saved with ${result.courses?.length || 0} courses! Configure whole-elective criteria.`,
        });
      } else {
        setFeedback({
          type: 'success',
          message: `Draft courses saved (${result.courses?.length || 0} courses).`,
        });
      }
      return true;
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save Step 2.' });
      return false;
    } finally {
      setSavingStep(false);
    }
  };

  // STEP 3: Save Step 3 (Whole-elective criteria) or Finalize & Launch
  const handleSaveStep3 = async (finalize = false) => {
    setFeedback(null);

    if (!draftId) {
      setFeedback({ type: 'error', message: 'No active draft found to save criteria for.' });
      return false;
    }

    setSavingStep(true);
    try {
      const payload = {
        min_cgpa: electiveForm.minCgpa !== '' ? parseFloat(electiveForm.minCgpa) : null,
        allowed_semesters: electiveForm.allowedSemesters,
        target_degrees: electiveForm.targetDegrees,
        target_branches: electiveForm.targetBranches,
        max_preferences: Number(electiveForm.maxPreferences) || 5,
        allow_preference_editing: electiveForm.allowPreferenceEditing,
        finalize,
      };

      const result = await saveElectiveStep3(draftId, payload);
      setFieldErrors({});
      setLastSavedTime(new Date().toLocaleTimeString());

      if (finalize) {
        handleResetWizard();
        await loadData();
        setActiveTab('electives');
        setFeedback({
          type: 'success',
          message: `Elective "${result.title}" with ${result.courses?.length || 0} courses launched successfully!`,
        });
      } else {
        await loadData();
        setFeedback({
          type: 'success',
          message: `Draft criteria saved. Elective remains in Drafts until launched.`,
        });
      }
      return true;
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to save Step 3.' });
      return false;
    } finally {
      setSavingStep(false);
    }
  };

  // Publish Results (Gale-Shapley auto-run)
  const handlePublishResults = async (electiveId) => {
    setPublishingId(electiveId);
    setFeedback(null);
    try {
      const response = await publishElectiveGroup(electiveId);
      setFeedback({
        type: 'success',
        message: `Matching algorithm executed and results published for "${response.elective?.title}"!`,
      });
      if (response.allocation_run) {
        setSelectedRun(response.allocation_run);
      }
      await loadData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to execute matching algorithm. Verify preferences have been submitted.',
      });
    } finally {
      setPublishingId(null);
    }
  };

  // Delete an elective or draft
  const handleDeleteElective = async (id, title, isDraftItem = false) => {
    const itemType = isDraftItem ? 'draft' : 'elective';
    if (!window.confirm(`Are you sure you want to delete ${itemType} "${title || 'Untitled'}"?`)) {
      return;
    }

    try {
      await deleteElectiveGroup(id);
      if (draftId === id) {
        handleResetWizard();
      }
      setFeedback({ type: 'success', message: `${isDraftItem ? 'Draft' : 'Elective'} "${title || 'Untitled'}" deleted.` });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || `Failed to delete ${itemType}.` });
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#192A24] flex flex-col font-sans selection:bg-[#1B4D3E] selection:text-white relative">
      {/* FLOATING TOAST NOTIFICATION: Automatically vanishes after 2 seconds */}
      {feedback && (
        <div className="fixed top-5 right-5 z-50 max-w-md w-full sm:w-auto animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`p-4 rounded-xl shadow-xl border flex items-start gap-3 backdrop-blur-md ${
              feedback.type === 'success'
                ? 'bg-emerald-50/95 border-emerald-300 text-emerald-950'
                : 'bg-red-50/95 border-red-300 text-red-950'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <span className="font-bold text-xs uppercase tracking-wider block">
                {feedback.type === 'success' ? 'Success' : 'Notice / Error'}
              </span>
              <p className="text-xs mt-0.5 font-medium leading-relaxed">{feedback.message}</p>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-stone-400 hover:text-stone-700 text-base cursor-pointer p-0.5 leading-none"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-[#E5E0D8] bg-[#F9F8F6]/95 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1B4D3E] text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-[#192A24]">
                  Faculty Portal
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                  FACULTY
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Elective Creation, Step-by-Step Drafts &amp; Automated Allocation
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-[#192A24]">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}` : user?.username}
              </span>
              <span className="text-[11px] font-mono text-stone-500">{user?.email}</span>
            </div>

            <button
              onClick={logout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-[#E0DCD3] bg-white text-stone-700 hover:text-red-700 hover:border-red-200 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Sign out of Faculty Portal"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex gap-2 border-t border-[#EFECE6] overflow-x-auto">
          <button
            onClick={() => setActiveTab('electives')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'electives'
                ? 'border-[#1B4D3E] text-[#1B4D3E]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Layers className="w-4 h-4" />
            Published Electives ({electives.length})
          </button>

          <button
            onClick={() => setActiveTab('drafts')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'drafts'
                ? 'border-[#1B4D3E] text-[#1B4D3E]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileEdit className="w-4 h-4" />
            Drafts ({drafts.length})
            {drafts.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold border border-amber-200">
                {drafts.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('create')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'border-[#1B4D3E] text-[#1B4D3E]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            {draftId ? 'Resume Elective Wizard' : 'Create Elective'}
          </button>

          <button
            onClick={() => setActiveTab('roster')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'roster'
                ? 'border-[#1B4D3E] text-[#1B4D3E]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileText className="w-4 h-4" />
            Allocation Results &amp; Rosters
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {/* Restore Prompt Banner on other tabs */}
        {draftId && activeTab !== 'create' && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>
                You have an unfinished elective draft in progress:{' '}
                <strong>{electiveForm.title || `Draft #${draftId}`}</strong> (saved at Step {wizardStep} of 3).
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('create')}
                className="px-3 py-1.5 rounded-lg bg-[#1B4D3E] text-white font-semibold hover:bg-[#2E6F5A] transition-all cursor-pointer"
              >
                Resume Editing
              </button>
              <button
                onClick={handleResetWizard}
                className="px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-amber-800 font-semibold hover:bg-amber-100 transition-all cursor-pointer"
              >
                Discard &amp; Start Fresh
              </button>
            </div>
          </div>
        )}

        {/* TAB 1: PUBLISHED ELECTIVES */}
        {activeTab === 'electives' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                  Published Elective Offerings
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Active elective groups open for student preference submissions.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  onClick={loadData}
                  className="p-2 rounded-lg border border-[#E0DCD3] bg-white text-stone-700 hover:bg-[#F3F1EC] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Refresh</span>
                </button>
                <button
                  onClick={() => {
                    handleResetWizard();
                    setActiveTab('create');
                  }}
                  className="px-3.5 py-2 rounded-lg bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  Create New Elective
                </button>
              </div>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <div className="inline-block w-8 h-8 border-3 border-[#1B4D3E] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-stone-500">Loading electives...</p>
              </div>
            ) : electives.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-12 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] text-[#1B4D3E] flex items-center justify-center mx-auto mb-4 border border-[#C8E6C9]">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-[#192A24]">
                  No Published Electives Yet
                </h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto mt-1.5 leading-relaxed">
                  Create an elective step-by-step using the new wizard. Save drafts along the way and launch whenever you are ready.
                </p>
                <button
                  onClick={() => {
                    handleResetWizard();
                    setActiveTab('create');
                  }}
                  className="mt-5 px-4 py-2 rounded-xl bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#2E6F5A] transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Start Step-by-Step Wizard
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {electives.map((el) => {
                  const deadlineDate = el.submission_deadline ? new Date(el.submission_deadline) : null;
                  const isExpired = deadlineDate ? new Date() > deadlineDate : false;

                  return (
                    <div
                      key={el.id}
                      className="bg-white rounded-2xl border border-[#E5E0D8] p-6 shadow-xs hover:border-[#1B4D3E]/40 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-[#192A24]">
                              {el.title}
                            </span>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-[#FAF9F7] text-stone-600 border border-[#E5E0D8]">
                              {el.term}
                            </span>
                            {el.is_published ? (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                Results Published
                              </span>
                            ) : isExpired ? (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
                                Deadline Passed
                              </span>
                            ) : (
                              <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                                Accepting Preferences
                              </span>
                            )}
                          </div>
                          {el.description && (
                            <p className="text-xs text-stone-600 mt-1 max-w-3xl leading-relaxed">
                              {el.description}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-start">
                          <button
                            onClick={() => handleDeleteElective(el.id, el.title, false)}
                            className="p-1.5 rounded-lg text-stone-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            title="Delete Elective"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Elective Summary Info */}
                      <div className="mt-4 pt-4 border-t border-[#EFECE6] space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                          <div className="p-2.5 rounded-xl bg-[#FAF9F7] border border-[#E5E0D8]">
                            <span className="text-[10px] text-stone-500 uppercase font-semibold">
                              Submission Deadline
                            </span>
                            <div className="font-bold text-stone-800 mt-0.5 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-stone-400" />
                              {deadlineDate ? deadlineDate.toLocaleString() : 'Not Set'}
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#FAF9F7] border border-[#E5E0D8]">
                            <span className="text-[10px] text-stone-500 uppercase font-semibold">
                              Course Choices
                            </span>
                            <div className="font-bold text-stone-800 mt-0.5 flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5 text-stone-400" />
                              {el.total_courses || el.courses?.length || 0} Courses
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#FAF9F7] border border-[#E5E0D8]">
                            <span className="text-[10px] text-stone-500 uppercase font-semibold">
                              Total Seat Capacity
                            </span>
                            <div className="font-bold text-[#1B4D3E] mt-0.5 flex items-center gap-1.5">
                              <Users className="w-3.5 h-3.5 text-stone-400" />
                              {el.total_seats || 0} Seats
                            </div>
                          </div>

                          <div className="p-2.5 rounded-xl bg-[#FAF9F7] border border-[#E5E0D8]">
                            <span className="text-[10px] text-stone-500 uppercase font-semibold">
                              Max Preferences
                            </span>
                            <div className="font-bold text-stone-800 mt-0.5">
                              Up to {el.max_preferences || 5} choices
                            </div>
                          </div>
                        </div>

                        {/* Whole Elective Criteria Summary */}
                        <div className="p-3 rounded-xl bg-stone-50/70 border border-[#E5E0D8] text-xs text-stone-600 flex flex-wrap items-center gap-x-4 gap-y-1">
                          <span className="font-semibold text-stone-700">Whole-Elective Criteria:</span>
                          {el.min_cgpa && (
                            <span>
                              Min CGPA: <strong className="text-emerald-800">≥ {el.min_cgpa}</strong>
                            </span>
                          )}
                          {el.allowed_semesters && el.allowed_semesters.length > 0 && (
                            <span>
                              Semesters:{' '}
                              <strong className="text-stone-800">
                                {el.allowed_semesters.join(', ')}
                              </strong>
                            </span>
                          )}
                          {el.target_degrees && el.target_degrees.length > 0 && (
                            <span>
                              Degrees:{' '}
                              <strong className="text-stone-800">
                                {el.target_degrees.join(', ')}
                              </strong>
                            </span>
                          )}
                          {el.target_branches && el.target_branches.length > 0 && (
                            <span>
                              Branches:{' '}
                              <strong className="text-stone-800">
                                {el.target_branches.join(', ')}
                              </strong>
                            </span>
                          )}
                          {!el.min_cgpa &&
                            (!el.allowed_semesters || el.allowed_semesters.length === 0) &&
                            (!el.target_degrees || el.target_degrees.length === 0) &&
                            (!el.target_branches || el.target_branches.length === 0) && (
                              <span className="text-stone-400 italic">None (Open to all students)</span>
                            )}
                        </div>

                        {/* Included Courses Grid */}
                        <div className="mt-4">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-stone-700 mb-2">
                            Included Courses ({el.courses?.length || 0})
                          </h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                            {el.courses?.map((course) => (
                              <div
                                key={course.id}
                                className="p-3 rounded-xl bg-[#FAF9F7] border border-[#E5E0D8] text-xs"
                              >
                                <div className="flex items-center justify-between mb-1">
                                  <span className="font-mono font-bold text-stone-800">
                                    {course.code}
                                  </span>
                                  <span className="text-stone-500 font-medium">
                                    {course.credits} Credits
                                  </span>
                                </div>
                                <div className="font-semibold text-[#192A24] truncate">
                                  {course.title}
                                </div>
                                <div className="mt-2 pt-2 border-t border-[#EFECE6] flex items-center justify-between text-[11px] text-stone-600">
                                  <span>
                                    Seats: <strong className="text-[#192A24]">{course.capacity}</strong>
                                  </span>
                                  <span>
                                    Course CGPA:{' '}
                                    <strong className="text-emerald-800">
                                      {course.min_cgpa ? `≥ ${course.min_cgpa}` : 'None'}
                                    </strong>
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Bottom Action Footer */}
                      <div className="mt-5 pt-4 border-t border-[#EFECE6] flex items-center justify-between flex-wrap gap-3">
                        <div className="text-xs text-stone-500">
                          {el.is_published ? (
                            <span>
                              Results published on{' '}
                              <strong>{new Date(el.results_published_at || el.updated_at).toLocaleString()}</strong>
                            </span>
                          ) : (
                            <span className="text-stone-500">
                              Matching algorithm runs automatically before results are published.
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handlePublishResults(el.id)}
                            disabled={publishingId === el.id}
                            className={`px-4 py-2 rounded-xl text-xs font-semibold shadow-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                              el.is_published
                                ? 'bg-stone-100 hover:bg-stone-200 text-stone-700 border border-stone-300'
                                : 'bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white'
                            }`}
                          >
                            {publishingId === el.id ? (
                              <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5 fill-current" />
                                {el.is_published ? 'Re-run & Update Results' : 'Publish Allocation Results'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: UNFINISHED DRAFTS */}
        {activeTab === 'drafts' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                  Unfinished Elective Drafts
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Drafts automatically preserved at their last saved step. Resume anytime to complete and launch.
                </p>
              </div>
              <button
                onClick={() => {
                  handleResetWizard();
                  setActiveTab('create');
                }}
                className="px-3.5 py-2 rounded-lg bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer self-start sm:self-auto"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                Start New Elective
              </button>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <div className="inline-block w-8 h-8 border-3 border-[#1B4D3E] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-stone-500">Loading drafts...</p>
              </div>
            ) : drafts.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-12 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mx-auto mb-4 border border-amber-200">
                  <FileEdit className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-[#192A24]">
                  No Unfinished Drafts
                </h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto mt-1.5 leading-relaxed">
                  Every elective you started has been finalized and launched. When you start an elective and save any step, it will appear here.
                </p>
                <button
                  onClick={() => {
                    handleResetWizard();
                    setActiveTab('create');
                  }}
                  className="mt-5 px-4 py-2 rounded-xl bg-[#1B4D3E] text-white text-xs font-semibold hover:bg-[#2E6F5A] transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create an Elective
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {drafts.map((draft) => {
                  const stepLabel =
                    draft.current_step === 1
                      ? 'Step 1 of 3: Details Saved'
                      : draft.current_step === 2
                      ? `Step 2 of 3: Courses Added (${draft.total_courses || draft.courses?.length || 0} courses)`
                      : 'Step 3 of 3: Criteria Pending Finalization';

                  const badgeColor =
                    draft.current_step === 1
                      ? 'bg-amber-100 text-amber-800 border-amber-200'
                      : draft.current_step === 2
                      ? 'bg-blue-100 text-blue-800 border-blue-200'
                      : 'bg-emerald-100 text-emerald-800 border-emerald-200';

                  return (
                    <div
                      key={draft.id}
                      className="bg-white rounded-2xl border border-[#E5E0D8] p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-[#1B4D3E]/40 transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-sm text-[#192A24]">
                            {draft.title || '(Untitled Draft)'}
                          </h3>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeColor}`}
                          >
                            {stepLabel}
                          </span>
                          <span className="text-[10px] font-mono text-stone-500">
                            Term: {draft.term}
                          </span>
                        </div>
                        {draft.description && (
                          <p className="text-xs text-stone-500 line-clamp-1">
                            {draft.description}
                          </p>
                        )}
                        <div className="text-[11px] text-stone-400 flex items-center gap-3 pt-1">
                          <span>
                            Last saved: {new Date(draft.updated_at).toLocaleString()}
                          </span>
                          <span>&bull;</span>
                          <span>
                            Deadline:{' '}
                            {draft.submission_deadline
                              ? new Date(draft.submission_deadline).toLocaleDateString()
                              : 'Not set'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => handleResumeDraft(draft.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Resume Editing
                        </button>
                        <button
                          onClick={() => handleDeleteElective(draft.id, draft.title, true)}
                          className="p-1.5 rounded-xl text-stone-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                          title="Delete Draft"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: STEP-BY-STEP CREATE ELECTIVE WIZARD (Vertical Stepper on Left + Top-Left Actions) */}
        {activeTab === 'create' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* VERTICAL STEP COUNTER (LEFT SIDE OF SCREEN) */}
            <div className="lg:col-span-3 lg:sticky lg:top-24 space-y-4">
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-5 shadow-xs space-y-5">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                      Wizard Stepper
                    </span>
                    {draftId && (
                      <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Draft #{draftId}
                      </span>
                    )}
                  </div>
                  <h3 className="font-bold text-sm text-[#192A24] mt-2">
                    Elective Creation
                  </h3>
                  <p className="text-[11px] text-stone-500 mt-0.5">
                    Step {wizardStep} of 3
                  </p>
                </div>

                {/* Vertical Steps List */}
                <div className="space-y-2 relative">
                  {/* Step 1 Vertical Item */}
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      wizardStep === 1
                        ? 'bg-[#E8F5E9] border-[#1B4D3E] text-[#1B4D3E] shadow-2xs font-semibold'
                        : draftId
                        ? 'bg-white border-[#E0DCD3] text-stone-700 hover:border-[#1B4D3E]/50'
                        : 'bg-stone-50 border-stone-200 text-stone-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        wizardStep === 1
                          ? 'bg-[#1B4D3E] text-white'
                          : draftId
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      1
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold leading-tight">Step 1</div>
                      <div className="text-[11px] text-stone-500 truncate">
                        Title &amp; Deadline
                      </div>
                    </div>
                    {wizardStep === 1 && (
                      <div className="w-1.5 h-4 rounded-full bg-[#1B4D3E]" />
                    )}
                  </button>

                  {/* Step 2 Vertical Item */}
                  <button
                    type="button"
                    onClick={() => {
                      if (draftId || electiveForm.title.trim()) {
                        setWizardStep(2);
                      } else {
                        setFieldErrors({ title: true });
                        setFeedback({ type: 'error', message: 'Complete Step 1 title and deadline first.' });
                      }
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      wizardStep === 2
                        ? 'bg-[#E8F5E9] border-[#1B4D3E] text-[#1B4D3E] shadow-2xs font-semibold'
                        : draftId && electiveForm.courses.length >= 2
                        ? 'bg-white border-[#E0DCD3] text-stone-700 hover:border-[#1B4D3E]/50'
                        : 'bg-stone-50 border-stone-200 text-stone-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        wizardStep === 2
                          ? 'bg-[#1B4D3E] text-white'
                          : draftId && electiveForm.courses.length >= 2
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      2
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold leading-tight flex items-center justify-between">
                        <span>Step 2</span>
                        <span className="text-[10px] font-normal text-stone-500">
                          {electiveForm.courses.length} courses
                        </span>
                      </div>
                      <div className="text-[11px] text-stone-500 truncate">
                        Course Pool (&ge; 2)
                      </div>
                    </div>
                    {wizardStep === 2 && (
                      <div className="w-1.5 h-4 rounded-full bg-[#1B4D3E]" />
                    )}
                  </button>

                  {/* Step 3 Vertical Item */}
                  <button
                    type="button"
                    onClick={() => {
                      if (draftId && electiveForm.courses.length >= 2) {
                        setWizardStep(3);
                      } else {
                        setFeedback({
                          type: 'error',
                          message: 'Complete Step 1 and at least 2 courses in Step 2 first.',
                        });
                      }
                    }}
                    className={`w-full p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                      wizardStep === 3
                        ? 'bg-[#E8F5E9] border-[#1B4D3E] text-[#1B4D3E] shadow-2xs font-semibold'
                        : 'bg-stone-50 border-stone-200 text-stone-400'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        wizardStep === 3
                          ? 'bg-[#1B4D3E] text-white'
                          : 'bg-stone-200 text-stone-600'
                      }`}
                    >
                      3
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-bold leading-tight">Step 3</div>
                      <div className="text-[11px] text-stone-500 truncate">
                        Criteria &amp; Launch
                      </div>
                    </div>
                    {wizardStep === 3 && (
                      <div className="w-1.5 h-4 rounded-full bg-[#1B4D3E]" />
                    )}
                  </button>
                </div>

                {/* Left sidebar footer */}
                <div className="pt-3 border-t border-[#EFECE6] space-y-2">
                  {lastSavedTime && (
                    <div className="text-[11px] text-stone-500 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-stone-400" />
                      <span>Auto-saved at {lastSavedTime}</span>
                    </div>
                  )}
                  {draftId && (
                    <button
                      type="button"
                      onClick={handleResetWizard}
                      className="w-full py-2 rounded-xl border border-[#E0DCD3] bg-white text-stone-600 hover:bg-[#F3F1EC] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                      title="Clear active draft and start from scratch"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Discard &amp; Start Fresh
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* MAIN FORM AREA (RIGHT COLUMN) */}
            <div className="lg:col-span-9 space-y-6">
              {/* UPPER LEFT ACTION CONTROLS (User does not need to scroll down to save or continue!) */}
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-4 sm:p-5 shadow-xs flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {/* Primary Save & Continue to Next Step Button on UPPER-LEFT */}
                  {wizardStep === 1 && (
                    <button
                      type="button"
                      onClick={() => handleSaveStep1(true)}
                      disabled={savingStep}
                      className="px-5 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingStep ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Save &amp; Continue to Step 2</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}

                  {wizardStep === 2 && (
                    <button
                      type="button"
                      onClick={() => handleSaveStep2(true)}
                      disabled={savingStep}
                      className="px-5 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingStep ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <span>Save &amp; Continue to Step 3</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  )}

                  {wizardStep === 3 && (
                    <button
                      type="button"
                      onClick={() => handleSaveStep3(true)}
                      disabled={savingStep}
                      className="px-5 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {savingStep ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Complete &amp; Launch Elective</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Save Draft Button right next to it */}
                  <button
                    type="button"
                    onClick={() => {
                      if (wizardStep === 1) handleSaveStep1(false);
                      else if (wizardStep === 2) handleSaveStep2(false);
                      else handleSaveStep3(false);
                    }}
                    disabled={savingStep}
                    className="px-4 py-2.5 rounded-xl border border-[#E0DCD3] bg-white text-stone-700 hover:bg-[#F3F1EC] text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-3.5 h-3.5 text-stone-500" />
                    <span>Save Draft</span>
                  </button>

                  {/* Back button if past step 1 */}
                  {wizardStep > 1 && (
                    <button
                      type="button"
                      onClick={() => setWizardStep(wizardStep - 1)}
                      className="px-3 py-2 rounded-xl text-stone-500 hover:text-stone-800 text-xs font-semibold flex items-center gap-1 transition-all cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      <span>Back</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-stone-500 uppercase tracking-wider">
                    {wizardStep === 1 && 'Step 1: Details'}
                    {wizardStep === 2 && `Step 2: Pool (${electiveForm.courses.length} courses)`}
                    {wizardStep === 3 && 'Step 3: Criteria & Launch'}
                  </span>
                </div>
              </div>

              {/* STEP 1: Title, Description, Submission Deadline, Academic Term */}
              {wizardStep === 1 && (
                <div className="bg-white rounded-2xl border border-[#E5E0D8] p-6 sm:p-8 shadow-xs space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-[#192A24]">
                      Step 1: General Details &amp; Submission Deadline
                    </h3>
                    <p className="text-xs text-stone-600 mt-1">
                      Name this elective offering, describe the syllabus track, set the required deadline, and define the academic term.
                    </p>
                  </div>

                  <div className="space-y-4">
                    {/* Title */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-1.5 text-stone-700">
                        Elective Title *
                        {fieldErrors.title && (
                          <span className="text-red-600 font-semibold text-xs ml-2 normal-case tracking-normal">
                            (Title is required)
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={electiveForm.title}
                        onChange={(e) => {
                          clearFieldError('title');
                          setElectiveForm({ ...electiveForm, title: e.target.value });
                        }}
                        placeholder="e.g. Professional Elective Basket - Fall 2026"
                        className={`w-full px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all focus:outline-none ${
                          fieldErrors.title
                            ? 'border-2 border-red-500 bg-red-50/40 text-red-950 placeholder:text-red-400'
                            : 'bg-[#FAF9F7] border border-[#E0DCD3] focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E]'
                        }`}
                        required
                      />
                    </div>

                    {/* Short Description */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Short Description
                      </label>
                      <textarea
                        rows={3}
                        value={electiveForm.description}
                        onChange={(e) =>
                          setElectiveForm({ ...electiveForm, description: e.target.value })
                        }
                        placeholder="Brief overview and scope of this elective basket for students..."
                        className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E]"
                      />
                    </div>

                    {/* Submission Deadline & Term */}
                    <div
                      className={`grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl border transition-all ${
                        fieldErrors.submissionDeadline
                          ? 'bg-red-50/50 border-red-300'
                          : 'bg-amber-50/70 border-amber-200'
                      }`}
                    >
                      <div>
                        <label
                          className={`block text-xs font-bold uppercase tracking-wider mb-1 ${
                            fieldErrors.submissionDeadline ? 'text-red-800' : 'text-amber-900'
                          }`}
                        >
                          Submission Deadline Date * <span className="text-xs font-normal">(Required)</span>
                          {fieldErrors.submissionDeadline && (
                            <span className="block text-red-600 font-semibold normal-case text-[11px] mt-0.5">
                              Deadline date is required
                            </span>
                          )}
                        </label>
                        <input
                          type="date"
                          value={electiveForm.submissionDeadline}
                          onChange={(e) => {
                            clearFieldError('submissionDeadline');
                            setElectiveForm({ ...electiveForm, submissionDeadline: e.target.value });
                          }}
                          className={`w-full px-3.5 py-2 rounded-xl text-sm font-semibold focus:outline-none transition-all ${
                            fieldErrors.submissionDeadline
                              ? 'border-2 border-red-500 bg-red-50/60 text-red-950'
                              : 'bg-white border border-amber-300 focus:border-[#1B4D3E]'
                          }`}
                          required
                        />
                        <p className="text-[11px] text-amber-800 mt-1">
                          Preference filling closes automatically after 12 midnight on this date, and the matching algorithm will run.
                        </p>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Academic Term
                          </label>
                          <input
                            type="text"
                            value={electiveForm.term}
                            onChange={(e) =>
                              setElectiveForm({ ...electiveForm, term: e.target.value })
                            }
                            className="w-full px-3.5 py-2 bg-white border border-[#E0DCD3] rounded-xl text-sm font-semibold"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Department
                          </label>
                          <input
                            type="text"
                            value={electiveForm.department}
                            onChange={(e) =>
                              setElectiveForm({ ...electiveForm, department: e.target.value })
                            }
                            className="w-full px-3.5 py-2 bg-white border border-[#E0DCD3] rounded-xl text-sm font-semibold"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Preference Editing Setting */}
                    <div className="p-4 rounded-xl bg-white border border-[#E0DCD3] flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-stone-800">
                          Allow Students to Edit Submitted Preferences Before Deadline
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          If disabled, students can submit preferences only once, will see an irreversible warning, and must type &ldquo;understand&rdquo; to confirm.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={electiveForm.allowPreferenceEditing}
                          onChange={(e) =>
                            setElectiveForm({
                              ...electiveForm,
                              allowPreferenceEditing: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B4D3E]" />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: Courses Pool (at least 2 courses) with Add Button at TOP (Bottom to Top order) */}
              {wizardStep === 2 && (
                <div className="bg-white rounded-2xl border border-[#E5E0D8] p-6 sm:p-8 shadow-xs space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EFECE6]">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-[#192A24]">
                          Step 2: Courses in this Elective
                        </h3>
                        <span
                          className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                            electiveForm.courses.length >= 2
                              ? 'bg-[#E8F5E9] text-[#1B4D3E] border-[#C8E6C9]'
                              : 'bg-red-50 text-red-700 border-red-200'
                          }`}
                        >
                          {electiveForm.courses.length >= 2
                            ? `${electiveForm.courses.length} Courses Added`
                            : `${electiveForm.courses.length} of 2 Minimum Courses`}
                        </span>
                      </div>
                      <p className="text-xs text-stone-600 mt-1">
                        Courses are ordered bottom-to-top. Click &ldquo;+ Add Course&rdquo; to insert a new course at the top of the pool.
                      </p>
                    </div>

                    {/* ADD COURSE BUTTON (AT THE TOP) */}
                    <button
                      type="button"
                      onClick={handleAddCourseRow}
                      className="px-4 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white transition-all text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-xs self-start sm:self-auto"
                      title="Add a new course at the top of the list"
                    >
                      <PlusCircle className="w-4 h-4" />
                      + Add Course (at Top)
                    </button>
                  </div>

                  {/* Course Cards List (Newest at top) */}
                  <div className="space-y-4">
                    {electiveForm.courses.map((course, idx) => {
                      const hasCodeError = !!fieldErrors[`course_${idx}_code`];
                      const hasTitleError = !!fieldErrors[`course_${idx}_title`];
                      const hasCapacityError = !!fieldErrors[`course_${idx}_capacity`];
                      const hasAnyError = hasCodeError || hasTitleError || hasCapacityError;

                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border shadow-2xs relative space-y-3 transition-all ${
                            hasAnyError
                              ? 'bg-red-50/20 border-red-300'
                              : 'bg-[#FAF9F7] border-[#E5E0D8]'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-[#1B4D3E] flex items-center gap-1.5">
                              <BookOpen className="w-3.5 h-3.5" />
                              Course #{idx + 1}
                              {idx === 0 && (
                                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                                  Top / Newest
                                </span>
                              )}
                            </span>
                            {electiveForm.courses.length > 2 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveCourseRow(idx)}
                                className="text-stone-400 hover:text-red-600 p-1 rounded cursor-pointer transition-colors"
                                title="Remove course"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                            {/* Course Code */}
                            <div className="sm:col-span-3">
                              <label
                                className={`block text-[11px] font-semibold mb-1 ${
                                  hasCodeError ? 'text-red-700 font-bold' : 'text-stone-600'
                                }`}
                              >
                                Course Code *
                              </label>
                              <input
                                type="text"
                                value={course.code}
                                onChange={(e) => handleCourseFieldChange(idx, 'code', e.target.value)}
                                placeholder="e.g. CS501"
                                className={`w-full px-3 py-1.5 rounded-lg text-xs font-mono uppercase font-bold focus:outline-none transition-all ${
                                  hasCodeError
                                    ? 'border-2 border-red-500 bg-red-50/60 text-red-950 placeholder:text-red-400'
                                    : 'bg-white border border-[#E0DCD3] focus:border-[#1B4D3E]'
                                }`}
                                required
                              />
                            </div>

                            {/* Course Name */}
                            <div className="sm:col-span-5">
                              <label
                                className={`block text-[11px] font-semibold mb-1 ${
                                  hasTitleError ? 'text-red-700 font-bold' : 'text-stone-600'
                                }`}
                              >
                                Course Name *
                              </label>
                              <input
                                type="text"
                                value={course.title}
                                onChange={(e) => handleCourseFieldChange(idx, 'title', e.target.value)}
                                placeholder="e.g. Machine Learning &amp; Deep Systems"
                                className={`w-full px-3 py-1.5 rounded-lg text-xs font-medium focus:outline-none transition-all ${
                                  hasTitleError
                                    ? 'border-2 border-red-500 bg-red-50/60 text-red-950 placeholder:text-red-400'
                                    : 'bg-white border border-[#E0DCD3] focus:border-[#1B4D3E]'
                                }`}
                                required
                              />
                            </div>

                            {/* Credits */}
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                                Credits
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="8"
                                value={course.credits}
                                onChange={(e) => handleCourseFieldChange(idx, 'credits', e.target.value)}
                                className="w-full px-3 py-1.5 bg-white border border-[#E0DCD3] rounded-lg text-xs focus:border-[#1B4D3E] focus:outline-none"
                              />
                            </div>

                            {/* Capacity */}
                            <div className="sm:col-span-2">
                              <label
                                className={`block text-[11px] font-semibold mb-1 ${
                                  hasCapacityError ? 'text-red-700 font-bold' : 'text-stone-600'
                                }`}
                              >
                                Seats (Cap) *
                              </label>
                              <input
                                type="number"
                                min="1"
                                max="500"
                                value={course.capacity}
                                onChange={(e) => handleCourseFieldChange(idx, 'capacity', e.target.value)}
                                className={`w-full px-3 py-1.5 rounded-lg text-xs font-bold focus:outline-none transition-all ${
                                  hasCapacityError
                                    ? 'border-2 border-red-500 bg-red-50/60 text-red-950'
                                    : 'bg-white border border-[#E0DCD3] text-[#1B4D3E] focus:border-[#1B4D3E]'
                                }`}
                                required
                              />
                            </div>
                          </div>

                          {/* Individual Course CGPA Criteria */}
                          <div className="pt-2 border-t border-[#EFECE6] flex items-center gap-3">
                            <label className="text-[11px] font-semibold text-stone-600 shrink-0">
                              Course Min CGPA <span className="text-stone-400 font-normal">(Individual cutoff):</span>
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max="10"
                              placeholder="e.g. 7.50 (or leave blank)"
                              value={course.minCgpa}
                              onChange={(e) => handleCourseFieldChange(idx, 'minCgpa', e.target.value)}
                              className="w-36 px-2.5 py-1 bg-white border border-[#E0DCD3] rounded-lg text-xs focus:border-[#1B4D3E] focus:outline-none"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* STEP 3: Whole-Elective Criteria & Launch */}
              {wizardStep === 3 && (
                <div className="bg-white rounded-2xl border border-[#E5E0D8] p-6 sm:p-8 shadow-xs space-y-6">
                  <div>
                    <h3 className="text-base font-bold text-[#192A24]">
                      Step 3: Whole-Elective Eligibility Criteria &amp; Final Launch
                    </h3>
                    <p className="text-xs text-stone-600 mt-1">
                      Configure optional eligibility criteria that apply to the whole elective basket. All criteria here are optional (open to all students by default).
                    </p>
                  </div>

                  <div className="p-5 rounded-2xl bg-[#FAF9F7] border border-[#E5E0D8] space-y-4">
                    {/* Overall CGPA Cutoff */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Overall Minimum CGPA <span className="text-stone-400 font-normal">(Optional for entire elective)</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        placeholder="e.g. 7.00 (Leave blank for no general cutoff)"
                        value={electiveForm.minCgpa}
                        onChange={(e) => setElectiveForm({ ...electiveForm, minCgpa: e.target.value })}
                        className="w-full sm:w-64 px-3.5 py-2 bg-white border border-[#E0DCD3] rounded-xl text-sm focus:border-[#1B4D3E] focus:outline-none"
                      />
                    </div>

                    {/* Allowed Semesters */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Allowed Semesters <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableSemesters.map((sem) => {
                          const selected = electiveForm.allowedSemesters.includes(sem);
                          return (
                            <button
                              key={sem}
                              type="button"
                              onClick={() => handleToggleSemester(sem)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                selected
                                  ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                                  : 'bg-white text-stone-600 border-[#E0DCD3] hover:border-[#1B4D3E]'
                              }`}
                            >
                              Semester {sem}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Target Degrees */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Target Degrees <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableDegrees.map((deg) => {
                          const selected = electiveForm.targetDegrees.includes(deg);
                          return (
                            <button
                              key={deg}
                              type="button"
                              onClick={() => handleToggleDegree(deg)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                selected
                                  ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                                  : 'bg-white text-stone-600 border-[#E0DCD3] hover:border-[#1B4D3E]'
                              }`}
                            >
                              {deg}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Target Branches */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                        Target Branches <span className="text-stone-400 font-normal">(Optional)</span>
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {availableBranches.map((br) => {
                          const selected = electiveForm.targetBranches.includes(br);
                          return (
                            <button
                              key={br}
                              type="button"
                              onClick={() => handleToggleBranch(br)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                                selected
                                  ? 'bg-[#1B4D3E] text-white border-[#1B4D3E]'
                                  : 'bg-white text-stone-600 border-[#E0DCD3] hover:border-[#1B4D3E]'
                              }`}
                            >
                              {br}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Final Review Summary Card */}
                  <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 text-xs text-emerald-950 space-y-2">
                    <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                      Review Summary Before Launch
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-stone-700 pt-1">
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase font-semibold">Title</span>
                        <div className="font-bold truncate">{electiveForm.title || 'Untitled'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase font-semibold">Deadline</span>
                        <div className="font-bold truncate">
                          {electiveForm.submissionDeadline ? new Date(electiveForm.submissionDeadline).toLocaleDateString() : '—'}
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase font-semibold">Courses</span>
                        <div className="font-bold">{electiveForm.courses.length} Courses</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-stone-500 uppercase font-semibold">Total Seats</span>
                        <div className="font-bold text-[#1B4D3E]">
                          {electiveForm.courses.reduce((sum, c) => sum + (Number(c.capacity) || 0), 0)} Seats
                        </div>
                      </div>
                    </div>

                    {/* Preference Editing Setting */}
                    <div className="p-4 rounded-xl bg-white border border-[#E0DCD3] flex items-center justify-between gap-4">
                      <div>
                        <div className="text-xs font-bold text-stone-800">
                          Allow Students to Edit Submitted Preferences Before Deadline
                        </div>
                        <p className="text-[11px] text-stone-500 mt-0.5">
                          If disabled, students can submit preferences only once, will see an irreversible warning, and must type &ldquo;understand&rdquo; to confirm.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          type="checkbox"
                          checked={electiveForm.allowPreferenceEditing}
                          onChange={(e) =>
                            setElectiveForm({
                              ...electiveForm,
                              allowPreferenceEditing: e.target.checked,
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#1B4D3E]" />
                      </label>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: ALLOCATION RESULTS & ROSTERS */}
        {activeTab === 'roster' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                  Automated Allocation Results &amp; Student Rosters
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Results generated automatically when elective deadlines expire or published by faculty.
                </p>
              </div>
              <button
                onClick={loadData}
                className="p-2 rounded-lg border border-[#E0DCD3] bg-white text-stone-700 hover:bg-[#F3F1EC] text-xs font-medium flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refresh
              </button>
            </div>

            {selectedRun ? (
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-6 sm:p-8 shadow-xs space-y-6">
                {/* Metric Summary */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E0D8]">
                    <span className="text-[11px] font-semibold text-stone-500 uppercase">
                      Total Students
                    </span>
                    <div className="text-2xl font-bold text-[#192A24] mt-1">
                      {selectedRun.total_students}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E0D8]">
                    <span className="text-[11px] font-semibold text-stone-500 uppercase">
                      Matched Students
                    </span>
                    <div className="text-2xl font-bold text-emerald-700 mt-1">
                      {selectedRun.total_matched}
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E0D8]">
                    <span className="text-[11px] font-semibold text-stone-500 uppercase">
                      Satisfaction Rate
                    </span>
                    <div className="text-2xl font-bold text-[#1B4D3E] mt-1">
                      {(selectedRun.satisfaction_rate || 0).toFixed(1)}%
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FAF9F7] border border-[#E5E0D8]">
                    <span className="text-[11px] font-semibold text-stone-500 uppercase">
                      Run Timestamp
                    </span>
                    <div className="text-sm font-semibold text-stone-700 mt-1">
                      {new Date(selectedRun.created_at).toLocaleString()}
                    </div>
                  </div>
                </div>

                {/* Student Allocation Table */}
                <div>
                  <h3 className="text-sm font-bold text-[#192A24] mb-3">
                    Student Allocation Roster (Run #{selectedRun.id})
                  </h3>
                  <div className="overflow-x-auto rounded-xl border border-[#E5E0D8]">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-[#F3F1EC] text-stone-600 font-semibold border-b border-[#E5E0D8]">
                          <th className="py-2.5 px-4">Student</th>
                          <th className="py-2.5 px-4">Reg No</th>
                          <th className="py-2.5 px-4">Allocated Course</th>
                          <th className="py-2.5 px-4">Matched Preference</th>
                          <th className="py-2.5 px-4 text-right">Priority Score</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#EFECE6]">
                        {selectedRun.results && selectedRun.results.length > 0 ? (
                          selectedRun.results.map((res) => (
                            <tr key={res.id} className="hover:bg-[#FAF9F7] transition-colors">
                              <td className="py-3 px-4 font-bold text-[#192A24]">
                                {res.student_name}
                              </td>
                              <td className="py-3 px-4 font-mono text-stone-600">
                                {res.student_id}
                              </td>
                              <td className="py-3 px-4">
                                {res.matched && res.course_code ? (
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-semibold bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                                    <Check className="w-3.5 h-3.5" />
                                    {res.course_code} - {res.course_title}
                                  </span>
                                ) : (
                                  <span className="text-stone-400">Unmatched</span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-semibold text-emerald-800">
                                {res.preference_rank ? `Choice #${res.preference_rank}` : '—'}
                              </td>
                              <td className="py-3 px-4 text-right font-mono text-stone-700">
                                {(res.priority_score || 0).toFixed(2)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-stone-400">
                              No student matches recorded in this run.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-12 text-center text-xs text-stone-500 shadow-xs">
                No allocation results available yet. Results will automatically appear here once elective deadlines expire or when you click &ldquo;Publish Allocation Results&rdquo;.
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E0D8] bg-[#F9F8F6] py-4 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Faculty Portal &bull; Course Registration &amp; Elective Allocation System</span>
          <span>Logged in as {user?.email}</span>
        </div>
      </footer>
    </div>
  );
}
