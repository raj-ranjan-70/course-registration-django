import React from 'react';
import { X, Calendar, Clock, MapPin, User, Trash2, Award } from 'lucide-react';

export default function MyRegistrationsModal({
  isOpen,
  onClose,
  student,
  onDropRegistration,
  droppingId,
}) {
  if (!isOpen) return null;

  const registrations = student?.active_registrations || [];
  const totalCredits = student?.total_enrolled_credits || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600/20 text-indigo-400 p-2 rounded-xl border border-indigo-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100">My Registered Courses</h2>
              <p className="text-xs text-slate-400">
                {registrations.length} {registrations.length === 1 ? 'course' : 'courses'} enrolled ({totalCredits} credits)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-3.5 flex-1">
          {registrations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 space-y-2">
              <Award className="w-10 h-10 text-slate-600 mx-auto" />
              <p className="text-sm font-medium">You have not registered for any courses yet.</p>
              <p className="text-xs text-slate-500">
                Browse the catalog and click "Register" to atomically claim seats!
              </p>
            </div>
          ) : (
            registrations.map((reg) => {
              const sec = reg.section;
              const isDropping = droppingId === reg.id;

              return (
                <div
                  key={reg.id}
                  className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-indigo-400 bg-indigo-950/80 border border-indigo-900/60 px-2 py-0.5 rounded">
                        {sec.course_code}
                      </span>
                      <span className="text-sm font-semibold text-slate-200">
                        {sec.course_title}
                      </span>
                      <span className="text-xs text-slate-500">
                        (Sec {sec.section_number})
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 pt-0.5">
                      {sec.instructor_name && (
                        <div className="flex items-center space-x-1">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>{sec.instructor_name}</span>
                        </div>
                      )}
                      {sec.schedule && (
                        <div className="flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span>{sec.schedule}</span>
                        </div>
                      )}
                      {sec.classroom && (
                        <div className="flex items-center space-x-1">
                          <MapPin className="w-3 h-3 text-slate-500" />
                          <span>{sec.classroom}</span>
                        </div>
                      )}
                      <span className="text-emerald-400 font-medium">
                        {sec.course_credits} credits
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => onDropRegistration(reg.id)}
                    disabled={isDropping}
                    className="self-end sm:self-center inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-xs font-medium transition-all disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{isDropping ? 'Dropping...' : 'Drop Course'}</span>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-400">
          <div>
            Max Allowed: <strong className="text-slate-200">{student?.max_credits || 18} credits</strong>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
