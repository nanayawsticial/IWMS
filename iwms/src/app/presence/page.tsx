'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';
import { useSocketEvent } from '@/hooks/useSocket';
import {
  Fingerprint,
  Search,
  Grid,
  List,
  Cpu,
  Globe,
  Smartphone,
  QrCode,
  Activity,
  AlertTriangle,
  User,
  Coffee,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

interface PresenceUser {
  userId: string;
  name: string;
  avatar: string;
  position: string;
  role: string;
  departmentId: string | null;
  department: string;
  status: 'present' | 'late' | 'absent' | 'on_leave' | 'not_clocked_in';
  clockIn: string | null;
  clockOut: string | null;
  hoursWorked: number | null;
  method: string | null;
}

interface PresenceSummary {
  total: number;
  present: number;
  late: number;
  absent: number;
  onLeave: number;
  notClockedIn: number;
}

interface PresenceData {
  presence: PresenceUser[];
  summary: PresenceSummary;
  date: string;
}

const STATUS_CONFIG: Record<string, { label: string; badgeClass: string; ringClass: string; color: string }> = {
  present:        { label: 'Present',        badgeClass: 'badge-green', ringClass: 'border-emerald-500', color: 'var(--green)' },
  late:           { label: 'Late',           badgeClass: 'badge-yellow', ringClass: 'border-amber-500', color: 'var(--yellow)' },
  absent:         { label: 'Absent',         badgeClass: 'badge-red', ringClass: 'border-red-500', color: 'var(--red)' },
  on_leave:       { label: 'On Leave',       badgeClass: 'badge-purple', ringClass: 'border-purple-500', color: 'var(--purple)' },
  not_clocked_in: { label: 'Not Clocked In', badgeClass: 'badge-yellow bg-slate-500/10 text-slate-400 border-slate-500/20', ringClass: 'border-slate-600', color: 'var(--text-3)' },
};

function renderMethodIcon(method: string | null) {
  const norm = (method || '').toLowerCase();
  if (norm === 'rfid' || norm === 'biometric') {
    return <span title="RFID Card"><Cpu size={12} className="text-[var(--accent)]" /></span>;
  }
  if (norm === 'web') {
    return <span title="Web App"><Globe size={12} className="text-[var(--blue)]" /></span>;
  }
  if (norm === 'mobile') {
    return <span title="Mobile GPS"><Smartphone size={12} className="text-[var(--green)]" /></span>;
  }
  if (norm === 'qr') {
    return <span title="QR Terminal"><QrCode size={12} className="text-[var(--purple)]" /></span>;
  }
  return <span title="Biometric"><Fingerprint size={12} className="text-[var(--text-3)]" /></span>;
}

export default function PresencePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [activeDept, setActiveDept] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

  const { data, isLoading, isError } = useQuery<PresenceData>({
    queryKey: ['presence'],
    queryFn: () => attendanceApi.presence(),
    refetchInterval: 60_000,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['presence'] });
  }, [queryClient]);

  useSocketEvent<unknown>('attendance:clockIn', invalidate);
  useSocketEvent<unknown>('attendance:clockOut', invalidate);
  useSocketEvent<unknown>('attendance:updated', invalidate);

  const departments = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.presence.map((p: PresenceUser) => p.department));
    return ['all', ...Array.from(set).sort()];
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.presence.filter((u: PresenceUser) => {
      const matchSearch = !search || u.name.toLowerCase().includes(search.toLowerCase()) || u.department.toLowerCase().includes(search.toLowerCase());
      const matchStatus = activeStatus === 'all' || u.status === activeStatus;
      const matchDept = activeDept === 'all' || u.department === activeDept;
      return matchSearch && matchStatus && matchDept;
    });
  }, [data, search, activeStatus, activeDept]);

  const summary = data?.summary ?? { total: 0, present: 0, late: 0, absent: 0, onLeave: 0, notClockedIn: 0 };

  const kpis = [
    { key: 'all',            label: 'Total Headcount',      value: summary.total,        badgeClass: 'badge-blue', color: 'var(--blue)' },
    { key: 'present',        label: 'Present Today',    value: summary.present,      badgeClass: 'badge-green', color: 'var(--green)' },
    { key: 'late',           label: 'Late Check-ins',       value: summary.late,         badgeClass: 'badge-yellow', color: 'var(--yellow)' },
    { key: 'absent',         label: 'Absent',     value: summary.absent,       badgeClass: 'badge-red', color: 'var(--red)' },
    { key: 'on_leave',       label: 'On Leave',   value: summary.onLeave,      badgeClass: 'badge-purple', color: 'var(--purple)' },
    { key: 'not_clocked_in', label: 'Not Checked In', value: summary.notClockedIn, badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20', color: 'var(--text-3)' },
  ];

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="page-title text-2xl font-bold text-[var(--text-1)]">Team Presence</h1>
            {/* Pulsing LIVE green connection indicator */}
            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-bold text-[var(--green)] uppercase tracking-wider">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              LIVE
            </span>
          </div>
          <p className="page-subtitle text-sm text-[var(--text-3)] mt-1">
            Real-time visual monitoring of checked-in personnel and on-premise device feeds.
          </p>
        </div>

        {/* View Switcher */}
        <div className="tab-switcher">
          {(['grid', 'table'] as const).map(mode => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`capitalize ${viewMode === mode ? 'active' : ''}`}
            >
              {mode === 'grid' ? <Grid size={13} className="mr-1.5" /> : <List size={13} className="mr-1.5" />}
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* KPI filter summary pills */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {kpis.map(k => {
          const isActive = activeStatus === k.key;
          return (
            <button
              key={k.key}
              onClick={() => setActiveStatus(prev => prev === k.key ? 'all' : k.key)}
              className={`card p-3 flex flex-col justify-between text-left cursor-pointer transition-all ${
                isActive ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'hover:border-[var(--border-strong)]'
              }`}
            >
              <span className="value text-xl font-bold font-mono text-[var(--text-1)]" style={{ color: k.color }}>
                {k.value}
              </span>
              <span className="label text-xs font-bold text-[var(--text-3)] uppercase tracking-wider mt-1.5">
                {k.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search & Department Filters Toolbar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between p-4 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl mb-6">
        <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
          {/* Search */}
          <div className="control-compact w-full sm:w-64">
            <Search size={16} className="text-[var(--text-3)] flex-shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search team member name..."
            />
          </div>

          {/* Department filter pills */}
          <div className="tab-switcher w-full sm:w-auto overflow-x-auto hide-scrollbar">
            {departments.map(dept => (
              <button
                key={dept}
                onClick={() => setActiveDept(dept)}
                className={`capitalize ${activeDept === dept ? 'active' : ''}`}
              >
                {dept === 'all' ? 'All Departments' : dept}
              </button>
            ))}
          </div>
        </div>

        <span className="text-xs text-[var(--text-3)] font-semibold font-mono">
          Showing {filtered.length} of {summary.total} members
        </span>
      </div>

      {isLoading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
        }}>
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="card flex flex-col justify-between space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full skeleton flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 skeleton rounded" />
                  <div className="h-3 w-1/2 skeleton rounded" />
                </div>
              </div>
              <div className="space-y-2 pt-2 border-t border-[var(--border)]">
                <div className="flex justify-between items-center">
                  <div className="h-3 w-1/3 skeleton rounded" />
                  <div className="h-4 w-1/4 skeleton rounded-full" />
                </div>
                <div className="flex justify-between items-center">
                  <div className="h-3 w-1/4 skeleton rounded" />
                  <div className="h-3 w-12 skeleton rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {isError && <div className="text-center py-20 text-red-500">Failed to load presence data. Please refresh.</div>}
      {!isLoading && !isError && filtered.length === 0 && (
        <div className="text-center py-20 text-[var(--text-3)]">No team members match the active filters.</div>
      )}

      {/* Grid Mode */}
      {!isLoading && !isError && viewMode === 'grid' && filtered.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          alignContent: 'start',
        }}>
          {filtered.map((user: PresenceUser) => {
            const cfg = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.not_clocked_in;
            const hasClocked = user.status === 'present' || user.status === 'late';

            return (
              <div
                key={user.userId}
                className="card flex flex-col justify-between space-y-4 hover:-translate-y-0.5 duration-200 transition-all"
              >
                <div className="flex items-center gap-3">
                  {/* Status Ring Avatar */}
                  <div className={`w-12 h-12 rounded-full border-2 ${cfg.ringClass} p-0.5 flex-shrink-0 flex items-center justify-center relative`}>
                    <div className="w-full h-full rounded-full bg-[var(--bg-surface-2)] flex items-center justify-center font-bold text-[var(--text-1)] overflow-hidden">
                      {user.avatar || user.name[0]}
                    </div>
                    {hasClocked && (
                      <span className="absolute bottom-0 right-0 w-3.5 h-3.5 rounded-full bg-[var(--green)] border-2 border-[var(--bg-surface)]" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <strong className="block text-sm text-[var(--text-1)] truncate">{user.name}</strong>
                    <span className="block text-xs text-[var(--text-3)] truncate">{user.position}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs">
                  <span className={`badge ${cfg.badgeClass} uppercase font-bold text-[10px]`}>
                    {cfg.label}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-3)]">
                    {renderMethodIcon(user.method)}
                    <span className="capitalize">{user.method || '—'}</span>
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg">
                    <span className="block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Clock In</span>
                    <span className="block text-sm font-mono font-bold text-[var(--text-1)] mt-0.5">{user.clockIn || '—'}</span>
                  </div>
                  <div className="p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg">
                    <span className="block text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Clock Out</span>
                    <span className="block text-sm font-mono font-bold text-[var(--text-1)] mt-0.5">{user.clockOut || '—'}</span>
                  </div>
                </div>

                {user.hoursWorked !== null && (
                  <div className="text-right text-xs text-[var(--text-3)] font-semibold font-mono border-t border-[var(--border)] pt-2 mt-2">
                    Worked: <strong className="text-[var(--text-1)]">{user.hoursWorked.toFixed(1)} hrs</strong>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Table Mode */}
      {!isLoading && !isError && viewMode === 'table' && filtered.length > 0 && (
        <div className="card">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-xs uppercase font-semibold">
                  <th className="py-2.5">Member</th>
                  <th className="py-2.5">Department</th>
                  <th className="py-2.5">Position</th>
                  <th className="py-2.5">Status</th>
                  <th className="py-2.5">Clock In</th>
                  <th className="py-2.5">Clock Out</th>
                  <th className="py-2.5">Duration</th>
                  <th className="py-2.5 text-right">Method</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((user: PresenceUser) => {
                  const cfg = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.not_clocked_in;
                  return (
                    <tr key={user.userId} className="hover:bg-[var(--bg-hover)]/10 transition-colors">
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[var(--bg-elevated)] border border-[var(--border)] flex items-center justify-center font-bold text-[var(--text-1)]">
                            {user.avatar || user.name[0]}
                          </div>
                          <span className="font-semibold text-[var(--text-1)]">{user.name}</span>
                        </div>
                      </td>
                      <td className="py-3 text-[var(--text-2)]">{user.department}</td>
                      <td className="py-3 text-[var(--text-2)]">{user.position || '—'}</td>
                      <td className="py-3">
                        <span className={`badge ${cfg.badgeClass} uppercase font-bold text-[10px]`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="py-3 font-mono text-[var(--text-1)]">{user.clockIn || '—'}</td>
                      <td className="py-3 font-mono text-[var(--text-1)]">{user.clockOut || '—'}</td>
                      <td className="py-3 font-mono text-[var(--text-2)] font-semibold">
                        {user.hoursWorked !== null ? `${user.hoursWorked.toFixed(1)}h` : '—'}
                      </td>
                      <td className="py-3 text-right">
                        <span className="inline-flex items-center gap-1 font-semibold text-[var(--text-3)]">
                          {renderMethodIcon(user.method)}
                          <span className="capitalize">{user.method || '—'}</span>
                        </span>
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
  );
}
