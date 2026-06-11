'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, attendanceApi, tasksApi, leavesApi, shiftsApi, departmentsApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [showShiftModal, setShowShiftModal] = useState(false);
  const [shiftDate, setShiftDate] = useState('');
  const [shiftType, setShiftType] = useState('day');
  const [shiftStart, setShiftStart] = useState('09:00');
  const [shiftEnd, setShiftEnd] = useState('17:00');
  const [shiftNotes, setShiftNotes] = useState('');
  const [shiftError, setShiftError] = useState('');

  // Edit profile state
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPosition, setEditPosition] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmployeeCode, setEditEmployeeCode] = useState('');
  const [editDepartmentName, setEditDepartmentName] = useState('');
  const [editRoleName, setEditRoleName] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editError, setEditError] = useState('');

  // Fetch shifts
  const { data: shifts = [] } = useQuery({
    queryKey: ['employee-shifts', userId],
    queryFn: () => shiftsApi.list({ userId }),
    enabled: !!userId,
  });

  // Assign shift mutation
  const assignShift = useMutation({
    mutationFn: (data: any) => shiftsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-shifts', userId] });
      setShowShiftModal(false);
      setShiftNotes('');
      setShiftStart('09:00');
      setShiftEnd('17:00');
    },
    onError: (err: any) => {
      setShiftError(err.response?.data?.error || 'Failed to assign shift.');
    }
  });

  const handleOpenShiftModal = (dateStr: string, existingShift?: any) => {
    setShiftDate(dateStr);
    if (existingShift) {
      setShiftType(existingShift.type);
      setShiftStart(existingShift.startTime || '09:00');
      setShiftEnd(existingShift.endTime || '17:00');
      setShiftNotes(existingShift.notes || '');
    } else {
      setShiftType('day');
      setShiftStart('09:00');
      setShiftEnd('17:00');
      setShiftNotes('');
    }
    setShiftError('');
    setShowShiftModal(true);
  };

  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    setShiftError('');
    assignShift.mutate({
      userId,
      date: shiftDate,
      type: shiftType,
      startTime: shiftType === 'off' ? null : shiftStart,
      endTime: shiftType === 'off' ? null : shiftEnd,
      notes: shiftNotes,
    });
  };

  const getWeekDates = () => {
    const today = new Date();
    const day = today.getDay();
    // Monday is start of week
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(today.setDate(diff));
    
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      return d.toISOString().split('T')[0];
    });
  };

  const weekDates = getWeekDates();

  // Fetch employee details
  const { data: employee, isLoading: isEmpLoading } = useQuery({
    queryKey: ['employee-profile', userId],
    queryFn: () => usersApi.get(userId),
    enabled: !!userId,
  });

  // Fetch departments
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
  });

  // Edit profile mutation
  const updateProfile = useMutation({
    mutationFn: (data: any) => usersApi.update(userId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee-profile', userId] });
      setShowEditProfileModal(false);
      setEditPassword('');
    },
    onError: (err: any) => {
      setEditError(err.response?.data?.error || 'Failed to update profile.');
    }
  });

  const handleOpenEditProfileModal = () => {
    if (!employee) return;
    setEditName(employee.name || '');
    setEditPosition(employee.position || '');
    setEditPhone(employee.phone || '');
    setEditEmployeeCode(employee.employeeCode || '');
    setEditDepartmentName(employee.department || '');
    setEditRoleName(employee.role || '');
    setEditStatus(employee.status || '');
    setEditPassword('');
    setEditError('');
    setShowEditProfileModal(true);
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    setEditError('');
    
    const updateData: any = {
      name: editName,
      position: editPosition,
      phone: editPhone,
      employeeCode: editEmployeeCode,
      departmentName: editDepartmentName,
      roleName: editRoleName,
      status: editStatus,
    };
    
    if (editPassword) {
      updateData.password = editPassword;
    }
    
    updateProfile.mutate(updateData);
  };

  // Fetch attendance records
  const { data: attendance = [] } = useQuery({
    queryKey: ['employee-attendance', userId],
    queryFn: () => attendanceApi.list({ userId }),
    enabled: !!userId,
  });

  // Fetch assigned tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ['employee-tasks', userId],
    queryFn: () => tasksApi.list({ assigneeId: userId }),
    enabled: !!userId,
  });

  // Fetch leaves
  const { data: leaves = [] } = useQuery({
    queryKey: ['employee-leaves', userId],
    queryFn: () => leavesApi.list(),
    enabled: !!userId,
  });

  if (isEmpLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', color: 'var(--text-secondary)' }}>
        <span className="spinner" style={{ marginBottom: '10px' }} />
        Loading profile...
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="page-content" style={{ textAlign: 'center', padding: '60px' }}>
        <h2 style={{ color: '#ef4444' }}>Employee Not Found</h2>
        <button className="btn-secondary" style={{ marginTop: '20px' }} onClick={() => router.push('/team')}>
          Back to Directory
        </button>
      </div>
    );
  }

  // Filter leaves to only this employee
  const employeeLeaves = leaves.filter((l: any) => l.userId === userId);

  // Compute stats
  const completedTasks = tasks.filter((t: any) => t.status === 'done').length;
  const pendingTasks = tasks.length - completedTasks;
  const presentDays = attendance.filter((r: any) => r.status === 'present' || r.status === 'late').length;
  const lateDays = attendance.filter((r: any) => r.status === 'late').length;

  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin', admin: 'Admin', hr_manager: 'HR Manager',
    manager: 'Manager', team_lead: 'Team Lead', employee: 'Employee',
  };

  return (
    <div className="page-content">
      {/* Back button */}
      <div style={{ marginBottom: '15px' }}>
        <Link href="/team" className="btn-secondary" style={{ padding: '6px 12px', fontSize: '12px', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          ← Back to Team Directory
        </Link>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '24px', alignItems: 'start' }}>
        {/* Left Side: Profile Card */}
        <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
          <div className="user-avatar" style={{ width: '80px', height: '80px', fontSize: '32px', margin: '0 auto 16px', background: 'rgba(99, 102, 241, 0.1)', border: '2px solid rgba(99, 102, 241, 0.3)', color: '#818cf8', fontWeight: 700 }}>
            {employee.avatar}
          </div>
          <h2 style={{ color: '#fff', fontSize: '18px', fontWeight: 700, margin: '0 0 4px 0' }}>{employee.name}</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 16px 0' }}>{employee.position}</p>
          
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
            <span className="dept-badge" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>{employee.department}</span>
            <span className="role-badge" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981' }}>{ROLE_LABELS[employee.role]}</span>
          </div>

          {user && ['super_admin', 'admin', 'hr_manager'].includes(user.role) && (
            <button
              onClick={handleOpenEditProfileModal}
              className="btn-primary-sm"
              style={{ width: '100%', marginBottom: '20px', justifyContent: 'center' }}
            >
              Edit Profile
            </button>
          )}

          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px', textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Email Address</span>
              <a href={`mailto:${employee.email}`} style={{ color: '#fff', fontSize: '13px', textDecoration: 'none' }}>{employee.email}</a>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Phone Number</span>
              <span style={{ color: '#fff', fontSize: '13px' }}>{employee.phone || '—'}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Employee Code (RFID UID)</span>
              <span style={{ color: '#fff', fontSize: '13px' }}>{employee.employeeCode || '—'}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Joined Date</span>
              <span style={{ color: '#fff', fontSize: '13px' }}>{employee.joinDate}</span>
            </div>
            <div>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Account Status</span>
              <span className={`status-pill ${employee.status === 'active' ? 'status-present' : 'status-absent'}`} style={{ marginTop: '4px', display: 'inline-block' }}>
                {employee.status}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Tab Panels / Employee Metrics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Quick Metrics */}
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
            <div className="kpi-card" style={{ borderLeft: '4px solid #10b981' }}>
              <div className="kpi-title">Attendance Rate</div>
              <div className="kpi-value-row">
                <span className="kpi-value">{attendance.length > 0 ? Math.round((presentDays / attendance.length) * 100) : 100}%</span>
                <span className="kpi-trend trend-positive">{presentDays} present</span>
              </div>
            </div>
            <div className="kpi-card" style={{ borderLeft: '4px solid #6366f1' }}>
              <div className="kpi-title">Completed Tasks</div>
              <div className="kpi-value-row">
                <span className="kpi-value">{completedTasks}</span>
                <span className="kpi-trend trend-neutral">{pendingTasks} pending</span>
              </div>
            </div>
            <div className="kpi-card" style={{ borderLeft: '4px solid #f59e0b' }}>
              <div className="kpi-title">Approved Leaves</div>
              <div className="kpi-value-row">
                <span className="kpi-value">{employeeLeaves.filter((l: any) => l.status === 'approved').length}</span>
                <span className="kpi-trend trend-neutral">{employeeLeaves.filter((l: any) => l.status === 'pending').length} pending</span>
              </div>
            </div>
          </div>

          {/* Shift Schedule (This Week) */}
          <div className="table-card" style={{ padding: '20px' }}>
            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0' }}>Shift Schedule (This Week)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '10px' }}>
              {weekDates.map(dateStr => {
                const shiftForDay = shifts.find((s: any) => s.date === dateStr);
                const dayName = new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
                const isManager = user && ['super_admin', 'admin', 'manager', 'hr_manager'].includes(user.role);
                
                let typeColor = '#64748b';
                let typeBg = 'rgba(100, 116, 139, 0.1)';
                if (shiftForDay) {
                  if (shiftForDay.type === 'day') { typeColor = '#10b981'; typeBg = 'rgba(16, 185, 129, 0.1)'; }
                  else if (shiftForDay.type === 'night') { typeColor = '#8b5cf6'; typeBg = 'rgba(139, 92, 246, 0.1)'; }
                  else if (shiftForDay.type === 'remote') { typeColor = '#06b6d4'; typeBg = 'rgba(6, 182, 212, 0.1)'; }
                  else if (shiftForDay.type === 'off') { typeColor = '#f59e0b'; typeBg = 'rgba(245, 158, 11, 0.1)'; }
                }

                return (
                  <div key={dateStr} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '10px', padding: '12px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px', minHeight: '120px', justifyContent: 'space-between' }}>
                    <div>
                      <p style={{ margin: 0, fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>{dayName}</p>
                      <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#fff', fontWeight: 500 }}>{dateStr.slice(5)}</p>
                    </div>

                    <div style={{ padding: '6px 4px', borderRadius: '6px', background: typeBg, color: typeColor, fontSize: '11px', fontWeight: 600, textTransform: 'uppercase' }}>
                      {shiftForDay ? shiftForDay.type : 'OFF'}
                      {shiftForDay && shiftForDay.type !== 'off' && shiftForDay.startTime && (
                        <span style={{ display: 'block', fontSize: '9px', fontWeight: 500, color: 'var(--text-secondary)', textTransform: 'none', marginTop: '2px' }}>
                          {shiftForDay.startTime} - {shiftForDay.endTime}
                        </span>
                      )}
                    </div>

                    {isManager ? (
                      <button
                        onClick={() => handleOpenShiftModal(dateStr, shiftForDay)}
                        className="btn-ghost-sm"
                        style={{ padding: '2px 6px', fontSize: '10px', width: '100%', justifyContent: 'center' }}
                      >
                        {shiftForDay ? 'Edit' : '+ Schedule'}
                      </button>
                    ) : (
                      <div style={{ height: '20px' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Attendance Logs */}
          <div className="table-card" style={{ padding: '20px' }}>
            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0' }}>Recent Attendance Logs</h3>
            {attendance.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>No attendance records logged.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Clock In</th>
                    <th>Clock Out</th>
                    <th>Hours worked</th>
                    <th>Method</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.slice(0, 5).map((log: any) => (
                    <tr key={log.id} className="table-row">
                      <td><span className="table-text">{log.date}</span></td>
                      <td><span className="table-text">{log.clockIn || '—'}</span></td>
                      <td><span className="table-text">{log.clockOut || '—'}</span></td>
                      <td><span className="table-text">{log.hoursWorked ? `${log.hoursWorked}h` : '—'}</span></td>
                      <td><span className="table-text" style={{ textTransform: 'capitalize' }}>{log.method}</span></td>
                      <td>
                        <span className={`status-pill ${
                          log.status === 'present' ? 'status-present' : log.status === 'late' ? 'status-late' : 'status-absent'
                        }`} style={{ textTransform: 'capitalize' }}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Assigned Tasks List */}
          <div className="table-card" style={{ padding: '20px' }}>
            <h3 style={{ color: '#fff', fontSize: '15px', fontWeight: 600, margin: '0 0 12px 0' }}>Assigned Tasks</h3>
            {tasks.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>No tasks currently assigned.</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task Name</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Due Date</th>
                    <th>Progress</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task: any) => {
                    const progress = task.estimatedHours > 0 ? Math.min(100, Math.round((task.loggedHours / task.estimatedHours) * 100)) : 0;
                    return (
                      <tr key={task.id} className="table-row">
                        <td>
                          <div>
                            <p className="table-user-name" style={{ margin: 0 }}>{task.title}</p>
                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{task.projectName}</span>
                          </div>
                        </td>
                        <td>
                          <span className="role-badge" style={{
                            background: task.priority === 'critical' ? '#ef444420' : task.priority === 'high' ? '#f9731620' : '#f59e0b20',
                            color: task.priority === 'critical' ? '#ef4444' : task.priority === 'high' ? '#f97316' : '#f59e0b'
                          }}>
                            {task.priority}
                          </span>
                        </td>
                        <td>
                          <span className="role-badge" style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--text-secondary)' }}>
                            {task.status.replace('_', ' ').toUpperCase()}
                          </span>
                        </td>
                        <td><span className="table-text">{task.dueDate}</span></td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '60px', height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: '#6366f1', width: `${progress}%` }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{progress}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Assign Shift Modal */}
      {showShiftModal && (
        <div className="modal-overlay" onClick={() => setShowShiftModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '400px' }}>
            <div className="modal-header">
              <h3>Schedule Shift</h3>
              <button className="modal-close" onClick={() => setShowShiftModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveShift} className="modal-body">
              <div style={{ marginBottom: '15px', color: '#fff', fontSize: '13px' }}>
                Scheduling for: <strong>{employee.name}</strong> on <strong>{shiftDate}</strong>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Shift Type</label>
                <select className="form-input form-select" value={shiftType} onChange={e => setShiftType(e.target.value)}>
                  <option value="day">Day Shift</option>
                  <option value="night">Night Shift</option>
                  <option value="remote">Remote Work</option>
                  <option value="off">Day Off (OFF)</option>
                </select>
              </div>

              {shiftType !== 'off' && (
                <div className="form-row" style={{ marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label">Start Time</label>
                    <input type="text" className="form-input" placeholder="e.g. 09:00" value={shiftStart} onChange={e => setShiftStart(e.target.value)} required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">End Time</label>
                    <input type="text" className="form-input" placeholder="e.g. 17:00" value={shiftEnd} onChange={e => setShiftEnd(e.target.value)} required />
                  </div>
                </div>
              )}

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  className="form-input"
                  style={{ minHeight: '60px', resize: 'vertical' }}
                  value={shiftNotes}
                  onChange={e => setShiftNotes(e.target.value)}
                  placeholder="e.g. Coverage for sprint planning"
                />
              </div>

              {shiftError && (
                <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', textAlign: 'center', background: '#ef444415', padding: '8px', borderRadius: '6px', border: '1px solid #ef444430' }}>
                  {shiftError}
                </div>
              )}

              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                <button type="button" className="btn-ghost-sm" onClick={() => setShowShiftModal(false)} disabled={assignShift.isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-sm" disabled={assignShift.isPending}>
                  {assignShift.isPending ? 'Saving...' : 'Save Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && (
        <div className="modal-overlay" onClick={() => setShowEditProfileModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Edit Profile</h3>
              <button className="modal-close" onClick={() => setShowEditProfileModal(false)}>✕</button>
            </div>
            <form onSubmit={handleSaveProfile} className="modal-body">
              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  required
                />
              </div>

              <div className="form-row" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Position</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editPosition}
                    onChange={e => setEditPosition(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editPhone}
                    onChange={e => setEditPhone(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Employee Code / RFID UID</label>
                <input
                  type="text"
                  className="form-input"
                  value={editEmployeeCode}
                  onChange={e => setEditEmployeeCode(e.target.value)}
                  placeholder="e.g., 136-4-13-10"
                />
              </div>

              <div className="form-row" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Department</label>
                  <select
                    className="form-input form-select"
                    value={editDepartmentName}
                    onChange={e => setEditDepartmentName(e.target.value)}
                  >
                    <option value="">No Department</option>
                    {departments.map((dept: any) => (
                      <option key={dept.id} value={dept.name}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Role</label>
                  <select
                    className="form-input form-select"
                    value={editRoleName}
                    onChange={e => setEditRoleName(e.target.value)}
                  >
                    {Object.entries(ROLE_LABELS).map(([roleKey, label]) => (
                      <option key={roleKey} value={roleKey}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row" style={{ marginBottom: '16px' }}>
                <div className="form-group">
                  <label className="form-label">Account Status</label>
                  <select
                    className="form-input form-select"
                    value={editStatus}
                    onChange={e => setEditStatus(e.target.value)}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Password (Leave blank to keep unchanged)</label>
                  <input
                    type="password"
                    className="form-input"
                    value={editPassword}
                    onChange={e => setEditPassword(e.target.value)}
                    placeholder="New password"
                  />
                </div>
              </div>

              {editError && (
                <div style={{ color: '#ef4444', fontSize: '13px', marginBottom: '16px', textAlign: 'center', background: '#ef444415', padding: '8px', borderRadius: '6px', border: '1px solid #ef444430' }}>
                  {editError}
                </div>
              )}

              <div className="modal-footer" style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', borderTop: '1px solid #1e293b', paddingTop: '12px' }}>
                <button type="button" className="btn-ghost-sm" onClick={() => setShowEditProfileModal(false)} disabled={updateProfile.isPending}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary-sm" disabled={updateProfile.isPending}>
                  {updateProfile.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
