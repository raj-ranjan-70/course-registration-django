import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import FacultyDashboard from './FacultyDashboard';
import StudentDashboard from './StudentDashboard';
import { GraduationCap } from 'lucide-react';

export default function DashboardRouter() {
  const { isAuthenticated, isFaculty, isStudent, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F9F8F6] flex flex-col items-center justify-center text-[#192A24]">
        <div className="w-12 h-12 rounded-2xl bg-[#1B4D3E] text-white flex items-center justify-center shadow-sm animate-pulse mb-4">
          <GraduationCap className="w-6 h-6" />
        </div>
        <div className="text-sm font-semibold tracking-tight text-[#192A24]">
          Verifying Session Permissions...
        </div>
        <p className="text-xs text-stone-500 mt-1">
          Validating cryptographic JSON Web Token payload
        </p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Internal routing based on user's role and permissions
  if (isFaculty) {
    return <FacultyDashboard />;
  }

  if (isStudent) {
    return <StudentDashboard />;
  }

  // Fallback if role is unassigned
  return <StudentDashboard />;
}
