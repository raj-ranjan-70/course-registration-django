import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import TurnstileWidget from '../components/TurnstileWidget';
import {
  GraduationCap,
  ShieldCheck,
  UserCheck,
  ArrowRight,
  Lock,
  Mail,
  AlertCircle,
  Sparkles,
  ShieldAlert,
} from 'lucide-react';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, isAuthenticated } = useAuth();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [resetSignal, setResetSignal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY || '0x4AAAAAAGTvoqsC6gfPnUJn';
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

  // Check URL parameters for OAuth redirect errors
  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      if (errorParam === 'GoogleAuthCancelled') {
        setError('Google sign-in was cancelled. Please try again.');
      } else if (errorParam === 'GitHubAuthFailed') {
        setError('GitHub sign-in was cancelled or failed. Please try again.');
      } else if (errorParam === 'InvalidOAuthState') {
        setError('Security check failed (OAuth state mismatch). Please initiate login again.');
      } else {
        setError(`Authentication notice: ${errorParam}. Please try again.`);
      }
    }
  }, [searchParams]);

  // If already logged in, redirect to dashboard
  useEffect(() => {
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

    if (!turnstileToken) {
      setError('Please complete the Cloudflare security verification before signing in.');
      return;
    }

    setLoading(true);
    try {
      await login({
        identifier: identifier.trim(),
        password,
        cf_turnstile_token: turnstileToken,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed. Please verify your credentials.');
      // Reset Turnstile widget on failed attempt
      setTurnstileToken('');
      setResetSignal((prev) => prev + 1);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = (provider) => {
    if (provider === 'google') {
      window.location.href = `${apiBaseUrl}/api/auth/google/login/`;
    } else if (provider === 'github') {
      window.location.href = `${apiBaseUrl}/api/auth/github/login/`;
    }
  };

  const fillDemoAccount = (demoId, demoPass) => {
    setIdentifier(demoId);
    setPassword(demoPass);
    setError('');
    // For local convenience with demo accounts, if in development, provide testing token if turnstile not yet clicked
    if (!turnstileToken) {
      setTurnstileToken('test-token');
    }
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
                Gale-Shapley Matching
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
                Turnstile &amp; OAuth 2.0 Protected
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#192A24]">
                Sign In to Portal
              </h1>
              <p className="text-sm text-stone-600 mt-1.5">
                Log in via your university ID or OAuth provider to access course registration.
              </p>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Social OAuth Buttons */}
            <div className="space-y-2.5 mb-5">
              {/* Google Button */}
              <button
                type="button"
                onClick={() => handleOAuthLogin('google')}
                className="w-full py-2.5 px-4 rounded-xl border border-[#E0DCD3] bg-white hover:bg-stone-50 font-medium text-xs text-stone-700 transition-all shadow-2xs flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              {/* GitHub Button */}
              <button
                type="button"
                onClick={() => handleOAuthLogin('github')}
                className="w-full py-2.5 px-4 rounded-xl border border-stone-800 bg-[#24292F] hover:bg-[#1B1F23] font-medium text-xs text-white transition-all shadow-2xs flex items-center justify-center gap-2.5 cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>Continue with GitHub</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5E0D8]" />
              </div>
              <div className="relative flex justify-center text-[11px] uppercase tracking-wider">
                <span className="bg-white px-3 text-stone-400 font-semibold">
                  Or sign in with ID &amp; Password
                </span>
              </div>
            </div>

            {/* Manual Credentials Form */}
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

              {/* Cloudflare Turnstile Widget */}
              <div className="pt-1">
                <TurnstileWidget
                  siteKey={turnstileSiteKey}
                  onVerify={(token) => {
                    setTurnstileToken(token);
                    setError('');
                  }}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => {
                    setTurnstileToken('');
                    setError('Turnstile security verification encountered an issue. Please retry.');
                  }}
                  resetSignal={resetSignal}
                />
                {!turnstileToken && (
                  <p className="text-[11px] text-center text-stone-400">
                    Verification required before sign in
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading || !turnstileToken}
                className="w-full mt-2 py-3 px-4 rounded-xl font-medium text-sm text-white bg-[#1B4D3E] hover:bg-[#2E6F5A] focus:outline-none focus:ring-2 focus:ring-[#1B4D3E]/30 active:scale-[0.99] transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
                <span className="font-mono text-stone-400">Turnstile enforced</span>
              </div>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#E5E0D8] bg-[#F9F8F6] py-4 text-center text-xs text-stone-500">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>University Course Registration &amp; Elective Allocation System</span>
          <span>Cloudflare Turnstile &bull; Google OAuth &bull; GitHub OAuth &bull; JWT Secured</span>
        </div>
      </footer>
    </div>
  );
}
