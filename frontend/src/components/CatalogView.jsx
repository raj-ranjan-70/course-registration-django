import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  RotateCw,
  Sparkles,
  Layers,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldAlert,
} from 'lucide-react';
import CourseCard from './CourseCard';
import AlertBanner from './AlertBanner';
import MyRegistrationsModal from './MyRegistrationsModal';
import {
  getCourses,
  getDepartments,
  getCurrentStudent,
  getEligibilitySnapshots,
  registerForSection,
  dropRegistration,
  generateIdempotencyKey,
} from '../api/coursesApi';

export default function CatalogView({
  student,
  onStudentChange,
  isScheduleOpen,
  setIsScheduleOpen,
}) {
  const [courses, setCourses] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [eligibilitySnapshots, setEligibilitySnapshots] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedCredits, setSelectedCredits] = useState('');
  const [openOnly, setOpenOnly] = useState(false);
  const [eligibleOnly, setEligibleOnly] = useState(false);

  // Idempotency simulation state
  const [customIdempotencyKey, setCustomIdempotencyKey] = useState('');
  const [useFixedKey, setUseFixedKey] = useState(false);

  // Active operations
  const [registeringSectionId, setRegisteringSectionId] = useState(null);
  const [droppingRegistrationId, setDroppingRegistrationId] = useState(null);
  const [notification, setNotification] = useState(null);

  // Load initial data and eligibility snapshots
  const loadData = async (activeStudentId = null) => {
    try {
      setLoading(true);
      setError(null);

      const targetStudentId = activeStudentId || student?.student_id;

      const [coursesData, deptsData, studentData, snapshotsData] = await Promise.all([
        getCourses(),
        getDepartments(),
        getCurrentStudent(targetStudentId),
        getEligibilitySnapshots(targetStudentId),
      ]);

      setCourses(coursesData);
      setDepartments(deptsData);
      setEligibilitySnapshots(snapshotsData || {});
      if (onStudentChange) {
        onStudentChange(studentData);
      }
    } catch (err) {
      console.error('Failed to load catalog & eligibility data:', err);
      setError(err.message || 'Failed to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [student?.student_id]);

  // Set of actively registered section IDs for quick lookup
  const registeredSectionIds = useMemo(() => {
    const ids = new Set();
    if (student?.active_registrations) {
      student.active_registrations.forEach((reg) => {
        if (reg.section?.id) ids.add(reg.section.id);
      });
    }
    return ids;
  }, [student]);

  // Section ID to Registration ID mapping for drop
  const sectionToRegistrationMap = useMemo(() => {
    const map = new Map();
    if (student?.active_registrations) {
      student.active_registrations.forEach((reg) => {
        if (reg.section?.id) map.set(reg.section.id, reg.id);
      });
    }
    return map;
  }, [student]);

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      const snapshot = eligibilitySnapshots[course.id];
      const isEligible = snapshot ? snapshot.eligible : true;

      // Eligible Only filter
      if (eligibleOnly && !isEligible) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesCode = course.code.toLowerCase().includes(query);
        const matchesTitle = course.title.toLowerCase().includes(query);
        const matchesDept = course.department.toLowerCase().includes(query);
        const matchesDesc = course.description?.toLowerCase().includes(query);
        const matchesInstructor = course.sections?.some((s) =>
          s.instructor_name?.toLowerCase().includes(query)
        );
        if (!matchesCode && !matchesTitle && !matchesDept && !matchesDesc && !matchesInstructor) {
          return false;
        }
      }

      // Department filter
      if (selectedDepartment && course.department !== selectedDepartment) {
        return false;
      }

      // Credits filter
      if (selectedCredits && course.credits !== parseInt(selectedCredits, 10)) {
        return false;
      }

      // Open only filter
      if (openOnly) {
        const hasOpenSection = course.sections?.some((s) => !s.is_full && s.available_seats > 0);
        if (!hasOpenSection) return false;
      }

      return true;
    });
  }, [courses, searchQuery, selectedDepartment, selectedCredits, openOnly, eligibleOnly, eligibilitySnapshots]);

  // Handle seat claim registration
  const handleRegister = async (sectionId) => {
    try {
      setRegisteringSectionId(sectionId);
      setNotification(null);

      let keyToUse = null;
      if (useFixedKey) {
        if (!customIdempotencyKey) {
          const generated = generateIdempotencyKey();
          setCustomIdempotencyKey(generated);
          keyToUse = generated;
        } else {
          keyToUse = customIdempotencyKey;
        }
      }

      const response = await registerForSection({
        sectionId,
        idempotencyKey: keyToUse,
        studentId: student?.student_id,
      });

      setNotification({
        type: response.idempotent ? 'idempotent' : 'success',
        isIdempotent: response.idempotent,
        message: response.message,
        detail: response.idempotent
          ? `Idempotency verified: Reused existing registration (Key: ${keyToUse || 'auto'}). Seat count unchanged.`
          : `Atomic seat claim verified: 1 seat claimed using transaction.atomic() & F() expression.`,
      });

      // Refresh student, catalog, and eligibility snapshots
      const [updatedStudent, updatedCourses, updatedSnapshots] = await Promise.all([
        getCurrentStudent(student?.student_id),
        getCourses(),
        getEligibilitySnapshots(student?.student_id),
      ]);
      if (onStudentChange) onStudentChange(updatedStudent);
      setCourses(updatedCourses);
      setEligibilitySnapshots(updatedSnapshots || {});
    } catch (err) {
      console.error('Registration failed:', err);

      let notifType = 'error';
      let title = 'Registration Blocked';

      if (err.message.includes('Registration window') || err.message.includes('403')) {
        title = '403 Forbidden: Registration Window';
      } else if (err.message.includes('Missing Prerequisite')) {
        title = 'Prerequisite Requirement Not Met';
      } else if (err.message.includes('Clash') || err.message.includes('overlap')) {
        title = 'Timetable Clash Detected';
      }

      setNotification({
        type: notifType,
        message: title,
        detail: err.message,
      });
    } finally {
      setRegisteringSectionId(null);
    }
  };

  // Handle dropping a course section
  const handleDropBySectionId = async (sectionId) => {
    const regId = sectionToRegistrationMap.get(sectionId);
    if (!regId) return;
    await handleDrop(regId);
  };

  const handleDrop = async (registrationId) => {
    try {
      setDroppingRegistrationId(registrationId);
      setNotification(null);

      const response = await dropRegistration(registrationId, student?.student_id);

      setNotification({
        type: 'warning',
        message: response.message || 'Course dropped successfully.',
        detail: 'Atomic seat release: Seat count decremented via F() expression.',
      });

      // Refresh data
      const [updatedStudent, updatedCourses, updatedSnapshots] = await Promise.all([
        getCurrentStudent(student?.student_id),
        getCourses(),
        getEligibilitySnapshots(student?.student_id),
      ]);
      if (onStudentChange) onStudentChange(updatedStudent);
      setCourses(updatedCourses);
      setEligibilitySnapshots(updatedSnapshots || {});
    } catch (err) {
      console.error('Drop failed:', err);
      setNotification({
        type: 'error',
        message: 'Failed to Drop Course',
        detail: err.message,
      });
    } finally {
      setDroppingRegistrationId(null);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner / Notification */}
      <AlertBanner notification={notification} onClose={() => setNotification(null)} />

      {/* Graceful Empty State when registration window is closed */}
      {student?.registration_window?.current_state === 'CLOSED' && (
        <div className="bg-amber-950/30 border border-amber-800/50 rounded-2xl p-4 flex items-center space-x-3 text-amber-200 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0" />
          <div>
            <div className="font-bold text-amber-100">No active elective registration windows are currently open</div>
            <div className="text-amber-300/80">The elective registration window for your cohort is closed. You can explore courses and prerequisite criteria below.</div>
          </div>
        </div>
      )}

      {/* Control / Filter Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by code (e.g. CS101, CS201), course title, department, or instructor..."
              className="w-full bg-slate-950/70 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Department */}
            <select
              value={selectedDepartment}
              onChange={(e) => setSelectedDepartment(e.target.value)}
              className="bg-slate-950/70 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>

            {/* Credits */}
            <select
              value={selectedCredits}
              onChange={(e) => setSelectedCredits(e.target.value)}
              className="bg-slate-950/70 border border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
            >
              <option value="">All Credits</option>
              <option value="3">3 Credits</option>
              <option value="4">4 Credits</option>
            </select>

            {/* Open Sections Only Toggle */}
            <label className="flex items-center space-x-2 text-xs font-medium text-slate-300 bg-slate-950/50 border border-slate-800 rounded-xl px-3 py-2.5 cursor-pointer hover:border-slate-700 select-none">
              <input
                type="checkbox"
                checked={openOnly}
                onChange={(e) => setOpenOnly(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4 bg-slate-900"
              />
              <span>Open Only</span>
            </label>

            {/* Eligible Courses Only Toggle */}
            <label className="flex items-center space-x-2 text-xs font-medium text-emerald-300 bg-emerald-950/30 border border-emerald-800/50 rounded-xl px-3 py-2.5 cursor-pointer hover:border-emerald-700 select-none">
              <input
                type="checkbox"
                checked={eligibleOnly}
                onChange={(e) => setEligibleOnly(e.target.checked)}
                className="rounded border-emerald-700 text-emerald-600 focus:ring-emerald-500 h-4 w-4 bg-slate-900"
              />
              <span>Eligible Only</span>
            </label>

            {/* Refresh Button */}
            <button
              onClick={() => loadData(student?.student_id)}
              title="Refresh Catalog Data"
              className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Idempotency Testing Inspector & Status Bar */}
        <div className="border-t border-slate-800/80 pt-3.5 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
          <div className="flex items-center space-x-2">
            <span className="font-semibold text-slate-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
              Idempotency Test Mode:
            </span>
            <label className="inline-flex items-center cursor-pointer space-x-1.5">
              <input
                type="checkbox"
                checked={useFixedKey}
                onChange={(e) => setUseFixedKey(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 bg-slate-900"
              />
              <span className="text-slate-400">Lock Key (Test duplicate submits)</span>
            </label>
          </div>

          {useFixedKey && (
            <div className="flex items-center space-x-2 flex-1 max-w-md">
              <input
                type="text"
                value={customIdempotencyKey}
                onChange={(e) => setCustomIdempotencyKey(e.target.value)}
                placeholder="Custom Idempotency Key"
                className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-indigo-300 font-mono focus:outline-none"
              />
              <button
                onClick={() => setCustomIdempotencyKey(generateIdempotencyKey())}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs shrink-0"
              >
                New Key
              </button>
            </div>
          )}

          <div className="text-slate-500">
            Showing <strong className="text-slate-300">{filteredCourses.length}</strong> of{' '}
            {courses.length} courses
          </div>
        </div>
      </div>

      {/* Main Catalog Course Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4].map((n) => (
            <div
              key={n}
              className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 h-64 animate-pulse space-y-4"
            >
              <div className="h-6 bg-slate-800 rounded w-1/3" />
              <div className="h-4 bg-slate-800/60 rounded w-2/3" />
              <div className="h-20 bg-slate-950/40 rounded-xl" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-950/40 border border-rose-800/60 rounded-2xl p-8 text-center text-rose-300 space-y-3">
          <p className="font-semibold text-base">Unable to connect to course registration backend.</p>
          <p className="text-sm opacity-80">{error}</p>
          <button
            onClick={() => loadData(student?.student_id)}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-medium rounded-xl text-sm transition-colors"
          >
            Retry Connection
          </button>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 space-y-2">
          <Layers className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-slate-200">No courses match your filter</h3>
          <p className="text-sm text-slate-500">
            Try adjusting your search query, department, or open section filter.
          </p>
          <button
            onClick={() => {
              setSearchQuery('');
              setSelectedDepartment('');
              setSelectedCredits('');
              setOpenOnly(false);
              setEligibleOnly(false);
            }}
            className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold underline mt-2"
          >
            Clear all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredCourses.map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              eligibilitySnapshot={eligibilitySnapshots[course.id]}
              registeredSectionIds={registeredSectionIds}
              onRegister={handleRegister}
              onDrop={handleDropBySectionId}
              registeringSectionId={registeringSectionId}
            />
          ))}
        </div>
      )}

      {/* Student Registered Courses Modal */}
      <MyRegistrationsModal
        isOpen={isScheduleOpen}
        onClose={() => setIsScheduleOpen(false)}
        student={student}
        onDropRegistration={handleDrop}
        droppingId={droppingRegistrationId}
      />
    </div>
  );
}
