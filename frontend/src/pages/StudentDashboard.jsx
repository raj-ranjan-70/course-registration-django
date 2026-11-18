import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  getElectives,
  getCourses,
  getMyPreferences,
  submitPreferences,
} from '../api/coursesApi';
import {
  GraduationCap,
  User,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Clock,
  LogOut,
  Send,
  Award,
  Layers,
  Edit3,
  Save,
  Check,
  Hash,
  Mail,
  Info,
  Calendar,
} from 'lucide-react';

export default function StudentDashboard() {
  const { user, student, updateProfile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('electives'); // 'electives' | 'results' | 'profile'
  const [electives, setElectives] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Preference builder state
  const [rankedCourseIds, setRankedCourseIds] = useState([]);
  const [savedPreferences, setSavedPreferences] = useState([]);
  const [allocationResult, setAllocationResult] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [submittingPreferences, setSubmittingPreferences] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: student?.name || '',
    degree: student?.degree || 'B.Tech',
    branch: student?.branch || 'Computer Science',
    semester: student?.semester || 5,
    cgpa: student?.cgpa || 8.5,
  });
  const [savingProfile, setSavingProfile] = useState(false);

  useEffect(() => {
    if (student) {
      setProfileForm({
        name: student.name || '',
        degree: student.degree || 'B.Tech',
        branch: student.branch || 'Computer Science',
        semester: student.semester || 5,
        cgpa: student.cgpa || 8.5,
      });
    }
  }, [student]);

  const loadStudentData = async () => {
    setLoading(true);
    try {
      const [electivesData, coursesData, prefData] = await Promise.all([
        getElectives().catch(() => []),
        getCourses().catch(() => []),
        getMyPreferences().catch(() => ({ preferences: [], allocation_result: null, is_published: false })),
      ]);

      setElectives(electivesData);
      setCourses(coursesData);

      if (prefData) {
        setSavedPreferences(prefData.preferences || []);
        setAllocationResult(prefData.allocation_result || null);
        setIsPublished(prefData.is_published || false);

        if (prefData.preferences && prefData.preferences.length > 0) {
          setRankedCourseIds(prefData.preferences.map((p) => p.course));
        }
      }
    } catch (err) {
      console.error('Failed to load student dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentData();
  }, []);

  // Preference selection
  const handleAddPreference = (courseId) => {
    if (rankedCourseIds.includes(courseId)) return;
    if (rankedCourseIds.length >= 5) {
      setFeedback({ type: 'error', message: 'You can submit up to a maximum of 5 course preferences.' });
      return;
    }
    setRankedCourseIds([...rankedCourseIds, courseId]);
    setFeedback(null);
  };

  const handleRemovePreference = (courseId) => {
    setRankedCourseIds(rankedCourseIds.filter((id) => id !== courseId));
    setFeedback(null);
  };

  const handleMoveUp = (index) => {
    if (index === 0) return;
    const updated = [...rankedCourseIds];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setRankedCourseIds(updated);
  };

  const handleMoveDown = (index) => {
    if (index === rankedCourseIds.length - 1) return;
    const updated = [...rankedCourseIds];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setRankedCourseIds(updated);
  };

  const handleSubmitPreferences = async () => {
    if (rankedCourseIds.length === 0) {
      setFeedback({ type: 'error', message: 'Please select at least 1 course for your elective preferences.' });
      return;
    }

    setSubmittingPreferences(true);
    setFeedback(null);
    try {
      const response = await submitPreferences({
        courseIds: rankedCourseIds,
        term: 'Fall 2026',
      });
      setFeedback({
        type: 'success',
        message: 'Your ranked course choices have been securely saved and submitted!',
      });
      if (response.preferences) {
        setSavedPreferences(response.preferences);
      }
      await loadStudentData();
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to submit preferences. The registration deadline may have closed.',
      });
    } finally {
      setSubmittingPreferences(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    setFeedback(null);
    try {
      await updateProfile({
        name: profileForm.name.trim(),
        degree: profileForm.degree,
        branch: profileForm.branch,
        semester: Number(profileForm.semester),
        cgpa: parseFloat(profileForm.cgpa),
      });
      setIsEditingProfile(false);
      setFeedback({ type: 'success', message: 'Academic profile updated successfully.' });
    } catch (err) {
      setFeedback({ type: 'error', message: err.message || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  // Find course details by ID
  const getCourseDetails = (cid) => {
    // Check in direct courses list
    const found = courses.find((c) => c.id === cid);
    if (found) return found;
    // Check in nested electives courses
    for (const el of electives) {
      const nested = el.courses?.find((c) => c.id === cid);
      if (nested) return nested;
    }
    return null;
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
                  Student Elective Portal
                </span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                  STUDENT
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Course Selection, Preference Ranking &amp; Allocation Results
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-xs font-bold text-[#192A24]">
                {student?.name || user?.username}
              </span>
              <span className="text-[11px] font-mono text-stone-500">
                {student?.student_id || 'ID Pending'} &bull; {student?.branch || 'CSE'}
              </span>
            </div>

            <button
              onClick={logout}
              className="p-2 sm:px-3 sm:py-1.5 rounded-lg border border-[#E0DCD3] bg-white text-stone-700 hover:text-red-700 hover:border-red-200 hover:bg-red-50 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Sign out"
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
            <BookOpen className="w-4 h-4" />
            Active Electives &amp; Ranking
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'results'
                ? 'border-[#1B4D3E] text-[#1B4D3E]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Award className="w-4 h-4" />
            My Choices &amp; Allocation Results
            {allocationResult && (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`py-3 px-4 text-xs sm:text-sm font-semibold border-b-2 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#1B4D3E] text-[#1B4D3E]'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <User className="w-4 h-4" />
            Profile Setup
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
                {feedback.type === 'success' ? 'Confirmation' : 'Notice'}
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

        {/* TAB 1: ACTIVE ELECTIVES & PREFERENCE RANKING */}
        {activeTab === 'electives' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                Active Elective Offerings
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                Review available course choices in active electives and submit your preferred ranking before the deadline.
              </p>
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <div className="inline-block w-8 h-8 border-3 border-[#1B4D3E] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-stone-500">Checking active elective offerings...</p>
              </div>
            ) : electives.length === 0 && courses.length === 0 ? (
              /* PROPER EMPTY STATE: ZERO ELECTIVES ACTIVE */
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-12 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] text-[#1B4D3E] flex items-center justify-center mx-auto mb-4 border border-[#C8E6C9]">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-[#192A24]">
                  No Active Elective Windows Currently Available
                </h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto mt-1.5 leading-relaxed">
                  Faculty members have not yet opened an elective window for this semester.
                  Once electives and course pools are published by faculty, you can rank your choices here.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF9F7] text-stone-600 text-xs border border-[#E0DCD3]">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  Please check back shortly or await faculty announcements.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                {/* Left Column: Elective Baskets & Courses */}
                <div className="lg:col-span-7 space-y-6">
                  {electives.map((el) => {
                    const deadlineDate = new Date(el.submission_deadline);
                    const isExpired = new Date() > deadlineDate;

                    return (
                      <div
                        key={el.id}
                        className="bg-white rounded-2xl border border-[#E5E0D8] p-5 sm:p-6 shadow-xs space-y-4"
                      >
                        {/* Elective Header Info */}
                        <div className="pb-4 border-b border-[#EFECE6]">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <h3 className="text-base font-bold text-[#192A24]">{el.title}</h3>
                              {el.description && (
                                <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                                  {el.description}
                                </p>
                              )}
                            </div>

                            <div className="shrink-0 text-right">
                              <span
                                className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                                  isExpired
                                    ? 'bg-red-50 text-red-800 border-red-200'
                                    : 'bg-[#E8F5E9] text-[#1B4D3E] border-[#C8E6C9]'
                                }`}
                              >
                                <Clock className="w-3 h-3" />
                                {isExpired ? 'Submissions Closed' : 'Deadline:'}{' '}
                                {deadlineDate.toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          {/* Whole-Elective Criteria Chips */}
                          <div className="flex flex-wrap items-center gap-2 mt-3 text-[11px]">
                            {el.min_cgpa && (
                              <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                                Elective Min CGPA: {el.min_cgpa.toFixed(2)}
                              </span>
                            )}
                            {el.allowed_semesters && el.allowed_semesters.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 font-medium">
                                Allowed Sems: {el.allowed_semesters.join(', ')}
                              </span>
                            )}
                            {el.target_branches && el.target_branches.length > 0 && (
                              <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 font-medium">
                                Target Branches: {el.target_branches.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* List of Courses inside this Elective */}
                        <div className="space-y-3">
                          <span className="text-xs font-bold uppercase tracking-wider text-stone-500">
                            Available Course Choices ({el.courses?.length || 0})
                          </span>

                          <div className="grid grid-cols-1 gap-3">
                            {el.courses?.map((course) => {
                              const isAdded = rankedCourseIds.includes(course.id);
                              const meetsCgpa =
                                !course.min_cgpa || (student?.cgpa && student.cgpa >= course.min_cgpa);

                              return (
                                <div
                                  key={course.id}
                                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                                    isAdded
                                      ? 'bg-[#E8F5E9]/30 border-[#1B4D3E]'
                                      : 'bg-[#FAF9F7] border-[#E5E0D8] hover:border-stone-400'
                                  }`}
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                      <span className="font-mono font-bold text-xs text-stone-800 px-1.5 py-0.5 rounded bg-white border border-stone-200">
                                        {course.code}
                                      </span>
                                      <span className="text-xs font-bold text-[#192A24] truncate">
                                        {course.title}
                                      </span>
                                      <span className="text-[11px] text-stone-500">
                                        ({course.credits} Credits)
                                      </span>
                                    </div>

                                    <div className="flex items-center gap-3 text-[11px] text-stone-600">
                                      <span>
                                        Capacity: <strong>{course.capacity} seats</strong>
                                      </span>
                                      {course.min_cgpa ? (
                                        <span
                                          className={`font-medium ${
                                            meetsCgpa ? 'text-emerald-700' : 'text-red-700'
                                          }`}
                                        >
                                          Min CGPA: &ge; {course.min_cgpa.toFixed(2)}
                                          {!meetsCgpa && ' (Below cutoff)'}
                                        </span>
                                      ) : (
                                        <span className="text-stone-400">No CGPA cutoff</span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="shrink-0">
                                    {isAdded ? (
                                      <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9] text-xs font-semibold">
                                        <Check className="w-3.5 h-3.5" />
                                        Selected
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleAddPreference(course.id)}
                                        disabled={isExpired}
                                        className="px-3 py-1.5 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E] hover:text-white transition-all text-xs font-semibold cursor-pointer disabled:opacity-40"
                                      >
                                        + Choose
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Right Column: Ranked Preference Order Builder */}
                <div className="lg:col-span-5 bg-white rounded-2xl border border-[#E5E0D8] p-5 sm:p-6 shadow-xs sticky top-24">
                  <div className="flex items-center justify-between pb-3 border-b border-[#EFECE6] mb-4">
                    <div>
                      <h3 className="text-sm font-bold text-[#192A24]">
                        Your Preference Ranking
                      </h3>
                      <p className="text-[11px] text-stone-500 mt-0.5">
                        Priority order (Rank 1 is your highest choice)
                      </p>
                    </div>
                    <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                      {rankedCourseIds.length} / 5 Choices
                    </span>
                  </div>

                  {rankedCourseIds.length === 0 ? (
                    <div className="py-10 text-center text-stone-400 text-xs leading-relaxed">
                      No courses added to your ranking yet.<br />
                      Click &ldquo;+ Choose&rdquo; on any course from the list.
                    </div>
                  ) : (
                    <div className="space-y-2 mb-5">
                      {rankedCourseIds.map((cid, index) => {
                        const course = getCourseDetails(cid);
                        if (!course) return null;

                        return (
                          <div
                            key={cid}
                            className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-[#E5E0D8] bg-[#FAF9F7] text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                                {index + 1}
                              </span>
                              <div className="truncate">
                                <span className="font-mono font-bold text-[#192A24] mr-1.5">
                                  {course.code}
                                </span>
                                <span className="text-stone-700 truncate">{course.title}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleMoveUp(index)}
                                disabled={index === 0}
                                className="p-1 rounded hover:bg-stone-200 text-stone-600 disabled:opacity-20 cursor-pointer"
                                title="Move up"
                              >
                                <ArrowUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleMoveDown(index)}
                                disabled={index === rankedCourseIds.length - 1}
                                className="p-1 rounded hover:bg-stone-200 text-stone-600 disabled:opacity-20 cursor-pointer"
                                title="Move down"
                              >
                                <ArrowDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRemovePreference(cid)}
                                className="p-1 rounded hover:bg-red-50 text-stone-400 hover:text-red-600 cursor-pointer"
                                title="Remove"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <button
                    onClick={handleSubmitPreferences}
                    disabled={submittingPreferences || rankedCourseIds.length === 0}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40"
                  >
                    {submittingPreferences ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        Save &amp; Submit Preferences
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY CHOICES & ALLOCATION RESULTS */}
        {activeTab === 'results' && (
          <div className="space-y-6 max-w-4xl mx-auto">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                My Course Preferences &amp; Official Allocation Result
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                Your submitted preference choices and official course placement results.
              </p>
            </div>

            {/* Official Match Outcome Card */}
            {allocationResult && isPublished ? (
              <div className="bg-white rounded-2xl border border-emerald-200 bg-emerald-50/40 p-6 shadow-xs">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        Official Course Allocation
                      </span>
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ALLOCATED &bull; Preference #{allocationResult.preference_rank}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-[#192A24] mt-1.5">
                      {allocationResult.course_code} &mdash; {allocationResult.course_title}
                    </h3>
                    <p className="text-xs text-stone-600 mt-0.5">
                      Section {allocationResult.assigned_section_number || '01'} ({allocationResult.term})
                    </p>

                    <div className="mt-4 pt-3 border-t border-emerald-200/60 text-xs text-stone-600 flex items-center gap-4">
                      <span>Status: <strong className="text-emerald-800">Enrolled</strong></span>
                      <span>Preference Choice: <strong>#{allocationResult.preference_rank}</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-6 shadow-xs flex items-start gap-3">
                <Info className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-xs font-bold text-[#192A24] uppercase tracking-wider">
                    Allocation Status: Submissions Under Review
                  </h4>
                  <p className="text-xs text-stone-600 mt-1 leading-relaxed">
                    Official course allocation results will be announced when the submission deadline expires.
                    Your ranked preferences have been saved and are ready for placement.
                  </p>
                </div>
              </div>
            )}

            {/* Submitted Preferences Table */}
            <div className="bg-white rounded-2xl border border-[#E5E0D8] p-6 shadow-xs">
              <h3 className="text-sm font-bold text-[#192A24] mb-3">
                Your Submitted Choices (Term: Fall 2026)
              </h3>

              {savedPreferences.length === 0 ? (
                <p className="text-xs text-stone-500 py-4">
                  No preferences submitted yet. Switch to the &ldquo;Active Electives&rdquo; tab to choose your courses.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-[#E5E0D8]">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-[#F3F1EC] text-stone-600 font-semibold border-b border-[#E5E0D8]">
                        <th className="py-2.5 px-4">Priority Rank</th>
                        <th className="py-2.5 px-4">Course Code</th>
                        <th className="py-2.5 px-4">Course Name</th>
                        <th className="py-2.5 px-4 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#EFECE6]">
                      {savedPreferences.map((pref) => {
                        const isAllocated =
                          allocationResult?.course === pref.course && isPublished;

                        return (
                          <tr key={pref.id} className="hover:bg-[#FAF9F7] transition-colors">
                            <td className="py-3 px-4 font-bold text-[#192A24]">
                              Choice #{pref.preference_rank}
                            </td>
                            <td className="py-3 px-4 font-mono font-bold text-stone-800">
                              {pref.course_code}
                            </td>
                            <td className="py-3 px-4 text-stone-800">{pref.course_title}</td>
                            <td className="py-3 px-4 text-right">
                              {isAllocated ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                                  <Check className="w-3 h-3" /> Allocated
                                </span>
                              ) : (
                                <span className="text-[10px] text-stone-400 font-medium">Submitted</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: PROFILE SETUP */}
        {activeTab === 'profile' && (
          <div className="max-w-2xl mx-auto bg-white rounded-2xl border border-[#E5E0D8] p-6 sm:p-8 shadow-xs">
            <div className="flex items-center justify-between pb-6 border-b border-[#EFECE6] mb-6">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9] mb-2">
                  <User className="w-3.5 h-3.5" />
                  Academic Profile Setup
                </span>
                <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                  Student Credentials &amp; Attributes
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Manage your academic attributes used for course eligibility verification.
                </p>
              </div>

              {!isEditingProfile && (
                <button
                  type="button"
                  onClick={() => setIsEditingProfile(true)}
                  className="px-3.5 py-1.5 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E] hover:text-white transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  Edit Profile
                </button>
              )}
            </div>

            {isEditingProfile ? (
              <form onSubmit={handleSaveProfile} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E]"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Degree</label>
                    <select
                      value={profileForm.degree}
                      onChange={(e) => setProfileForm({ ...profileForm, degree: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E]"
                    >
                      <option value="B.Tech">B.Tech</option>
                      <option value="M.Tech">M.Tech</option>
                      <option value="Dual Degree">Dual Degree</option>
                      <option value="B.Sc">B.Sc</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Branch / Major</label>
                    <select
                      value={profileForm.branch}
                      onChange={(e) => setProfileForm({ ...profileForm, branch: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E]"
                    >
                      <option value="Computer Science">Computer Science</option>
                      <option value="Electrical Engineering">Electrical Engineering</option>
                      <option value="Mechanical Engineering">Mechanical Engineering</option>
                      <option value="Data Science">Data Science</option>
                      <option value="Civil Engineering">Civil Engineering</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">Semester (1-8)</label>
                    <input
                      type="number"
                      min="1"
                      max="8"
                      value={profileForm.semester}
                      onChange={(e) => setProfileForm({ ...profileForm, semester: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-600 mb-1">CGPA (0.0 - 10.0)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="10"
                      value={profileForm.cgpa}
                      onChange={(e) => setProfileForm({ ...profileForm, cgpa: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#EFECE6]">
                  <button
                    type="button"
                    onClick={() => setIsEditingProfile(false)}
                    className="px-4 py-2 rounded-xl border border-[#E0DCD3] text-stone-600 hover:bg-[#F3F1EC] text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="px-5 py-2 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {savingProfile ? (
                      <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="p-4 rounded-xl bg-[#F9F8F6] border border-[#E5E0D8]">
                  <span className="text-stone-400 uppercase tracking-wider text-[10px] font-semibold">
                    Registration Number
                  </span>
                  <div className="text-sm font-mono font-bold text-[#192A24] mt-1">
                    {student?.student_id || 'Not Assigned'}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F9F8F6] border border-[#E5E0D8]">
                  <span className="text-stone-400 uppercase tracking-wider text-[10px] font-semibold">
                    University Email
                  </span>
                  <div className="text-sm font-mono font-bold text-[#192A24] mt-1 truncate">
                    {student?.email || user?.email}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F9F8F6] border border-[#E5E0D8]">
                  <span className="text-stone-400 uppercase tracking-wider text-[10px] font-semibold">
                    Degree &amp; Branch
                  </span>
                  <div className="text-sm font-bold text-[#192A24] mt-1">
                    {student?.degree} &bull; {student?.branch}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F9F8F6] border border-[#E5E0D8]">
                  <span className="text-stone-400 uppercase tracking-wider text-[10px] font-semibold">
                    Academic Year &amp; Semester
                  </span>
                  <div className="text-sm font-bold text-[#192A24] mt-1">
                    Semester {student?.semester} ({student?.academic_year || 'Junior'})
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-[#F9F8F6] border border-[#E5E0D8] sm:col-span-2">
                  <span className="text-stone-400 uppercase tracking-wider text-[10px] font-semibold">
                    Cumulative CGPA
                  </span>
                  <div className="text-xl font-bold text-emerald-800 mt-1">
                    {student?.cgpa ? student.cgpa.toFixed(2) : '8.50'} / 10.0
                  </div>
                  <p className="text-[11px] text-stone-500 mt-1">
                    Used to determine individual course minimum cutoff eligibility.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E0D8] bg-[#F9F8F6] py-4 text-center text-xs text-stone-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Student Elective Portal</span>
          <span>Logged in as {student?.name || user?.username} ({student?.student_id})</span>
        </div>
      </footer>
    </div>
  );
}
