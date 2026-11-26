import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  getCurrentAuthUser,
  loginUser,
  studentRegister,
  logoutUser,
  updateStudentProfile,
  completeProfile,
} from '../api/coursesApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [student, setStudent] = useState(null);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from stored token or OAuth URL parameters
  useEffect(() => {
    async function initAuth() {
      // Check if OAuth callback passed tokens in URL params
      if (typeof window !== 'undefined' && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        const urlToken = params.get('token');
        const urlRefresh = params.get('refresh');
        if (urlToken) {
          localStorage.setItem('access_token', urlToken);
          if (urlRefresh) {
            localStorage.setItem('refresh_token', urlRefresh);
          }
          params.delete('token');
          params.delete('refresh');
          const newSearch = params.toString();
          const cleanUrl = window.location.pathname + (newSearch ? `?${newSearch}` : '') + window.location.hash;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      }

      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await getCurrentAuthUser();
        if (data && data.authenticated) {
          setUser(data.user);
          setRole(data.role);
          setPermissions(data.permissions || []);
          if (data.student) {
            setStudent(data.student);
          }
        } else {
          // Token invalid or session expired
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          setUser(null);
          setStudent(null);
          setRole(null);
          setPermissions([]);
        }
      } catch (err) {
        console.warn('Authentication verification failed:', err.message);
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        setStudent(null);
        setRole(null);
        setPermissions([]);
      } finally {
        setLoading(false);
      }
    }

    initAuth();
  }, []);

  const login = async ({ identifier, password, cf_turnstile_token }) => {
    const data = await loginUser({ identifier, password, cf_turnstile_token });
    if (data.access) {
      localStorage.setItem('access_token', data.access);
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh);
      }
      setUser(data.user);
      setRole(data.role);
      setPermissions(data.permissions || []);
      if (data.student) {
        setStudent(data.student);
      }
    }
    return data;
  };

  const register = async (studentData) => {
    const data = await studentRegister(studentData);
    if (data.access) {
      localStorage.setItem('access_token', data.access);
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh);
      }
      setUser(data.user);
      setRole(data.role || 'STUDENT');
      setPermissions(data.permissions || ['can_submit_preferences', 'can_view_results', 'can_edit_profile']);
      if (data.student) {
        setStudent(data.student);
      }
    }
    return data;
  };

  const completeStudentProfile = async (profileData) => {
    const data = await completeProfile(profileData);
    if (data.access) {
      localStorage.setItem('access_token', data.access);
      if (data.refresh) {
        localStorage.setItem('refresh_token', data.refresh);
      }
    }
    if (data.user) {
      setUser(data.user);
      setRole(data.role || 'STUDENT');
      setPermissions(data.permissions || []);
    }
    if (data.student) {
      setStudent(data.student);
    }
    return data;
  };

  const logout = async () => {
    try {
      await logoutUser();
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      setUser(null);
      setStudent(null);
      setRole(null);
      setPermissions([]);
    }
  };

  const updateProfile = async (profileData) => {
    const result = await updateStudentProfile(profileData);
    if (result.student) {
      setStudent(result.student);
    }
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        student,
        role,
        permissions,
        isAuthenticated: !!user,
        isFaculty: role === 'FACULTY' || role === 'INSTRUCTOR' || role === 'ADMIN',
        isStudent: role === 'STUDENT',
        profileCompleted: user ? user.profile_completed !== false : true,
        loading,
        login,
        register,
        completeStudentProfile,
        logout,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
