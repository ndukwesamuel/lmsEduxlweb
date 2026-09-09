export type UserRole = 'admin' | 'teacher' | 'parent';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  schoolId: string;
}

export type AdmissionStatus =
  | 'Applied'
  | 'Reviewed'
  | 'Interview'
  | 'Approved'
  | 'Registered'
  | 'Active'
  | 'Rejected'
  | 'Not Admitted'
  | 'Withdrawn';

export interface StatusHistoryEntry {
  status: AdmissionStatus;
  changedAt: string;
  changedBy: string;
}

export interface Admission {
  _id: string;
  applicantName: string;
  status: AdmissionStatus;
  statusHistory: StatusHistoryEntry[];
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  createdAt: string;
}

export interface SubjectTeacher {
  teacherId: string;
  subject: string;
}

export interface SchoolClass {
  _id: string;
  name: string;
  formTeacherId: string;
  subjectTeachers: SubjectTeacher[];
  term: string;
}

export interface Student {
  _id: string;
  name: string;
  dob: string;
  classId: string;
  guardianUserId?: string;
  admissionId?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AttendanceLog {
  _id: string;
  studentId: string;
  classId: string;
  date: string;
  present: boolean;
  comment?: string;
  markedBy: string;
}

export interface AttendanceSummaryRow {
  studentId: string;
  name: string;
  daysPresent: number;
  totalDays: number;
  attendanceRate: number | null;
}

export interface UserAccount {
  _id: string;
  name: string;
  email: string;
  role: UserRole;
}

export interface DashboardSummary {
  admissionsByStage: Record<string, number>;
  totalActiveStudents: number;
  todaysAttendance: {
    present: number;
    totalMarked: number;
    rate: number | null;
  };
  studentsPerClass: { classId: string; name: string; count: number }[];
  finance: { totalIncome: number; totalExpense: number };
}

export interface Grade {
  _id: string;
  studentId: string;
  classId: string;
  subject: string;
  term: string;
  caScore: number;
  examScore: number;
  total: number;
  letterGrade: string;
  enteredBy: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = 'attendance_absent' | 'grade_posted' | 'admission_status' | 'announcement';

export interface AppNotification {
  _id: string;
  type: NotificationType;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface TeacherClassSummary {
  classId: string;
  name: string;
  term: string;
  isFormTeacher: boolean;
  studentCount: number;
  todaysAttendance: { present: number; totalMarked: number };
}

export interface TeacherDashboard {
  classes: TeacherClassSummary[];
}

export interface ParentChildSummary {
  studentId: string;
  name: string;
  classId: string;
  presentToday: boolean | null;
  recentGrades: { subject: string; term: string; caScore: number; examScore: number; total: number; letterGrade: string }[];
}

export interface ParentDashboard {
  children: ParentChildSummary[];
}

export type ConductRating = 'Excellent' | 'Good' | 'Fair' | 'Needs Improvement';

export interface ReportCard {
  _id: string;
  studentId: string;
  classId: string;
  term: string;
  conductRating?: ConductRating;
  teacherComment?: string;
  adminRemark?: string;
}

export interface FullResultCard {
  student: { id: string; name: string; classId: string };
  term: string;
  subjects: { subject: string; caScore: number; examScore: number; total: number; letterGrade: string }[];
  conductRating: ConductRating | null;
  teacherComment: string | null;
  adminRemark: string | null;
  attendance: { daysPresent: number; totalDays: number; attendanceRate: number | null };
}

export type FeeStatus = 'paid' | 'partial' | 'unpaid';

export interface Fee {
  _id: string;
  studentId: string;
  term: string;
  amountAssigned: number;
  amountPaid: number;
  status: FeeStatus;
}

export interface Expense {
  _id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  createdBy: string;
}

export interface Announcement {
  _id: string;
  title: string;
  message: string;
  createdBy: string;
  createdAt: string;
}
