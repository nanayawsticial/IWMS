'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

const TOOLTIP_STYLE = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: '8px',
  color: 'var(--text-1)',
  padding: '10px 14px',
  fontSize: '12px',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color || 'var(--text-1)' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
}
import {
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { hrApi, leavesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import KpiCard from '@/components/KpiCard';
import {
  Users,
  UserCheck,
  Calendar as CalendarIcon,
  UserPlus,
  HeartHandshake,
  Search,
  X,
  Check,
  Briefcase,
  AlertCircle,
  FileText,
  UserMinus,
  ClipboardList,
  Mail,
  Phone,
  Building,
  DollarSign
} from 'lucide-react';

type Tab = 'dashboard' | 'directory' | 'leaves' | 'headcount';

const ONBOARDING_STEPS = [
  'Sign employment contract',
  'Submit identity & bank documents',
  'Configure workspace & laptop',
  'Issue RFID badge & register card',
  'Security & compliance briefing'
];

export default function HrDashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Search & Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Slide-in inspector state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [inspectorTab, setInspectorTab] = useState<'overview' | 'employment' | 'onboarding' | 'offboarding'>('overview');

  // Local state for employee onboarding checklist overrides
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({});

  // Verify HR access
  const isHr = useMemo(() => {
    if (!user) return false;
    if (['super_admin', 'admin', 'hr_manager'].includes(user.role)) return true;
    const dept = (typeof user.department === 'string' ? user.department : (user.department as any)?.name || '').toLowerCase();
    return dept.includes('hr') || dept.includes('human resource');
  }, [user]);

  // Queries
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['hr-dashboard'],
    queryFn: () => hrApi.getDashboard(),
    enabled: isHr
  });

  const { data: employees = [], isLoading: employeesLoading } = useQuery({
    queryKey: ['hr-employees'],
    queryFn: () => hrApi.listEmployees(),
    enabled: isHr
  });

  const { data: leaveRequests = [], isLoading: leavesLoading } = useQuery({
    queryKey: ['hr-leave-requests'],
    queryFn: () => hrApi.listLeaveRequests(),
    enabled: isHr
  });

  const { data: headcountData, isLoading: headcountLoading } = useQuery({
    queryKey: ['hr-headcount'],
    queryFn: () => hrApi.getHeadcount(),
    enabled: isHr
  });

  // Fetch individual employee detail for inspector
  const { data: employeeDetail } = useQuery({
    queryKey: ['hr-employee', selectedEmployeeId],
    queryFn: () => hrApi.getEmployee(selectedEmployeeId!),
    enabled: isHr && !!selectedEmployeeId
  });

  // Mutations
  const approveLeaveMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes?: string }) =>
      leavesApi.approve(id, { status, managerNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-leave-requests'] });
      queryClient.invalidateQueries({ queryKey: ['hr-dashboard'] });
    }
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => hrApi.updateProfile(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employee', selectedEmployeeId] });
    }
  });

  const onboardMutation = useMutation({
    mutationFn: (id: string) => hrApi.onboard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employee', selectedEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr-dashboard'] });
    }
  });

  const offboardMutation = useMutation({
    mutationFn: (id: string) => hrApi.offboard(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-employees'] });
      queryClient.invalidateQueries({ queryKey: ['hr-employee', selectedEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ['hr-dashboard'] });
    }
  });

  // Leave Calendar computations (simple month grid)
  const calendarDays = useMemo(() => {
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysArray = [];

    // Map leave requests to calendar days
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      // Find employees on leave today
      const employeesOnLeave = employees.filter((emp: any) => {
        // Mock leaves check or check against active today list
        const activeLeaves = dashboard?.openLeaves || [];
        return activeLeaves.some((l: any) => l.userName === emp.name);
      });

      daysArray.push({
        day,
        dateStr,
        leaves: employeesOnLeave.map((e: any) => e.name)
      });
    }
    return daysArray;
  }, [employees, dashboard?.openLeaves]);

  // Filters employee directory list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp: any) => {
      const matchesSearch = emp.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            emp.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            emp.position.toLowerCase().includes(searchQuery.toLowerCase());
      
      const empStatus = emp.employeeProfile?.onboardingStatus === 'complete' ? 'active' : 'probation';
      const matchesStatus = statusFilter === 'all' || empStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [employees, searchQuery, statusFilter]);

  if (!isHr) {
    return (
      <div className="page-content flex flex-col items-center justify-center min-h-[60vh] text-center">
        <HeartHandshake size={48} className="text-red-500 mb-4" />
        <h2 className="text-red-500 text-lg font-bold mb-2">Access Restricted</h2>
        <p className="text-[var(--text-3)] text-sm mb-4">You do not have the required permissions to view the HR dashboard.</p>
        <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold text-[var(--text-1)] flex items-center gap-2">
            <HeartHandshake className="text-[var(--accent)]" size={24} />
            HR Lifecycle Manager
          </h1>
          <p className="page-subtitle text-xs text-[var(--text-3)] mt-1">
            Track onboarding checklists, directory records, and approved leave calendars.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="flex items-center gap-1.5 p-0.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl">
          {(['dashboard', 'directory', 'leaves', 'headcount'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedEmployeeId(null); }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors ${activeTab === tab ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {dashboardLoading ? (
            <div className="text-center py-10 text-[var(--text-3)]">Loading Dashboard Stats...</div>
          ) : (
            <>
              {/* KPIs Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                <KpiCard
                  title="Total Headcount"
                  value={dashboard?.totalEmployees ?? 0}
                  icon={Users}
                  iconBg="var(--blue-soft)"
                  iconColor="var(--blue)"
                  trend={{ value: `+${dashboard?.newHiresThisMonth ?? 0}`, isPositive: true, label: 'new this month' }}
                />
                <KpiCard
                  title="On Probation"
                  value={dashboard?.onProbation ?? 0}
                  icon={UserCheck}
                  iconBg="var(--yellow-soft)"
                  iconColor="var(--yellow)"
                  trend={{ value: 'Incomplete', isPositive: false, label: 'onboardings' }}
                />
                <KpiCard
                  title="On Leave Today"
                  value={dashboard?.onLeaveToday ?? 0}
                  icon={CalendarIcon}
                  iconBg="var(--purple-soft)"
                  iconColor="var(--purple)"
                  trend={{ value: `${dashboard?.openLeaveRequestsCount ?? 0} pending`, isPositive: true, label: 'requests' }}
                />
                <KpiCard
                  title="Probation Endings"
                  value={dashboard?.upcomingContractEndings ?? 0}
                  icon={AlertCircle}
                  iconBg="var(--red-soft)"
                  iconColor="var(--red)"
                  trend={{ value: 'Next 30 days', isPositive: false, label: 'actions needed' }}
                />
              </div>

              {/* Charts & Leave Approvals */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Department Distribution Chart */}
                <div className="card lg:col-span-2">
                  <h3 className="section-title mb-4">Department Distribution</h3>
                  <div className="w-full h-[220px]">
                    {dashboard?.headcountByDepartment?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.headcountByDepartment} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" stroke="var(--text-3)" fontSize={11} width={80} tickLine={false} axisLine={false} />
                          <Bar dataKey="headcount" fill="var(--accent)" radius={[0, 4, 4, 0]} barSize={8} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-[var(--text-3)] text-xs py-10">No headcount logs</p>
                    )}
                  </div>
                </div>

                {/* Employment Type Pie Chart */}
                <div className="card">
                  <h3 className="section-title mb-4">Employment Structure</h3>
                  <div className="w-full h-[160px] relative flex items-center justify-center">
                    {dashboard?.employmentTypeBreakdown?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboard.employmentTypeBreakdown}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {dashboard.employmentTypeBreakdown.map((entry: any, index: number) => {
                              const colors = ['var(--green)', 'var(--blue)', 'var(--accent)', 'var(--purple)'];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-[var(--text-3)] text-xs py-10">No structure logs</p>
                    )}
                  </div>
                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-[var(--border)] mt-4">
                    {dashboard?.employmentTypeBreakdown?.map((item: any, i: number) => {
                      const colors = ['var(--green)', 'var(--blue)', 'var(--accent)', 'var(--purple)'];
                      return (
                        <div key={item.name} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full block" style={{ background: colors[i % colors.length] }} />
                          <span className="text-[var(--text-2)] truncate">{item.name}: <strong className="text-[var(--text-1)]">{item.value}</strong></span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Lower Section: Pending Approvals & Activity Feed */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Pending Leave Requests */}
                <div className="card lg:col-span-2">
                  <h3 className="section-title mb-4">Leave Requests review</h3>
                  <div className="space-y-3">
                    {leaveRequests.slice(0, 4).map((l: any) => (
                      <div key={l.id} className="flex items-center justify-between p-3 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-xs">
                        <div>
                          <p className="font-semibold text-[var(--text-1)]">{l.userName}</p>
                          <p className="text-[10px] text-[var(--text-3)]">{l.department} · {l.type} leave</p>
                          <p className="text-[10px] text-[var(--text-2)] mt-1">{l.startDate} to {l.endDate}</p>
                          {l.reason && <p className="text-[10px] text-[var(--text-3)] mt-1 italic">"{l.reason}"</p>}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => approveLeaveMutation.mutate({ id: l.id, status: 'rejected' })}
                            className="px-2.5 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-md font-semibold transition-colors"
                          >
                            Reject
                          </button>
                          <button
                            onClick={() => approveLeaveMutation.mutate({ id: l.id, status: 'approved' })}
                            className="px-2.5 py-1.5 bg-[var(--green-soft)] hover:bg-emerald-500/25 text-[var(--green)] rounded-md font-semibold transition-colors"
                          >
                            Approve
                          </button>
                        </div>
                      </div>
                    ))}
                    {leaveRequests.length === 0 && (
                      <p className="text-center text-[var(--text-3)] py-6">All leave reviews completed! 🎉</p>
                    )}
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="card">
                  <h3 className="section-title mb-4">Onboarding & Activity Log</h3>
                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {dashboard?.recentActivity?.map((a: any) => (
                      <div key={a.id} className="text-xs">
                        <p className="text-[var(--text-1)] leading-relaxed">{a.text}</p>
                        <p className="text-[10px] text-[var(--text-3)] mt-0.5 font-mono">{new Date(a.time).toLocaleTimeString()}</p>
                      </div>
                    ))}
                    {dashboard?.recentActivity?.length === 0 && (
                      <p className="text-center text-[var(--text-3)] py-6">No recent HR activity logged.</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'directory' && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="relative w-full sm:max-w-xs">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-[var(--text-3)]">
                <Search size={16} />
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search name, position, email..."
                className="w-full pl-10 pr-4 py-1.5 text-xs bg-[var(--bg-surface)] border border-[var(--border)] rounded-[var(--radius-md)] text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="flex items-center gap-1.5 p-0.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${statusFilter === 'all' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
              >
                All Employees
              </button>
              <button
                onClick={() => setStatusFilter('active')}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${statusFilter === 'active' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
              >
                Active
              </button>
              <button
                onClick={() => setStatusFilter('probation')}
                className={`px-3 py-1 text-[11px] font-medium rounded-md transition-colors ${statusFilter === 'probation' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
              >
                On Probation
              </button>
            </div>
          </div>

          {/* Directory table */}
          {employeesLoading ? (
            <div className="text-center py-10 text-[var(--text-3)]">Loading Employee List...</div>
          ) : (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-[10px] uppercase font-semibold">
                      <th className="py-2.5">Name</th>
                      <th className="py-2.5">Position</th>
                      <th className="py-2.5">Department</th>
                      <th className="py-2.5">Onboarding Status</th>
                      <th className="py-2.5">Employment</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredEmployees.map((emp: any) => {
                      const isComplete = emp.employeeProfile?.onboardingStatus === 'complete';
                      return (
                        <tr
                          key={emp.id}
                          onClick={() => { setSelectedEmployeeId(emp.id); setInspectorTab('overview'); }}
                          className="hover:bg-[var(--bg-hover)]/20 cursor-pointer transition-colors"
                        >
                          <td className="py-3">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center font-bold text-[var(--text-1)]">
                                {emp.avatar || emp.name[0]}
                              </div>
                              <div>
                                <strong className="text-xs text-[var(--text-1)] block">{emp.name}</strong>
                                <span className="text-[10px] text-[var(--text-3)]">{emp.email}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-[var(--text-2)]">{emp.position || '—'}</td>
                          <td className="py-3 text-[var(--text-2)]">{emp.department}</td>
                          <td className="py-3">
                            <span className={`badge ${isComplete ? 'badge-green' : 'badge-yellow'}`}>
                              {isComplete ? 'Onboarded' : 'Pending Checklist'}
                            </span>
                          </td>
                          <td className="py-3 capitalize text-[var(--text-2)]">
                            {emp.employeeProfile?.employmentType?.replace('_', ' ') || 'Full Time'}
                          </td>
                          <td className="py-3 text-right">
                            <button className="text-[var(--accent)] font-semibold hover:underline">
                              Inspect →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'leaves' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Leave Calendar */}
          <div className="card lg:col-span-2">
            <h3 className="section-title mb-4">Approved Leaves Calendar</h3>
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-bold text-[var(--text-3)] mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                <div key={day} className="py-1">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((d, index) => (
                <div
                  key={index}
                  className="min-h-[64px] p-1 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-md flex flex-col justify-between"
                >
                  <span className="text-[10px] font-bold text-[var(--text-3)]">{d.day}</span>
                  <div className="space-y-1">
                    {d.leaves.map((name: string, i: number) => (
                      <span
                        key={i}
                        className="block text-[8px] bg-[var(--accent-soft)] text-[var(--accent)] rounded px-1 py-0.5 truncate max-w-full font-semibold"
                        title={`${name} is on leave`}
                      >
                        {name.split(' ')[0]}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Pending Leave approvals */}
          <div className="card flex flex-col justify-between">
            <div>
              <h3 className="section-title mb-4">Pending Leave requests</h3>
              <div className="space-y-4">
                {leaveRequests.map((l: any) => (
                  <div key={l.id} className="p-3 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl text-xs">
                    <p className="font-semibold text-[var(--text-1)]">{l.userName}</p>
                    <p className="text-[10px] text-[var(--text-3)]">{l.department} · {l.type} leave</p>
                    <p className="text-[10px] text-[var(--text-2)] mt-1.5">{l.startDate} to {l.endDate}</p>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => approveLeaveMutation.mutate({ id: l.id, status: 'rejected' })}
                        className="flex-1 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-500 rounded-md font-semibold transition-colors text-center"
                      >
                        Reject
                      </button>
                      <button
                        onClick={() => approveLeaveMutation.mutate({ id: l.id, status: 'approved' })}
                        className="flex-1 py-1 bg-[var(--green-soft)] hover:bg-emerald-500/25 text-[var(--green)] rounded-md font-semibold transition-colors text-center"
                      >
                        Approve
                      </button>
                    </div>
                  </div>
                ))}
                {leaveRequests.length === 0 && (
                  <p className="text-xs text-[var(--text-3)] text-center py-10">No pending leave requests</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'headcount' && (
        <div className="space-y-6">
          {headcountLoading ? (
            <div className="text-center py-10 text-[var(--text-3)]">Loading Headcount Trends...</div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Month-over-month trend line chart */}
              <div className="card lg:col-span-2">
                <h3 className="section-title mb-4">Headcount MoM Trend</h3>
                <div className="w-full h-[240px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={[
                        { month: 'Jan', headcount: 18 },
                        { month: 'Feb', headcount: 20 },
                        { month: 'Mar', headcount: 21 },
                        { month: 'Apr', headcount: 24 },
                        { month: 'May', headcount: 25 },
                        { month: 'Jun', headcount: employees.length },
                      ]}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis dataKey="month" stroke="var(--text-3)" fontSize={11} />
                      <YAxis stroke="var(--text-3)" fontSize={11} />
                      <Tooltip content={<CustomTooltip />} />
                      <Line type="monotone" dataKey="headcount" name="Headcount" stroke="var(--accent)" strokeWidth={2} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Department Headcount Breakdown */}
              <div className="card">
                <h3 className="section-title mb-4">Headcount breakdown</h3>
                <div className="space-y-3">
                  {headcountData?.byDepartment?.map((dept: any) => (
                    <div key={dept.name} className="flex justify-between items-center text-xs p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg">
                      <span className="font-semibold text-[var(--text-1)]">{dept.name}</span>
                      <span className="badge badge-blue">{dept.headcount} active</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide-out Employee Inspector Panel */}
      {selectedEmployeeId && employeeDetail && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000] flex justify-end"
          onClick={() => setSelectedEmployeeId(null)}
        >
          <div
            className="w-full max-w-[480px] h-full bg-[var(--bg-surface)] border-l border-[var(--border)] p-6 flex flex-col shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Inspector Header */}
            <div className="flex items-center justify-between mb-6 border-b border-[var(--border)] pb-4">
              <div>
                <span className="text-[10px] font-bold text-[var(--accent)] tracking-wider uppercase">Employee profile inspector</span>
                <h2 className="text-lg font-extrabold text-[var(--text-1)] mt-1">{employeeDetail.user.name}</h2>
                <p className="text-[11px] text-[var(--text-3)]">{employeeDetail.user.position || 'Employee'} · {employeeDetail.user.department}</p>
              </div>
              <button
                onClick={() => setSelectedEmployeeId(null)}
                className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] text-[var(--text-3)] hover:text-[var(--text-1)] flex items-center justify-center transition-colors cursor-pointer border border-[var(--border)]"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Inspector Tab switcher */}
            <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl mb-6">
              {(['overview', 'employment', 'onboarding', 'offboarding'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setInspectorTab(tab)}
                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg capitalize transition-colors ${inspectorTab === tab ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Inspector Tab Content */}
            {inspectorTab === 'overview' && (
              <div className="space-y-5 text-xs">
                <div className="p-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl space-y-3">
                  <h4 className="font-semibold text-[var(--text-1)] uppercase text-[10px] tracking-wider mb-2">Contact Details</h4>
                  <div className="flex items-center gap-2 text-[var(--text-2)]">
                    <Mail size={14} className="text-[var(--text-3)]" />
                    <span>{employeeDetail.user.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[var(--text-2)]">
                    <Phone size={14} className="text-[var(--text-3)]" />
                    <span>{employeeDetail.user.phone || '—'}</span>
                  </div>
                </div>

                <div className="p-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl space-y-3">
                  <h4 className="font-semibold text-[var(--text-1)] uppercase text-[10px] tracking-wider mb-2">Emergency Contact</h4>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Name:</span>
                    <span className="font-medium text-[var(--text-1)]">{employeeDetail.user.employeeProfile?.emergencyContact || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Phone:</span>
                    <span className="font-medium text-[var(--text-1)]">{employeeDetail.user.employeeProfile?.emergencyPhone || '—'}</span>
                  </div>
                </div>

                <div className="p-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl">
                  <h4 className="font-semibold text-[var(--text-1)] uppercase text-[10px] tracking-wider mb-2">Recent Attendance Log</h4>
                  <div className="space-y-2">
                    {employeeDetail.attendance?.slice(0, 3).map((r: any) => (
                      <div key={r.date} className="flex justify-between items-center text-[11px] py-1 border-b border-[var(--border)] last:border-b-0">
                        <span className="text-[var(--text-2)]">{r.date}</span>
                        <span className={`badge ${r.status === 'present' ? 'badge-green' : 'badge-yellow'}`}>{r.status}</span>
                      </div>
                    ))}
                    {employeeDetail.attendance?.length === 0 && (
                      <p className="text-center text-[var(--text-3)] py-2">No attendance logs</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {inspectorTab === 'employment' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl space-y-3">
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Role:</span>
                    <span className="font-medium text-[var(--text-1)]">{employeeDetail.user.role}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Employment Type:</span>
                    <span className="font-medium text-[var(--text-1)] capitalize">{employeeDetail.user.employeeProfile?.employmentType?.replace('_', ' ') || 'Full Time'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Join Date:</span>
                    <span className="font-medium text-[var(--text-1)] font-mono">{employeeDetail.user.joinDate || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Salary Band:</span>
                    <span className="font-medium text-[var(--green)]">GHS {employeeDetail.user.employeeProfile?.salary || '—'}</span>
                  </div>
                </div>

                <div className="p-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl space-y-3">
                  <h4 className="font-semibold text-[var(--text-1)] uppercase text-[10px] tracking-wider mb-2">Bank Account</h4>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Bank Name:</span>
                    <span className="font-medium text-[var(--text-1)]">{employeeDetail.user.employeeProfile?.bankName || '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--text-3)]">Account Number:</span>
                    <span className="font-medium text-[var(--text-1)] font-mono">{employeeDetail.user.employeeProfile?.bankAccount || '—'}</span>
                  </div>
                </div>
              </div>
            )}

            {inspectorTab === 'onboarding' && (
              <div className="space-y-5 text-xs">
                <div className="p-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl space-y-3">
                  <h4 className="font-semibold text-[var(--text-1)] uppercase text-[10px] tracking-wider mb-3">Onboarding Checklist</h4>
                  
                  {ONBOARDING_STEPS.map((step, idx) => {
                    const stepId = `${employeeDetail.user.id}-${idx}`;
                    const isChecked = completedSteps[stepId] || employeeDetail.user.employeeProfile?.onboardingStatus === 'complete';
                    
                    return (
                      <div key={idx} className="flex items-start gap-2.5 py-1.5">
                        <button
                          onClick={() => setCompletedSteps(prev => ({ ...prev, [stepId]: !prev[stepId] }))}
                          disabled={employeeDetail.user.employeeProfile?.onboardingStatus === 'complete'}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${isChecked ? 'bg-[var(--green)] border-[var(--green)] text-white' : 'border-[var(--border-strong)] bg-transparent'}`}
                        >
                          {isChecked && <Check size={12} />}
                        </button>
                        <span className={`text-xs ${isChecked ? 'text-[var(--text-3)] line-through' : 'text-[var(--text-1)]'}`}>{step}</span>
                      </div>
                    );
                  })}
                </div>

                {employeeDetail.user.employeeProfile?.onboardingStatus !== 'complete' && (
                  <button
                    onClick={() => onboardMutation.mutate(employeeDetail.user.id)}
                    className="w-full py-2.5 bg-[var(--green)] hover:bg-emerald-600 text-white rounded-lg font-bold text-center transition-colors cursor-pointer"
                  >
                    Mark Onboarding as Complete
                  </button>
                )}
              </div>
            )}

            {inspectorTab === 'offboarding' && (
              <div className="space-y-4 text-xs">
                <div className="p-4 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl space-y-3">
                  <h4 className="font-semibold text-red-500 uppercase text-[10px] tracking-wider mb-2">Offboarding Actions</h4>
                  <p className="text-[var(--text-3)] leading-relaxed mb-4">
                    Initiating offboarding changes the employee profile state and revokes biometric device access.
                  </p>

                  {employeeDetail.user.employeeProfile?.offboardingStatus ? (
                    <div className="badge badge-red text-center py-2 w-full font-bold uppercase tracking-wider block">
                      Offboarding Status: {employeeDetail.user.employeeProfile.offboardingStatus}
                    </div>
                  ) : (
                    <button
                      onClick={() => offboardMutation.mutate(employeeDetail.user.id)}
                      className="w-full py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-bold text-center transition-colors cursor-pointer"
                    >
                      Initiate Employee Offboarding
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
