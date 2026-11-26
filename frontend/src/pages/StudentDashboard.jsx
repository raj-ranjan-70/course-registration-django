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
  X,
  Lock,
  Unlock,
  ShieldAlert,
  ListOrdered,
} from 'lucide-react';

export default function StudentDashboard() {
  const { user, student, updateProfile, logout } = useAuth();

  const [activeTab, setActiveTab] = useState('electives'); // 'electives' | 'results' | 'profile'
  const [electives, setElectives] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);

  // Preference builder state
  const [savedPreferences, setSavedPreferences] = useState([]);
  const [allocationResult, setAllocationResult] = useState(null);
  const [isPublished, setIsPublished] = useState(false);
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: '' }

  // Modal State for Course Selection & Ranking
  const [rankingModalElective, setRankingModalElective] = useState(null);
  const [modalRankedCourseIds, setModalRankedCourseIds] = useState([]);

  // Confirmation Modal State (with "understand" verification)
  const [confirmModal, setConfirmModal] = useState(null); // { elective, rankedIds }
  const [ackText, setAckText] = useState('');
  const [submittingPreferences, setSubmittingPreferences] = useState(false);

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

  // Auto-dismiss feedback toast after 2 seconds
  useEffect(() => {
    if (feedback) {
      const timer = setTimeout(() => {
        setFeedback(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [feedback]);

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

  // Format remaining time for elective cover tag
  const getDeadlineTag = (deadline) => {
    if (!deadline) return { expired: false, text: 'No Deadline' };
    const diff = new Date(deadline).getTime() - Date.now();
    if (diff <= 0) return { expired: true, text: 'Submissions Closed' };

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    if (days > 0) {
      return { expired: false, text: `${days}d ${hours}h remaining` };
    } else if (hours > 0) {
      return { expired: false, text: `${hours}h ${minutes}m remaining` };
    } else {
      return { expired: false, text: `${minutes}m remaining` };
    }
  };

  // Check if course is eligible based on individual min CGPA
  const isCourseEligible = (course) => {
    if (!course.min_cgpa) return true;
    if (student?.cgpa === null || student?.cgpa === undefined) return false;
    return Number(student.cgpa) >= Number(course.min_cgpa);
  };

  // Filter electives matching student's current semester
  const matchesSemester = (el) => {
    if (!el.allowed_semesters || el.allowed_semesters.length === 0) return true;
    if (!student?.semester) return true;
    return el.allowed_semesters.map(Number).includes(Number(student.semester));
  };

  const semesterFilteredElectives = electives.filter(matchesSemester);

  // Check if student has submitted preferences for an elective
  const hasSubmittedForElective = (el) => {
    const electiveCourseIds = (el.courses || []).map((c) => c.id);
    return savedPreferences.some((p) => electiveCourseIds.includes(p.course));
  };

  // Partition electives between Active and My Choices tabs
  const activeElectives = semesterFilteredElectives.filter((el) => {
    const deadlineExpired = new Date(el.submission_deadline).getTime() <= Date.now();
    const published = Boolean(el.is_published);
    const submitted = hasSubmittedForElective(el);
    return !deadlineExpired && !published && !submitted;
  });

  const choicesAndResultsElectives = semesterFilteredElectives.filter((el) => {
    const deadlineExpired = new Date(el.submission_deadline).getTime() <= Date.now();
    const published = Boolean(el.is_published);
    const submitted = hasSubmittedForElective(el);
    return deadlineExpired || published || submitted;
  });

  // Open course selection and ranking modal
  const handleOpenRankingModal = (elective) => {
    setRankingModalElective(elective);

    // If student already has saved preferences for this elective, populate them
    const elCourseIds = (elective.courses || []).map((c) => c.id);
    const existing = savedPreferences
      .filter((p) => elCourseIds.includes(p.course))
      .sort((a, b) => a.preference_rank - b.preference_rank)
      .map((p) => p.course);

    if (existing.length > 0) {
      setModalRankedCourseIds(existing);
    } else {
      setModalRankedCourseIds([]);
    }
  };

  const handleCloseRankingModal = () => {
    setRankingModalElective(null);
    setModalRankedCourseIds([]);
  };

  // Add course to modal ranking
  const handleModalAddCourse = (courseId) => {
    if (modalRankedCourseIds.includes(courseId)) return;
    setModalRankedCourseIds([...modalRankedCourseIds, courseId]);
  };

  // Remove course from modal ranking
  const handleModalRemoveCourse = (courseId) => {
    setModalRankedCourseIds(modalRankedCourseIds.filter((id) => id !== courseId));
  };

  // Reorder rankings
  const handleModalMoveUp = (index) => {
    if (index === 0) return;
    const updated = [...modalRankedCourseIds];
    const temp = updated[index - 1];
    updated[index - 1] = updated[index];
    updated[index] = temp;
    setModalRankedCourseIds(updated);
  };

  const handleModalMoveDown = (index) => {
    if (index === modalRankedCourseIds.length - 1) return;
    const updated = [...modalRankedCourseIds];
    const temp = updated[index + 1];
    updated[index + 1] = updated[index];
    updated[index] = temp;
    setModalRankedCourseIds(updated);
  };

  // Trigger confirmation modal
  const handleOpenConfirmation = () => {
    if (!rankingModalElective) return;
    setConfirmModal({
      elective: rankingModalElective,
      rankedIds: modalRankedCourseIds,
    });
    setAckText('');
  };

  // Submit preferences to backend
  const handleConfirmSubmit = async () => {
    if (!confirmModal) return;
    const { elective, rankedIds } = confirmModal;

    setSubmittingPreferences(true);
    try {
      const response = await submitPreferences({
        courseIds: rankedIds,
        term: elective.academic_term || 'Fall 2026',
      });

      setFeedback({
        type: 'success',
        message: 'Your course preferences have been recorded successfully!',
      });

      if (response.preferences) {
        setSavedPreferences(response.preferences);
      }

      setConfirmModal(null);
      setRankingModalElective(null);
      setModalRankedCourseIds([]);
      await loadStudentData();

      // Automatically switch to choices tab so student sees their saved submission
      setActiveTab('results');
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to submit preferences. The registration deadline may have closed.',
      });
      setConfirmModal(null);
    } finally {
      setSubmittingPreferences(false);
    }
  };

  // Save profile updates
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

  // Helper to find course details by ID
  const getCourseDetails = (cid) => {
    const found = courses.find((c) => c.id === cid);
    if (found) return found;
    for (const el of electives) {
      const nested = el.courses?.find((c) => c.id === cid);
      if (nested) return nested;
    }
    return null;
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#192A24] flex flex-col font-sans selection:bg-[#1B4D3E] selection:text-white">
      {/* Toast Notification (Auto-vanishes after 2 seconds) */}
      {feedback && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-3 duration-200">
          <div
            className={`p-4 rounded-xl text-sm flex items-center gap-3 border shadow-lg max-w-md ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                : 'bg-red-50 border-red-300 text-red-950'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-700 shrink-0" />
            )}
            <div className="flex-1">
              <span className="font-bold text-xs uppercase tracking-wide">
                {feedback.type === 'success' ? 'Success' : 'Notice'}
              </span>
              <p className="text-xs mt-0.5">{feedback.message}</p>
            </div>
            <button
              onClick={() => setFeedback(null)}
              className="text-stone-400 hover:text-stone-700 text-xs cursor-pointer"
            >
              <X className="w-4 h-4" />
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
                {student?.student_id || 'ID Pending'} &bull; Sem {student?.semester || 1} &bull; {student?.branch || 'CSE'}
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
            {activeElectives.length > 0 && (
              <span className="px-1.5 py-0.2 text-[10px] rounded-full bg-[#1B4D3E] text-white">
                {activeElectives.length}
              </span>
            )}
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
        {/* TAB 1: ACTIVE ELECTIVES */}
        {activeTab === 'electives' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                  Active Elective Offerings
                </h2>
                <p className="text-xs text-stone-600 mt-1">
                  Click on an elective offering to open course ranking, inspect eligibility, and submit your preferences.
                </p>
              </div>

              {student?.semester && (
                <div className="self-start sm:self-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#E5E0D8] text-xs font-medium text-stone-700">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Showing Electives for <strong>Semester {student.semester}</strong>
                </div>
              )}
            </div>

            {loading ? (
              <div className="py-20 text-center">
                <div className="inline-block w-8 h-8 border-3 border-[#1B4D3E] border-t-transparent rounded-full animate-spin mb-3" />
                <p className="text-xs text-stone-500">Checking active elective offerings...</p>
              </div>
            ) : activeElectives.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-12 text-center shadow-xs">
                <div className="w-14 h-14 rounded-2xl bg-[#E8F5E9] text-[#1B4D3E] flex items-center justify-center mx-auto mb-4 border border-[#C8E6C9]">
                  <BookOpen className="w-7 h-7" />
                </div>
                <h3 className="text-base font-bold text-[#192A24]">
                  No Active Elective Windows For Your Semester
                </h3>
                <p className="text-xs text-stone-600 max-w-md mx-auto mt-1.5 leading-relaxed">
                  Either there are no active electives for Semester {student?.semester || 'your semester'},
                  or you have already submitted your preferences for all available electives.
                  Check the &ldquo;My Choices &amp; Allocation Results&rdquo; tab to view your submitted choices.
                </p>
                <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#FAF9F7] text-stone-600 text-xs border border-[#E0DCD3]">
                  <Clock className="w-3.5 h-3.5 text-stone-400" />
                  Please check back shortly or await faculty announcements.
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {activeElectives.map((el) => {
                  const tagInfo = getDeadlineTag(el.submission_deadline);
                  const isEditable = el.allow_preference_editing !== false;

                  return (
                    <div
                      key={el.id}
                      onClick={() => handleOpenRankingModal(el)}
                      className="group bg-white rounded-2xl border border-[#E5E0D8] p-6 shadow-xs hover:border-[#1B4D3E] hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
                    >
                      <div className="space-y-4">
                        {/* Card Cover Tags: Countdown + Editability */}
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          {/* Remaining Days/Time Tag */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              tagInfo.expired
                                ? 'bg-red-50 text-red-800 border-red-200'
                                : 'bg-[#E8F5E9] text-[#1B4D3E] border-[#C8E6C9]'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            {tagInfo.text}
                          </span>

                          {/* Editable vs Non-editable Tag */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                              isEditable
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-amber-50 text-amber-800 border-amber-200'
                            }`}
                          >
                            {isEditable ? (
                              <>
                                <Unlock className="w-3 h-3" /> Editable
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" /> One-time Submission
                              </>
                            )}
                          </span>
                        </div>

                        {/* Elective Title & Description */}
                        <div>
                          <h3 className="text-base font-bold text-[#192A24] group-hover:text-[#1B4D3E] transition-colors">
                            {el.title}
                          </h3>
                          {el.description ? (
                            <p className="text-xs text-stone-600 mt-1 line-clamp-2 leading-relaxed">
                              {el.description}
                            </p>
                          ) : (
                            <p className="text-xs text-stone-400 mt-1 italic">
                              No description provided.
                            </p>
                          )}
                        </div>

                        {/* Criteria Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                          {el.academic_term && (
                            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 font-medium">
                              {el.academic_term}
                            </span>
                          )}
                          {el.min_cgpa && (
                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
                              Min CGPA: {el.min_cgpa.toFixed(2)}
                            </span>
                          )}
                          {el.allowed_semesters && el.allowed_semesters.length > 0 && (
                            <span className="px-2 py-0.5 rounded bg-stone-100 text-stone-700 border border-stone-200 font-medium">
                              Sem: {el.allowed_semesters.join(', ')}
                            </span>
                          )}
                          <span className="px-2 py-0.5 rounded bg-[#FAF9F7] text-stone-600 border border-[#E0DCD3] font-medium">
                            {el.courses?.length || 0} Courses in Basket
                          </span>
                        </div>
                      </div>

                      {/* Card Action Footer */}
                      <div className="mt-6 pt-4 border-t border-[#EFECE6] flex items-center justify-between">
                        <span className="text-xs font-bold text-[#1B4D3E] group-hover:underline flex items-center gap-1">
                          Select &amp; Rank Courses &rarr;
                        </span>
                        <span className="text-[11px] text-stone-400">
                          Click to open
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MY CHOICES & ALLOCATION RESULTS */}
        {activeTab === 'results' && (
          <div className="space-y-6 max-w-5xl mx-auto">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-[#192A24]">
                My Course Preferences &amp; Official Allocation Results
              </h2>
              <p className="text-xs text-stone-600 mt-1">
                View submitted course preferences, edit preferences (if enabled before deadline), and check finalized results.
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
                      <span>
                        Status: <strong className="text-emerald-800">Enrolled</strong>
                      </span>
                      <span>
                        Preference Choice: <strong>#{allocationResult.preference_rank}</strong>
                      </span>
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
                    Course allocations will be finalized once elective submission deadlines expire and results are published.
                  </p>
                </div>
              </div>
            )}

            {/* List of Electives that have been submitted, closed, or published */}
            {choicesAndResultsElectives.length === 0 && savedPreferences.length === 0 ? (
              <div className="bg-white rounded-2xl border border-[#E5E0D8] p-12 text-center shadow-xs">
                <div className="w-12 h-12 rounded-2xl bg-[#F3F1EC] text-stone-500 flex items-center justify-center mx-auto mb-3">
                  <Award className="w-6 h-6" />
                </div>
                <h3 className="text-sm font-bold text-[#192A24]">
                  No Submitted Preferences Yet
                </h3>
                <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                  Switch to the &ldquo;Active Electives &amp; Ranking&rdquo; tab to choose and rank courses.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {choicesAndResultsElectives.map((el) => {
                  const tagInfo = getDeadlineTag(el.submission_deadline);
                  const isExpired = tagInfo.expired;
                  const isEditable = el.allow_preference_editing !== false;
                  const canEdit = isEditable && !isExpired && !el.is_published;

                  const elCourseIds = (el.courses || []).map((c) => c.id);
                  const elPrefs = savedPreferences
                    .filter((p) => elCourseIds.includes(p.course))
                    .sort((a, b) => a.preference_rank - b.preference_rank);

                  return (
                    <div
                      key={el.id}
                      className="bg-white rounded-2xl border border-[#E5E0D8] p-6 shadow-xs space-y-4"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#EFECE6]">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-[#192A24]">{el.title}</h3>
                            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-100 text-stone-600">
                              {el.academic_term || 'Fall 2026'}
                            </span>
                          </div>
                          {el.description && (
                            <p className="text-xs text-stone-600 mt-1">{el.description}</p>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {/* Remaining / Closed Tag */}
                          <span
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                              isExpired
                                ? 'bg-red-50 text-red-800 border-red-200'
                                : 'bg-[#E8F5E9] text-[#1B4D3E] border-[#C8E6C9]'
                            }`}
                          >
                            <Clock className="w-3.5 h-3.5" />
                            {tagInfo.text}
                          </span>

                          {/* Editability status tag */}
                          <span
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${
                              isEditable
                                ? 'bg-blue-50 text-blue-800 border-blue-200'
                                : 'bg-stone-100 text-stone-700 border-stone-200'
                            }`}
                          >
                            {isEditable ? (
                              <>
                                <Unlock className="w-3 h-3" /> Editable Until Deadline
                              </>
                            ) : (
                              <>
                                <Lock className="w-3 h-3" /> Preferences Locked
                              </>
                            )}
                          </span>

                          {/* Edit button if faculty permitted editing and deadline not passed */}
                          {canEdit && (
                            <button
                              onClick={() => handleOpenRankingModal(el)}
                              className="px-3 py-1 rounded-lg bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              Edit Preferences
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Submitted Choices Table */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-stone-500 mb-3">
                          Your Submitted Preference Ranking
                        </h4>

                        {elPrefs.length === 0 ? (
                          <div className="py-4 text-xs text-stone-400 italic">
                            No preferences recorded for this elective.
                          </div>
                        ) : (
                          <div className="overflow-x-auto rounded-xl border border-[#E5E0D8]">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="bg-[#F3F1EC] text-stone-600 font-semibold border-b border-[#E5E0D8]">
                                  <th className="py-2.5 px-4">Priority Rank</th>
                                  <th className="py-2.5 px-4">Course Code</th>
                                  <th className="py-2.5 px-4">Course Name</th>
                                  <th className="py-2.5 px-4 text-right">Allocation Status</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-[#EFECE6]">
                                {elPrefs.map((pref) => {
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
                                      <td className="py-3 px-4 text-stone-800">
                                        {pref.course_title}
                                      </td>
                                      <td className="py-3 px-4 text-right">
                                        {isAllocated ? (
                                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                                            <Check className="w-3 h-3" /> Allocated
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-stone-500 font-medium">
                                            Submitted
                                          </span>
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
                  );
                })}
              </div>
            )}
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
                  <label className="block text-xs font-semibold text-stone-600 mb-1">
                    Full Name
                  </label>
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
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Degree
                    </label>
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
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Branch / Major
                    </label>
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
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      Semester (1-8)
                    </label>
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
                    <label className="block text-xs font-semibold text-stone-600 mb-1">
                      CGPA (0.0 - 10.0)
                    </label>
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
                    {student?.cgpa ? Number(student.cgpa).toFixed(2) : '8.50'} / 10.0
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

      {/* MODAL 1: COURSE SELECTION & PREFERENCE RANKING MODAL */}
      {rankingModalElective && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-[#EFECE6] bg-[#FAF9F7] flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#1B4D3E] text-white">
                    {rankingModalElective.academic_term || 'Fall 2026'}
                  </span>
                  {/* Deadline Remaining Tag */}
                  {(() => {
                    const tagInfo = getDeadlineTag(rankingModalElective.submission_deadline);
                    return (
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                          tagInfo.expired
                            ? 'bg-red-50 text-red-800 border-red-200'
                            : 'bg-[#E8F5E9] text-[#1B4D3E] border-[#C8E6C9]'
                        }`}
                      >
                        <Clock className="w-3 h-3" />
                        {tagInfo.text}
                      </span>
                    );
                  })()}
                  {/* Editability Tag */}
                  <span
                    className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      rankingModalElective.allow_preference_editing !== false
                        ? 'bg-blue-50 text-blue-800 border-blue-200'
                        : 'bg-amber-50 text-amber-800 border-amber-200'
                    }`}
                  >
                    {rankingModalElective.allow_preference_editing !== false ? (
                      <>
                        <Unlock className="w-3 h-3" /> Editable Until Deadline
                      </>
                    ) : (
                      <>
                        <Lock className="w-3 h-3" /> One-Time Submission Only
                      </>
                    )}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-[#192A24]">
                  {rankingModalElective.title}
                </h3>
                {rankingModalElective.description && (
                  <p className="text-xs text-stone-600 mt-0.5 max-w-2xl">
                    {rankingModalElective.description}
                  </p>
                )}
              </div>

              <button
                onClick={handleCloseRankingModal}
                className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body: Two-column Course Selection and Ranking */}
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Available Courses in this Elective */}
              <div className="lg:col-span-7 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-stone-600">
                    Elective Course Basket ({rankingModalElective.courses?.length || 0})
                  </span>
                  <span className="text-[11px] text-stone-500">
                    Your CGPA: <strong className="text-[#1B4D3E]">{student?.cgpa ? Number(student.cgpa).toFixed(2) : '8.50'}</strong>
                  </span>
                </div>

                <div className="space-y-3">
                  {rankingModalElective.courses?.map((course) => {
                    const isEligible = isCourseEligible(course);
                    const isRanked = modalRankedCourseIds.includes(course.id);
                    const rankIndex = modalRankedCourseIds.indexOf(course.id);

                    return (
                      <div
                        key={course.id}
                        className={`p-3.5 rounded-2xl border transition-all ${
                          !isEligible
                            ? 'bg-stone-50/70 border-stone-200 opacity-60'
                            : isRanked
                            ? 'bg-[#E8F5E9]/40 border-[#1B4D3E]'
                            : 'bg-white border-[#E5E0D8] hover:border-stone-400'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-mono font-bold text-xs text-stone-800 px-1.5 py-0.5 rounded bg-[#FAF9F7] border border-stone-200">
                                {course.code}
                              </span>
                              <span className="text-xs font-bold text-[#192A24] truncate">
                                {course.title}
                              </span>
                              <span className="text-[11px] text-stone-500">
                                ({course.credits} Credits)
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-stone-600 mt-1.5">
                              <span>
                                Capacity: <strong>{course.capacity} seats</strong>
                              </span>

                              {course.min_cgpa ? (
                                <span
                                  className={`font-semibold px-2 py-0.5 rounded ${
                                    isEligible
                                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                      : 'bg-red-50 text-red-800 border border-red-200'
                                  }`}
                                >
                                  Min CGPA: &ge; {Number(course.min_cgpa).toFixed(2)}
                                  {!isEligible && ' (Ineligible)'}
                                </span>
                              ) : (
                                <span className="text-stone-400">No CGPA cutoff</span>
                              )}
                            </div>
                          </div>

                          <div className="shrink-0">
                            {!isEligible ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100 text-stone-400 text-xs font-semibold cursor-not-allowed border border-stone-200">
                                <Lock className="w-3 h-3" />
                                Ineligible
                              </span>
                            ) : isRanked ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9] text-xs font-bold">
                                <Check className="w-3.5 h-3.5" />
                                Ranked #{rankIndex + 1}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleModalAddCourse(course.id)}
                                className="px-3 py-1.5 rounded-lg border border-[#1B4D3E] text-[#1B4D3E] hover:bg-[#1B4D3E] hover:text-white transition-all text-xs font-semibold cursor-pointer"
                              >
                                + Rank Choice
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Ordered Preference Ranking Box */}
              <div className="lg:col-span-5 bg-[#FAF9F7] rounded-2xl border border-[#E5E0D8] p-5 flex flex-col justify-between">
                <div>
                  {(() => {
                    const eligibleList = (rankingModalElective.courses || []).filter(isCourseEligible);
                    const allRanked = eligibleList.length > 0 && modalRankedCourseIds.length === eligibleList.length;

                    return (
                      <>
                        <div className="flex items-center justify-between pb-3 border-b border-[#EFECE6] mb-3">
                          <div>
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[#192A24]">
                              Priority Ranking
                            </h4>
                            <p className="text-[11px] text-stone-500">
                              Rank 1 is your highest preference.
                            </p>
                          </div>

                          <span
                            className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full border ${
                              allRanked
                                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                : 'bg-amber-100 text-amber-800 border-amber-300'
                            }`}
                          >
                            {modalRankedCourseIds.length} / {eligibleList.length} Eligible
                          </span>
                        </div>

                        {/* Prompt if not all eligible courses are ranked */}
                        {!allRanked && (
                          <div className="mb-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                            <Info className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>
                              You must rank all <strong>{eligibleList.length}</strong> eligible courses in this elective to enable submission.
                            </span>
                          </div>
                        )}

                        {modalRankedCourseIds.length === 0 ? (
                          <div className="py-12 text-center text-stone-400 text-xs">
                            <ListOrdered className="w-8 h-8 mx-auto mb-2 text-stone-300" />
                            No courses ranked yet.<br />
                            Click &ldquo;+ Rank Choice&rdquo; on eligible courses on the left.
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
                            {modalRankedCourseIds.map((cid, index) => {
                              const course = getCourseDetails(cid);
                              if (!course) return null;

                              return (
                                <div
                                  key={cid}
                                  className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-[#E5E0D8] bg-white text-xs shadow-2xs"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <span className="w-6 h-6 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center font-bold text-[11px] shrink-0">
                                      {index + 1}
                                    </span>
                                    <div className="truncate">
                                      <span className="font-mono font-bold text-[#192A24] mr-1">
                                        {course.code}
                                      </span>
                                      <span className="text-stone-700 truncate">{course.title}</span>
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleModalMoveUp(index)}
                                      disabled={index === 0}
                                      className="p-1 rounded hover:bg-stone-100 text-stone-600 disabled:opacity-20 cursor-pointer"
                                      title="Move up"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleModalMoveDown(index)}
                                      disabled={index === modalRankedCourseIds.length - 1}
                                      className="p-1 rounded hover:bg-stone-100 text-stone-600 disabled:opacity-20 cursor-pointer"
                                      title="Move down"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleModalRemoveCourse(cid)}
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
                      </>
                    );
                  })()}
                </div>

                {/* Modal Action: Proceed to Confirmation */}
                <div className="mt-4 pt-3 border-t border-[#EFECE6]">
                  {(() => {
                    const eligibleList = (rankingModalElective.courses || []).filter(isCourseEligible);
                    const allRanked = eligibleList.length > 0 && modalRankedCourseIds.length === eligibleList.length;

                    return (
                      <button
                        type="button"
                        onClick={handleOpenConfirmation}
                        disabled={!allRanked}
                        className="w-full py-2.5 px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Send className="w-3.5 h-3.5" />
                        Submit Ranked Preferences
                      </button>
                    );
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMATION MODAL (WITH "understand" ACKNOWLEDGMENT FOR NON-EDITABLE ELECTIVES) */}
      {confirmModal && (
        <div className="fixed inset-0 z-60 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-[#E5E0D8] shadow-2xl max-w-lg w-full p-6 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between pb-4 border-b border-[#EFECE6]">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500">
                  Confirmation Required
                </span>
                <h3 className="text-base font-bold text-[#192A24] mt-0.5">
                  Confirm Preference Submission
                </h3>
              </div>
              <button
                onClick={() => setConfirmModal(null)}
                className="p-1 rounded-lg text-stone-400 hover:text-stone-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Warning or Info Banner based on elective.allow_preference_editing */}
            <div className="my-4">
              {confirmModal.elective.allow_preference_editing === false ? (
                /* Non-Editable Warning Box */
                <div className="p-4 rounded-2xl bg-red-50 border border-red-200 text-red-950 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-xs text-red-900">
                    <ShieldAlert className="w-4 h-4 text-red-600 shrink-0" />
                    Warning: Irreversible Submission (No Edit Option)
                  </div>
                  <p className="text-xs text-red-800 leading-relaxed">
                    The faculty has disabled preference editing for this elective. Once submitted, your choices are strictly final and cannot be modified or re-submitted.
                  </p>
                </div>
              ) : (
                /* Editable Info Box */
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-emerald-900 leading-relaxed">
                    You can edit and re-order your submitted preferences at any time until the submission deadline.
                  </p>
                </div>
              )}
            </div>

            {/* Summary of Ranked Courses */}
            <div className="space-y-1.5 my-4">
              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider">
                Ranked Choices Summary ({confirmModal.rankedIds.length})
              </span>
              <div className="max-h-40 overflow-y-auto space-y-1 border border-[#E5E0D8] rounded-xl p-2 bg-[#FAF9F7]">
                {confirmModal.rankedIds.map((cid, idx) => {
                  const course = getCourseDetails(cid);
                  return (
                    <div key={cid} className="flex items-center gap-2 text-xs py-1 px-2">
                      <span className="w-5 h-5 rounded-full bg-[#1B4D3E] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-mono font-bold text-stone-800">
                        {course?.code}
                      </span>
                      <span className="text-stone-700 truncate">{course?.title}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Type "understand" Verification Input (Strictly for non-editable electives) */}
            {confirmModal.elective.allow_preference_editing === false && (
              <div className="my-4 space-y-1.5">
                <label className="block text-xs font-bold text-stone-800">
                  Type <span className="text-red-700 font-mono bg-red-100 px-1 py-0.5 rounded">&ldquo;understand&rdquo;</span> to confirm acknowledgment:
                </label>
                <input
                  type="text"
                  value={ackText}
                  onChange={(e) => setAckText(e.target.value)}
                  placeholder='type "understand"'
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-xs font-mono focus:outline-none focus:border-red-600 focus:bg-white"
                  autoFocus
                />
              </div>
            )}

            {/* Confirmation Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-[#EFECE6]">
              <button
                type="button"
                onClick={() => setConfirmModal(null)}
                className="px-4 py-2 rounded-xl border border-[#E0DCD3] text-stone-600 hover:bg-[#F3F1EC] text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={
                  submittingPreferences ||
                  (confirmModal.elective.allow_preference_editing === false &&
                    ackText.trim().toLowerCase() !== 'understand')
                }
                className="px-5 py-2 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs"
              >
                {submittingPreferences ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    Confirm &amp; Finalize Submission
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
