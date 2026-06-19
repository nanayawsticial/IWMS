'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, Cell, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { managementApi, organizationApi, usersApi, tasksApi, attendanceApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocketEvent } from '@/hooks/useSocket';
import Link from 'next/link';

// Custom tooltip styling
const TOOLTIP_STYLE = {
  background: '#1e293b',
  border: '1px solid #334155',
  borderRadius: '8px',
  color: '#e2e8f0',
  padding: '10px 14px',
  fontSize: '13px',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: '#94a3b8' }}>{label || payload[0].name}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill || p.color || '#fff', margin: 0 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

// Icons Map
const ICONS = {
  users: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  ),
  active: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>
    </svg>
  ),
  leave: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  ),
  newHire: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
    </svg>
  ),
  attendance: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  hours: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
    </svg>
  ),
  tasks: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
    </svg>
  ),
  overdue: (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  clock: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
};

const TASK_STATUS_COLORS = {
  backlog: '#475569',
  todo: '#64748b',
  in_progress: '#6366f1',
  review: '#f59e0b',
  done: '#10b981',
};

const TASK_STATUS_LABELS = {
  backlog: 'Backlog',
  todo: 'To Do',
  in_progress: 'In Progress',
  review: 'In Review',
  done: 'Completed',
};

export default function ManagementDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDeptId, setSelectedDeptId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<'tasksCompleted' | 'attendanceRate' | 'hoursWorked'>('tasksCompleted');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Authorize managers/admins
  const isAuthorized = user && ['super_admin', 'admin', 'manager'].includes(user.role);

  const handleCloseDrawer = () => setSelectedDeptId(null);

  // Queries
  const { data: dashboardData, isLoading, error } = useQuery({
    queryKey: ['management-dashboard'],
    queryFn: () => managementApi.getDashboard(),
    enabled: !!isAuthorized,
    refetchInterval: 30000,
  });

  const { data: orgData } = useQuery({
    queryKey: ['organization'],
    queryFn: () => organizationApi.getDetails(),
    enabled: !!isAuthorized,
  });

  // Slide-in drawer supporting queries
  const today = useMemo(() => new Date().toISOString().split('T')[0], []);
  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: !!isAuthorized && !!selectedDeptId,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => tasksApi.list(),
    enabled: !!isAuthorized && !!selectedDeptId,
  });

  const { data: todayPresence = [] } = useQuery({
    queryKey: ['attendance', today],
    queryFn: () => attendanceApi.list({ date: today }),
    enabled: !!isAuthorized && !!selectedDeptId,
  });

  // Socket updates: Invalidate query on live activities
  useSocketEvent<any>('attendance:clockIn', () => {
    queryClient.invalidateQueries({ queryKey: ['management-dashboard'] });
  });
  useSocketEvent<any>('attendance:clockOut', () => {
    queryClient.invalidateQueries({ queryKey: ['management-dashboard'] });
  });
  useSocketEvent<any>('task:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['management-dashboard'] });
  });
  useSocketEvent<any>('leave:created', () => {
    queryClient.invalidateQueries({ queryKey: ['management-dashboard'] });
  });

  // Sorting
  const sortedTopPerformers = useMemo(() => {
    if (!dashboardData?.topPerformers) return [];
    return [...dashboardData.topPerformers].sort((a: any, b: any) => {
      const valA = a[sortField];
      const valB = b[sortField];
      return sortOrder === 'desc' ? valB - valA : valA - valB;
    });
  }, [dashboardData?.topPerformers, sortField, sortOrder]);

  const handleSort = (field: 'tasksCompleted' | 'attendanceRate' | 'hoursWorked') => {
    if (sortField === field) {
      setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Recharts calculations
  const barChartData = useMemo(() => {
    if (!dashboardData?.departments) return [];
    return dashboardData.departments.map((d: any) => ({
      name: d.name,
      'Attendance Rate': Math.round(d.attendanceRate * 100),
      color: d.color || '#6366f1'
    }));
  }, [dashboardData?.departments]);

  const donutChartData = useMemo(() => {
    if (!dashboardData?.tasks?.statusDistribution) return [];
    const dist = dashboardData.tasks.statusDistribution;
    return Object.keys(dist).map(status => ({
      name: TASK_STATUS_LABELS[status as keyof typeof TASK_STATUS_LABELS] || status,
      value: dist[status],
      color: TASK_STATUS_COLORS[status as keyof typeof TASK_STATUS_COLORS] || '#64748b'
    })).filter(item => item.value > 0);
  }, [dashboardData?.tasks?.statusDistribution]);

  // Drawer Department Member data
  const drawerDept = useMemo(() => {
    if (!selectedDeptId || !dashboardData?.departments) return null;
    return dashboardData.departments.find((d: any) => d.id === selectedDeptId);
  }, [selectedDeptId, dashboardData?.departments]);

  const drawerMembers = useMemo(() => {
    if (!selectedDeptId) return [];
    return allUsers.filter((u: any) => u.departmentId === selectedDeptId);
  }, [selectedDeptId, allUsers]);

  if (!isAuthorized) {
    return (
      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '10px' }}>Access Denied</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '20px' }}>You do not have the required permissions to view the management dashboard.</p>
        <Link href="/dashboard" className="btn-primary-sm">Go to Dashboard</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-content" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-muted)' }}>
        <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />
        Loading Management Insights...
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="page-content" style={{ textAlign: 'center', padding: '100px 0', color: '#ef4444' }}>
        <h3>Error Loading Dashboard</h3>
        <p>Failed to retrieve management details. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Management Dashboard</h1>
          <p className="page-subtitle">
            Overview of {orgData?.name || 'Organization'} • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Row 1: Headcount KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card" style={{ '--kpi-color': '#6366f1', '--kpi-glow': 'rgba(99, 102, 241, 0.15)' } as any}>
          <div className="kpi-header">
            <span className="kpi-total">Total Headcount</span>
            <div className="kpi-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{ICONS.users}</div>
          </div>
          <div className="kpi-value">{dashboardData.headcount.total}</div>
          <div className="kpi-label">Registered accounts</div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#10b981', '--kpi-glow': 'rgba(16, 185, 129, 0.15)' } as any}>
          <div className="kpi-header">
            <span className="kpi-total">Active Staff</span>
            <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{ICONS.active}</div>
          </div>
          <div className="kpi-value">{dashboardData.headcount.active}</div>
          <div className="kpi-label">Currently active profile status</div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#3b82f6', '--kpi-glow': 'rgba(59, 130, 246, 0.15)' } as any}>
          <div className="kpi-header">
            <span className="kpi-total">On Leave Today</span>
            <div className="kpi-icon" style={{ background: 'rgba(59,130,246,0.1)', color: '#3b82f6' }}>{ICONS.leave}</div>
          </div>
          <div className="kpi-value">{dashboardData.headcount.onLeave}</div>
          <div className="kpi-label">Approved leave allocations</div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#a855f7', '--kpi-glow': 'rgba(168, 85, 247, 0.15)' } as any}>
          <div className="kpi-header">
            <span className="kpi-total">New Hires</span>
            <div className="kpi-icon" style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7' }}>{ICONS.newHire}</div>
          </div>
          <div className="kpi-value">{dashboardData.headcount.new_this_month}</div>
          <div className="kpi-label">Joined this calendar month</div>
        </div>
      </div>

      {/* Row 2: Performance KPIs */}
      <div className="kpi-grid" style={{ marginBottom: '24px' }}>
        <div className="kpi-card" style={{ '--kpi-color': '#10b981', '--kpi-glow': 'rgba(16, 185, 129, 0.15)' } as any}>
          <div className="kpi-header">
            <span className="kpi-total">Attendance Rate</span>
            <div className="kpi-icon" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>{ICONS.attendance}</div>
          </div>
          <div className="kpi-value">{Math.round(dashboardData.attendance.rate * 100)}%</div>
          <div className="kpi-label">This calendar month</div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill" style={{ width: `${dashboardData.attendance.rate * 100}%`, background: '#10b981' }} />
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#f59e0b', '--kpi-glow': 'rgba(245, 158, 11, 0.15)' } as any}>
          <div className="kpi-header">
            <span className="kpi-total">Avg Hours Worked</span>
            <div className="kpi-icon" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b' }}>{ICONS.hours}</div>
          </div>
          <div className="kpi-value">{dashboardData.attendance.avgHoursWorked.toFixed(1)}h</div>
          <div className="kpi-label">Daily average per employee</div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill" style={{ width: `${Math.min(100, (dashboardData.attendance.avgHoursWorked / 8) * 100)}%`, background: '#f59e0b' }} />
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#6366f1', '--kpi-glow': 'rgba(99, 102, 241, 0.15)' } as any}>
          <div className="kpi-header">
            <span className="kpi-total">Task Completion</span>
            <div className="kpi-icon" style={{ background: 'rgba(99,102,241,0.1)', color: '#6366f1' }}>{ICONS.tasks}</div>
          </div>
          <div className="kpi-value">{Math.round(dashboardData.tasks.completionRate * 100)}%</div>
          <div className="kpi-label">{dashboardData.tasks.completed}/{dashboardData.tasks.total} tasks completed</div>
          <div className="kpi-bar">
            <div className="kpi-bar-fill" style={{ width: `${dashboardData.tasks.completionRate * 100}%`, background: '#6366f1' }} />
          </div>
        </div>

        <div className="kpi-card" style={{ '--kpi-color': '#ef4444', '--kpi-glow': 'rgba(239, 68, 68, 0.15)' } as any}>
          <div className="kpi-header">
            <span className="kpi-total">Overdue Tasks</span>
            <div className="kpi-icon" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>{ICONS.overdue}</div>
          </div>
          <div className="kpi-value" style={{ color: dashboardData.tasks.overdue > 0 ? '#ef4444' : '#fff' }}>{dashboardData.tasks.overdue}</div>
          <div className="kpi-label">Tasks past their due date</div>
        </div>
      </div>

      {/* Row 3: Recharts Charts */}
      <div className="charts-grid" style={{ marginBottom: '24px' }}>
        {/* Left: Attendance Bar Chart */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>Department Attendance Rates</h3>
          <div style={{ width: '100%', height: '300px' }}>
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={[0, 100]} unit="%" tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                  <Bar dataKey="Attendance Rate" radius={[6, 6, 0, 0]} maxBarSize={45}>
                    {barChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                No department data available
              </div>
            )}
          </div>
        </div>

        {/* Right: Task Status Donut Chart */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>Task Status Distribution</h3>
          <div style={{ width: '100%', height: '220px', position: 'relative' }}>
            {donutChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {donutChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                No active tasks
              </div>
            )}
            {/* Center label */}
            <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', pointerEvents: 'none' }}>
              <span style={{ fontSize: '24px', fontWeight: 800, color: '#fff', display: 'block', lineHeight: 1 }}>{dashboardData.tasks.total}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>Total Tasks</span>
            </div>
          </div>
          {/* Legend */}
          <div style={{ marginTop: 'auto', display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px 16px', fontSize: '12px' }}>
            {donutChartData.map((item: any) => (
              <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: item.color, display: 'inline-block' }} />
                <span style={{ color: 'var(--text-secondary)' }}>{item.name}: <strong>{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Department Drilldown & Top Performers */}
      <div className="bottom-grid" style={{ marginBottom: '24px' }}>
        {/* Department Overview list (Clickable to trigger drilldown drawer) */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '16px' }}>Departments performance</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Click any department row below to drill down into member metrics.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {dashboardData.departments.map((d: any) => (
              <div
                key={d.id}
                onClick={() => setSelectedDeptId(d.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                className="dept-hover-row"
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ width: '12px', height: '12px', borderRadius: '4px', background: d.color || '#6366f1' }} />
                  <div>
                    <h4 style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>{d.name}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{d.headcount} employee{d.headcount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '24px', textAlign: 'right' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>ATTENDANCE</span>
                    <strong style={{ fontSize: '13px', color: '#10b981' }}>{Math.round(d.attendanceRate * 100)}%</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>TASK COMPL.</span>
                    <strong style={{ fontSize: '13px', color: '#6366f1' }}>{Math.round(d.taskCompletionRate * 100)}%</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers Table */}
        <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>Top Performers</h3>
          <div className="table-responsive" style={{ flexGrow: 1 }}>
            <table className="table" style={{ width: '100%', fontSize: '13px' }}>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th onClick={() => handleSort('tasksCompleted')} style={{ cursor: 'pointer' }}>
                    Tasks Completed {sortField === 'tasksCompleted' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('attendanceRate')} style={{ cursor: 'pointer' }}>
                    Attendance {sortField === 'attendanceRate' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                  <th onClick={() => handleSort('hoursWorked')} style={{ cursor: 'pointer' }}>
                    Hours {sortField === 'hoursWorked' ? (sortOrder === 'asc' ? '▲' : '▼') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedTopPerformers.length > 0 ? (
                  sortedTopPerformers.map((p: any) => {
                    const initials = p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <tr key={p.userId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 0' }}>
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'rgba(99,102,241,0.15)',
                                color: '#818cf8',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: '12px',
                                fontWeight: 700,
                              }}
                              title={p.name}
                            >
                              {initials}
                            </div>
                            <div>
                              <strong style={{ display: 'block', color: '#fff' }}>{p.name}</strong>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.department}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ fontWeight: 600, color: '#fff' }}>{p.tasksCompleted}</td>
                        <td style={{ color: '#10b981', fontWeight: 600 }}>{Math.round(p.attendanceRate * 100)}%</td>
                        <td>{p.hoursWorked.toFixed(1)}h</td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No performance logs recorded this month.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Row 5: Recent Activity Log */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#fff', marginBottom: '20px' }}>Recent Activity Feed</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '400px', overflowY: 'auto', paddingRight: '8px' }}>
          {dashboardData.recentActivity.length > 0 ? (
            dashboardData.recentActivity.map((activity: any, index: number) => {
              const timeLabel = new Date(activity.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const initials = activity.user?.name ? activity.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '?';

              return (
                <div key={index} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', paddingBottom: '14px', borderBottom: index < dashboardData.recentActivity.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: 'rgba(255,255,255,0.05)',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '12px',
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ flexGrow: 1 }}>
                    <p style={{ fontSize: '13.5px', color: '#e2e8f0', margin: 0, lineHeight: 1.4 }}>
                      {activity.description}
                    </p>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                      {ICONS.clock} {timeLabel}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 8px',
                      borderRadius: '12px',
                      background:
                        activity.type === 'attendance' ? 'rgba(16,185,129,0.1)' :
                        activity.type === 'task' ? 'rgba(99,102,241,0.1)' :
                        activity.type === 'leave' ? 'rgba(245,158,11,0.1)' : 'rgba(59,130,246,0.1)',
                      color:
                        activity.type === 'attendance' ? '#10b981' :
                        activity.type === 'task' ? '#818cf8' :
                        activity.type === 'leave' ? '#f59e0b' : '#3b82f6',
                      textTransform: 'uppercase',
                    }}
                  >
                    {activity.type}
                  </span>
                </div>
              );
            })
          ) : (
            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>No recent activities logged.</p>
          )}
        </div>
      </div>

      {/* Slide-out Drawer for Department drilldown */}
      {selectedDeptId && drawerDept && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          justifyContent: 'flex-end',
        }} onClick={handleCloseDrawer}>
          <div
            style={{
              width: '100%',
              maxWidth: '460px',
              height: '100%',
              background: '#0f172a',
              borderLeft: '1px solid var(--border-color)',
              padding: '30px',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-10px 0 25px rgba(0,0,0,0.3)',
              overflowY: 'auto',
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: drawerDept.color || '#6366f1', textTransform: 'uppercase', letterSpacing: '0.05em' }}>DEPARTMENT DRILL DOWN</span>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#fff', margin: '4px 0 0' }}>{drawerDept.name}</h2>
              </div>
              <button
                onClick={handleCloseDrawer}
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 'bold',
                }}
              >
                ✕
              </button>
            </div>

            {/* Department Summary stats inside drawer */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Attendance Rate</span>
                <strong style={{ fontSize: '20px', color: '#10b981' }}>{Math.round(drawerDept.attendanceRate * 100)}%</strong>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Task Completion</span>
                <strong style={{ fontSize: '20px', color: '#6366f1' }}>{Math.round(drawerDept.taskCompletionRate * 100)}%</strong>
              </div>
            </div>

            {/* Member List */}
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '16px' }}>Team Members ({drawerMembers.length})</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
              {drawerMembers.length > 0 ? (
                drawerMembers.map((m: any) => {
                  const initials = m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                  // Find today's presence status
                  const presenceRec = todayPresence.find((r: any) => r.userId === m.id);
                  const isClockedIn = presenceRec && ['present', 'late'].includes(presenceRec.status);
                  const statusLabel = presenceRec?.status || 'not_clocked_in';

                  const badgeColors =
                    statusLabel === 'present' ? { bg: 'rgba(16,185,129,0.1)', color: '#10b981', label: 'Present' } :
                    statusLabel === 'late' ? { bg: 'rgba(245,158,11,0.1)', color: '#f59e0b', label: 'Late' } :
                    statusLabel === 'absent' ? { bg: 'rgba(239,68,68,0.1)', color: '#ef4444', label: 'Absent' } :
                    statusLabel === 'on_leave' ? { bg: 'rgba(59,130,246,0.1)', color: '#3b82f6', label: 'On Leave' } :
                    { bg: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)', label: 'Not Clocked In' };

                  // Count active tasks for this member
                  const activeTasksCount = allTasks.filter((t: any) => t.assigneeId === m.id && t.status !== 'done').length;

                  return (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'rgba(255,255,255,0.03)',
                            color: '#e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                            border: `2px solid ${isClockedIn ? '#10b981' : 'transparent'}`,
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <strong style={{ display: 'block', color: '#fff', fontSize: '13px' }}>{m.name}</strong>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.position}</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '10px',
                            background: badgeColors.bg,
                            color: badgeColors.color,
                            display: 'inline-block',
                            marginBottom: '4px',
                          }}
                        >
                          {badgeColors.label}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block' }}>
                          {activeTasksCount} active task{activeTasksCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>No active team members in this department.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
