import { useAppStore } from '../store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { projectsApi, usersApi } from '../api';
import { Avatar } from '../components/Shared/Avatar';
import type { ProjectMember } from '../types';

const ROLE_LABEL: Record<string, string> = {
  ADMIN:'Admin', PM:'Product Manager', DEVELOPER:'Desenvolvedor(a)', QA:'QA', UX:'UX Designer', SCRUM_MASTER:'Scrum Master', STAKEHOLDER:'Stakeholder', VIEWER:'Visualizador',
};

export function TeamPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);

  const { data: project } = useQuery({
    queryKey: ['project', activeProjectId],
    queryFn: () => projectsApi.get(activeProjectId!).then(r => r.data.data),
    enabled: !!activeProjectId,
  });

  if (!activeProjectId) return <div className="empty-state"><div className="empty-icon">👥</div><div className="empty-text">Selecione um projeto para ver o time.</div></div>;

  const members: ProjectMember[] = project?.members ?? [];

  return (
    <div>
      <div className="page-header">
        <h2>Time do Projeto</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm">+ Convidar Membro</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14 }}>
        {members.map(m => (
          <div className="card" key={m.userId}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <Avatar name={m.user.name} color={m.user.color} size="lg" />
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{m.user.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{ROLE_LABEL[m.user.role ?? m.role] ?? m.role}</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              Membro desde {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-BR') : '—'}
            </div>
          </div>
        ))}
      </div>

      {members.length === 0 && (
        <div className="empty-state"><div className="empty-icon">👤</div><div className="empty-text">Nenhum membro cadastrado.</div></div>
      )}
    </div>
  );
}
