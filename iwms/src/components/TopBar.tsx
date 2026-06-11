'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { usePathname, useRouter } from 'next/navigation';
import { attendanceApi } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';
import { useSocket } from '@/hooks/useSocket';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard':  'Dashboard',
  '/tasks':      'Task Management',
  '/attendance': 'Attendance',
  '/team':       'Team Directory',
  '/reports':    'Reports',
  '/settings':   'Settings',
};

export default function TopBar() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [time, setTime] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [notifications, setNotifications] = useState<
    { id: string; text: string; time: string; type: 'info' | 'success' | 'warning' | 'error' | 'task' }[]
  >([
    { id: 'static-1', text: 'Weekly report scheduled for Monday 8:00 AM', time: 'System', type: 'info' },
    { id: 'static-2', text: 'Real-time synchronization engine is online.', time: 'System', type: 'success' },
  ]);

  const today = new Date().toISOString().split('T')[0];

  const { data: todayStats } = useQuery({
    queryKey: ['attendance-stats', today],
    queryFn: () => attendanceApi.stats(today),
    refetchInterval: 60000,
    enabled: !!user,
  });

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

    // Personal targeted: reviewer gets alerted when their assigned task enters review
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

    // Personal targeted: assignee gets notified when their task is approved to done
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

    return () => {
      offClockIn();
      offClockOut();
      offLateAlert();
      offTaskUpdated();
      offReviewRequested();
      offTaskApproved();
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

  const dismissNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    setNotifOpen(false);
  };

  const ROLE_COLORS: Record<string, string> = {
    super_admin: '#ef4444', admin: '#6366f1', hr_manager: '#f59e0b',
    manager: '#8b5cf6', team_lead: '#06b6d4', employee: '#10b981',
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
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
          </svg>
        </button>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h2 className="topbar-title" style={{ margin: 0 }}>{title}</h2>
          <div className="topbar-breadcrumb">
            <span>Home</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
            <span className="breadcrumb-current">{title}</span>
          </div>
        </div>
      </div>

      <div className="topbar-right">
        {/* Live Clock */}
        <div className="topbar-clock">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {time}
        </div>

        {/* Notifications */}
        <div className="notif-wrapper">
          <button className="notif-btn" onClick={() => setNotifOpen(!notifOpen)} aria-label="Notifications">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
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
                  <button className="notif-clear" onClick={clearAllNotifications} style={{ width: '100%', background: 'none', border: 'none', padding: '12px', color: 'var(--color-indigo)', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textAlign: 'center', borderTop: '1px solid var(--border-color)', transition: 'background 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.05)'} onMouseLeave={(e) => e.currentTarget.style.background = 'none'}>
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
                <span className="topbar-user-dept">{user.department}</span>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            {showLogoutConfirm && (
              <>
                <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setShowLogoutConfirm(false)} />
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: '#1e293b', border: '1px solid #334155', borderRadius: '12px',
                  padding: '8px', minWidth: '200px', zIndex: 50,
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                }}>
                  <div style={{ padding: '10px 12px', borderBottom: '1px solid #334155', marginBottom: '4px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>{user.name}</p>
                    <p style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{user.email}</p>
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
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                    </svg>
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
