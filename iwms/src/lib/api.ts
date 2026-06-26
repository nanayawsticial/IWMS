import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// ── Token helpers ──────────────────────────────────────────────
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('iwms_access_token');
}
export function setTokens(access: string, refresh: string) {
  localStorage.setItem('iwms_access_token', access);
  localStorage.setItem('iwms_refresh_token', refresh);
}
export function clearTokens() {
  localStorage.removeItem('iwms_access_token');
  localStorage.removeItem('iwms_refresh_token');
  localStorage.removeItem('iwms_user');
}

// ── Request interceptor: attach JWT ───────────────────────────
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// ── Response interceptor: auto-refresh on 401 ─────────────────
let isRefreshing = false;
let failedQueue: Array<{ resolve: (v: string) => void; reject: (e: unknown) => void }> = [];

function processQueue(error: unknown, token: string | null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token!);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('iwms_refresh_token');
      if (!refreshToken) {
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${API_URL}/api/auth/refresh`, { refreshToken });
        const newAccessToken = data.accessToken;
        localStorage.setItem('iwms_access_token', newAccessToken);
        processQueue(null, newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        clearTokens();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

// ── Typed API functions ────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/api/auth/login', { email, password }).then(r => r.data),
  loginMfa: (tempToken: string, code: string) =>
    api.post('/api/auth/login/mfa', { tempToken, code }).then(r => r.data),
  signup: (data: Record<string, unknown>) =>
    api.post('/api/auth/signup', data).then(r => r.data),
  join: (data: Record<string, unknown>) =>
    api.post('/api/auth/join', data).then(r => r.data),
  logout: (refreshToken: string) =>
    api.post('/api/auth/logout', { refreshToken }).then(r => r.data),
  me: () => api.get('/api/auth/me').then(r => r.data),
};

export const organizationApi = {
  getDetails: () => api.get('/api/organization').then(r => r.data),
  regenerateCode: () => api.post('/api/organization/regenerate-code').then(r => r.data),
  updateDetails: (name: string) => api.patch('/api/organization', { name }).then(r => r.data),
};

export const usersApi = {
  list: () => api.get('/api/users').then(r => r.data),
  get: (id: string) => api.get(`/api/users/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => api.post('/api/users', data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/users/${id}`, data).then(r => r.data),
  deactivate: (id: string) => api.delete(`/api/users/${id}`).then(r => r.data),
};

export const departmentsApi = {
  list: () => api.get('/api/departments').then(r => r.data),
};

export const tasksApi = {
  list: (params?: Record<string, string>) =>
    api.get('/api/tasks', { params }).then(r => r.data),
  get: (id: string) =>
    api.get(`/api/tasks/${id}`).then(r => r.data),
  create: (data: Record<string, unknown>) => api.post('/api/tasks', data).then(r => r.data),
  update: (id: string, data: Record<string, unknown>) => api.patch(`/api/tasks/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/api/tasks/${id}`).then(r => r.data),
  dailyBudget: (date: string, userId?: string) =>
    api.get('/api/tasks/daily-budget', { params: userId ? { date, userId } : { date } }).then(r => r.data),
  addComment: (id: string, content: string) =>
    api.post(`/api/tasks/${id}/comments`, { content }).then(r => r.data),
  updateComment: (taskId: string, commentId: string, content: string) =>
    api.patch(`/api/tasks/${taskId}/comments/${commentId}`, { content }).then(r => r.data),
  logTime: (id: string, data: { hours: number; date: string; note?: string }) =>
    api.post(`/api/tasks/${id}/timelogs`, data).then(r => r.data),
};

export const attendanceApi = {
  list: (params?: Record<string, string>) =>
    api.get('/api/attendance', { params }).then(r => r.data),
  stats: (paramsOrDate?: string | Record<string, string>) => {
    let params: Record<string, string> = {};
    if (typeof paramsOrDate === 'string') {
      params = { date: paramsOrDate };
    } else if (paramsOrDate) {
      params = paramsOrDate;
    }
    return api.get('/api/attendance/stats', { params }).then(r => r.data);
  },
  liveFeed: () =>
    api.get('/api/attendance/live-feed').then(r => r.data),
  summary: () =>
    api.get('/api/attendance/summary').then(r => r.data),
  timesheets: (params: Record<string, string>) =>
    api.get('/api/attendance/timesheets', { params }).then(r => r.data),
  exportTimesheets: (params: Record<string, string>) =>
    api.get('/api/attendance/timesheets/export', { params, responseType: 'blob' }).then(r => r.data),
  clockIn: (data?: { latitude?: number; longitude?: number; method?: string }) =>
    api.post('/api/attendance/clock-in', data || {}).then(r => r.data),
  clockOut: () =>
    api.post('/api/attendance/clock-out', {}).then(r => r.data),
  correct: (id: string, data: Record<string, unknown>) =>
    api.patch(`/api/attendance/${id}`, data).then(r => r.data),
  presence: () =>
    api.get('/api/attendance/presence').then(r => r.data),
};

export const leavesApi = {
  list: () => api.get('/api/leaves').then(r => r.data),
  create: (data: { startDate: string; endDate: string; type: string; reason?: string }) =>
    api.post('/api/leaves', data).then(r => r.data),
  approve: (id: string, data: { status: 'approved' | 'rejected'; managerNotes?: string }) =>
    api.patch(`/api/leaves/${id}`, data).then(r => r.data),
};

export const shiftsApi = {
  list: (params?: Record<string, string>) =>
    api.get('/api/shifts', { params }).then(r => r.data),
  create: (data: { userId: string; date: string; type: string; startTime?: string; endTime?: string; notes?: string }) =>
    api.post('/api/shifts', data).then(r => r.data),
};

export const mfaApi = {
  setup: () => api.post('/api/auth/mfa/setup').then(r => r.data),
  enable: (data: { secret: string; token: string }) =>
    api.post('/api/auth/mfa/enable', data).then(r => r.data),
  disable: (data: { token?: string }) =>
    api.post('/api/auth/mfa/disable', data).then(r => r.data),
};

export const devicesApi = {
  list: () => api.get('/api/devices').then(r => r.data),
  create: (data: Record<string, any>) => api.post('/api/devices', data).then(r => r.data),
  update: (id: string, data: Record<string, any>) => api.patch(`/api/devices/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/api/devices/${id}`).then(r => r.data),
  provisionKey: (id: string) => api.post(`/api/devices/${id}/provision-key`).then(r => r.data),
  ping: (id: string) => api.post(`/api/devices/${id}/ping`).then(r => r.data),
  sync: (id: string) => api.post(`/api/devices/${id}/sync`).then(r => r.data),
  getLogs: (id: string, limit?: number) =>
    api.get(`/api/devices/${id}/logs`, { params: limit ? { limit: String(limit) } : {} }).then(r => r.data),
  pushEvent: (id: string, data: Record<string, any>) =>
    api.post(`/api/devices/${id}/events`, data).then(r => r.data),
  pair: (data: { code: string; name: string; location?: string; notes?: string }) =>
    api.post('/api/devices/pair', data).then(r => r.data),
};

export const geofenceApi = {
  list: () => api.get('/api/geofence').then(r => r.data),
  create: (data: Record<string, any>) => api.post('/api/geofence', data).then(r => r.data),
  update: (id: string, data: Record<string, any>) => api.patch(`/api/geofence/${id}`, data).then(r => r.data),
  remove: (id: string) => api.delete(`/api/geofence/${id}`).then(r => r.data),
  validate: (latitude: number, longitude: number) =>
    api.post('/api/geofence/validate', { latitude, longitude }).then(r => r.data),
};

export const reportsApi = {
  autoPopulate: (startDate: string, endDate: string) =>
    api.get('/api/reports/auto-populate', { params: { startDate, endDate } }).then(r => r.data),
  autoDraft: (startDate: string, endDate: string) =>
    api.post('/api/reports/auto-draft', { startDate, endDate }).then(r => r.data),
  myReports: () =>
    api.get('/api/reports/my-reports').then(r => r.data),
  reviewList: (params?: Record<string, string>) =>
    api.get('/api/reports/review-list', { params }).then(r => r.data),
  get: (id: string) =>
    api.get(`/api/reports/${id}`).then(r => r.data),
  save: (data: Record<string, any>) =>
    api.post('/api/reports/save', data).then(r => r.data),
  review: (id: string, data: { status: 'approved' | 'needs_revision'; reviewNotes?: string }) =>
    api.post(`/api/reports/${id}/review`, data).then(r => r.data),
  exportDocx: (id: string) =>
    api.get(`/api/reports/${id}/export`, { responseType: 'blob' }).then(r => r.data),
};

export const notificationsApi = {
  list: () => api.get('/api/notifications').then(r => r.data),
  read: (id: string) => api.post(`/api/notifications/${id}/read`).then(r => r.data),
  readAll: () => api.post('/api/notifications/read-all').then(r => r.data),
};

export const overtimeApi = {
  list: () => api.get('/api/overtime').then(r => r.data),
  create: (data: { userId: string; date: string; regularHours: number; overtimeHours: number; reason?: string }) =>
    api.post('/api/overtime', data).then(r => r.data),
  review: (id: string, data: { status: 'approved' | 'rejected'; reviewNotes?: string }) =>
    api.patch(`/api/overtime/${id}`, data).then(r => r.data),
};

export const holidaysApi = {
  list: (params?: { year?: string }) =>
    api.get('/api/holidays', { params }).then(r => r.data),
  create: (data: { name: string; date: string; type?: string }) =>
    api.post('/api/holidays', data).then(r => r.data),
  remove: (id: string) =>
    api.delete(`/api/holidays/${id}`).then(r => r.data),
};

export const managementApi = {
  getDashboard: () => api.get('/api/management/dashboard').then(r => r.data),
};

export const hrApi = {
  getDashboard: () => api.get('/api/hr/dashboard').then(r => r.data),
  listEmployees: () => api.get('/api/hr/employees').then(r => r.data),
  getEmployee: (id: string) => api.get(`/api/hr/employees/${id}`).then(r => r.data),
  updateProfile: (id: string, data: any) => api.patch(`/api/hr/employees/${id}/profile`, data).then(r => r.data),
  onboard: (id: string) => api.post(`/api/hr/employees/${id}/onboard`, {}).then(r => r.data),
  offboard: (id: string) => api.post(`/api/hr/employees/${id}/offboard`, {}).then(r => r.data),
  listLeaveRequests: () => api.get('/api/hr/leave-requests').then(r => r.data),
  getHeadcount: () => api.get('/api/hr/headcount').then(r => r.data),
};

export const financeApi = {
  getDashboard: () => api.get('/api/finance/dashboard').then(r => r.data),
  listExpenses: (params?: any) => api.get('/api/finance/expenses', { params }).then(r => r.data),
  submitExpense: (data: any) => api.post('/api/finance/expenses', data).then(r => r.data),
  approveExpense: (id: string, data: { status: string; managerNotes?: string }) => api.patch(`/api/finance/expenses/${id}`, data).then(r => r.data),
  listBudgets: (params?: any) => api.get('/api/finance/budgets', { params }).then(r => r.data),
  createBudget: (data: any) => api.post('/api/finance/budgets', data).then(r => r.data),
  updateBudget: (id: string, data: any) => api.patch(`/api/finance/budgets/${id}`, data).then(r => r.data),
  getPayrollSummary: (params?: any) => api.get('/api/finance/payroll-summary', { params }).then(r => r.data),
};

