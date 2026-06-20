'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, setTokens, clearTokens, getAccessToken } from '@/lib/api';

export type Role = 'super_admin' | 'admin' | 'hr_manager' | 'manager' | 'team_lead' | 'employee';

export type Permission =
  | 'view_all_dashboards' | 'manage_users' | 'assign_tasks'
  | 'approve_overtime' | 'view_biometric_data' | 'export_reports'
  | 'configure_hardware' | 'system_settings' | 'edit_attendance' | 'view_own_data';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  departmentId?: string;
  position: string;
  avatar: string;
  status: 'active' | 'inactive';
  joinDate: string;
  phone: string;
  permissions: Permission[];
  mfaEnabled?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; mfaRequired?: boolean; tempToken?: string; error?: string }>;
  loginMfa: (tempToken: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
  refreshSelf: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // On mount: try to restore session from existing token
  useEffect(() => {
    const restore = async () => {
      const token = getAccessToken();
      if (!token) { setIsLoading(false); return; }
      try {
        const userData = await authApi.me();
        setUser(userData);
        localStorage.setItem('iwms_user', JSON.stringify(userData));
      } catch {
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };
    restore();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      const data = await authApi.login(email, password);
      if (data.mfaRequired) {
        return { success: false, mfaRequired: true, tempToken: data.tempToken };
      }
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      localStorage.setItem('iwms_user', JSON.stringify(data.user));
      return { success: true };
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Login failed. Please try again.';
      return { success: false, error: msg };
    }
  }, []);

  const loginMfa = useCallback(async (tempToken: string, code: string) => {
    try {
      const data = await authApi.loginMfa(tempToken, code);
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);
      localStorage.setItem('iwms_user', JSON.stringify(data.user));
      return { success: true };
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ||
        'Verification failed. Please try again.';
      return { success: false, error: msg };
    }
  }, []);

  const logout = useCallback(() => {
    const refreshToken = localStorage.getItem('iwms_refresh_token');
    if (refreshToken) {
      authApi.logout(refreshToken).catch(() => {});
    }
    clearTokens();
    setUser(null);
  }, []);

  const refreshSelf = useCallback(async () => {
    try {
      const userData = await authApi.me();
      setUser(userData);
      localStorage.setItem('iwms_user', JSON.stringify(userData));
    } catch (err) {
      console.error('Failed to refresh user profile:', err);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: Permission) => {
      if (!user) return false;
      return user.permissions?.includes(permission) ?? false;
    },
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, isLoading, login, loginMfa, logout, hasPermission, refreshSelf }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function getPostLoginRoute(user: any): string {
  if (!user) return '/login';
  if (['super_admin', 'admin'].includes(user.role)) {
    return '/management';
  }
  const dept = (typeof user.department === 'string' ? user.department : user.department?.name || '').toLowerCase();
  if (dept.includes('hr') || dept.includes('human resource')) {
    return '/hr';
  }
  if (dept.includes('finance')) {
    return '/finance';
  }
  if (user.role === 'manager') {
    return '/department-dashboard';
  }
  return '/dashboard';
}
