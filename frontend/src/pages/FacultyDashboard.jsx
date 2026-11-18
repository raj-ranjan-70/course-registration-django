import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getElectives,
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
  Sliders,
  X,
  FileText,
} from 'lucide-react';

export default function FacultyDashboard() {
  const { user, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('electives'); // 'electives' | 'create' | 'roster'
  const [electives, setElectives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [allocationRuns, setAllocationRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [publishingId, setPublishingId] = useState(null);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // New Elective Form State (Matching exact user specifications)
  const [electiveForm, setElectiveForm] = useState({
    title: '',
    description: '',
    department: 'Computer Science',
    term: 'Fall 2026',
    submissionDeadline: '', // REQUIRED!
    // Whole-elective optional criteria:
    minCgpa: '', // optional
    allowedSemesters: [], // optional
    targetDegrees: [], // optional
    targetBranches: [], // optional
    maxPreferences: 5,
    // List of courses inside this elective:
    courses: [
      { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
      { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
    ],
  });
  const [submitting, setSubmitting] = useState(false);

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

  const loadData = async () => {
    setLoading(true);
    try {
      const [electivesData, runsData] = await Promise.all([
        getElectives().catch(() => []),
        getAllocationRuns().catch(() => []),
      ]);
      setElectives(electivesData);
      setAllocationRuns(runsData);
      if (runsData.length > 0) {
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

  // Course list management in form
  const handleAddCourseRow = () => {
    setElectiveForm((prev) => ({
      ...prev,
      courses: [...prev.courses, { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' }],
    }));
  };

  const handleRemoveCourseRow = (index) => {
    if (electiveForm.courses.length <= 1) {
      setFeedback({ type: 'error', message: 'An elective must contain at least one course.' });
      return;
    }
    setElectiveForm((prev) => ({
      ...prev,
      courses: prev.courses.filter((_, i) => i !== index),
    }));
  };

  const handleCourseFieldChange = (index, field, value) => {
    setElectiveForm((prev) => {
      const updated = [...prev.courses];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, courses: updated };
    });
  };

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

  const handleCreateElectiveSubmit = async (e) => {
    e.preventDefault();
    setFeedback(null);

    // Validate Elective Title
    if (!electiveForm.title.trim()) {
      setFeedback({ type: 'error', message: 'Please provide a Title for this elective.' });
      return;
    }

    // Validate Required Submission Deadline
    if (!electiveForm.submissionDeadline) {
      setFeedback({ type: 'error', message: 'Submission Deadline is required.' });
      return;
    }

    // Validate Courses
    for (let i = 0; i < electiveForm.courses.length; i++) {
      const c = electiveForm.courses[i];
      if (!c.code.trim() || !c.title.trim()) {
        setFeedback({
          type: 'error',
          message: `Course #${i + 1} must have a valid Course Code and Course Name.`,
        });
        return;
      }
      if (!c.capacity || Number(c.capacity) <= 0) {
        setFeedback({
          type: 'error',
          message: `Course #${i + 1} (${c.code}) must specify a seat capacity > 0.`,
        });
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        title: electiveForm.title.trim(),
        description: electiveForm.description.trim(),
        department: electiveForm.department,
        term: electiveForm.term,
        submission_deadline: new Date(electiveForm.submissionDeadline).toISOString(),
        allowed_semesters: electiveForm.allowedSemesters,
        target_degrees: electiveForm.targetDegrees,
        target_branches: electiveForm.targetBranches,
        max_preferences: Number(electiveForm.maxPreferences) || 5,
        courses: electiveForm.courses.map((c) => ({
          code: c.code.trim().toUpperCase(),
          title: c.title.trim(),
          credits: Number(c.credits) || 3,
          capacity: Number(c.capacity) || 30,
          min_cgpa: c.minCgpa !== '' ? parseFloat(c.minCgpa) : null,
        })),
      };

      if (electiveForm.minCgpa !== '') {
        payload.min_cgpa = parseFloat(electiveForm.minCgpa);
      }

      const created = await createElectiveGroup(payload);
      setFeedback({
        type: 'success',
        message: `Elective "${created.title}" with ${created.courses?.length || 0} courses created successfully!`,
      });

      // Reset Form
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
        courses: [
          { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
          { code: '', title: '', credits: 3, capacity: 30, minCgpa: '' },
        ],
      });

      await loadData();
      setActiveTab('electives');
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to create elective.' });
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublishResults = async (electiveId) => {
    setPublishingId(electiveId);
    setFeedback(null);
    try {
      const response = await publishElectiveGroup(electiveId);
      setFeedback({
        type: 'success',
        message: `Matching algorithm automatically executed and results published for "${response.elective?.title}"!`,
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

  const handleDeleteElective = async (electiveId, electiveTitle) => {
    if (!window.confirm(`Are you sure you want to delete elective "${electiveTitle}" and all its courses?`)) {
      return;
    }

    try {
      await deleteElectiveGroup(electiveId);
      setFeedback({ type: 'success', message: `Elective "${electiveTitle}" deleted.` });
      await loadData();
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to delete elective.' });
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#192A24] flex flex-col font-sans selection:bg-[#1B4D3E] selection:text-white">
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
                Elective Creation, Course Pools &amp; Automated Allocation
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
            onClick={() => setActiveTab('create')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'create'
                ? 'border-[#1B4D3E] text-[#1B4D3E]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <PlusCircle className="w-4 h-4" />
            Create Elective
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
        {/* Banner Feedback Toast */}
        {feedback && (
          <div
            className={`mb-6 p-4 rounded-xl text-sm flex items-start gap-3 border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-red-50 border-red-200 text-red-900'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
            )}
            <div className="flex-1">
              <span className="font-semibold">
                {feedback.type === 'success' ? 'Notice' : 'Error'}
              </span>
              <p className="text-xs mt-0.5">{feedback.message}</p>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-stone-400 hover:text-stone-600 text-xs cursor-pointer"
            >
              &times;
            </button>
          </div>
        )}

        {/* TAB 1: PUBLISHED ELECTIVES */}
        {activeTab === 'electives' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                  Elective Offerings &amp; Baskets
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Elective groups created by faculty containing individual course choices, individual seat caps, and mandatory deadlines.
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
                  onClick={() => setActiveTab('create')}
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
                  No Electives Created Yet
                </h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto mt-1.5 leading-relaxed">
                  Provide an elective title, description, required deadline, whole-elective criteria,
                  and list of course choices for students.
                </p>
                <button
                  onClick={() => setActiveTab('create')}
                  className="mt-5 px-4 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold inline-flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  Create Elective
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {electives.map((el) => {
                  const deadlineDate = new Date(el.submission_deadline);
                  const isExpired = new Date() > deadlineDate;

                  return (
                    <div
                      key={el.id}
                      className="bg-white rounded-2xl border border-[#E5E0D8] p-6 shadow-xs flex flex-col justify-between"
                    >
                      <div>
                        {/* Top Header of Elective Card */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#EFECE6]">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h3 className="text-base font-bold text-[#192A24]">{el.title}</h3>
                              {el.is_published ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-300">
                                  <Check className="w-3 h-3" /> Results Published
                                </span>
                              ) : isExpired ? (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-300">
                                  <Clock className="w-3 h-3" /> Deadline Expired (Ready to Publish)
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                                  <Clock className="w-3 h-3" /> Submissions Open
                                </span>
                              )}
                            </div>
                            {el.description && (
                              <p className="text-xs text-stone-600 leading-relaxed max-w-2xl">
                                {el.description}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-xs text-stone-500 font-medium">
                              Deadline:{' '}
                              <strong className={isExpired ? 'text-red-700' : 'text-[#192A24]'}>
                                {deadlineDate.toLocaleString()}
                              </strong>
                            </span>
                            <button
                              onClick={() => handleDeleteElective(el.id, el.title)}
                              className="p-1.5 rounded-lg text-stone-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                              title="Delete elective"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Whole-Elective Optional Criteria Chips */}
                        <div className="flex flex-wrap items-center gap-2 my-3 text-[11px]">
                          <span className="text-stone-500 font-semibold uppercase text-[10px] mr-1">
                            Elective Criteria:
                          </span>
                          {el.min_cgpa && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                              Overall Min CGPA: {el.min_cgpa.toFixed(2)}
                            </span>
                          )}
                          {el.allowed_semesters && el.allowed_semesters.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 font-medium">
                              Semesters: {el.allowed_semesters.join(', ')}
                            </span>
                          )}
                          {el.target_degrees && el.target_degrees.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 font-medium">
                              Degrees: {el.target_degrees.join(', ')}
                            </span>
                          )}
                          {el.target_branches && el.target_branches.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 font-medium">
                              Branches: {el.target_branches.join(', ')}
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
                      <div className="mt-5 pt-4 border-t border-[#EFECE6] flex items-center justify-between">
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

        {/* TAB 2: CREATE ELECTIVE FORM (Title, Description, Course List, Individual & Whole Criteria) */}
        {activeTab === 'create' && (
          <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-[#E5E0D8] p-6 sm:p-8 shadow-xs">
            <div className="mb-6">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9] mb-2">
                <PlusCircle className="w-3.5 h-3.5" />
                Elective Creation &amp; Course Pool
              </span>
              <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                Create New Elective Offering
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                Name this elective, provide a short description, set the required deadline, configure optional whole-elective criteria, and add the list of courses with individual seat capacities.
              </p>
            </div>

            <form onSubmit={handleCreateElectiveSubmit} className="space-y-6">
              {/* 1. Elective Title & Short Description */}
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Elective Title *
                  </label>
                  <input
                    type="text"
                    value={electiveForm.title}
                    onChange={(e) => setElectiveForm({ ...electiveForm, title: e.target.value })}
                    placeholder="e.g. Professional Elective Track - Fall 2026"
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                    Short Description
                  </label>
                  <textarea
                    rows={2}
                    value={electiveForm.description}
                    onChange={(e) =>
                      setElectiveForm({ ...electiveForm, description: e.target.value })
                    }
                    placeholder="Brief description of this elective basket for prospective students..."
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E]"
                  />
                </div>

                {/* Submission Deadline (REQUIRED) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-amber-50/60 border border-amber-200/80">
                  <div>
                    <label className="block text-xs font-bold text-amber-900 uppercase tracking-wider mb-1">
                      Submission Deadline * <span className="text-xs font-normal text-amber-700">(Required)</span>
                    </label>
                    <input
                      type="datetime-local"
                      value={electiveForm.submissionDeadline}
                      onChange={(e) =>
                        setElectiveForm({ ...electiveForm, submissionDeadline: e.target.value })
                      }
                      className="w-full px-3.5 py-2.5 bg-white border border-amber-300 rounded-xl text-sm font-semibold focus:outline-none focus:border-[#1B4D3E]"
                      required
                    />
                    <p className="text-[11px] text-amber-800 mt-1">
                      The matching algorithm will automatically run and publish results once this deadline expires.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                      Academic Term
                    </label>
                    <input
                      type="text"
                      value={electiveForm.term}
                      onChange={(e) => setElectiveForm({ ...electiveForm, term: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-white border border-[#E0DCD3] rounded-xl text-sm font-semibold"
                    />
                  </div>
                </div>
              </div>

              {/* 2. List of Courses in this Elective */}
              <div className="p-5 rounded-2xl bg-[#FAF9F7] border border-[#E5E0D8] space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#192A24]">
                      List of Courses in this Elective
                    </h3>
                    <p className="text-[11px] text-stone-500 mt-0.5">
                      Specify Course Code, Course Name, Credits, individual Seat Cap, and individual Min CGPA.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddCourseRow}
                    className="px-3 py-1.5 rounded-lg bg-white border border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E] hover:text-white transition-all text-xs font-semibold cursor-pointer flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    + Add Course
                  </button>
                </div>

                <div className="space-y-3">
                  {electiveForm.courses.map((course, idx) => (
                    <div
                      key={idx}
                      className="p-4 rounded-xl bg-white border border-[#E5E0D8] shadow-2xs relative space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1B4D3E]">Course #{idx + 1}</span>
                        {electiveForm.courses.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCourseRow(idx)}
                            className="text-stone-400 hover:text-red-600 p-1 rounded cursor-pointer"
                            title="Remove course"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Course Code *
                          </label>
                          <input
                            type="text"
                            value={course.code}
                            onChange={(e) => handleCourseFieldChange(idx, 'code', e.target.value)}
                            placeholder="e.g. CS501"
                            className="w-full px-3 py-1.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-lg text-xs font-mono uppercase font-bold"
                            required
                          />
                        </div>

                        <div className="sm:col-span-5">
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Course Name *
                          </label>
                          <input
                            type="text"
                            value={course.title}
                            onChange={(e) => handleCourseFieldChange(idx, 'title', e.target.value)}
                            placeholder="e.g. Machine Learning &amp; Deep Systems"
                            className="w-full px-3 py-1.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-lg text-xs font-medium"
                            required
                          />
                        </div>

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
                            className="w-full px-3 py-1.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-lg text-xs"
                          />
                        </div>

                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                            Seats (Cap) *
                          </label>
                          <input
                            type="number"
                            min="1"
                            max="500"
                            value={course.capacity}
                            onChange={(e) => handleCourseFieldChange(idx, 'capacity', e.target.value)}
                            className="w-full px-3 py-1.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-lg text-xs font-bold text-[#1B4D3E]"
                            required
                          />
                        </div>
                      </div>

                      {/* Individual Course CGPA Criteria */}
                      <div className="pt-2 border-t border-[#EFECE6] flex items-center gap-3">
                        <label className="text-[11px] font-semibold text-stone-600 shrink-0">
                          Course Min CGPA <span className="text-stone-400 font-normal">(Optional individual cutoff):</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          placeholder="e.g. 8.00 (or leave blank)"
                          value={course.minCgpa}
                          onChange={(e) => handleCourseFieldChange(idx, 'minCgpa', e.target.value)}
                          className="w-36 px-2.5 py-1 bg-[#FAF9F7] border border-[#E0DCD3] rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 3. Whole-Elective Optional Criteria (Semester, Degree, Branch, CGPA) */}
              <div className="p-5 rounded-2xl bg-white border border-[#E5E0D8] space-y-4">
                <div className="flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#1B4D3E]" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-700">
                    Whole-Elective Criteria (All Optional)
                  </h3>
                </div>
                <p className="text-[11px] text-stone-500">
                  These rules apply to the elective as a whole. Leave blank or unselected to make open to all.
                </p>

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
                    placeholder="e.g. 7.50 (Leave blank for no general cutoff)"
                    value={electiveForm.minCgpa}
                    onChange={(e) => setElectiveForm({ ...electiveForm, minCgpa: e.target.value })}
                    className="w-full sm:w-64 px-3.5 py-2 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm"
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
                              : 'bg-[#FAF9F7] text-stone-600 border-[#E0DCD3] hover:border-[#1B4D3E]'
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
                              : 'bg-[#FAF9F7] text-stone-600 border-[#E0DCD3] hover:border-[#1B4D3E]'
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
                              : 'bg-[#FAF9F7] text-stone-600 border-[#E0DCD3] hover:border-[#1B4D3E]'
                          }`}
                        >
                          {br}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#EFECE6]">
                <button
                  type="button"
                  onClick={() => setActiveTab('electives')}
                  className="px-4 py-2.5 rounded-xl border border-[#E0DCD3] text-stone-600 hover:bg-[#F3F1EC] text-xs font-semibold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
                >
                  {submitting ? (
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <PlusCircle className="w-4 h-4" />
                      Publish Elective &amp; Course Pool
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB 3: ALLOCATION RESULTS & ROSTERS */}
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
