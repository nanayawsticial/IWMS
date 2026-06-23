'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { attendanceApi } from '@/lib/api';
import { useSocketEvent } from '@/hooks/useSocket';

const STATUS_STYLES: Record<string, { color: string; bg: string; label: string }> = {
  present:  { color: 'var(--green)', bg: 'var(--green-soft)', label: 'Present' },
  late:     { color: 'var(--yellow)', bg: 'var(--yellow-soft)', label: 'Late' },
  absent:   { color: 'var(--red)', bg: 'var(--red-soft)', label: 'Absent' },
  on_leave: { color: 'var(--purple)', bg: 'var(--purple-soft)', label: 'On Leave' },
};

const METHOD_LABELS: Record<string, string> = {
  web: '🌐 Web App',
  hardware: '🖐️ Biometric Terminal',
};

const CHART_TOOLTIP_STYLE = {
  background: 'var(--bg-surface-2)',
  border: '1px solid var(--border-strong)',
  borderRadius: '8px',
  color: 'var(--text-1)',
  padding: '10px 14px',
  fontSize: '13px',
};

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={CHART_TOOLTIP_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-3)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>{p.name}: <strong>{p.value}</strong></p>
      ))}
    </div>
  );
}

export default function AttendanceDashboardPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');

  // Queries
  const { data: summary, isLoading: isSummaryLoading } = useQuery({
    queryKey: ['attendance-summary'],
    queryFn: () => attendanceApi.summary(),
  });

  const { data: liveFeed = [], isLoading: isFeedLoading } = useQuery({
    queryKey: ['attendance-live-feed'],
    queryFn: () => attendanceApi.liveFeed(),
  });

  // Socket updates
  useSocketEvent<any>('attendance:clockIn', () => {
    queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-live-feed'] });
  });

  useSocketEvent<any>('attendance:clockOut', () => {
    queryClient.invalidateQueries({ queryKey: ['attendance-summary'] });
    queryClient.invalidateQueries({ queryKey: ['attendance-live-feed'] });
  });

  // Filtered attendance for bottom table
  const filteredRecords = liveFeed.filter((r: any) => {
    const matchesSearch = r.userName?.toLowerCase().includes(search.toLowerCase());
    const matchesDept = deptFilter === 'all' || r.userDepartment === deptFilter;
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesMethod = methodFilter === 'all' || r.method === methodFilter;
    return matchesSearch && matchesDept && matchesStatus && matchesMethod;
  });

  // Unique departments for filter dropdown
  const departments = Array.from(new Set(liveFeed.map((r: any) => r.userDepartment).filter(Boolean))) as string[];

  const kpiData = summary?.kpis || {
    present: { value: 0, change: 0 },
    late: { value: 0, change: 0 },
    absent: { value: 0, change: 0 },
    onLeave: { value: 0, change: 0 },
  };

  const byDepartmentData = summary?.byDepartment || [];
  const byHourData = summary?.byHour || [];
  const topEarly = summary?.topEarlyArrivals || [];
  const topLate = summary?.topLateArrivals || [];

  const kpisList = [
    { label: 'Total Present', value: kpiData.present.value, change: kpiData.present.change, color: 'var(--green)', bg: 'var(--green-soft)', icon: '👤' },
    { label: 'Late Arrivals', value: kpiData.late.value, change: kpiData.late.change, color: 'var(--yellow)', bg: 'var(--yellow-soft)', icon: '⏰' },
    { label: 'Absent Employees', value: kpiData.absent.value, change: kpiData.absent.change, color: 'var(--red)', bg: 'var(--red-soft)', icon: '❌' },
    { label: 'On Leave', value: kpiData.onLeave.value, change: kpiData.onLeave.change, color: 'var(--purple)', bg: 'var(--purple-soft)', icon: '🌴' },
  ];

  const isLoading = isSummaryLoading || isFeedLoading;

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Real-Time Attendance Dashboard</h1>
          <p className="page-subtitle">Live workforce presence, status distribution, and analytics</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-3)' }}>
          <span className="spinner" style={{ margin: '0 auto 16px', display: 'block' }} />
          Loading Attendance Analytics...
        </div>
      ) : (
        <>
          {/* KPI Summary Cards */}
          <div className="kpi-grid" style={{ marginBottom: '24px' }}>
            {kpisList.map((kpi, idx) => {
              const isPositive = kpi.change >= 0;
              const isAbsentOrLate = kpi.label.includes('Absent') || kpi.label.includes('Late');
              const changeColor = isAbsentOrLate
                ? (isPositive ? 'var(--red)' : 'var(--green)')
                : (isPositive ? 'var(--green)' : 'var(--red)');

              return (
                <div key={idx} className="kpi-card" style={{ '--kpi-color': kpi.color, '--kpi-glow': `${kpi.color}20` } as React.CSSProperties}>
                  <div className="kpi-header">
                    <div className="kpi-icon" style={{ color: kpi.color, background: kpi.bg, fontSize: '20px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {kpi.icon}
                    </div>
                    <span className="kpi-pct" style={{ color: changeColor, fontSize: '13px', fontWeight: 600 }}>
                      {isPositive ? '↑' : '↓'} {Math.abs(kpi.change)}% vs yesterday
                    </span>
                  </div>
                  <div className="kpi-value" style={{ marginTop: '12px' }}>{kpi.value}</div>
                  <div className="kpi-label">{kpi.label}</div>
                  <div className="kpi-bar" style={{ marginTop: '12px' }}>
                    <div className="kpi-bar-fill" style={{ width: '100%', background: kpi.color, opacity: 0.3 }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Three-Column Dashboard Grid */}
          <div className="charts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            
            {/* Column 1: Live Feed List */}
            <div className="chart-card activity-card" style={{ minHeight: '360px' }}>
              <div className="chart-header">
                <h3 className="chart-title">Live Clock-In / Out Feed</h3>
                <span className="live-badge"><span className="live-dot" />LIVE</span>
              </div>
              <div className="activity-list" style={{ overflowY: 'auto', maxHeight: '300px' }}>
                {liveFeed.slice(0, 10).map((a: any) => {
                  const isClockedOut = !!a.clockOut;
                  const isPresent = a.status === 'present';
                  const isLate = a.status === 'late';
                  const isLeave = a.status === 'on_leave';

                  const pillColor = isClockedOut
                    ? { bg: 'var(--indigo-soft)', text: 'var(--indigo)' }
                    : isPresent
                    ? { bg: 'var(--green-soft)', text: 'var(--green)' }
                    : isLate
                    ? { bg: 'var(--yellow-soft)', text: 'var(--yellow)' }
                    : isLeave
                    ? { bg: 'var(--purple-soft)', text: 'var(--purple)' }
                    : { bg: 'var(--red-soft)', text: 'var(--red)' };

                  const timeDisplay = isClockedOut ? a.clockOut : (a.clockIn || '');
                  const statusLabel = isClockedOut ? 'Clocked out' : isPresent ? 'Clocked in' : isLate ? 'Late' : isLeave ? 'On Leave' : 'Absent';

                  return (
                    <div key={a.id} className="activity-item" style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                      <div className="activity-avatar" style={{ background: pillColor.bg, border: `2px solid ${pillColor.text}50`, color: pillColor.text }}>
                        {a.userAvatar || '??'}
                      </div>
                      <div className="activity-info">
                        <p className="activity-name">{a.userName}</p>
                        <p className="activity-role" style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                          {a.userPosition} {a.userDepartment ? `· ${a.userDepartment}` : ''}
                        </p>
                      </div>
                      <div className="activity-pill" style={{ background: pillColor.bg, color: pillColor.text }}>
                        <span className="activity-pill-dot" style={{ background: pillColor.text }} />
                        {statusLabel} {timeDisplay ? `· ${timeDisplay}` : ''}
                      </div>
                    </div>
                  );
                })}
                {liveFeed.length === 0 && (
                  <p style={{ color: 'var(--text-2)', fontSize: '13px', textAlign: 'center', padding: '40px 0' }}>No attendance activity logged today.</p>
                )}
              </div>
            </div>

            {/* Column 2: Department Bar Chart */}
            <div className="chart-card" style={{ minHeight: '360px' }}>
              <div className="chart-header">
                <h3 className="chart-title">Department Distribution</h3>
              </div>
              <div style={{ height: '280px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 100, height: 100 }}>
                  <BarChart data={byDepartmentData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="name" stroke="var(--border-strong)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <YAxis stroke="var(--border-strong)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="present" name="Present" fill="var(--green)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="late" name="Late" fill="var(--yellow)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="absent" name="Absent" fill="var(--red)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Column 3: Hourly Area Chart */}
            <div className="chart-card" style={{ minHeight: '360px' }}>
              <div className="chart-header">
                <h3 className="chart-title">Clock-In Distribution by Hour</h3>
              </div>
              <div style={{ height: '280px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 100, height: 100 }}>
                  <AreaChart data={byHourData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="hourGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--indigo)" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="var(--indigo)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="hour" stroke="var(--border-strong)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <YAxis stroke="var(--border-strong)" tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="count" name="Clock-Ins" stroke="var(--indigo)" strokeWidth={2} fill="url(#hourGrad)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Top Early/Late Arrivals Lists */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '24px' }}>
            {/* Top Early Arrivals */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title" style={{ color: 'var(--green)' }}>⏱️ Top Early Arrivals</h3>
              </div>
              <div className="activity-list">
                {topEarly.map((u: any, i: number) => (
                  <div key={u.id || i} className="activity-item" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="activity-avatar" style={{ background: 'var(--green-soft)', color: 'var(--green)', fontWeight: 600 }}>
                      {u.avatar || '??'}
                    </div>
                    <div className="activity-info">
                      <p className="activity-name">{u.name}</p>
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--green)', fontWeight: 600 }}>
                      {u.clockIn}
                    </span>
                  </div>
                ))}
                {topEarly.length === 0 && (
                  <p style={{ color: 'var(--text-3)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>No early arrivals logged.</p>
                )}
              </div>
            </div>

            {/* Top Late Arrivals */}
            <div className="chart-card">
              <div className="chart-header">
                <h3 className="chart-title" style={{ color: 'var(--yellow)' }}>⚠️ Top Late Arrivals</h3>
              </div>
              <div className="activity-list">
                {topLate.map((u: any, i: number) => (
                  <div key={u.id || i} className="activity-item" style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                    <div className="activity-avatar" style={{ background: 'var(--yellow-soft)', color: 'var(--yellow)', fontWeight: 600 }}>
                      {u.avatar || '??'}
                    </div>
                    <div className="activity-info">
                      <p className="activity-name">{u.name}</p>
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--yellow)', fontWeight: 600 }}>
                      {u.clockIn}
                    </span>
                  </div>
                ))}
                {topLate.length === 0 && (
                  <p style={{ color: 'var(--text-3)', fontSize: '13px', padding: '16px 0', textAlign: 'center' }}>No late arrivals logged.</p>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Table: Filtered Attendance */}
          <div className="table-card" style={{ padding: '24px' }}>
            <div className="chart-header" style={{ marginBottom: '20px' }}>
              <h3 className="chart-title">Today's Attendance Registry</h3>
            </div>

            {/* Search and Filters bar */}
            <div className="table-toolbar" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="form-input"
                style={{ flex: '1', minWidth: '200px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '8px 12px', borderRadius: '6px' }}
              />

              <select
                value={deptFilter}
                onChange={e => setDeptFilter(e.target.value)}
                className="form-input"
                style={{ minWidth: '150px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '8px', borderRadius: '6px' }}
              >
                <option value="all">All Departments</option>
                {departments.map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="form-input"
                style={{ minWidth: '150px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '8px', borderRadius: '6px' }}
              >
                <option value="all">All Statuses</option>
                <option value="present">Present</option>
                <option value="late">Late</option>
                <option value="absent">Absent</option>
                <option value="on_leave">On Leave</option>
              </select>

              <select
                value={methodFilter}
                onChange={e => setMethodFilter(e.target.value)}
                className="form-input"
                style={{ minWidth: '150px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', color: 'var(--text-1)', padding: '8px', borderRadius: '6px' }}
              >
                <option value="all">All Methods</option>
                <option value="web">Web App</option>
                <option value="hardware">Hardware Terminal</option>
              </select>
            </div>

            {/* Attendance List Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Department</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Hours</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r: any) => (
                    <tr key={r.id} className="table-row">
                      <td>
                        <div className="table-user-cell">
                          <div className="table-avatar" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                            {r.userAvatar}
                          </div>
                          <div>
                            <p className="table-user-name">{r.userName}</p>
                            <p className="table-user-email" style={{ fontSize: '11px', color: 'var(--text-3)' }}>{r.userPosition || 'Employee'}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="dept-chip" style={{ background: 'var(--bg-surface-2)', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
                          {r.userDepartment || 'Unassigned'}
                        </span>
                      </td>
                      <td><span className="time-cell" style={{ color: 'var(--text-1)' }}>{r.clockIn || '—'}</span></td>
                      <td><span className="time-cell" style={{ color: 'var(--text-1)' }}>{r.clockOut || '—'}</span></td>
                      <td><span className="time-cell" style={{ color: 'var(--text-1)', fontWeight: 600 }}>{r.hoursWorked != null ? `${r.hoursWorked.toFixed(1)}h` : '—'}</span></td>
                      <td>
                        <span className="method-cell" style={{ fontSize: '13px', color: 'var(--text-2)' }}>
                          {METHOD_LABELS[r.method] || r.method}
                        </span>
                      </td>
                      <td>
                        <span className="status-pill" style={{ color: STATUS_STYLES[r.status]?.color, background: STATUS_STYLES[r.status]?.bg, fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '12px' }}>
                          {STATUS_STYLES[r.status]?.label || r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredRecords.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-3)' }}>
                        No records match the current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
