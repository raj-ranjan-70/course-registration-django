import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap, ShieldCheck, UserCheck, ArrowRight, Lock, Mail, AlertCircle, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect to dashboard
  React.useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!identifier.trim() || !password) {
      setError('Please enter your university email / registration number and password.');
      return;
    }

    setLoading(true);
    try {
      await login({ identifier: identifier.trim(), password });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemoAccount = (demoId, demoPass) => {
    setIdentifier(demoId);
    setPassword(demoPass);
    setError('');
  };

  const demoAccounts = [
    {
      role: 'Faculty',
      badge: 'Faculty Member',
      name: 'Dr. Alan Turing',
      id: 'faculty1@univ.edu',
      pass: 'Password@123',
      sub: 'CS Dept & Allocation Lead',
      icon: ShieldCheck,
      color: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
    },
    {
      role: 'Faculty',
      badge: 'Faculty Member',
      name: 'Dr. Grace Hopper',
      id: 'faculty2@univ.edu',
      pass: 'Password@123',
      sub: 'Engineering Faculty',
      icon: ShieldCheck,
      color: 'border-emerald-200 bg-emerald-50/70 text-emerald-900',
    },
    {
      role: 'Student',
      badge: 'Student (CSE)',
      name: 'Alice Chen',
      id: 'student1@univ.edu',
      regNo: 'REG2026001',
      pass: 'Password@123',
      sub: 'Sem 5 • CGPA 8.90',
      icon: GraduationCap,
      color: 'border-stone-300 bg-white text-stone-900',
    },
    {
      role: 'Student',
      badge: 'Student (ECE)',
      name: 'Bob Miller',
      id: 'student2@univ.edu',
      regNo: 'REG2026002',
      pass: 'Password@123',
      sub: 'Sem 5 • CGPA 8.20',
      icon: GraduationCap,
      color: 'border-stone-300 bg-white text-stone-900',
    },
  ];

  return (
    <div className="min-h-screen bg-[#F9F8F6] text-[#192A24] flex flex-col justify-between selection:bg-[#1B4D3E] selection:text-white">
      {/* Top Header Bar */}
      <header className="border-b border-[#E5E0D8] bg-[#F9F8F6]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#1B4D3E] text-white flex items-center justify-center shadow-sm">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="font-semibold text-base tracking-tight text-[#192A24]">
                University Elective Portal
              </span>
              <span className="hidden sm:inline-block ml-2 text-xs font-medium px-2 py-0.5 rounded-full bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9]">
                Gale-Shapley DA
              </span>
            </div>
          </div>
          <Link
            to="/register"
            className="text-xs sm:text-sm font-medium text-[#1B4D3E] hover:text-[#2E6F5A] px-3.5 py-1.5 rounded-md hover:bg-[#E8F5E9] transition-colors border border-transparent hover:border-[#C8E6C9]"
          >
            Student Registration &rarr;
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8">
        <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left Form Column */}
          <div className="lg:col-span-7 bg-white rounded-2xl border border-[#E5E0D8] shadow-sm p-6 sm:p-8">
            <div className="mb-6">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#1B4D3E] border border-[#C8E6C9] mb-3">
                <ShieldCheck className="w-3.5 h-3.5" />
                JWT Secured Session
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A24]">
                Sign In to Portal
              </h1>
              <p className="text-sm text-stone-600 mt-1.5">
                Access the faculty elective dashboard or your student preference ranking.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600 mb-1.5">
                  Email, Username, or Reg Number
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. faculty1@univ.edu or REG2026001"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] transition-all placeholder:text-stone-400 font-medium"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-stone-600">
                    Password
                  </label>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your account password"
                    className="w-full pl-10 pr-4 py-2.5 bg-[#FAF9F7] border border-[#E0DCD3] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/20 focus:border-[#1B4D3E] transition-all placeholder:text-stone-400 font-medium"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-[#1B4D3E] hover:bg-[#2E6F5A] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/30 active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    Sign In to Dashboard
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-6 pt-5 border-t border-[#EFECE6] flex items-center justify-between text-xs text-stone-500">
              <span>Need a new student account?</span>
              <Link to="/register" className="font-semibold text-[#1B4D3E] hover:underline">
                Create Student Account &rarr;
              </Link>
            </div>
          </div>

          {/* Right Demo Accounts Column */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-[#F3F1EC] rounded-2xl border border-[#E2DDD5] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-[#1B4D3E]" />
                <h2 className="text-sm font-semibold tracking-tight text-[#192A24]">
                  Demo University Accounts
                </h2>
              </div>
              <p className="text-xs text-stone-600 mb-4 leading-relaxed">
                Click any pre-seeded credential below to instantly load it into the login form.
              </p>

              <div className="space-y-2.5">
                {demoAccounts.map((acc) => {
                  const Icon = acc.icon;
                  const isSelected = identifier === acc.id || identifier === acc.regNo;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => fillDemoAccount(acc.id, acc.pass)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer flex items-start gap-3 ${
                        isSelected
                          ? 'border-[#1B4D3E] bg-white ring-2 ring-[#1B4D3E]/20 shadow-xs'
                          : 'border-[#E0DCD3] bg-white/80 hover:bg-white hover:border-[#1B4D3E]/50'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-[#E8F5E9] text-[#1B4D3E] flex items-center justify-center shrink-0 mt-0.5 border border-[#C8E6C9]">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-[#192A24] truncate">
                            {acc.name}
                          </span>
                          <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-stone-100 text-stone-700 border border-stone-200">
                            {acc.role}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-stone-600 mt-0.5 truncate">
                          {acc.id}
                        </div>
                        <div className="text-[10px] text-stone-500 mt-0.5 flex items-center justify-between">
                          <span>{acc.sub}</span>
                          <span className="font-mono text-stone-400">Pass: {acc.pass}</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 pt-3 border-t border-[#E5E0D8] text-[11px] text-stone-500 flex items-center justify-between">
                <span>Database seeded: strictly 4 accounts</span>
                <span className="font-mono text-stone-400">Zero mock courses</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E0D8] bg-[#F9F8F6] py-4 text-center text-xs text-stone-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>University Course Registration &amp; Elective Allocation System</span>
          <span>Light Mode &bull; Forest Green Palette &bull; Gale-Shapley Matching</span>
        </div>
      </footer>
    </div>
  );
}
