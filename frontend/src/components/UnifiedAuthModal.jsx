import React, { useState } from 'react';
import {
  GraduationCap,
  Briefcase,
  KeyRound,
  Mail,
  UserCheck,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertCircle,
  Building,
  Award,
} from 'lucide-react';
import { studentLogin, studentRegister, facultyLogin } from '../api/coursesApi';

export default function UnifiedAuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [mode, setMode] = useState('student'); // 'student' | 'faculty'
  const [studentAction, setStudentAction] = useState('login'); // 'login' | 'register'

  // Student Login Fields
  const [regNo, setRegNo] = useState('');
  const [studentEmail, setStudentEmail] = useState('');

  // Student Register Additional Fields
  const [regName, setRegName] = useState('');
  const [regDegree, setRegDegree] = useState('B.Tech');
  const [regBranch, setRegBranch] = useState('CSE');
  const [regSemester, setRegSemester] = useState(5);
  const [regCgpa, setRegCgpa] = useState(8.5);

  // Faculty Login Fields
  const [facultyUsername, setFacultyUsername] = useState('');
  const [facultyPassword, setFacultyPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  // Preset quick fill for students
  const fillStudentPreset = (id, email, name, deg, br, sem, gpa) => {
    setRegNo(id);
    setStudentEmail(email);
    if (studentAction === 'register') {
      setRegName(name);
      setRegDegree(deg);
      setRegBranch(br);
      setRegSemester(sem);
      setRegCgpa(gpa);
    }
    setError(null);
  };

  // Preset quick fill for faculty
  const fillFacultyPreset = (u, p) => {
    setFacultyUsername(u);
    setFacultyPassword(p);
    setError(null);
  };

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (studentAction === 'login') {
        const data = await studentLogin({
          registrationNumber: regNo.trim(),
          email: studentEmail.trim(),
        });
        onAuthSuccess({
          user: data.user,
          student: data.student,
          role: 'STUDENT',
        });
        onClose();
      } else {
        const data = await studentRegister({
          registrationNumber: regNo.trim(),
          email: studentEmail.trim(),
          name: regName.trim(),
          degree: regDegree,
          branch: regBranch,
          semester: Number(regSemester),
          cgpa: Number(regCgpa),
        });
        onAuthSuccess({
          user: data.user,
          student: data.student,
          role: 'STUDENT',
        });
        onClose();
      }
    } catch (err) {
      setError(err.message || 'Authentication failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleFacultySubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const data = await facultyLogin({
        username: facultyUsername.trim(),
        password: facultyPassword,
      });
      onAuthSuccess({
        user: data.user,
        student: null,
        role: data.role || 'INSTRUCTOR',
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Invalid username or password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-6 pb-4 border-b border-slate-800 flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
                <ShieldCheck className="w-5 h-5" />
              </span>
              <h2 className="text-lg font-bold text-slate-100">
                University Portal Authentication
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Unified login system with direct verification (no external OTP required).
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Mode Selector Tab */}
        <div className="grid grid-cols-2 p-2 bg-slate-950/70 border-b border-slate-800 text-xs font-semibold">
          <button
            onClick={() => {
              setMode('student');
              setError(null);
            }}
            className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl transition-all ${
              mode === 'student'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <GraduationCap className="w-4 h-4" />
            <span>Student Portal (Reg No &amp; Email)</span>
          </button>

          <button
            onClick={() => {
              setMode('faculty');
              setError(null);
            }}
            className={`flex items-center justify-center space-x-2 py-2.5 rounded-xl transition-all ${
              mode === 'faculty'
                ? 'bg-indigo-600 text-white shadow'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>Faculty &amp; Admin (User ID &amp; Password)</span>
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {mode === 'student' ? (
            <div className="space-y-4">
              {/* Action toggle (Login vs Register) */}
              <div className="flex items-center justify-between bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setStudentAction('login');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    studentAction === 'login'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Student Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStudentAction('register');
                    setError(null);
                  }}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                    studentAction === 'register'
                      ? 'bg-slate-800 text-slate-100'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Register New Student
                </button>
              </div>

              {/* Demo Pre-fills */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Demo Student Accounts (Click to Fill)</span>
                  <span className="text-emerald-400 font-normal normal-case">No OTP needed</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      fillStudentPreset(
                        'STU-2026-001',
                        'alex.rivera@university.edu',
                        'Alex Rivera',
                        'B.Tech',
                        'CSE',
                        5,
                        8.85
                      )
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-200 transition-colors"
                  >
                    Alex Rivera (CSE Sem 5)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      fillStudentPreset(
                        'STU-2026-002',
                        'jordan.lee@university.edu',
                        'Jordan Lee',
                        'B.Tech',
                        'Data Science',
                        3,
                        7.65
                      )
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-200 transition-colors"
                  >
                    Jordan Lee (DS Sem 3)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      fillStudentPreset(
                        'STU-2026-003',
                        'maya.patel@university.edu',
                        'Maya Patel',
                        'M.Tech',
                        'Electrical',
                        7,
                        9.20
                      )
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-200 transition-colors"
                  >
                    Maya Patel (M.Tech Sem 7)
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      fillStudentPreset(
                        'STU-2026-004',
                        'sam.wilson@university.edu',
                        'Sam Wilson',
                        'B.Tech',
                        'Mechanical',
                        5,
                        7.10
                      )
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 rounded-lg text-xs text-slate-200 transition-colors"
                  >
                    Sam Wilson (Mech Sem 5)
                  </button>
                </div>
              </div>

              <form onSubmit={handleStudentSubmit} className="space-y-3.5">
                {studentAction === 'register' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Full Student Name
                    </label>
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Alex Rivera"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Registration Number
                    </label>
                    <input
                      type="text"
                      required
                      value={regNo}
                      onChange={(e) => setRegNo(e.target.value)}
                      placeholder="e.g. STU-2026-001"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      University Email
                    </label>
                    <input
                      type="email"
                      required
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="e.g. alex.rivera@university.edu"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {studentAction === 'register' && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Degree
                      </label>
                      <select
                        value={regDegree}
                        onChange={(e) => setRegDegree(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="B.Tech">B.Tech</option>
                        <option value="M.Tech">M.Tech</option>
                        <option value="Dual Degree">Dual Degree</option>
                        <option value="Ph.D.">Ph.D.</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Branch
                      </label>
                      <select
                        value={regBranch}
                        onChange={(e) => setRegBranch(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="CSE">CSE</option>
                        <option value="Data Science">Data Science</option>
                        <option value="Mechanical">Mechanical</option>
                        <option value="Electrical">Electrical</option>
                        <option value="ECE">ECE</option>
                        <option value="Civil">Civil</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Semester
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={regSemester}
                        onChange={(e) => setRegSemester(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        CGPA (Scale 10)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="10"
                        value={regCgpa}
                        onChange={(e) => setRegCgpa(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading || !regNo || !studentEmail}
                  className="w-full mt-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg disabled:opacity-50"
                >
                  {loading
                    ? 'Processing...'
                    : studentAction === 'login'
                    ? 'Sign In (Instant Access)'
                    : 'Register Profile & Sign In'}
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Faculty Demo Preset Credentials */}
              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 space-y-1.5">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Pre-Seeded Demo Faculty Credentials</span>
                  <span className="text-amber-400 font-normal normal-case">Secured in Backend</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <button
                    type="button"
                    onClick={() => fillFacultyPreset('faculty_cs', 'faculty123')}
                    className="p-2 text-left bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700/60 transition-colors"
                  >
                    <div className="font-semibold text-slate-200">Dr. Ada Lovelace (CS)</div>
                    <div className="text-[11px] text-slate-400 font-mono">faculty_cs / faculty123</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillFacultyPreset('faculty_ds', 'faculty123')}
                    className="p-2 text-left bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700/60 transition-colors"
                  >
                    <div className="font-semibold text-slate-200">Dr. Florence Nightingale (DS)</div>
                    <div className="text-[11px] text-slate-400 font-mono">faculty_ds / faculty123</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillFacultyPreset('faculty_mech', 'faculty123')}
                    className="p-2 text-left bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700/60 transition-colors"
                  >
                    <div className="font-semibold text-slate-200">Prof. James Watt (Mech)</div>
                    <div className="text-[11px] text-slate-400 font-mono">faculty_mech / faculty123</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => fillFacultyPreset('faculty_admin', 'admin123')}
                    className="p-2 text-left bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700/60 transition-colors"
                  >
                    <div className="font-semibold text-amber-300">Dean of Academics (Admin)</div>
                    <div className="text-[11px] text-slate-400 font-mono">faculty_admin / admin123</div>
                  </button>
                </div>
              </div>

              <form onSubmit={handleFacultySubmit} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Faculty User ID / Username
                  </label>
                  <input
                    type="text"
                    required
                    value={facultyUsername}
                    onChange={(e) => setFacultyUsername(e.target.value)}
                    placeholder="e.g. faculty_cs"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    required
                    value={facultyPassword}
                    onChange={(e) => setFacultyPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !facultyUsername || !facultyPassword}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors shadow-lg disabled:opacity-50"
                >
                  {loading ? 'Authenticating...' : 'Sign In to Faculty Portal'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
