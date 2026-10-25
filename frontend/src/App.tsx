import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth';
import { Layout } from './components/Layout';
import { Loading, UiProvider } from './ui';
import { Login, Register } from './pages/Auth';
import { Profile } from './pages/Profile';
import { Exams } from './pages/Exams';
import { ExamInfo } from './pages/ExamInfo';
import { Take } from './pages/Take';
import { Result } from './pages/Result';
import { HistoryPage } from './pages/History';
import { Groups } from './pages/Groups';
import { Dashboard } from './pages/admin/Dashboard';
import { UsersAdmin } from './pages/admin/Users';
import { GroupsAdmin, GroupDetailPage } from './pages/admin/Groups';
import { Requests } from './pages/admin/Requests';
import { ExamsAdmin } from './pages/admin/ExamsAdmin';
import { ExamEditor } from './pages/admin/ExamEditor';
import { ExamResultsPage } from './pages/admin/ExamResults';

function RequireAuth({ children, admin }: { children: ReactNode; admin?: boolean }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return <Loading />;
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  return <>{children}</>;
}

const A = (el: ReactNode) => <RequireAuth admin>{el}</RequireAuth>;

export default function App() {
  return (
    <BrowserRouter>
      <UiProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<GuestOnly><Login /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Register /></GuestOnly>} />
            <Route element={<RequireAuth><Layout /></RequireAuth>}>
              <Route index element={<Exams />} />
              <Route path="exam/:id" element={<ExamInfo />} />
              <Route path="take/:id" element={<Take />} />
              <Route path="result/:id" element={<Result />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="groups" element={<Groups />} />
              <Route path="profile" element={<Profile />} />
              <Route path="admin" element={A(<Dashboard />)} />
              <Route path="admin/users" element={A(<UsersAdmin />)} />
              <Route path="admin/groups" element={A(<GroupsAdmin />)} />
              <Route path="admin/groups/:id" element={A(<GroupDetailPage />)} />
              <Route path="admin/requests" element={A(<Requests />)} />
              <Route path="admin/exams" element={A(<ExamsAdmin />)} />
              <Route path="admin/exams/new" element={A(<ExamEditor />)} />
              <Route path="admin/exams/:id/edit" element={A(<ExamEditor />)} />
              <Route path="admin/exams/:id/results" element={A(<ExamResultsPage />)} />
              <Route path="*" element={<div className="card empty">Không tìm thấy trang.</div>} />
            </Route>
          </Routes>
        </AuthProvider>
      </UiProvider>
    </BrowserRouter>
  );
}
