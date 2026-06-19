'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

const SIDEBAR_COLLAPSED_KEY = 'iwms_sidebar_collapsed';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/management', label: 'Management', icon: 'management', roles: ['super_admin', 'admin', 'manager'] },
  { href: '/tasks', label: 'Tasks', icon: 'tasks', roles: ['super_admin', 'admin', 'manager', 'team_lead', 'employee'] },
  { href: '/attendance', label: 'Attendance', icon: 'attendance', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/attendance-dashboard', label: 'Att. Dashboard', icon: 'reports', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/timesheets', label: 'Timesheets', icon: 'weeklyReports', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/overtime', label: 'Overtime', icon: 'overtime', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/leave', label: 'Leave', icon: 'leave', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/holidays', label: 'Holiday Calendar', icon: 'calendar', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/team', label: 'Team', icon: 'team', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/presence', label: 'Team Presence', icon: 'presence', roles: ['super_admin', 'admin', 'hr_manager', 'manager'] },
  { href: '/weekly-reports', label: 'Weekly Reports', icon: 'weeklyReports', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/reports', label: 'Analytics', icon: 'reports', roles: ['super_admin', 'admin', 'hr_manager', 'manager'] },
  { href: '/settings', label: 'Settings', icon: 'settings', roles: ['super_admin', 'admin'] },
];

const ICONS: Record<string, React.ReactNode> = {
  management: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3v18h18"/><path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3"/>
    </svg>
  ),
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  ),
  tasks: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  ),
  attendance: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  overtime: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/><path d="M16 2l4 4-4 4"/>
    </svg>
  ),
  leave: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  ),
  calendar: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
      <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  team: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/>
      <path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  weeklyReports: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/>
      <line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  ),
  presence: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M6.3 6.3a8 8 0 000 11.4"/>
      <path d="M17.7 6.3a8 8 0 010 11.4"/>
      <path d="M3 3a14 14 0 000 18"/>
      <path d="M21 3a14 14 0 010 18"/>
    </svg>
  ),
  reports: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
    </svg>
  ),
  settings: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41"/>
    </svg>
  ),
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  admin: 'Administrator',
  hr_manager: 'HR Manager',
  manager: 'Manager',
  team_lead: 'Team Lead',
  employee: 'Employee',
};

const ROLE_COLORS: Record<string, string> = {
  super_admin: '#ef4444',
  admin: '#6366f1',
  hr_manager: '#f59e0b',
  manager: '#8b5cf6',
  team_lead: '#06b6d4',
  employee: '#10b981',
};

// ChevronLeft icon
const ChevronLeft = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

// ChevronRight icon
const ChevronRight = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  // localStorage-backed collapse state; defaults to false (expanded)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
    }
    return false;
  });

  // Persist collapse state
  const handleToggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }, []);

  // Close mobile sidebar when a nav item is clicked
  const handleNavClick = useCallback(() => {
    document.body.classList.remove('mobile-sidebar-open');
  }, []);

  if (!user) return null;

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside
      className={`sidebar${collapsed ? ' sidebar-collapsed' : ''}`}
      aria-label="Main navigation"
    >
      {/* Header */}
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg width="28" height="28" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="url(#sidebarLogoGrad)"/>
              <path d="M8 16L14 22L24 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              <defs>
                <linearGradient id="sidebarLogoGrad" x1="0" y1="0" x2="32" y2="32">
                  <stop stopColor="#6366f1"/>
                  <stop offset="1" stopColor="#8b5cf6"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          {!collapsed && <span className="logo-text">IWMS</span>}
        </div>

        <button
          className="collapse-btn"
          onClick={handleToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight /> : <ChevronLeft />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Primary">
        {visibleNav.map(item => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={handleNavClick}
              className={`nav-item${isActive ? ' nav-item-active' : ''}`}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <span className="nav-icon" aria-hidden="true">
                {ICONS[item.icon]}
              </span>
              {!collapsed && <span className="nav-label">{item.label}</span>}
              {isActive && <span className="nav-active-indicator" aria-hidden="true"/>}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <div className="user-card">
          <div
            className="user-avatar"
            style={{
              background: `${ROLE_COLORS[user.role]}33`,
              border: `2px solid ${ROLE_COLORS[user.role]}66`,
              flexShrink: 0,
            }}
          >
            <span style={{ color: ROLE_COLORS[user.role] }}>{user.avatar}</span>
          </div>
          {!collapsed && (
            <div className="user-info">
              <p className="user-name">{user.name}</p>
              <p className="user-role" style={{ color: ROLE_COLORS[user.role] }}>
                {ROLE_LABELS[user.role]}
              </p>
            </div>
          )}
        </div>
        <button
          className="logout-btn"
          onClick={handleLogout}
          title="Sign out"
          aria-label="Sign out"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/>
            <polyline points="16 17 21 12 16 7"/>
            <line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
        </button>
      </div>
    </aside>
  );
}
