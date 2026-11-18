import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardRouter from './pages/DashboardRouter';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Dedicated Login Page */}
          <Route path="/login" element={<LoginPage />} />

          {/* Dedicated Student Registration Page */}
          <Route path="/register" element={<RegisterPage />} />

          {/* Shared URL for dashboards (routes internally to Student or Faculty Dashboard based on role/permissions) */}
          <Route path="/dashboard" element={<DashboardRouter />} />

          {/* Fallback & Root redirect to /dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
