'use client';

import React from 'react';

interface Task {
  id: string;
  title: string;
  dueDate: string;
  priority: string;
  status: string;
  assigneeName: string;
  assigneeAvatar: string;
  projectName: string;
}

export default function GanttChart({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick: (id: string) => void }) {
  // Generate next 10 days
  const days: Date[] = [];
  for (let i = 0; i < 10; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    days.push(d);
  }

  const todayStr = new Date().toISOString().split('T')[0];

  const getDaysDiff = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    return Math.round((e.getTime() - s.getTime()) / (1000 * 3600 * 24));
  };

  const PRIORITY_COLORS: Record<string, string> = {
    critical: 'linear-gradient(90deg, #ef4444, #f87171)',
    high: 'linear-gradient(90deg, #f97316, #fb923c)',
    medium: 'linear-gradient(90deg, #f59e0b, #fbbf24)',
    low: 'linear-gradient(90deg, #64748b, #94a3b8)',
  };

  return (
    <div className="table-card" style={{ padding: '20px', overflowX: 'auto' }}>
      <div style={{ minWidth: '800px' }}>
        {/* Timeline Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '250px repeat(10, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '10px', marginBottom: '10px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 600 }}>Task / Project</div>
          {days.map((day, idx) => (
            <div key={idx} style={{ textAlign: 'center', color: idx === 0 ? 'var(--indigo)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: 600 }}>
              <div>{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-1)', marginTop: '2px' }}>{day.getDate()}</div>
            </div>
          ))}
        </div>

        {/* Task Rows */}
        {tasks.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No tasks scheduled.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            {tasks.map(task => {
              // Calculate start and end offsets relative to today
              // For simplicity, we assume task starts today (or on its start date if we had one) and goes to dueDate.
              const daysDiff = getDaysDiff(todayStr, task.dueDate);
              
              let colStart = 1; // today
              let duration = daysDiff + 1; // span in days

              if (daysDiff < 0) {
                // Task is overdue (due in past)
                colStart = 1;
                duration = 1;
              } else if (duration > 10) {
                // Cap duration to 10 days timeline
                duration = 10;
              }

              return (
                <div
                  key={task.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '250px repeat(10, 1fr)',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderRadius: '8px',
                    transition: 'background 0.2s',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  onClick={() => onTaskClick(task.id)}
                >
                  {/* Task Left Label */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingRight: '15px' }}>
                    <div className="table-avatar" style={{ width: '28px', height: '28px', fontSize: '11px', flexShrink: 0 }}>{task.assigneeAvatar}</div>
                    <div style={{ overflow: 'hidden' }}>
                      <p style={{ color: '#fff', fontSize: '13px', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{task.projectName}</span>
                    </div>
                  </div>

                  {/* Gantt Timeline Bar Area */}
                  <div style={{ gridColumn: `span 10`, display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', height: '24px', position: 'relative' }}>
                    {/* Background Grid Lines */}
                    {Array.from({ length: 10 }).map((_, idx) => (
                      <div key={idx} style={{ borderLeft: '1px dashed rgba(255,255,255,0.03)', height: '100%' }} />
                    ))}

                    {/* Timeline Bar */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${((colStart - 1) / 10) * 100}%`,
                        width: `${(duration / 10) * 100}%`,
                        height: '14px',
                        top: '5px',
                        background: PRIORITY_COLORS[task.priority] || 'var(--indigo)',
                        borderRadius: '7px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        transition: 'opacity 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = '0.9'}
                      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                    >
                      <span style={{ color: '#fff', fontSize: '9px', fontWeight: 700, textShadow: '0 1px 2px rgba(0,0,0,0.3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 4px' }}>
                        {duration}d
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
