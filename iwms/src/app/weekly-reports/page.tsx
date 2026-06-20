'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth-context';
import { reportsApi, usersApi, departmentsApi } from '@/lib/api';

// --- Utility: Get recent Mondays for the week selector ---
function getRecentMondays(count = 8) {
  const list = [];
  const now = new Date();
  
  // Find current Monday
  const day = now.getDay();
  const diff = now.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
  const currentMonday = new Date(now.setDate(diff));
  
  for (let i = 0; i < count; i++) {
    const monday = new Date(currentMonday.getTime());
    monday.setDate(currentMonday.getDate() - i * 7);
    
    const sunday = new Date(monday.getTime());
    sunday.setDate(monday.getDate() + 6);
    
    const startStr = monday.toISOString().split('T')[0];
    const endStr = sunday.toISOString().split('T')[0];
    
    const label = `${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sunday.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    
    list.push({ startDate: startStr, endDate: endStr, label });
  }
  return list;
}

export default function WeeklyReportsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const weeks = getRecentMondays();

  // --- UI States ---
  const [activeTab, setActiveTab] = useState<'my' | 'team'>('my');
  const [editingReport, setEditingReport] = useState<any | null>(null);
  const [viewingReport, setViewingReport] = useState<any | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(weeks[0]);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [exportingId, setExportingId] = useState<string | null>(null);

  // Filters for review tab
  const [filterDept, setFilterDept] = useState('');
  const [filterEmp, setFilterEmp] = useState('');
  const [filterWeek, setFilterWeek] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // --- Dynamic Form Lists ---
  const [activities, setActivities] = useState<any[]>([]);
  const [roadblocks, setRoadblocks] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [supportItems, setSupportItems] = useState<any[]>([]);
  const [insights, setInsights] = useState<any[]>([]);
  const [additionalNotes, setAdditionalNotes] = useState('');

  // Set default tab for managers
  useEffect(() => {
    if (user && ['super_admin', 'admin', 'manager', 'hr_manager', 'team_lead'].includes(user.role)) {
      setActiveTab('team');
    }
  }, [user]);

  // --- Data Queries ---
  const { data: myReports = [], isLoading: loadingMy } = useQuery({
    queryKey: ['my-reports'],
    queryFn: () => reportsApi.myReports(),
    enabled: !!user,
  });

  const { data: teamReports = [], isLoading: loadingTeam } = useQuery({
    queryKey: ['team-reports', filterDept, filterEmp, filterWeek, filterStatus],
    queryFn: () => {
      const params: any = {};
      if (filterDept) params.departmentId = filterDept;
      if (filterEmp) params.employeeId = filterEmp;
      if (filterWeek) params.startDate = filterWeek;
      if (filterStatus) params.status = filterStatus;
      return reportsApi.reviewList(params);
    },
    enabled: !!user && ['super_admin', 'admin', 'manager', 'hr_manager', 'team_lead'].includes(user.role),
  });

  const { data: employees = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list(),
    enabled: !!user && ['super_admin', 'admin', 'manager', 'hr_manager', 'team_lead'].includes(user.role),
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: () => departmentsApi.list(),
    enabled: !!user && ['super_admin', 'admin', 'manager', 'hr_manager', 'team_lead'].includes(user.role),
  });

  // --- Form Handlers ---
  const startNewReport = (existing: any = null) => {
    if (existing) {
      setEditingReport(existing);
      setSelectedWeek(weeks.find(w => w.startDate === existing.startDate) || { startDate: existing.startDate, endDate: existing.endDate, label: '' });
      setActivities(existing.activities || []);
      setRoadblocks(existing.roadblocks || []);
      setPlans(existing.plans || []);
      setSupportItems(existing.supportItems || []);
      setInsights(existing.insights || []);
      setAdditionalNotes(existing.additionalNotes || '');
    } else {
      setEditingReport({ startDate: selectedWeek.startDate, endDate: selectedWeek.endDate, status: 'draft' });
      setActivities([]);
      setRoadblocks([]);
      setPlans([]);
      setSupportItems([]);
      setInsights([]);
      setAdditionalNotes('');
    }
    setViewingReport(null);
  };

  const handleAutoPopulate = async () => {
    try {
      const { activities: populated } = await reportsApi.autoPopulate(selectedWeek.startDate, selectedWeek.endDate);
      // Merge populated with existing manual entries
      setActivities(prev => {
        const existingNames = new Set(prev.map(a => a.taskName));
        const newActivities = [...prev];
        for (const item of populated) {
          if (!existingNames.has(item.taskName)) {
            newActivities.push(item);
          }
        }
        return newActivities;
      });
    } catch (err) {
      alert('Failed to auto-populate tasks.');
    }
  };

  const saveReport = async (isSubmit: boolean) => {
    if (!editingReport) return;
    try {
      const payload = {
        startDate: selectedWeek.startDate,
        endDate: selectedWeek.endDate,
        activities,
        roadblocks,
        plans,
        supportItems,
        insights,
        additionalNotes,
        action: isSubmit ? 'submit' : 'draft',
      };
      await reportsApi.save(payload);
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['team-reports'] });
      setEditingReport(null);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save report.');
    }
  };

  const handleReview = async (status: 'approved' | 'needs_revision') => {
    if (!viewingReport) return;
    setSubmittingReview(true);
    try {
      await reportsApi.review(viewingReport.id, { status, reviewNotes });
      queryClient.invalidateQueries({ queryKey: ['my-reports'] });
      queryClient.invalidateQueries({ queryKey: ['team-reports'] });
      
      // Update local modal data
      setViewingReport((prev: any) => ({ ...prev, status, reviewNotes }));
      setReviewNotes('');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to submit review.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleExport = async (id: string, name: string, date: string) => {
    setExportingId(id);
    try {
      const blob = await reportsApi.exportDocx(id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Weekly_Report_${date}_${name.replace(/\s+/g, '_')}.docx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      alert('Failed to export Word document.');
    } finally {
      setExportingId(null);
    }
  };

  // --- Dynamic Table Adding/Removing Rows ---
  const addActivity = () => setActivities([...activities, { taskName: '', type: 'Development', status: 'In Progress', impact: '', hoursSpent: 0, links: '' }]);
  const removeActivity = (idx: number) => setActivities(activities.filter((_, i) => i !== idx));
  const updateActivity = (idx: number, field: string, val: any) => {
    setActivities(activities.map((a, i) => i === idx ? { ...a, [field]: val } : a));
  };

  const addRoadblock = () => setRoadblocks([...roadblocks, { challenge: '', impact: '', mitigation: '', supportRequired: '', responsibleParty: '', deadline: '' }]);
  const removeRoadblock = (idx: number) => setRoadblocks(roadblocks.filter((_, i) => i !== idx));
  const updateRoadblock = (idx: number, field: string, val: any) => {
    setRoadblocks(roadblocks.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  };

  const addPlan = () => setPlans([...plans, { plannedActivity: '', typeAssigned: 'Assigned', typeScope: 'Departmental', deliverables: '', targetDate: '', dependencies: '' }]);
  const removePlan = (idx: number) => setPlans(plans.filter((_, i) => i !== idx));
  const updatePlan = (idx: number, field: string, val: any) => {
    setPlans(plans.map((p, i) => i === idx ? { ...p, [field]: val } : p));
  };

  const addSupportItem = () => setSupportItems([...supportItems, { description: '', supportType: '', requestedFrom: '', urgency: 'medium', dueDate: '' }]);
  const removeSupportItem = (idx: number) => setSupportItems(supportItems.filter((_, i) => i !== idx));
  const updateSupportItem = (idx: number, field: string, val: any) => {
    setSupportItems(supportItems.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  const addInsight = () => setInsights([...insights, { insight: '', category: 'Technical', impact: '' }]);
  const removeInsight = (idx: number) => setInsights(insights.filter((_, i) => i !== idx));
  const updateInsight = (idx: number, field: string, val: any) => {
    setInsights(insights.map((ins, i) => i === idx ? { ...ins, [field]: val } : ins));
  };

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Weekly Activity Reports</h1>
          <p className="page-subtitle">Submit, track, and review company weekly performance reports</p>
        </div>
      {!editingReport && !viewingReport && (
          <div className="page-actions" style={{ position: 'sticky', top: 0, zIndex: 20 }}>
            <button
              className="btn-primary"
              style={{ position: 'sticky', top: 0, zIndex: 20 }}
              onClick={() => startNewReport()}
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              + New Weekly Report
            </button>
          </div>
        )}
      </div>

      {/* Tabs Menu */}
      {!editingReport && !viewingReport && (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button 
            className={`tab-btn ${activeTab === 'my' ? 'active' : ''}`}
            onClick={() => setActiveTab('my')}
          >
            My Weekly Reports
          </button>
          {user && ['super_admin', 'admin', 'manager', 'hr_manager', 'team_lead'].includes(user.role) && (
            <button 
              className={`tab-btn ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              Team Reports Dashboard
            </button>
          )}
        </div>
      )}

      {/* Tab: My Reports */}
      {!editingReport && !viewingReport && activeTab === 'my' && (
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">My Submission History</h3>
          </div>
          {loadingMy ? (
            <div className="table-loading">Loading submission history...</div>
          ) : myReports.length === 0 ? (
            <div className="empty-state">📄 No weekly reports submitted yet. Click &ldquo;+ New Weekly Report&rdquo; to get started.</div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '30%', textAlign: 'left' }}>Reporting Week</th>
                  <th style={{ width: '15%', textAlign: 'left' }}>Status</th>
                  <th style={{ width: '15%', textAlign: 'left' }}>Submitted At</th>
                  <th style={{ width: '30%', textAlign: 'left' }}>HOD Feedback</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {myReports.map((r: any) => (
                  <tr key={r.id}>
                    <td style={{ fontWeight: 600 }}>{r.startDate} to {r.endDate}</td>
                    <td>
                      <span className={`status-badge ${
                        r.status === 'approved' ? 'completed' : 
                        r.status === 'needs_revision' ? 'absent' : 
                        r.status === 'submitted' ? 'late' : 'offline'
                      }`}>
                        {r.status === 'needs_revision' ? 'needs revision' : r.status}
                      </span>
                    </td>
                    <td>{new Date(r.updatedAt).toLocaleDateString()}</td>
                    <td style={{ color: r.reviewNotes ? '#e2e8f0' : '#475569', fontSize: '13px' }}>
                      {r.reviewNotes || '—'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-actions">
                        <button className="action-btn" title="View details" onClick={async () => {
                          const detailed = await reportsApi.get(r.id);
                          setViewingReport(detailed);
                        }}>
                          👁️
                        </button>
                        {r.status === 'draft' || r.status === 'needs_revision' ? (
                          <button className="action-btn" title="Edit draft" onClick={async () => {
                            const detailed = await reportsApi.get(r.id);
                            startNewReport(detailed);
                          }}>
                            ✏️
                          </button>
                        ) : null}
                        <button 
                          className="action-btn" 
                          title="Export Word DOCX"
                          disabled={exportingId === r.id}
                          onClick={() => handleExport(r.id, user?.name || '', r.startDate)}
                        >
                          {exportingId === r.id ? '⏳' : '📥'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab: Team Reports Review Dashboard */}
      {!editingReport && !viewingReport && activeTab === 'team' && (
        <>
          {/* Filters Panel */}
          <div className="chart-card" style={{ marginBottom: '20px', padding: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <label className="input-label">Department</label>
                <select className="input-select" value={filterDept} onChange={e => setFilterDept(e.target.value)}>
                  <option value="" style={{ background: '#0f172a', color: '#f8fafc' }}>All Departments</option>
                  {departments.map((d: any) => (
                    <option key={d.id} value={d.id} style={{ background: '#0f172a', color: '#f8fafc' }}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Employee</label>
                <select className="input-select" value={filterEmp} onChange={e => setFilterEmp(e.target.value)}>
                  <option value="" style={{ background: '#0f172a', color: '#f8fafc' }}>All Employees</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id} style={{ background: '#0f172a', color: '#f8fafc' }}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Week</label>
                <select className="input-select" value={filterWeek} onChange={e => setFilterWeek(e.target.value)}>
                  <option value="" style={{ background: '#0f172a', color: '#f8fafc' }}>All Weeks</option>
                  {weeks.map(w => (
                    <option key={w.startDate} value={w.startDate} style={{ background: '#0f172a', color: '#f8fafc' }}>{w.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="input-label">Status</label>
                <select className="input-select" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                  <option value="" style={{ background: '#0f172a', color: '#f8fafc' }}>All Submitted</option>
                  <option value="submitted" style={{ background: '#0f172a', color: '#f8fafc' }}>Pending Review</option>
                  <option value="approved" style={{ background: '#0f172a', color: '#f8fafc' }}>Approved</option>
                  <option value="needs_revision" style={{ background: '#0f172a', color: '#f8fafc' }}>Needs Revision</option>
                </select>
              </div>
            </div>
          </div>

          {/* List Table */}
          <div className="chart-card">
            <div className="chart-header">
              <h3 className="chart-title">Team Weekly Submissions</h3>
            </div>
            {loadingTeam ? (
              <div className="table-loading">Loading team submissions...</div>
            ) : teamReports.length === 0 ? (
              <div className="empty-state">🔍 No weekly reports found matching your filters.</div>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ width: '20%', textAlign: 'left' }}>Prepared By</th>
                    <th style={{ width: '20%', textAlign: 'left' }}>Department</th>
                    <th style={{ width: '25%', textAlign: 'left' }}>Reporting Week</th>
                    <th style={{ width: '12%', textAlign: 'left' }}>Status</th>
                    <th style={{ width: '13%', textAlign: 'left' }}>Submission Date</th>
                    <th style={{ width: '10%', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teamReports.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.user.name}</td>
                      <td>{r.user.department?.name || 'General'}</td>
                      <td>{r.startDate} to {r.endDate}</td>
                      <td>
                        <span className={`status-badge ${
                          r.status === 'approved' ? 'completed' : 
                          r.status === 'needs_revision' ? 'absent' : 'late'
                        }`}>
                          {r.status === 'needs_revision' ? 'needs revision' : r.status}
                        </span>
                      </td>
                      <td>{new Date(r.updatedAt).toLocaleDateString()}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="table-actions">
                          <button className="action-btn" title="Review Report" onClick={async () => {
                            const detailed = await reportsApi.get(r.id);
                            setViewingReport(detailed);
                          }}>
                            👁️ Review
                          </button>
                          <button 
                            className="action-btn" 
                            title="Export Word"
                            disabled={exportingId === r.id}
                            onClick={() => handleExport(r.id, r.user.name, r.startDate)}
                          >
                            {exportingId === r.id ? '⏳' : '📥 Word'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {/* VIEWING / REVIEW REPORT MODAL DETAIL VIEW */}
      {viewingReport && (
        <div className="chart-card" style={{ padding: '24px', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <span className="live-badge" style={{ background: '#1e293b', color: '#94a3b8', marginBottom: '8px' }}>Weekly Activity Report</span>
              <h2 style={{ fontSize: '24px', fontWeight: 700 }}>{viewingReport.user.name}</h2>
              <p style={{ color: '#64748b', marginTop: '4px' }}>
                Department: <strong>{viewingReport.user.department?.name || 'General'}</strong> | Reporting Period: <strong>{viewingReport.startDate} to {viewingReport.endDate}</strong>
              </p>
            </div>
            <div style={{ textAlign: 'right', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span className={`status-badge ${
                viewingReport.status === 'approved' ? 'completed' : 
                viewingReport.status === 'needs_revision' ? 'absent' : 'late'
              }`} style={{ padding: '6px 12px', fontSize: '13px' }}>
                {viewingReport.status === 'needs_revision' ? 'needs revision' : viewingReport.status}
              </span>
              <button className="btn-ghost-sm" onClick={() => handleExport(viewingReport.id, viewingReport.user.name, viewingReport.startDate)}>
                📥 Export Word
              </button>
              <button className="btn-ghost-sm" onClick={() => setViewingReport(null)}>
                Close
              </button>
            </div>
          </div>

          {/* Section 1: Activities */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#6366f1', fontWeight: 600, fontSize: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '12px' }}>
              1. Weekly Activities Overview
            </h4>
            {viewingReport.activities?.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '14px' }}>No activities logged.</p>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ background: '#090d16', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#101726' }}>
                      <th>Activity/Task Name</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Impact</th>
                      <th>Hours</th>
                      <th>Supporting Links</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingReport.activities.map((a: any) => (
                      <tr key={a.id}>
                        <td style={{ fontWeight: 600 }}>{a.taskName}</td>
                        <td>{a.type}</td>
                        <td>{a.status}</td>
                        <td>{a.impact || '—'}</td>
                        <td>{a.hoursSpent}</td>
                        <td>
                          {a.links ? <a href={a.links} target="_blank" rel="noreferrer" style={{ color: '#6366f1' }}>Link</a> : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 2: Challenges */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#f59e0b', fontWeight: 600, fontSize: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '12px' }}>
              2. Challenges &amp; Roadblocks
            </h4>
            {viewingReport.roadblocks?.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '14px' }}>No roadblocks reported.</p>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ background: '#090d16', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#101726' }}>
                      <th>Challenge Description</th>
                      <th>Impact</th>
                      <th>Mitigation Strategy</th>
                      <th>Support Required</th>
                      <th>Responsible</th>
                      <th>Deadline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingReport.roadblocks.map((r: any) => (
                      <tr key={r.id}>
                        <td>{r.challenge}</td>
                        <td>{r.impact || '—'}</td>
                        <td>{r.mitigation || '—'}</td>
                        <td>{r.supportRequired || '—'}</td>
                        <td>{r.responsibleParty || '—'}</td>
                        <td>{r.deadline || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 3: Plans */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#10b981', fontWeight: 600, fontSize: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '12px' }}>
              3. Upcoming Plans (Next Reporting Period)
            </h4>
            {viewingReport.plans?.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '14px' }}>No upcoming plans logged.</p>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ background: '#090d16', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#101726' }}>
                      <th>Planned Activity/Task</th>
                      <th>Assignment</th>
                      <th>Scope</th>
                      <th>Deliverables</th>
                      <th>Target Date</th>
                      <th>Dependencies</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingReport.plans.map((p: any) => (
                      <tr key={p.id}>
                        <td>{p.plannedActivity}</td>
                        <td>{p.typeAssigned}</td>
                        <td>{p.typeScope}</td>
                        <td>{p.deliverables || '—'}</td>
                        <td>{p.targetDate || '—'}</td>
                        <td>{p.dependencies || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 4: Support Items */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#3b82f6', fontWeight: 600, fontSize: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '12px' }}>
              4. Support &amp; Action Items
            </h4>
            {viewingReport.supportItems?.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '14px' }}>No support items requested.</p>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ background: '#090d16', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#101726' }}>
                      <th>Item Description</th>
                      <th>Support Type</th>
                      <th>Requested From</th>
                      <th>Urgency</th>
                      <th>Due Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingReport.supportItems.map((s: any) => (
                      <tr key={s.id}>
                        <td>{s.description}</td>
                        <td>{s.supportType}</td>
                        <td>{s.requestedFrom}</td>
                        <td>{s.urgency}</td>
                        <td>{s.dueDate || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 5: Insights */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#a855f7', fontWeight: 600, fontSize: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '12px' }}>
              5. Learned Insights &amp; Suggestions
            </h4>
            {viewingReport.insights?.length === 0 ? (
              <p style={{ color: '#475569', fontSize: '14px' }}>No insights logged.</p>
            ) : (
              <div className="table-responsive">
                <table className="table" style={{ background: '#090d16', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#101726' }}>
                      <th>Insight/Suggestion</th>
                      <th>Category</th>
                      <th>Potential Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {viewingReport.insights.map((ins: any) => (
                      <tr key={ins.id}>
                        <td>{ins.insight}</td>
                        <td>{ins.category}</td>
                        <td>{ins.impact}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Section 6: Additional Notes */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ color: '#94a3b8', fontWeight: 600, fontSize: '16px', borderBottom: '1px solid #1e293b', paddingBottom: '6px', marginBottom: '12px' }}>
              6. Additional Notes/Comments
            </h4>
            <p style={{ background: '#090d16', padding: '12px', borderRadius: '8px', fontSize: '14px', whiteSpace: 'pre-wrap' }}>
              {viewingReport.additionalNotes || 'No additional notes.'}
            </p>
          </div>

          {/* HOD Feedback Box */}
          {viewingReport.reviewNotes && (
            <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
              <h5 style={{ fontWeight: 600, color: '#f59e0b', marginBottom: '6px' }}>HOD / Management Review Notes:</h5>
              <p style={{ fontSize: '14px' }}>{viewingReport.reviewNotes}</p>
            </div>
          )}

          {/* Manager Action Form */}
          {user && ['super_admin', 'admin', 'manager', 'hr_manager', 'team_lead'].includes(user.role) && viewingReport.userId !== user.id && (
            <div style={{ borderTop: '1px solid #1e293b', paddingTop: '20px', marginTop: '20px' }}>
              <h4 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '10px' }}>Submit Review &amp; Evaluation</h4>
              <textarea 
                className="input-textarea"
                placeholder="Enter feedback or modification requests for the employee..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
                rows={3}
                style={{ marginBottom: '12px' }}
              />
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  className="btn-primary-sm" 
                  style={{ background: '#10b981' }}
                  onClick={() => handleReview('approved')}
                  disabled={submittingReview}
                >
                  Approve Report
                </button>
                <button 
                  className="btn-ghost-sm" 
                  style={{ color: '#ef4444', border: '1px solid #ef444420' }}
                  onClick={() => handleReview('needs_revision')}
                  disabled={submittingReview}
                >
                  Request Revision
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* REPORT FORM WORKSPACE EDITOR */}
      {editingReport && (
        <div className="chart-card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #1e293b', paddingBottom: '16px', marginBottom: '20px' }}>
            <div>
              <h2 style={{ fontSize: '20px', fontWeight: 700 }}>
                {editingReport.id ? 'Edit Weekly Report' : 'Draft New Weekly Report'}
              </h2>
              <p style={{ color: '#64748b', fontSize: '13px', marginTop: '4px' }}>
                Prepare your weekly activities, roadblocks, plans, and insights.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <div>
                <select 
                  className="input-select" 
                  style={{ padding: '6px 12px', width: 'auto' }}
                  value={selectedWeek.startDate}
                  disabled={!!editingReport.id} // cannot change week of existing report
                  onChange={e => {
                    const found = weeks.find(w => w.startDate === e.target.value);
                    if (found) setSelectedWeek(found);
                  }}
                >
                  {weeks.map(w => (
                    <option key={w.startDate} value={w.startDate}>{w.label}</option>
                  ))}
                </select>
              </div>
              <button className="btn-ghost-sm" onClick={() => setEditingReport(null)}>Cancel</button>
            </div>
          </div>

          {/* Table 1: Activities */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#6366f1' }}>1. Weekly Activities Overview</h3>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="btn-ghost-sm" onClick={handleAutoPopulate} style={{ fontSize: '12px' }}>
                  🔄 Auto-populate from Tasks
                </button>
                <button className="btn-primary-sm" onClick={addActivity} style={{ fontSize: '12px' }}>
                  + Add Row
                </button>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th style={{ width: '30%' }}>Activity/Task Name</th>
                    <th style={{ width: '15%' }}>Type</th>
                    <th style={{ width: '15%' }}>Status</th>
                    <th style={{ width: '25%' }}>Impact Description</th>
                    <th style={{ width: '8%' }}>Hours</th>
                    <th style={{ width: '12%' }}>Link</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act, idx) => (
                    <tr key={idx}>
                      <td>
                        <input className="input-field" style={{ padding: '6px' }} value={act.taskName} onChange={e => updateActivity(idx, 'taskName', e.target.value)} placeholder="Task Title" />
                      </td>
                      <td>
                        <input className="input-field" style={{ padding: '6px' }} value={act.type} onChange={e => updateActivity(idx, 'type', e.target.value)} placeholder="Development" />
                      </td>
                      <td>
                        <select className="input-select" style={{ padding: '6px' }} value={act.status} onChange={e => updateActivity(idx, 'status', e.target.value)}>
                          <option value="Completed">Completed</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Pending">Pending</option>
                          <option value="Blocked">Blocked</option>
                        </select>
                      </td>
                      <td>
                        <input className="input-field" style={{ padding: '6px' }} value={act.impact} onChange={e => updateActivity(idx, 'impact', e.target.value)} placeholder="Outcome or impact" />
                      </td>
                      <td>
                        <input className="input-field" type="number" step="0.5" style={{ padding: '6px' }} value={act.hoursSpent} onChange={e => updateActivity(idx, 'hoursSpent', parseFloat(e.target.value) || 0)} />
                      </td>
                      <td>
                        <input className="input-field" style={{ padding: '6px' }} value={act.links} onChange={e => updateActivity(idx, 'links', e.target.value)} placeholder="URL link" />
                      </td>
                      <td>
                        <button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => removeActivity(idx)}>❌</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {activities.length === 0 && (
                <div style={{ textAlign: 'center', padding: '16px', color: '#475569', fontSize: '13px' }}>
                  No activities. Click "Auto-populate from Tasks" or add rows manually.
                </div>
              )}
            </div>
          </div>

          {/* Table 2: Challenges */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#f59e0b' }}>2. Challenges &amp; Roadblocks</h3>
              <button className="btn-primary-sm" onClick={addRoadblock} style={{ fontSize: '12px' }}>+ Add Row</button>
            </div>
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Challenge Description</th>
                    <th>Impact on Progress</th>
                    <th>Mitigation Strategy</th>
                    <th>Support Required</th>
                    <th>Responsible</th>
                    <th>Deadline</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {roadblocks.map((rb, idx) => (
                    <tr key={idx}>
                      <td><input className="input-field" style={{ padding: '6px' }} value={rb.challenge} onChange={e => updateRoadblock(idx, 'challenge', e.target.value)} placeholder="Describe challenge" /></td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={rb.impact} onChange={e => updateRoadblock(idx, 'impact', e.target.value)} placeholder="Timeline impact" /></td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={rb.mitigation} onChange={e => updateRoadblock(idx, 'mitigation', e.target.value)} placeholder="Workaround" /></td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={rb.supportRequired} onChange={e => updateRoadblock(idx, 'supportRequired', e.target.value)} placeholder="Guidance/Resources" /></td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={rb.responsibleParty} onChange={e => updateRoadblock(idx, 'responsibleParty', e.target.value)} placeholder="Responsible HOD" /></td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={rb.deadline} onChange={e => updateRoadblock(idx, 'deadline', e.target.value)} placeholder="YYYY-MM-DD" /></td>
                      <td><button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => removeRoadblock(idx)}>❌</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {roadblocks.length === 0 && <div style={{ textAlign: 'center', padding: '12px', color: '#475569', fontSize: '13px' }}>No roadblock entries.</div>}
            </div>
          </div>

          {/* Table 3: Plans */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#10b981' }}>3. Upcoming Plans (Next Reporting Period)</h3>
              <button className="btn-primary-sm" onClick={addPlan} style={{ fontSize: '12px' }}>+ Add Row</button>
            </div>
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Planned Activity/Task</th>
                    <th>Type</th>
                    <th>Scope</th>
                    <th>Expected Deliverables</th>
                    <th>Target Date</th>
                    <th>Dependencies</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((pl, idx) => (
                    <tr key={idx}>
                      <td><input className="input-field" style={{ padding: '6px' }} value={pl.plannedActivity} onChange={e => updatePlan(idx, 'plannedActivity', e.target.value)} placeholder="Objectives" /></td>
                      <td>
                        <select className="input-select" style={{ padding: '6px' }} value={pl.typeAssigned} onChange={e => updatePlan(idx, 'typeAssigned', e.target.value)}>
                          <option value="Assigned">Assigned</option>
                          <option value="Self-Motivated">Self-Motivated</option>
                        </select>
                      </td>
                      <td>
                        <select className="input-select" style={{ padding: '6px' }} value={pl.typeScope} onChange={e => updatePlan(idx, 'typeScope', e.target.value)}>
                          <option value="Departmental">Departmental</option>
                          <option value="Cross-Departmental">Cross-Departmental</option>
                        </select>
                      </td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={pl.deliverables} onChange={e => updatePlan(idx, 'deliverables', e.target.value)} placeholder="Deliverables" /></td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={pl.targetDate} onChange={e => updatePlan(idx, 'targetDate', e.target.value)} placeholder="YYYY-MM-DD" /></td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={pl.dependencies} onChange={e => updatePlan(idx, 'dependencies', e.target.value)} placeholder="Dependencies" /></td>
                      <td><button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => removePlan(idx)}>❌</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {plans.length === 0 && <div style={{ textAlign: 'center', padding: '12px', color: '#475569', fontSize: '13px' }}>No upcoming plans entries.</div>}
            </div>
          </div>

          {/* Table 4: Support Items */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#3b82f6' }}>4. Support &amp; Action Items Needed</h3>
              <button className="btn-primary-sm" onClick={addSupportItem} style={{ fontSize: '12px' }}>+ Add Row</button>
            </div>
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Item Description</th>
                    <th>Support Type</th>
                    <th>Requested From</th>
                    <th>Urgency</th>
                    <th>Due Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {supportItems.map((s, idx) => (
                    <tr key={idx}>
                      <td><input className="input-field" style={{ padding: '6px' }} value={s.description} onChange={e => updateSupportItem(idx, 'description', e.target.value)} placeholder="Describe request" /></td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={s.supportType} onChange={e => updateSupportItem(idx, 'supportType', e.target.value)} placeholder="Decision / Resources" /></td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={s.requestedFrom} onChange={e => updateSupportItem(idx, 'requestedFrom', e.target.value)} placeholder="HOD or Admin" /></td>
                      <td>
                        <select className="input-select" style={{ padding: '6px' }} value={s.urgency} onChange={e => updateSupportItem(idx, 'urgency', e.target.value)}>
                          <option value="High">High</option>
                          <option value="Medium">Medium</option>
                          <option value="Low">Low</option>
                        </select>
                      </td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={s.dueDate} onChange={e => updateSupportItem(idx, 'dueDate', e.target.value)} placeholder="YYYY-MM-DD" /></td>
                      <td><button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => removeSupportItem(idx)}>❌</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {supportItems.length === 0 && <div style={{ textAlign: 'center', padding: '12px', color: '#475569', fontSize: '13px' }}>No support requests entries.</div>}
            </div>
          </div>

          {/* Table 5: Insights */}
          <div style={{ marginBottom: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#a855f7' }}>5. Learned Insights &amp; Suggestions</h3>
              <button className="btn-primary-sm" onClick={addInsight} style={{ fontSize: '12px' }}>+ Add Row</button>
            </div>
            <div className="table-responsive">
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Insight/Suggestion</th>
                    <th>Category</th>
                    <th>Potential Impact</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {insights.map((ins, idx) => (
                    <tr key={idx}>
                      <td><input className="input-field" style={{ padding: '6px' }} value={ins.insight} onChange={e => updateInsight(idx, 'insight', e.target.value)} placeholder="Key lesson" /></td>
                      <td>
                        <select className="input-select" style={{ padding: '6px' }} value={ins.category} onChange={e => updateInsight(idx, 'category', e.target.value)}>
                          <option value="Process">Process</option>
                          <option value="Technical">Technical</option>
                          <option value="Team">Team</option>
                          <option value="Tooling">Tooling</option>
                        </select>
                      </td>
                      <td><input className="input-field" style={{ padding: '6px' }} value={ins.impact} onChange={e => updateInsight(idx, 'impact', e.target.value)} placeholder="Improvement result" /></td>
                      <td><button style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }} onClick={() => removeInsight(idx)}>❌</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {insights.length === 0 && <div style={{ textAlign: 'center', padding: '12px', color: '#475569', fontSize: '13px' }}>No insights entries.</div>}
            </div>
          </div>

          {/* Additional Notes Textarea */}
          <div style={{ marginBottom: '30px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#94a3b8', marginBottom: '10px' }}>6. Additional Notes/Comments</h3>
            <textarea 
              className="input-textarea"
              placeholder="Any other comments or summary text..."
              value={additionalNotes}
              onChange={e => setAdditionalNotes(e.target.value)}
              rows={4}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', borderTop: '1px solid #1e293b', paddingTop: '20px' }}>
            <button className="btn-ghost-sm" onClick={() => setEditingReport(null)}>Cancel</button>
            <button className="btn-ghost-sm" style={{ border: '1px solid #6366f160', color: '#6366f1' }} onClick={() => saveReport(false)}>Save Draft</button>
            <button className="btn-primary-sm" onClick={() => saveReport(true)}>Submit Weekly Report</button>
          </div>
        </div>
      )}
    </div>
  );
}
