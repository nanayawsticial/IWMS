export type Role = 'super_admin' | 'admin' | 'hr_manager' | 'manager' | 'team_lead' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  department: string;
  position: string;
  avatar: string;
  status: 'active' | 'inactive';
  joinDate: string;
  phone: string;
}

export interface AttendanceRecord {
  id: string;
  userId: string;
  date: string;
  clockIn: string | null;
  clockOut: string | null;
  status: 'present' | 'absent' | 'late' | 'half_day' | 'on_leave';
  method: 'biometric' | 'web' | 'mobile' | 'qr';
  location?: { lat: number; lng: number };
  hoursWorked?: number;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  assigneeName: string;
  assigneeAvatar: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  dueDate: string;
  createdAt: string;
  tags: string[];
  projectId: string;
  projectName: string;
  estimatedHours: number;
  loggedHours: number;
}

export interface Department {
  id: string;
  name: string;
  managerId: string;
  managerName: string;
  headcount: number;
  color: string;
}

export const DEPARTMENTS: Department[] = [
  { id: 'd1', name: 'Engineering', managerId: 'u2', managerName: 'Sarah Johnson', headcount: 24, color: '#6366f1' },
  { id: 'd2', name: 'Product', managerId: 'u3', managerName: 'Michael Chen', headcount: 8, color: '#8b5cf6' },
  { id: 'd3', name: 'Design', managerId: 'u4', managerName: 'Emma Davis', headcount: 6, color: '#ec4899' },
  { id: 'd4', name: 'HR', managerId: 'u5', managerName: 'James Wilson', headcount: 5, color: '#f59e0b' },
  { id: 'd5', name: 'Marketing', managerId: 'u6', managerName: 'Olivia Brown', headcount: 10, color: '#10b981' },
  { id: 'd6', name: 'Finance', managerId: 'u7', managerName: 'Daniel Lee', headcount: 7, color: '#06b6d4' },
];

export const USERS: User[] = [
  { id: 'u1', name: 'Alex Thompson', email: 'alex@company.com', role: 'admin', department: 'Engineering', position: 'CTO', avatar: 'AT', status: 'active', joinDate: '2020-01-15', phone: '+1-555-0101' },
  { id: 'u2', name: 'Sarah Johnson', email: 'sarah@company.com', role: 'manager', department: 'Engineering', position: 'Engineering Manager', avatar: 'SJ', status: 'active', joinDate: '2020-03-22', phone: '+1-555-0102' },
  { id: 'u3', name: 'Michael Chen', email: 'michael@company.com', role: 'manager', department: 'Product', position: 'Product Manager', avatar: 'MC', status: 'active', joinDate: '2021-06-10', phone: '+1-555-0103' },
  { id: 'u4', name: 'Emma Davis', email: 'emma@company.com', role: 'team_lead', department: 'Design', position: 'Design Lead', avatar: 'ED', status: 'active', joinDate: '2021-08-05', phone: '+1-555-0104' },
  { id: 'u5', name: 'James Wilson', email: 'james@company.com', role: 'hr_manager', department: 'HR', position: 'HR Manager', avatar: 'JW', status: 'active', joinDate: '2019-11-01', phone: '+1-555-0105' },
  { id: 'u6', name: 'Olivia Brown', email: 'olivia@company.com', role: 'manager', department: 'Marketing', position: 'Marketing Manager', avatar: 'OB', status: 'active', joinDate: '2022-01-20', phone: '+1-555-0106' },
  { id: 'u7', name: 'Daniel Lee', email: 'daniel@company.com', role: 'manager', department: 'Finance', position: 'Finance Manager', avatar: 'DL', status: 'active', joinDate: '2020-07-14', phone: '+1-555-0107' },
  { id: 'u8', name: 'Sophia Martinez', email: 'sophia@company.com', role: 'employee', department: 'Engineering', position: 'Senior Developer', avatar: 'SM', status: 'active', joinDate: '2022-03-08', phone: '+1-555-0108' },
  { id: 'u9', name: 'Liam Anderson', email: 'liam@company.com', role: 'employee', department: 'Engineering', position: 'Developer', avatar: 'LA', status: 'active', joinDate: '2023-01-15', phone: '+1-555-0109' },
  { id: 'u10', name: 'Ava Thomas', email: 'ava@company.com', role: 'employee', department: 'Design', position: 'UI/UX Designer', avatar: 'AT', status: 'active', joinDate: '2022-09-12', phone: '+1-555-0110' },
  { id: 'u11', name: 'Noah Jackson', email: 'noah@company.com', role: 'employee', department: 'Marketing', position: 'Content Specialist', avatar: 'NJ', status: 'inactive', joinDate: '2021-04-20', phone: '+1-555-0111' },
  { id: 'u12', name: 'Isabella White', email: 'isabella@company.com', role: 'employee', department: 'Product', position: 'Product Analyst', avatar: 'IW', status: 'active', joinDate: '2023-05-01', phone: '+1-555-0112' },
];

const today = new Date().toISOString().split('T')[0];

export const ATTENDANCE: AttendanceRecord[] = [
  { id: 'a1', userId: 'u1', date: today, clockIn: '08:45', clockOut: null, status: 'present', method: 'web', hoursWorked: undefined },
  { id: 'a2', userId: 'u2', date: today, clockIn: '09:02', clockOut: null, status: 'present', method: 'biometric', hoursWorked: undefined },
  { id: 'a3', userId: 'u3', date: today, clockIn: '09:30', clockOut: null, status: 'late', method: 'web', hoursWorked: undefined },
  { id: 'a4', userId: 'u4', date: today, clockIn: '08:55', clockOut: null, status: 'present', method: 'web', hoursWorked: undefined },
  { id: 'a5', userId: 'u5', date: today, clockIn: null, clockOut: null, status: 'absent', method: 'web', hoursWorked: undefined },
  { id: 'a6', userId: 'u6', date: today, clockIn: '08:30', clockOut: null, status: 'present', method: 'mobile', hoursWorked: undefined },
  { id: 'a7', userId: 'u7', date: today, clockIn: '09:15', clockOut: null, status: 'present', method: 'biometric', hoursWorked: undefined },
  { id: 'a8', userId: 'u8', date: today, clockIn: '08:00', clockOut: null, status: 'present', method: 'biometric', hoursWorked: undefined },
  { id: 'a9', userId: 'u9', date: today, clockIn: null, clockOut: null, status: 'on_leave', method: 'web', hoursWorked: undefined },
  { id: 'a10', userId: 'u10', date: today, clockIn: '10:05', clockOut: null, status: 'late', method: 'web', hoursWorked: undefined },
];

export const TASKS: Task[] = [
  { id: 't1', title: 'Redesign authentication flow', description: 'Update the login and registration pages with new design system', assigneeId: 'u8', assigneeName: 'Sophia Martinez', assigneeAvatar: 'SM', priority: 'high', status: 'in_progress', dueDate: '2026-06-10', createdAt: '2026-05-28', tags: ['frontend', 'auth'], projectId: 'p1', projectName: 'Platform Redesign', estimatedHours: 16, loggedHours: 8 },
  { id: 't2', title: 'API rate limiting implementation', description: 'Add rate limiting middleware to all public API endpoints', assigneeId: 'u9', assigneeName: 'Liam Anderson', assigneeAvatar: 'LA', priority: 'critical', status: 'todo', dueDate: '2026-06-07', createdAt: '2026-06-01', tags: ['backend', 'security'], projectId: 'p1', projectName: 'Platform Redesign', estimatedHours: 8, loggedHours: 0 },
  { id: 't3', title: 'User dashboard wireframes', description: 'Create wireframes for the new employee self-service dashboard', assigneeId: 'u10', assigneeName: 'Ava Thomas', assigneeAvatar: 'AT', priority: 'medium', status: 'review', dueDate: '2026-06-05', createdAt: '2026-05-25', tags: ['design', 'ux'], projectId: 'p2', projectName: 'Employee Portal', estimatedHours: 12, loggedHours: 12 },
  { id: 't4', title: 'Q2 marketing campaign', description: 'Plan and execute the Q2 digital marketing campaign', assigneeId: 'u6', assigneeName: 'Olivia Brown', assigneeAvatar: 'OB', priority: 'high', status: 'in_progress', dueDate: '2026-06-15', createdAt: '2026-05-20', tags: ['marketing', 'campaign'], projectId: 'p3', projectName: 'Q2 Marketing', estimatedHours: 40, loggedHours: 22 },
  { id: 't5', title: 'Database performance audit', description: 'Analyze slow queries and optimize database indexes', assigneeId: 'u8', assigneeName: 'Sophia Martinez', assigneeAvatar: 'SM', priority: 'high', status: 'done', dueDate: '2026-06-01', createdAt: '2026-05-18', tags: ['backend', 'performance'], projectId: 'p1', projectName: 'Platform Redesign', estimatedHours: 20, loggedHours: 18 },
  { id: 't6', title: 'Onboarding checklist update', description: 'Update the employee onboarding documentation and checklist', assigneeId: 'u5', assigneeName: 'James Wilson', assigneeAvatar: 'JW', priority: 'low', status: 'backlog', dueDate: '2026-06-30', createdAt: '2026-06-01', tags: ['hr', 'documentation'], projectId: 'p4', projectName: 'HR Initiatives', estimatedHours: 6, loggedHours: 0 },
  { id: 't7', title: 'Mobile push notifications', description: 'Implement push notifications for the mobile app', assigneeId: 'u9', assigneeName: 'Liam Anderson', assigneeAvatar: 'LA', priority: 'medium', status: 'todo', dueDate: '2026-06-20', createdAt: '2026-06-02', tags: ['mobile', 'notifications'], projectId: 'p2', projectName: 'Employee Portal', estimatedHours: 10, loggedHours: 0 },
  { id: 't8', title: 'Product roadmap Q3', description: 'Define and document the product roadmap for Q3 2026', assigneeId: 'u3', assigneeName: 'Michael Chen', assigneeAvatar: 'MC', priority: 'critical', status: 'in_progress', dueDate: '2026-06-08', createdAt: '2026-05-30', tags: ['product', 'planning'], projectId: 'p5', projectName: 'Strategy', estimatedHours: 24, loggedHours: 10 },
];

export const WEEKLY_ATTENDANCE = [
  { day: 'Mon', present: 48, absent: 6, late: 4, leave: 2 },
  { day: 'Tue', present: 52, absent: 4, late: 2, leave: 2 },
  { day: 'Wed', present: 50, absent: 5, late: 3, leave: 2 },
  { day: 'Thu', present: 45, absent: 8, late: 5, leave: 2 },
  { day: 'Fri', present: 42, absent: 10, late: 4, leave: 4 },
  { day: 'Sat', present: 20, absent: 40, late: 0, leave: 0 },
  { day: 'Sun', present: 10, absent: 50, late: 0, leave: 0 },
];

export const MONTHLY_TREND = [
  { week: 'W1', attendance: 88, tasks: 42 },
  { week: 'W2', attendance: 91, tasks: 55 },
  { week: 'W3', attendance: 85, tasks: 48 },
  { week: 'W4', attendance: 93, tasks: 67 },
];

export const TASK_STATUS_COUNTS = [
  { name: 'Done', value: 18, color: '#10b981' },
  { name: 'In Progress', value: 12, color: '#6366f1' },
  { name: 'Review', value: 5, color: '#f59e0b' },
  { name: 'Todo', value: 8, color: '#64748b' },
  { name: 'Backlog', value: 4, color: '#334155' },
];

export const DEMO_USERS = [
  { email: 'admin@company.com', password: 'admin123', userId: 'u1' },
  { email: 'manager@company.com', password: 'manager123', userId: 'u2' },
  { email: 'hr@company.com', password: 'hr123', userId: 'u5' },
  { email: 'employee@company.com', password: 'employee123', userId: 'u8' },
];
