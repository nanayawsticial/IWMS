'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { attendanceApi, notificationsApi } from '@/lib/api';
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
  Check
} from 'lucide-react';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/tasks':      'Task Management',
  '/attendance': 'Attendance',
  '/team':       'Team Directory',
  '/reports':    'Reports',
  '/settings':   'Settings',
  '/hr':         'HR Dashboard',
  '/finance':    'Finance Dashboard',
  '/presence':   'Team Presence',
  '/weekly-reports': 'Weekly Reports',
  '/department-dashboard': 'My Team',
};

export default function TopBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [time, setTime] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
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
  const notifCount = notifications.length;

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
    super_admin: '#ef4444',
    admin: '#6366f1',
    hr_manager: '#f59e0b',
    manager: '#8b5cf6',
    team_lead: '#06b6d4',
    employee: '#10b981',
  };
  
  const avatarColor = user ? (ROLE_COLORS[user.role] || '#6366f1') : '#6366f1';

  return (
    <header className="topbar">
      <div className="topbar-left" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '12px' }}>
        <button
          className="mobile-menu-toggle"
          onClick={() => document.body.classList.toggle('mobile-sidebar-open')}
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
          <div className="topbar-breadcrumb">
            <span>Home</span>
            <span className="text-[var(--text-3)]">/</span>
            <span className="breadcrumb-current">{title}</span>
          </div>
        </div>
      </div>

      {/* Centered Search Bar */}
      <div className="hidden md:flex items-center flex-1 max-w-md mx-8">
        <div className="relative w-full">
          <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-3)]">
            <Search size={16} />
          </span>
          <input
            type="text"
            placeholder="Search tasks, employees, or attendance..."
            className="w-full pl-10 pr-12 py-1.5 text-xs bg-[var(--bg-elevated)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)] transition-colors"
          />
          <kbd className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
            <span className="px-1.5 py-0.5 text-[9px] font-medium bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded text-[var(--text-2)]">
              ⌘K
            </span>
          </kbd>
        </div>
      </div>

      <div className="topbar-right">
        {/* Live Clock */}
        <div className="topbar-clock">
          <ClockIcon size={14} />
          {time}
        </div>

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
                <div className="notif-list" style={{ maxHeight: '320px', overflowY: 'auto' }}>
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
                              <code style={{ fontFamily: 'monospace', fontSize: '12px', background: 'rgba(255,255,255,0.08)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}>
                                {n.metadata.uid}
                              </code>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(n.metadata?.uid || '');
                                  const target = e.currentTarget;
                                  const originalText = target.innerText;
                                  target.innerText = 'Copied!';
                                  target.style.background = '#10b981';
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
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; }}
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
                  <button className="notif-clear" onClick={clearAllNotifications} style={{ width: '100%', background: 'none', border: 'none', padding: '12px', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', borderTop: '1px solid var(--border-color)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-soft)'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
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
                      borderRadius: '8px', cursor: 'pointer', color: '#ef4444', fontSize: '13px',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#ef444415')}
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
