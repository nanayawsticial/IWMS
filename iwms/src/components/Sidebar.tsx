'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/tasks', label: 'Tasks', icon: 'tasks', roles: ['super_admin', 'admin', 'manager', 'team_lead', 'employee'] },
  { href: '/attendance', label: 'Attendance', icon: 'attendance', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/leave', label: 'Leave', icon: 'leave', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/team', label: 'Team', icon: 'team', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/weekly-reports', label: 'Weekly Reports', icon: 'weeklyReports', roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
  { href: '/reports', label: 'Analytics', icon: 'reports', roles: ['super_admin', 'admin', 'hr_manager', 'manager'] },
  { href: '/settings', label: 'Settings', icon: 'settings', roles: ['super_admin', 'admin'] },
];

const ICONS: Record<string, React.ReactNode> = {
  dashboard: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  tasks: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  attendance: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  leave: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  team: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  weeklyReports: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  reports: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  settings: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93l-1.41 1.41M4.93 4.93l1.41 1.41M12 2v2M12 20v2M20 12h2M2 12h2M17.66 17.66l1.41 1.41M4.93 19.07l1.41-1.41"/></svg>,
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

export default function Sidebar() {
  const { user, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const visibleNav = NAV_ITEMS.filter(item => item.roles.includes(user.role));

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <div className="logo-icon">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
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
        <button className="collapse-btn" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {collapsed ? <><polyline points="9 18 15 12 9 6"/></> : <><polyline points="15 18 9 12 15 6"/></>}
          </svg>
        </button>
      </div>

      <nav className="sidebar-nav">
        {visibleNav.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${pathname.startsWith(item.href) ? 'nav-item-active' : ''}`}
            title={collapsed ? item.label : undefined}
          >
            <span className="nav-icon">{ICONS[item.icon]}</span>
            {!collapsed && <span className="nav-label">{item.label}</span>}
            {!collapsed && pathname.startsWith(item.href) && <span className="nav-active-indicator"/>}
          </Link>
        ))}
      </nav>

      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar" style={{ background: `${ROLE_COLORS[user.role]}33`, border: `2px solid ${ROLE_COLORS[user.role]}66` }}>
            <span style={{ color: ROLE_COLORS[user.role] }}>{user.avatar}</span>
          </div>
          {!collapsed && (
            <div className="user-info">
              <p className="user-name">{user.name}</p>
              <p className="user-role" style={{ color: ROLE_COLORS[user.role] }}>{ROLE_LABELS[user.role]}</p>
            </div>
          )}
        </div>
        <button className="logout-btn" onClick={handleLogout} title="Sign out">
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
