import { Link, useLocation } from 'react-router-dom';
import { useAppStore } from '../../store/useAppStore';
import { Avatar } from '../Shared/Avatar';

const NAV = [
  { path: '/dashboard',  icon: '📊', label: 'Dashboard'       },
  { path: '/kanban',     icon: '🗂️',  label: 'Kanban',  badge: '' },
  { path: '/backlog',    icon: '📋', label: 'Backlog'          },
  { path: '/documents',  icon: '📄', label: 'Documentação'    },
  { path: '/team',       icon: '👥', label: 'Time'             },
  { path: '/import',     icon: '⬆️',  label: 'Importar'        },
  { path: '/reports',    icon: '📈', label: 'Relatórios'       },
];

export function Sidebar() {
  const { pathname } = useLocation();
  const { user, logout, sidebarCollapsed } = useAppStore();

  return (
    <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo">
        <div className="logo-icon">AF</div>
        {!sidebarCollapsed && (
          <div>
            <div style={{ fontWeight: 700, fontSize: 15 }}>AgileFlow</div>
            <div style={{ fontSize: 10, color: 'var(--text3)' }}>v1.0.0</div>
          </div>
        )}
      </div>

      <div className="nav-section">
        {!sidebarCollapsed && <div className="nav-label">Menu</div>}
        {NAV.map(n => (
          <Link key={n.path} to={n.path} style={{ textDecoration: 'none' }}>
            <div className={`nav-item ${pathname === n.path ? 'active' : ''}`}>
              <span className="nav-icon">{n.icon}</span>
              {!sidebarCollapsed && <span>{n.label}</span>}
            </div>
          </Link>
        ))}
      </div>

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
                <button onClick={logout} style={{ color: 'var(--text3)', fontSize: 14 }} title="Sair">⏻</button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
