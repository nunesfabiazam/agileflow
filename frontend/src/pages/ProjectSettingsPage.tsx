import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, usersApi } from '../api';
import { Avatar } from '../components/Shared/Avatar';
import { useAppStore } from '../store/useAppStore';
import type { ProjectMember } from '../types';

const COLORS = ['#6366f1','#22c55e','#f97316','#3b82f6','#a855f7','#eab308','#ef4444','#06b6d4','#ec4899'];
const EMOJIS = ['📦','🚀','💡','🔥','⚡','🎯','🛠️','🌟','🏆','📱','🌐','🔒','🤖','📊','🎨'];

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

type Tab = 'geral' | 'membros' | 'danger';

export function ProjectSettingsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { activeProjectId, setActiveProject } = useAppStore();
  const projectId = id ?? activeProjectId ?? '';

  const [tab, setTab] = useState<Tab>('geral');
  const [saved, setSaved] = useState(false);
  const [name, setName]         = useState('');
  const [desc, setDesc]         = useState('');
  const [color, setColor]       = useState('#6366f1');
  const [emoji, setEmoji]       = useState('📦');
  const [formReady, setFormReady] = useState(false);
  const [search, setSearch]         = useState('');
  const [showInvite, setShowInvite] = useState(false);
  const [inviteUserId, setInviteUserId] = useState('');
  const [inviteRole, setInviteRole]   = useState('DEVELOPER');
  const [inviteError, setInviteError] = useState('');

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => projectsApi.get(projectId).then(r => r.data.data),
    enabled: !!projectId,
    onSuccess: (p: any) => {
      if (!formReady) {
        setName(p.name ?? '');
        setDesc(p.description ?? '');
        setColor(p.color ?? '#6366f1');
        setEmoji(p.iconEmoji ?? '📦');
        setFormReady(true);
      }
    },
  } as any);

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => usersApi.list().then(r => r.data.data ?? []),
  });

  const updateMut = useMutation({
    mutationFn: () => projectsApi.update(projectId, { name: name.trim(), description: desc.trim() || undefined, color, iconEmoji: emoji }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      qc.invalidateQueries({ queryKey: ['projects'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const addMemberMut = useMutation({
    mutationFn: () => projectsApi.addMember(projectId, inviteUserId, inviteRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', projectId] });
      setShowInvite(false); setInviteUserId(''); setInviteRole('DEVELOPER'); setInviteError('');
    },
    onError: (e: any) => setInviteError(e?.response?.data?.error ?? 'Erro ao adicionar membro.'),
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(projectId, userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const updateRoleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) => projectsApi.addMember(projectId, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', projectId] }),
  });

  const archiveMut = useMutation({
    mutationFn: () => projectsApi.update(projectId, { isArchived: true }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      if (activeProjectId === projectId) setActiveProject('');
      navigate('/projects');
    },
  });

  if (!projectId) return <div className="empty-state"><div className="empty-icon">⚙️</div><div className="empty-text">Selecione um projeto para configurar.</div></div>;
  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><div className="spinner" /></div>;
  if (!project) return <div className="empty-state"><div className="empty-icon">❌</div><div className="empty-text">Projeto não encontrado.</div></div>;

  const members: ProjectMember[] = project.members ?? [];
  const memberUserIds = new Set(members.map((m: ProjectMember) => m.userId));
  const availableUsers = (allUsers as any[]).filter(u => !memberUserIds.has(u.id));
  const filteredMembers = members.filter((m: ProjectMember) =>
    m.user.name.toLowerCase().includes(search.toLowerCase())
  );

  const tabStyle = (t: Tab) => ({
    padding: '8px 18px', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 500,
    background: tab === t ? 'var(--accent)' : 'transparent',
    color: tab === t ? '#fff' : 'var(--text2)', border: 'none', transition: 'all .15s',
  });

  return (
    <div style={{ maxWidth: 780, margin: '0 auto' }}>
      <div className="page-header" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => navigate(-1)} style={{ color: 'var(--text3)', fontSize: 18, padding: '4px 8px', borderRadius: 6, background: 'var(--bg3)' }}>←</button>
          <span style={{ fontSize: 22 }}>{project.iconEmoji}</span>
          <div>
            <h2 style={{ margin: 0 }}>{project.name}</h2>
            <code style={{ fontSize: 12, color: 'var(--text3)' }}>{project.key}</code>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'var(--bg2)', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        <button style={tabStyle('geral')}   onClick={() => setTab('geral')}>  ⚙️ Geral</button>
        <button style={tabStyle('membros')} onClick={() => setTab('membros')}>👥 Membros ({members.length})</button>
        <button style={tabStyle('danger')}  onClick={() => setTab('danger')}> ⚠️ Danger Zone</button>
      </div>

      {tab === 'geral' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Configurações Gerais</div>
          <div className="input-group">
            <label className="input-label">Nome do Projeto</label>
            <input value={name} onChange={e => setName(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div className="input-group">
            <label className="input-label">Descrição</label>
            <textarea rows={3} value={desc} onChange={e => setDesc(e.target.value)}
              placeholder="Descreva o objetivo do projeto..."
              style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
          </div>
          <div className="input-group">
            <label className="input-label">Cor do Projeto</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setColor(c)} style={{
                  width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer',
                  border: color === c ? '3px solid #fff' : '3px solid transparent',
                  boxShadow: color === c ? '0 0 0 2px var(--accent)' : 'none', transition: 'all .15s',
                }} />
              ))}
            </div>
          </div>
          <div className="input-group">
            <label className="input-label">Ícone do Projeto</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EMOJIS.map(e => (
                <div key={e} onClick={() => setEmoji(e)} style={{
                  width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 20, cursor: 'pointer', transition: 'all .15s',
                  background: emoji === e ? 'var(--accent)' : 'var(--bg3)',
                  boxShadow: emoji === e ? '0 0 0 2px var(--accent)' : 'none',
                }}>{e}</div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'var(--bg3)', borderRadius: 8, borderLeft: `4px solid ${color}` }}>
            <span style={{ fontSize: 24 }}>{emoji}</span>
            <div>
              <div style={{ fontWeight: 700 }}>{name || 'Nome do Projeto'}</div>
              {desc && <div style={{ fontSize: 12, color: 'var(--text3)' }}>{desc}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', alignItems: 'center' }}>
            {saved && <span style={{ fontSize: 13, color: 'var(--green)' }}>✅ Salvo!</span>}
            <button className="btn btn-primary" onClick={() => updateMut.mutate()} disabled={!name.trim() || updateMut.isPending}>
              {updateMut.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </div>
        </div>
      )}

      {tab === 'membros' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input placeholder="🔍 Buscar membro..." value={search} onChange={e => setSearch(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>+ Adicionar Membro</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {filteredMembers.map((m: ProjectMember) => (
              <div key={m.userId} className="card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px' }}>
                <Avatar name={m.user.name} color={m.user.color} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{m.user.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                    {m.joinedAt ? `Desde ${new Date(m.joinedAt).toLocaleDateString('pt-BR')}` : 'Membro'}
                  </div>
                </div>
                <select value={m.role} onChange={e => updateRoleMut.mutate({ userId: m.userId, role: e.target.value })} style={{ fontSize: 12, padding: '4px 8px' }}>
                  {ROLE_OPTS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
                <button className="btn btn-ghost btn-sm" style={{ color: '#ef4444', fontSize: 12 }}
                  onClick={() => { if (confirm(`Remover ${m.user.name} do projeto?`)) removeMemberMut.mutate(m.userId); }}>
                  ✕ Remover
                </button>
              </div>
            ))}
            {filteredMembers.length === 0 && (
              <div className="empty-state" style={{ padding: '30px 0' }}>
                <div className="empty-icon">👤</div>
                <div className="empty-text">{search ? 'Nenhum membro encontrado.' : 'Nenhum membro ainda.'}</div>
              </div>
            )}
          </div>
          {showInvite && (
            <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
              <div className="modal" style={{ width: 420, padding: 28 }}>
                <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Adicionar Membro</div>
                <div className="input-group">
                  <label className="input-label">Usuário</label>
                  <select value={inviteUserId} onChange={e => setInviteUserId(e.target.value)} style={{ width: '100%' }}>
                    <option value="">— Selecione um usuário —</option>
                    {availableUsers.map((u: any) => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
                  </select>
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
                    {addMemberMut.isPending ? 'Adicionando...' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'danger' && (
        <div className="card" style={{ border: '1px solid #ef444440' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#f87171', marginBottom: 16 }}>⚠️ Danger Zone</div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>Arquivar Projeto</div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>O projeto ficará oculto mas todos os dados serão preservados.</div>
            </div>
            <button className="btn btn-sm" style={{ background: '#ef444415', border: '1px solid #ef4444', color: '#f87171', flexShrink: 0, marginLeft: 16 }}
              onClick={() => { if (confirm(`Arquivar o projeto "${project.name}"?`)) archiveMut.mutate(); }}
              disabled={archiveMut.isPending}>
              {archiveMut.isPending ? 'Arquivando...' : '📦 Arquivar Projeto'}
            </button>
          </div>
          <div style={{ padding: '16px 0 0', opacity: .5 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>Excluir Projeto</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>⚠️ Ação irreversível. Contate o administrador para excluir um projeto.</div>
          </div>
        </div>
      )}
    </div>
  );
}
