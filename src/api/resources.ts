import { api } from './client';
import {
  Admission,
  AdmissionStatus,
  AppNotification,
  AttendanceLog,
  AuthUser,
  DashboardSummary,
  Grade,
  ParentDashboard,
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
  transition: (id: string, newStatus: AdmissionStatus, extra?: { classId?: string; dob?: string }) =>
    api.patch<Admission>(`/admissions/${id}/status`, { newStatus, ...extra }),
};

export const attendance = {
  mark: (classId: string, date: string, entries: { studentId: string; present: boolean }[]) =>
    api.post<AttendanceLog[]>('/attendance', { classId, date, entries }),
  history: (classId: string, date?: string) =>
    api.get<AttendanceLog[]>(`/attendance?classId=${classId}${date ? `&date=${date}` : ''}`),
  historyForStudent: (studentId: string) => api.get<AttendanceLog[]>(`/attendance?studentId=${studentId}`),
};

export const grades = {
  list: (params: { studentId?: string; classId?: string; term?: string }) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
    return api.get<Grade[]>(`/grades${qs ? `?${qs}` : ''}`);
  },
  post: (data: { studentId: string; classId: string; subject: string; term: string; score: number }) =>
    api.post<Grade>('/grades', data),
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
