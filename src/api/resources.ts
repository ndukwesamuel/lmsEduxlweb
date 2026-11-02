import { api } from './client';
import {
  Admission,
  AdmissionStatus,
  Announcement,
  AppNotification,
  AttendanceLog,
  AttendanceSummaryRow,
  AuthUser,
  ClassSubject,
  ConductRating,
  DashboardSummary,
  Expense,
  Fee,
  FullResultCard,
  Grade,
  ParentDashboard,
  PlatformSchool,
  RegistrationDetails,
  ReportCard,
  ResultRelease,
  GradeBand,
  School,
  SchoolClass,
  Subject,
  Student,
  TeacherDashboard,
  UserAccount,
  UserRole,
} from './types';

export function login(email: string, password: string) {
  return api.post<{ token: string; user: AuthUser }>('/auth/login', { email, password });
}

export const school = {
  get: () => api.get<School>('/school'),
  update: (data: Partial<{ terms: string[]; currentTerm: string; gradingScale: GradeBand[] }>) =>
    api.patch<School>('/school', data),
};

export type HelpPage =
  | 'dashboard'
  | 'students'
  | 'admissions'
  | 'classes'
  | 'subjects'
  | 'results'
  | 'finance'
  | 'announcements'
  | 'users'
  | 'settings'
  | 'attendance'
  | 'grades';

export const help = {
  ask: (data: {
    page: HelpPage;
    question: string;
    history?: { role: 'user' | 'assistant'; content: string }[];
    facts?: string[];
  }) => api.post<{ answer: string }>('/help/ask', data),
};

export const subjects = {
  list: () => api.get<Subject[]>('/subjects'),
  create: (data: { name: string; code?: string }) => api.post<Subject>('/subjects', data),
  update: (id: string, data: Partial<{ name: string; code: string; isActive: boolean }>) =>
    api.patch<Subject>(`/subjects/${id}`, data),
};

// Unauthenticated endpoints for the public /apply/:slug page — no token is
// attached (there isn't one), the backend resolves the school from :slug.
export const publicApply = {
  getSchool: (slug: string) => api.get<{ name: string }>(`/public/schools/${encodeURIComponent(slug)}`),
  submit: (slug: string, data: Record<string, unknown>) =>
    api.post<{ ok: true; applicantName: string }>(`/public/schools/${encodeURIComponent(slug)}/admissions`, data),
};

export const users = {
  listTeachers: () => api.get<UserAccount[]>('/users?role=teacher'),
  listParents: () => api.get<UserAccount[]>('/users?role=parent'),
  create: (data: { name: string; email: string; password: string; role: Extract<UserRole, 'teacher' | 'parent'> }) =>
    api.post<UserAccount>('/users', data),
  remove: (id: string) => api.delete<UserAccount>(`/users/${id}`),
};

export const students = {
  list: () => api.get<Student[]>('/students'),
  create: (data: { name: string; dob: string; classId: string }) => api.post<Student>('/students', data),
  update: (id: string, data: Partial<{ name: string; dob: string; classId: string; isActive: boolean; guardianUserId: string | null }>) =>
    api.patch<Student>(`/students/${id}`, data),
  remove: (id: string) => api.delete<Student>(`/students/${id}`),
};

export const classes = {
  list: () => api.get<SchoolClass[]>('/classes'),
  create: (data: { name: string; formTeacherId: string; subjects?: ClassSubject[] }) => api.post<SchoolClass>('/classes', data),
  setFormTeacher: (id: string, formTeacherId: string) => api.patch<SchoolClass>(`/classes/${id}`, { formTeacherId }),
  setSubjects: (id: string, subjects: ClassSubject[]) => api.put<SchoolClass>(`/classes/${id}/subjects`, { subjects }),
};

export const admissions = {
  list: () => api.get<Admission[]>('/admissions'),
  get: (id: string) => api.get<Admission>(`/admissions/${id}`),
  create: (applicantName: string) => api.post<Admission>('/admissions', { applicantName }),
  updateContact: (id: string, data: { guardianName?: string; guardianPhone?: string; guardianEmail?: string }) =>
    api.patch<Admission>(`/admissions/${id}`, data),
  submitRegistration: (id: string, data: RegistrationDetails) =>
    api.patch<Admission>(`/admissions/${id}/registration`, data),
  transition: (id: string, newStatus: AdmissionStatus, extra?: { classId?: string; dob?: string; feeAmount?: number }) =>
    api.patch<Admission>(`/admissions/${id}/status`, { newStatus, ...extra }),
};

export const resultReleases = {
  list: () => api.get<ResultRelease[]>('/result-releases'),
  release: (classId: string, term: string) => api.post<ResultRelease>('/result-releases', { classId, term }),
  unrelease: (classId: string, term: string) => api.delete<void>('/result-releases', { classId, term }),
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
  post: (data: { studentId: string; classId: string; subjectId: string; term: string; caScore: number; examScore: number }) =>
    api.post<Grade>('/grades', data),
  saveSheet: (data: {
    classId: string;
    subjectId: string;
    term: string;
    entries: { studentId: string; caScore: number; examScore: number }[];
  }) => api.post<Grade[]>('/grades/bulk', data),
  remove: (id: string) => api.delete<void>(`/grades/${id}`),
};

export const reportCards = {
  get: (studentId: string, term: string) =>
    api.get<FullResultCard>(`/report-cards/${studentId}?term=${encodeURIComponent(term)}`),
  setConduct: (data: { studentId: string; classId: string; term: string; conductRating?: ConductRating; teacherComment?: string }) =>
    api.patch<ReportCard>('/report-cards', data),
  listForClass: (classId: string, term: string) =>
    api.get<ReportCard[]>(`/report-cards?classId=${classId}&term=${encodeURIComponent(term)}`),
  saveSheet: (data: {
    classId: string;
    term: string;
    entries: { studentId: string; conductRating?: ConductRating | ''; teacherComment?: string; adminRemark?: string }[];
  }) => api.post<ReportCard[]>('/report-cards/bulk', data),
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
  saveSheet: (term: string, entries: { studentId: string; amountAssigned: number; amountPaid: number }[]) =>
    api.post<Fee[]>('/fees/bulk', { term, entries }),
  remove: (id: string) => api.delete<void>(`/fees/${id}`),
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

// Eduxl super-admin endpoints — only work with a superadmin login.
export const platform = {
  listSchools: () => api.get<PlatformSchool[]>('/platform/schools'),
  createSchool: (data: {
    name: string;
    code: string;
    slug?: string;
    address?: string;
    adminName: string;
    adminEmail: string;
    adminPassword: string;
  }) => api.post<PlatformSchool>('/platform/schools', data),
  updateSchool: (id: string, data: Partial<{ name: string; address: string; plan: string; isActive: boolean }>) =>
    api.patch<PlatformSchool>(`/platform/schools/${id}`, data),
};

export const dashboard = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
  teacher: () => api.get<TeacherDashboard>('/dashboard/teacher'),
  parent: () => api.get<ParentDashboard>('/dashboard/parent'),
};
