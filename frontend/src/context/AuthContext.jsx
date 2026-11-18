import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCurrentAuthUser, loginUser, studentRegister, logoutUser, updateStudentProfile } from '../api/coursesApi';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [student, setStudent] = useState(null);
  const [role, setRole] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  // Initialize auth state from stored token
  useEffect(() => {
    async function initAuth() {
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

  const login = async ({ identifier, password }) => {
    const data = await loginUser({ identifier, password });
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
        loading,
        login,
        register,
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
