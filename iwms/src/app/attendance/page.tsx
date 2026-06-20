'use client';

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, departmentsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocketEvent } from '@/hooks/useSocket';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import {
  Globe,
  Smartphone,
  QrCode,
  Cpu,
  Clock,
  Check,
  X,
  Search,
  Download,
  AlertTriangle,
  Calendar,
  ChevronDown,
  ChevronRight,
  Edit,
  User,
  Fingerprint,
  Moon,
  Coffee
} from 'lucide-react';

const STATUS_STYLES: Record<string, { color: string; badgeClass: string; label: string }> = {
  present:  { color: 'var(--green)', badgeClass: 'badge-green', label: 'Present' },
  late:     { color: 'var(--yellow)', badgeClass: 'badge-yellow', label: 'Late' },
  absent:   { color: 'var(--red)', badgeClass: 'badge-red', label: 'Absent' },
  half_day: { color: 'var(--blue)', badgeClass: 'badge-blue', label: 'Half Day' },
  on_leave: { color: 'var(--purple)', badgeClass: 'badge-purple', label: 'On Leave' },
};

function ClockWidget() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: todayRecord } = useQuery({
    queryKey: ['attendance', today, user?.id],
    queryFn: () => attendanceApi.list({ date: today, userId: user?.id || '' }),
    select: (records: any[]) => records.find((r: any) => r.userId === user?.id),
    enabled: !!user,
  });

  const clockedIn = !!todayRecord?.clockIn && !todayRecord?.clockOut;
  const clockInTime = todayRecord?.clockIn || null;
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!clockedIn || !clockInTime) return;
    const interval = setInterval(() => {
      const [h, m] = clockInTime.split(':').map(Number);
      const start = new Date();
      start.setHours(h, m, 0, 0);
      setElapsed(Math.max(0, Math.floor((Date.now() - start.getTime()) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [clockedIn, clockInTime]);

  const clockIn = useMutation({
    mutationFn: () => {
      if (navigator.geolocation) {
        return new Promise<any>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            pos => attendanceApi.clockIn({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, method: 'web' }).then(resolve),
            () => attendanceApi.clockIn({ method: 'web' }).then(resolve),
            { timeout: 3000 }
          );
        });
      }
      return attendanceApi.clockIn({ method: 'web' });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const clockOut = useMutation({
    mutationFn: () => attendanceApi.clockOut(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['attendance'] }),
  });

  const formatElapsed = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const isLoading = clockIn.isPending || clockOut.isPending;
  const alreadyClockedOut = !!todayRecord?.clockOut;

  return (
    <div className={`p-5 rounded-xl border border-[var(--border)] bg-[var(--bg-surface-2)] flex flex-col items-center text-center space-y-4`}>
      <div className="relative w-36 h-36 flex items-center justify-center rounded-full border-4 border-[var(--border)]">
        <div className="absolute inset-2 rounded-full bg-[var(--bg-surface)] border border-[var(--border-strong)] flex flex-col items-center justify-center">
          {clockedIn ? (
            <div className="space-y-1">
              <span className="text-xl font-bold font-mono text-[var(--accent)] block leading-none">{formatElapsed(elapsed)}</span>
              <span className="text-xs text-[var(--text-3)] font-semibold uppercase block tracking-wider">Elapsed Time</span>
            </div>
          ) : alreadyClockedOut ? (
            <div className="flex flex-col items-center space-y-1">
              <Fingerprint size={28} className="text-[var(--green)]" />
              <span className="text-xs text-[var(--green)] font-bold uppercase tracking-wider">Clocked Out</span>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-1 text-[var(--text-3)]">
              <Fingerprint size={28} />
              <span className="text-xs font-bold uppercase tracking-wider">Inactive</span>
            </div>
          )}
        </div>
      </div>

      <div className="w-full space-y-3">
        {clockedIn && clockInTime && (
          <p className="text-xs text-[var(--text-2)]">Clocked in since <strong className="text-[var(--text-1)]">{clockInTime}</strong></p>
        )}
        {alreadyClockedOut && (
          <p className="text-xs text-[var(--text-2)]">Worked <strong className="text-[var(--text-1)]">{todayRecord?.hoursWorked?.toFixed(1)} hours</strong> today</p>
        )}
        {!alreadyClockedOut && (
          <button
            className={`w-full py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              clockedIn
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white'
            }`}
            onClick={() => clockedIn ? clockOut.mutate() : clockIn.mutate()}
            disabled={isLoading}
          >
            {isLoading ? 'Processing...' : clockedIn ? 'Clock Out' : 'Clock In'}
          </button>
        )}
        <div className="flex justify-between items-center text-xs text-[var(--text-3)] border-t border-[var(--border)] pt-2.5">
          <span>Reporting Method:</span>
          <span className="font-semibold text-[var(--text-2)] inline-flex items-center gap-1">
            <Globe size={10} /> Web / Geofence
          </span>
        </div>
      </div>
    </div>
  );
}

function AttendancePageContent() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Read initial states from URL query parameters
  const period = searchParams.get('period') || 'today';
  const startDate = searchParams.get('startDate') || new Date().toISOString().split('T')[0];
  const endDate = searchParams.get('endDate') || new Date().toISOString().split('T')[0];
  const statusFilter = searchParams.get('status') || 'all';
  const departmentFilter = searchParams.get('departmentId') || 'all';

  // Toggle state for collapsible dates
  const [collapsedDates, setCollapsedDates] = useState<Record<string, boolean>>({});

  // Helper to update URL search parameters reactively
  const updateQueryParams = (updates: Record<string, string | null>) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === 'all' || value === '') {
        current.delete(key);
      } else {
        current.set(key, value);
      }
    });
    const search = current.toString();
    const query = search ? `?${search}` : '';
    router.replace(`${pathname}${query}`);
  };

  const handlePeriodChange = (newPeriod: string) => {
    updateQueryParams({
      period: newPeriod,
      ...(newPeriod === 'custom' ? {
        startDate: startDate || new Date().toISOString().split('T')[0],
        endDate: endDate || new Date().toISOString().split('T')[0]
      } : {
        startDate: null,
        endDate: null
      })
    });
  };

  const handleStartDateChange = (val: string) => updateQueryParams({ startDate: val });
  const handleEndDateChange = (val: string) => updateQueryParams({ endDate: val });
  const handleStatusChange = (val: string) => updateQueryParams({ status: val });
  const handleDepartmentChange = (val: string) => updateQueryParams({ departmentId: val });

  // Fetch departments list for management dropdown
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
    enabled: ['super_admin', 'admin', 'hr_manager', 'manager'].includes(user?.role || ''),
  });

  // Fetch attendance records based on URL-driven states
  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', period, startDate, endDate, statusFilter, departmentFilter],
    queryFn: () => attendanceApi.list({
      period,
      ...(period === 'custom' ? { startDate, endDate } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      ...(departmentFilter !== 'all' ? { departmentId: departmentFilter } : {}),
    }),
  });

  // Fetch stats based on URL-driven states
  const { data: stats } = useQuery({
    queryKey: ['attendance-stats', period, startDate, endDate, departmentFilter],
    queryFn: () => attendanceApi.stats({
      period,
      ...(period === 'custom' ? { startDate, endDate } : {}),
      ...(departmentFilter !== 'all' ? { departmentId: departmentFilter } : {}),
    }),
  });

  // Synchronize attendance records and stats in real-time when clock in/out occurs
  useSocketEvent<any>('attendance:clockIn', () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
  });

  useSocketEvent<any>('attendance:clockOut', () => {
    queryClient.invalidateQueries({ queryKey: ['attendance'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
  });

  // Correction state
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const correctAttendance = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      attendanceApi.correct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance-stats'] });
      setEditRecord(null);
      setCorrectionReason('');
    },
  });

  const handleEditClick = (record: any) => {
    setEditRecord(record);
    setEditIn(record.clockIn || '');
    setEditOut(record.clockOut || '');
    setEditStatus(record.status);
    setCorrectionReason('');
  };

  const handleCorrectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    correctAttendance.mutate({
      id: editRecord.id,
      data: {
        clockIn: editIn || null,
        clockOut: editOut || null,
        status: editStatus,
        correctionReason,
      },
    });
  };

  // Group records by date if spanning multiple days
  const distinctDates = useMemo(() => {
    return Array.from(new Set(records.map((r: any) => r.date))).sort((a: any, b: any) => b.localeCompare(a));
  }, [records]);
  const isMultiDay = distinctDates.length > 1;

  const groupedRecords = useMemo(() => {
    return records.reduce((groups: Record<string, any[]>, record: any) => {
      const d = record.date;
      if (!groups[d]) groups[d] = [];
      groups[d].push(record);
      return groups;
    }, {});
  }, [records]);

  const sortedDates = useMemo(() => {
    return Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));
  }, [groupedRecords]);

  const toggleDateCollapse = (date: string) => {
    setCollapsedDates(prev => ({ ...prev, [date]: !prev[date] }));
  };

  // Client-side export helper
  const handleExportCSV = () => {
    if (records.length === 0) return;
    const headers = ['Employee', 'Department', 'Clock In', 'Clock Out', 'Hours Worked', 'Method', 'Status', 'Date'];
    const rows = records.map((r: any) => [
      `"${r.userName}"`,
      `"${r.userDepartment}"`,
      `"${r.clockIn || ''}"`,
      `"${r.clockOut || ''}"`,
      `"${r.hoursWorked != null ? r.hoursWorked.toFixed(1) : ''}"`,
      `"${r.method}"`,
      `"${r.status}"`,
      `"${r.date}"`,
    ]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map((e: any) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `attendance_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Upgraded method badge helper utilizing premium Lucide icons
  const renderMethodBadge = (method: string) => {
    const norm = (method || '').toLowerCase();
    if (norm === 'rfid' || norm === 'biometric') {
      return (
        <span className="badge badge-accent inline-flex items-center gap-1 font-semibold">
          <Cpu size={12} className="text-[var(--accent)]" />
          RFID Badge
        </span>
      );
    }
    if (norm === 'web') {
      return (
        <span className="badge badge-blue inline-flex items-center gap-1 font-semibold">
          <Globe size={12} className="text-[var(--blue)]" />
          Web App
        </span>
      );
    }
    if (norm === 'mobile') {
      return (
        <span className="badge badge-green inline-flex items-center gap-1 font-semibold">
          <Smartphone size={12} className="text-[var(--green)]" />
          Mobile App
        </span>
      );
    }
    if (norm === 'qr') {
      return (
        <span className="badge badge-purple inline-flex items-center gap-1 font-semibold">
          <QrCode size={12} className="text-[var(--purple)]" />
          QR Terminal
        </span>
      );
    }
    return (
      <span className="badge badge-yellow inline-flex items-center gap-1 font-semibold">
        <Fingerprint size={12} className="text-[var(--yellow)]" />
        Biometric
      </span>
    );
  };

  return (
    <div className="page-content">
      <div className="page-header flex justify-between items-center">
        <div>
          <h1 className="page-title text-2xl font-bold text-[var(--text-1)]">Attendance Records</h1>
          <p className="page-subtitle text-xs text-[var(--text-3)]">Track and correct employee check-ins, methods, and durations.</p>
        </div>
      </div>

      {/* Stats Summary Panel */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Present Today', value: stats?.present ?? 0, color: 'var(--green)' },
          { label: 'Late Clock Ins', value: stats?.late ?? 0, color: 'var(--yellow)' },
          { label: 'Absent Count', value: stats?.absent ?? 0, color: 'var(--red)' },
          { label: 'On Leave today', value: stats?.onLeave ?? 0, color: 'var(--purple)' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex flex-col justify-between" style={{ borderLeft: `3px solid ${s.color}` }}>
            <span className="value text-2xl font-bold text-[var(--text-1)]">{s.value}</span>
            <span className="label text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mt-1">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters Toolbar */}
      <div className="flex flex-col gap-4 p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl mb-6">
        <div className="flex items-center gap-1 p-0.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[10px] text-sm overflow-x-auto max-w-full hide-scrollbar flex-shrink-0 h-[38px]">
          {['today', 'yesterday', 'week', 'month', 'custom'].map((p) => (
            <button
              key={p}
              onClick={() => handlePeriodChange(p)}
              className={`px-3.5 h-full font-semibold rounded-[8px] transition-all cursor-pointer whitespace-nowrap flex-shrink-0 flex items-center justify-center ${
                period === p ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
              }`}
            >
              {p === 'today' ? 'Today'
               : p === 'yesterday' ? 'Yesterday'
               : p === 'week' ? 'Last 7 Days'
               : p === 'month' ? 'Last 30 Days'
               : 'Custom Range'}
            </button>
          ))}
        </div>

        {/* Sub-Filters: Date selection & status selection */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between pt-3 border-t border-[var(--border)]">
          <div className="flex flex-wrap gap-4 items-center w-full sm:w-auto">
            {period === 'custom' && (
              <div className="flex items-center gap-2">
                <div className="control-compact">
                  <input
                    type="date"
                    value={startDate}
                    onChange={e => handleStartDateChange(e.target.value)}
                  />
                </div>
                <span className="text-sm text-[var(--text-3)]">to</span>
                <div className="control-compact">
                  <input
                    type="date"
                    value={endDate}
                    onChange={e => handleEndDateChange(e.target.value)}
                  />
                </div>
              </div>
            )}

            {['super_admin', 'admin', 'hr_manager', 'manager'].includes(user?.role || '') && (
              <div className="control-compact w-full sm:w-auto">
                <select
                  value={departmentFilter}
                  onChange={e => handleDepartmentChange(e.target.value)}
                >
                  <option value="all">All Departments</option>
                  {departments
                    .filter((d: any) => user?.role !== 'manager' || d.id === user.departmentId)
                    .map((d: any) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
          </div>

          {/* Status pills selector */}
          <div className="flex items-center gap-1.5 p-0.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-[10px] w-full sm:w-auto overflow-x-auto hide-scrollbar h-[38px]">
            {['all', 'present', 'late', 'absent', 'on_leave'].map(s => (
              <button
                key={s}
                className={`px-3 h-full text-xs font-semibold rounded-[8px] transition-colors cursor-pointer capitalize whitespace-nowrap flex-shrink-0 flex items-center justify-center ${
                  statusFilter === s ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'
                }`}
                onClick={() => handleStatusChange(s)}
              >
                {s === 'all' ? 'All' : STATUS_STYLES[s]?.label || s}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main & Side panel content flex layout */}
      <div className="flex flex-col lg:flex-row gap-4 items-start w-full">
        {/* Main table */}
        <div style={{ flex: 1, minWidth: 0 }} className="w-full">
          <div className="card">
            <div className="flex justify-between items-center mb-4">
              <span className="section-title">Attendance Logs</span>
              {hasPermission('export_reports') && (
                <button
                  className="bg-[var(--green-soft)] hover:bg-[var(--green-soft)]/20 text-[var(--green)] font-bold py-1.5 px-3 rounded-lg text-xs flex items-center gap-1.5 border border-[var(--border)] cursor-pointer transition-colors"
                  onClick={handleExportCSV}
                >
                  <Download size={12} /> Export CSV
                </button>
              )}
            </div>

            {isLoading ? (
              <div className="text-center py-20 text-[var(--text-3)]">Loading logs...</div>
            ) : (
              <>
                <div className="mobile-scroll-hint">
                  <span>←</span> Swipe to see all columns <span>→</span>
                </div>
                <div className="table-scroll">
                  <table className="w-full text-left border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-xs uppercase font-semibold">
                        <th className="py-2.5 px-3 sticky-left" style={{ minWidth: '140px' }}>Employee</th>
                        <th className="py-2.5" style={{ minWidth: '120px' }}>Department</th>
                        <th className="py-2.5" style={{ minWidth: '72px' }}>Clock In</th>
                        <th className="py-2.5" style={{ minWidth: '72px' }}>Clock Out</th>
                        <th className="py-2.5" style={{ minWidth: '64px' }}>Hours Worked</th>
                        <th className="py-2.5" style={{ minWidth: '70px' }}>Method</th>
                        <th className="py-2.5" style={{ minWidth: '80px' }}>Status</th>
                        {hasPermission('edit_attendance') && <th className="py-2.5 text-right" style={{ minWidth: '80px' }}>Actions</th>}
                      </tr>
                    </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {isMultiDay ? (
                      sortedDates.map((dateStr) => {
                        const dateRecords = groupedRecords[dateStr] || [];
                        const isCollapsed = !!collapsedDates[dateStr];
                        const dateObj = new Date(dateStr);
                        const formattedDate = isNaN(dateObj.getTime())
                          ? dateStr
                          : dateObj.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                        return (
                          <React.Fragment key={dateStr}>
                            <tr
                              onClick={() => toggleDateCollapse(dateStr)}
                              className="bg-[var(--bg-surface-2)]/60 cursor-pointer select-none font-bold"
                            >
                              <td colSpan={hasPermission('edit_attendance') ? 8 : 7} className="py-2.5 px-3">
                                <div className="flex items-center gap-2 text-xs">
                                  {isCollapsed ? <ChevronRight size={14} className="text-[var(--text-3)]" /> : <ChevronDown size={14} className="text-[var(--text-3)]" />}
                                  <span className="text-[var(--text-1)]">{formattedDate}</span>
                                  <span className="badge badge-blue ml-2 font-mono">
                                    {dateRecords.length} {dateRecords.length === 1 ? 'record' : 'records'}
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {!isCollapsed &&
                              dateRecords.map((r: any) => (
                                <tr key={r.id} className="hover:bg-[var(--bg-hover)]/10 transition-colors">
                                  <td className="py-3 px-3 sticky-left">
                                    <div className="flex items-center gap-2.5">
                                      <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center font-bold text-[var(--text-1)]">
                                        {r.userAvatar || r.userName[0]}
                                      </div>
                                      <div>
                                        <p className="font-semibold text-[var(--text-1)]">{r.userName}</p>
                                        <p className="text-xs text-[var(--text-3)]">{r.userEmail}</p>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 text-[var(--text-2)]">{r.userDepartment}</td>
                                  <td className="py-3 font-mono text-[var(--text-1)]">
                                    <span>{r.clockIn || '—'}</span>
                                    {r.correctedBy && (
                                      <span className="text-xs text-[var(--text-3)] block line-through">
                                        {r.correctedIn || '—'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 font-mono text-[var(--text-1)]">
                                    <span>{r.clockOut || '—'}</span>
                                    {r.correctedBy && (
                                      <span className="text-xs text-[var(--text-3)] block line-through">
                                        {r.correctedOut || '—'}
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 font-mono text-[var(--text-2)]">{r.hoursWorked != null ? `${r.hoursWorked.toFixed(1)}h` : '—'}</td>
                                  <td className="py-3">{renderMethodBadge(r.method)}</td>
                                  <td className="py-3">
                                    <div className="flex items-center gap-1.5">
                                      <span className={`badge ${STATUS_STYLES[r.status]?.badgeClass || 'badge-yellow'} uppercase font-bold text-[10px]`}>
                                        {STATUS_STYLES[r.status]?.label || r.status}
                                      </span>
                                      {r.correctedBy && (
                                        <span
                                          className="cursor-help text-xs"
                                          title={`Correction by: ${r.correctedBy}\nReason: ${r.correctionReason}`}
                                        >
                                          ✏️
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  {hasPermission('edit_attendance') && (
                                    <td className="py-3 text-right">
                                      <button className="text-[var(--accent)] font-semibold hover:underline cursor-pointer" onClick={() => handleEditClick(r)}>
                                        Correct
                                      </button>
                                    </td>
                                  )}
                                </tr>
                              ))}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      records.map((r: any) => (
                        <tr key={r.id} className="hover:bg-[var(--bg-hover)]/10 transition-colors">
                          <td className="py-3 px-3 sticky-left">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center font-bold text-[var(--text-1)]">
                                {r.userAvatar || r.userName[0]}
                              </div>
                              <div>
                                <p className="font-semibold text-[var(--text-1)]">{r.userName}</p>
                                <p className="text-xs text-[var(--text-3)]">{r.userEmail}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 text-[var(--text-2)]">{r.userDepartment}</td>
                          <td className="py-3 font-mono text-[var(--text-1)]">
                            <span>{r.clockIn || '—'}</span>
                            {r.correctedBy && (
                              <span className="text-xs text-[var(--text-3)] block line-through">
                                {r.correctedIn || '—'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-mono text-[var(--text-1)]">
                            <span>{r.clockOut || '—'}</span>
                            {r.correctedBy && (
                              <span className="text-xs text-[var(--text-3)] block line-through">
                                {r.correctedOut || '—'}
                              </span>
                            )}
                          </td>
                          <td className="py-3 font-mono text-[var(--text-2)]">{r.hoursWorked != null ? `${r.hoursWorked.toFixed(1)}h` : '—'}</td>
                          <td className="py-3">{renderMethodBadge(r.method)}</td>
                          <td className="py-3">
                            <div className="flex items-center gap-1.5">
                              <span className={`badge ${STATUS_STYLES[r.status]?.badgeClass || 'badge-yellow'} uppercase font-bold text-[10px]`}>
                                {STATUS_STYLES[r.status]?.label || r.status}
                              </span>
                              {r.correctedBy && (
                                <span
                                  className="cursor-help text-xs"
                                  title={`Correction by: ${r.correctedBy}\nReason: ${r.correctionReason}`}
                                >
                                  ✏️
                                </span>
                              )}
                            </div>
                          </td>
                          {hasPermission('edit_attendance') && (
                            <td className="py-3 text-right">
                              <button className="text-[var(--accent)] font-semibold hover:underline cursor-pointer" onClick={() => handleEditClick(r)}>
                                Correct
                              </button>
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                    {records.length === 0 && (
                      <tr>
                        <td colSpan={hasPermission('edit_attendance') ? 8 : 7}>
                          <div className="empty-state">No attendance records for this period</div>
                        </td>
                      </tr>
                    )}

                    {/* Summary Row */}
                    {isMultiDay && records.length > 0 && (() => {
                      let totalHoursWorked = 0;
                      let lateDays = 0;
                      records.forEach((r: any) => {
                        if (r.hoursWorked) totalHoursWorked += r.hoursWorked;
                        if (r.status === 'late') lateDays++;
                      });
                      const avgDailyHours = distinctDates.length > 0 ? (totalHoursWorked / distinctDates.length) : 0;

                      return (
                        <tr className="bg-[var(--accent-soft)]/20 font-bold">
                          <td colSpan={2} className="py-3 px-3 text-[var(--text-1)]">Summary ({distinctDates.length} Days)</td>
                          <td colSpan={2} className="py-3 text-[var(--yellow)]">Late Logs: {lateDays}</td>
                          <td className="py-3 text-[var(--green)] font-mono">Total: {totalHoursWorked.toFixed(1)}h</td>
                          <td colSpan={hasPermission('edit_attendance') ? 3 : 2} className="py-3 text-[var(--blue)] font-mono">Avg/Day: {avgDailyHours.toFixed(1)}h</td>
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
        </div>

        {/* Side panel */}
        <div style={{ width: 260, flexShrink: 0 }} className="w-full lg:w-auto space-y-6">
          <div className="card">
            <h3 className="section-title mb-4">Clock Widget</h3>
            <ClockWidget />
          </div>
          <div className="card">
            <h3 className="section-title mb-4">Period Overview</h3>
            <div className="space-y-4">
              {[
                { label: 'Total Employees', value: stats?.totalEmployees ?? 0, color: 'text-[var(--blue)]' },
                { label: 'Attendance Rate', value: `${stats?.attendanceRate ?? 0}%`, color: 'text-[var(--green)]' },
                { label: 'Missing Logs', value: stats?.notRecorded ?? 0, color: 'text-[var(--yellow)]' },
              ].map(s => (
                <div key={s.label} className="flex justify-between items-center text-xs p-2.5 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-xl">
                  <span className="text-[var(--text-3)] font-semibold">{s.label}</span>
                  <span className={`font-bold font-mono ${s.color}`}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Correction Modal */}
      {editRecord && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4" onClick={() => setEditRecord(null)}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl w-full max-w-sm p-6 relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <button className="absolute top-4 right-4 text-[var(--text-3)] hover:text-[var(--text-1)] cursor-pointer" onClick={() => setEditRecord(null)}>
              <X size={18} />
            </button>
            <h3 className="text-sm font-extrabold text-[var(--text-1)] mb-4 uppercase tracking-wide">Correct Attendance</h3>
            
            <form onSubmit={handleCorrectSubmit} className="space-y-4 text-xs">
              <div className="text-[var(--text-2)]">
                Correcting attendance for: <strong className="text-[var(--text-1)]">{editRecord.userName}</strong> on <strong className="text-[var(--text-1)]">{editRecord.date}</strong>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Clock In Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 08:30"
                    value={editIn}
                    onChange={e => setEditIn(e.target.value)}
                    className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Clock Out Time</label>
                  <input
                    type="text"
                    placeholder="e.g. 17:30"
                    value={editOut}
                    onChange={e => setEditOut(e.target.value)}
                    className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)] font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Attendance Status</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value)}
                  className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]"
                >
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="half_day">Half Day</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>

              <div>
                <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Correction Reason *</label>
                <textarea
                  className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)] resize-none"
                  rows={3}
                  value={correctionReason}
                  onChange={e => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Forgot to scan fingerprint at gate"
                  required
                />
              </div>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setEditRecord(null)}
                  className="py-2 px-4 bg-[var(--bg-surface-2)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={correctAttendance.isPending}
                  className="py-2 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {correctAttendance.isPending ? 'Saving...' : 'Apply Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AttendancePage() {
  return (
    <Suspense fallback={
      <div className="page-content flex items-center justify-center min-h-[60vh] text-[var(--text-3)]">
        <div className="text-center">
          <span className="spinner sm-spinner mb-2 block mx-auto" />
          Loading Attendance Module...
        </div>
      </div>
    }>
      <AttendancePageContent />
    </Suspense>
  );
}
