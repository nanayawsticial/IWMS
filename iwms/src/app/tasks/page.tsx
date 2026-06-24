'use client';

import React, { useState, Suspense, useMemo, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { tasksApi, usersApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket, useSocketEvent } from '@/hooks/useSocket';
import GanttChart from '@/components/GanttChart';
import TaskDetailPanel from '@/components/TaskDetailPanel';
import {
  MoreVertical,
  Plus,
  Trash,
  Clock,
  MessageSquare,
  Search,
  CheckCircle,
  FolderKanban,
  Edit,
  ArrowRight,
  Filter,
  X
} from 'lucide-react';

type Status = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
type Priority = 'critical' | 'high' | 'medium' | 'low';

const COLUMNS: { id: Status; label: string; color: string }[] = [
  { id: 'backlog',     label: 'Backlog',     color: 'var(--text-3)' },
  { id: 'todo',        label: 'To Do',       color: 'var(--text-2)' },
  { id: 'in_progress', label: 'In Progress', color: 'var(--blue)' },
  { id: 'review',      label: 'In Review',   color: 'var(--yellow)' },
  { id: 'done',        label: 'Done',        color: 'var(--green)' },
];

const PRIORITY_CONFIG: Record<Priority, { color: string; bg: string; label: string }> = {
  critical: { color: 'var(--red)', bg: 'var(--red-soft)', label: 'Critical' },
  high:     { color: 'var(--accent)', bg: 'var(--accent-soft)', label: 'High' },
  medium:   { color: 'var(--yellow)', bg: 'var(--yellow-soft)', label: 'Medium' },
  low:      { color: 'var(--green)', bg: 'var(--green-soft)', label: 'Low' },
};

function AvatarStack({ items }: { items: { label: string; color: string; bg: string; title?: string }[] }) {
  return (
    <div className="avatar-stack flex -space-x-1.5 overflow-hidden">
      {items.map((item, idx) => (
        <div
          key={idx}
          className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border border-[var(--bg-surface)] flex-shrink-0"
          style={{ background: item.bg, color: item.color, zIndex: items.length - idx }}
          title={item.title || item.label}
        >
          {item.label}
        </div>
      ))}
    </div>
  );
}

function TaskCardContent({
  task,
  currentUserId,
  onActionClick,
  isMenuOpen
}: {
  task: any;
  currentUserId?: string;
  onActionClick: (e: React.MouseEvent) => void;
  isMenuOpen: boolean;
}) {
  const daysLeft = Math.ceil((new Date(task.dueDate).getTime() - Date.now()) / 86400000);
  const isOverdue = daysLeft < 0;
  
  // Progress computation
  const progress = task.estimatedHours > 0
    ? Math.min(100, Math.round((task.loggedHours / task.estimatedHours) * 100))
    : 0;

  // Dynamic progress color based on time usage
  let progressColor = 'var(--green)';
  if (progress >= 80 && progress <= 100) progressColor = 'var(--yellow)';
  else if (progress > 100) progressColor = 'var(--red)';

  const needsMyReview = currentUserId && task.status === 'review' && task.reviewerId === currentUserId && task.assigneeId !== currentUserId;
  const priority = task.priority as Priority;
  const pConf = PRIORITY_CONFIG[priority] ?? PRIORITY_CONFIG.medium;

  const avatarItems: { label: string; color: string; bg: string; title?: string }[] = [];
  if (task.assigneeAvatar) {
    const initials = typeof task.assigneeAvatar === 'string' && task.assigneeAvatar.length <= 2
      ? task.assigneeAvatar
      : (task.assigneeName?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?');
    avatarItems.push({ label: initials, color: 'var(--blue)', bg: 'var(--blue-soft)', title: task.assigneeName });
  }
  if (task.reviewerName && task.reviewerName !== task.assigneeName) {
    const rInitials = task.reviewerName.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || '?';
    avatarItems.push({ label: rInitials, color: 'var(--green)', bg: 'var(--green-soft)', title: `Reviewer: ${task.reviewerName}` });
  }

  const dueLabel = isOverdue
    ? `${Math.abs(daysLeft)}d overdue`
    : daysLeft === 0 ? 'Due today'
    : `${daysLeft}d left`;

  return (
    <div className="relative">
      {needsMyReview && (
        <div className="flex items-center gap-1 bg-emerald-500/10 border border-emerald-500/30 rounded px-2 py-1 mb-2 text-[9px] font-bold text-[var(--green)]">
          <CheckCircle size={10} /> Needs Your Review
        </div>
      )}

      {/* Top row with project, priority, and three-dot trigger */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs font-semibold text-[var(--text-3)] truncate max-w-[100px] border border-[var(--border)] rounded px-1.5 py-0.5 bg-[var(--bg-surface-2)]">
          {task.projectName || 'General'}
        </span>
        <div className="flex items-center gap-1">
          <span
            className="inline-flex items-center gap-1 text-xs font-bold rounded-full px-2 py-0.5"
            style={{ color: pConf.color, backgroundColor: pConf.bg }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pConf.color }} />
            {pConf.label}
          </span>
          
          {/* Actions trigger */}
          <button
            onClick={onActionClick}
            className={`w-6 h-6 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-3)] hover:text-[var(--text-1)] flex items-center justify-center transition-colors cursor-pointer ${isMenuOpen ? 'bg-[var(--bg-hover)]' : ''}`}
          >
            <MoreVertical size={13} />
          </button>
        </div>
      </div>

      {/* Title */}
      <h4 className="text-sm font-semibold text-[var(--text-1)] line-clamp-1 mb-1">{task.title}</h4>

      {/* Description */}
      {task.description && (
        <p className="text-xs text-[var(--text-3)] line-clamp-2 leading-relaxed mb-3">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {task.tags.map((tag: string) => (
            <span key={tag} className="text-[10px] font-bold bg-[var(--bg-surface-2)] border border-[var(--border)] rounded px-1.5 py-0.5 text-[var(--text-2)]">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Metadata metrics */}
      <div className="grid grid-cols-3 gap-2 py-2 border-y border-[var(--border)] mb-2 bg-[var(--bg-surface-2)]/30 rounded-lg px-2 text-xs">
        <div>
          <span className="block text-[10px] text-[var(--text-3)] uppercase tracking-wider">Est. Hours</span>
          <span className="block font-bold text-[var(--text-1)] mt-0.5 font-mono">{task.estimatedHours || '—'}</span>
        </div>
        <div>
          <span className="block text-[10px] text-[var(--text-3)] uppercase tracking-wider">Logged</span>
          <span className="block font-bold text-[var(--text-1)] mt-0.5 font-mono">{task.loggedHours || 0}h</span>
        </div>
        <div>
          <span className="block text-[10px] text-[var(--text-3)] uppercase tracking-wider">Due</span>
          <span className="block font-bold mt-0.5 font-mono" style={{ color: isOverdue ? 'var(--red)' : daysLeft <= 2 ? 'var(--yellow)' : 'var(--text-1)' }}>
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}
          </span>
        </div>
      </div>

      {/* Redesigned Progress Bar colored by time consumption */}
      <div className="space-y-1 mt-2.5">
        <div className="flex justify-between items-center text-xs text-[var(--text-3)] font-bold">
          <span>Time Util: {progress}%</span>
        </div>
        <div className="w-full h-1.5 bg-[var(--bg-surface-2)] rounded-full overflow-hidden border border-[var(--border)]">
          <div
            className="h-full transition-all duration-300"
            style={{ width: `${Math.min(100, progress)}%`, backgroundColor: progressColor }}
          />
        </div>
      </div>

      {/* Footer avatar & counters */}
      <div className="flex justify-between items-center pt-2.5 mt-2.5 border-t border-[var(--border)]">
        <AvatarStack items={avatarItems} />
        <div className="flex items-center gap-2 text-xs text-[var(--text-3)]">
          <span className="inline-flex items-center gap-1 font-semibold" style={{ color: isOverdue ? 'var(--red)' : daysLeft <= 2 ? 'var(--yellow)' : undefined }}>
            <Clock size={12} />
            {dueLabel}
          </span>
          <span className="inline-flex items-center gap-1 font-semibold">
            <MessageSquare size={10} />
            {task.commentCount ?? 0}
          </span>
        </div>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  isDragging,
  onClick,
  currentUserId,
  onActionClick,
  isMenuOpen
}: {
  task: any;
  isDragging: boolean;
  onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  currentUserId?: string;
  onActionClick: (e: React.MouseEvent) => void;
  isMenuOpen: boolean;
}) {
  return (
    <div
      className={`task-card ${isDragging ? 'task-card-dragging' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label={`Open task ${task.title}`}
      title="Drag to move, click to open details"
    >
      <TaskCardContent
        task={task}
        currentUserId={currentUserId}
        onActionClick={onActionClick}
        isMenuOpen={isMenuOpen}
      />
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={
      <div className="page-content flex items-center justify-center min-h-[60vh] text-[var(--text-3)]">
        <div className="text-center">
          <span className="spinner sm-spinner mb-2 block mx-auto" />
          Loading Tasks Module...
        </div>
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

  // Filters & Sorting States
  const [filter, setFilter] = useState<Priority | 'all'>('all');
  const [searchQ, setSearchQ] = useState('');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'title'>('dueDate');
  const [viewMode, setViewMode] = useState<'kanban' | 'gantt'>('kanban');

  const [showModal, setShowModal] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  
  // Actions Menu Dropdown State
  const [actionsMenuTaskId, setActionsMenuTaskId] = useState<string | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const [deletingTaskId, setDeletingTaskId] = useState<string | null>(null);

  // Forms
  const [newTask, setNewTask] = useState({ title: '', description: '', priority: 'medium' as Priority, dueDate: '', tags: '', assigneeId: '', reviewerId: '' });
  const [quickTaskInputs, setQuickTaskInputs] = useState<Record<string, string>>({});

  const [otherDragging, setOtherDragging] = useState<{ userName: string; taskTitle: string } | null>(null);
  const { emit } = useSocket();

  useSocketEvent<any>('task:updated', () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
  });

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

  const dropdownUsers = useMemo(() => {
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

  const deleteTask = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setActionsMenuTaskId(null);
    },
    onError: (err: any) => {
      alert(err.response?.data?.error || 'Failed to delete task.');
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

  // Upgraded filtering and sorting logic
  const filteredAndSortedTasks = useMemo(() => {
    let result = tasks.filter((t: any) => {
      const matchesPriority = filter === 'all' || t.priority === filter;
      const matchesSearch = t.title.toLowerCase().includes(searchQ.toLowerCase()) ||
        t.assigneeName?.toLowerCase().includes(searchQ.toLowerCase());
      return matchesPriority && matchesSearch;
    });

    return [...result].sort((a, b) => {
      if (sortBy === 'title') {
        return a.title.localeCompare(b.title);
      }
      if (sortBy === 'priority') {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aVal = priorityOrder[a.priority as Priority] || 2;
        const bVal = priorityOrder[b.priority as Priority] || 2;
        return bVal - aVal;
      }
      // Default: dueDate
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });
  }, [tasks, filter, searchQ, sortBy]);

  const totalCount = filteredAndSortedTasks.length;
  const pendingCount = filteredAndSortedTasks.filter((t: any) => t.status !== 'done').length;
  const completedCount = filteredAndSortedTasks.filter((t: any) => t.status === 'done').length;

  const moveTaskToStatus = (task: any, targetStatus: Status | null) => {
    if (targetStatus && task.status !== targetStatus) {
      updateTask.mutate({ id: task.id, data: { status: targetStatus } });
    }
    emit('task:dragEnd', { taskId: task.id });
  };

  // @hello-pangea/dnd onDragEnd handler
  const handleDragEnd = (result: DropResult) => {
    setDraggingId(null);
    if (!result.destination) return;
    const targetStatus = result.destination.droppableId as Status;
    const task = filteredAndSortedTasks.find((t: any) => t.id === result.draggableId);
    if (task) {
      emit('task:dragStart', { taskId: task.id, taskTitle: task.title });
      moveTaskToStatus(task, targetStatus);
    }
  };

  const handleTaskClick = (event: React.MouseEvent<HTMLDivElement>, taskId: string) => {
    const targetEl = event.target as HTMLElement;
    if (targetEl.closest('.kanban-card-actions-trigger') || targetEl.closest('button')) return;
    setActiveTaskId(taskId);
  };

  // Card options trigger handler
  const handleOpenActionMenu = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (actionsMenuTaskId === taskId) {
      setActionsMenuTaskId(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setActionsMenuPosition({ x: rect.left, y: rect.bottom + window.scrollY });
      setActionsMenuTaskId(taskId);
    }
  };

  // Close actions menu when click occurs anywhere else
  useEffect(() => {
    const handleOutsideClick = () => {
      setActionsMenuTaskId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold text-[var(--text-1)] flex items-center gap-2">
            <FolderKanban className="text-[var(--accent)]" size={24} />
            Board Workspaces
          </h1>
          <p className="page-subtitle text-sm text-[var(--text-3)] mt-1">
            Group, organize, and drag backlog tasks across phase statuses in real time.
          </p>
        </div>

        {/* Filters Toolbar */}
        <div className="flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-4 w-full xl:w-auto">
          {/* Row 1 for mobile: Assignee & Sort */}
          <div className={`${isManagement && dropdownUsers.length > 0 ? 'grid grid-cols-2' : 'flex'} gap-3 w-full md:w-auto`}>
            {isManagement && dropdownUsers.length > 0 && (
              <div className="control-compact w-full">
                <select
                  value={assigneeId || ''}
                  onChange={e => handleAssigneeChange(e.target.value)}
                >
                  <option value="">All Assignees</option>
                  {dropdownUsers.map((u: any) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.position})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="control-compact w-full md:w-48">
              <Filter size={14} className="text-[var(--text-3)] flex-shrink-0" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
              >
                <option value="dueDate">Sort by Due Date</option>
                <option value="priority">Sort by Priority</option>
                <option value="title">Sort by Title</option>
              </select>
            </div>
          </div>

          {/* Row 2 for mobile: Search & Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
            {/* Search Box */}
            <div className="control-compact w-full sm:w-48">
              <Search size={16} className="text-[var(--text-3)] flex-shrink-0" />
              <input
                type="text"
                placeholder="Search title, owner..."
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
              />
            </div>

            {/* View mode toggle, Priority filter pills, and Add Task */}
            <div className="flex flex-row items-center gap-4 w-full sm:w-auto">
              {/* View mode toggle */}
              <div className="tab-switcher">
                <button
                  onClick={() => setViewMode('kanban')}
                  className={viewMode === 'kanban' ? 'active' : ''}
                >
                  Board
                </button>
                <button
                  onClick={() => setViewMode('gantt')}
                  className={viewMode === 'gantt' ? 'active' : ''}
                >
                  Timeline
                </button>
              </div>

              {/* Priority filter pills */}
              <div className="tab-switcher overflow-x-auto max-w-full hide-scrollbar flex-1 sm:flex-initial">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map(p => (
                  <button
                    key={p}
                    onClick={() => setFilter(p)}
                    className={`capitalize ${filter === p ? 'active' : ''}`}
                  >
                    {p}
                  </button>
                ))}
              </div>

              {/* Create trigger */}
              <button
                onClick={() => setShowModal(true)}
                className="bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold h-[38px] px-3 sm:px-4 rounded-[10px] text-sm flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Add Task</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {otherDragging && (
        <div className="flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 mb-5 text-xs text-[var(--accent)] font-semibold animate-pulse">
          <span className="w-2 h-2 rounded-full bg-[var(--green)] block" />
          <span>{otherDragging.userName} is currently moving card &quot;{otherDragging.taskTitle}&quot;...</span>
        </div>
      )}

      {selectedAssigneeUser && (
        <div className="flex justify-between items-center bg-indigo-500/10 border border-indigo-500/30 rounded-xl p-3 mb-5 text-xs">
          <div className="flex items-center gap-2 text-[var(--text-1)]">
            <span>👤</span>
            <span>
              Viewing assigned workspace of <strong>{selectedAssigneeUser.name}</strong> ({selectedAssigneeUser.position})
            </span>
          </div>
          <button
            onClick={() => handleAssigneeChange('')}
            className="w-5 h-5 rounded-full hover:bg-[var(--bg-hover)] text-[var(--text-3)] hover:text-white flex items-center justify-center font-bold text-xs cursor-pointer"
            title="Clear filter"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="kanban-board">
            {['Backlog', 'Todo', 'In Progress', 'Done'].map((col, idx) => (
              <div key={idx} className="kanban-column">
                <div className="kanban-col-header">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full skeleton" />
                    <div className="h-4 w-20 skeleton rounded" />
                  </div>
                  <div className="w-5 h-5 rounded skeleton" />
                </div>
                <div className="kanban-cards">
                  {Array.from({ length: 2 }).map((_, cIdx) => (
                    <div key={cIdx} className="card p-4 space-y-3 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl">
                      <div className="flex justify-between items-center">
                        <div className="h-3 w-16 skeleton rounded-full" />
                        <div className="h-3.5 w-3.5 rounded-full skeleton" />
                      </div>
                      <div className="space-y-2">
                        <div className="h-4 w-full skeleton rounded" />
                        <div className="h-4 w-2/3 skeleton rounded" />
                      </div>
                      <div className="flex justify-between items-center pt-3 border-t border-[var(--border)]">
                        <div className="w-6 h-6 rounded-full skeleton" />
                        <div className="h-3 w-12 skeleton rounded" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : viewMode === 'gantt' ? (
        <GanttChart tasks={filteredAndSortedTasks} onTaskClick={(id) => setActiveTaskId(id)} />
      ) : (
        <>
          {/* Kanban Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="card p-3 flex justify-between items-center">
              <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Total Active Tasks</span>
              <span className="text-xl font-bold font-mono text-[var(--text-1)]">{totalCount}</span>
            </div>
            <div className="card p-3 flex justify-between items-center" style={{ borderLeft: '3px solid var(--yellow)' }}>
              <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Pending Worklogs</span>
              <span className="text-xl font-bold font-mono text-[var(--yellow)]">{pendingCount}</span>
            </div>
            <div className="card p-3 flex justify-between items-center" style={{ borderLeft: '3px solid var(--green)' }}>
              <span className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider">Completed Logs</span>
              <span className="text-xl font-bold font-mono text-[var(--green)]">{completedCount}</span>
            </div>
          </div>

          <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch' }}>
            <DragDropContext
              onDragStart={(start) => setDraggingId(start.draggableId)}
              onDragEnd={handleDragEnd}
            >
              <div className="kanban-board">
                {COLUMNS.map(col => {
                const colTasks = filteredAndSortedTasks.filter((t: any) => t.status === col.id);
                return (
                  <div
                    key={col.id}
                    data-status={col.id}
                    className="kanban-column"
                  >
                    <div className="kanban-col-header">
                      <div className="kanban-col-title">
                        <span className="kanban-col-ring" style={{ color: col.color }} />
                        {col.label}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="kanban-col-count font-mono" style={{ background: `${col.color}20`, color: col.color }}>
                          {colTasks.length}
                        </span>
                      </div>
                    </div>

                    <Droppable droppableId={col.id}>
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`kanban-cards ${snapshot.isDraggingOver ? 'kanban-column-drop-active' : ''}`}
                        >
                          {colTasks.map((task: any, index: number) => (
                            <Draggable key={task.id} draggableId={task.id} index={index}>
                              {(dragProvided, dragSnapshot) => (
                                <div
                                  ref={dragProvided.innerRef}
                                  {...dragProvided.draggableProps}
                                  {...dragProvided.dragHandleProps}
                                >
                                  <TaskCard
                                    task={task}
                                    isDragging={dragSnapshot.isDragging}
                                    onClick={(event) => handleTaskClick(event, task.id)}
                                    currentUserId={user?.id}
                                    onActionClick={(e) => handleOpenActionMenu(e, task.id)}
                                    isMenuOpen={actionsMenuTaskId === task.id}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {colTasks.length === 0 && !snapshot.isDraggingOver && (
                            <div className="kanban-empty">
                              <FolderKanban size={18} opacity={0.3} className="mx-auto mb-1.5" />
                              <p>Drop tasks here</p>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>

                    {/* Quick Task Creation Field */}
                    <div className="mt-3 p-2 bg-[var(--bg-surface-2)]/40 border border-dashed border-[var(--border)] rounded-xl">
                      <input
                        type="text"
                        placeholder="+ Quick add task (press Enter)"
                        value={quickTaskInputs[col.id] || ''}
                        onChange={(e) => setQuickTaskInputs(prev => ({ ...prev, [col.id]: e.target.value }))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && quickTaskInputs[col.id]?.trim()) {
                            createTask.mutate({
                              title: quickTaskInputs[col.id],
                              status: col.id,
                              assigneeId: user?.id,
                              reviewerId: user?.id,
                              priority: 'medium',
                              dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
                              projectId: 'general',
                              projectName: 'General',
                              estimatedHours: 8,
                            });
                            setQuickTaskInputs(prev => ({ ...prev, [col.id]: '' }));
                          }
                        }}
                        className="w-full bg-transparent border-none text-xs text-[var(--text-1)] placeholder-[var(--text-3)] focus:outline-none"
                      />
                    </div>
                  </div>
                );
              })}
              </div>
            </DragDropContext>
          </div>
        </>
      )}


      {/* Floating Three-Dot Actions Dropdown */}
      {actionsMenuTaskId && actionsMenuPosition && (() => {
        const selectedTask = tasks.find((t: any) => t.id === actionsMenuTaskId);
        if (!selectedTask) return null;

        return (
          <div
            className="fixed bg-[var(--bg-surface-2)] border border-[var(--border-strong)] rounded-xl py-1.5 w-40 shadow-2xl z-[3000] text-xs font-semibold"
            style={{ left: actionsMenuPosition.x, top: actionsMenuPosition.y }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setActiveTaskId(actionsMenuTaskId)}
              className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-1)] flex items-center gap-1.5 cursor-pointer"
            >
              <Edit size={11} /> Edit Details
            </button>
            
            {/* Move column sub-options */}
            <div className="border-t border-[var(--border)] my-1" />
            <span className="block px-3 py-0.5 text-[8px] font-bold text-[var(--text-3)] uppercase tracking-wider">Move Status</span>
            {COLUMNS.map(col => {
              if (col.id === selectedTask.status) return null;
              return (
                <button
                  key={col.id}
                  onClick={() => {
                    updateTask.mutate({ id: selectedTask.id, data: { status: col.id } });
                    setActionsMenuTaskId(null);
                  }}
                  className="w-full text-left px-3 py-1.5 hover:bg-[var(--bg-hover)] text-[var(--text-2)] hover:text-[var(--text-1)] flex items-center gap-1.5 cursor-pointer pl-6 capitalize"
                >
                  <ArrowRight size={10} /> {col.label}
                </button>
              );
            })}

            <div className="border-t border-[var(--border)] my-1" />
            <button
              onClick={() => {
                setDeletingTaskId(actionsMenuTaskId);
                setActionsMenuTaskId(null);
              }}
              className="w-full text-left px-3 py-1.5 hover:bg-red-500/20 text-red-400 hover:text-red-500 flex items-center gap-1.5 cursor-pointer"
            >
              <Trash size={11} /> Delete Task
            </button>
          </div>
        );
      })()}

      {/* Create Task Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl w-full max-w-md p-6 relative shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="text-base font-extrabold text-[var(--text-1)] uppercase tracking-wide">Create New Task</h3>
              <button className="modal-close text-[var(--text-3)] hover:text-white cursor-pointer" onClick={() => setShowModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body space-y-4 text-sm mt-4">
              <div className="form-group">
                <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Title *</label>
                <input className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]" value={newTask.title} onChange={e => setNewTask(p => ({ ...p, title: e.target.value }))} placeholder="Task title..." required />
              </div>
              <div className="form-group">
                <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Description</label>
                <textarea className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)] resize-none" value={newTask.description} onChange={e => setNewTask(p => ({ ...p, description: e.target.value }))} placeholder="Task description..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Priority</label>
                  <select className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]" value={newTask.priority} onChange={e => setNewTask(p => ({ ...p, priority: e.target.value as Priority }))}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Due Date</label>
                  <input className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]" type="date" value={newTask.dueDate} onChange={e => setNewTask(p => ({ ...p, dueDate: e.target.value }))} />
                </div>
              </div>
              {hasPermission('assign_tasks') && users.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Assignee</label>
                    <select className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]" value={newTask.assigneeId} onChange={e => setNewTask(p => ({ ...p, assigneeId: e.target.value }))}>
                      <option value="">— Self —</option>
                      {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.position})</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Designated Reviewer</label>
                    <select className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]" value={newTask.reviewerId} onChange={e => setNewTask(p => ({ ...p, reviewerId: e.target.value }))}>
                      <option value="">— Assigner (Self) —</option>
                      {users.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.position})</option>)}
                    </select>
                  </div>
                </div>
              ) : !hasPermission('assign_tasks') ? (
                <div className="p-3 bg-[var(--accent-soft)]/20 border border-[var(--border)] rounded-lg text-[10px] text-[var(--text-2)] font-semibold">
                  📌 This task will be assigned to you. Only supervisors and managers can assign tasks to others.
                </div>
              ) : null}
              <div className="form-group">
                <label className="block text-[var(--text-3)] font-bold mb-1.5 uppercase">Tags (comma separated)</label>
                <input className="w-full p-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-lg text-[var(--text-1)] focus:outline-none focus:border-[var(--accent)]" value={newTask.tags} onChange={e => setNewTask(p => ({ ...p, tags: e.target.value }))} placeholder="frontend, design, urgent..." />
              </div>
            </div>
            <div className="modal-footer flex gap-2 justify-end pt-4 border-t border-[var(--border)] mt-6">
              <button className="py-2 px-4 bg-[var(--bg-surface-2)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] font-semibold rounded-lg transition-colors cursor-pointer" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="py-2 px-4 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold rounded-lg transition-colors cursor-pointer" onClick={handleAddTask} disabled={createTask.isPending}>
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTaskId && (
        <TaskDetailPanel taskId={activeTaskId} onClose={() => setActiveTaskId(null)} />
      )}

      {deletingTaskId && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[2000] flex items-center justify-center p-4" onClick={() => setDeletingTaskId(null)}>
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl w-full max-w-md p-6 relative shadow-2xl animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="modal-header flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h3 className="text-base font-extrabold text-[var(--text-1)] uppercase tracking-wide flex items-center gap-2">
                <Trash size={18} className="text-red-500" /> Delete Task
              </h3>
              <button className="modal-close text-[var(--text-3)] hover:text-white cursor-pointer" onClick={() => setDeletingTaskId(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body space-y-3 text-sm mt-4">
              <p className="text-[var(--text-2)]">Are you sure you want to permanently delete this task? This action cannot be undone.</p>
            </div>
            <div className="modal-footer flex gap-2 justify-end pt-4 border-t border-[var(--border)] mt-6">
              <button className="py-2 px-4 bg-[var(--bg-surface-2)] border border-[var(--border)] hover:bg-[var(--bg-hover)] text-[var(--text-2)] font-semibold rounded-lg transition-colors cursor-pointer" onClick={() => setDeletingTaskId(null)}>Cancel</button>
              <button
                className="py-2 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
                onClick={() => {
                  deleteTask.mutate(deletingTaskId);
                  setDeletingTaskId(null);
                }}
                disabled={deleteTask.isPending}
              >
                {deleteTask.isPending ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
