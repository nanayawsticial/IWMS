'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';

const STATUS_OPTIONS = [
  { value: 'backlog', label: 'Backlog', color: '#64748b' },
  { value: 'todo', label: 'To Do', color: '#94a3b8' },
  { value: 'in_progress', label: 'In Progress', color: '#6366f1' },
  { value: 'review', label: 'Review', color: '#f59e0b' },
  { value: 'done', label: 'Done', color: '#10b981' },
];

export default function TaskDetailPanel({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'comments' | 'timelogs'>('comments');
  
  // Comment state
  const [commentContent, setCommentContent] = useState('');
  
  // Timelog state
  const [hours, setHours] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().split('T')[0]);
  const [logNote, setLogNote] = useState('');

  // Fetch full task details
  const { data: task, isLoading, error } = useQuery({
    queryKey: ['task-details', taskId],
    queryFn: () => tasksApi.get(taskId),
  });

  const { user } = useAuth();
  const updateStatus = useMutation({
    mutationFn: (status: string) => tasksApi.update(taskId, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to update task status.');
    }
  });

  // Comment mutation
  const postComment = useMutation({
    mutationFn: (content: string) => tasksApi.addComment(taskId, content),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
      setCommentContent('');
    },
  });

  // Time log mutation
  const logTime = useMutation({
    mutationFn: (data: { hours: number; date: string; note?: string }) => tasksApi.logTime(taskId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['task-details', taskId] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] }); // invalidate list for progress bars
      setHours('');
      setLogNote('');
    },
  });

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentContent.trim()) return;
    postComment.mutate(commentContent);
  };

  const handleTimeLogSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const hrs = parseFloat(hours);
    if (isNaN(hrs) || hrs <= 0 || !logDate) return;
    logTime.mutate({ hours: hrs, date: logDate, note: logNote });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 999,
        }}
        onClick={onClose}
      />

      {/* Slide-out Sidebar Panel */}
      <div
        className="glass-card"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '450px',
          maxWidth: '90vw',
          height: '100vh',
          background: 'rgba(15, 23, 42, 0.85)',
          borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '-10px 0 30px rgba(0,0,0,0.5)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideIn 0.3s ease-out',
        }}
      >
        <style dangerouslySetInnerHTML={{ __html: `
          @keyframes slideIn {
            from { transform: translateX(100%); }
            to { transform: translateX(0); }
          }
        `}} />

        {/* Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 600, margin: 0 }}>Task Details</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>ID: {taskId}</span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '18px',
              padding: '4px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {isLoading ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-secondary)' }}>
              <span className="spinner" style={{ marginBottom: '10px' }} />
              Loading details...
            </div>
          ) : error || !task ? (
            <div style={{ color: '#ef4444', textAlign: 'center', padding: '20px' }}>
              Error loading task details.
            </div>
          ) : (
            <div>
              {/* Task Title & Details */}
              <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, marginBottom: '8px' }}>{task.title}</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', marginBottom: '20px', whiteSpace: 'pre-line' }}>
                {task.description || 'No description provided.'}
              </p>

              <div style={{ marginBottom: '20px', padding: '14px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.14)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Move Task</span>
                  {updateStatus.isPending && <span style={{ fontSize: '11px', color: '#818cf8' }}>Updating...</span>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '6px' }}>
                  {STATUS_OPTIONS.map(status => {
                    const active = task.status === status.value;
                    // Only reviewer/creator/admin can set "done"
                    const isAssigneeOnly = user && user.id === task.assigneeId && user.id !== task.reviewerId && user.id !== task.creatorId && !['super_admin', 'admin'].includes(user.role);
                    const blockedForAssignee = status.value === 'done' && isAssigneeOnly;
                    return (
                      <button
                        key={status.value}
                        type="button"
                        onClick={() => {
                          if (blockedForAssignee) {
                            alert(`You can't mark this as Done directly. Move it to "In Review" first, and ${task.reviewerName || 'your reviewer'} will verify and approve it.`);
                            return;
                          }
                          updateStatus.mutate(status.value);
                        }}
                        disabled={active || updateStatus.isPending}
                        title={blockedForAssignee ? `Only ${task.reviewerName || 'the reviewer'} can mark this as Done` : `Move to ${status.label}`}
                        style={{
                          minHeight: '34px',
                          borderRadius: '8px',
                          border: `1px solid ${active ? status.color : blockedForAssignee ? 'rgba(100,116,139,0.2)' : 'rgba(255,255,255,0.08)'}`,
                          background: active ? `${status.color}24` : blockedForAssignee ? 'rgba(100,116,139,0.05)' : 'rgba(15,23,42,0.65)',
                          color: active ? status.color : blockedForAssignee ? '#334155' : 'var(--text-secondary)',
                          cursor: active || updateStatus.isPending ? 'default' : blockedForAssignee ? 'not-allowed' : 'pointer',
                          fontSize: '10px',
                          fontWeight: 700,
                          lineHeight: 1.15,
                          padding: '6px 4px',
                          transition: 'all 0.2s',
                          opacity: blockedForAssignee ? 0.4 : 1,
                        }}
                      >
                        {status.label}
                      </button>
                    );
                  })}
                </div>
                {/* Helper note for assignees */}
                {user && user.id === task.assigneeId && user.id !== task.reviewerId && user.id !== task.creatorId && (
                  <p style={{ fontSize: '10px', color: '#475569', marginTop: '8px', lineHeight: 1.4 }}>
                    💡 Move to <strong style={{ color: '#f59e0b' }}>In Review</strong> when done.{task.reviewerName ? ` ${task.reviewerName}` : ' Your reviewer'} will verify and mark it Done.
                  </p>
                )}
              </div>

              {/* Review Verification Action Box — shown to the designated reviewer */}
              {task.status === 'review' && user && (user.id === task.reviewerId || user.id === task.creatorId || ['super_admin', 'admin'].includes(user.role)) && (
                <div style={{ marginBottom: '20px', padding: '16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '16px' }}>🔍</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#10b981' }}>Task Awaiting Your Review</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                    <strong style={{ color: '#e2e8f0' }}>{task.assigneeName}</strong> completed this task and is waiting for your review and approval.
                  </p>
                  <button
                    type="button"
                    className="btn-primary"
                    style={{ background: '#10b981', color: '#fff', padding: '10px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', cursor: 'pointer', border: 'none', width: '100%', marginTop: '4px' }}
                    onClick={() => updateStatus.mutate('done')}
                    disabled={updateStatus.isPending}
                  >
                    {updateStatus.isPending ? 'Confirming...' : '✓ Verify & Approve (Mark Done)'}
                  </button>
                </div>
              )}

              {/* Reviewer pending banner — shown to the assignee when task is in review */}
              {task.status === 'review' && user && user.id === task.assigneeId && user.id !== task.reviewerId && (
                <div style={{ marginBottom: '20px', padding: '14px', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '14px' }}>⏳</span>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#f59e0b' }}>Awaiting Reviewer Approval</span>
                  </div>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>
                    {task.reviewerName || 'Your reviewer'} has been notified and will verify your work. You'll be notified when it's approved.
                  </p>
                </div>
              )}

              {/* Grid Metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '25px', padding: '15px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Status</span>
                  <span className="role-badge" style={{ marginTop: '4px', display: 'inline-block', background: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' }}>
                    {task.status.replace('_', ' ').toUpperCase()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Priority</span>
                  <span className="role-badge" style={{ marginTop: '4px', display: 'inline-block', background: task.priority === 'critical' ? '#ef444420' : '#f9731620', color: task.priority === 'critical' ? '#ef4444' : '#f97316' }}>
                    {task.priority.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Assignee</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>{task.assigneeName}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Due Date</span>
                  <span style={{ color: '#fff', fontSize: '13px' }}>{task.dueDate}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Assigner / Creator</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>{task.creatorName || 'System'}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase' }}>Designated Reviewer</span>
                  <span style={{ color: '#fff', fontSize: '13px', fontWeight: 500 }}>{task.reviewerName || task.creatorName || 'System'}</span>
                </div>
              </div>

              {/* Progress Tracker */}
              <div style={{ marginBottom: '25px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  <span>Logged Hours</span>
                  <span>{task.loggedHours}h / {task.estimatedHours}h ({Math.min(100, Math.round((task.loggedHours / task.estimatedHours) * 100)) || 0}%)</span>
                </div>
                <div style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', width: `${Math.min(100, (task.loggedHours / task.estimatedHours) * 100)}%` }} />
                </div>
              </div>

              {/* Tab Selector */}
              <div className="filter-tabs" style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '20px' }}>
                <button
                  className={`filter-tab ${activeTab === 'comments' ? 'filter-tab-active' : ''}`}
                  style={{ flex: 1, textAlign: 'center', background: 'none' }}
                  onClick={() => setActiveTab('comments')}
                >
                  Comments ({task.comments?.length || 0})
                </button>
                <button
                  className={`filter-tab ${activeTab === 'timelogs' ? 'filter-tab-active' : ''}`}
                  style={{ flex: 1, textAlign: 'center', background: 'none' }}
                  onClick={() => setActiveTab('timelogs')}
                >
                  Time Logs ({task.timeLogs?.length || 0})
                </button>
              </div>

              {/* Tab Panel Comments */}
              {activeTab === 'comments' && (
                <div>
                  {/* Comments Feed */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                    {task.comments?.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '10px' }}>No comments yet.</p>
                    ) : (
                      task.comments.map((c: any) => (
                        <div key={c.id} style={{ display: 'flex', gap: '10px', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div className="table-avatar" style={{ width: '28px', height: '28px', fontSize: '13px', flexShrink: 0 }}>{c.userAvatar}</div>
                          <div>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', marginBottom: '3px' }}>
                              <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{c.userName}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{new Date(c.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.4', margin: 0 }}>{c.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Comment Form */}
                  <form onSubmit={handleCommentSubmit} style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      className="form-input"
                      style={{ fontSize: '13px' }}
                      placeholder="Write a comment..."
                      value={commentContent}
                      onChange={e => setCommentContent(e.target.value)}
                    />
                    <button type="submit" className="btn-primary" style={{ padding: '8px 16px', fontSize: '13px', width: 'auto' }} disabled={postComment.isPending}>
                      Send
                    </button>
                  </form>
                </div>
              )}

              {/* Tab Panel Time Logs */}
              {activeTab === 'timelogs' && (
                <div>
                  {/* Time logs list */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                    {task.timeLogs?.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '10px' }}>No logged hours yet.</p>
                    ) : (
                      task.timeLogs.map((l: any) => (
                        <div key={l.id} style={{ display: 'flex', justifySelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', padding: '10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                          <div>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '2px' }}>
                              <span style={{ color: '#fff', fontSize: '13px', fontWeight: 600 }}>{l.userName}</span>
                              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>• {l.date}</span>
                            </div>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>{l.note || 'No description'}</p>
                          </div>
                          <span style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', padding: '3px 8px', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>
                            +{l.hours}h
                          </span>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Log time form */}
                  <form onSubmit={handleTimeLogSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '12px' }}>Hours worked *</label>
                        <input
                          type="number"
                          step="0.5"
                          className="form-input"
                          style={{ fontSize: '13px', padding: '6px 10px' }}
                          placeholder="e.g. 3.5"
                          value={hours}
                          onChange={e => setHours(e.target.value)}
                          required
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: '12px' }}>Date *</label>
                        <input
                          type="date"
                          className="form-input"
                          style={{ fontSize: '13px', padding: '6px 10px' }}
                          value={logDate}
                          onChange={e => setLogDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="form-label" style={{ fontSize: '12px' }}>Work Notes</label>
                      <input
                        type="text"
                        className="form-input"
                        style={{ fontSize: '13px', padding: '6px 10px' }}
                        placeholder="What did you work on?"
                        value={logNote}
                        onChange={e => setLogNote(e.target.value)}
                      />
                    </div>
                    <button type="submit" className="btn-primary" style={{ padding: '8px', fontSize: '13px' }} disabled={logTime.isPending}>
                      {logTime.isPending ? 'Logging...' : 'Log Hours'}
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
