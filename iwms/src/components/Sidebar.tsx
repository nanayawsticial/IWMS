'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth, Role } from '@/lib/auth-context';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  BarChart3,
  CheckSquare,
  Clock,
  Activity,
  Calendar,
  CalendarDays,
  Timer,
  CalendarX,
  Users,
  FileText,
  BarChart,
  HeartHandshake,
  DollarSign,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const SIDEBAR_COLLAPSED_KEY = 'iwms_sidebar_collapsed';

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

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<any>;
  roles: Role[];
  departments?: string[];
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const SECTIONS: NavSection[] = [
  {
    title: 'MAIN MENU',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
      { href: '/management', label: 'Management', icon: BarChart3, roles: ['super_admin', 'admin', 'manager'] },
    ]
  },
  {
    title: 'WORKSPACE',
    items: [
      { href: '/tasks', label: 'Tasks', icon: CheckSquare, roles: ['super_admin', 'admin', 'manager', 'team_lead', 'employee'] },
      { href: '/holidays', label: 'Holiday Calendar', icon: Calendar, roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
    ]
  },
  {
    title: 'ATTENDANCE',
    items: [
      { href: '/attendance', label: 'Attendance', icon: Clock, roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
      { href: '/presence', label: 'Team Presence', icon: Activity, roles: ['super_admin', 'admin', 'hr_manager', 'manager'] },
      { href: '/timesheets', label: 'Timesheets', icon: CalendarDays, roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
      { href: '/overtime', label: 'Overtime', icon: Timer, roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
      { href: '/leave', label: 'Leave', icon: CalendarX, roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
    ]
  },
  {
    title: 'MANAGEMENT',
    items: [
      { href: '/department-dashboard', label: 'My Team', icon: Users, roles: ['manager'] },
      { href: '/team', label: 'Team', icon: Users, roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
      { href: '/weekly-reports', label: 'Weekly Reports', icon: FileText, roles: ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead', 'employee'] },
      { href: '/reports', label: 'Analytics', icon: BarChart, roles: ['super_admin', 'admin', 'hr_manager', 'manager'] },
    ]
  },
  {
    title: 'HRM',
    items: [
      { href: '/hr', label: 'HR Dashboard', icon: HeartHandshake, roles: ['super_admin', 'admin', 'hr_manager'], departments: ['hr', 'human resource', 'human resources'] },
    ]
  },
  {
    title: 'FINANCE',
    items: [
      { href: '/finance', label: 'Finance Dashboard', icon: DollarSign, roles: ['super_admin', 'admin'], departments: ['finance'] },
    ]
  },
  {
    title: 'ORGANIZATION',
    items: [
      { href: '/settings', label: 'Settings', icon: Settings, roles: ['super_admin', 'admin'] },
    ]
  }
];

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

  const getDeptName = (u: any): string => {
    if (!u.department) return '';
    if (typeof u.department === 'string') return u.department;
    if (typeof u.department === 'object' && u.department.name) return u.department.name;
    return '';
  };

  const isVisible = (item: NavItem) => {
    // Admin/Super Admin can see everything
    if (user.role === 'super_admin' || user.role === 'admin') {
      return true;
    }

    // Check if item has department constraints
    if (item.departments) {
      const deptName = getDeptName(user).toLowerCase();
      const matchesDept = item.departments.some(d => deptName.includes(d.toLowerCase()));
      if (matchesDept) return true;
    }

    // Otherwise check role
    return item.roles.includes(user.role);
  };

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
                  <stop stopColor="#ff6b35"/>
                  <stop offset="1" stopColor="#e85a24"/>
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
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav" aria-label="Primary">
        {SECTIONS.map((section) => {
          const visibleItems = section.items.filter(isVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="sidebar-section mb-4 last:mb-0">
              {!collapsed && (
                <div className="section-header px-3 mb-2 text-[var(--text-xs)] font-semibold text-[var(--text-3)] tracking-wider">
                  {section.title}
                </div>
              )}
              <div className="flex flex-col gap-[2px]">
                {visibleItems.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  const Icon = item.icon;
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
                        <Icon size={18} />
                      </span>
                      {!collapsed && <span className="nav-label">{item.label}</span>}
                      {isActive && <span className="nav-active-indicator" aria-hidden="true"/>}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        {collapsed ? (
          <div className="flex flex-col items-center gap-4 w-full">
            <div
              className="user-avatar"
              style={{
                background: `${ROLE_COLORS[user.role]}33`,
                border: `2px solid ${ROLE_COLORS[user.role]}66`,
                flexShrink: 0,
              }}
              title={`${user.name} (${ROLE_LABELS[user.role]})`}
            >
              <span style={{ color: ROLE_COLORS[user.role] }}>{user.avatar}</span>
            </div>
            <button
              className="logout-btn"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </div>
        ) : (
          <>
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
              <div className="user-info">
                <p className="user-name">{user.name}</p>
                <p className="user-role" style={{ color: ROLE_COLORS[user.role] }}>
                  {ROLE_LABELS[user.role]}
                </p>
              </div>
            </div>
            <button
              className="logout-btn"
              onClick={handleLogout}
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut size={18} />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
