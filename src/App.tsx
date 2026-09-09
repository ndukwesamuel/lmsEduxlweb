import { Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import StudentsPage from './pages/StudentsPage';
import ClassesPage from './pages/ClassesPage';
import AdmissionsPage from './pages/AdmissionsPage';
import AttendancePage from './pages/AttendancePage';
import UsersPage from './pages/UsersPage';
import GradesPage from './pages/GradesPage';
import TeacherDashboardPage from './pages/TeacherDashboardPage';
import ParentDashboardPage from './pages/ParentDashboardPage';
import FinancePage from './pages/FinancePage';
import AnnouncementsPage from './pages/AnnouncementsPage';

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'teacher') return <TeacherDashboardPage />;
  if (user?.role === 'parent') return <ParentDashboardPage />;
  return <DashboardPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/" element={<HomeRedirect />} />
            <Route element={<ProtectedRoute roles={['admin']} />}>
              <Route path="/students" element={<StudentsPage />} />
              <Route path="/classes" element={<ClassesPage />} />
              <Route path="/admissions" element={<AdmissionsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/finance" element={<FinancePage />} />
              <Route path="/announcements" element={<AnnouncementsPage />} />
            </Route>
            <Route element={<ProtectedRoute roles={['admin', 'teacher']} />}>
              <Route path="/attendance" element={<AttendancePage />} />
              <Route path="/grades" element={<GradesPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
