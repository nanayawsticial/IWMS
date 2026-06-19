'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi, departmentsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocketEvent } from '@/hooks/useSocket';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  present:  { color: '#10b981', bg: '#10b98120', label: 'Present' },
  late:     { color: '#f59e0b', bg: '#f59e0b20', label: 'Late' },
  absent:   { color: '#ef4444', bg: '#ef444420', label: 'Absent' },
  half_day: { color: '#06b6d4', bg: '#06b6d420', label: 'Half Day' },
  on_leave: { color: '#8b5cf6', bg: '#8b5cf620', label: 'On Leave' },
};

const METHOD_ICONS: Record<string, string> = {
  biometric: '🖐️', web: '🌐', mobile: '📱', qr: '📷',
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
    <div className={`clock-widget ${clockedIn ? 'clocked-in' : ''}`}>
      <div className="clock-ring">
        <div className={`clock-ring-inner ${clockedIn ? 'ring-active' : ''}`}>
          {clockedIn ? (
            <div className="clock-elapsed">
              <span className="elapsed-time">{formatElapsed(elapsed)}</span>
              <span className="elapsed-label">Time Elapsed</span>
            </div>
          ) : alreadyClockedOut ? (
            <div className="clock-idle">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
              </svg>
              <span style={{ color: '#10b981' }}>Done for today</span>
            </div>
          ) : (
            <div className="clock-idle">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
              </svg>
              <span>Not clocked in</span>
            </div>
          )}
        </div>
      </div>

      <div className="clock-info">
        {clockedIn && clockInTime && (
          <p className="clock-since">Clocked in since <strong>{clockInTime}</strong></p>
        )}
        {alreadyClockedOut && (
          <p className="clock-since">Worked <strong>{todayRecord?.hoursWorked?.toFixed(1)}h</strong> today</p>
        )}
        {!alreadyClockedOut && (
          <button
            className={`clock-btn ${clockedIn ? 'clock-out-btn' : 'clock-in-btn'}`}
            onClick={() => clockedIn ? clockOut.mutate() : clockIn.mutate()}
            disabled={isLoading}
          >
            {isLoading ? <span className="spinner sm-spinner" /> : clockedIn ? (
              <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg> Clock Out</>
            ) : (
              <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg> Clock In</>
            )}
          </button>
        )}
        <p className="clock-method">
          <span>Method: Web App</span>
          <span className="method-badge">🌐 Web + GPS</span>
        </p>
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
  const distinctDates = Array.from(new Set(records.map((r: any) => r.date))).sort((a: any, b: any) => b.localeCompare(a));
  const isMultiDay = distinctDates.length > 1;

  const groupedRecords = records.reduce((groups: Record<string, any[]>, record: any) => {
    const d = record.date;
    if (!groups[d]) groups[d] = [];
    groups[d].push(record);
    return groups;
  }, {});

  const sortedDates = Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a));

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

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Attendance</h1>
          <p className="page-subtitle">Track and manage employee attendance records</p>
        </div>
      </div>

      <div className="attendance-layout">
        <div className="attendance-main">
          {/* Stats row */}
          <div className="attendance-stats">
            {[
              { label: 'Present', value: stats?.present ?? 0,  color: '#10b981' },
              { label: 'Late',    value: stats?.late ?? 0,     color: '#f59e0b' },
              { label: 'Absent',  value: stats?.absent ?? 0,   color: '#ef4444' },
              { label: 'On Leave',value: stats?.onLeave ?? 0,  color: '#8b5cf6' },
            ].map(s => (
              <div key={s.label} className="att-stat-card" style={{ '--stat-color': s.color } as React.CSSProperties}>
                <span className="att-stat-value" style={{ color: s.color }}>{s.value}</span>
                <span className="att-stat-label">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Filters Toolbar */}
          <div className="table-toolbar" style={{ gap: '12px', alignItems: 'center' }}>
            <div className="filter-tabs">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: 'week', label: 'Last 7 Days' },
                { id: 'month', label: 'Last 30 Days' },
                { id: 'custom', label: 'Custom Range' },
              ].map(p => (
                <button
                  key={p.id}
                  className={`filter-tab ${period === p.id ? 'filter-tab-active' : ''}`}
                  onClick={() => handlePeriodChange(p.id)}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {period === 'custom' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => handleStartDateChange(e.target.value)}
                  className="form-input date-picker"
                  style={{ padding: '4px 8px', fontSize: '13px' }}
                />
                <span style={{ color: 'var(--color-text-muted)', fontSize: '13px' }}>to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => handleEndDateChange(e.target.value)}
                  className="form-input date-picker"
                  style={{ padding: '4px 8px', fontSize: '13px' }}
                />
              </div>
            )}

            {['super_admin', 'admin', 'hr_manager', 'manager'].includes(user?.role || '') && (
              <select
                value={departmentFilter}
                onChange={e => handleDepartmentChange(e.target.value)}
                className="form-input form-select"
                style={{ width: '150px', padding: '6px 12px', fontSize: '13px' }}
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
            )}

            <div className="filter-tabs" style={{ marginLeft: 'auto' }}>
              {['all', 'present', 'late', 'absent', 'on_leave'].map(s => (
                <button
                  key={s}
                  className={`filter-tab ${statusFilter === s ? 'filter-tab-active' : ''}`}
                  onClick={() => handleStatusChange(s)}
                >
                  {s === 'all' ? 'All' : STATUS_STYLES[s]?.label || s}
                </button>
              ))}
            </div>

            {hasPermission('export_reports') && (
              <button className="btn-ghost-sm" onClick={handleExportCSV}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
              </button>
            )}
          </div>

          {/* Table */}
          <div className="table-card">
            {isLoading ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#475569' }}>
                <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />Loading...
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th><th>Department</th><th>Clock In</th>
                    <th>Clock Out</th><th>Hours</th><th>Method</th><th>Status</th>
                    {hasPermission('edit_attendance') && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
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
                            className="table-row"
                            style={{
                              background: 'rgba(30,41,59,0.5)',
                              cursor: 'pointer',
                              userSelect: 'none',
                              fontWeight: 600,
                            }}
                          >
                            <td colSpan={hasPermission('edit_attendance') ? 8 : 7} style={{ padding: '10px 16px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)' }}>
                                  ▼
                                </span>
                                <span style={{ color: '#fff' }}>{formattedDate}</span>
                                <span className="dept-chip" style={{ background: 'var(--color-bg-surface-hover)', color: 'var(--color-text-secondary)' }}>
                                  {dateRecords.length} {dateRecords.length === 1 ? 'record' : 'records'}
                                </span>
                              </div>
                            </td>
                          </tr>

                          {!isCollapsed &&
                            dateRecords.map((r: any) => (
                              <tr key={r.id} className="table-row">
                                <td>
                                  <div className="table-user-cell">
                                    <div className="table-avatar">{r.userAvatar}</div>
                                    <div>
                                      <p className="table-user-name">{r.userName}</p>
                                      <p className="table-user-email">{r.userEmail}</p>
                                    </div>
                                  </div>
                                </td>
                                <td><span className="dept-chip">{r.userDepartment}</span></td>
                                <td>
                                  <span className="time-cell">{r.clockIn || '—'}</span>
                                  {r.correctedBy && (
                                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', textDecoration: 'line-through' }}>
                                      {r.correctedIn || '—'}
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <span className="time-cell">{r.clockOut || '—'}</span>
                                  {r.correctedBy && (
                                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', textDecoration: 'line-through' }}>
                                      {r.correctedOut || '—'}
                                    </span>
                                  )}
                                </td>
                                <td><span className="time-cell">{r.hoursWorked != null ? `${r.hoursWorked.toFixed(1)}h` : '—'}</span></td>
                                <td><span className="method-cell">{METHOD_ICONS[r.method] || '⚙️'} {r.method}</span></td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <span className="status-pill" style={{ color: STATUS_STYLES[r.status]?.color, background: STATUS_STYLES[r.status]?.bg }}>
                                      {STATUS_STYLES[r.status]?.label || r.status}
                                    </span>
                                    {r.correctedBy && (
                                      <span
                                        style={{ cursor: 'help', fontSize: '12px' }}
                                        title={`Correction by: ${r.correctedBy}\nReason: ${r.correctionReason}`}
                                      >
                                        ✏️
                                      </span>
                                    )}
                                  </div>
                                </td>
                                {hasPermission('edit_attendance') && (
                                  <td>
                                    <button className="table-action-btn" onClick={() => handleEditClick(r)}>
                                      Edit
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
                      <tr key={r.id} className="table-row">
                        <td>
                          <div className="table-user-cell">
                            <div className="table-avatar">{r.userAvatar}</div>
                            <div>
                              <p className="table-user-name">{r.userName}</p>
                              <p className="table-user-email">{r.userEmail}</p>
                            </div>
                          </div>
                        </td>
                        <td><span className="dept-chip">{r.userDepartment}</span></td>
                        <td>
                          <span className="time-cell">{r.clockIn || '—'}</span>
                          {r.correctedBy && (
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', textDecoration: 'line-through' }}>
                              {r.correctedIn || '—'}
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="time-cell">{r.clockOut || '—'}</span>
                          {r.correctedBy && (
                            <span style={{ fontSize: '10px', color: 'var(--color-text-muted)', display: 'block', textDecoration: 'line-through' }}>
                              {r.correctedOut || '—'}
                            </span>
                          )}
                        </td>
                        <td><span className="time-cell">{r.hoursWorked != null ? `${r.hoursWorked.toFixed(1)}h` : '—'}</span></td>
                        <td><span className="method-cell">{METHOD_ICONS[r.method] || '⚙️'} {r.method}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="status-pill" style={{ color: STATUS_STYLES[r.status]?.color, background: STATUS_STYLES[r.status]?.bg }}>
                              {STATUS_STYLES[r.status]?.label || r.status}
                            </span>
                            {r.correctedBy && (
                              <span
                                style={{ cursor: 'help', fontSize: '12px' }}
                                title={`Correction by: ${r.correctedBy}\nReason: ${r.correctionReason}`}
                              >
                                ✏️
                              </span>
                            )}
                          </div>
                        </td>
                        {hasPermission('edit_attendance') && (
                          <td>
                            <button className="table-action-btn" onClick={() => handleEditClick(r)}>
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                  {records.length === 0 && (
                    <tr>
                      <td colSpan={hasPermission('edit_attendance') ? 8 : 7} style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>
                        No records found
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
                      <tr className="table-summary-row" style={{ background: 'rgba(99,102,241,0.08)', fontWeight: 'bold' }}>
                        <td colSpan={2} style={{ color: 'var(--color-text-primary)' }}>Summary ({distinctDates.length} Days)</td>
                        <td colSpan={2} style={{ color: 'var(--color-warning)' }}>Late Days: {lateDays}</td>
                        <td style={{ color: 'var(--color-success)' }}>Total: {totalHoursWorked.toFixed(1)}h</td>
                        <td colSpan={hasPermission('edit_attendance') ? 3 : 2} style={{ color: 'var(--color-info)' }}>Avg/Day: {avgDailyHours.toFixed(1)}h</td>
                      </tr>
                    );
                  })()}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Clock-In Widget */}
        <div className="attendance-sidebar">
          <div className="chart-card">
            <div className="chart-header"><h3 className="chart-title">Your Attendance</h3></div>
            <ClockWidget />
          </div>
          <div className="chart-card">
            <div className="chart-header"><h3 className="chart-title">Period Summary</h3></div>
            <div className="month-stats">
              {[
                { label: 'Total Employees', value: stats?.totalEmployees ?? 0, color: '#6366f1' },
                { label: 'Attendance Rate', value: `${stats?.attendanceRate ?? 0}%`, color: '#10b981' },
                { label: 'Not Recorded', value: stats?.notRecorded ?? 0, color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} className="month-stat">
                  <span className="month-stat-val" style={{ color: s.color }}>{s.value}</span>
                  <span className="month-stat-label">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Correction Modal */}
      {editRecord && (
        <div className="modal-overlay" onClick={() => setEditRecord(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Correct Attendance</h3>
              <button className="modal-close" onClick={() => setEditRecord(null)}>✕</button>
            </div>
            <form onSubmit={handleCorrectSubmit} className="modal-body">
              <div style={{ marginBottom: '15px', color: '#fff', fontSize: '13px' }}>
                Correcting attendance for: <strong>{editRecord.userName}</strong> on <strong>{editRecord.date}</strong>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Clock In Time</label>
                  <input type="text" className="form-input" placeholder="e.g. 08:30" value={editIn} onChange={e => setEditIn(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Clock Out Time</label>
                  <input type="text" className="form-input" placeholder="e.g. 17:30" value={editOut} onChange={e => setEditOut(e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Attendance Status</label>
                <select className="form-input form-select" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="present">Present</option>
                  <option value="late">Late</option>
                  <option value="absent">Absent</option>
                  <option value="half_day">Half Day</option>
                  <option value="on_leave">On Leave</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Correction Reason *</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  value={correctionReason}
                  onChange={e => setCorrectionReason(e.target.value)}
                  placeholder="e.g. Forgot to scan fingerprint at gate"
                  required
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setEditRecord(null)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }} disabled={correctAttendance.isPending}>
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
      <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh', color: '#475569' }}>
        <div style={{ textAlign: 'center' }}>
          <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />
          Loading Attendance Module...
        </div>
      </div>
    }>
      <AttendancePageContent />
    </Suspense>
  );
}
