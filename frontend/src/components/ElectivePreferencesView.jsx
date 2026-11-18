import React, { useState, useEffect } from 'react';
import {
  ListOrdered,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Award,
  Layers,
  History,
  Lock,
  Clock,
  ShieldAlert,
  ChevronRight,
  Info,
} from 'lucide-react';
import {
  getMyPreferences,
  submitPreferences,
  getCourses,
  getPreferenceHistory,
} from '../api/coursesApi';
import AlertBanner from './AlertBanner';

export default function ElectivePreferencesView({ student }) {
  const [subView, setSubView] = useState('ranking'); // 'ranking' | 'history'
  const [courses, setCourses] = useState([]);
  const [rankedCourseIds, setRankedCourseIds] = useState([]);
  const [allocationResult, setAllocationResult] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notification, setNotification] = useState(null);

  // Load preferences and catalog courses
  const loadData = async () => {
    try {
      setLoading(true);
      const [prefData, coursesData, histData] = await Promise.all([
        getMyPreferences(student?.student_id),
        getCourses(),
        getPreferenceHistory(student?.student_id).catch(() => null),
      ]);

      setCourses(coursesData);
      setAllocationResult(prefData?.allocation_result || null);
      setHistoryData(histData);

      if (prefData?.preferences && prefData.preferences.length > 0) {
        setRankedCourseIds(prefData.preferences.map((p) => p.course));
      } else {
        // Initial selection if empty
        const initial = coursesData.slice(0, 3).map((c) => c.id);
        setRankedCourseIds(initial);
      }
    } catch (err) {
      console.error('Failed to load elective preferences:', err);
      setNotification({
        type: 'error',
        message: 'Failed to load preferences',
        detail: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [student?.student_id]);

  // Course lookup map
  const coursesMap = React.useMemo(() => {
    const map = new Map();
    courses.forEach((c) => map.set(c.id, c));
    return map;
  }, [courses]);

  // Check if any ranked course has passed its submission deadline or window is closed
  const isLockedDueToDeadline = React.useMemo(() => {
    const now = new Date();
    // 1. Check if cohort window is closed
    if (student?.registration_window?.current_state === 'CLOSED') {
      return {
        locked: true,
        reason: 'Cohort registration window has closed for this term.',
      };
    }

    // 2. Check if any selected course has an expired submission deadline
    for (const cid of rankedCourseIds) {
      const c = coursesMap.get(cid);
      if (c && c.submission_deadline) {
        const d = new Date(c.submission_deadline);
        if (now > d) {
          return {
            locked: true,
            reason: `Submission deadline for ${c.code} (${c.title}) passed on ${d.toLocaleDateString()} at ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. Preferences are locked.`,
          };
        }
      }
    }

    return { locked: false, reason: null };
  }, [rankedCourseIds, coursesMap, student?.registration_window]);

  // Available courses not yet ranked
  const unrankedCourses = React.useMemo(() => {
    const rankedSet = new Set(rankedCourseIds);
    return courses.filter((c) => !rankedSet.has(c.id));
  }, [courses, rankedCourseIds]);

  // Move course up in rank
  const moveUp = (index) => {
    if (isLockedDueToDeadline.locked || index === 0) return;
    const next = [...rankedCourseIds];
    const temp = next[index - 1];
    next[index - 1] = next[index];
    next[index] = temp;
    setRankedCourseIds(next);
  };

  // Move course down in rank
  const moveDown = (index) => {
    if (isLockedDueToDeadline.locked || index === rankedCourseIds.length - 1) return;
    const next = [...rankedCourseIds];
    const temp = next[index + 1];
    next[index + 1] = next[index];
    next[index] = temp;
    setRankedCourseIds(next);
  };

  // Add course to rankings (limit 5 choices)
  const addCourse = (courseId) => {
    if (isLockedDueToDeadline.locked) return;
    if (rankedCourseIds.includes(courseId)) return;
    if (rankedCourseIds.length >= 5) {
      setNotification({
        type: 'warning',
        message: 'Maximum Choices Reached',
        detail: 'You may only submit up to 5 ranked elective choices.',
      });
      return;
    }
    setRankedCourseIds([...rankedCourseIds, courseId]);
  };

  // Remove course from rankings
  const removeCourse = (courseId) => {
    if (isLockedDueToDeadline.locked) return;
    setRankedCourseIds(rankedCourseIds.filter((id) => id !== courseId));
  };

  // Submit ranked preferences
  const handleSavePreferences = async () => {
    if (isLockedDueToDeadline.locked) {
      setNotification({
        type: 'error',
        message: 'Modifications Locked',
        detail: isLockedDueToDeadline.reason,
      });
      return;
    }

    if (rankedCourseIds.length === 0) {
      setNotification({
        type: 'warning',
        message: 'No Preferences Selected',
        detail: 'Please select and rank at least one elective course before submitting.',
      });
      return;
    }

    if (rankedCourseIds.length > 5) {
      setNotification({
        type: 'warning',
        message: 'Choice Limit Exceeded',
        detail: 'Maximum 5 elective choices allowed.',
      });
      return;
    }

    try {
      setSaving(true);
      setNotification(null);

      const resp = await submitPreferences({
        courseIds: rankedCourseIds,
        term: 'Fall 2026',
        studentId: student?.student_id,
      });

      setNotification({
        type: 'success',
        message: 'Preferences Saved Successfully!',
        detail: `Your ${rankedCourseIds.length} ranked elective choices have been recorded for the Gale-Shapley matching engine.`,
      });

      // Refresh history
      const hist = await getPreferenceHistory(student?.student_id);
      setHistoryData(hist);
    } catch (err) {
      console.error('Failed to save preferences:', err);
      setNotification({
        type: 'error',
        message: 'Submission Failed',
        detail: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Banner */}
      <AlertBanner notification={notification} onClose={() => setNotification(null)} />

      {/* Sub-navigation Tabs: Current vs History */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setSubView('ranking')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              subView === 'ranking'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ListOrdered className="w-4 h-4" />
            <span>Ranked Preferences</span>
          </button>

          <button
            onClick={() => setSubView('history')}
            className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              subView === 'history'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Submission &amp; Allocation History</span>
            {historyData?.allocations_history?.length > 0 && (
              <span className="bg-indigo-800 text-indigo-200 px-1.5 py-0.5 rounded-full text-[10px]">
                {historyData.allocations_history.length}
              </span>
            )}
          </button>
        </div>

        {/* Choice counter badge */}
        {subView === 'ranking' && (
          <div className="text-xs text-slate-400 flex items-center space-x-1.5">
            <span>Choices:</span>
            <span
              className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                rankedCourseIds.length > 5
                  ? 'bg-rose-500/20 text-rose-300'
                  : 'bg-indigo-500/20 text-indigo-300'
              }`}
            >
              {rankedCourseIds.length} / 5 Max
            </span>
          </div>
        )}
      </div>

      {subView === 'ranking' ? (
        <>
          {/* Deadline Locked Banner (Requirement 4) */}
          {isLockedDueToDeadline.locked && (
            <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-4 flex items-start space-x-3 text-xs text-rose-200">
              <Lock className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-rose-100">Preference Modifications Locked</div>
                <div className="text-rose-300/90 mt-0.5">{isLockedDueToDeadline.reason}</div>
              </div>
            </div>
          )}

          {/* Empty State: Window Closed or None Open */}
          {student?.registration_window?.current_state === 'CLOSED' && (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center space-y-2">
              <ShieldAlert className="w-8 h-8 text-rose-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-200">
                No active elective registration windows are currently open
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                The elective window for your cohort is currently closed. You can view your past submission history and matched allocations in the History tab.
              </p>
            </div>
          )}

          {/* Allocation Result Snapshot Card (if run occurred) */}
          {allocationResult && (
            <div className="bg-gradient-to-r from-indigo-950/80 via-slate-900 to-slate-900 border border-indigo-700/50 rounded-2xl p-6 shadow-xl space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <div className="bg-indigo-600/30 text-indigo-400 p-2 rounded-xl border border-indigo-500/30">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-100">
                      Gale-Shapley Allocation Result Available
                    </h3>
                    <p className="text-xs text-slate-400">
                      Batch matching run #{allocationResult.allocation_run_id || 'Latest'} for {allocationResult.term || 'Fall 2026'}
                    </p>
                  </div>
                </div>

                {allocationResult.matched ? (
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Matched to Choice #{allocationResult.preference_rank}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-xs font-semibold">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span>Unmatched (Over-preferred)</span>
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Assigned Elective:</div>
                  <div className="font-bold text-slate-200 text-sm mt-0.5">
                    {allocationResult.course_code ? `${allocationResult.course_code} - ${allocationResult.course_title}` : 'Unmatched'}
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">Composite Priority Score:</div>
                  <div className="font-bold text-indigo-300 text-sm mt-0.5">
                    {allocationResult.priority_score.toFixed(2)} pts
                  </div>
                </div>

                <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800">
                  <div className="text-slate-400">SHA-256 Tiebreaker:</div>
                  <div className="font-mono text-slate-300 text-xs mt-1 truncate">
                    {allocationResult.tiebreaker_value?.toFixed(6) || '0.000000'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Main Preference Ranking Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center space-x-2">
                  <ListOrdered className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-bold text-slate-100">Elective Preference Ranking</h2>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Rank up to 5 preferred elective courses in order of priority (1 = Most Preferred).
                  The student-proposing Gale-Shapley matching algorithm utilizes your rankings to guarantee a stable allocation.
                </p>
              </div>

              <button
                onClick={handleSavePreferences}
                disabled={saving || rankedCourseIds.length === 0 || isLockedDueToDeadline.locked}
                className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
              >
                <Save className="w-4 h-4" />
                <span>
                  {isLockedDueToDeadline.locked
                    ? 'Preferences Locked'
                    : saving
                    ? 'Saving...'
                    : 'Save Ranked Preferences'}
                </span>
              </button>
            </div>

            {/* Ranked Courses List */}
            <div className="space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                <span>Your Ranked Choices ({rankedCourseIds.length})</span>
                <span className="text-slate-500 font-normal normal-case">
                  {isLockedDueToDeadline.locked
                    ? 'Modifications locked past deadline'
                    : 'Use arrows to adjust ranking order'}
                </span>
              </div>

              {rankedCourseIds.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs space-y-2">
                  <Layers className="w-8 h-8 mx-auto text-slate-600" />
                  <p>No preferences submitted yet. Add courses from the available list below.</p>
                </div>
              ) : (
                rankedCourseIds.map((courseId, index) => {
                  const course = coursesMap.get(courseId);
                  if (!course) return null;

                  return (
                    <div
                      key={course.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex items-center justify-between gap-4 transition-all hover:border-slate-700"
                    >
                      <div className="flex items-center space-x-3.5 flex-1 min-w-0">
                        {/* Rank Badge */}
                        <div className="w-8 h-8 rounded-lg bg-indigo-950 border border-indigo-800/80 text-indigo-300 font-bold flex items-center justify-center text-sm shrink-0">
                          #{index + 1}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono text-xs font-bold text-slate-200">
                              {course.code}
                            </span>
                            <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                              {course.department}
                            </span>
                            <span className="text-xs text-emerald-400 font-medium">
                              {course.credits} cr
                            </span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded ${
                                course.category === 'OPEN'
                                  ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                  : 'bg-indigo-500/10 text-indigo-300 border border-indigo-500/20'
                              }`}
                            >
                              {course.category === 'OPEN' ? 'Open' : 'Dept'}
                            </span>
                          </div>
                          <div className="text-sm font-semibold text-slate-100 truncate mt-0.5">
                            {course.title}
                          </div>
                        </div>
                      </div>

                      {/* Actions: Move Up, Move Down, Remove */}
                      {!isLockedDueToDeadline.locked && (
                        <div className="flex items-center space-x-1.5 shrink-0">
                          <button
                            onClick={() => moveUp(index)}
                            disabled={index === 0}
                            title="Move Up"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => moveDown(index)}
                            disabled={index === rankedCourseIds.length - 1}
                            title="Move Down"
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => removeCourse(course.id)}
                            title="Remove Choice"
                            className="p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Add from Available Pool */}
            {!isLockedDueToDeadline.locked && unrankedCourses.length > 0 && (
              <div className="pt-4 border-t border-slate-800/80 space-y-3">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Add Additional Elective Choices ({unrankedCourses.length} available)
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {unrankedCourses.map((course) => (
                    <div
                      key={course.id}
                      className="bg-slate-950/40 border border-slate-800/80 rounded-xl p-3 flex items-center justify-between gap-2 hover:border-slate-700 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center space-x-1.5 text-xs">
                          <span className="font-mono font-bold text-slate-300">{course.code}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-slate-400 truncate">{course.department}</span>
                        </div>
                        <div className="text-xs font-medium text-slate-200 truncate mt-0.5">
                          {course.title}
                        </div>
                      </div>

                      <button
                        onClick={() => addCourse(course.id)}
                        disabled={rankedCourseIds.length >= 5}
                        className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-lg text-xs font-medium transition-colors shrink-0 disabled:opacity-40"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : (
        /* History & Past Allocations Sub-view (Requirement 3) */
        <div className="space-y-6">
          {/* Historical Allocation Run Results */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                  <Award className="w-5 h-5 text-indigo-400" />
                  <span>Final Elective Allocation Results</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Audited outcomes from past Gale-Shapley matching runs for {student?.name} ({student?.student_id}).
                </p>
              </div>
            </div>

            {(!historyData?.allocations_history || historyData.allocations_history.length === 0) ? (
              <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs space-y-2">
                <History className="w-8 h-8 mx-auto text-slate-600" />
                <p>No past allocation history found.</p>
                <p className="text-[11px] text-slate-600">
                  Results will automatically appear here once faculty runs the Gale-Shapley allocation engine.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyData.allocations_history.map((alloc) => (
                  <div
                    key={alloc.id}
                    className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-bold text-indigo-300 font-mono">
                          Run #{alloc.allocation_run_id}
                        </span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-300">Term: {alloc.term}</span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-400">
                          {new Date(alloc.created_at).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {alloc.matched ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Allocated: Choice #{alloc.preference_rank}</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold">
                          <AlertCircle className="w-3.5 h-3.5" />
                          <span>Unmatched</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-xs pt-1">
                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Assigned Course:</span>
                        <span className="font-semibold text-slate-200">
                          {alloc.course_code ? `${alloc.course_code} - ${alloc.course_title}` : 'None'}
                        </span>
                      </div>

                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Section:</span>
                        <span className="font-semibold text-slate-200">
                          {alloc.assigned_section_number ? `Section ${alloc.assigned_section_number}` : 'N/A'}
                        </span>
                      </div>

                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">Priority Score:</span>
                        <span className="font-semibold text-indigo-300">
                          {alloc.priority_score?.toFixed(2)} pts
                        </span>
                      </div>

                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800">
                        <span className="text-slate-400 text-[10px] block">SHA-256 Tiebreaker:</span>
                        <span className="font-mono text-slate-300 text-[11px] truncate block">
                          {alloc.tiebreaker_value?.toFixed(6) || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Past Submitted Preferences History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center space-x-2">
                <ListOrdered className="w-5 h-5 text-indigo-400" />
                <span>Historical Preference Submissions</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Audit trail of ranked choices recorded across academic cycles.
              </p>
            </div>

            {(!historyData?.preferences_history || historyData.preferences_history.length === 0) ? (
              <div className="p-8 border border-dashed border-slate-800 rounded-xl text-center text-slate-500 text-xs">
                No past preferences recorded.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {historyData.preferences_history.map((pref) => (
                  <div
                    key={pref.id}
                    className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-indigo-950 border border-indigo-800 text-indigo-300 font-bold flex items-center justify-center shrink-0">
                        #{pref.preference_rank}
                      </span>
                      <div className="truncate">
                        <span className="font-mono font-bold text-slate-200">
                          {pref.course_code}
                        </span>
                        <div className="text-slate-400 text-[11px] truncate">
                          {pref.course_title}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      {pref.term}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
