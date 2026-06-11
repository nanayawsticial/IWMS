'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

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
        return new Promise<any>((resolve, reject) => {
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

export default function AttendancePage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState('all');

  // Correction state
  const [editRecord, setEditRecord] = useState<any>(null);
  const [editIn, setEditIn] = useState('');
  const [editOut, setEditOut] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['attendance', selectedDate, statusFilter],
    queryFn: () => attendanceApi.list({
      ...(selectedDate !== 'all' ? { date: selectedDate } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    }),
  });

  const { data: stats } = useQuery({
    queryKey: ['attendance-stats', selectedDate],
    queryFn: () => attendanceApi.stats(selectedDate),
  });

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

          {/* Filters */}
          <div className="table-toolbar">
            <input type="date" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} className="form-input date-picker" />
            <div className="filter-tabs">
              {['all', 'present', 'late', 'absent', 'on_leave'].map(s => (
                <button key={s} className={`filter-tab ${statusFilter === s ? 'filter-tab-active' : ''}`} onClick={() => setStatusFilter(s)}>
                  {s === 'all' ? 'All' : STATUS_STYLES[s]?.label || s}
                </button>
              ))}
            </div>
            {hasPermission('export_reports') && (
              <button className="btn-ghost-sm">
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
                  {records.map((r: any) => (
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
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textDecoration: 'line-through' }}>
                            {r.correctedIn || '—'}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="time-cell">{r.clockOut || '—'}</span>
                        {r.correctedBy && (
                          <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block', textDecoration: 'line-through' }}>
                            {r.correctedOut || '—'}
                          </span>
                        )}
                      </td>
                      <td><span className="time-cell">{r.hoursWorked != null ? `${r.hoursWorked.toFixed(1)}h` : '—'}</span></td>
                      <td><span className="method-cell">{METHOD_ICONS[r.method]} {r.method}</span></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span className="status-pill" style={{ color: STATUS_STYLES[r.status]?.color, background: STATUS_STYLES[r.status]?.bg }}>
                            {STATUS_STYLES[r.status]?.label}
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
                  {records.length === 0 && (
                    <tr><td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#475569' }}>No records found</td></tr>
                  )}
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
            <div className="chart-header"><h3 className="chart-title">Today Summary</h3></div>
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
