'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, departmentsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import Link from 'next/link';

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin', admin: 'Admin', hr_manager: 'HR Manager',
  manager: 'Manager', team_lead: 'Team Lead', employee: 'Employee',
};
const ROLE_COLORS: Record<string, string> = {
  super_admin: '#ef4444', admin: '#6366f1', hr_manager: '#f59e0b',
  manager: '#8b5cf6', team_lead: '#06b6d4', employee: '#10b981',
};
const DEPT_COLORS: Record<string, string> = {
  Engineering: '#6366f1', Product: '#8b5cf6', Design: '#ec4899',
  HR: '#f59e0b', Marketing: '#10b981', Finance: '#06b6d4',
};

function getAvatarColor(name: string): { bg: string; color: string } {
  const initial = name.trim().toUpperCase()[0] || 'A'
  const code = initial.charCodeAt(0)
  const colors = [
    { bg: 'rgba(59,130,246,0.15)',  color: '#3b82f6' },  // A-D
    { bg: 'rgba(139,92,246,0.15)', color: '#8b5cf6' },  // E-H
    { bg: 'rgba(20,184,166,0.15)', color: '#14b8a6' },  // I-L
    { bg: 'rgba(249,115,22,0.15)', color: '#f97316' },  // M-P
    { bg: 'rgba(34,197,94,0.15)',  color: '#22c55e' },  // Q-T
    { bg: 'rgba(236,72,153,0.15)', color: '#ec4899' },  // U-Z
  ]
  return colors[Math.floor((code - 65) / 4.33)] || colors[0]
}

function UserCard({ user }: { user: any }) {
  const deptColor = DEPT_COLORS[user.department] || '#6366f1';
  const avatarColors = getAvatarColor(user.name);
  return (
    <div
      className="user-card-grid"
      style={{
        cursor: 'pointer',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--accent)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <Link href={`/team/${user.id}`} style={{ textDecoration: 'none' }}>
        <div className="user-card-avatar" style={{ background: avatarColors.bg, border: `2px solid ${avatarColors.color}40`, margin: '0 auto 12px' }}>
          <span style={{ color: avatarColors.color, fontSize: '18px', fontWeight: 700 }}>{user.avatar}</span>
          <span className={`user-status-dot ${user.status === 'active' ? 'status-active' : 'status-inactive'}`} />
        </div>
      </Link>
      <Link href={`/team/${user.id}`} style={{ textDecoration: 'none' }}>
        <h4 className="user-card-name" style={{ margin: '0 0 4px 0' }}>{user.name}</h4>
      </Link>
      <p className="user-card-position">{user.position}</p>
      <div className="user-card-badges">
        <span className="dept-badge" style={{ background: `${deptColor}20`, color: deptColor }}>{user.department}</span>
        <span className="role-badge" style={{ background: `${ROLE_COLORS[user.role]}20`, color: ROLE_COLORS[user.role] }}>{ROLE_LABELS[user.role]}</span>
      </div>
      <div className="user-card-contact">
        <a href={`mailto:${user.email}`} className="contact-link">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
          {user.email}
        </a>
      </div>
    </div>
  );
}

export default function TeamPage() {
  const { hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [activeDept, setActiveDept] = useState('all');
  const [searchQ, setSearchQ] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', department: 'Engineering', position: '', role: 'employee', password: 'Welcome123!' });

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  });

  const createUser = useMutation({
    mutationFn: (data: Record<string, unknown>) => usersApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setShowAddModal(false);
      setNewUser({ name: '', email: '', department: 'Engineering', position: '', role: 'employee', password: 'Welcome123!' });
    },
  });

  const filtered = users.filter((u: any) => {
    const matchDept = activeDept === 'all' || u.departmentId === activeDept || (departments.find((d: any) => d.id === activeDept)?.name === u.department);
    const matchSearch = u.name.toLowerCase().includes(searchQ.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQ.toLowerCase()) ||
      u.position.toLowerCase().includes(searchQ.toLowerCase());
    return matchDept && matchSearch;
  });

  const handleAdd = () => {
    if (!newUser.name || !newUser.email) return;
    createUser.mutate({
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      roleName: newUser.role,
      departmentName: newUser.department,
      position: newUser.position,
    });
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Team Directory</h1>
          <p className="page-subtitle">{filtered.length} of {users.length} employees</p>
        </div>
        <div className="page-actions">
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input type="text" placeholder="Search employees..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="search-input" />
          </div>
          <div className="view-toggle">
            <button className={`view-btn ${view === 'grid' ? 'view-btn-active' : ''}`} onClick={() => setView('grid')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            </button>
            <button className={`view-btn ${view === 'list' ? 'view-btn-active' : ''}`} onClick={() => setView('list')}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
            </button>
          </div>
          {hasPermission('manage_users') && (
            <button className="btn-primary-sm" onClick={() => setShowAddModal(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Add Employee
            </button>
          )}
        </div>
      </div>

      {/* Department filters */}
      <div className="dept-stats-row">
        {departments.map((dept: any) => (
          <button key={dept.id} className="dept-stat-chip"
            style={{
              background: activeDept === dept.id ? 'var(--accent)' : 'var(--bg-elevated)',
              color: activeDept === dept.id ? 'white' : 'var(--text-2)',
              border: 'none',
              padding: '5px 14px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
            }}
            onClick={() => setActiveDept(activeDept === dept.id ? 'all' : dept.id)}>
            <span className="dept-dot" style={{ background: dept.color }} />
            <span className="dept-chip-name">{dept.name}</span>
            <span className="dept-chip-count">{dept.headcount}</span>
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
          <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />Loading team...
        </div>
      ) : view === 'grid' ? (
        <div className="users-grid">{filtered.map((u: any) => <UserCard key={u.id} user={u} />)}</div>
      ) : (
        <div className="table-card">
          <table className="data-table">
            <thead>
              <tr><th>Employee</th><th>Position</th><th>Department</th><th>Role</th><th>Joined</th><th>Status</th></tr>
            </thead>
            <tbody>
              {filtered.map((u: any) => {
                const avatarColors = getAvatarColor(u.name);
                return (
                  <tr key={u.id} className="table-row">
                    <td>
                      <div className="table-user-cell">
                        <Link href={`/team/${u.id}`} style={{ textDecoration: 'none' }}>
                          <div className="table-avatar" style={{ background: avatarColors.bg, color: avatarColors.color }}>{u.avatar}</div>
                        </Link>
                        <div>
                          <Link href={`/team/${u.id}`} style={{ textDecoration: 'none' }}>
                            <p className="table-user-name" style={{ margin: 0 }}>{u.name}</p>
                          </Link>
                          <p className="table-user-email">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td><span className="table-text">{u.position}</span></td>
                    <td><span className="dept-badge" style={{ background: `${DEPT_COLORS[u.department]}20`, color: DEPT_COLORS[u.department] }}>{u.department}</span></td>
                    <td><span className="role-badge" style={{ background: `${ROLE_COLORS[u.role]}20`, color: ROLE_COLORS[u.role] }}>{ROLE_LABELS[u.role]}</span></td>
                    <td><span className="table-text">{new Date(u.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</span></td>
                    <td><span className={`status-pill ${u.status === 'active' ? 'status-present' : 'status-absent'}`}>{u.status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Employee</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input className="form-input" value={newUser.name} onChange={e => setNewUser(p => ({ ...p, name: e.target.value }))} placeholder="John Doe" />
                </div>
                <div className="form-group">
                  <label className="form-label">Email *</label>
                  <input className="form-input" type="email" value={newUser.email} onChange={e => setNewUser(p => ({ ...p, email: e.target.value }))} placeholder="john@stemaide.com" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Position</label>
                  <input className="form-input" value={newUser.position} onChange={e => setNewUser(p => ({ ...p, position: e.target.value }))} placeholder="Software Engineer" />
                </div>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select className="form-input form-select" value={newUser.department} onChange={e => setNewUser(p => ({ ...p, department: e.target.value }))}>
                    {departments.map((d: any) => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select className="form-input form-select" value={newUser.role} onChange={e => setNewUser(p => ({ ...p, role: e.target.value }))}>
                    {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Temp Password</label>
                  <input className="form-input" value={newUser.password} onChange={e => setNewUser(p => ({ ...p, password: e.target.value }))} placeholder="Welcome123!" />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowAddModal(false)}>Cancel</button>
              <button className="btn-primary-sm" onClick={handleAdd} disabled={createUser.isPending}>
                {createUser.isPending ? <span className="spinner sm-spinner" /> : 'Add Employee'}
              </button>
            </div>
            {createUser.isError && (
              <p style={{ color: '#ef4444', fontSize: '13px', padding: '0 24px 16px' }}>
                {(createUser.error as any)?.response?.data?.error || 'Failed to add employee'}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
