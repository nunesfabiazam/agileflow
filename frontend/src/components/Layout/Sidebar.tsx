import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../../store/useAppStore';
import { projectsApi } from '../../api';
import { Avatar } from '../Shared/Avatar';
import { GlobalSearch } from '../Shared/GlobalSearch';
import { ProfileModal } from '../Shared/ProfileModal';
import { NotificationBell } from '../Shared/NotificationBell';
import type { Project } from '../../types';

const NAV = [
  { path: '/dashboard',  icon: '📊', label: 'Dashboard'    },
  { path: '/kanban',     icon: '🗂️',  label: 'Kanban'       },
  { path: '/backlog',    icon: '📋', label: 'Backlog'       },
  { path: '/epics',      icon: '🏔️', label: 'Épicos'        },
  { path: '/roadmap',    icon: '📅', label: 'Roadmap'      },
  { path: '/documents',  icon: '📄', label: 'Documentação' },
  { path: '/team',       icon: '👥', label: 'Time'          },
  { path: '/reports',    icon: '📈', label: 'Relatórios'   },
  { path: '/import',     icon: '⬆️',  label: 'Importar'     },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, sidebarCollapsed, activeProjectId, setActiveProject, addRecentProject } = useAppStore();
  const [showProjects, setShowProjects] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list().then(r => r.data.data ?? []),
  });

  const activeProject = (projects as Project[]).find(p => p.id === activeProjectId);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleSelectProject = (p: Project) => {
    setActiveProject(p.id);
    addRecentProject(p);
    setShowProjects(false);
    navigate('/kanban');
  };

  return (
    <>
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`} style={{ position: 'relative' }}>

        <div className="sidebar-logo">
          <div className="logo-icon">AF</div>
          {!sidebarCollapsed && (
            <div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>AgileFlow</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>v1.0.0</div>
            </div>
          )}
        </div>

        {/* Search Button */}
        <div style={{ padding: '0 10px 8px' }}>
          <button
            onClick={() => setShowSearch(true)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 8,
              padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
              border: '1px solid var(--border)', background: 'var(--bg3)',
              color: 'var(--text3)', transition: 'all .15s', fontSize: 13,
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; }}
            title="Busca global (⌘K)"
          >
            <span>🔍</span>
            {!sidebarCollapsed && (
              <>
                <span style={{ flex: 1, textAlign: 'left' }}>Buscar...</span>
                <kbd style={{ fontSize: 10, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, padding: '1px 5px' }}>⌘K</kbd>
              </>
            )}
          </button>
        </div>

        {!sidebarCollapsed && (
          <div style={{ padding: '0 10px 12px' }}>
            <div
              onClick={() => setShowProjects(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px',
                background: 'var(--bg3)', borderRadius: 8, cursor: 'pointer',
                border: '1px solid var(--border)', transition: 'all .15s',
              }}
              title="Trocar projeto"
            >
              {activeProject ? (
                <>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: activeProject.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 14 }}>{activeProject.iconEmoji}</span>
                  <span style={{ flex: 1, fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeProject.name}</span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 14 }}>📦</span>
                  <span style={{ flex: 1, fontSize: 12, color: 'var(--text3)' }}>Selecionar projeto</span>
                </>
              )}
              <span style={{ fontSize: 10, color: 'var(--text3)' }}>{showProjects ? '▲' : '▼'}</span>
            </div>

            {showProjects && (
              <div style={{
                position: 'absolute', left: 10, right: 10, top: 'auto',
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 10, boxShadow: '0 8px 32px rgba(0,0,0,.4)',
                zIndex: 100, overflow: 'hidden', marginTop: 4,
              }}>
                <div style={{ padding: '8px 12px 4px', fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase' }}>Projetos</div>
                {(projects as Project[]).length === 0 ? (
                  <div style={{ padding: '12px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>Nenhum projeto</div>
                ) : (
                  (projects as Project[]).map(p => (
                    <div
                      key={p.id}
                      onClick={() => handleSelectProject(p)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                        cursor: 'pointer', transition: 'background .1s',
                        background: p.id === activeProjectId ? 'rgba(99,102,241,.12)' : 'transparent',
                      }}
                      onMouseEnter={e => { if (p.id !== activeProjectId) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'; }}
                      onMouseLeave={e => { if (p.id !== activeProjectId) (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
                    >
                      <div style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 14 }}>{p.iconEmoji}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: p.id === activeProjectId ? 600 : 400 }}>{p.name}</span>
                      {p.id === activeProjectId && <span style={{ fontSize: 12, color: 'var(--accent)' }}>✓</span>}
                    </div>
                  ))
                )}
                <div style={{ borderTop: '1px solid var(--border)', padding: 8, display: 'flex', gap: 6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={() => { setShowProjects(false); navigate('/projects'); }}>📋 Ver todos</button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1, fontSize: 12 }} onClick={() => { setShowProjects(false); navigate('/projects?new=1'); }}>+ Novo</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="nav-section">
          {!sidebarCollapsed && <div className="nav-label">Menu</div>}
          {NAV.map(n => (
            <Link key={n.path} to={n.path} style={{ textDecoration: 'none' }} onClick={() => setShowProjects(false)}>
              <div className={`nav-item ${pathname === n.path ? 'active' : ''}`}>
                <span className="nav-icon">{n.icon}</span>
                {!sidebarCollapsed && <span>{n.label}</span>}
              </div>
            </Link>
          ))}
          {activeProject && !sidebarCollapsed && (
            <Link to={`/projects/${activeProjectId}/settings`} style={{ textDecoration: 'none' }} onClick={() => setShowProjects(false)}>
              <div className={`nav-item ${pathname.includes('/settings') ? 'active' : ''}`}>
                <span className="nav-icon">⚙️</span>
                <span>Config. Projeto</span>
              </div>
            </Link>
          )}
        </div>

  
          {/* Admin: user management */}
          {user?.role === 'ADMIN' && (
            <div
              onClick={() => navigate('/admin/users')}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 8, cursor: 'pointer',
                color: location.pathname === '/admin/users' ? '#fff' : 'var(--text3)',
                background: location.pathname === '/admin/users' ? 'var(--accent)' : 'transparent',
                fontSize: 13, fontWeight: 500, marginBottom: 4,
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => { if (location.pathname !== '/admin/users') (e.currentTarget as HTMLElement).style.background = 'var(--bg3)'; }}
              onMouseLeave={e => { if (location.pathname !== '/admin/users') (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              👥 Usuários
            </div>
          )}
      <div style={{ marginTop: 'auto', padding: 12, borderTop: '1px solid var(--border)' }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Avatar name={user.name} color={user.color} avatarUrl={user.avatarUrl} size="md" />
              {!sidebarCollapsed && (
                <>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{user.role}</div>
                  </div>
                  <NotificationBell />
                  <button onClick={logout} style={{ color: 'var(--text3)', fontSize: 14 }} title="Sair">⏻</button>
                </>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {showSearch  && <GlobalSearch  onClose={() => setShowSearch(false)} />}
      {showProfile && <ProfileModal  onClose={() => setShowProfile(false)} />}
    </>
  );
}
