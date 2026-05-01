import { BrowserRouter, Routes, Route, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppStore } from './store/useAppStore';
import { Sidebar } from './components/Layout/Sidebar';
import { NotificationBell } from './components/Shared/NotificationBell';
import { projectsApi } from './api';
import type { Project } from './types';
import { LoginPage }           from './pages/LoginPage';
import { KanbanPage }          from './pages/KanbanPage';
import { BacklogPage }         from './pages/BacklogPage';
import { DashboardPage }       from './pages/DashboardPage';
import { DocsPage }            from './pages/DocsPage';
import { DocEditorPage }       from './pages/DocEditorPage';
import { TeamPage }            from './pages/TeamPage';
import { ReportsPage }         from './pages/ReportsPage';
import { ImportPage }          from './pages/ImportPage';
import { ProjectsPage }        from './pages/ProjectsPage';
import { ProjectSettingsPage } from './pages/ProjectSettingsPage';
import { EpicsPage }          from './pages/EpicsPage';
import { RoadmapPage }          from './pages/RoadmapPage';
import UserManagementPage from './pages/UserManagementPage';
import SprintAnalyticsPage from './pages/SprintAnalyticsPage';
import TimeReportPage from './pages/TimeReportPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';

function AuthGuard() {
  const token = useAppStore(s => s.token);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

function TopBar() {
  const navigate = useNavigate();
  const { activeProjectId, setActiveProject, addRecentProject } = useAppStore();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then(r => r.data.data ?? []),
  });

  const active = (projects as Project[]).find(p => p.id === activeProjectId);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!btnRef.current?.contains(e.target as Node) && !dropRef.current?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleSelect = (p: Project) => {
    setActiveProject(p.id);
    addRecentProject(p);
    setOpen(false);
  };

  return (
    <div style={{
      height: 52, flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '0 20px',
      borderBottom: '1px solid var(--border)',
      background: 'var(--bg2)',
    }}>
      {/* ── Project Selector ── */}
      <div style={{ position: 'relative', flex: 1 }}>
        <button
          ref={btnRef}
          onClick={() => setOpen(v => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)',
            background: open ? 'var(--bg3)' : 'var(--bg1)', cursor: 'pointer',
            transition: 'all .15s', maxWidth: 380,
          }}
        >
          {active ? (
            <>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: active.color, flexShrink: 0 }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {active.iconEmoji && <span style={{ marginRight: 5 }}>{active.iconEmoji}</span>}
                {active.name}
              </span>
              <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg4)', padding: '1px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>
                {active.key}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 16 }}>📂</span>
              <span style={{ fontSize: 13, color: 'var(--text3)', fontWeight: 500 }}>Selecionar projeto…</span>
            </>
          )}
          <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 10, flexShrink: 0 }}>{open ? '▲' : '▼'}</span>
        </button>

        {open && (
          <div
            ref={dropRef}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 9999,
              background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.25)',
              minWidth: 320, maxWidth: 420, maxHeight: 400, overflowY: 'auto',
            }}
          >
            <div style={{ padding: '10px 14px 6px', fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Seus projetos
            </div>
            {(projects as Project[]).length === 0 && (
              <div style={{ padding: '12px 14px', fontSize: 13, color: 'var(--text3)' }}>Nenhum projeto encontrado.</div>
            )}
            {(projects as Project[]).map(p => (
              <div
                key={p.id}
                onClick={() => handleSelect(p)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 14px', cursor: 'pointer', transition: 'background .1s',
                  background: p.id === activeProjectId ? 'rgba(99,102,241,.1)' : 'transparent',
                  borderLeft: p.id === activeProjectId ? '3px solid var(--accent)' : '3px solid transparent',
                }}
                onMouseEnter={e => { if (p.id !== activeProjectId) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = p.id === activeProjectId ? 'rgba(99,102,241,.1)' : 'transparent'; }}
              >
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                <div style={{ flex: 1, overflow: 'hidden' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {p.iconEmoji && <span style={{ marginRight: 5 }}>{p.iconEmoji}</span>}{p.name}
                  </div>
                  {p.description && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.description}</div>
                  )}
                </div>
                <span style={{ fontSize: 11, color: 'var(--text3)', background: 'var(--bg4)', padding: '1px 6px', borderRadius: 4, fontWeight: 600, flexShrink: 0 }}>{p.key}</span>
                {p.id === activeProjectId && <span style={{ color: 'var(--accent)', fontSize: 12, flexShrink: 0 }}>✓</span>}
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', padding: '8px 14px' }}>
              <button
                onClick={() => { setOpen(false); navigate('/projects'); }}
                style={{ fontSize: 12, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
              >+ Criar novo projeto</button>
            </div>
          </div>
        )}
      </div>

      <div style={{ flex: 1 }} />
      <NotificationBell />
    </div>
  );
}

function AppLayout() {
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <TopBar />
        <main style={{ flex:1, overflow:'auto', padding:24 }}><Outlet /></main>
      </div>
    </div>
  );
}

function EditorLayout() {
  return (
    <div style={{ display:'flex', height:'100vh', overflow:'hidden' }}>
      <Sidebar />
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <Outlet />
      </div>
    </div>
  );
}

function ThemeSync() {
  const theme = useAppStore(s => s.theme);
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);
  return null;
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeSync />
      <Routes>
        <Route path="/login"          element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<AuthGuard />}>
          <Route element={<EditorLayout />}>
            <Route path="documents/:id" element={<DocEditorPage />} />
          </Route>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/kanban" replace />} />
            <Route path="projects"              element={<ProjectsPage />} />
            <Route path="projects/:id/settings" element={<ProjectSettingsPage />} />
            <Route path="epics"                 element={<EpicsPage />} />
            <Route path="roadmap"               element={<RoadmapPage />} />
            <Route path="kanban"                element={<KanbanPage />} />
            <Route path="backlog"               element={<BacklogPage />} />
            <Route path="dashboard"             element={<DashboardPage />} />
            <Route path="documents"             element={<DocsPage />} />
            <Route path="team"                  element={<TeamPage />} />
            <Route path="reports"               element={<ReportsPage />} />
            <Route path="import"                element={<ImportPage />} />
            <Route path="admin/users"           element={<UserManagementPage />} />
            <Route path="sprint-analytics"      element={<SprintAnalyticsPage />} />
            <Route path="time-report"           element={<TimeReportPage />} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
