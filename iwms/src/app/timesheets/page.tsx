'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi, departmentsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const CELL_STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  present:  { bg: 'var(--green-soft)', text: 'var(--green)', label: 'Present' },
  late:     { bg: 'var(--yellow-soft)', text: 'var(--yellow)', label: 'Late' },
  absent:   { bg: 'var(--red-soft)', text: 'var(--red)', label: 'Absent' },
  on_leave: { bg: 'var(--purple-soft)', text: 'var(--purple)', label: 'On Leave' },
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

  const handleExport = async (format: 'csv' | 'excel' = 'csv') => {
    try {
      const blob = await attendanceApi.exportTimesheets({
        startDate: startDateStr,
        endDate: endDateStr,
        format,
        ...(deptFilter !== 'all' ? { departmentId: deptFilter } : {}),
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const extension = format === 'excel' ? 'xls' : 'csv';
      a.download = `timesheets_${startDateStr}_to_${endDateStr}.${extension}`;
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
          <span style={{ color: 'var(--text-1)', fontWeight: 600, minWidth: '180px', textAlign: 'center' }}>
            {dateRangeDisplay}
          </span>
          <button className="btn-ghost-sm" onClick={handleNextWeek} style={{ padding: '8px 12px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
          <button className="btn-ghost-sm" onClick={handleTodayWeek} style={{ marginLeft: '8px', padding: '6px 12px', fontSize: '14px' }}>
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
              style={{ minWidth: '160px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '8px 12px', borderRadius: '6px', fontSize: '14px' }}
            >
              <option value="all">All Departments</option>
              {departments.map((d: any) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          )}

          {hasPermission('export_reports') && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="btn-ghost-sm" onClick={() => handleExport('csv')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export CSV
              </button>
              <button className="btn-ghost-sm" onClick={() => handleExport('excel')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 14px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                Export Excel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Timesheet Grid Table */}
      <div className="table-card">
        {isTimesheetsLoading ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
            <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />
            Loading Timesheets...
          </div>
        ) : (
          <>
            <div className="mobile-scroll-hint">
              <span>←</span> Scroll horizontally to see all days <span>→</span>
            </div>
            <div className="table-scroll" style={{ width: '100%', maxWidth: '100%' }}>
              <table style={{ tableLayout: 'auto', minWidth: 780 }} className="data-table">
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--bg-surface)' }}>
                  <tr>
                    <th className="sticky-left" style={{ minWidth: 180, textAlign: 'left', padding: '10px 12px' }}>Employee</th>
                    {DAY_NAMES.map(day => (
                      <th key={day} style={{ minWidth: 64, textAlign: 'center', padding: '10px 6px', fontSize: 13, opacity: 0.55 }}>{day}</th>
                    ))}
                    <th style={{ minWidth: 72, textAlign: 'center', padding: '10px 6px', fontSize: 13, opacity: 0.55 }}>Total</th>
                    <th style={{ minWidth: 64, textAlign: 'center', padding: '10px 6px', fontSize: 13, opacity: 0.55 }}>OT Hrs</th>
                  </tr>
                </thead>
              <tbody>
                {timesheets.map((row: any) => (
                  <tr key={row.user.id} className="table-row">
                    <td className="sticky-left">
                      <div className="table-user-cell">
                        <div className="table-avatar" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}>
                          {row.user.avatar}
                        </div>
                        <div>
                          <p className="table-user-name">{row.user.name}</p>
                          <p className="table-user-email" style={{ fontSize: '13px', color: 'var(--text-3)' }}>
                            {row.user.position} {row.user.department ? `· ${row.user.department}` : ''}
                          </p>
                        </div>
                      </div>
                    </td>
                    
                    {row.days.map((day: any, idx: number) => {
                      const hours = day.hoursWorked || 0;
                      const hasHours = hours > 0;
                      
                      return (
                        <td
                          key={idx}
                          onClick={() => setSelectedCell({ employeeName: row.user.name, day })}
                          className="timesheet-cell-hover"
                          style={{
                            background: hasHours ? 'var(--green-soft)' : 'var(--red-soft)',
                            color: hasHours ? 'var(--green)' : 'var(--red)',
                            textAlign: 'center',
                            fontSize: 13,
                            fontWeight: hasHours ? 500 : undefined,
                            padding: '8px 4px',
                            cursor: 'pointer',
                          }}
                        >
                          {hasHours ? `${hours.toFixed(1)}h` : day.status === 'on_leave' ? 'Leave' : '—'}
                        </td>
                      );
                    })}

                    <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--text-1)' }}>
                      {row.totalHours.toFixed(1)}h
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 600, color: row.overtimeHours > 0 ? 'var(--yellow)' : 'var(--text-3)' }}>
                      {row.overtimeHours > 0 ? `${row.overtimeHours.toFixed(1)}h` : '—'}
                    </td>
                  </tr>
                ))}
                {timesheets.length === 0 && (
                  <tr>
                    <td colSpan={10} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
                      No timesheets found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
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
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: 'var(--glass-shadow)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-1)', fontWeight: 600 }}>Attendance Details</h3>
              <button
                onClick={() => setSelectedCell(null)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-2)',
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
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>Employee</span>
                <span style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: 500 }}>{selectedCell.employeeName}</span>
              </div>

              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>Date</span>
                <span style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: 500 }}>{formatCellDate(selectedCell.day.date)}</span>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>Clock In</span>
                  <span style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: 500 }}>{selectedCell.day.clockIn || '—'}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>Clock Out</span>
                  <span style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: 500 }}>{selectedCell.day.clockOut || '—'}</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '24px' }}>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>Hours Worked</span>
                  <span style={{ fontSize: '15px', color: 'var(--text-1)', fontWeight: 600 }}>
                    {selectedCell.day.hoursWorked ? `${selectedCell.day.hoursWorked.toFixed(1)}h` : '—'}
                  </span>
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'block' }}>Method</span>
                  <span style={{ fontSize: '14px', color: 'var(--text-1)' }}>
                    {selectedCell.day.method ? (selectedCell.day.method === 'web' ? '🌐 Web App' : '🖐️ Hardware') : '—'}
                  </span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '13px', color: 'var(--text-3)', display: 'block', marginBottom: '4px' }}>Status</span>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '4px 10px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: CELL_STATUS_STYLES[selectedCell.day.status]?.bg || 'var(--bg-surface-2)',
                    color: CELL_STATUS_STYLES[selectedCell.day.status]?.text || 'var(--text-3)',
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
                style={{ padding: '8px 16px', background: 'var(--bg-hover)', color: 'var(--text-1)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
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
