import React, { useState, useEffect } from 'react';
import {
  Play,
  RotateCw,
  Award,
  Hash,
  Clock,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ShieldCheck,
  TrendingUp,
  Search,
  Filter,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  getAllocationRuns,
  getAllocationRunDetail,
  triggerAllocationRun,
} from '../api/coursesApi';
import AlertBanner from './AlertBanner';

export default function AdminAllocationDashboard() {
  const [runs, setRuns] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [notification, setNotification] = useState(null);

  // Form inputs
  const [term, setTerm] = useState('Fall 2026');
  const [seed, setSeed] = useState('audit-seed-2026-fall');
  const [applyEnrollment, setApplyEnrollment] = useState(false);

  // Table filter state
  const [searchFilter, setSearchFilter] = useState('');
  const [matchFilter, setMatchFilter] = useState('all'); // all, matched, unmatched

  // Load runs list
  const loadRuns = async (selectLatest = false) => {
    try {
      setLoading(true);
      const data = await getAllocationRuns();
      setRuns(data);

      if (data && data.length > 0) {
        const targetId = selectLatest ? data[0].id : (selectedRun?.id || data[0].id);
        const detail = await getAllocationRunDetail(targetId);
        setSelectedRun(detail);
      } else {
        setSelectedRun(null);
      }
    } catch (err) {
      console.error('Failed to load allocation runs:', err);
      setNotification({
        type: 'error',
        message: 'Failed to load runs',
        detail: err.message,
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  // Select a run from history
  const handleSelectRun = async (runId) => {
    try {
      const detail = await getAllocationRunDetail(runId);
      setSelectedRun(detail);
    } catch (err) {
      console.error('Failed to load run detail:', err);
    }
  };

  // Generate random seed
  const generateNewSeed = () => {
    const randomHex = Math.random().toString(16).substring(2, 10);
    setSeed(`seed-audit-${Date.now().toString().slice(-4)}-${randomHex}`);
  };

  // Execute Allocation Run
  const handleRunAllocation = async () => {
    try {
      setExecuting(true);
      setNotification(null);

      const resp = await triggerAllocationRun({
        term,
        seed,
        applyEnrollment,
      });

      setNotification({
        type: 'success',
        message: resp.message || 'Allocation Run Completed!',
        detail: `Executed Gale-Shapley matching for ${resp.run?.total_students} students with SHA-256 seed '${resp.run?.seed}'.`,
      });

      // Reload runs list and select new run
      await loadRuns(true);
    } catch (err) {
      console.error('Execution failed:', err);
      setNotification({
        type: 'error',
        message: 'Allocation Execution Failed',
        detail: err.message,
      });
    } finally {
      setExecuting(false);
    }
  };

  // Filtered results in selected run
  const filteredResults = React.useMemo(() => {
    if (!selectedRun?.results) return [];

    return selectedRun.results.filter((res) => {
      if (matchFilter === 'matched' && !res.matched) return false;
      if (matchFilter === 'unmatched' && res.matched) return false;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesStudent = res.student_id?.toLowerCase().includes(q) || res.student_name?.toLowerCase().includes(q);
        const matchesCourse = res.course_code?.toLowerCase().includes(q) || res.course_title?.toLowerCase().includes(q);
        if (!matchesStudent && !matchesCourse) return false;
      }

      return true;
    });
  }, [selectedRun, searchFilter, matchFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Banner */}
      <AlertBanner notification={notification} onClose={() => setNotification(null)} />

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600/30 text-indigo-400 rounded-xl border border-indigo-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-bold text-slate-100">
              Fair Elective Allocation Engine (Gale-Shapley)
            </h1>
          </div>
          <p className="text-xs text-slate-400 max-w-3xl leading-relaxed">
            Batch matching engine powered by the student-proposing Deferred Acceptance algorithm with
            deterministic priority scoring (Cohort, Major Bonus, CGPA) and SHA-256 reproducible tiebreakers.
          </p>
        </div>

        <button
          onClick={() => loadRuns()}
          title="Refresh History"
          className="self-start md:self-center p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors border border-slate-700"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Main 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Run Controls & Run History */}
        <div className="space-y-6">
          {/* Run Configuration Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
            <h2 className="text-sm font-bold text-slate-200 flex items-center space-x-2">
              <Play className="w-4 h-4 text-indigo-400" />
              <span>Configure Batch Allocation Run</span>
            </h2>

            {/* Term */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-400">Academic Term</label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                <option value="Fall 2026">Fall 2026</option>
                <option value="Spring 2027">Spring 2027</option>
              </select>
            </div>

            {/* Seed */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-xs">
                <label className="font-semibold text-slate-400">SHA-256 Tiebreak Seed</label>
                <button
                  type="button"
                  onClick={generateNewSeed}
                  className="text-indigo-400 hover:text-indigo-300 text-xs font-medium"
                >
                  Generate Seed
                </button>
              </div>
              <input
                type="text"
                value={seed}
                onChange={(e) => setSeed(e.target.value)}
                placeholder="e.g. audit-seed-2026-fall"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
              <p className="text-[11px] text-slate-500">
                Running with the same seed reproduces the exact same tiebreaking outcome.
              </p>
            </div>

            {/* Auto-enroll toggle */}
            <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer select-none pt-1">
              <input
                type="checkbox"
                checked={applyEnrollment}
                onChange={(e) => setApplyEnrollment(e.target.checked)}
                className="rounded border-slate-700 text-indigo-600 focus:ring-indigo-500 h-4 w-4 bg-slate-950"
              />
              <span>Auto-enroll matched students into active sections</span>
            </label>

            {/* Execute Button */}
            <button
              onClick={handleRunAllocation}
              disabled={executing}
              className="w-full inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {executing ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  <span>Executing Gale-Shapley Matching...</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>Execute Allocation Run</span>
                </>
              )}
            </button>
          </div>

          {/* Allocation Run History */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Run History ({runs.length})
            </h3>

            {runs.length === 0 ? (
              <div className="text-center py-6 text-slate-500 text-xs">
                No allocation runs recorded yet.
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                {runs.map((r) => {
                  const isSelected = selectedRun?.id === r.id;
                  return (
                    <div
                      key={r.id}
                      onClick={() => handleSelectRun(r.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between gap-2 ${
                        isSelected
                          ? 'bg-indigo-950/40 border-indigo-700 text-slate-100'
                          : 'bg-slate-950/40 border-slate-800 hover:border-slate-700 text-slate-300'
                      }`}
                    >
                      <div className="space-y-0.5 truncate">
                        <div className="font-semibold flex items-center gap-1.5">
                          <span>Run #{r.id}</span>
                          <span className="text-slate-500">•</span>
                          <span className="text-indigo-400 font-mono text-[11px] truncate max-w-[100px]">
                            {r.seed}
                          </span>
                        </div>
                        <div className="text-slate-500 text-[11px]">
                          {r.total_matched} / {r.total_students} matched ({r.satisfaction_rate}% sat)
                        </div>
                      </div>

                      <ChevronRight className="w-4 h-4 text-slate-600 shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Active Run Audit & Results */}
        <div className="lg:col-span-2 space-y-6">
          {selectedRun ? (
            <>
              {/* Stat Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-1">
                  <div className="text-slate-500 text-xs">Total Students</div>
                  <div className="text-2xl font-bold text-slate-100">{selectedRun.total_students}</div>
                  <div className="text-[11px] text-slate-500">{selectedRun.total_courses} courses ranked</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-1">
                  <div className="text-slate-500 text-xs">Total Matched</div>
                  <div className="text-2xl font-bold text-emerald-400">{selectedRun.total_matched}</div>
                  <div className="text-[11px] text-slate-500">{selectedRun.total_unmatched} unmatched</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-1">
                  <div className="text-slate-500 text-xs">Satisfaction Rate</div>
                  <div className="text-2xl font-bold text-indigo-400">
                    {selectedRun.satisfaction_rate}%
                  </div>
                  <div className="text-[11px] text-slate-500">within top 2 choices</div>
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-md space-y-1">
                  <div className="text-slate-500 text-xs">Execution Time</div>
                  <div className="text-2xl font-bold text-slate-200">
                    {selectedRun.execution_time_ms} ms
                  </div>
                  <div className="text-[11px] text-slate-500">pure Gale-Shapley</div>
                </div>
              </div>

              {/* Rank Distribution Breakdown */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-300">Preference Rank Distribution</span>
                  <span className="text-slate-500 font-mono text-[11px]">Seed: {selectedRun.seed}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-xs">
                  {Object.entries(selectedRun.rank_distribution || {}).map(([rankKey, count]) => (
                    <div
                      key={rankKey}
                      className="bg-slate-950/70 p-2.5 rounded-xl border border-slate-800 flex items-center justify-between"
                    >
                      <span className="text-slate-400">
                        {rankKey === 'unmatched' ? 'Unmatched' : `Rank #${rankKey}`}
                      </span>
                      <span className="font-bold text-slate-200">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Results & Audit Table */}
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-200">
                      Allocation Audit Log &amp; Match Results
                    </h3>
                    <p className="text-xs text-slate-500">
                      Showing student-by-student priority scores, SHA-256 tiebreaker values, and rank outcomes.
                    </p>
                  </div>

                  {/* Table Controls */}
                  <div className="flex items-center space-x-2">
                    <select
                      value={matchFilter}
                      onChange={(e) => setMatchFilter(e.target.value)}
                      className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-300"
                    >
                      <option value="all">All ({selectedRun.results?.length || 0})</option>
                      <option value="matched">Matched Only</option>
                      <option value="unmatched">Unmatched Only</option>
                    </select>
                  </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Student</th>
                        <th className="py-2.5 px-3">Cohort / CGPA</th>
                        <th className="py-2.5 px-3">Matched Course</th>
                        <th className="py-2.5 px-3 text-center">Rank</th>
                        <th className="py-2.5 px-3 text-right">Priority Score</th>
                        <th className="py-2.5 px-3 text-right">Tiebreaker</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 font-mono text-[11px]">
                      {filteredResults.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="text-center py-6 text-slate-500 font-sans">
                            No match results found.
                          </td>
                        </tr>
                      ) : (
                        filteredResults.map((res) => (
                          <tr key={res.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="py-2.5 px-3 font-sans font-semibold text-slate-200">
                              <div>{res.student_name}</div>
                              <div className="text-[10px] text-slate-500 font-mono">{res.student_id}</div>
                            </td>
                            <td className="py-2.5 px-3 font-sans text-slate-400">
                              <div>{res.student_cohort || 'General'}</div>
                              <div className="text-[10px] text-slate-500">CGPA: {res.student_cgpa?.toFixed(2)}</div>
                            </td>
                            <td className="py-2.5 px-3 font-sans">
                              {res.matched ? (
                                <div>
                                  <span className="font-bold text-slate-200">{res.course_code}</span>
                                  <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                                    {res.course_title}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-rose-400 italic">Unmatched</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-sans">
                              {res.preference_rank ? (
                                <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-semibold border border-indigo-800/60">
                                  #{res.preference_rank}
                                </span>
                              ) : (
                                <span className="text-slate-600">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-indigo-300">
                              {res.priority_score?.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-3 text-right text-slate-400">
                              {res.tiebreaker_value?.toFixed(6)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
              <Award className="w-10 h-10 mx-auto text-slate-600" />
              <p className="font-medium text-sm text-slate-300">No allocation run selected.</p>
              <p className="text-xs">
                Configure a seed on the left and click "Execute Allocation Run" to generate matching results.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
