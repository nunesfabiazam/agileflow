import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAppStore } from './store/useAppStore';
import { Sidebar } from './components/Layout/Sidebar';
import { LoginPage }     from './pages/LoginPage';
import { KanbanPage }    from './pages/KanbanPage';
import { BacklogPage }   from './pages/BacklogPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocsPage }      from './pages/DocsPage';
import { TeamPage }      from './pages/TeamPage';
import { ReportsPage }   from './pages/ReportsPage';
import { ImportPage }    from './pages/ImportPage';
import { ProjectsPage }  from './pages/ProjectsPage';

function AuthGuard() {
  const token = useAppStore(s => s.token);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

function AppLayout() {
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <main style={{ flex: 1, overflow: 'auto', padding: 24 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard />}>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/kanban" replace />} />
            <Route path="projects"   element={<ProjectsPage />} />
            <Route path="kanban"     element={<KanbanPage />} />
            <Route path="backlog"    element={<BacklogPage />} />
            <Route path="dashboard"  element={<DashboardPage />} />
            <Route path="documents"  element={<DocsPage />} />
            <Route path="team"       element={<TeamPage />} />
            <Route path="reports"    element={<ReportsPage />} />
            <Route path="import"     element={<ImportPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
