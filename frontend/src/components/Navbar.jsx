import React from 'react';
import {
  BookOpen,
  Calendar,
  Users,
  Clock,
  ShieldAlert,
  ListOrdered,
  Sparkles,
  Layers,
  Settings,
  LogIn,
  LogOut,
  UserCheck,
  Briefcase,
  GraduationCap,
} from 'lucide-react';

export default function Navbar({
  student,
  allStudents = [],
  onSelectStudent,
  onOpenSchedule,
  onOpenProfile,
  onOpenAuth,
  onLogout,
  authUser,
  activeTab = 'catalog',
  setActiveTab,
}) {
  const creditsEnrolled = student?.total_enrolled_credits || 0;
  const maxCredits = student?.max_credits || 18;
  const creditPercentage = Math.min(100, Math.round((creditsEnrolled / maxCredits) * 100));
  const windowInfo = student?.registration_window;

  // Window badge formatting
  const renderWindowBadge = () => {
    if (!windowInfo) {
      return (
        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
          No Window Set
        </span>
      );
    }

    if (windowInfo.current_state === 'ACTIVE') {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] bg-emerald-500/20 text-emerald-300 font-medium px-2 py-0.5 rounded-full border border-emerald-500/30">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span>Window Active</span>
        </span>
      );
    } else if (windowInfo.current_state === 'UPCOMING') {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] bg-amber-500/20 text-amber-300 font-medium px-2 py-0.5 rounded-full border border-amber-500/30">
          <Clock className="w-3 h-3 text-amber-400" />
          <span>Window Upcoming</span>
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center space-x-1 text-[11px] bg-rose-500/20 text-rose-300 font-medium px-2 py-0.5 rounded-full border border-rose-500/30">
          <ShieldAlert className="w-3 h-3 text-rose-400" />
          <span>Window Closed</span>
        </span>
      );
    }
  };

  const isFacultyUser = authUser?.role === 'INSTRUCTOR' || authUser?.role === 'ADMIN';

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2.5 rounded-xl shadow-inner text-white">
            <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base sm:text-lg font-bold tracking-tight">University Course &amp; Elective Portal</h1>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 font-medium px-2 py-0.5 rounded-full border border-indigo-500/30">
                Fall 2026
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Gale-Shapley Fair Matching • Flexible Faculty Rules • Unified Auth
            </p>
          </div>
        </div>

        {/* Right Controls: Persona Switcher, Profile, Schedule, Auth */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Persona Switcher (Demo helper) */}
          {allStudents.length > 0 && (
            <div className="flex items-center space-x-1.5 bg-slate-800/90 border border-slate-700 rounded-xl px-2.5 py-1 text-xs">
              <Users className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-slate-400 hidden sm:inline">Persona:</span>
              <select
                value={student?.student_id || ''}
                onChange={(e) => onSelectStudent(e.target.value)}
                className="bg-transparent text-slate-200 font-semibold focus:outline-none cursor-pointer py-0.5"
              >
                {allStudents.map((s) => (
                  <option key={s.student_id} value={s.student_id} className="bg-slate-900 text-slate-200">
                    {s.name} ({s.branch || s.major || s.academic_year})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Student Profile Card (Clickable to Edit Profile) */}
          {student && (
            <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1 flex items-center space-x-2.5">
              <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-semibold text-xs">
                {student.name?.split(' ').map((n) => n[0]).join('') || 'ST'}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-semibold text-slate-100 flex items-center gap-1.5">
                  <span className="truncate max-w-[120px]">{student.name}</span>
                  {renderWindowBadge()}
                </div>
                <div className="text-[10px] text-slate-400 flex items-center space-x-1.5">
                  <span className="font-mono">{student.student_id}</span>
                  <span>•</span>
                  <span>{student.degree || 'B.Tech'} {student.branch || student.major}</span>
                  <span>•</span>
                  <span>Sem {student.semester || 5}</span>
                  <span>•</span>
                  <span className="text-amber-400 font-bold">GPA: {student.cgpa || 8.0}</span>
                </div>
              </div>

              {/* Edit Profile Button */}
              <button
                onClick={onOpenProfile}
                title="Edit Academic Profile"
                className="p-1 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 transition-colors"
              >
                <UserCheck className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Faculty / Instructor Badge */}
          {isFacultyUser && (
            <div className="bg-amber-950/40 border border-amber-700/60 rounded-xl px-2.5 py-1 flex items-center space-x-1.5 text-xs text-amber-300">
              <Briefcase className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold">{authUser.first_name || authUser.username} (Faculty)</span>
            </div>
          )}

          {/* Schedule Button */}
          <button
            onClick={onOpenSchedule}
            className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-xl font-medium text-xs transition-all shadow-sm"
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>Schedule</span>
            <span className="bg-indigo-700 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded-full">
              {student?.active_registrations?.length || 0}
            </span>
          </button>

          {/* Unified Login / Switch Account Button */}
          <button
            onClick={onOpenAuth}
            className="flex items-center space-x-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-medium text-xs transition-all"
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In / Switch</span>
          </button>
        </div>
      </div>

      {/* Navigation Sub-header / Tabs */}
      <div className="bg-slate-950/70 border-t border-slate-800/80 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center space-x-1 sm:space-x-3 py-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'catalog'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Course Catalog &amp; Eligibility</span>
          </button>

          <button
            onClick={() => setActiveTab('preferences')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'preferences'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Elective Preferences &amp; History</span>
          </button>

          <button
            onClick={() => setActiveTab('faculty')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'faculty'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Briefcase className="w-3.5 h-3.5 text-indigo-400" />
            <span>Faculty Elective Portal</span>
          </button>

          <button
            onClick={() => setActiveTab('admin')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              activeTab === 'admin'
                ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Gale-Shapley Allocation Engine</span>
          </button>
        </div>
      </div>
    </header>
  );
}
