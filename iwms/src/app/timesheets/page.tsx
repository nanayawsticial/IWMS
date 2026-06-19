'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi, departmentsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const CELL_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  present:  { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Present' },
  late:     { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'Late' },
  absent:   { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Absent' },
  on_leave: { bg: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6', label: 'On Leave' },
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function TimesheetsPage() {
  const { user, hasPermission } = useAuth();
  
  // Initialize current Monday
  const [currentMonday, setCurrentMonday] = useState<Date>(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
    return new Date(d.setDate(diff));
  });

  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedCell, setSelectedCell] = useState<{ employeeName: string; day: any } | null>(null);

  // Get start and end date strings for current week
  const startDateStr = currentMonday.toISOString().split('T')[0];
  const endDateStr = new Date(new Date(currentMonday).setDate(currentMonday.getDate() + 6)).toISOString().split('T')[0];

  // Queries
  const { data: timesheets = [], isLoading: isTimesheetsLoading } = useQuery({
    queryKey: ['timesheets', startDateStr, endDateStr, deptFilter],
    queryFn: () => attendanceApi.timesheets({
      startDate: startDateStr,
      endDate: endDateStr,
      ...(deptFilter !== 'all' ? { departmentId: deptFilter } : {}),
    }),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  });

  const handlePrevWeek = () => {
    setCurrentMonday(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() - 7);
      return next;
    });
  };

  const handleNextWeek = () => {
    setCurrentMonday(prev => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + 7);
      return next;
    });
  };

  const handleTodayWeek = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentMonday(new Date(d.setDate(diff)));
  };

  const handleExport = async () => {
    try {
      const blob = await attendanceApi.exportTimesheets({
        startDate: startDateStr,
        endDate: endDateStr,
        ...(deptFilter !== 'all' ? { departmentId: deptFilter } : {}),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheets_${startDateStr}_to_${endDateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to export timesheets:', err);
    }
  };

  const formatDateDisplay = (date: Date) => {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatCellDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  };

  const displayEndOfWeek = new Date(new Date(currentMonday).setDate(currentMonday.getDate() + 6));
  const dateRangeDisplay = `${formatDateDisplay(currentMonday)} – ${formatDateDisplay(displayEndOfWeek)}`;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Timesheets</h1>
          <p className="page-subtitle">Track and review employee work hours across the week</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        {/* Week picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button className="btn-ghost-sm" onClick={handlePrevWeek} style={{ padding: '8px 12px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
          <span style={{ color: '#f8fafc', fontWeight: 600, minWidth: '220px', textAlign: 'center' }}>
            {dateRangeDisplay}
          </span>
          <button className="btn-ghost-sm" onClick={handleNextWeek} style={{ padding: '8px 12px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button className="btn-ghost-sm" onClick={handleTodayWeek} style={{ marginLeft: '8px', padding: '6px 12px', fontSize: '13px' }}>
            Today
          </button>
        </div>

        {/* Filter and export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {['super_admin', 'admin', 'hr_manager', 'manager'].includes(user?.role || '') && (
            <select
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              className="form-input"
              style={{ minWidth: '160px', background: '#0f172a', border: '1px solid #334155', color: '#f8fafc', padding: '8px 12px', borderRadius: '6px', fontSize: '14px' }}
            >
              <option value="all">All Departments</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          {hasPermission('export_reports') && (
            <button className="btn-ghost-sm" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Export CSV
            </button>
          )}
        </div>
      </div>

      {/* Timesheet Grid Table */}
      <div className="table-card" style={{ padding: '24px' }}>
        {isTimesheetsLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
            <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />
            Loading Timesheets...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ minWidth: '220px' }}>Employee</th>
                  {DAY_NAMES.map(day => (
                    <th key={day} style={{ textAlign: 'center', width: '90px' }}>{day}</th>
                  ))}
                  <th style={{ textAlign: 'center', width: '110px' }}>Total Hrs</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>OT Hrs</th>
                </tr>
              </thead>
              <tbody>
                {timesheets.map((row: any) => (
                  <tr key={row.user.id} className="table-row">
                    <td>
                      <div className="table-user-cell">
                        <div className="table-avatar" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                          {row.user.avatar}
                        </div>
                        <div>
                          <p className="table-user-name">{row.user.name}</p>
                          <p className="table-user-email" style={{ fontSize: '11px', color: '#64748b' }}>
                            {row.user.position} {row.user.department ? `· ${row.user.department}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    
                    {row.days.map((day: any, idx: number) => {
                      const hours = day.hoursWorked || 0;
                      let cellStyle: React.CSSProperties = {
                        textAlign: 'center',
                        cursor: 'pointer',
                        padding: '12px 6px',
                        transition: 'all 0.15s ease',
                      };
                      let badgeStyle: React.CSSProperties = {
                        display: 'inline-block',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        minWidth: '50px',
                      };

                      if (hours >= 8) {
                        // Full day
                        badgeStyle.background = 'rgba(16, 185, 129, 0.15)';
                        badgeStyle.color = '#10b981';
                      } else if (hours > 0 && hours < 8) {
                        // Partial day
                        badgeStyle.background = 'rgba(245, 158, 11, 0.15)';
                        badgeStyle.color = '#f59e0b';
                      } else if (day.status === 'absent') {
                        // Absent
                        badgeStyle.background = 'rgba(239, 68, 68, 0.15)';
                        badgeStyle.color = '#ef4444';
                      } else {
                        // Off day / other
                        badgeStyle.background = '#1e293b';
                        badgeStyle.color = '#64748b';
                      }

                      return (
                        <td
                          key={idx}
                          style={cellStyle}
                          onClick={() => setSelectedCell({ employeeName: row.user.name, day })}
                          className="timesheet-cell-hover"
                        >
                          <span style={badgeStyle}>
                            {hours > 0 ? `${hours.toFixed(1)}h` : day.status === 'on_leave' ? 'Leave' : '—'}
                          </span>
                        </td>
                      );
                    })}

                    <td style={{ textAlign: 'center', fontWeight: 700, color: '#f8fafc' }}>
                      {row.totalHours.toFixed(1)}h
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: row.overtimeHours > 0 ? '#f59e0b' : '#64748b' }}>
                      {row.overtimeHours > 0 ? `${row.overtimeHours.toFixed(1)}h` : '—'}
                    </td>
                  </tr>
                ))}
                {timesheets.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                      No timesheets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Details Modal */}
      {selectedCell && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setSelectedCell(null)}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', fontWeight: 600 }}>Attendance Details</h3>
              <button
                onClick={() => setSelectedCell(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  fontSize: '20px',
                  cursor: 'pointer',
                  padding: '4px',
                  lineHeight: '1',
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Employee</span>
                <span style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 500 }}>{selectedCell.employeeName}</span>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Date</span>
                <span style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 500 }}>{formatCellDate(selectedCell.day.date)}</span>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Clock In</span>
                  <span style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 500 }}>{selectedCell.day.clockIn || '—'}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Clock Out</span>
                  <span style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 500 }}>{selectedCell.day.clockOut || '—'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Hours Worked</span>
                  <span style={{ fontSize: '15px', color: '#e2e8f0', fontWeight: 600 }}>
                    {selectedCell.day.hoursWorked ? `${selectedCell.day.hoursWorked.toFixed(1)}h` : '—'}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', color: '#64748b', display: 'block' }}>Method</span>
                  <span style={{ fontSize: '14px', color: '#e2e8f0' }}>
                    {selectedCell.day.method ? (selectedCell.day.method === 'web' ? '🌐 Web App' : '🖐️ Hardware') : '—'}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '4px' }}>Status</span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600,
                    background: CELL_STATUS_STYLES[selectedCell.day.status]?.bg || '#1e293b',
                    color: CELL_STATUS_STYLES[selectedCell.day.status]?.text || '#64748b',
                  }}
                >
                  {CELL_STATUS_STYLES[selectedCell.day.status]?.label || selectedCell.day.status}
                </span>
              </div>
            </div>

            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn-ghost-sm"
                onClick={() => setSelectedCell(null)}
                style={{ padding: '8px 16px', background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
