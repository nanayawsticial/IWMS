'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { overtimeApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const STATUS_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  pending:  { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', label: 'Pending' },
  approved: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Approved' },
  rejected: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Rejected' },
};

export default function OvertimePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewingRequest, setReviewingRequest] = useState<any>(null);
  const [actionType, setActionType] = useState<'approved' | 'rejected' | null>(null);

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

  const isManagement = ['super_admin', 'admin', 'hr_manager', 'manager'].includes(user?.role || '');

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
      <div className="page-header">
        <div>
          <h1 className="page-title">Overtime Management</h1>
          <p className="page-subtitle">Track, review, and approve employee overtime requests</p>
        </div>
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
          <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />
          Loading Overtime Requests...
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="attendance-stats" style={{ marginBottom: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="att-stat-card" style={{ '--stat-color': '#6366f1' } as React.CSSProperties}>
              <span className="att-stat-value" style={{ color: '#6366f1' }}>{totalOtHoursMonth.toFixed(1)}h</span>
              <span className="att-stat-label">OT Hours This Month</span>
            </div>
            <div className="att-stat-card" style={{ '--stat-color': '#f59e0b' } as React.CSSProperties}>
              <span className="att-stat-value" style={{ color: '#f59e0b' }}>{pendingCount}</span>
              <span className="att-stat-label">Pending Approvals</span>
            </div>
            <div className="att-stat-card" style={{ '--stat-color': '#10b981' } as React.CSSProperties}>
              <span className="att-stat-value" style={{ color: '#10b981' }}>{approvedCount}</span>
              <span className="att-stat-label">Approved Requests</span>
            </div>
            <div className="att-stat-card" style={{ '--stat-color': '#ef4444' } as React.CSSProperties}>
              <span className="att-stat-value" style={{ color: '#ef4444' }}>{rejectedCount}</span>
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
                          <div className="table-avatar" style={{ background: 'rgba(99,102,241,0.12)', color: '#818cf8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px' }}>
                            {r.userAvatar}
                          </div>
                          <div>
                            <p className="table-user-name">{r.userName}</p>
                            <p className="table-user-email" style={{ fontSize: '11px', color: '#64748b' }}>
                              {r.department || 'Unassigned'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="time-cell" style={{ color: '#e2e8f0' }}>
                          {new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', color: '#cbd5e1' }}>{r.regularHours.toFixed(1)}h</td>
                      <td style={{ textAlign: 'center', color: '#f59e0b', fontWeight: 600 }}>{r.overtimeHours.toFixed(1)}h</td>
                      <td style={{ color: '#94a3b8', fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.reason}>
                        {r.reason || '—'}
                      </td>
                      <td>
                        <span className="status-pill" style={{ color: STATUS_BADGES[r.status]?.text, background: STATUS_BADGES[r.status]?.bg, fontSize: '11px', fontWeight: 600 }}>
                          {STATUS_BADGES[r.status]?.label || r.status}
                        </span>
                        {r.reviewedBy && (
                          <span style={{ display: 'block', fontSize: '10px', color: '#64748b', marginTop: '2px' }} title={`Reviewed by: ${r.reviewedBy}`}>
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
                                style={{ color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.3)', background: 'rgba(16, 185, 129, 0.05)' }}
                              >
                                Approve
                              </button>
                              <button
                                className="table-action-btn"
                                onClick={() => handleOpenReview(r, 'rejected')}
                                style={{ color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', background: 'rgba(239, 68, 68, 0.05)' }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#475569' }}>
                              {r.reviewNotes ? `Notes: ${r.reviewNotes}` : 'Reviewed'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                  {requests.length === 0 && (
                    <tr>
                      <td colSpan={isManagement ? 7 : 6} style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                        No overtime requests recorded.
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
              background: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '420px',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.5)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #1e293b', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc', fontWeight: 600 }}>
                {actionType === 'approved' ? 'Approve Overtime Request' : 'Reject Overtime Request'}
              </h3>
              <button
                onClick={() => { setReviewingRequest(null); setActionType(null); }}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '20px', cursor: 'pointer', padding: '4px' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleReviewSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                <p style={{ color: '#cbd5e1', fontSize: '14px', margin: 0 }}>
                  Confirm review for <strong>{reviewingRequest.userName}</strong>'s request of{' '}
                  <strong style={{ color: '#f59e0b' }}>{reviewingRequest.overtimeHours.toFixed(1)}h</strong> on{' '}
                  <strong>{new Date(reviewingRequest.date).toLocaleDateString()}</strong>.
                </p>

                <div style={{ marginTop: '8px' }}>
                  <label htmlFor="notes" style={{ fontSize: '12px', color: '#64748b', display: 'block', marginBottom: '6px' }}>
                    Review Notes / Remarks (Optional)
                  </label>
                  <textarea
                    id="notes"
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="e.g. Approved for weekend maintenance shift work."
                    style={{
                      width: '100%',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      color: '#f8fafc',
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
                  style={{ padding: '8px 16px', background: '#334155', color: '#f8fafc', border: 'none', borderRadius: '6px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewOvertime.isPending}
                  style={{
                    padding: '8px 16px',
                    background: actionType === 'approved' ? '#10b981' : '#ef4444',
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
    </div>
  );
}
