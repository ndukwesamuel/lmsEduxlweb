import { api } from './client';
import {
  Admission,
  AdmissionStatus,
  Announcement,
  AppNotification,
  AttendanceLog,
  AttendanceSummaryRow,
  AuthUser,
  ConductRating,
  DashboardSummary,
  Expense,
  Fee,
  FullResultCard,
  Grade,
  ParentDashboard,
  ReportCard,
  SchoolClass,
  Student,
  TeacherDashboard,
  UserAccount,
  UserRole,
} from './types';

export function login(email: string, password: string, schoolId: string) {
  return api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password, schoolId });
}

export const users = {
  listTeachers: () => api.get<UserAccount[]>('/users?role=teacher'),
  listParents: () => api.get<UserAccount[]>('/users?role=parent'),
  create: (data: { name: string; email: string; password: string; role: Extract<UserRole, 'teacher' | 'parent'> }) =>
    api.post<UserAccount>('/users', data),
};

export const students = {
  list: () => api.get<Student[]>('/students'),
  create: (data: { name: string; dob: string; classId: string }) => api.post<Student>('/students', data),
  update: (id: string, data: Partial<{ name: string; dob: string; classId: string; isActive: boolean; guardianUserId: string }>) =>
    api.patch<Student>(`/students/${id}`, data),
  remove: (id: string) => api.delete<Student>(`/students/${id}`),
};

export const classes = {
  list: () => api.get<SchoolClass[]>('/classes'),
  create: (data: { name: string; term: string; formTeacherId: string; subjectTeachers?: { teacherId: string; subject: string }[] }) =>
    api.post<SchoolClass>('/classes', data),
};

export const admissions = {
  list: () => api.get<Admission[]>('/admissions'),
  create: (applicantName: string) => api.post<Admission>('/admissions', { applicantName }),
  updateContact: (id: string, data: { guardianName?: string; guardianPhone?: string; guardianEmail?: string }) =>
    api.patch<Admission>(`/admissions/${id}`, data),
  transition: (id: string, newStatus: AdmissionStatus, extra?: { classId?: string; dob?: string; feeAmount?: number }) =>
    api.patch<Admission>(`/admissions/${id}/status`, { newStatus, ...extra }),
};

export const attendance = {
  mark: (classId: string, date: string, entries: { studentId: string; present: boolean; comment?: string }[]) =>
    api.post<AttendanceLog[]>('/attendance', { classId, date, entries }),
  history: (classId: string, date?: string) =>
    api.get<AttendanceLog[]>(`/attendance?classId=${classId}${date ? `&date=${date}` : ''}`),
  historyForStudent: (studentId: string) => api.get<AttendanceLog[]>(`/attendance?studentId=${studentId}`),
  summary: (classId: string) => api.get<AttendanceSummaryRow[]>(`/attendance/summary?classId=${classId}`),
};

export const grades = {
  list: (params: { studentId?: string; classId?: string; term?: string }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return api.get<Grade[]>(`/grades${qs ? `?${qs}` : ''}`);
  },
  post: (data: { studentId: string; classId: string; subject: string; term: string; caScore: number; examScore: number }) =>
    api.post<Grade>('/grades', data),
};

export const reportCards = {
  get: (studentId: string, term: string) =>
    api.get<FullResultCard>(`/report-cards/${studentId}?term=${encodeURIComponent(term)}`),
  setConduct: (data: { studentId: string; classId: string; term: string; conductRating?: ConductRating; teacherComment?: string }) =>
    api.patch<ReportCard>('/report-cards', data),
  setAdminRemark: (studentId: string, term: string, adminRemark: string) =>
    api.patch<ReportCard>(`/report-cards/${studentId}/admin-remark`, { term, adminRemark }),
};

export const fees = {
  list: (params: { studentId?: string; term?: string }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return api.get<Fee[]>(`/fees${qs ? `?${qs}` : ''}`);
  },
  assign: (studentId: string, term: string, amountAssigned: number) =>
    api.post<Fee>('/fees', { studentId, term, amountAssigned }),
  recordPayment: (id: string, amountPaid: number) => api.patch<Fee>(`/fees/${id}`, { amountPaid }),
};

export const expenses = {
  list: () => api.get<Expense[]>('/expenses'),
  create: (data: { category: string; description: string; amount: number; date?: string }) =>
    api.post<Expense>('/expenses', data),
};

export const announcements = {
  list: () => api.get<Announcement[]>('/announcements'),
  create: (data: { title: string; message: string }) => api.post<Announcement>('/announcements', data),
};

export const notifications = {
  list: () => api.get<AppNotification[]>('/notifications'),
  markRead: (id: string) => api.patch<AppNotification>(`/notifications/${id}/read`),
};

export const dashboard = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
  teacher: () => api.get<TeacherDashboard>('/dashboard/teacher'),
  parent: () => api.get<ParentDashboard>('/dashboard/parent'),
};
