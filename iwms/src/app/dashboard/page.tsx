'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadialBarChart, RadialBar
} from 'recharts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { attendanceApi, tasksApi, managementApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocketEvent } from '@/hooks/useSocket';
import KpiCard from '@/components/KpiCard';
import {
  Users,
  Briefcase,
  CheckCircle,
  Clock,
  DollarSign,
  TrendingUp,
  Calendar,
  UserPlus,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Trash2,
  Check,
  Building,
  UserCheck
} from 'lucide-react';

const WEEKLY_ATTENDANCE = [
  { day: 'Mon', present: 48, absent: 6, late: 4 },
  { day: 'Tue', present: 52, absent: 4, late: 2 },
  { day: 'Wed', present: 50, absent: 5, late: 3 },
  { day: 'Thu', present: 45, absent: 8, late: 5 },
  { day: 'Fri', present: 42, absent: 10, late: 4 },
  { day: 'Sat', present: 20, absent: 40, late: 0 },
  { day: 'Sun', present: 10, absent: 50, late: 0 },
];

const TOOLTIP_STYLE = {
  background: 'var(--bg-surface-2)',
  border: '1px solid var(--border-strong)',
  borderRadius: '8px',
  color: 'var(--text-1)',
  padding: '10px 14px',
  fontSize: '12px',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ ...TOOLTIP_STYLE, boxShadow: 'var(--glass-shadow)' }}>
      {label && <p style={{ fontWeight: 600, marginBottom: '8px', color: 'var(--text-1)' }}>{label}</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {payload.map((p: any) => (
          <p key={p.name || p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-2)', margin: 0 }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: p.color || p.stroke || p.fill || 'var(--accent)', display: 'inline-block' }} />
            <span>{p.name}:</span>
            <strong style={{ color: 'var(--text-1)', marginLeft: 'auto' }}>{p.value}</strong>
          </p>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const today = new Date().toISOString().split('T')[0];
  const queryClient = useQueryClient();
  const [newArrivals, setNewArrivals] = useState<Record<string, boolean>>({});

  // Todo list state
  const [todoInput, setTodoInput] = useState('');
  const [todos, setTodos] = useState<{ id: number; text: string; completed: boolean }[]>([
    { id: 1, text: 'Approve pending overtime requests', completed: false },
    { id: 2, text: 'Review HR onboarding checklist', completed: true },
    { id: 3, text: 'Audit geofence zone logs', completed: false },
  ]);

  // Applicants filter state
  const [applicantFilter, setApplicantFilter] = useState<'all' | 'shortlisted' | 'interviewing'>('all');

  const applicantsData = [
    { id: 1, name: 'Godfred Lawson', position: 'UI Designer', status: 'interviewing', date: '2026-06-18' },
    { id: 2, name: 'Abena Osei', position: 'Frontend Eng', status: 'shortlisted', date: '2026-06-19' },
    { id: 3, name: 'Kwesi Mensah', position: 'DevOps Lead', status: 'applied', date: '2026-06-15' },
    { id: 4, name: 'Eshun Kofi', position: 'HR Assistant', status: 'applied', date: '2026-06-16' },
  ];

  const filteredApplicants = applicantsData.filter(a => {
    if (applicantFilter === 'all') return true;
    return a.status === applicantFilter;
  });

  const isAdmin = user?.role === 'super_admin' || user?.role === 'admin';

  // 1. Fetch live metrics
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

  const { data: managementData } = useQuery({
    queryKey: ['management-dashboard'],
    queryFn: () => managementApi.getDashboard(),
    enabled: !!user && isAdmin,
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
    if (isAdmin) {
      queryClient.invalidateQueries({ queryKey: ['management-dashboard'] });
    }
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
    if (isAdmin) {
      queryClient.invalidateQueries({ queryKey: ['management-dashboard'] });
    }
  });

  // Tasks counts
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((t: any) => t.status === 'done').length;
  const inProgressTasks = tasks.filter((t: any) => t.status === 'in_progress').length;
  const reviewTasks = tasks.filter((t: any) => t.status === 'review').length;
  const todoTasks = tasks.filter((t: any) => t.status === 'todo').length;
  const backlogTasks = tasks.filter((t: any) => t.status === 'backlog').length;

  const taskStatusCounts = [
    { name: 'Done', value: doneTasks, color: 'var(--green)' },
    { name: 'In Progress', value: inProgressTasks, color: 'var(--accent)' },
    { name: 'Review', value: reviewTasks, color: 'var(--yellow)' },
    { name: 'Todo', value: todoTasks, color: 'var(--blue)' },
    { name: 'Backlog', value: backlogTasks, color: 'var(--text-3)' },
  ];

  // Todo action handlers
  const handleAddTodo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!todoInput.trim()) return;
    setTodos(prev => [...prev, { id: Date.now(), text: todoInput.trim(), completed: false }]);
    setTodoInput('');
  };

  const handleToggleTodo = (id: number) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
  };

  const handleDeleteTodo = (id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  // Greeting
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const initials = user?.name
    ? user.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  // Admin and Employee layouts rendering
  return (
    <div className="page-content">
      {/* Welcome Banner */}
      <div className="card bg-gradient-to-r from-[var(--bg-surface)] to-[var(--bg-surface-2)] border border-[var(--border)] rounded-[var(--radius-lg)] p-6">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-[var(--accent-soft)] flex items-center justify-center text-[var(--accent)] font-bold text-xl border border-[var(--border-strong)] shadow-inner">
              {initials}
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-bold text-[var(--text-1)]">
                {greeting}, {user?.name?.split(' ')[0]} 👋
              </h2>
              {isAdmin ? (
                <p style={{ fontSize: '0.875rem', opacity: 0.65, marginTop: 4 }}>
                  You have{' '}
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{stats?.onLeave || 0}</span>
                  {' '}employees on leave today &amp;{' '}
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>{tasks.filter((t: any) => t.status === 'review').length}</span>
                  {' '}tasks awaiting review.
                </p>
              ) : (
                <p style={{ fontSize: '0.875rem', opacity: 0.65, marginTop: 4 }}>
                  You have{' '}
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                    {tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'in_progress').length}
                  </span>
                  {' '}tasks in progress today &amp; your attendance rate this month is{' '}
                  <span style={{ color: (stats?.attendanceRate || 0) > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                    {stats?.attendanceRate || 0}%
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto mt-4 md:mt-0">
            <Link href="/attendance" className="welcome-btn-secondary justify-center text-center">
              <Clock size={16} />
              View Attendance
            </Link>
            <Link href="/tasks" className="welcome-btn-primary justify-center text-center">
              <Plus size={16} />
              Manage Tasks
            </Link>
          </div>
        </div>
      </div>

      {isAdmin ? (
        <>
          {/* Admin Dashboard: Row 1 & 2 KPI Cards */}
          <div className="kpi-grid-4">
            <KpiCard
              label="Attendance Today"
              value={`${stats?.presentWithLate ?? 0}/${stats?.totalEmployees ?? 0}`}
              icon={UserCheck}
              iconBg="var(--green-soft)"
              iconColor="var(--green)"
              subValue={`${stats?.attendanceRate ?? 0}%`}
              subLabel="Present today"
              subColor={(stats?.attendanceRate ?? 0) >= 85 ? '#22c55e' : '#ef4444'}
              linkLabel="View log"
              onLinkClick={() => router.push('/attendance')}
            />
            <KpiCard
              label="Active Projects"
              value="12"
              icon={Briefcase}
              iconBg="var(--blue-soft)"
              iconColor="var(--blue)"
              subValue="+2 new"
              subLabel="this week"
              linkLabel="View tasks"
              onLinkClick={() => router.push('/tasks')}
            />
            <KpiCard
              label="Total Headcount"
              value={managementData?.headcount?.total ?? stats?.totalEmployees ?? '—'}
              icon={Users}
              iconBg="var(--purple-soft)"
              iconColor="var(--purple)"
              subValue={`+${managementData?.headcount?.new_this_month ?? 2}`}
              subLabel="this month"
              linkLabel="Directory"
              onLinkClick={() => router.push('/team')}
            />
            <KpiCard
              label="Active Tasks"
              value={tasks.filter((t: any) => t.status !== 'done').length}
              icon={CheckCircle}
              iconBg="var(--kpi-orange-bg)"
              iconColor="var(--accent)"
              subValue={`${doneTasks} completed`}
              subLabel="in total"
              linkLabel="Kanban Board"
              onLinkClick={() => router.push('/tasks')}
            />
          </div>

          <div className="kpi-grid-4">
            <KpiCard
              label="Monthly Earnings"
              value="GHS 25,430"
              icon={DollarSign}
              iconBg="var(--green-soft)"
              iconColor="var(--green)"
              subValue="12.5%"
              subLabel="vs last month"
              subColor="#22c55e"
            />
            <KpiCard
              label="Total Revenue"
              value="GHS 142,500"
              icon={TrendingUp}
              iconBg="var(--teal-soft)"
              iconColor="var(--teal)"
              subValue="8%"
              subLabel="vs last quarter"
              subColor="#22c55e"
            />
            <KpiCard
              label="Leaves Approved"
              value={managementData?.headcount?.onLeave ?? stats?.onLeave ?? 0}
              icon={Calendar}
              iconBg="var(--red-soft)"
              iconColor="var(--red)"
              subValue="Stable"
              subLabel="daily average"
              linkLabel="Leave calendar"
              onLinkClick={() => router.push('/leave')}
            />
            <KpiCard
              label="New Hires"
              value={managementData?.headcount?.new_this_month ?? 4}
              icon={UserPlus}
              iconBg="var(--kpi-pink-bg)"
              iconColor="#ec4899"
              subValue="+10% Join Rate"
              subLabel="MoM increase"
              subColor="#22c55e"
            />
          </div>

          {/* Row 3 (3-Column Layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1: Employee Status Panel */}
            <div className="card flex flex-col justify-between">
              <div>
                <h3 className="section-title mb-4">Employee Status</h3>
                <div className="flex justify-between items-baseline mb-2">
                  <span className="text-sm text-[var(--text-2)]">Active Employees</span>
                  <span className="text-xl font-bold text-[var(--text-1)]">
                    {managementData?.headcount?.active ?? 0}/{managementData?.headcount?.total ?? 0}
                  </span>
                </div>
                {/* Horizontal proportion bar */}
                <div className="h-2 w-full rounded-full bg-[var(--bg-hover)] overflow-hidden flex mb-4">
                  <div style={{ width: '70%' }} className="bg-var(--green) bg-emerald-500" title="Full Time: 70%" />
                  <div style={{ width: '15%' }} className="bg-var(--blue) bg-blue-500" title="Part Time: 15%" />
                  <div style={{ width: '10%' }} className="bg-var(--yellow) bg-amber-500" title="Contract: 10%" />
                  <div style={{ width: '5%' }} className="bg-var(--red) bg-red-500" title="Intern: 5%" />
                </div>
                {/* 2x2 grid stats */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-3 bg-[var(--bg-surface-2)] rounded-[var(--radius-md)] border border-[var(--border)]">
                    <span className="label block text-[var(--text-3)] text-xs mb-1">Gender Ratio</span>
                    <span className="text-sm font-semibold text-[var(--text-1)]">62% M / 38% F</span>
                  </div>
                  <div className="p-3 bg-[var(--bg-surface-2)] rounded-[var(--radius-md)] border border-[var(--border)]">
                    <span className="label block text-[var(--text-3)] text-xs mb-1">Workspace</span>
                    <span className="text-sm font-semibold text-[var(--text-1)]">84% Onsite / 16% Rem</span>
                  </div>
                  <div className="p-3 bg-[var(--bg-surface-2)] rounded-[var(--radius-md)] border border-[var(--border)]">
                    <span className="label block text-[var(--text-3)] text-xs mb-1">Shift Coverage</span>
                    <span className="text-sm font-semibold text-[var(--text-1)]">94% Day / 6% Night</span>
                  </div>
                  <div className="p-3 bg-[var(--bg-surface-2)] rounded-[var(--radius-md)] border border-[var(--border)]">
                    <span className="label block text-[var(--text-3)] text-xs mb-1">Engagement</span>
                    <span className="text-sm font-semibold text-[var(--text-1)]">88% score</span>
                  </div>
                </div>
              </div>

              {/* Top Performer Section */}
              {managementData?.topPerformers?.[0] && (
                <div className="p-4 bg-gradient-to-r from-[var(--bg-surface-2)] to-[var(--bg-hover)] rounded-[var(--radius-md)] border border-[var(--border-strong)] flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-[var(--accent-soft)] border border-[var(--accent)] flex items-center justify-center text-[var(--accent)] font-semibold text-lg">
                    {managementData.topPerformers[0].avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[var(--text-3)] text-[10px] uppercase font-bold tracking-wider">Top Performer</span>
                    <h4 className="text-sm font-semibold text-[var(--text-1)] truncate">{managementData.topPerformers[0].name}</h4>
                    <p className="text-xs text-[var(--text-2)] truncate">{managementData.topPerformers[0].department}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[var(--green)]">+{managementData.topPerformers[0].tasksCompleted}</span>
                    <p className="text-[10px] text-[var(--text-3)]">tasks done</p>
                  </div>
                </div>
              )}
            </div>

            {/* Column 2: Attendance Gauge */}
            <div className="card flex flex-col justify-between items-center relative min-h-[300px]">
              <div className="w-full flex items-center justify-between mb-4">
                <h3 className="section-title">Attendance Gauge</h3>
                <span className="badge badge-green">Healthy</span>
              </div>

              <div className="relative w-full flex items-center justify-center flex-1">
                <div style={{ width: '100%', height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="60%"
                      innerRadius="80%"
                      outerRadius="110%"
                      barSize={12}
                      data={[{ value: Math.round((managementData?.attendance?.rate || stats?.attendanceRate || 0) * 100) }]}
                      startAngle={180}
                      endAngle={0}
                    >
                      <RadialBar
                        background={{ fill: 'var(--bg-surface-2)' }}
                        dataKey="value"
                        cornerRadius={6}
                        fill="var(--accent)"
                      />
                    </RadialBarChart>
                  </ResponsiveContainer>
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center pt-8">
                  <span className="text-3xl font-bold text-[var(--text-1)]">
                    {Math.round((managementData?.attendance?.rate || stats?.attendanceRate || 0) * 100)}%
                  </span>
                  <span className="text-xs text-[var(--text-3)] mt-1">Attendance Rate</span>
                </div>
              </div>

              <div className="w-full grid grid-cols-3 gap-2 text-center pt-4 border-t border-[var(--border)]">
                <div>
                  <span className="text-sm font-bold text-[var(--green)]">
                    {managementData?.attendance?.present ?? stats?.presentCount ?? 0}
                  </span>
                  <p className="text-[10px] text-[var(--text-3)] mt-0.5">Present</p>
                </div>
                <div>
                  <span className="text-sm font-bold text-[var(--yellow)]">
                    {managementData?.attendance?.late ?? stats?.lateCount ?? 0}
                  </span>
                  <p className="text-[10px] text-[var(--text-3)] mt-0.5">Late</p>
                </div>
                <div>
                  <span className="text-sm font-bold text-[var(--red)]">
                    {managementData?.attendance?.absent ?? stats?.absentCount ?? 0}
                  </span>
                  <p className="text-[10px] text-[var(--text-3)] mt-0.5">Absent</p>
                </div>
              </div>
            </div>

            {/* Column 3: Departments Size & Clock Logs */}
            <div className="card flex flex-col justify-between">
              <div>
                <h3 className="section-title mb-4">Department Sizes</h3>
                <div style={{ width: '100%', height: 120 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={managementData?.departments || []} layout="vertical" margin={{ left: -15, right: 10, top: 0, bottom: 0 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" stroke="var(--text-3)" fontSize={10} width={80} tickLine={false} axisLine={false} />
                      <Bar dataKey="headcount" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={8}>
                        {managementData?.departments?.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color || 'var(--accent)'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="border-t border-[var(--border)] pt-4">
                <h4 className="text-xs font-semibold text-[var(--text-2)] uppercase tracking-wider mb-3">Today's Scans</h4>
                <div className="space-y-3">
                  {recentAttendance.slice(0, 3).map((a: any) => {
                    const isClockedOut = !!a.clockOut;
                    const isPresent = a.status === 'present';
                    const isLate = a.status === 'late';
                    
                    const statusText = isClockedOut ? 'Out' : isPresent ? 'In' : isLate ? 'Late' : 'Scanned';
                    const statusColor = isClockedOut ? 'badge-blue' : isPresent ? 'badge-green' : isLate ? 'badge-yellow' : 'badge-orange';
                    const timeVal = isClockedOut ? a.clockOut : a.clockIn;

                    return (
                      <div key={a.id || a.userId} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center text-[var(--text-2)] font-semibold">
                            {a.userAvatar}
                          </div>
                          <div>
                            <p className="font-semibold text-[var(--text-1)]">{a.userName}</p>
                            <p className="text-[10px] text-[var(--text-3)]">{a.userDepartment || 'General'}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`badge ${statusColor}`}>{statusText}</span>
                          <p className="text-[10px] text-[var(--text-3)] mt-1 font-mono">{timeVal || '—'}</p>
                        </div>
                      </div>
                    );
                  })}
                  {recentAttendance.length === 0 && (
                    <p className="text-xs text-[var(--text-3)] text-center py-2">No scans registered today</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Row 4: Applicants, Active Employees, Quick Action Todo List */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Column 1 & 2: Applicants and Active Directory */}
            <div className="card lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-[var(--border)] pb-4 mb-4 flex-wrap gap-4">
                  <h3 className="section-title">Recruitment Pipeline</h3>
                  <div className="control-compact flex items-center gap-1 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl" style={{ padding: '3px', height: '38px' }}>
                    <button
                      onClick={() => setApplicantFilter('all')}
                      className={`px-3 h-full text-xs font-semibold rounded-lg transition-colors cursor-pointer ${applicantFilter === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setApplicantFilter('shortlisted')}
                      className={`px-3 h-full text-xs font-semibold rounded-lg transition-colors cursor-pointer ${applicantFilter === 'shortlisted' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
                    >
                      Shortlisted
                    </button>
                    <button
                      onClick={() => setApplicantFilter('interviewing')}
                      className={`px-3 h-full text-xs font-semibold rounded-lg transition-colors cursor-pointer ${applicantFilter === 'interviewing' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
                    >
                      Interviewing
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-[11px] uppercase font-semibold">
                        <th className="py-2.5">Candidate</th>
                        <th className="py-2.5">Position Applied</th>
                        <th className="py-2.5">Status</th>
                        <th className="py-2.5 text-right">Applied Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredApplicants.map((a) => (
                        <tr key={a.id} className="text-xs hover:bg-[var(--bg-hover)]/30 transition-colors">
                          <td className="py-3 font-semibold text-[var(--text-1)]">{a.name}</td>
                          <td className="py-3 text-[var(--text-2)]">{a.position}</td>
                          <td className="py-3">
                            <span className={`badge ${
                              a.status === 'interviewing' ? 'badge-orange' : a.status === 'shortlisted' ? 'badge-blue' : 'badge-yellow'
                            }`}>
                              {a.status}
                            </span>
                          </td>
                          <td className="py-3 text-right text-[var(--text-3)] font-mono">{a.date}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Active employee avatar strip */}
              <div className="border-t border-[var(--border)] pt-4 mt-6">
                <h4 className="text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider mb-3">Today's Active Team</h4>
                <div className="flex items-center gap-2 flex-wrap">
                  {recentAttendance.slice(0, 10).map((a: any) => (
                    <div
                      key={a.id || a.userId}
                      className="w-9 h-9 rounded-full bg-[var(--bg-elevated)] border-2 border-emerald-500/80 flex items-center justify-center text-xs font-bold text-[var(--text-1)] cursor-pointer hover:scale-105 transition-transform"
                      title={`${a.userName} is active`}
                    >
                      {a.userAvatar}
                    </div>
                  ))}
                  {recentAttendance.length === 0 && (
                    <p className="text-xs text-[var(--text-3)]">No team members active currently</p>
                  )}
                </div>
              </div>
            </div>

            {/* Column 3: Quick Action Todo List */}
            <div className="card flex flex-col justify-between min-h-[350px]">
              <div>
                <h3 className="section-title mb-4">Quick Todo List</h3>
                
                <form onSubmit={handleAddTodo} className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={todoInput}
                    onChange={(e) => setTodoInput(e.target.value)}
                    placeholder="Add a quick task..."
                    className="control-compact flex-1"
                    style={{ background: 'var(--bg-elevated)' }}
                  />
                  <button type="submit" className="px-3 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl transition-colors flex items-center justify-center h-[38px] flex-shrink-0">
                    <Plus size={16} />
                  </button>
                </form>

                <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
                  {todos.map((todo) => (
                    <div
                      key={todo.id}
                      className="flex items-center justify-between p-2.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[var(--radius-md)] hover:border-[var(--border-strong)] transition-colors"
                    >
                      <button
                        onClick={() => handleToggleTodo(todo.id)}
                        className={`flex items-center gap-2.5 text-left text-xs ${todo.completed ? 'text-[var(--text-3)] line-through' : 'text-[var(--text-1)]'}`}
                      >
                        <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${todo.completed ? 'bg-[var(--green)] border-[var(--green)] text-white' : 'border-[var(--border-strong)] bg-transparent'}`}>
                          {todo.completed && <Check size={12} />}
                        </div>
                        <span className="truncate max-w-[170px]">{todo.text}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteTodo(todo.id)}
                        className="text-[var(--text-3)] hover:text-red-500 transition-colors p-1"
                        title="Delete task"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                  {todos.length === 0 && (
                    <p className="text-xs text-[var(--text-3)] text-center py-6">No quick todos. Enjoy your day! 🎉</p>
                  )}
                </div>
              </div>

              <div className="text-xs text-[var(--text-3)] text-center border-t border-[var(--border)] pt-3 mt-4">
                Saved in local state · {todos.filter(t => t.completed).length}/{todos.length} completed
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Employee Dashboard: Redesigned Dashboard cards & charts */}
          <div className="kpi-grid-4">
            <KpiCard
              label="My Clock-In Status"
              value={recentAttendance.find((a: any) => a.userId === user?.id)?.clockIn ? 'Present' : 'Not Scanned'}
              icon={Clock}
              iconBg={recentAttendance.find((a: any) => a.userId === user?.id)?.clockIn ? 'var(--green-soft)' : 'var(--accent-soft)'}
              iconColor={recentAttendance.find((a: any) => a.userId === user?.id)?.clockIn ? 'var(--green)' : 'var(--accent)'}
              subValue={recentAttendance.find((a: any) => a.userId === user?.id)?.status || 'Absent'}
              subLabel="today"
              subColor={recentAttendance.find((a: any) => a.userId === user?.id)?.status === 'present' ? '#22c55e' : '#ef4444'}
              linkLabel="View history"
              onLinkClick={() => router.push('/attendance')}
            />
            <KpiCard
              label="Tasks Completed"
              value={tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'done').length}
              icon={CheckCircle}
              iconBg="var(--blue-soft)"
              iconColor="var(--blue)"
              subValue={`${tasks.filter((t: any) => t.assigneeId === user?.id).length} total`}
              subLabel="assigned tasks"
              linkLabel="Board"
              onLinkClick={() => router.push('/tasks')}
            />
            <KpiCard
              label="In Progress"
              value={tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'in_progress').length}
              icon={Briefcase}
              iconBg="var(--kpi-orange-bg)"
              iconColor="var(--accent)"
              subValue={tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'review').length}
              subLabel="waiting review"
            />
            <KpiCard
              label="Holiday Leaves"
              value={stats?.onLeave ?? 0}
              icon={Calendar}
              iconBg="var(--purple-soft)"
              iconColor="var(--purple)"
              subValue="Stable"
              subLabel="team presence"
              linkLabel="Request leave"
              onLinkClick={() => router.push('/leave')}
            />
          </div>

          <div className="chart-row">
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title">Weekly Attendance Overview</h3>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Present</span>
                  <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Late</span>
                </div>
              </div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
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
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-3)' }} axisLine={false} tickLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="present" name="Present" stroke="#10b981" strokeWidth={2} fill="url(#presentGrad)" />
                    <Area type="monotone" dataKey="late" name="Late" stroke="#f59e0b" strokeWidth={2} fill="url(#lateGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title">My Tasks Status</h3>
              </div>
              <div style={{ width: '100%', height: 240 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Done', value: tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'done').length, color: 'var(--green)' },
                        { name: 'In Progress', value: tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'in_progress').length, color: 'var(--accent)' },
                        { name: 'Review', value: tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'review').length, color: 'var(--yellow)' },
                        { name: 'Todo', value: tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'todo').length, color: 'var(--blue)' },
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={70}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {[
                        { name: 'Done', value: tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'done').length, color: 'var(--green)' },
                        { name: 'In Progress', value: tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'in_progress').length, color: 'var(--accent)' },
                        { name: 'Review', value: tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'review').length, color: 'var(--yellow)' },
                        { name: 'Todo', value: tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'todo').length, color: 'var(--blue)' },
                      ].filter(d => d.value > 0).map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-3 mt-2 border-t border-[var(--border)]">
                <div className="flex items-center gap-1.5 text-[var(--text-2)]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Done: <strong className="text-[var(--text-1)]">{tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'done').length}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--text-2)]">
                  <span className="w-2 h-2 rounded-full bg-orange-500" />
                  In Progress: <strong className="text-[var(--text-1)]">{tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'in_progress').length}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--text-2)]">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  Review: <strong className="text-[var(--text-1)]">{tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'review').length}</strong>
                </div>
                <div className="flex items-center gap-1.5 text-[var(--text-2)]">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Todo: <strong className="text-[var(--text-1)]">{tasks.filter((t: any) => t.assigneeId === user?.id && t.status === 'todo').length}</strong>
                </div>
              </div>
            </div>
          </div>

          <div className="chart-row">
            {/* Clock in/out Logs */}
            <div className="card flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="section-title">My Swipe History</h3>
                <span className="text-[var(--text-3)] text-xs">This Month</span>
              </div>
              <div className="space-y-3">
                {recentAttendance.filter((a: any) => a.userId === user?.id).length === 0 ? (
                  <div className="empty-state">
                    <span style={{ fontSize: 28 }}>📋</span>
                    No clock records today
                  </div>
                ) : (
                  recentAttendance.filter((a: any) => a.userId === user?.id).map((a: any) => (
                    <div key={a.id || a.userId} className="flex justify-between items-center text-xs p-2 bg-[var(--bg-surface-2)] rounded-[var(--radius-md)] border border-[var(--border)]">
                      <div>
                        <p className="font-semibold text-[var(--text-1)]">{a.date}</p>
                        <p className="text-[10px] text-[var(--text-3)]">RFID scan</p>
                      </div>
                      <div className="text-right">
                        <span className={`badge ${a.status === 'present' ? 'badge-green' : 'badge-yellow'}`}>
                          {a.status}
                        </span>
                        <p className="text-[10px] text-[var(--text-3)] mt-1 font-mono">{a.clockIn || '—'} - {a.clockOut || '—'}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* My Active Tasks */}
            <div className="card flex flex-col justify-between lg:col-span-1">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="section-title">My Outstanding Tasks</h3>
                  <Link href="/tasks" className="text-xs font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)] transition-colors">
                    View board →
                  </Link>
                </div>
                <div className="space-y-3">
                  {tasks.filter((t: any) => t.assigneeId === user?.id && t.status !== 'done').length === 0 ? (
                    <div className="empty-state">
                      <span style={{ fontSize: 28 }}>📋</span>
                      All caught up! No pending tasks 🎉
                    </div>
                  ) : (
                    tasks.filter((t: any) => t.assigneeId === user?.id && t.status !== 'done').slice(0, 4).map((task: any) => (
                      <div key={task.id} className="flex items-center justify-between p-3 bg-[var(--bg-surface-2)] rounded-[var(--radius-md)] border border-[var(--border)] hover:border-[var(--border-strong)] transition-colors text-xs">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            task.priority === 'critical' ? 'bg-red-500' : task.priority === 'high' ? 'bg-orange-500' : 'bg-blue-500'
                          }`} />
                          <div className="min-w-0">
                            <p className="font-semibold text-[var(--text-1)] truncate">{task.title}</p>
                            <p className="text-[10px] text-[var(--text-3)]">Due {new Date(task.dueDate).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <span className={`badge ${
                          task.status === 'in_progress' ? 'badge-orange' : task.status === 'review' ? 'badge-yellow' : 'badge-blue'
                        }`}>
                          {task.status.replace('_', ' ')}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
