'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import Link from 'next/link';
import { attendanceApi, tasksApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocketEvent } from '@/hooks/useSocket';

// ── Static weekly shapes (will be real WebSocket data in Phase 2) ─
const WEEKLY_ATTENDANCE = [
  { day: 'Mon', present: 48, absent: 6, late: 4 },
  { day: 'Tue', present: 52, absent: 4, late: 2 },
  { day: 'Wed', present: 50, absent: 5, late: 3 },
  { day: 'Thu', present: 45, absent: 8, late: 5 },
  { day: 'Fri', present: 42, absent: 10, late: 4 },
  { day: 'Sat', present: 20, absent: 40, late: 0 },
  { day: 'Sun', present: 10, absent: 50, late: 0 },
];
const MONTHLY_TREND = [
  { week: 'W1', attendance: 88, tasks: 42 },
  { week: 'W2', attendance: 91, tasks: 55 },
  { week: 'W3', attendance: 85, tasks: 48 },
  { week: 'W4', attendance: 93, tasks: 67 },
];

const TOOLTIP_STYLE = {
  background: '#1e293b', border: '1px solid #334155',
  borderRadius: '8px', color: '#e2e8f0', padding: '10px 14px', fontSize: '13px',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: '#94a3b8' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
}

// ── Welcome Banner ──────────────────────────────────────────────────
function WelcomeBanner({
  user,
  pendingLeave,
  tasksDue,
  onCreateTask,
}: {
  user: any;
  pendingLeave: number;
  tasksDue: number;
  onCreateTask?: () => void;
}) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="welcome-banner">
      <div className="welcome-banner-left">
        <div className="welcome-avatar">{initials}</div>
        <div className="welcome-text">
          <h2>{greeting}, {user?.name?.split(' ')[0]} 👋</h2>
          <p>
            You have{' '}
            <strong>{pendingLeave}</strong> pending leave request{pendingLeave !== 1 ? 's' : ''} &amp;{' '}
            <strong>{tasksDue}</strong> task{tasksDue !== 1 ? 's' : ''} in progress today.
          </p>
        </div>
      </div>
      <div className="welcome-actions">
        <Link href="/attendance" className="welcome-btn-secondary">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          View Attendance
        </Link>
        <button className="welcome-btn-primary" onClick={onCreateTask}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Create Task
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const today = new Date().toISOString().split('T')[0];
  const queryClient = useQueryClient();
  const [newArrivals, setNewArrivals] = useState<Record<string, boolean>>({});

  const { data: stats } = useQuery({
    queryKey: ['attendance-stats', today],
    queryFn: () => attendanceApi.stats(today),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(),
  });

  const { data: recentAttendance = [] } = useQuery({
    queryKey: ['attendance', today],
    queryFn: () => attendanceApi.list({ date: today }),
  });

  // Socket updates for KPI stats
  useSocketEvent<{ stats: any }>('stats:update', (data) => {
    queryClient.setQueryData(['attendance-stats', today], data.stats);
  });

  // Socket updates for clock-in (Activity Feed + Stats)
  useSocketEvent<any>('attendance:clockIn', (payload) => {
    setNewArrivals((prev) => ({ ...prev, [payload.userId]: true }));
    setTimeout(() => {
      setNewArrivals((prev) => {
        const next = { ...prev };
        delete next[payload.userId];
        return next;
      });
    }, 3000);

    queryClient.setQueryData<any[]>(['attendance', today], (prev = []) => {
      const exists = prev.some((item) => item.userId === payload.userId);
      if (exists) {
        return prev.map((item) => (item.userId === payload.userId ? { ...item, ...payload } : item));
      }
      return [payload, ...prev];
    });

    queryClient.invalidateQueries({ queryKey: ['attendance-stats', today] });
  });

  // Socket updates for clock-out (Activity Feed + Stats)
  useSocketEvent<any>('attendance:clockOut', (payload) => {
    setNewArrivals((prev) => ({ ...prev, [payload.userId]: true }));
    setTimeout(() => {
      setNewArrivals((prev) => {
        const next = { ...prev };
        delete next[payload.userId];
        return next;
      });
    }, 3000);

    queryClient.setQueryData<any[]>(['attendance', today], (prev = []) => {
      return prev.map((item) => (item.userId === payload.userId ? { ...item, ...payload } : item));
    });

    queryClient.invalidateQueries({ queryKey: ['attendance-stats', today] });
  });

  const doneTasks = tasks.filter((t: any) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress').length;
  const totalTasks = tasks.length;
  const pendingLeaveCount = (stats?.onLeave ?? 0);

  const taskStatusCounts = [
    { name: 'Done',        value: tasks.filter((t: any) => t.status === 'done').length,        color: '#10b981' },
    { name: 'In Progress', value: tasks.filter((t: any) => t.status === 'in_progress').length, color: '#6366f1' },
    { name: 'Review',      value: tasks.filter((t: any) => t.status === 'review').length,      color: '#f59e0b' },
    { name: 'Todo',        value: tasks.filter((t: any) => t.status === 'todo').length,        color: '#64748b' },
    { name: 'Backlog',     value: tasks.filter((t: any) => t.status === 'backlog').length,     color: '#334155' },
  ];

  const kpiCards = [
    {
      label: 'Present Today',
      value: stats?.presentWithLate ?? '—',
      total: stats?.totalEmployees ?? '—',
      pct: stats?.attendanceRate ?? 0,
      color: '#10b981', glow: '0 0 20px #10b98140',
      href: '/attendance', hrefLabel: 'View Attendance',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>,
    },
    {
      label: 'Tasks Completed',
      value: doneTasks,
      total: totalTasks,
      pct: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0,
      color: '#6366f1', glow: '0 0 20px #6366f140',
      href: '/tasks', hrefLabel: 'View Tasks',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
    },
    {
      label: 'In Progress',
      value: inProgressTasks,
      total: totalTasks,
      pct: totalTasks > 0 ? Math.round((inProgressTasks / totalTasks) * 100) : 0,
      color: '#f59e0b', glow: '0 0 20px #f59e0b40',
      href: '/tasks', hrefLabel: 'View Board',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
    },
    {
      label: 'On Leave / Absent',
      value: (stats?.onLeave ?? 0) + (stats?.absent ?? 0),
      total: stats?.totalEmployees ?? '—',
      pct: stats?.totalEmployees ? Math.round(((stats.onLeave + stats.absent) / stats.totalEmployees) * 100) : 0,
      color: '#8b5cf6', glow: '0 0 20px #8b5cf640',
      href: '/attendance', hrefLabel: 'View Details',
      icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
    },
  ];

  const criticalTasks = tasks
    .filter((t: any) => (t.priority === 'critical' || t.priority === 'high') && t.status !== 'done')
    .slice(0, 4);

  return (
    <div className="page-content">
      {/* Welcome Banner */}
      <WelcomeBanner
        user={user}
        pendingLeave={pendingLeaveCount}
        tasksDue={inProgressTasks}
        onCreateTask={() => { window.location.href = '/tasks'; }}
      />

      {/* KPI Cards */}
      <div className="kpi-grid">
        {kpiCards.map((card, i) => (
          <div key={i} className="kpi-card" style={{ '--kpi-color': card.color, '--kpi-glow': card.glow } as React.CSSProperties}>
            <div className="kpi-header">
              <div className="kpi-icon" style={{ color: card.color, background: `${card.color}20` }}>{card.icon}</div>
              <span className="kpi-pct" style={{ color: card.color }}>{card.pct}%</span>
            </div>
            <div className="kpi-value">{card.value}<span className="kpi-total">/{card.total}</span></div>
            <div className="kpi-label">{card.label}</div>
            <div className="kpi-bar">
              <div className="kpi-bar-fill" style={{ width: `${card.pct}%`, background: card.color }} />
            </div>
            <Link href={card.href} className="kpi-link" style={{ '--kpi-color': card.color } as React.CSSProperties}>
              {card.hrefLabel}
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
            </Link>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="charts-grid">
        <div className="chart-card chart-wide">
          <div className="chart-header">
            <h3 className="chart-title">Weekly Attendance Overview</h3>
            <div className="chart-legend-row">
              {[{ color: '#10b981', label: 'Present' }, { color: '#ef4444', label: 'Absent' }, { color: '#f59e0b', label: 'Late' }].map(l => (
                <span key={l.label} className="legend-chip">
                  <span className="legend-dot" style={{ background: l.color }} />{l.label}
                </span>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={WEEKLY_ATTENDANCE} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="presentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="lateGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="day" stroke="#475569" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="present" name="Present" stroke="#10b981" strokeWidth={2} fill="url(#presentGrad)" />
              <Area type="monotone" dataKey="late" name="Late" stroke="#f59e0b" strokeWidth={2} fill="url(#lateGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <div className="chart-header"><h3 className="chart-title">Task Distribution</h3></div>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={taskStatusCounts} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                {taskStatusCounts.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="pie-legend">
            {taskStatusCounts.map(s => (
              <div key={s.name} className="pie-legend-item">
                <span className="legend-dot" style={{ background: s.color }} />
                <span className="pie-legend-label">{s.name}</span>
                <span className="pie-legend-val">{s.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="bottom-grid">
        <div className="chart-card">
          <div className="chart-header"><h3 className="chart-title">Monthly Performance Trend</h3></div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={MONTHLY_TREND} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="week" stroke="#475569" tick={{ fill: '#64748b', fontSize: 12 }} />
              <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 12 }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="attendance" name="Attendance %" fill="#6366f1" radius={[4, 4, 0, 0]} />
              <Bar dataKey="tasks" name="Tasks Done" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Enhanced Live Activity Feed — Clock-In/Out style */}
        <div className="chart-card activity-card">
          <div className="chart-header">
            <h3 className="chart-title">Clock-In / Out</h3>
            <span className="live-badge"><span className="live-dot" />LIVE</span>
          </div>
          <div className="activity-list">
            {recentAttendance.slice(0, 6).map((a: any) => {
              const isClockedOut = !!a.clockOut;
              const isPresent = a.status === 'present';
              const isLate = a.status === 'late';
              const isLeave = a.status === 'on_leave';

              const pillColor = isClockedOut
                ? { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' }
                : isPresent
                ? { bg: 'rgba(16,185,129,0.12)', text: '#10b981' }
                : isLate
                ? { bg: 'rgba(245,158,11,0.12)', text: '#f59e0b' }
                : isLeave
                ? { bg: 'rgba(139,92,246,0.12)', text: '#8b5cf6' }
                : { bg: 'rgba(239,68,68,0.12)', text: '#ef4444' };

              const timeDisplay = isClockedOut ? a.clockOut : (a.clockIn || '');
              const statusLabel = isClockedOut ? 'Clocked out' : isPresent ? 'Clocked in' : isLate ? 'Late' : isLeave ? 'On Leave' : 'Absent';

              return (
                <div key={a.id || a.userId} className={`activity-item ${newArrivals[a.userId] ? 'activity-item-new' : ''}`}>
                  <div className="activity-avatar" style={{ background: pillColor.bg, border: `2px solid ${pillColor.text}50`, color: pillColor.text }}>
                    {a.userAvatar}
                  </div>
                  <div className="activity-info">
                    <p className="activity-name">{a.userName}</p>
                    {a.userRole && <p className="activity-role">{a.userRole}</p>}
                  </div>
                  <div className="activity-pill" style={{ background: pillColor.bg, color: pillColor.text }}>
                    <span className="activity-pill-dot" />
                    {statusLabel}{timeDisplay ? ` · ${timeDisplay}` : ''}
                  </div>
                </div>
              );
            })}
            {recentAttendance.length === 0 && (
              <p style={{ color: '#475569', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No attendance records today</p>
            )}
          </div>
        </div>

        {/* Critical Tasks */}
        <div className="chart-card">
          <div className="chart-header"><h3 className="chart-title">Critical &amp; High Priority Tasks</h3></div>
          <div className="task-list">
            {criticalTasks.map((task: any) => (
              <div key={task.id} className="task-item-mini">
                <div className={`task-priority-dot priority-${task.priority}`} />
                <div className="task-mini-info">
                  <p className="task-mini-title">{task.title}</p>
                  <p className="task-mini-meta">{task.assigneeName} · Due {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
                </div>
                <span className={`task-status-badge status-${task.status}`}>
                  {task.status.replace('_', ' ')}
                </span>
              </div>
            ))}
            {criticalTasks.length === 0 && (
              <p style={{ color: '#475569', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>No critical tasks 🎉</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
