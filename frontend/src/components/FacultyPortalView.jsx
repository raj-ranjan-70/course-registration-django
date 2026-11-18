import React, { useState, useEffect } from 'react';
import {
  Plus,
  Edit,
  Trash2,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Save,
  X,
  Layers,
  Sparkles,
  HelpCircle,
  AlertCircle,
  Filter,
} from 'lucide-react';
import { getCourses, createCourse, updateCourse, deleteCourse, triggerAllocationRun } from '../api/coursesApi';
import AlertBanner from './AlertBanner';

export default function FacultyPortalView({ authUser, onSwitchToStudentView }) {
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState(null);
  const [notification, setNotification] = useState(null);

  // Form Fields
  const [code, setCode] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [department, setDepartment] = useState('Computer Science');
  const [credits, setCredits] = useState(3);
  const [category, setCategory] = useState('DEPARTMENT');
  const [targetDegrees, setTargetDegrees] = useState(['B.Tech']);
  const [targetBranches, setTargetBranches] = useState([]);
  const [minCgpa, setMinCgpa] = useState('');
  const [allowedSemesters, setAllowedSemesters] = useState([]);
  const [maxPreferences, setMaxPreferences] = useState(5);
  const [capacity, setCapacity] = useState(30);
  const [submissionDeadline, setSubmissionDeadline] = useState('');

  const [saving, setSaving] = useState(false);

  // Load courses
  const fetchCoursesList = async () => {
    try {
      setLoading(true);
      const data = await getCourses();
      setCourses(data);
    } catch (err) {
      console.error('Failed to load faculty courses:', err);
      setNotification({
        type: 'error',
        message: 'Failed to load courses',
        detail: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCoursesList();
  }, []);

  const openCreateModal = () => {
    setEditingCourse(null);
    setCode('');
    setTitle('');
    setDescription('');
    setDepartment('Computer Science');
    setCredits(3);
    setCategory('DEPARTMENT');
    setTargetDegrees(['B.Tech']);
    setTargetBranches(['CSE']);
    setMinCgpa('');
    setAllowedSemesters([5, 6, 7]);
    setMaxPreferences(5);
    setCapacity(30);

    // Default deadline 7 days in future formatted for datetime-local
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    setSubmissionDeadline(future.toISOString().slice(0, 16));

    setModalOpen(true);
  };

  const openEditModal = (c) => {
    setEditingCourse(c);
    setCode(c.code || '');
    setTitle(c.title || '');
    setDescription(c.description || '');
    setDepartment(c.department || 'Computer Science');
    setCredits(c.credits || 3);
    setCategory(c.category || 'DEPARTMENT');
    setTargetDegrees(c.target_degrees || []);
    setTargetBranches(c.target_branches || []);
    setMinCgpa(c.min_cgpa !== null && c.min_cgpa !== undefined ? String(c.min_cgpa) : '');
    setAllowedSemesters(c.allowed_semesters || []);
    setMaxPreferences(c.max_preferences || 5);

    const firstSec = c.sections && c.sections.length > 0 ? c.sections[0] : null;
    setCapacity(firstSec ? firstSec.capacity : 30);

    if (c.submission_deadline) {
      const dt = new Date(c.submission_deadline);
      setSubmissionDeadline(dt.toISOString().slice(0, 16));
    } else {
      setSubmissionDeadline('');
    }

    setModalOpen(true);
  };

  const handleSaveCourse = async (e) => {
    e.preventDefault();
    setSaving(true);
    setNotification(null);

    const payload = {
      code: code.trim().toUpperCase(),
      title: title.trim(),
      description: description.trim(),
      department: department.trim(),
      credits: Number(credits),
      category,
      target_degrees: targetDegrees,
      target_branches: targetBranches,
      min_cgpa: minCgpa !== '' ? Number(minCgpa) : null,
      allowed_semesters: allowedSemesters.map(Number),
      max_preferences: Number(maxPreferences),
      capacity: Number(capacity),
      submission_deadline: submissionDeadline ? new Date(submissionDeadline).toISOString() : null,
    };

    try {
      if (editingCourse) {
        await updateCourse(editingCourse.id, payload);
        setNotification({
          type: 'success',
          message: 'Elective Course Updated',
          detail: `Saved flexible configuration rules for ${payload.code}.`,
        });
      } else {
        await createCourse(payload);
        setNotification({
          type: 'success',
          message: 'Elective Course Created',
          detail: `Created ${payload.code} - ${payload.title} with default section capacity of ${payload.capacity}.`,
        });
      }
      setModalOpen(false);
      await fetchCoursesList();
    } catch (err) {
      console.error('Failed to save course:', err);
      setNotification({
        type: 'error',
        message: 'Save Failed',
        detail: err.message,
      });
    } finally {
      setSaving(false);
    }
  };

  // Toggle quick deadline preset (active vs expired/locked)
  const toggleDeadlineQuick = async (course, makeExpired = false) => {
    try {
      const newDeadline = makeExpired
        ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      await updateCourse(course.id, {
        code: course.code,
        title: course.title,
        department: course.department,
        credits: course.credits,
        category: course.category,
        target_degrees: course.target_degrees,
        target_branches: course.target_branches,
        min_cgpa: course.min_cgpa,
        allowed_semesters: course.allowed_semesters,
        max_preferences: course.max_preferences,
        submission_deadline: newDeadline,
      });

      setNotification({
        type: 'info',
        message: 'Deadline Updated',
        detail: makeExpired
          ? `${course.code} deadline set to EXPIRED (preference submissions locked).`
          : `${course.code} deadline extended +7 days (submissions active).`,
      });
      await fetchCoursesList();
    } catch (err) {
      setNotification({ type: 'error', message: 'Failed to toggle deadline', detail: err.message });
    }
  };

  // Quick Run Gale-Shapley matching
  const handleQuickRunAllocation = async () => {
    try {
      setLoading(true);
      const res = await triggerAllocationRun({
        term: 'Fall 2026',
        seed: `faculty-run-${Date.now().toString().slice(-4)}`,
        applyEnrollment: true,
      });
      setNotification({
        type: 'success',
        message: 'Gale-Shapley Allocation Executed!',
        detail: `Run #${res.run.id} complete. Matched ${res.run.total_matched}/${res.run.total_students} students with satisfaction rate of ${res.run.satisfaction_rate}%.`,
      });
      await fetchCoursesList();
    } catch (err) {
      setNotification({ type: 'error', message: 'Allocation execution failed', detail: err.message });
    } finally {
      setLoading(false);
    }
  };

  const degreesList = ['B.Tech', 'M.Tech', 'Dual Degree', 'Ph.D.'];
  const branchesList = ['CSE', 'Data Science', 'Mechanical', 'Electrical', 'ECE', 'Civil'];
  const semestersList = [1, 2, 3, 4, 5, 6, 7, 8];

  const toggleArrayItem = (list, setList, item) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Banner */}
      <AlertBanner notification={notification} onClose={() => setNotification(null)} />

      {/* Top Banner & Actions */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-100">
                Faculty Elective Configuration Portal
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Configure elective course criteria, Department vs. Open categories, target cohorts, optional CGPA &amp; semester rules, capacities, and deadlines.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2.5 w-full sm:w-auto">
          <button
            onClick={openCreateModal}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Elective</span>
          </button>

          <button
            onClick={handleQuickRunAllocation}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all"
          >
            <Sparkles className="w-4 h-4" />
            <span>Run Gale-Shapley Engine</span>
          </button>
        </div>
      </div>

      {/* Courses List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h2 className="text-sm font-bold text-slate-200">
            Active Elective Offerings ({courses.length})
          </h2>
          <span className="text-xs text-slate-400">Term: Fall 2026</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            Loading elective offerings...
          </div>
        ) : courses.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-xs">
            No elective courses configured yet. Click "Create New Elective" to add one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {courses.map((course) => {
              const sec = course.sections && course.sections.length > 0 ? course.sections[0] : null;
              const isLocked = course.is_submission_open === false;

              return (
                <div
                  key={course.id}
                  className={`border rounded-2xl p-5 flex flex-col justify-between space-y-4 transition-all ${
                    isLocked
                      ? 'bg-slate-950/40 border-rose-900/30'
                      : 'bg-slate-950/70 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-sm font-bold text-indigo-300">
                            {course.code}
                          </span>
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              course.category === 'OPEN'
                                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                : 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30'
                            }`}
                          >
                            {course.category === 'OPEN' ? 'Open Elective' : 'Department Elective'}
                          </span>
                          <span className="text-xs text-slate-400">{course.credits} Credits</span>
                        </div>
                        <h3 className="text-base font-semibold text-slate-100 mt-1">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-400 line-clamp-2 mt-1">
                          {course.description || 'No description provided.'}
                        </p>
                      </div>

                      {/* Deadline Status Badge */}
                      <div className="shrink-0">
                        {isLocked ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[11px] font-semibold">
                            <ShieldAlert className="w-3 h-3 text-rose-400" />
                            <span>Deadline Passed (Locked)</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold">
                            <Clock className="w-3 h-3 text-emerald-400" />
                            <span>Submissions Open</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Criteria Rules Summary */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px]">Target Degrees:</span>
                        <span className="font-medium text-slate-200">
                          {course.target_degrees && course.target_degrees.length > 0
                            ? course.target_degrees.join(', ')
                            : 'All (Unrestricted)'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px]">Target Branches:</span>
                        <span className="font-medium text-slate-200 truncate block">
                          {course.target_branches && course.target_branches.length > 0
                            ? course.target_branches.join(', ')
                            : 'All (Unrestricted)'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px]">Min CGPA Requirement:</span>
                        <span className="font-medium text-amber-300">
                          {course.min_cgpa !== null && course.min_cgpa !== undefined
                            ? `${course.min_cgpa.toFixed(2)} / 10.0`
                            : 'None (Unrestricted)'}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80">
                        <span className="text-slate-400 block text-[10px]">Allowed Semesters:</span>
                        <span className="font-medium text-slate-200">
                          {course.allowed_semesters && course.allowed_semesters.length > 0
                            ? `Semesters: ${course.allowed_semesters.join(', ')}`
                            : 'All (Unrestricted)'}
                        </span>
                      </div>
                    </div>

                    {/* Seats & Deadline */}
                    <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-900">
                      <div>
                        <span>Capacity: </span>
                        <span className="font-semibold text-slate-200">
                          {sec ? `${sec.capacity} seats` : '30 seats'}
                        </span>
                      </div>

                      <div>
                        <span>Deadline: </span>
                        <span className="font-medium text-slate-300">
                          {course.submission_deadline
                            ? new Date(course.submission_deadline).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'None set'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openEditModal(course)}
                        className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-medium transition-colors"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        <span>Edit Rules</span>
                      </button>

                      {isLocked ? (
                        <button
                          onClick={() => toggleDeadlineQuick(course, false)}
                          className="px-2.5 py-1.5 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-900/40 rounded-lg text-xs font-medium transition-colors"
                        >
                          Extend (+7d)
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleDeadlineQuick(course, true)}
                          className="px-2.5 py-1.5 bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/40 rounded-lg text-xs font-medium transition-colors"
                        >
                          Lock Deadline (Test)
                        </button>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-500 font-mono">
                      Max choices: {course.max_preferences || 5}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-lg font-bold text-slate-100">
                {editingCourse ? `Edit Elective: ${editingCourse.code}` : 'Configure New Elective Course'}
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Course Code
                  </label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="e.g. CS480"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Department
                  </label>
                  <input
                    type="text"
                    required
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Title
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Deep Learning & Neural Networks"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Description
                </label>
                <textarea
                  rows="2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Course syllabus summary..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* Category, Credits, Capacity, Max Choices */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="DEPARTMENT">Department Elective</option>
                    <option value="OPEN">Open Elective</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Credits
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="6"
                    value={credits}
                    onChange={(e) => setCredits(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Seat Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="200"
                    value={capacity}
                    onChange={(e) => setCapacity(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Max Choices
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={maxPreferences}
                    onChange={(e) => setMaxPreferences(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Flexible Rules Section */}
              <div className="p-4 bg-slate-950/60 rounded-2xl border border-slate-800 space-y-3.5">
                <div className="text-xs font-bold text-indigo-300 uppercase tracking-wider flex items-center justify-between">
                  <span>Flexible Eligibility Criteria</span>
                  <span className="text-[11px] text-slate-400 font-normal normal-case">
                    Leave blank / empty for unrestricted
                  </span>
                </div>

                {/* Target Degrees */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Degrees (Leave empty for all degrees)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {degreesList.map((d) => (
                      <button
                        type="button"
                        key={d}
                        onClick={() => toggleArrayItem(targetDegrees, setTargetDegrees, d)}
                        className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors ${
                          targetDegrees.includes(d)
                            ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Target Branches */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Branches (Leave empty for all branches)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {branchesList.map((b) => (
                      <button
                        type="button"
                        key={b}
                        onClick={() => toggleArrayItem(targetBranches, setTargetBranches, b)}
                        className={`px-3 py-1 rounded-xl text-xs font-medium border transition-colors ${
                          targetBranches.includes(b)
                            ? 'bg-indigo-600/30 text-indigo-300 border-indigo-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Optional Min CGPA & Semesters */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Min CGPA Requirement (Optional - Blank for unrestricted)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="10"
                      value={minCgpa}
                      onChange={(e) => setMinCgpa(e.target.value)}
                      placeholder="e.g. 7.5 (or leave empty)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Submission Deadline (After this date, preferences lock)
                    </label>
                    <input
                      type="datetime-local"
                      value={submissionDeadline}
                      onChange={(e) => setSubmissionDeadline(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Allowed Semesters */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Allowed Semesters (Optional - Leave empty for open to all semesters)
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {semestersList.map((sem) => (
                      <button
                        type="button"
                        key={sem}
                        onClick={() => toggleArrayItem(allowedSemesters, setAllowedSemesters, sem)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold border transition-colors ${
                          allowedSemesters.includes(sem)
                            ? 'bg-indigo-600 text-white border-indigo-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        {sem}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50"
                >
                  {saving ? 'Saving Elective...' : editingCourse ? 'Save Changes' : 'Create Elective'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
