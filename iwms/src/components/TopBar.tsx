'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { attendanceApi, notificationsApi, usersApi, tasksApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useSocket } from '@/hooks/useSocket';
import {
  Search,
  Bell,
  Clock as ClockIcon,
  ChevronDown,
  LogOut,
  Menu,
  Copy,
  Check,
  Sun,
  Moon
} from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/tasks':      'Task Management',
  '/attendance': 'Attendance',
  '/team':       'Team Directory',
  '/reports':    'Reports',
  '/settings':   'Settings',
  '/hr':         'HR Dashboard',
  '/finance':    'Finance',
  '/presence':   'Team Presence',
  '/weekly-reports': 'Weekly Reports',
  '/department-dashboard': 'My Team',
  '/holidays':   'Holidays',
  '/leave':      'Leave Management',
  '/overtime':   'Overtime Management',
  '/timesheets': 'Timesheets',
  '/attendance-dashboard': 'Attendance Dashboard',
  '/management': 'Management Dashboard',
  '/get-started': 'Get Started',
};

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void } = {}) {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [time, setTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [activeIndex, setActiveIndex] = useState(-1);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const activeTheme = (localStorage.getItem('iwms_theme') as 'dark' | 'light') || 'dark';
      setTheme(activeTheme);
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('iwms_theme', nextTheme);
    window.dispatchEvent(new CustomEvent('theme-toggle', { detail: nextTheme }));
  };

  useEffect(() => {
    setActiveIndex(-1);
  }, [searchQuery]);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['search-users'],
    queryFn: () => usersApi.list(),
    enabled: !!user,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['search-tasks'],
    queryFn: () => tasksApi.list(),
    enabled: !!user,
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const filteredUsers = searchQuery.trim()
    ? allUsers.filter((u: any) =>
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.position && u.position.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (u.department && u.department.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 4)
    : [];

  const filteredTasks = searchQuery.trim()
    ? allTasks.filter((t: any) =>
        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
      ).slice(0, 4)
    : [];

  const shortcuts: Array<{ title: string; path: string; desc: string }> = [];
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    if ('tasks'.includes(q) || 'board'.includes(q) || 'kanban'.includes(q)) {
      shortcuts.push({ title: 'Go to Task Management', path: '/tasks', desc: 'Manage your Kanban boards and project tasks' });
    }
    if ('attendance'.includes(q) || 'clock'.includes(q) || 'timesheets'.includes(q)) {
      shortcuts.push({ title: 'Go to Attendance Logs', path: '/attendance', desc: 'Clock in/out, view daily logs and geofencing' });
    }
    if ('presence'.includes(q) || 'live'.includes(q) || 'who'.includes(q)) {
      shortcuts.push({ title: 'Go to Live Presence', path: '/presence', desc: 'See who is currently checked-in and active' });
    }
    if ('leave'.includes(q) || 'holiday'.includes(q) || 'vacation'.includes(q)) {
      shortcuts.push({ title: 'Go to Leave Requests', path: '/leave', desc: 'Submit and approve employee leaves' });
    }
    if ('weekly'.includes(q) || 'report'.includes(q) || 'performance'.includes(q)) {
      shortcuts.push({ title: 'Go to Weekly Reports', path: '/weekly-reports', desc: 'View, submit, and export DOCX weekly reports' });
    }
    if ('settings'.includes(q) || 'profile'.includes(q) || 'device'.includes(q)) {
      shortcuts.push({ title: 'Go to System Settings', path: '/settings', desc: 'Manage devices, geofencing, and MFA security' });
    }
    if ('hr'.includes(q) || 'directory'.includes(q) || 'headcount'.includes(q)) {
      shortcuts.push({ title: 'Go to HR Dashboard', path: '/hr', desc: 'Onboarding lists, employee headcount and logs' });
    }
    if ('finance'.includes(q) || 'expense'.includes(q) || 'budget'.includes(q)) {
      shortcuts.push({ title: 'Go to Finance Dashboard', path: '/finance', desc: 'Payroll settings, budgets, and expense approvals' });
    }
  }

  const handleItemClick = (path: string) => {
    setSearchQuery('');
    setSearchFocused(false);
    router.push(path);
  };

  const resultsList = [
    ...shortcuts.map((s: any) => ({ type: 'shortcut', path: s.path, title: s.title })),
    ...filteredUsers.map((u: any) => ({ type: 'user', path: `/team/${u.id}`, title: u.name })),
    ...filteredTasks.map((t: any) => ({ type: 'task', path: '/tasks', title: t.title }))
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex(prev => (resultsList.length > 0 ? (prev + 1) % resultsList.length : -1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex(prev => (resultsList.length > 0 ? (prev - 1 + resultsList.length) % resultsList.length : -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < resultsList.length) {
        handleItemClick(resultsList[activeIndex].path);
      }
    } else if (e.key === 'Escape') {
      setSearchFocused(false);
      searchInputRef.current?.blur();
    }
  };
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(2);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: string; text: string; time: string; type: 'info' | 'success' | 'warning' | 'error' | 'task'; metadata?: { uid?: string; deviceSerial?: string } }[]
  >([
    { id: 'static-1', text: 'Weekly report scheduled for Monday 8:00 AM', time: 'System', type: 'info' },
    { id: 'static-2', text: 'Real-time synchronization engine is online.', time: 'System', type: 'success' },
  ]);

  const today = new Date().toISOString().split('T')[0];

  const { data: dbNotifications } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list(),
    enabled: !!user && ['super_admin', 'admin', 'hr_manager', 'manager'].includes(user.role),
    refetchInterval: 15000,
  });

  // Sync DB notifications into local state
  useEffect(() => {
    if (dbNotifications) {
      setNotifications((prev) => {
        const merged = [...prev];
        dbNotifications.forEach((dn: any) => {
          if (!merged.some((m) => m.id === dn.id)) {
            const type = dn.type === 'UNREGISTERED_CARD' ? 'warning' : 'info';
            merged.push({
              id: dn.id,
              text: dn.message,
              time: new Date(dn.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              type,
              metadata: dn.metadata ? (typeof dn.metadata === 'string' ? JSON.parse(dn.metadata) : dn.metadata) : undefined,
            });
          }
        });
        return merged;
      });
    }
  }, [dbNotifications]);

  useEffect(() => {
    if (notifOpen) {
      setNotifCount(0);
    } else {
      setNotifCount(notifications.length);
    }
  }, [notifications.length, notifOpen]);

  // Load WebSocket event listeners
  const { on } = useSocket();

  useEffect(() => {
    if (!user) return;

    const offClockIn = on('attendance:clockIn', (data: any) => {
      if (data.userId !== user.id) {
        setNotifications((prev) => [
          {
            id: `clockin-${data.userId}-${Date.now()}`,
            text: `${data.userName} (${data.userDepartment}) clocked in at ${data.clockIn}${data.status === 'late' ? ' (Late)' : ''}`,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: data.status === 'late' ? 'warning' : 'success',
          },
          ...prev,
        ]);
      }
    });

    const offClockOut = on('attendance:clockOut', (data: any) => {
      if (data.userId !== user.id) {
        setNotifications((prev) => [
          {
            id: `clockout-${data.userId}-${Date.now()}`,
            text: `${data.userName} checked out at ${data.clockOut} after ${data.hoursWorked || 0} hrs`,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: data.isOvertime ? 'error' : 'info',
          },
          ...prev,
        ]);
      }
    });

    const offLateAlert = on('attendance:lateAlert', (data: any) => {
      setNotifications((prev) => [
        {
          id: `latealert-${Date.now()}`,
          text: `⚠️ Shift Late: ${data.count} employees absent at 10:00 AM check.`,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          type: 'warning',
        },
        ...prev,
      ]);
    });

    const offTaskUpdated = on('task:updated', (data: any) => {
      const isAssignee = data.assigneeId === user.id;
      const isReviewer = data.reviewerId === user.id;
      const isCreator = data.creatorId === user.id;
      const isAdmin = ['super_admin', 'admin', 'hr_manager'].includes(user.role);

      const isRelevant = isAssignee || isReviewer || isCreator || isAdmin;

      if (isRelevant && data.updatedBy !== user.email) {
        const shortEmail = data.updatedBy.split('@')[0];
        const notifText = data.text || `📋 "${data.title}" moved to ${data.status.replace('_', ' ').toUpperCase()} by ${data.updatedByName || shortEmail}`;
        setNotifications((prev) => [
          {
            id: `task-${data.id}-${Date.now()}`,
            text: notifText,
            time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
            type: 'task',
          },
          ...prev,
        ]);
      }
    });

    const offReviewRequested = on('task:reviewRequested', (data: any) => {
      setNotifications((prev) => [
        {
          id: `review-${data.id}-${Date.now()}`,
          text: `🔍 Review Requested: ${data.assigneeName} completed "${data.title}" and needs your review.`,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          type: 'warning',
        },
        ...prev,
      ]);
    });

    const offTaskApproved = on('task:approved', (data: any) => {
      setNotifications((prev) => [
        {
          id: `approved-${data.id}-${Date.now()}`,
          text: `✅ Task Approved: ${data.reviewerName} approved your task "${data.title}". Move it to Done!`,
          time: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          type: 'success',
        },
        ...prev,
      ]);
    });

    const offNewNotification = on('notification:new', (data: any) => {
      const isAdmin = ['super_admin', 'admin', 'hr_manager', 'manager'].includes(user.role);
      if (isAdmin) {
        setNotifications((prev) => {
          if (prev.some((n) => n.id === data.id)) return prev;
          return [
            {
              id: data.id,
              text: data.text,
              time: new Date(data.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
              type: data.type || 'warning',
              metadata: data.metadata,
            },
            ...prev,
          ];
        });
      }
    });

    return () => {
      offClockIn();
      offClockOut();
      offLateAlert();
      offTaskUpdated();
      offReviewRequested();
      offTaskApproved();
      offNewNotification();
    };
  }, [user, on]);

  useEffect(() => {
    const update = () =>
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  const title = Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key))?.[1] || 'IWMS';

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const dismissNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!id.startsWith('static-') && !id.startsWith('clockin-') && !id.startsWith('clockout-') && !id.startsWith('task-') && !id.startsWith('review-') && !id.startsWith('approved-')) {
      try {
        await notificationsApi.read(id);
      } catch (err) {
        console.error('Failed to mark notification as read:', err);
      }
    }
  };

  const clearAllNotifications = async () => {
    setNotifications([]);
    setNotifOpen(false);
    const isAdmin = user && ['super_admin', 'admin', 'hr_manager', 'manager'].includes(user.role);
    if (isAdmin) {
      try {
        await notificationsApi.readAll();
      } catch (err) {
        console.error('Failed to clear all notifications:', err);
      }
    }
  };

  const ROLE_COLORS: Record<string, string> = {
    super_admin: 'var(--red)',
    admin: 'var(--indigo)',
    hr_manager: 'var(--yellow)',
    manager: 'var(--purple)',
    team_lead: 'var(--teal)',
    employee: 'var(--green)',
  };
  
  const avatarColor = user ? (ROLE_COLORS[user.role] || 'var(--indigo)') : 'var(--indigo)';

  return (
    <header className="topbar">
      <div className="topbar-left" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
        <button
          className="mobile-menu-toggle"
          onClick={onMenuClick || (() => document.body.classList.toggle('mobile-sidebar-open'))}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            cursor: 'pointer',
            padding: '4px',
            display: 'none',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          aria-label="Toggle Menu"
        >
          <Menu size={22} />
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="topbar-title" style={{ margin: 0 }}>{title}</h2>
          <div className="topbar-breadcrumb hidden sm:flex">
            <span>Home</span>
            <span className="text-[var(--text-3)]">/</span>
            <span className="breadcrumb-current">{title}</span>
          </div>
        </div>
      </div>

      {/* Centered Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8 relative">
        <div className="control-compact w-full" style={{ background: 'var(--bg-elevated)' }}>
          <Search size={16} className="text-[var(--text-3)] flex-shrink-0" />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Search tasks, employees, or attendance..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="flex items-center flex-shrink-0">
            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded text-[var(--text-2)]">
              ⌘K
            </span>
          </kbd>
        </div>

        {searchFocused && (
          <>
            <div 
              style={{ position: 'fixed', inset: 0, zIndex: 999 }}
              onClick={() => setSearchFocused(false)} 
            />
            {searchQuery.trim().length > 0 && (filteredUsers.length > 0 || filteredTasks.length > 0 || shortcuts.length > 0) && (
              <div className="search-results-panel" style={{ zIndex: 1000 }}>
                {shortcuts.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="search-section-title">Navigation Shortcuts</span>
                    {shortcuts.map((s, idx: number) => {
                      const absIdx = idx;
                      const isActive = absIdx === activeIndex;
                      return (
                        <div 
                          key={idx} 
                          className={`search-item ${isActive ? 'active-search-item' : ''}`}
                          style={isActive ? { background: 'var(--bg-hover)' } : undefined}
                          onClick={() => handleItemClick(s.path)}
                        >
                          <div>
                            <div className="search-item-title">{s.title}</div>
                            <div className="search-item-subtitle">{s.desc}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredUsers.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="search-section-title">Employees</span>
                    {filteredUsers.map((u: any, idx: number) => {
                      const absIdx = shortcuts.length + idx;
                      const isActive = absIdx === activeIndex;
                      return (
                        <div 
                          key={u.id} 
                          className={`search-item ${isActive ? 'active-search-item' : ''}`}
                          style={isActive ? { background: 'var(--bg-hover)' } : undefined}
                          onClick={() => handleItemClick(`/team/${u.id}`)}
                        >
                          <div>
                            <div className="search-item-title">{u.name}</div>
                            <div className="search-item-subtitle">{u.position || 'Employee'} · {u.department || 'General'}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {filteredTasks.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="search-section-title">Tasks</span>
                    {filteredTasks.map((t: any, idx: number) => {
                      const absIdx = shortcuts.length + filteredUsers.length + idx;
                      const isActive = absIdx === activeIndex;
                      return (
                        <div 
                          key={t.id} 
                          className={`search-item ${isActive ? 'active-search-item' : ''}`}
                          style={isActive ? { background: 'var(--bg-hover)' } : undefined}
                          onClick={() => handleItemClick('/tasks')}
                        >
                          <div>
                            <div className="search-item-title">{t.title}</div>
                            <div className="search-item-subtitle">Priority: {t.priority} · Status: {t.status}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      <div className="topbar-right">
        {/* Live Clock */}
        <div className="topbar-clock hidden sm:flex">
          <ClockIcon size={14} />
          {time}
        </div>

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-2)',
            cursor: 'pointer',
            padding: '6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '50%',
            transition: 'background 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-hover)';
            e.currentTarget.style.color = 'var(--text-1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'none';
            e.currentTarget.style.color = 'var(--text-2)';
          }}
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          aria-label="Toggle Theme"
        >
          {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
        </button>

        {/* Notifications */}
        <div className="notif-wrapper">
          <button className="notif-btn" onClick={() => setNotifOpen(!notifOpen)} aria-label="Notifications">
            <Bell size={18} />
            {notifCount > 0 && <span className="notif-badge">{notifCount}</span>}
          </button>

          {notifOpen && (
            <>
              <div className="notif-backdrop" onClick={() => setNotifOpen(false)} />
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span>Notifications</span>
                  <span className="notif-count">{notifCount} active</span>
                </div>
                <div className="notif-list">
                  {notifications.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No active notifications
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div key={n.id} className={`notif-item notif-${n.type}`} style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', padding: '12px 32px 12px 16px', borderBottom: '1px solid var(--border-color)' }}>
                        <div className={`notif-dot dot-${n.type}`} style={{ marginTop: '5px' }} />
                        <div className="notif-content" style={{ flex: 1 }}>
                          <p className="notif-text" style={{ fontSize: '13px', margin: 0, color: 'var(--text-primary)', lineHeight: '1.4' }}>{n.text}</p>
                          {n.metadata?.uid && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                              <code style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text-1)' }}>
                                {n.metadata.uid}
                              </code>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(n.metadata?.uid || '');
                                  const target = e.currentTarget;
                                  const originalText = target.innerText;
                                  target.innerText = 'Copied!';
                                  target.style.background = 'var(--green)';
                                  setTimeout(() => {
                                    target.innerText = originalText;
                                    target.style.background = 'var(--accent)';
                                  }, 1500);
                                }}
                                style={{
                                  padding: '2px 8px', fontSize: '11px', background: 'var(--accent)',
                                  color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer',
                                  fontWeight: '600', transition: 'background 0.2s'
                                }}
                              >
                                Copy UID
                              </button>
                            </div>
                          )}
                          <p className="notif-time" style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', margin: 0 }}>{n.time}</p>
                        </div>
                        <button
                          onClick={(e) => dismissNotification(n.id, e)}
                          style={{
                            position: 'absolute', top: '10px', right: '10px',
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'var(--text-muted)', padding: '2px', display: 'flex',
                            alignItems: 'center', justifyContent: 'center', borderRadius: '4px'
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-1)'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.background = 'none'; }}
                          title="Dismiss"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    ))
                  )}
                </div>
                {notifications.length > 0 && (
                  <button className="notif-clear" onClick={clearAllNotifications} style={{ width: '100%', background: 'none', border: 'none', padding: '12px', color: 'var(--accent-text)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', borderTop: '1px solid var(--border-color)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-soft)'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
                    Clear all notifications
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        {/* User info + logout */}
        {user && (
          <div className="topbar-user" style={{ position: 'relative' }}>
            <button
              onClick={() => setShowLogoutConfirm(!showLogoutConfirm)}
              style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: '8px', transition: 'background 0.2s' }}
              title="Click to sign out"
            >
              <div
                className="topbar-avatar"
                style={{ background: `${avatarColor}25`, border: `2px solid ${avatarColor}50`, color: avatarColor }}
              >
                {user.avatar}
              </div>
              <div className="topbar-user-info">
                <span className="topbar-user-name">{user.name.split(' ')[0]}</span>
                <span className="topbar-user-dept">{typeof user.department === 'string' ? user.department : (user.department as any)?.name || 'General'}</span>
              </div>
              <ChevronDown size={14} className="text-[var(--text-3)]" />
            </button>

            {showLogoutConfirm && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowLogoutConfirm(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '12px',
                  padding: '8px', minWidth: '200px', zIndex: 50,
                  boxShadow: 'var(--glass-shadow)',
                }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', marginBottom: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-1)' }}>{user.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>{user.email}</p>
                    <span style={{
                      display: 'inline-block', marginTop: '6px', fontSize: '10px', fontWeight: 600,
                      color: avatarColor, background: `${avatarColor}20`,
                      padding: '2px 8px', borderRadius: '20px', textTransform: 'capitalize',
                    }}>
                      {user.role.replace('_', ' ')}
                    </span>
                  </div>
                  <button
                    onClick={handleLogout}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                      padding: '9px 12px', background: 'none', border: 'none',
                      borderRadius: '8px', cursor: 'pointer', color: 'var(--red)', fontSize: '13px',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--red-soft)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                  >
                    <LogOut size={15} />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
