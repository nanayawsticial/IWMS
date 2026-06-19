'use client';

import React, { useRef, useState, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { tasksApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import GanttChart from '@/components/GanttChart';
import TaskDetailPanel from '@/components/TaskDetailPanel';

type Status = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
type Priority = 'critical' | 'high' | 'medium' | 'low';

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: 'backlog',     label: 'Backlog',     color: '#475569' },
  { id: 'todo',        label: 'To Do',       color: '#64748b' },
  { id: 'in_progress', label: 'In Progress', color: '#6366f1' },
  { id: 'review',      label: 'In Review',   color: '#f59e0b' },
  { id: 'done',        label: 'Done',        color: '#10b981' },
];

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; label: string }> = {
  critical: { color: '#ef4444', bg: '#ef444415', label: 'Critical' },
  high:     { color: '#f97316', bg: '#f9731615', label: 'High' },
  medium:   { color: '#f59e0b', bg: '#f59e0b15', label: 'Medium' },
  low:      { color: '#10b981', bg: '#10b98115', label: 'Low' },
};

// ── Avatar stack helper ───────────────────────────────────────────────
function AvatarStack({ items }: { items: { label: string; color: string; bg: string; title?: string }[] }) {
  return (
    <div className="avatar-stack" style={{ paddingRight: 6 }}>
      {items.map((item, idx) => (
        <div
          key={idx}
          className="avatar-stack-item"
          style={{ background: item.bg, color: item.color, zIndex: items.length - idx }}
          title={item.title || item.label}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

// ── Redesigned Task Card Content ──────────────────────────────────────
function TaskCardContent({ task, currentUserId }: { task: any; currentUserId?: string }) {
  const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86400000);
  const isOverdue = daysLeft < 0;
  const progress = task.estimatedHours > 0
    ? Math.min(100, Math.round((task.loggedHours / task.estimatedHours) * 100))
    : 0;
  const needsMyReview = currentUserId && task.status === 'review' && task.reviewerId === currentUserId && task.assigneeId !== currentUserId;
  const priority = task.priority as Priority;
  const pConf = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;

  // Build avatar stack: assignee first, then reviewer if different
  const avatarItems: { label: string; color: string; bg: string; title?: string }[] = [];
  if (task.assigneeAvatar) {
    const initials = typeof task.assigneeAvatar === 'string' && task.assigneeAvatar.length <= 2
      ? task.assigneeAvatar
      : (task.assigneeName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?');
    avatarItems.push({ label: initials, color: '#818cf8', bg: 'rgba(99,102,241,0.18)', title: task.assigneeName });
  }
  if (task.reviewerName && task.reviewerName !== task.assigneeName) {
    const rInitials = task.reviewerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?';
    avatarItems.push({ label: rInitials, color: '#34d399', bg: 'rgba(16,185,129,0.18)', title: `Reviewer: ${task.reviewerName}` });
  }

  const dueLabel = isOverdue
    ? `${Math.abs(daysLeft)}d overdue`
    : daysLeft === 0 ? 'Due today'
    : `${daysLeft}d left`;

  return (
    <>
      {needsMyReview && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: '6px', padding: '4px 8px', marginBottom: '8px', fontSize: '10px', fontWeight: 700, color: '#10b981' }}>
          <span>🔍</span> Needs Your Review
        </div>
      )}

      {/* Top badge row: project outline badge + priority dot badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <span className="kanban-card-project-badge">
          {task.projectName || 'General'}
        </span>
        <span
          className="kanban-card-priority-badge"
          style={{ color: pConf.color, background: pConf.bg }}
        >
          <span className="kanban-priority-dot" />
          {pConf.label}
        </span>
      </div>

      {/* Task ID + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <h4 className="task-card-title">{task.title}</h4>
      </div>

      {/* Description (optional, limited) */}
      {task.description && (
        <p className="task-card-desc" style={{ marginBottom: 0, WebkitLineClamp: 2, display: '-webkit-box', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags?.length > 0 && (
        <div className="task-tags">
          {task.tags.map((tag: string) => <span key={tag} className="tag-chip">#{tag}</span>)}
        </div>
      )}

      {/* Metadata strip: Est. Hours | Progress | Due */}
      <div className="kanban-card-meta-strip">
        <div className="kanban-meta-col">
          <span className="kanban-meta-label">Est. Hrs</span>
          <span className="kanban-meta-value">{task.estimatedHours || '—'}</span>
        </div>
        <div className="kanban-meta-col">
          <span className="kanban-meta-label">Progress</span>
          <span className="kanban-meta-value">{task.loggedHours || 0}/{task.estimatedHours || 0}h</span>
        </div>
        <div className="kanban-meta-col">
          <span className="kanban-meta-label">Due</span>
          <span className="kanban-meta-value" style={{ color: isOverdue ? '#ef4444' : daysLeft <= 2 ? '#f59e0b' : '#fff' }}>
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="task-progress-row" style={{ marginTop: 0 }}>
        <span className="task-progress-label">{progress}%</span>
        <div className="task-progress-bar">
          <div
            className="task-progress-fill"
            style={{ width: `${progress}%`, background: isOverdue ? '#ef4444' : '#6366f1' }}
          />
        </div>
      </div>

      {/* Footer row: stacked avatars + counters */}
      <div className="kanban-card-footer-row">
        <AvatarStack items={avatarItems} />
        <div className="kanban-card-counters">
          <span className={`kanban-counter-pair ${isOverdue ? '' : ''}`} title="Days remaining">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
            </svg>
            <span style={{ color: isOverdue ? '#ef4444' : daysLeft <= 2 ? '#f59e0b' : undefined, fontWeight: isOverdue ? 700 : undefined }}>
              {dueLabel}
            </span>
          </span>
          {/* Comment count */}
          <span className="kanban-counter-pair" title="Comments">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
            {task.commentCount ?? 0}
          </span>
          {/* Time logs count */}
          <span className="kanban-counter-pair" title="Time Logs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
            </svg>
            {task.timeLogCount ?? 0}
          </span>
        </div>
      </div>
    </>
  );
}

function TaskCard({
  task,
  isDragging,
  onPointerDown,
  onMouseDown,
  onClick,
  currentUserId,
}: {
  task: any;
  isDragging: boolean;
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>, task: any) => void;
  onMouseDown: (event: React.MouseEvent<HTMLDivElement>, task: any) => void;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  currentUserId?: string;
}) {
  return (
    <div
      className={`task-card ${isDragging ? 'task-card-dragging' : ''}`}
      onPointerDown={(event) => onPointerDown(event, task)}
      onMouseDown={(event) => onMouseDown(event, task)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      title="Drag to move, click to open details"
    >
      <TaskCardContent task={task} currentUserId={currentUserId} />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="page-content" style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
        <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />
        Loading...
      </div>
    }>
      <TasksPageContent />
    </Suspense>
  );
}

function TasksPageContent() {
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const assigneeId = searchParams.get('assignee') || undefined;

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragSessionRef = useRef<{
    task: any;
    startX: number;
    startY: number;
    width: number;
    isDragging: boolean;
  } | null>(null);
  const suppressNextClickRef = useRef(false);
  const pointerDragStartedRef = useRef(false);
  const [filter, setFilter] = useState<Priority | 'all'>('all');
  const [searchQ, setSearchQ] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'gantt'>('kanban');
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [activeDropStatus, setActiveDropStatus] = useState<Status | null>(null);
  const [dragPreview, setDragPreview] = useState<{ task: any; x: number; y: number; width: number } | null>(null);
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as Priority, dueDate: '', tags: '', assigneeId: '', reviewerId: '' });

  const [otherDragging, setOtherDragging] = useState<{ userName: string; taskTitle: string } | null>(null);
  const { emit } = useSocket();

  // Invalidate task lists on update from other tabs
  useSocketEvent<any>('task:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  });

  // Track if someone else is currently dragging a card
  useSocketEvent<any>('task:dragged', (data) => {
    if (data.isDragging) {
      setOtherDragging({ userName: data.userName, taskTitle: data.taskTitle });
    } else {
      setOtherDragging(null);
    }
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['tasks', assigneeId],
    queryFn: () => tasksApi.list(assigneeId ? { assigneeId } : undefined),
  });

  const isManagement = user && ['super_admin', 'admin', 'hr_manager', 'manager', 'team_lead'].includes(user.role);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: !!isManagement,
  });

  const dropdownUsers = React.useMemo(() => {
    if (!user) return [];
    const isManager = ['manager', 'team_lead'].includes(user.role);
    const isAdmin = ['super_admin', 'admin', 'hr_manager'].includes(user.role);
    if (isAdmin) return users;
    if (isManager) {
      return users.filter((u: any) => u.departmentId === user.departmentId);
    }
    return [];
  }, [users, user]);

  const selectedAssigneeUser = users.find((u: any) => u.id === assigneeId);

  const handleAssigneeChange = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (id) {
      params.set('assignee', id);
    } else {
      params.delete('assignee');
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const updateTask = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      tasksApi.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tasks'] }),
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to update task.');
    }
  });

  const createTask = useMutation({
    mutationFn: (data: Record<string, unknown>) => tasksApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowModal(false);
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', tags: '', assigneeId: '', reviewerId: '' });
    },
  });

  const handleAddTask = () => {
    if (!newTask.title) return;
    createTask.mutate({
      title: newTask.title,
      description: newTask.description,
      assigneeId: newTask.assigneeId || user?.id,
      reviewerId: newTask.reviewerId || user?.id,
      priority: newTask.priority,
      dueDate: newTask.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
      tags: newTask.tags.split(',').map(t => t.trim()).filter(Boolean),
      projectId: 'general',
      projectName: 'General',
      estimatedHours: 8,
    });
  };

  const filtered = tasks.filter((t: any) => {
    const matchesPriority = filter === 'all' || t.priority === filter;
    const matchesSearch = t.title.toLowerCase().includes(searchQ.toLowerCase()) ||
      t.assigneeName?.toLowerCase().includes(searchQ.toLowerCase());
    return matchesPriority && matchesSearch;
  });

  // Stats for the kanban stats bar
  const totalCount = filtered.length;
  const pendingCount = filtered.filter((t: any) => t.status !== 'done').length;
  const completedCount = filtered.filter((t: any) => t.status === 'done').length;

  const getDropStatusFromPoint = (x: number, y: number): Status | null => {
    const element = document.elementFromPoint(x, y);
    const column = element?.closest<HTMLElement>('.kanban-column');
    const status = column?.dataset.status as Status | undefined;
    return status && COLUMNS.some(col => col.id === status) ? status : null;
  };

  const moveTaskToStatus = (task: any, targetStatus: Status | null) => {
    if (targetStatus && task.status !== targetStatus) {
      updateTask.mutate({ id: task.id, data: { status: targetStatus } });
    }
    emit('task:dragEnd', { taskId: task.id });
  };

  const clearPointerDrag = () => {
    document.body.classList.remove('task-drag-active');
    dragSessionRef.current = null;
    setDraggingId(null);
    setActiveDropStatus(null);
    setDragPreview(null);
  };

  const startDragSession = (task: any, x: number, y: number, width: number) => {
    dragSessionRef.current = {
      task,
      startX: x,
      startY: y,
      width,
      isDragging: false,
    };
  };

  const updateDragSession = (x: number, y: number) => {
    const session = dragSessionRef.current;
    if (!session) return false;

    const distance = Math.hypot(x - session.startX, y - session.startY);
    if (!session.isDragging && distance < 8) return false;

    if (!session.isDragging) {
      session.isDragging = true;
      suppressNextClickRef.current = true;
      document.body.classList.add('task-drag-active');
      setDraggingId(session.task.id);
      emit('task:dragStart', { taskId: session.task.id, taskTitle: session.task.title });
    }

    setDragPreview({
      task: session.task,
      x,
      y,
      width: session.width,
    });
    setActiveDropStatus(getDropStatusFromPoint(x, y));
    return true;
  };

  const finishDragSession = (x: number, y: number) => {
    const session = dragSessionRef.current;
    if (!session) return;

    if (session.isDragging) {
      moveTaskToStatus(session.task, getDropStatusFromPoint(x, y));
      window.setTimeout(() => {
        suppressNextClickRef.current = false;
      }, 100);
    }

    clearPointerDrag();
  };

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>, task: any) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    const rect = event.currentTarget.getBoundingClientRect();
    pointerDragStartedRef.current = true;
    startDragSession(task, event.clientX, event.clientY, rect.width);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (updateDragSession(moveEvent.clientX, moveEvent.clientY)) {
        moveEvent.preventDefault();
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.setTimeout(() => {
        pointerDragStartedRef.current = false;
      }, 80);
      finishDragSession(upEvent.clientX, upEvent.clientY);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
  };

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>, task: any) => {
    if (event.button !== 0 || pointerDragStartedRef.current || dragSessionRef.current) return;

    const rect = event.currentTarget.getBoundingClientRect();
    startDragSession(task, event.clientX, event.clientY, rect.width);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (updateDragSession(moveEvent.clientX, moveEvent.clientY)) {
        moveEvent.preventDefault();
      }
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      finishDragSession(upEvent.clientX, upEvent.clientY);
    };

    window.addEventListener('mousemove', handleMouseMove, { passive: false });
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleTaskClick = (event: React.MouseEvent<HTMLDivElement>, taskId: string) => {
    if (suppressNextClickRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    setActiveTaskId(taskId);
  };

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h1 className="page-title">Task Management</h1>
          <p className="page-subtitle">Manage tasks via board or visual timeline</p>
        </div>
        <div className="page-actions">
          {isManagement && dropdownUsers.length > 0 && (
            <select
              value={assigneeId || ''}
              onChange={e => handleAssigneeChange(e.target.value)}
              className="form-input form-select"
              style={{ width: '180px', padding: '6px 12px', fontSize: '13px' }}
            >
              <option value="">All Assignees</option>
              {dropdownUsers.map((u: any) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.position})
                </option>
              ))}
            </select>
          )}
          <div className="search-box">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input type="text" placeholder="Search tasks..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="search-input" />
          </div>
          <div className="view-toggle">
            <button className={`view-btn ${viewMode === 'kanban' ? 'view-btn-active' : ''}`} onClick={() => setViewMode('kanban')}>
              Board
            </button>
            <button className={`view-btn ${viewMode === 'gantt' ? 'view-btn-active' : ''}`} onClick={() => setViewMode('gantt')}>
              Gantt
            </button>
          </div>
          <div className="filter-tabs">
            {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
              <button key={p} className={`filter-tab ${filter === p ? 'filter-tab-active' : ''}`} onClick={() => setFilter(p)}>
                {p === 'all' ? 'All' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-primary-sm" onClick={() => setShowModal(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            New Task
          </button>
        </div>
      </div>

      {otherDragging && (
        <div className="dragging-presence-alert animate-pulse" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '10px',
          padding: '10px 16px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#818cf8',
          fontWeight: 500,
        }}>
          <span style={{ width: '8px', height: '8px', background: '#10b981', borderRadius: '50%', display: 'inline-block' }} />
          <span>{otherDragging.userName} is moving task &quot;{otherDragging.taskTitle}&quot;...</span>
        </div>
      )}

      {selectedAssigneeUser && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'rgba(99, 102, 241, 0.12)',
          border: '1px solid rgba(99, 102, 241, 0.2)',
          borderRadius: '10px',
          padding: '10px 16px',
          marginBottom: '20px',
          fontSize: '13px',
          color: '#fff',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '16px' }}>👤</span>
            <span>
              Viewing tasks for <strong>{selectedAssigneeUser.name}</strong> ({selectedAssigneeUser.position})
            </span>
          </div>
          <button
            onClick={() => handleAssigneeChange('')}
            style={{
              background: 'none',
              border: 'none',
              color: '#818cf8',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 'bold',
              padding: '2px 6px',
              borderRadius: '4px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Clear assignee filter"
          >
            ✕
          </button>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#475569' }}>
          <span className="spinner" style={{ margin: '0 auto 12px', display: 'block' }} />
          Loading tasks...
        </div>
      ) : viewMode === 'gantt' ? (
        <GanttChart tasks={filtered} onTaskClick={(id) => setActiveTaskId(id)} />
      ) : (
        <>
          {/* Kanban Stats Bar */}
          <div className="kanban-stats-bar">
            <div className="kanban-stat-item">
              <span className="kanban-stat-label">Total Tasks</span>
              <span className="kanban-stat-value">{totalCount}</span>
            </div>
            <div className="kanban-stat-item">
              <span className="kanban-stat-label">Pending</span>
              <span className="kanban-stat-value" style={{ color: '#f59e0b' }}>{pendingCount}</span>
            </div>
            <div className="kanban-stat-item">
              <span className="kanban-stat-label">Completed</span>
              <span className="kanban-stat-value" style={{ color: '#10b981' }}>{completedCount}</span>
            </div>
          </div>

          <div className="kanban-board">
            {COLUMNS.map(col => {
              const colTasks = filtered.filter((t: any) => t.status === col.id);
              return (
                <div
                  key={col.id}
                  data-status={col.id}
                  className={`kanban-column ${activeDropStatus === col.id ? 'kanban-column-drop-active' : ''}`}
                >
                  {/* Redesigned column header: ring indicator + name + count + menu */}
                  <div className="kanban-col-header">
                    <div className="kanban-col-title">
                      <span className="kanban-col-ring" style={{ color: col.color }} />
                      {col.label}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="kanban-col-count" style={{ background: `${col.color}20`, color: col.color }}>
                        {colTasks.length}
                      </span>
                      <button className="kanban-col-menu-btn" title="Column options">⋯</button>
                    </div>
                  </div>

                  <div className="kanban-cards">
                    {colTasks.map((task: any) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        isDragging={draggingId === task.id}
                        onPointerDown={handlePointerDown}
                        onMouseDown={handleMouseDown}
                        onClick={(event) => handleTaskClick(event, task.id)}
                        currentUserId={user?.id}
                      />
                    ))}
                    {colTasks.length === 0 && (
                      <div className="kanban-empty">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
                          <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                        </svg>
                        <p>Drop tasks here</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {dragPreview && (
        <div
          className="task-card task-drag-preview"
          style={{
            left: dragPreview.x + 14,
            top: dragPreview.y + 14,
            width: dragPreview.width,
          }}
        >
          <TaskCardContent task={dragPreview.task} currentUserId={user?.id} />
        </div>
      )}

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Task</h3>
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Title *</label>
                <input className="form-input" value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title..." />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-input form-textarea" value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Task description..." rows={3} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Priority</label>
                  <select className="form-input form-select" value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as Priority }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Due Date</label>
                  <input className="form-input" type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} />
                </div>
              </div>
              {hasPermission('assign_tasks') && users.length > 0 ? (
                <>
                  <div className="form-group">
                    <label className="form-label">Assignee</label>
                    <select className="form-input form-select" value={newTask.assigneeId} onChange={e => setNewTask(p => ({ ...p, assigneeId: e.target.value }))}>
                      <option value="">— Self —</option>
                      {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.position})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Designated Reviewer</label>
                    <select className="form-input form-select" value={newTask.reviewerId} onChange={e => setNewTask(p => ({ ...p, reviewerId: e.target.value }))}>
                      <option value="">— Assigner (Self) —</option>
                      {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.position})</option>)}
                    </select>
                  </div>
                </>
              ) : !hasPermission('assign_tasks') ? (
                <div style={{ padding: '10px', background: 'rgba(99,102,241,0.06)', borderRadius: '8px', border: '1px solid rgba(99,102,241,0.15)', fontSize: '12px', color: '#818cf8' }}>
                  📌 This task will be assigned to you. Only supervisors and managers can assign tasks to others.
                </div>
              ) : null}
              <div className="form-group">
                <label className="form-label">Tags (comma separated)</label>
                <input className="form-input" value={newTask.tags} onChange={e => setNewTask(p => ({ ...p, tags: e.target.value }))} placeholder="frontend, design, urgent..." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn-primary-sm" onClick={handleAddTask} disabled={createTask.isPending}>
                {createTask.isPending ? <span className="spinner sm-spinner" /> : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTaskId && (
        <TaskDetailPanel taskId={activeTaskId} onClose={() => setActiveTaskId(null)} />
      )}
    </div>
  );
}
