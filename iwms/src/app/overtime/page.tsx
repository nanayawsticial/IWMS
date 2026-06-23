'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { overtimeApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: 'var(--yellow-soft)', text: 'var(--yellow)', label: 'Pending' },
  approved: { bg: 'var(--green-soft)', text: 'var(--green)', label: 'Approved' },
  rejected: { bg: 'var(--red-soft)', text: 'var(--red)', label: 'Rejected' },
};

export default function OvertimePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewingRequest, setReviewingRequest] = useState<any>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | null>(null);

  // Log Overtime modal states
  const [showModal, setShowModal] = useState(false);
  const [logDate, setLogDate] = useState('');
  const [logRegularHours, setLogRegularHours] = useState(8);
  const [logOvertimeHours, setLogOvertimeHours] = useState(0);
  const [logReason, setLogReason] = useState('');

  // Queries
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['overtime-requests'],
    queryFn: () => overtimeApi.list(),
  });

  // Mutations
  const reviewOvertime = useMutation({
    mutationFn: ({ id, status, reviewNotes }: { id: string; status: 'approved' | 'rejected'; reviewNotes?: string }) =>
      overtimeApi.review(id, { status, reviewNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime-requests'] });
      setReviewingRequest(null);
      setActionType(null);
      setReviewNotes('');
    },
  });

  const createOvertime = useMutation({
    mutationFn: (data: any) => overtimeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['overtime-requests'] });
      setShowModal(false);
      setLogDate('');
      setLogRegularHours(8);
      setLogOvertimeHours(0);
      setLogReason('');
    },
  });

  const handleLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    createOvertime.mutate({
      userId: user.id,
      date: logDate,
      regularHours: Number(logRegularHours),
      overtimeHours: Number(logOvertimeHours),
      reason: logReason,
    });
  };

  const isManagement = ['super_admin', 'admin', 'hr_manager', 'manager'].includes(user?.role || '');

  const canLogOvertime = !isManagement;

  // Calculate statistics
  const currentMonthStr = new Date().toISOString().substring(0, 7); // YYYY-MM
  const totalOtHoursMonth = requests
    .filter((r: any) => r.status === 'approved' && r.date.startsWith(currentMonthStr))
    .reduce((sum: number, r: any) => sum + r.overtimeHours, 0);

  const pendingCount = requests.filter((r: any) => r.status === 'pending').length;
  const approvedCount = requests.filter((r: any) => r.status === 'approved').length;
  const rejectedCount = requests.filter((r: any) => r.status === 'rejected').length;

  const handleOpenReview = (request: any, type: 'approved' | 'rejected') => {
    setReviewingRequest(request);
    setActionType(type);
    setReviewNotes('');
  };

  const handleReviewSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewingRequest || !actionType) return;
    reviewOvertime.mutate({
      id: reviewingRequest.id,
      status: actionType,
      reviewNotes: reviewNotes || undefined,
    });
  };

  return (
    <div className="page-content">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div className="page-header" style={{ marginBottom: 0 }}>
          <h1 className="page-title">Overtime Management</h1>
          <p className="page-subtitle">Track, review, and approve employee overtime requests</p>
        </div>
        {canLogOvertime && (
          <button className="btn-primary" onClick={() => setShowModal(true)}>
            + Log Overtime
          </button>
        )}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-3)' }}>
          <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />
          Loading Overtime Requests...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="kpi-grid-4" style={{ marginBottom: '24px' }}>
            <div className="att-stat-card" style={{ '--stat-color': 'var(--blue)' } as React.CSSProperties}>
              <span className="att-stat-value" style={{ color: 'var(--blue)' }}>{totalOtHoursMonth.toFixed(1)}h</span>
              <span className="att-stat-label">OT Hours This Month</span>
            </div>
            <div className="att-stat-card" style={{ '--stat-color': 'var(--yellow)' } as React.CSSProperties}>
              <span className="att-stat-value" style={{ color: 'var(--yellow)' }}>{pendingCount}</span>
              <span className="att-stat-label">Pending Approvals</span>
            </div>
            <div className="att-stat-card" style={{ '--stat-color': 'var(--green)' } as React.CSSProperties}>
              <span className="att-stat-value" style={{ color: 'var(--green)' }}>{approvedCount}</span>
              <span className="att-stat-label">Approved Requests</span>
            </div>
            <div className="att-stat-card" style={{ '--stat-color': 'var(--red)' } as React.CSSProperties}>
              <span className="att-stat-value" style={{ color: 'var(--red)' }}>{rejectedCount}</span>
              <span className="att-stat-label">Rejected Requests</span>
            </div>
          </div>

          {/* Overtime Requests Table */}
          <div className="table-card" style={{ padding: '24px' }}>
            <div className="chart-header" style={{ marginBottom: '20px' }}>
              <h3 className="chart-title">{isManagement ? 'All Overtime Requests' : 'My Overtime History'}</h3>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Date</th>
                    <th style={{ textAlign: 'center' }}>Regular Hrs</th>
                    <th style={{ textAlign: 'center' }}>OT Hrs</th>
                    <th>Reason</th>
                    <th>Status</th>
                    {isManagement && <th>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {requests.map((r: any) => (
                    <tr key={r.id} className="table-row">
                      <td>
                        <div className="table-user-cell">
                          <div className="table-avatar" style={{ background: 'var(--blue-soft)', color: 'var(--blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                            {r.userAvatar}
                          </div>
                          <div>
                            <p className="table-user-name">{r.userName}</p>
                            <p className="table-user-email" style={{ fontSize: '11px', color: 'var(--text-3)' }}>
                              {r.department || 'Unassigned'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="time-cell" style={{ color: 'var(--text-1)' }}>
                          {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: 'var(--text-1)' }}>{r.regularHours.toFixed(1)}h</td>
                      <td style={{ textAlign: 'center', color: 'var(--yellow)', fontWeight: 600 }}>{r.overtimeHours.toFixed(1)}h</td>
                      <td style={{ color: 'var(--text-3)', fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reason}>
                        {r.reason || '—'}
                      </td>
                      <td>
                        <span className="status-pill" style={{ color: STATUS_BADGES[r.status]?.text, background: STATUS_BADGES[r.status]?.bg, fontSize: '11px', fontWeight: 600 }}>
                          {STATUS_BADGES[r.status]?.label || r.status}
                        </span>
                        {r.reviewedBy && (
                          <span style={{ display: 'block', fontSize: '10px', color: 'var(--text-3)', marginTop: '2px' }} title={`Reviewed by: ${r.reviewedBy}`}>
                            By: {r.reviewedBy.split('@')[0]}
                          </span>
                        )}
                      </td>
                      {isManagement && (
                        <td>
                          {r.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <button
                                className="table-action-btn"
                                onClick={() => handleOpenReview(r, 'approved')}
                                style={{ color: 'var(--green)', border: '1px solid rgba(34, 197, 94, 0.3)', background: 'var(--green-soft)' }}
                              >
                                Approve
                              </button>
                              <button
                                className="table-action-btn"
                                onClick={() => handleOpenReview(r, 'rejected')}
                                style={{ color: 'var(--red)', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'var(--red-soft)' }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: 'var(--text-3)' }}>
                              {r.reviewNotes ? `Notes: ${r.reviewNotes}` : 'Reviewed'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={isManagement ? 7 : 6}>
                        <div className="empty-state">No overtime requests recorded</div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Review Confirmation Modal */}
      {reviewingRequest && actionType && (
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
          onClick={() => { setReviewingRequest(null); setActionType(null); }}
        >
          <div
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: 'var(--glass-shadow)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-1)', fontWeight: 600 }}>
                {actionType === 'approved' ? 'Approve Overtime Request' : 'Reject Overtime Request'}
              </h3>
              <button
                onClick={() => { setReviewingRequest(null); setActionType(null); }}
                style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleReviewSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <p style={{ color: 'var(--text-2)', fontSize: '14px', margin: 0 }}>
                  Confirm review for <strong>{reviewingRequest.userName}</strong>'s request of{' '}
                  <strong style={{ color: 'var(--yellow)' }}>{reviewingRequest.overtimeHours.toFixed(1)}h</strong> on{' '}
                  <strong>{new Date(reviewingRequest.date).toLocaleDateString()}</strong>.
                </p>

                <div style={{ marginTop: '8px' }}>
                  <label htmlFor="notes" style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                    Review Notes / Remarks (Optional)
                  </label>
                  <textarea
                    id="notes"
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="e.g. Approved for weekend maintenance shift work."
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-1)',
                      padding: '10px',
                      fontSize: '13px',
                      height: '80px',
                      resize: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => { setReviewingRequest(null); setActionType(null); }}
                  className="btn-ghost-sm"
                  style={{ padding: '8px 16px', background: 'var(--bg-hover)', color: 'var(--text-1)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewOvertime.isPending}
                  style={{
                    padding: '8px 16px',
                    background: actionType === 'approved' ? 'var(--green)' : 'var(--red)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {reviewOvertime.isPending ? 'Saving...' : actionType === 'approved' ? 'Approve' : 'Reject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Log Overtime Modal */}
      {showModal && (
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
          onClick={() => setShowModal(false)}
        >
          <div
            style={{
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-strong)',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: 'var(--glass-shadow)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-1)', fontWeight: 600 }}>Log Overtime</h3>
              <button
                onClick={() => setShowModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-2)', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleLogSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <div>
                  <label htmlFor="logDate" style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                    Date *
                  </label>
                  <input
                    id="logDate"
                    type="date"
                    required
                    value={logDate}
                    onChange={e => setLogDate(e.target.value)}
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-1)',
                      padding: '10px',
                      fontSize: '13px',
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '16px' }}>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="regHours" style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                      Regular Hours *
                    </label>
                    <input
                      id="regHours"
                      type="number"
                      step="0.5"
                      required
                      value={logRegularHours}
                      onChange={e => setLogRegularHours(Number(e.target.value))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--text-1)',
                        padding: '10px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label htmlFor="otHours" style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                      Overtime Hours *
                    </label>
                    <input
                      id="otHours"
                      type="number"
                      step="0.5"
                      required
                      value={logOvertimeHours}
                      onChange={e => setLogOvertimeHours(Number(e.target.value))}
                      style={{
                        width: '100%',
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border)',
                        borderRadius: '6px',
                        color: 'var(--text-1)',
                        padding: '10px',
                        fontSize: '13px',
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="logReason" style={{ fontSize: '12px', color: 'var(--text-3)', display: 'block', marginBottom: '6px' }}>
                    Reason / Description
                  </label>
                  <textarea
                    id="logReason"
                    value={logReason}
                    onChange={e => setLogReason(e.target.value)}
                    placeholder="e.g. Worked extra hours to complete sprint tasks."
                    style={{
                      width: '100%',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '6px',
                      color: 'var(--text-1)',
                      padding: '10px',
                      fontSize: '13px',
                      height: '80px',
                      resize: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn-ghost-sm"
                  style={{ padding: '8px 16px', background: 'var(--bg-hover)', color: 'var(--text-1)', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOvertime.isPending}
                  style={{
                    padding: '8px 16px',
                    background: 'var(--accent)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  {createOvertime.isPending ? 'Saving...' : 'Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
