'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leavesApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

export default function LeavePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [type, setType] = useState('vacation');
  const [reason, setReason] = useState('');
  const [managerNotes, setManagerNotes] = useState('');
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [showApprovalModal, setShowApprovalModal] = useState<any>(null); // holds leave request when active

  // Fetch leaves
  const { data: leaves = [], isLoading } = useQuery({
    queryKey: ['leaves'],
    queryFn: () => leavesApi.list(),
    enabled: !!user,
  });

  // Apply leave mutation
  const applyLeave = useMutation({
    mutationFn: (data: any) => leavesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      setShowApplyModal(false);
      setStartDate('');
      setEndDate('');
      setType('vacation');
      setReason('');
    },
  });

  // Approve leave mutation
  const updateLeaveStatus = useMutation({
    mutationFn: ({ id, status, notes }: { id: string; status: 'approved' | 'rejected'; notes: string }) =>
      leavesApi.approve(id, { status, managerNotes: notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leaves'] });
      setShowApprovalModal(null);
      setManagerNotes('');
    },
  });

  if (!user) return null;

  const isManagement = ['super_admin', 'admin', 'hr_manager', 'manager'].includes(user.role);

  // Separate user's own leaves and pending leaves for management
  const myLeaves = leaves.filter((l: any) => l.userId === user.id);
  const pendingApprovals = leaves.filter((l: any) => l.status === 'pending' && l.userId !== user.id);

  // Compute leave balances (mock defaults)
  const totalAllocated = { vacation: 15, sick: 10, personal: 5 };
  const approvedLeaves = myLeaves.filter((l: any) => l.status === 'approved');
  
  const getDaysCount = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24)) + 1;
  };

  const taken = {
    vacation: approvedLeaves.filter((l: any) => l.type === 'vacation').reduce((acc: number, l: any) => acc + getDaysCount(l.startDate, l.endDate), 0),
    sick: approvedLeaves.filter((l: any) => l.type === 'sick').reduce((acc: number, l: any) => acc + getDaysCount(l.startDate, l.endDate), 0),
    personal: approvedLeaves.filter((l: any) => l.type === 'personal').reduce((acc: number, l: any) => acc + getDaysCount(l.startDate, l.endDate), 0),
  };

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !endDate) return;
    applyLeave.mutate({ startDate, endDate, type, reason });
  };

  const handleApproveReject = (status: 'approved' | 'rejected') => {
    if (!showApprovalModal) return;
    updateLeaveStatus.mutate({
      id: showApprovalModal.id,
      status,
      notes: managerNotes,
    });
  };

  return (
    <div className="page-content">
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title">Leave Management</h1>
          <p className="page-subtitle">Request time off and manage approvals</p>
        </div>
        <div className="page-actions w-full sm:w-auto">
          <button className="btn-primary w-full sm:w-auto" onClick={() => setShowApplyModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Request Time Off
          </button>
        </div>
      </div>

      {/* Balances widgets */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem',
        marginBottom: '1.5rem',
      }}>
        {[
          { label: 'Vacation Leave', key: 'vacation' as const, color: 'var(--blue)' },
          { label: 'Sick Leave', key: 'sick' as const, color: 'var(--red)' },
          { label: 'Personal Leave', key: 'personal' as const, color: 'var(--yellow)' }
        ].map(item => (
          <div key={item.key} className="kpi-card" style={{ borderLeft: `4px solid ${item.color}` }}>
            <div className="kpi-title">{item.label}</div>
            <div className="kpi-value-row">
              <span className="kpi-value">{totalAllocated[item.key] - taken[item.key]}</span>
              <span className="kpi-trend trend-neutral" style={{ fontSize: '12px' }}>
                {taken[item.key]} of {totalAllocated[item.key]} days taken
              </span>
            </div>
            <div style={{ marginTop: '10px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: item.color,
                width: `${Math.min(100, (taken[item.key] / totalAllocated[item.key]) * 100)}%`
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Pending approvals section for managers */}
      {isManagement && pendingApprovals.length > 0 && (
        <div style={{ marginBottom: '30px' }}>
          <h3 className="section-title" style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--text-1)' }}>Pending Leave Approvals</h3>
          <div className="table-card">
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Leave Type</th>
                    <th>Duration</th>
                    <th>Reason</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map((l: any) => (
                    <tr key={l.id} className="table-row">
                      <td>
                        <div className="table-user-cell">
                          <div className="table-avatar">{l.userName.split(' ').map((w: any) => w[0]).join('')}</div>
                          <div>
                            <p className="table-user-name">{l.userName}</p>
                            <p className="table-user-email">{l.department}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="role-badge" style={{
                          background: l.type === 'vacation' ? 'var(--blue-soft)' : l.type === 'sick' ? 'var(--red-soft)' : 'var(--yellow-soft)',
                          color: l.type === 'vacation' ? 'var(--blue)' : l.type === 'sick' ? 'var(--red)' : 'var(--yellow)'
                        }}>
                          {l.type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="table-text">{l.startDate} to {l.endDate} ({getDaysCount(l.startDate, l.endDate)} days)</span>
                      </td>
                      <td>
                        <span className="table-text" style={{ maxWidth: '250px', display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {l.reason || 'No reason provided'}
                        </span>
                      </td>
                      <td>
                        <button className="btn-primary-sm" onClick={() => setShowApprovalModal(l)} style={{ padding: '4px 10px', fontSize: '11px' }}>
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* History table */}
      <div>
        <h3 className="section-title" style={{ marginBottom: '12px', fontSize: '16px', color: 'var(--text-1)' }}>Leave History</h3>
        <div className="table-card">
          {isLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
              <span className="spinner" style={{ margin: '0 auto 10px', display: 'block' }} /> Loading leave history...
            </div>
          ) : myLeaves.length === 0 ? (
            <div className="empty-state">
              <span style={{ fontSize: 32, marginBottom: 4 }}>🌴</span>
              You haven't taken any leave yet
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Leave Type</th>
                    <th>Dates</th>
                    <th>Days</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Manager Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {myLeaves.map((l: any) => (
                    <tr key={l.id} className="table-row">
                      <td>
                        <span className="role-badge" style={{
                          background: l.type === 'vacation' ? 'var(--blue-soft)' : l.type === 'sick' ? 'var(--red-soft)' : 'var(--yellow-soft)',
                          color: l.type === 'vacation' ? 'var(--blue)' : l.type === 'sick' ? 'var(--red)' : 'var(--yellow)'
                        }}>
                          {l.type.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className="table-text">{l.startDate} to {l.endDate}</span>
                      </td>
                      <td>
                        <span className="table-text">{getDaysCount(l.startDate, l.endDate)} days</span>
                      </td>
                      <td>
                        <span className="table-text">{l.reason || '—'}</span>
                      </td>
                      <td>
                        <span className={`status-pill ${
                          l.status === 'approved' ? 'status-present' : l.status === 'rejected' ? 'status-absent' : 'status-late'
                        }`} style={{ textTransform: 'capitalize' }}>
                          {l.status}
                        </span>
                      </td>
                      <td>
                        <span className="table-text" style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                          {l.managerNotes || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Apply leave modal */}
      {showApplyModal && (
        <div className="modal-overlay" onClick={() => setShowApplyModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Request Time Off</h3>
              <button className="modal-close" onClick={() => setShowApplyModal(false)}>✕</button>
            </div>
            <form onSubmit={handleApply} className="modal-body">
              <div className="form-group">
                <label className="form-label">Leave Type</label>
                <select className="form-input form-select" value={type} onChange={e => setType(e.target.value)}>
                  <option value="vacation">Vacation Leave</option>
                  <option value="sick">Sick Leave</option>
                  <option value="personal">Personal Leave</option>
                </select>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Start Date *</label>
                  <input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} required />
                </div>
                <div className="form-group">
                  <label className="form-label">End Date *</label>
                  <input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} required />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Reason</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Enter details of your leave request..."
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setShowApplyModal(false)}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 16px' }} disabled={applyLeave.isPending}>
                  {applyLeave.isPending ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Review leave modal */}
      {showApprovalModal && (
        <div className="modal-overlay" onClick={() => setShowApprovalModal(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Review Leave Request</h3>
              <button className="modal-close" onClick={() => setShowApprovalModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: '15px', padding: '12px', background: 'var(--bg-surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--text-1)', fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>{showApprovalModal.userName}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Department: {showApprovalModal.department}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '8px' }}>
                  <strong>Type:</strong> <span style={{ color: 'var(--blue)' }}>{showApprovalModal.type.toUpperCase()}</span>
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                  <strong>Duration:</strong> {showApprovalModal.startDate} to {showApprovalModal.endDate} ({getDaysCount(showApprovalModal.startDate, showApprovalModal.endDate)} days)
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '8px' }}>
                  <strong>Reason:</strong> {showApprovalModal.reason || 'No reason provided'}
                </p>
              </div>

              <div className="form-group">
                <label className="form-label">Manager Decision Notes</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={managerNotes}
                  onChange={e => setManagerNotes(e.target.value)}
                  placeholder="Enter approval/rejection notes..."
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
                <button type="button" className="btn-secondary" style={{ padding: '8px 16px' }} onClick={() => setShowApprovalModal(null)}>Close</button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '8px 16px', background: 'var(--red)' }}
                  onClick={() => handleApproveReject('rejected')}
                  disabled={updateLeaveStatus.isPending}
                >
                  Reject
                </button>
                <button
                  type="button"
                  className="btn-primary"
                  style={{ padding: '8px 16px', background: 'var(--green)' }}
                  onClick={() => handleApproveReject('approved')}
                  disabled={updateLeaveStatus.isPending}
                >
                  Approve
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
