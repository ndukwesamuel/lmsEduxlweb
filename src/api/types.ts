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
  markedBy: string;
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
}

export interface Grade {
  _id: string;
  studentId: string;
  classId: string;
  subject: string;
  term: string;
  score: number;
  letterGrade: string;
  enteredBy: string;
  createdAt: string;
  updatedAt: string;
}

export type NotificationType = 'attendance_absent' | 'grade_posted' | 'admission_status';

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
  recentGrades: { subject: string; term: string; score: number; letterGrade: string }[];
}

export interface ParentDashboard {
  children: ParentChildSummary[];
}
