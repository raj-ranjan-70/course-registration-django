import React, { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, UserCheck, ShieldCheck, ArrowRight, AlertCircle, Sparkles, BookOpen } from 'lucide-react';

export default function CompleteProfilePage() {
  const navigate = useNavigate();
  const { user, isAuthenticated, profileCompleted, completeStudentProfile, loading } = useAuth();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [regNo, setRegNo] = useState('');
  const [degree, setDegree] = useState('B.Tech');
  const [branch, setBranch] = useState('Computer Science');
  const [semester, setSemester] = useState(5);
  const [cgpa, setCgpa] = useState(8.5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      const fullName =
        (user.first_name || user.last_name)
          ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
          : user.username || '';
      setName(fullName);
      setEmail(user.email || '');
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] flex flex-col items-center justify-center text-[#192A24]">
        <div className="w-12 h-12 rounded-2xl bg-[#1B4D3E] text-white flex items-center justify-center shadow-sm animate-pulse mb-4">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div className="text-sm font-semibold tracking-tight text-[#192A24]">
          Loading profile...
        </div>
      </div>
    );
  }

  // Route guard: must be authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If profile is already completed, go straight to dashboard
  if (profileCompleted) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!name.trim()) {
      setError('Please provide your full legal name.');
      return;
    }
    if (!regNo.trim()) {
      setError('Please provide your official university registration number.');
      return;
    }

    setSubmitting(true);
    try {
      await completeStudentProfile({
        name: name.trim(),
        registration_number: regNo.trim(),
        degree,
        branch,
        semester: Number(semester),
        cgpa: parseFloat(cgpa),
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Failed to complete profile. Please verify your registration details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#192A24] flex flex-col justify-between selection:bg-[#1B4D3E] selection:text-white">
      {/* Top Header */}
      <header className="border-b border-[#E5E0D8] bg-[#F9F8F6]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1B4D3E] text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-base tracking-tight text-[#192A24]">
                Academic Portal
              </span>
              <p className="text-xs text-stone-500">Student Profile Setup</p>
            </div>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
            Step 2 of 2: Profile Completion
          </span>
        </div>
      </header>

      {/* Main Content Card */}
      <main className="flex-1 flex items-center justify-center p-6 my-6">
        <div className="max-w-xl w-full bg-white rounded-3xl border border-[#E5E0D8] shadow-sm p-8 sm:p-10 space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F5E9] text-[#1B4D3E] flex items-center justify-center mx-auto border border-[#C8E6C9]">
              <UserCheck className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#192A24]">
              Complete Your Student Profile
            </h1>
            <p className="text-xs text-stone-600 max-w-md mx-auto leading-relaxed">
              Welcome! You have authenticated successfully. Please provide your university registration number and academic attributes to access elective registration.
            </p>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-xs flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <div className="flex-1">{error}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {/* Full Name */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1.5">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. John Doe"
                required
                className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E] transition-colors"
              />
            </div>

            {/* University Email (Read-Only) */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1.5">
                Authenticated Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-3.5 py-2.5 bg-[#F3F1EC] border border-[#E0DCD3] rounded-xl text-sm font-medium text-stone-500 cursor-not-allowed"
              />
              <span className="text-[11px] text-stone-400 mt-1 block">
                Verified via your OAuth provider account.
              </span>
            </div>

            {/* Registration Number */}
            <div>
              <label className="block font-semibold text-stone-700 mb-1.5">
                University Registration Number *
              </label>
              <input
                type="text"
                value={regNo}
                onChange={(e) => setRegNo(e.target.value)}
                placeholder="e.g. REG2026099"
                required
                className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-mono font-medium focus:outline-none focus:border-[#1B4D3E] transition-colors"
              />
              <span className="text-[11px] text-stone-500 mt-1 block">
                Official student identifier used for course rosters and matching.
              </span>
            </div>

            {/* Degree and Branch */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1.5">
                  Degree
                </label>
                <select
                  value={degree}
                  onChange={(e) => setDegree(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E]"
                >
                  <option value="B.Tech">B.Tech</option>
                  <option value="M.Tech">M.Tech</option>
                  <option value="Dual Degree">Dual Degree</option>
                  <option value="B.Sc">B.Sc</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1.5">
                  Branch / Major
                </label>
                <select
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E]"
                >
                  <option value="Computer Science">Computer Science</option>
                  <option value="Electrical Engineering">Electrical Engineering</option>
                  <option value="Mechanical Engineering">Mechanical Engineering</option>
                  <option value="Data Science">Data Science</option>
                  <option value="Civil Engineering">Civil Engineering</option>
                </select>
              </div>
            </div>

            {/* Semester and CGPA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-stone-700 mb-1.5">
                  Current Semester (1-8)
                </label>
                <input
                  type="number"
                  min="1"
                  max="8"
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E]"
                />
              </div>

              <div>
                <label className="block font-semibold text-stone-700 mb-1.5">
                  Cumulative CGPA (0.00 - 10.00)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="10"
                  value={cgpa}
                  onChange={(e) => setCgpa(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm font-medium focus:outline-none focus:border-[#1B4D3E]"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 px-4 rounded-xl bg-[#1B4D3E] hover:bg-[#2E6F5A] text-white text-sm font-semibold shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Complete Profile &amp; Go to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E0D8] bg-[#F9F8F6] py-4 text-center text-xs text-stone-500">
        Elective Course Allocation System &bull; Secure Academic Portal
      </footer>
    </div>
  );
}
