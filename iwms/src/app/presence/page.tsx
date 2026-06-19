'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '@/lib/api';
import { useSocketEvent } from '@/hooks/useSocket';

// -- Types ------------------------------------------------------------------
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

// -- Status Config ----------------------------------------------------------
const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; ring: string }> = {
  present:        { label: 'Present',        color: '#10b981', bg: 'rgba(16,185,129,0.12)',   ring: '#10b981' },
  late:           { label: 'Late',           color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  ring: '#f59e0b' },
  absent:         { label: 'Absent',         color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   ring: '#ef4444' },
  on_leave:       { label: 'On Leave',       color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)', ring: '#8b5cf6' },
  not_clocked_in: { label: 'Not Clocked In', color: '#64748b', bg: 'rgba(100,116,139,0.10)', ring: '#64748b' },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.not_clocked_in;
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
        color: cfg.color, background: cfg.bg, whiteSpace: 'nowrap',
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: cfg.color, display: 'inline-block', flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

function AvatarRing({ user }: { user: PresenceUser }) {
  const cfg = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.not_clocked_in;
  return (
    <div
      style={{
        width: 52, height: 52, borderRadius: '50%',
        border: `3px solid ${cfg.ring}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `${cfg.ring}18`,
        fontSize: 18, fontWeight: 700, color: cfg.ring,
        flexShrink: 0, position: 'relative',
      }}
    >
      {user.avatar}
      {(user.status === 'present' || user.status === 'late') && (
        <span
          style={{
            position: 'absolute', bottom: 1, right: 1,
            width: 12, height: 12, borderRadius: '50%',
            background: cfg.ring, border: '2px solid #1a1f2e',
          }}
        />
      )}
    </div>
  );
}

function KpiPill({ label, value, color, bg, active, onClick }: {
  label: string; value: number; color: string; bg: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '10px 18px', borderRadius: 12,
        border: active ? `2px solid ${color}` : '2px solid transparent',
        background: active ? bg : 'var(--color-bg-elevated, #1a1f2e)',
        cursor: 'pointer', transition: 'all 0.15s', minWidth: 80,
      }}
    >
      <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 11, color: active ? color : '#94a3b8', fontWeight: 500 }}>{label}</span>
    </button>
  );
}

function GridCard({ user }: { user: PresenceUser }) {
  const cfg = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.not_clocked_in;
  return (
    <div
      style={{
        background: 'var(--color-bg-elevated, #1a1f2e)',
        border: '1px solid var(--color-border, #2d3748)',
        borderRadius: 14, padding: '18px 16px',
        display: 'flex', flexDirection: 'column', gap: 12,
        transition: 'transform 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${cfg.ring}22`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <AvatarRing user={user} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 600, fontSize: 14, color: '#f1f5f9', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
          <p style={{ fontSize: 12, color: '#94a3b8', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.position || user.department}</p>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <StatusBadge status={user.status} />
        <span style={{ fontSize: 11, color: '#94a3b8' }}>{user.method === 'hardware' ? '?? HW' : user.method === 'web' ? '?? Web' : ''}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[{ label: 'Clock In', value: user.clockIn }, { label: 'Clock Out', value: user.clockOut }].map(({ label, value }) => (
          <div key={label} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 8, padding: '6px 10px' }}>
            <p style={{ fontSize: 10, color: '#64748b', margin: '0 0 2px' }}>{label}</p>
            <p style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9', margin: 0, fontFamily: 'monospace' }}>{value ?? ''}</p>
          </div>
        ))}
      </div>
      {user.hoursWorked !== null && (
        <div style={{ textAlign: 'right' }}>
          <span style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{user.hoursWorked.toFixed(1)}h worked</span>
        </div>
      )}
    </div>
  );
}

function TableRow({ user, index }: { user: PresenceUser; index: number }) {
  const cfg = STATUS_CONFIG[user.status] ?? STATUS_CONFIG.not_clocked_in;
  return (
    <tr
      style={{ background: index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', borderBottom: '1px solid #2d3748', transition: 'background 0.1s' }}
      onMouseEnter={e => (e.currentTarget.style.background = `${cfg.ring}0d`)}
      onMouseLeave={e => (e.currentTarget.style.background = index % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)')}
    >
      <td style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: '50%', background: `${cfg.ring}18`, border: `2px solid ${cfg.ring}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: cfg.ring, flexShrink: 0 }}>{user.avatar}</div>
          <span style={{ fontWeight: 500, fontSize: 13, color: '#f1f5f9' }}>{user.name}</span>
        </div>
      </td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#cbd5e1' }}>{user.department}</td>
      <td style={{ padding: '12px 16px', fontSize: 13, color: '#94a3b8' }}>{user.position || ''}</td>
      <td style={{ padding: '12px 16px' }}><StatusBadge status={user.status} /></td>
      <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: '#cbd5e1' }}>{user.clockIn ?? ''}</td>
      <td style={{ padding: '12px 16px', fontSize: 13, fontFamily: 'monospace', color: '#cbd5e1' }}>{user.clockOut ?? ''}</td>
      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: cfg.color }}>{user.hoursWorked !== null ? `${user.hoursWorked.toFixed(1)}h` : ''}</td>
    </tr>
  );
}

export default function PresencePage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [activeStatus, setActiveStatus] = useState<string>('all');
  const [activeDept, setActiveDept] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [liveDot, setLiveDot] = useState(true);

  useEffect(() => {
    const t = setInterval(() => setLiveDot(v => !v), 1200);
    return () => clearInterval(t);
  }, []);

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
    { key: 'all',            label: 'Total',      value: summary.total,        color: '#6366f1', bg: 'rgba(99,102,241,0.12)' },
    { key: 'present',        label: 'Present',    value: summary.present,      color: '#10b981', bg: 'rgba(16,185,129,0.12)' },
    { key: 'late',           label: 'Late',       value: summary.late,         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
    { key: 'absent',         label: 'Absent',     value: summary.absent,       color: '#ef4444', bg: 'rgba(239,68,68,0.12)' },
    { key: 'on_leave',       label: 'On Leave',   value: summary.onLeave,      color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
    { key: 'not_clocked_in', label: 'Not In Yet', value: summary.notClockedIn, color: '#64748b', bg: 'rgba(100,116,139,0.10)' },
  ];

  return (
    <main style={{ padding: '24px 28px', minHeight: '100vh', maxWidth: 1400, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#f1f5f9' }}>Team Presence</h1>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 9px', borderRadius: 20, background: liveDot ? 'rgba(16,185,129,0.18)' : 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', transition: 'background 0.6s' }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#10b981', display: 'inline-block', boxShadow: liveDot ? '0 0 6px #10b981' : 'none', transition: 'box-shadow 0.6s' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: '#10b981', letterSpacing: '0.05em' }}>LIVE</span>
            </span>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: '#94a3b8' }}>Today  {data?.date ?? ''}</p>
        </div>
        <div style={{ display: 'flex', background: '#1a1f2e', border: '1px solid #2d3748', borderRadius: 10, overflow: 'hidden' }}>
          {(['grid', 'table'] as const).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{ padding: '7px 16px', background: viewMode === mode ? '#6366f1' : 'transparent', color: viewMode === mode ? '#fff' : '#94a3b8', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
              {mode === 'grid' ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
              )}
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* KPI Pills */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        {kpis.map(k => (
          <KpiPill key={k.key} label={k.label} value={k.value} color={k.color} bg={k.bg} active={activeStatus === k.key} onClick={() => setActiveStatus(prev => prev === k.key ? 'all' : k.key)} />
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 340 }}>
          <svg style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#94a3b8', pointerEvents: 'none' }} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or department" style={{ width: '100%', padding: '9px 12px 9px 34px', background: '#1a1f2e', border: '1px solid #2d3748', borderRadius: 10, color: '#f1f5f9', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {departments.map(dept => (
            <button key={dept} onClick={() => setActiveDept(dept)} style={{ padding: '7px 14px', borderRadius: 20, border: activeDept === dept ? '1px solid #6366f1' : '1px solid #2d3748', background: activeDept === dept ? 'rgba(99,102,241,0.15)' : '#1a1f2e', color: activeDept === dept ? '#6366f1' : '#94a3b8', fontSize: 12, fontWeight: 500, cursor: 'pointer', transition: 'all 0.15s' }}>
              {dept === 'all' ? 'All Departments' : dept}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 'auto' }}>{filtered.length} of {summary.total} employees</span>
      </div>

      {isLoading && <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>Loading presence data</div>}
      {isError && <div style={{ textAlign: 'center', padding: '60px 0', color: '#ef4444', fontSize: 14 }}>Failed to load presence data. Please try again.</div>}
      {!isLoading && !isError && filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px 0', color: '#94a3b8', fontSize: 14 }}>No employees match the current filters.</div>}

      {/* Grid */}
      {!isLoading && !isError && viewMode === 'grid' && filtered.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
          {filtered.map((user: PresenceUser) => <GridCard key={user.userId} user={user} />)}
        </div>
      )}

      {/* Table */}
      {!isLoading && !isError && viewMode === 'table' && filtered.length > 0 && (
        <div style={{ background: '#1a1f2e', border: '1px solid #2d3748', borderRadius: 14, overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #2d3748' }}>
                {['Employee', 'Department', 'Position', 'Status', 'Clock In', 'Clock Out', 'Hours'].map(h => (
                  <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 600, color: '#64748b', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((user: PresenceUser, i: number) => <TableRow key={user.userId} user={user} index={i} />)}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
