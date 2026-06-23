'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  PieChart, Pie, Cell, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { financeApi } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import KpiCard from '@/components/KpiCard';
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Receipt,
  Calendar,
  Search,
  Plus,
  Check,
  X,
  AlertTriangle,
  FileSpreadsheet,
  Download,
  Building,
  CreditCard,
  ArrowUpRight,
  CheckCircle,
  FileText
} from 'lucide-react';

type Tab = 'dashboard' | 'expenses' | 'budgets' | 'payroll';

const CATEGORIES = ['salary', 'operations', 'equipment', 'travel', 'other'];

const TOOLTIP_STYLE = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-strong)',
  borderRadius: '8px',
  color: 'var(--text-1)',
  padding: '10px 14px',
  fontSize: '12px',
};

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color || 'var(--text-1)' }}>
          {p.name}: <strong>GHS {Number(p.value).toLocaleString()}</strong>
        </p>
      ))}
    </div>
  );
}

export default function FinancePage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  // Dynamic current period (YYYY-MM)
  const currentPeriodStr = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }, []);

  // Filter States
  const [periodFilter, setPeriodFilter] = useState(currentPeriodStr);
  const [expenseSearch, setExpenseSearch] = useState('');
  const [expenseStatusFilter, setExpenseStatusFilter] = useState('all');
  const [expenseCategoryFilter, setExpenseCategoryFilter] = useState('all');

  // Modal States
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isAdjustBudgetModalOpen, setIsAdjustBudgetModalOpen] = useState(false);

  // Form States
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    amount: '',
    category: 'operations',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    receiptUrl: ''
  });

  const [budgetForm, setBudgetForm] = useState({
    name: '',
    amount: '',
    category: 'operations',
    period: currentPeriodStr
  });

  const [adjustBudgetForm, setAdjustBudgetForm] = useState({
    id: '',
    name: '',
    amount: '',
    spent: ''
  });

  // Verify access permissions
  const isFinance = useMemo(() => {
    if (!user) return false;
    if (['super_admin', 'admin', 'finance_manager'].includes(user.role)) return true;
    const dept = (typeof user.department === 'string' ? user.department : (user.department as any)?.name || '').toLowerCase();
    return dept.includes('finance');
  }, [user]);

  // Queries
  const { data: dashboard, isLoading: dashboardLoading } = useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: () => financeApi.getDashboard(),
    enabled: isFinance
  });

  const { data: expenses = [], isLoading: expensesLoading } = useQuery({
    queryKey: ['finance-expenses', expenseStatusFilter, expenseCategoryFilter],
    queryFn: () => {
      const params: any = {};
      if (expenseStatusFilter !== 'all') params.status = expenseStatusFilter;
      if (expenseCategoryFilter !== 'all') params.category = expenseCategoryFilter;
      return financeApi.listExpenses(params);
    },
    enabled: isFinance
  });

  const { data: budgets = [], isLoading: budgetsLoading } = useQuery({
    queryKey: ['finance-budgets', periodFilter],
    queryFn: () => financeApi.listBudgets({ period: periodFilter }),
    enabled: isFinance
  });

  const { data: payrollSummary = [], isLoading: payrollLoading } = useQuery({
    queryKey: ['finance-payroll', periodFilter],
    queryFn: () => financeApi.getPayrollSummary({ period: periodFilter }),
    enabled: isFinance
  });

  // Mutations
  const submitExpenseMutation = useMutation({
    mutationFn: (data: typeof expenseForm) => financeApi.submitExpense(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      setIsExpenseModalOpen(false);
      setExpenseForm({
        title: '',
        amount: '',
        category: 'operations',
        date: new Date().toISOString().split('T')[0],
        notes: '',
        receiptUrl: ''
      });
    }
  });

  const updateExpenseStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      financeApi.approveExpense(id, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-expenses'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['finance-budgets'] });
    }
  });

  const createBudgetMutation = useMutation({
    mutationFn: (data: typeof budgetForm) => financeApi.createBudget(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      setIsBudgetModalOpen(false);
      setBudgetForm({
        name: '',
        amount: '',
        category: 'operations',
        period: currentPeriodStr
      });
    }
  });

  const updateBudgetMutation = useMutation({
    mutationFn: ({ id, name, amount, spent }: { id: string; name: string; amount: number; spent: number }) =>
      financeApi.updateBudget(id, { name, amount, spent }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      setIsAdjustBudgetModalOpen(false);
    }
  });

  // Local calculations
  const filteredExpenses = useMemo(() => {
    if (!expenseSearch) return expenses;
    return expenses.filter((e: any) =>
      e.title.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.userName.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      e.category.toLowerCase().includes(expenseSearch.toLowerCase())
    );
  }, [expenses, expenseSearch]);

  const payrollTotals = useMemo(() => {
    const totalNetPay = payrollSummary.reduce((sum: number, p: any) => sum + p.netPay, 0);
    const avgSalary = payrollSummary.length > 0 ? totalNetPay / payrollSummary.length : 0;
    const totalDeductions = payrollSummary.reduce((sum: number, p: any) => {
      const dailyRate = p.baseSalary / 22;
      return sum + (p.daysAbsent * dailyRate);
    }, 0);

    return {
      totalNetPay: Math.round(totalNetPay * 100) / 100,
      avgSalary: Math.round(avgSalary * 100) / 100,
      totalDeductions: Math.round(totalDeductions * 100) / 100
    };
  }, [payrollSummary]);

  // CSV Export utility
  const handleExportCsv = () => {
    if (!payrollSummary || payrollSummary.length === 0) return;
    const headers = ['Employee Name', 'Email', 'Department', 'Employment Type', 'Base Salary (GHS)', 'Days Worked', 'Days Absent', 'Net Pay (GHS)'];
    const rows = payrollSummary.map((item: any) => [
      item.name,
      item.email,
      item.department,
      item.employmentType,
      item.baseSalary,
      item.daysWorked,
      item.daysAbsent,
      item.netPay
    ]);
    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(','), ...rows.map((e: any[]) => e.map((val: any) => `"${val}"`).join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `payroll_summary_${periodFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isFinance) {
    return (
      <div className="page-content flex flex-col items-center justify-center min-h-[60vh] text-center">
        <AlertTriangle size={48} className="text-red-500 mb-4" />
        <h2 className="text-red-500 text-lg font-bold mb-2">Access Restricted</h2>
        <p className="text-[var(--text-3)] text-sm mb-4">You do not have the required permissions to view the Finance dashboard.</p>
        <Link href="/dashboard" className="btn-primary">Go to Dashboard</Link>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="page-title text-2xl font-bold text-[var(--text-1)] flex items-center gap-2">
            <Wallet className="text-[var(--accent)]" size={24} />
            Finance Manager
          </h1>
          <p className="page-subtitle text-xs text-[var(--text-3)] mt-1">
            Allocate monthly budgets, approve employee expenses, and track payroll deductions.
          </p>
        </div>

        {/* Tab switchers */}
        <div className="tab-switcher overflow-x-auto max-w-full hide-scrollbar">
          {(['dashboard', 'expenses', 'budgets', 'payroll'] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`capitalize ${activeTab === tab ? 'active' : ''}`}
            >
              {tab === 'dashboard' ? 'Dashboard' : tab === 'expenses' ? 'Expenses' : tab === 'budgets' ? 'Budgets' : 'Payroll'}
            </button>
          ))}
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'dashboard' && (
        <div className="space-y-6">
          {dashboardLoading ? (
            <div className="text-center py-10 text-[var(--text-3)]">Loading Finance Stats...</div>
          ) : (
            <>
              {/* KPIs Row */}
              <div className="kpi-grid-4">
                <KpiCard
                  label="Allocated Budget"
                  value={`GHS ${(dashboard?.totalBudget ?? 0).toLocaleString()}`}
                  icon={Wallet}
                  iconBg="var(--blue-soft)"
                  iconColor="var(--blue)"
                />
                <KpiCard
                  label="Total Spent"
                  value={`GHS ${(dashboard?.totalSpent ?? 0).toLocaleString()}`}
                  icon={TrendingUp}
                  iconBg="var(--accent-soft)"
                  iconColor="var(--accent)"
                  subValue={`${dashboard?.totalBudget > 0 ? Math.round((dashboard.totalSpent / dashboard.totalBudget) * 100) : 0}%`}
                  subLabel="budget utilization"
                  subColor={(dashboard?.totalSpent ?? 0) <= (dashboard?.totalBudget ?? 0) ? 'var(--green)' : 'var(--red)'}
                />
                <KpiCard
                  label="Remaining Balance"
                  value={`GHS ${(dashboard?.remaining ?? 0).toLocaleString()}`}
                  icon={DollarSign}
                  iconBg="var(--green-soft)"
                  iconColor="var(--green)"
                />
                <KpiCard
                  label="Pending Approvals"
                  value={dashboard?.pendingApprovalsCount ?? 0}
                  icon={Receipt}
                  iconBg="var(--yellow-soft)"
                  iconColor="var(--yellow)"
                  subValue={dashboard?.expenseCountThisMonth ?? 0}
                  subLabel="approved this month"
                />
              </div>

              {/* Charts & Budgets Progress */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* 6-Month Spending Trend AreaChart */}
                <div className="card lg:col-span-2">
                  <h3 className="section-title mb-4">6-Month Spending Trend</h3>
                  <div className="w-full h-[240px]">
                    {dashboard?.monthlySpendingTrend?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 100, height: 100 }}>
                        <AreaChart data={dashboard.monthlySpendingTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="var(--accent)" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="var(--accent)" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                          <XAxis dataKey="name" stroke="var(--text-3)" fontSize={11} tickLine={false} />
                          <YAxis stroke="var(--text-3)" fontSize={11} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="value" name="Amount Spent" stroke="var(--accent)" strokeWidth={2} fillOpacity={1} fill="url(#colorSpent)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-[var(--text-3)] text-xs py-10">No historical data available</p>
                    )}
                  </div>
                </div>

                {/* Expenses by Category Pie Chart */}
                <div className="card">
                  <h3 className="section-title mb-4">Expenses by Category</h3>
                  <div className="w-full h-[160px] relative flex items-center justify-center">
                    {dashboard?.expensesByCategory?.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 100, height: 100 }}>
                        <PieChart>
                          <Pie
                            data={dashboard.expensesByCategory}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {dashboard.expensesByCategory.map((entry: any, index: number) => {
                              const colors = ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--teal)'];
                              return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />;
                            })}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <p className="text-center text-[var(--text-3)] text-xs py-10 font-medium">No expenditures logged</p>
                    )}
                  </div>
                  {/* Legend */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-3 border-t border-[var(--border)] mt-4">
                    {dashboard?.expensesByCategory?.map((item: any, i: number) => {
                      const colors = ['var(--accent)', 'var(--blue)', 'var(--green)', 'var(--purple)', 'var(--teal)'];
                      return (
                        <div key={item.name} className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full block" style={{ background: colors[i % colors.length] }} />
                          <span className="text-[var(--text-2)] truncate capitalize">
                            {item.name}: <strong className="text-[var(--text-1)]">GHS {item.value.toLocaleString()}</strong>
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Lower Section: Budget Allocation list */}
              <div className="card">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="section-title">Department & Category Budget Utilizations</h3>
                  <button
                    onClick={() => setActiveTab('budgets')}
                    className="text-xs font-semibold text-[var(--accent)] hover:underline"
                  >
                    Manage Budgets &rarr;
                  </button>
                </div>
                <div className="space-y-4">
                  {dashboard?.budgetsData?.map((budget: any) => {
                    // color-code bar based on percentage
                    const barColor = budget.pct > 90 ? 'bg-red-500' : budget.pct > 75 ? 'bg-amber-500' : 'bg-[var(--accent)]';
                    return (
                      <div key={budget.id} className="space-y-1.5">
                        <div className="flex justify-between items-center text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[var(--text-1)] capitalize">{budget.name}</span>
                            <span className="text-[var(--text-3)]">({budget.pct}% utilized)</span>
                          </div>
                          <div className="text-[var(--text-2)] font-mono">
                            GHS {budget.spent.toLocaleString()} / <strong className="text-[var(--text-1)]">GHS {budget.allocated.toLocaleString()}</strong>
                          </div>
                        </div>
                        <div className="w-full h-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-full overflow-hidden">
                          <div
                            className={`h-full ${barColor} transition-all duration-500`}
                            style={{ width: `${Math.min(100, budget.pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                  {(!dashboard?.budgetsData || dashboard.budgetsData.length === 0) && (
                    <p className="text-center text-xs text-[var(--text-3)] py-6">No active budgets allocated for this period.</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-3 items-center w-full md:w-auto">
              {/* Search */}
              <div className="control-compact w-full sm:w-64">
                <Search size={16} className="text-[var(--text-3)] flex-shrink-0" />
                <input
                  type="text"
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  placeholder="Search expense name, owner..."
                />
              </div>

              {/* Status filter */}
              <div className="control-compact w-full sm:w-36">
                <select
                  value={expenseStatusFilter}
                  onChange={(e) => setExpenseStatusFilter(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="paid">Paid</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>

              {/* Category filter */}
              <div className="control-compact w-full sm:w-36">
                <select
                  value={expenseCategoryFilter}
                  onChange={(e) => setExpenseCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="w-full md:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold h-[38px] px-5 rounded-[10px] text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <Plus size={16} /> Submit Expense Claims
            </button>
          </div>

          {/* Expenses Table */}
          {expensesLoading ? (
            <div className="text-center py-10 text-[var(--text-3)]">Loading Expenses Ledger...</div>
          ) : (
            <div className="card">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-[10px] uppercase font-semibold">
                      <th className="py-2.5">Expense Item</th>
                      <th className="py-2.5">Category</th>
                      <th className="py-2.5">Submitted By</th>
                      <th className="py-2.5">Date</th>
                      <th className="py-2.5">Amount</th>
                      <th className="py-2.5">Status</th>
                      <th className="py-2.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredExpenses.map((exp: any) => {
                      let statusBadge = 'badge-yellow';
                      if (exp.status === 'approved') statusBadge = 'badge-blue';
                      if (exp.status === 'paid') statusBadge = 'badge-green';
                      if (exp.status === 'rejected') statusBadge = 'badge-red';

                      return (
                        <tr key={exp.id} className="hover:bg-[var(--bg-hover)]/10 transition-colors">
                          <td className="py-3">
                            <div className="font-semibold text-[var(--text-1)]">{exp.title}</div>
                            {exp.notes && <div className="text-[10px] text-[var(--text-3)] mt-0.5">{exp.notes}</div>}
                          </td>
                          <td className="py-3 capitalize text-[var(--text-2)]">{exp.category}</td>
                          <td className="py-3">
                            <div className="text-[var(--text-1)]">{exp.userName}</div>
                            <div className="text-[10px] text-[var(--text-3)]">{exp.userEmail}</div>
                          </td>
                          <td className="py-3 text-[var(--text-2)] font-mono">{exp.date}</td>
                          <td className="py-3 text-[var(--text-1)] font-semibold font-mono">
                            GHS {exp.amount.toLocaleString()}
                          </td>
                          <td className="py-3">
                            <span className={`badge ${statusBadge} uppercase text-[9px] font-bold`}>
                              {exp.status}
                            </span>
                          </td>
                          <td className="py-3 text-right space-x-1">
                            {/* Receipt button if URL exists */}
                            {exp.receiptUrl && (
                              <a
                                href={exp.receiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded text-[var(--text-2)] hover:text-[var(--text-1)] font-semibold transition-colors"
                              >
                                <FileText size={10} /> Receipt
                              </a>
                            )}
                            
                            {/* Manager status triggers */}
                            {exp.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => updateExpenseStatusMutation.mutate({ id: exp.id, status: 'rejected' })}
                                  className="px-2 py-1 bg-red-500/10 hover:bg-red-500/25 text-red-500 rounded font-semibold transition-colors"
                                >
                                  Reject
                                </button>
                                <button
                                  onClick={() => updateExpenseStatusMutation.mutate({ id: exp.id, status: 'approved' })}
                                  className="px-2 py-1 bg-[var(--green-soft)] hover:bg-emerald-500/25 text-[var(--green)] rounded font-semibold transition-colors"
                                >
                                  Approve
                                </button>
                              </>
                            )}
                            {exp.status === 'approved' && (
                              <button
                                onClick={() => updateExpenseStatusMutation.mutate({ id: exp.id, status: 'paid' })}
                                className="px-2 py-1 bg-blue-500/10 hover:bg-blue-500/25 text-blue-500 rounded font-semibold transition-colors flex items-center gap-1 inline-flex"
                              >
                                <Check size={10} /> Mark Paid
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                    {filteredExpenses.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-[var(--text-3)]">No expense logs found matching criteria.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'budgets' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--text-2)] font-semibold">Select Budget Period:</label>
              <div className="control-compact">
                <input
                  type="month"
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={() => setIsBudgetModalOpen(true)}
              className="w-full sm:w-auto bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold h-[38px] px-5 rounded-[10px] text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap flex-shrink-0"
            >
              <Plus size={16} /> Allocate Category Budget
            </button>
          </div>

          {/* Budgets Grid */}
          {budgetsLoading ? (
            <div className="text-center py-10 text-[var(--text-3)]">Loading budgets...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {budgets.map((b: any) => {
                const pct = b.amount > 0 ? Math.round((b.spent / b.amount) * 100) : 0;
                const barColor = pct > 90 ? 'bg-red-500' : pct > 75 ? 'bg-amber-500' : 'bg-[var(--accent)]';
                const remaining = b.amount - b.spent;

                return (
                  <div key={b.id} className="card flex flex-col justify-between space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="badge badge-blue capitalize mb-2 inline-block text-[9px] font-bold">{b.category}</span>
                        <h4 className="text-sm font-extrabold text-[var(--text-1)]">{b.name}</h4>
                        <span className="text-[10px] text-[var(--text-3)] uppercase tracking-wider">{b.period}</span>
                      </div>
                      <button
                        onClick={() => {
                          setAdjustBudgetForm({ id: b.id, name: b.name, amount: String(b.amount), spent: String(b.spent) });
                          setIsAdjustBudgetModalOpen(true);
                        }}
                        className="text-xs font-semibold text-[var(--accent)] hover:underline"
                      >
                        Adjust
                      </button>
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-[var(--text-3)]">Spent ({pct}%)</span>
                        <span className="text-[var(--text-1)] font-semibold font-mono">GHS {b.spent.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2 bg-[var(--bg-surface-2)] border border-[var(--border)] rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} transition-all duration-300`} style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-[var(--text-3)] pt-1">
                        <span>Allocated: GHS {b.amount.toLocaleString()}</span>
                        <span className={remaining < 0 ? 'text-red-400 font-bold' : 'text-emerald-400 font-semibold'}>
                          {remaining < 0 ? `Over by GHS ${Math.abs(remaining).toLocaleString()}` : `Remaining: GHS ${remaining.toLocaleString()}`}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {budgets.length === 0 && (
                <div className="col-span-full card text-center py-10 text-[var(--text-3)]">
                  No budgets allocated for the period <strong className="text-[var(--text-1)]">{periodFilter}</strong>. Click above to allocate.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {activeTab === 'payroll' && (
        <div className="space-y-6">
          {/* Action Bar */}
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <label className="text-xs text-[var(--text-2)] font-semibold">Payroll Month:</label>
              <div className="control-compact">
                <input
                  type="month"
                  value={periodFilter}
                  onChange={(e) => setPeriodFilter(e.target.value)}
                />
              </div>
            </div>

            <button
              onClick={handleExportCsv}
              disabled={payrollSummary.length === 0}
              className="w-full sm:w-auto bg-[var(--green-soft)] hover:bg-[var(--green-soft)]/20 text-[var(--green)] font-bold h-[38px] px-5 rounded-[10px] text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[var(--border)] whitespace-nowrap flex-shrink-0"
            >
              <Download size={16} /> Export Payroll CSV
            </button>
          </div>

          {/* Payroll KPI Overview */}
          {payrollLoading ? (
            <div className="text-center py-10 text-[var(--text-3)]">Recalculating Payroll...</div>
          ) : (
            <>
              <div className="kpi-grid-3">
                <KpiCard
                  label="Estimated Total Payroll"
                  value={`GHS ${payrollTotals.totalNetPay.toLocaleString()}`}
                  icon={CreditCard}
                  iconBg="var(--blue-soft)"
                  iconColor="var(--blue)"
                />
                <KpiCard
                  label="Average Salary Paid"
                  value={`GHS ${payrollTotals.avgSalary.toLocaleString()}`}
                  icon={Building}
                  iconBg="var(--purple-soft)"
                  iconColor="var(--purple)"
                />
                <KpiCard
                  label="Total Absentee Deductions"
                  value={`GHS ${payrollTotals.totalDeductions.toLocaleString()}`}
                  icon={AlertTriangle}
                  iconBg="var(--red-soft)"
                  iconColor="var(--red)"
                />
              </div>

              {/* Payroll Details Table */}
              <div className="card">
                <h3 className="section-title mb-4">Employee Salaries Ledger ({periodFilter})</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] text-[var(--text-3)] text-[10px] uppercase font-semibold">
                        <th className="py-2.5">Employee</th>
                        <th className="py-2.5">Department</th>
                        <th className="py-2.5">Employment Type</th>
                        <th className="py-2.5">Base Salary</th>
                        <th className="py-2.5 text-center">Days Worked</th>
                        <th className="py-2.5 text-center">Days Absent</th>
                        <th className="py-2.5 text-right">Net Payable Pay</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {payrollSummary.map((p: any) => {
                        const dailyRate = p.baseSalary / 22;
                        const deduction = p.daysAbsent * dailyRate;
                        return (
                          <tr key={p.userId} className="hover:bg-[var(--bg-hover)]/10 transition-colors">
                            <td className="py-3">
                              <div className="font-semibold text-[var(--text-1)]">{p.name}</div>
                              <div className="text-[10px] text-[var(--text-3)]">{p.email}</div>
                            </td>
                            <td className="py-3 text-[var(--text-2)]">{p.department}</td>
                            <td className="py-3 text-[var(--text-2)] capitalize">{p.employmentType}</td>
                            <td className="py-3 text-[var(--text-2)] font-mono">GHS {p.baseSalary.toLocaleString()}</td>
                            <td className="py-3 text-center text-[var(--text-2)] font-mono">{p.daysWorked}</td>
                            <td className="py-3 text-center text-[var(--text-2)] font-mono">
                              {p.daysAbsent > 0 ? (
                                <span className="text-red-400 font-bold" title={`Deducted GHS ${deduction.toFixed(2)}`}>
                                  {p.daysAbsent} (-GHS {Math.round(deduction)})
                                </span>
                              ) : (
                                <span className="text-[var(--text-3)]">0</span>
                              )}
                            </td>
                            <td className="py-3 text-right font-bold text-emerald-400 font-mono">
                              GHS {p.netPay.toLocaleString()}
                            </td>
                          </tr>
                        );
                      })}
                      {payrollSummary.length === 0 && (
                        <tr>
                          <td colSpan={7} className="text-center py-8 text-[var(--text-3)]">No payroll summary available.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* --- MODALS --- */}

      {/* Expense Modal */}
      {isExpenseModalOpen && (
        <div className="modal-overlay" onClick={() => setIsExpenseModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="text-md font-extrabold text-[var(--text-1)] uppercase tracking-wide">Submit Expense Claim</h3>
              <button className="modal-close" onClick={() => setIsExpenseModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                submitExpenseMutation.mutate(expenseForm);
              }}
              style={{ display: 'contents' }}
            >
              <div className="modal-body text-xs">
                <div className="form-group">
                  <label className="form-label font-bold uppercase">Title / Item name</label>
                  <input
                    type="text"
                    required
                    value={expenseForm.title}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Server hosting, Office monitor"
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label font-bold uppercase">Amount (GHS)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="250.00"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label font-bold uppercase">Category</label>
                    <select
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, category: e.target.value }))}
                      className="form-input form-select"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label font-bold uppercase">Date</label>
                    <input
                      type="date"
                      required
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, date: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label font-bold uppercase">Receipt URL (optional)</label>
                    <input
                      type="url"
                      value={expenseForm.receiptUrl}
                      onChange={(e) => setExpenseForm(prev => ({ ...prev, receiptUrl: e.target.value }))}
                      placeholder="https://imgur.com/xyz.png"
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label font-bold uppercase">Claims Description / Notes</label>
                  <textarea
                    value={expenseForm.notes}
                    onChange={(e) => setExpenseForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Details of expense..."
                    rows={3}
                    className="form-input"
                    style={{ minHeight: '80px', resize: 'vertical' }}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsExpenseModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitExpenseMutation.isPending}
                  className="btn-primary"
                  style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
                >
                  {submitExpenseMutation.isPending ? 'Submitting...' : 'Submit Claim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {/* Create Budget Modal */}
      {isBudgetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsBudgetModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="text-md font-extrabold text-[var(--text-1)] uppercase tracking-wide">Allocate Category Budget</h3>
              <button className="modal-close" onClick={() => setIsBudgetModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createBudgetMutation.mutate(budgetForm);
              }}
              style={{ display: 'contents' }}
            >
              <div className="modal-body text-xs">
                <div className="form-group">
                  <label className="form-label font-bold uppercase">Budget Name</label>
                  <input
                    type="text"
                    required
                    value={budgetForm.name}
                    onChange={(e) => setBudgetForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Operations Q3, Travel Allowance"
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label font-bold uppercase">Amount (GHS)</label>
                    <input
                      type="number"
                      required
                      value={budgetForm.amount}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="10000"
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label font-bold uppercase">Category</label>
                    <select
                      value={budgetForm.category}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, category: e.target.value }))}
                      className="form-input form-select"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label font-bold uppercase">Period (YYYY-MM)</label>
                  <input
                    type="month"
                    required
                    value={budgetForm.period}
                    onChange={(e) => setBudgetForm(prev => ({ ...prev, period: e.target.value }))}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsBudgetModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBudgetMutation.isPending}
                  className="btn-primary"
                  style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
                >
                  {createBudgetMutation.isPending ? 'Allocating...' : 'Allocate Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
 
      {/* Adjust Budget Modal */}
      {isAdjustBudgetModalOpen && (
        <div className="modal-overlay" onClick={() => setIsAdjustBudgetModalOpen(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="text-md font-extrabold text-[var(--text-1)] uppercase tracking-wide">Adjust Budget Allocation</h3>
              <button className="modal-close" onClick={() => setIsAdjustBudgetModalOpen(false)}>
                <X size={18} />
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                updateBudgetMutation.mutate({
                  id: adjustBudgetForm.id,
                  name: adjustBudgetForm.name,
                  amount: parseFloat(adjustBudgetForm.amount),
                  spent: parseFloat(adjustBudgetForm.spent)
                });
              }}
              style={{ display: 'contents' }}
            >
              <div className="modal-body text-xs">
                <div className="form-group">
                  <label className="form-label font-bold uppercase">Budget Name</label>
                  <input
                    type="text"
                    required
                    value={adjustBudgetForm.name}
                    onChange={(e) => setAdjustBudgetForm(prev => ({ ...prev, name: e.target.value }))}
                    className="form-input"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label font-bold uppercase">Allocated Amount (GHS)</label>
                    <input
                      type="number"
                      required
                      value={adjustBudgetForm.amount}
                      onChange={(e) => setAdjustBudgetForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label font-bold uppercase">Spent (GHS)</label>
                    <input
                      type="number"
                      required
                      value={adjustBudgetForm.spent}
                      onChange={(e) => setAdjustBudgetForm(prev => ({ ...prev, spent: e.target.value }))}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setIsAdjustBudgetModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateBudgetMutation.isPending}
                  className="btn-primary"
                  style={{ background: 'var(--accent)', borderColor: 'var(--accent)' }}
                >
                  {updateBudgetMutation.isPending ? 'Updating...' : 'Update Budget'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
