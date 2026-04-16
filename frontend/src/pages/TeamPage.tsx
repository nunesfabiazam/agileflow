import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, usersApi } from '../api';
import { Avatar } from '../components/Shared/Avatar';
import type { ProjectMember } from '../types';

const ROLE_OPTS = [
  { value: 'ADMIN',        label: 'Admin'           },
  { value: 'PM',           label: 'Product Manager' },
  { value: 'DEVELOPER',    label: 'Desenvolvedor(a)'},
  { value: 'QA',           label: 'QA'              },
  { value: 'UX',           label: 'UX Designer'     },
  { value: 'SCRUM_MASTER', label: 'Scrum Master'    },
  { value: 'STAKEHOLDER',  label: 'Stakeholder'     },
  { value: 'VIEWER',       label: 'Visualizador'    },
];

const ROLE_COLOR: Record<string, string> = {
  ADMIN: '#6366f1', PM: '#a855f7', DEVELOPER: '#3b82f6',
  QA: '#22c55e', UX: '#ec4899', SCRUM_MASTER: '#f97316',
  STAKEHOLDER: '#eab308', VIEWER: '#64748b',
};

export function TeamPage() {
  const navigate = useNavigate();
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const qc = useQueryClient();
  const [search, setSearch]           = useState('');
  const [showInvite, setShowInvite]   = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole]   = useState('DEVELOPER');
  const [inviteError, setInviteError] = useState('');

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', activeProjectId],
    queryFn: () => projectsApi.get(activeProjectId!).then(r => r.data.data),
    enabled: !!activeProjectId,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data.data ?? []),
  });

  const addMemberMut = useMutation({
    mutationFn: () => projectsApi.addMember(activeProjectId!, inviteUserId, inviteRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', activeProjectId] });
      setShowInvite(false); setInviteUserId(''); setInviteRole('DEVELOPER'); setInviteError('');
    },
    onError: (e: any) => setInviteError(e?.response?.data?.error ?? 'Erro ao adicionar membro.'),
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(activeProjectId!, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', activeProjectId] }),
  });

  if (!activeProjectId) return (
    <div className="empty-state">
      <div className="empty-icon">👥</div>
      <div className="empty-text">Selecione um projeto</div>
      <div className="empty-sub">Escolha um projeto na barra lateral para ver o time.</div>
    </div>
  );

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><div className="spinner" /></div>;

  const members: ProjectMember[] = project?.members ?? [];
  const memberUserIds = new Set(members.map((m: ProjectMember) => m.userId));
  const availableUsers = (allUsers as any[]).filter(u => !memberUserIds.has(u.id));
  const filtered = members.filter((m: ProjectMember) => m.user.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <div className="page-header">
        <h2>Time do Projeto</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(`/projects/${activeProjectId}/settings?tab=membros`)}>⚙️ Gerenciar</button>
          <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>+ Convidar Membro</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '👥', label: 'Total de Membros', value: members.length },
          { icon: '💻', label: 'Desenvolvedores', value: members.filter((m: ProjectMember) => m.role === 'DEVELOPER').length },
          { icon: '🎯', label: 'Admins / PMs', value: members.filter((m: ProjectMember) => ['ADMIN','PM','SCRUM_MASTER'].includes(m.role ?? '')).length },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 16px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <input placeholder="🔍 Buscar membro..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />

      {members.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <div className="empty-text">Nenhum membro ainda.</div>
          <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowInvite(true)}>+ Convidar Membro</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {filtered.map((m: ProjectMember) => {
            const roleLabel = ROLE_OPTS.find(r => r.value === (m.role ?? m.user.role))?.label ?? m.role;
            const roleColor = ROLE_COLOR[m.role ?? m.user.role ?? ''] ?? '#64748b';
            return (
              <div key={m.userId} className="card" style={{ position: 'relative', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: roleColor }} />
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, paddingTop: 6 }}>
                  <Avatar name={m.user.name} color={m.user.color} avatarUrl={m.user.avatarUrl} size="lg" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{m.user.name}</div>
                    <span style={{ display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 10, marginTop: 2, background: `${roleColor}25`, color: roleColor, fontWeight: 600 }}>
                      {roleLabel}
                    </span>
                  </div>
                  <button onClick={() => { if (confirm(`Remover ${m.user.name}?`)) removeMemberMut.mutate(m.userId); }}
                    style={{ color: 'var(--text3)', fontSize: 14, padding: 4, borderRadius: 4, opacity: .6 }} title="Remover">✕</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  📅 Entrou {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-BR') : '—'}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {filtered.length === 0 && search && (
        <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)' }}>Nenhum membro encontrado para "{search}".</div>
      )}

      {showInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal" style={{ width: 420, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Convidar Membro</div>
            <div className="input-group">
              <label className="input-label">Usuário</label>
              <select value={inviteUserId} onChange={e => setInviteUserId(e.target.value)} style={{ width: '100%' }}>
                <option value="">— Selecione um usuário —</option>
                {availableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
              </select>
              {availableUsers.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Todos os usuários já são membros.</div>}
            </div>
            <div className="input-group">
              <label className="input-label">Papel no Projeto</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: '100%' }}>
                {ROLE_OPTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            {inviteError && <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 12 }}>{inviteError}</div>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowInvite(false); setInviteError(''); }}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => addMemberMut.mutate()} disabled={!inviteUserId || addMemberMut.isPending}>
                {addMemberMut.isPending ? 'Adicionando...' : 'Adicionar ao Projeto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
