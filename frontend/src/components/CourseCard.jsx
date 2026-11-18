import React, { useState } from 'react';
import {
  User,
  Clock,
  MapPin,
  Check,
  AlertOctagon,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function CourseCard({
  course,
  eligibilitySnapshot,
  registeredSectionIds,
  onRegister,
  onDrop,
  registeringSectionId,
}) {
  const [showReasons, setShowReasons] = useState(false);

  const isEligible = eligibilitySnapshot ? eligibilitySnapshot.eligible : true;
  const reasons = eligibilitySnapshot?.reasons || [];
  const sectionEligibility = eligibilitySnapshot?.section_eligibility || {};

  // Check if course has prerequisites
  const prerequisites = course.prerequisites || [];

  return (
    <div
      className={`bg-slate-900/90 border rounded-2xl overflow-hidden shadow-lg transition-all ${
        !isEligible ? 'border-amber-900/40' : 'border-slate-800 hover:border-slate-700'
      }`}
    >
      {/* Course Header */}
      <div className="p-6 border-b border-slate-800/80 bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-2.5">
          <div className="flex items-center flex-wrap gap-2">
            <span className="font-mono text-base font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-800/50 px-3 py-1 rounded-lg">
              {course.code}
            </span>
            <span className="text-xs font-medium text-slate-400 bg-slate-800 px-2.5 py-1 rounded-md border border-slate-700/60">
              {course.department}
            </span>
            <span className="text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-800/50 px-2.5 py-1 rounded-md">
              {course.credits} Credits
            </span>
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${
                course.category === 'OPEN'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
              }`}
            >
              {course.category === 'OPEN' ? 'Open Elective' : 'Department Elective'}
            </span>
            {course.min_cgpa && (
              <span className="text-xs font-semibold bg-amber-950/60 text-amber-300 border border-amber-800/50 px-2.5 py-1 rounded-md">
                Min CGPA: {course.min_cgpa.toFixed(1)}
              </span>
            )}
          </div>

          {/* Dynamic Eligibility Badge */}
          <div>
            {isEligible ? (
              <span className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-700/60 px-2.5 py-1 rounded-lg">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>Eligible</span>
              </span>
            ) : (
              <button
                onClick={() => setShowReasons(!showReasons)}
                className="inline-flex items-center space-x-1.5 text-xs font-semibold bg-amber-950/80 text-amber-300 border border-amber-700/60 px-2.5 py-1 rounded-lg hover:bg-amber-900/70 transition-colors"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>Ineligible ({reasons.length})</span>
                {showReasons ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-100">{course.title}</h3>
        <p className="text-sm text-slate-400 mt-1.5 line-clamp-2 leading-relaxed">
          {course.description}
        </p>

        {/* Prerequisites Pill List */}
        {prerequisites.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-slate-500 font-medium">Prerequisites:</span>
            {prerequisites.map((p) => (
              <span
                key={p.id}
                className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700 font-mono"
              >
                {p.prerequisite_course_code} (Min grade: {p.min_grade})
              </span>
            ))}
          </div>
        )}

        {/* Detailed Rejection Reasons Banner (Collapsible or visible if ineligible) */}
        {reasons.length > 0 && (
          <div className="mt-3.5 bg-amber-950/30 border border-amber-800/40 rounded-xl p-3 text-xs text-amber-200/90 space-y-1">
            <div className="font-semibold flex items-center gap-1.5 text-amber-300">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>Eligibility Constraints:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-amber-200/80 pl-1">
              {reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Sections List */}
      <div className="p-5 space-y-3.5 bg-slate-950/40">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
          Available Sections ({course.sections?.length || 0})
        </div>

        {course.sections && course.sections.length > 0 ? (
          course.sections.map((section) => {
            const isRegistered = registeredSectionIds.has(section.id);
            const isFull = section.is_full || section.enrolled_count >= section.capacity;
            const isLoading = registeringSectionId === section.id;
            const seatPercentage = Math.min(100, Math.round((section.enrolled_count / section.capacity) * 100));

            // Section-specific eligibility & timetable clash
            const secEval = sectionEligibility[section.id] || {};
            const hasClash = secEval.has_clash || false;
            const secReasons = secEval.reasons || [];
            const isSecEligible = secEval.eligible !== undefined ? secEval.eligible : isEligible;

            return (
              <div
                key={section.id}
                className={`p-4 rounded-xl border transition-all ${
                  isRegistered
                    ? 'bg-emerald-950/20 border-emerald-700/50'
                    : hasClash
                    ? 'bg-rose-950/15 border-rose-900/50'
                    : isFull
                    ? 'bg-slate-900/40 border-slate-800/80 opacity-80'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Section Details */}
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center flex-wrap gap-2">
                      <span className="text-sm font-bold text-slate-200">
                        Section {section.section_number}
                      </span>
                      <span className="text-xs text-slate-500">•</span>
                      <span className="text-xs text-slate-400">{section.term}</span>

                      {/* Timetable Clash Badge */}
                      {hasClash && (
                        <span className="inline-flex items-center space-x-1 text-xs bg-rose-950/80 text-rose-300 font-semibold px-2 py-0.5 rounded border border-rose-800/60">
                          <AlertOctagon className="w-3 h-3 text-rose-400" />
                          <span>Timetable Clash</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-400 pt-1">
                      {section.instructor_name && (
                        <div className="flex items-center space-x-1.5">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate">{section.instructor_name}</span>
                        </div>
                      )}
                      {section.schedule && (
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate font-medium text-slate-300">{section.schedule}</span>
                        </div>
                      )}
                      {section.classroom && (
                        <div className="flex items-center space-x-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-500" />
                          <span className="truncate">{section.classroom}</span>
                        </div>
                      )}
                    </div>

                    {/* Section Clash Details Warning */}
                    {hasClash && secReasons.length > 0 && (
                      <div className="text-xs text-rose-300/90 bg-rose-950/40 p-2 rounded-lg border border-rose-900/40 space-y-0.5 mt-1">
                        {secReasons.filter((r) => r.includes('Clash') || r.includes('overlap')).map((r, idx) => (
                          <div key={idx} className="flex items-start gap-1">
                            <span>•</span>
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Seat Capacity Bar */}
                    <div className="pt-2">
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-slate-400">
                          Enrolled: <strong className="text-slate-200">{section.enrolled_count}</strong> / {section.capacity}
                        </span>
                        <span
                          className={`font-semibold ${
                            isFull
                              ? 'text-rose-400'
                              : section.available_seats <= 2
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                          }`}
                        >
                          {isFull
                            ? 'Full'
                            : `${section.available_seats} ${
                                section.available_seats === 1 ? 'seat' : 'seats'
                              } left`}
                        </span>
                      </div>
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isFull
                              ? 'bg-rose-500'
                              : seatPercentage > 80
                              ? 'bg-amber-400'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${seatPercentage}%` }}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="sm:self-center shrink-0">
                    {isRegistered ? (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-semibold">
                          <Check className="w-3.5 h-3.5" />
                          <span>Enrolled</span>
                        </span>
                        <button
                          onClick={() => onDrop(section.id)}
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 hover:border-rose-700/50 text-slate-400 border border-slate-700 text-xs font-medium transition-all"
                        >
                          Drop
                        </button>
                      </div>
                    ) : isFull ? (
                      <button
                        disabled
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-slate-800/80 text-slate-500 border border-slate-700/40 text-xs font-semibold cursor-not-allowed"
                      >
                        <AlertOctagon className="w-3.5 h-3.5" />
                        <span>Section Full</span>
                      </button>
                    ) : !isSecEligible ? (
                      <button
                        onClick={() => onRegister(section.id)}
                        disabled={isLoading}
                        title={secReasons.join(' | ')}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 text-xs font-semibold transition-all shadow-sm"
                      >
                        {isLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : hasClash ? (
                          <span>Clash (Register)</span>
                        ) : (
                          <span>Ineligible (Register)</span>
                        )}
                      </button>
                    ) : (
                      <button
                        onClick={() => onRegister(section.id)}
                        disabled={isLoading}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Claiming...</span>
                          </>
                        ) : (
                          <span>Register</span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-xs text-slate-500 italic py-2 text-center">
            No sections currently listed for this course.
          </div>
        )}
      </div>
    </div>
  );
}
