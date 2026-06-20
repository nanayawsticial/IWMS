'use client';

import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, Cell, PieChart, Pie, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { managementApi, organizationApi, usersApi, tasksApi, attendanceApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocketEvent } from '@/hooks/useSocket';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import KpiCard from '@/components/KpiCard';
import {
  Users,
  UserCheck,
  Calendar,
  UserPlus,
  Clock,
  Timer,
  CheckCircle,
  AlertCircle,
  X,
  ArrowUpDown,
  Building
} from 'lucide-react';

// Custom tooltip styling
const TOOLTIP_STYLE = {
  background: 'var(--bg-surface-2)',
  border: '1px solid var(--border-strong)',
  borderRadius: '8px',
  color: 'var(--text-1)',
  padding: '10px 14px',
  fontSize: '12px',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>{label || payload[0].name}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.fill || p.color || 'var(--text-1)', margin: 0 }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}

const TASK_STATUS_COLORS = {
  backlog: 'var(--text-3)',
  todo: 'var(--blue)',
  in_progress: 'var(--accent)',
  review: 'var(--yellow)',
  done: 'var(--green)',
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
  const router = useRouter();
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

  // Recharts calculations: side-by-side performance comparison
  const departmentData = useMemo(() => {
    if (!dashboardData?.departments) return [];
    return dashboardData.departments.map((d: any) => ({
      name: d.name,
      attendanceRate: Math.round(d.attendanceRate * 100),
      taskCompletionRate: Math.round(d.taskCompletionRate * 100),
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
      <div className="page-content flex flex-col items-center justify-center min-h-[60vh] text-center">
        <h2 className="text-red-500 text-lg font-bold mb-2">Access Denied</h2>
        <p className="text-[var(--text-3)] text-sm mb-4">You do not have the required permissions to view the management dashboard.</p>
        <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="page-content text-center py-20 text-[var(--text-3)]">
        <span className="spinner block mx-auto mb-3" />
        Loading Management Insights...
      </div>
    );
  }

  if (error || !dashboardData) {
    return (
      <div className="page-content text-center py-20 text-red-500">
        <h3 className="text-lg font-bold mb-2">Error Loading Dashboard</h3>
        <p className="text-sm">Failed to retrieve management details. Please try again later.</p>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title text-[var(--text-1)] text-2xl font-bold">Management Dashboard</h1>
          <p className="page-subtitle text-[var(--text-3)] text-xs mt-1">
            Overview of {orgData?.name || 'Organization'} • {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Row 1: Headcount KPIs */}
      <div className="kpi-grid-4">
        <KpiCard
          label="Total Headcount"
          value={dashboardData.headcount.total}
          icon={Users}
          iconBg="var(--blue-soft)"
          iconColor="var(--blue)"
          subValue="Registered"
          subLabel="staff accounts"
          linkLabel="Directory"
          onLinkClick={() => router.push('/team')}
        />
        <KpiCard
          label="Active Staff"
          value={dashboardData.headcount.active}
          icon={UserCheck}
          iconBg="var(--green-soft)"
          iconColor="var(--green)"
          subValue="Active"
          subLabel="status profiles"
        />
        <KpiCard
          label="On Leave Today"
          value={dashboardData.headcount.onLeave}
          icon={Calendar}
          iconBg="var(--purple-soft)"
          iconColor="var(--purple)"
          subValue="Approved"
          subLabel="allocations"
          linkLabel="Calendar"
          onLinkClick={() => router.push('/leave')}
        />
        <KpiCard
          label="New Hires"
          value={dashboardData.headcount.new_this_month}
          icon={UserPlus}
          iconBg="var(--accent-soft)"
          iconColor="var(--accent)"
          subValue="Joined"
          subLabel="this month"
        />
      </div>

      {/* Row 2: Performance KPIs */}
      <div className="kpi-grid-4">
        <KpiCard
          label="Attendance Rate"
          value={`${Math.round(dashboardData.attendance.rate * 100)}%`}
          icon={Clock}
          iconBg="var(--green-soft)"
          iconColor="var(--green)"
          subValue={`${dashboardData.attendance.present + dashboardData.attendance.late} present`}
          subLabel="today"
          subColor="#22c55e"
          linkLabel="View logs"
          onLinkClick={() => router.push('/attendance')}
        />
        <KpiCard
          label="Avg Hours Worked"
          value={`${dashboardData.attendance.avgHoursWorked.toFixed(1)}h`}
          icon={Timer}
          iconBg="var(--yellow-soft)"
          iconColor="var(--yellow)"
          subValue="Daily avg"
          subLabel="per employee"
        />
        <KpiCard
          label="Task Completion"
          value={`${Math.round(dashboardData.tasks.completionRate * 100)}%`}
          icon={CheckCircle}
          iconBg="var(--blue-soft)"
          iconColor="var(--blue)"
          subValue={`${dashboardData.tasks.completed}/${dashboardData.tasks.total}`}
          subLabel="tasks done"
          linkLabel="Tasks board"
          onLinkClick={() => router.push('/tasks')}
        />
        <KpiCard
          label="Overdue Tasks"
          value={dashboardData.tasks.overdue}
          icon={AlertCircle}
          iconBg="var(--red-soft)"
          iconColor="var(--red)"
          subValue="Urgent"
          subLabel="past due dates"
          subColor="#ef4444"
        />
      </div>

      {/* Row 3: Recharts Charts */}
      <div className="chart-row" style={{ gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
        {/* Left: Department Performance Comparison Bar Chart */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <div className="section-header">
            <span className="section-title">Department Performance Comparison</span>
          </div>
          <div style={{ width: '100%', height: 280 }}>
            {departmentData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={departmentData} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#8892a4' }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11, fill: '#8892a4' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#1e2536', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 8, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 12 }} />
                  <Bar dataKey="attendanceRate" name="Attendance" fill="#22c55e" radius={[4,4,0,0]} />
                  <Bar dataKey="taskCompletionRate" name="Task Completion" fill="#3b82f6" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">No department data available</div>
            )}
          </div>
        </div>

        {/* Right: Task Status Donut Chart */}
        <div className="card flex flex-col justify-between">
          <h3 className="section-title mb-4">Task Status Distribution</h3>
          {dashboardData.tasks.total === 0 ? (
            <div className="empty-state">No tasks created yet</div>
          ) : (
            <div className="relative w-full h-[240px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    dataKey="value"
                  >
                    {donutChartData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-2xl font-extrabold text-[var(--text-1)] leading-none">{dashboardData.tasks.total}</span>
                <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-semibold mt-1">Total Tasks</span>
              </div>
            </div>
          )}
          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 text-xs pt-4 border-t border-[var(--border)] mt-4">
            {donutChartData.map((item: any) => (
              <div key={item.name} className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full block" style={{ background: item.color }} />
                <span className="text-[var(--text-2)] truncate">{item.name}: <strong className="text-[var(--text-1)]">{item.value}</strong></span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Row 4: Department Drilldown & Top Performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Department Overview list */}
        <div className="card">
          <h3 className="section-title mb-2">Departments Performance</h3>
          <p className="text-xs text-[var(--text-3)] mb-4">Click any department row below to drill down into member metrics.</p>
          <div className="flex flex-col gap-3">
            {dashboardData.departments.map((d: any) => (
              <div
                key={d.id}
                onClick={() => setSelectedDeptId(d.id)}
                className="flex items-center justify-between p-3.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl cursor-pointer hover:border-[var(--accent)] hover:bg-[var(--bg-hover)]/20 transition-all"
              >
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-md block" style={{ background: d.color || 'var(--accent)' }} />
                  <div>
                    <h4 className="text-sm font-semibold text-[var(--text-1)]">{d.name}</h4>
                    <span className="text-[11px] text-[var(--text-3)]">{d.headcount} employee{d.headcount !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="flex gap-6 text-right">
                  <div>
                    <span className="text-[9px] text-[var(--text-3)] block uppercase tracking-wider font-semibold">Attendance</span>
                    <strong className="text-xs text-[var(--green)] font-semibold">{Math.round(d.attendanceRate * 100)}%</strong>
                  </div>
                  <div>
                    <span className="text-[9px] text-[var(--text-3)] block uppercase tracking-wider font-semibold">Tasks Completed</span>
                    <strong className="text-xs text-[var(--accent)] font-semibold">{Math.round(d.taskCompletionRate * 100)}%</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Performers Table */}
        <div className="card flex flex-col justify-between">
          <h3 className="section-title mb-4">Top Performers</h3>
          {sortedTopPerformers.length === 0 ? (
            <div className="empty-state">No performance data yet</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-[10px] uppercase font-semibold">
                    <th className="py-2.5">Employee</th>
                    <th className="py-2.5 cursor-pointer hover:text-[var(--text-1)]" onClick={() => handleSort('tasksCompleted')}>
                      <span className="inline-flex items-center gap-1">
                        Tasks Completed <ArrowUpDown size={10} />
                      </span>
                    </th>
                    <th className="py-2.5 cursor-pointer hover:text-[var(--text-1)]" onClick={() => handleSort('attendanceRate')}>
                      <span className="inline-flex items-center gap-1">
                        Attendance <ArrowUpDown size={10} />
                      </span>
                    </th>
                    <th className="py-2.5 cursor-pointer hover:text-[var(--text-1)]" onClick={() => handleSort('hoursWorked')}>
                      <span className="inline-flex items-center gap-1">
                        Hours Worked <ArrowUpDown size={10} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {sortedTopPerformers.map((p: any) => {
                    const initials = p.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();
                    return (
                      <tr key={p.userId} style={{ borderTop: '0.5px solid var(--border)' }} className="hover:bg-[var(--bg-hover)]/10 transition-colors">
                        <td style={{ padding: '12px 0' }}>
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)] text-[var(--accent)] flex items-center justify-center text-xs font-bold">
                              {initials}
                            </div>
                            <div>
                              <strong className="text-xs text-[var(--text-1)] block">{p.name}</strong>
                              <span className="text-[10px] text-[var(--text-3)]">{p.department}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 0', textAlign: 'center' }} className="font-semibold text-[var(--text-1)]">{p.tasksCompleted}</td>
                        <td style={{ padding: '12px 0', textAlign: 'center' }} className="font-semibold text-[var(--green)]">{Math.round(p.attendanceRate * 100)}%</td>
                        <td style={{ padding: '12px 0', textAlign: 'center' }} className="text-[var(--text-2)]">{p.hoursWorked.toFixed(1)}h</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Row 5: Recent Activity Log */}
      <div className="card mt-6">
        <h3 className="section-title mb-4">Recent Activity Feed</h3>
        <div className="flex flex-col gap-4 max-h-[400px] overflow-y-auto pr-1">
          {dashboardData.recentActivity.length > 0 ? (
            dashboardData.recentActivity.map((activity: any, index: number) => {
              const timeLabel = new Date(activity.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + ' - ' + new Date(activity.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const initials = activity.user?.name ? activity.user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase() : '?';

              return (
                <div key={index} className="flex gap-4 items-start pb-4 border-b border-[var(--border)] last:border-b-0 last:pb-0">
                  <div className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-strong)] text-[var(--text-2)] flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-[var(--text-1)] leading-relaxed">
                      {activity.description}
                    </p>
                    <span className="text-[10px] text-[var(--text-3)] flex items-center gap-1 mt-1 font-mono">
                      <Clock size={10} /> {timeLabel}
                    </span>
                  </div>
                  <span className={`badge ${
                    activity.type === 'attendance' ? 'badge-green' :
                    activity.type === 'task' ? 'badge-blue' :
                    activity.type === 'leave' ? 'badge-yellow' : 'badge-orange'
                  } uppercase text-[9px]`}>
                    {activity.type}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="text-center text-[var(--text-3)] py-6">No recent activities logged.</p>
          )}
        </div>
      </div>

      {/* Slide-out Drawer for Department drilldown */}
      {selectedDeptId && drawerDept && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex justify-end"
          onClick={handleCloseDrawer}
        >
          <div
            className="w-full max-w-[460px] h-full bg-[var(--bg-surface)] border-l border-[var(--border)] p-8 flex flex-col shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
              <div>
                <span className="text-[10px] font-bold text-[var(--accent)] tracking-wider uppercase">Department Drill Down</span>
                <h2 className="text-xl font-extrabold text-[var(--text-1)] mt-1">{drawerDept.name}</h2>
              </div>
              <button
                onClick={handleCloseDrawer}
                className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] text-[var(--text-3)] hover:text-[var(--text-1)] flex items-center justify-center transition-colors cursor-pointer border border-[var(--border)]"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Department Summary stats inside drawer */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl p-4 text-center">
                <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider block mb-1">Attendance Rate</span>
                <strong className="text-lg text-[var(--green)] font-bold">{Math.round(drawerDept.attendanceRate * 100)}%</strong>
              </div>
              <div className="bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl p-4 text-center">
                <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider block mb-1">Task Completion</span>
                <strong className="text-lg text-[var(--accent)] font-bold">{Math.round(drawerDept.taskCompletionRate * 100)}%</strong>
              </div>
            </div>

            {/* Member List */}
            <h3 className="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-4">Team Members ({drawerMembers.length})</h3>
            <div className="flex flex-col gap-3 flex-1 overflow-y-auto pr-1">
              {drawerMembers.length > 0 ? (
                drawerMembers.map((m: any) => {
                  const initials = m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase();

                  // Find today's presence status
                  const presenceRec = todayPresence.find((r: any) => r.userId === m.id);
                  const isClockedIn = presenceRec && ['present', 'late'].includes(presenceRec.status);
                  const statusLabel = presenceRec?.status || 'not_clocked_in';

                  const badgeColors =
                    statusLabel === 'present' ? { bg: 'badge-green', label: 'Present' } :
                    statusLabel === 'late' ? { bg: 'badge-yellow', label: 'Late' } :
                    statusLabel === 'absent' ? { bg: 'badge-red', label: 'Absent' } :
                    statusLabel === 'on_leave' ? { bg: 'badge-blue', label: 'On Leave' } :
                    { bg: 'bg-[var(--bg-hover)] text-[var(--text-3)] border border-[var(--border)]', label: 'Not Clocked In' };

                  // Count active tasks for this member
                  const activeTasksCount = allTasks.filter((t: any) => t.assigneeId === m.id && t.status !== 'done').length;

                  return (
                    <div key={m.id} className="flex items-center justify-between p-3.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] text-[var(--text-2)] flex items-center justify-center text-xs font-bold"
                          style={{
                            border: `2px solid ${isClockedIn ? 'var(--green)' : 'transparent'}`,
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <strong className="text-xs text-[var(--text-1)] block">{m.name}</strong>
                          <span className="text-[10px] text-[var(--text-3)]">{m.position}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`badge ${badgeColors.bg} text-[9px] mb-1.5`}>
                          {badgeColors.label}
                        </span>
                        <span className="text-[10px] text-[var(--text-3)] block font-medium">
                          {activeTasksCount} active task{activeTasksCount !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[var(--text-3)] text-center py-6">No active team members in this department.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
