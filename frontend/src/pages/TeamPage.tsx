import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi, usersApi } from '../api';
import { Avatar } from '../components/Shared/Avatar';
import type { ProjectMember } from '../types';

const ROLE_OPTS = [
  { value: 'ADMIN',        label: 'Admin',             desc: 'Acesso total ao projeto e configurações' },
  { value: 'PM',           label: 'Product Manager',   desc: 'Gerencia backlog, roadmap e prioridades'  },
  { value: 'SCRUM_MASTER', label: 'Scrum Master',      desc: 'Facilita cerimônias e remove impedimentos' },
  { value: 'DEVELOPER',    label: 'Desenvolvedor(a)',  desc: 'Implementa features e corrige bugs'        },
  { value: 'QA',           label: 'QA Engineer',       desc: 'Testa, valida e garante qualidade'         },
  { value: 'UX',           label: 'UX Designer',       desc: 'Design de experiência e interface'         },
  { value: 'STAKEHOLDER',  label: 'Stakeholder',       desc: 'Acompanha progresso, sem edição'           },
  { value: 'VIEWER',       label: 'Visualizador',      desc: 'Apenas leitura'                            },
];

const ROLE_COLOR: Record<string, string> = {
  ADMIN: '#6366f1', PM: '#a855f7', DEVELOPER: '#3b82f6',
  QA: '#22c55e', UX: '#ec4899', SCRUM_MASTER: '#f97316',
  STAKEHOLDER: '#eab308', VIEWER: '#64748b',
};

const ROLE_HIERARCHY = ['ADMIN','PM','SCRUM_MASTER','DEVELOPER','QA','UX','STAKEHOLDER','VIEWER'];

const PERMISSIONS = [
  { action: 'Criar e editar tarefas',   ADMIN: true,  PM: true,  SCRUM_MASTER: true,  DEVELOPER: true,  QA: true,  UX: true,  STAKEHOLDER: false, VIEWER: false },
  { action: 'Excluir tarefas',          ADMIN: true,  PM: true,  SCRUM_MASTER: false, DEVELOPER: false, QA: false, UX: false, STAKEHOLDER: false, VIEWER: false },
  { action: 'Gerenciar sprints',        ADMIN: true,  PM: true,  SCRUM_MASTER: true,  DEVELOPER: false, QA: false, UX: false, STAKEHOLDER: false, VIEWER: false },
  { action: 'Criar e editar épicos',    ADMIN: true,  PM: true,  SCRUM_MASTER: false, DEVELOPER: false, QA: false, UX: false, STAKEHOLDER: false, VIEWER: false },
  { action: 'Gerenciar documentos',     ADMIN: true,  PM: true,  SCRUM_MASTER: true,  DEVELOPER: true,  QA: true,  UX: true,  STAKEHOLDER: false, VIEWER: false },
  { action: 'Convidar membros',         ADMIN: true,  PM: true,  SCRUM_MASTER: false, DEVELOPER: false, QA: false, UX: false, STAKEHOLDER: false, VIEWER: false },
  { action: 'Alterar roles de membros', ADMIN: true,  PM: false, SCRUM_MASTER: false, DEVELOPER: false, QA: false, UX: false, STAKEHOLDER: false, VIEWER: false },
  { action: 'Configurar projeto',       ADMIN: true,  PM: true,  SCRUM_MASTER: false, DEVELOPER: false, QA: false, UX: false, STAKEHOLDER: false, VIEWER: false },
  { action: 'Importar dados',           ADMIN: true,  PM: true,  SCRUM_MASTER: false, DEVELOPER: false, QA: false, UX: false, STAKEHOLDER: false, VIEWER: false },
  { action: 'Ver relatórios',           ADMIN: true,  PM: true,  SCRUM_MASTER: true,  DEVELOPER: true,  QA: true,  UX: true,  STAKEHOLDER: true,  VIEWER: true  },
  { action: 'Comentar em tarefas',      ADMIN: true,  PM: true,  SCRUM_MASTER: true,  DEVELOPER: true,  QA: true,  UX: true,  STAKEHOLDER: true,  VIEWER: false },
];

const AVATAR_COLORS = ['#6366f1','#a855f7','#ec4899','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#3b82f6','#64748b'];

export function TeamPage() {
  const { user: me } = useAppStore();
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const qc = useQueryClient();

  const [tab, setTab]                     = useState<'members'|'permissions'|'manage'>('members');
  const [search, setSearch]               = useState('');
  const [showInvite, setShowInvite]       = useState(false);
  const [inviteUserId, setInviteUserId]   = useState('');
  const [inviteRole, setInviteRole]       = useState('DEVELOPER');
  const [inviteError, setInviteError]     = useState('');
  const [profileMember, setProfileMember] = useState<ProjectMember | null>(null);
  const [editMode, setEditMode]           = useState(false);
  const [editName, setEditName]           = useState('');
  const [editColor, setEditColor]         = useState('');

  const { data: project, isLoading } = useQuery({
    queryKey: ['project', activeProjectId],
    queryFn:  () => projectsApi.get(activeProjectId!).then(r => r.data.data),
    enabled:  !!activeProjectId,
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['users'],
    queryFn:  () => usersApi.list().then(r => r.data.data ?? []),
  });

  const addMemberMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      projectsApi.addMember(activeProjectId!, userId, role),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', activeProjectId] });
      setShowInvite(false); setInviteUserId(''); setInviteRole('DEVELOPER'); setInviteError('');
    },
    onError: (e: any) => setInviteError(e?.response?.data?.error ?? 'Erro ao adicionar membro.'),
  });

  const changeRoleMut = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      projectsApi.addMember(activeProjectId!, userId, role),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project', activeProjectId] }),
  });

  const removeMemberMut = useMutation({
    mutationFn: (userId: string) => projectsApi.removeMember(activeProjectId!, userId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['project', activeProjectId] }); setProfileMember(null); },
  });

  const updateProfileMut = useMutation({
    mutationFn: ({ id, name, color }: { id: string; name: string; color: string }) =>
      usersApi.update(id, { name, color }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project', activeProjectId] });
      qc.invalidateQueries({ queryKey: ['users'] });
      setEditMode(false);
    },
  });

  const toggleActiveMut = useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) =>
      usersApi.update(id, { isActive } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const changeGlobalRoleMut = useMutation({
    mutationFn: ({ id, role }: { id: string; role: string }) =>
      usersApi.update(id, { role } as any),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  if (!activeProjectId) return (
    <div className="empty-state">
      <div className="empty-icon">👥</div>
      <div className="empty-text">Selecione um projeto</div>
      <div className="empty-sub">Escolha um projeto na barra lateral para ver o time.</div>
    </div>
  );

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}><div className="spinner" /></div>
  );

  const members: ProjectMember[] = project?.members ?? [];
  const memberUserIds            = new Set(members.map(m => m.userId));
  const availableUsers           = (allUsers as any[]).filter(u => !memberUserIds.has(u.id));
  const filtered                 = members.filter(m => m.user.name.toLowerCase().includes(search.toLowerCase()));
  const isAdmin                  = me?.role === 'ADMIN' || members.find(m => m.userId === me?.id)?.role === 'ADMIN';

  return (
    <div>
      <div className="page-header">
        <h2>Time</h2>
        <button className="btn btn-primary btn-sm" onClick={() => setShowInvite(true)}>+ Convidar</button>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        {[
          { icon: '👥', label: 'Total de membros',   value: members.length },
          { icon: '💻', label: 'Desenvolvedores',    value: members.filter(m => m.role === 'DEVELOPER').length },
          { icon: '🎯', label: 'Líderes (Admin/PM)', value: members.filter(m => ['ADMIN','PM','SCRUM_MASTER'].includes(m.role ?? '')).length },
        ].map(s => (
          <div key={s.label} className="card" style={{ flex: 1, textAlign: 'center', padding: '14px 16px' }}>
            <div style={{ fontSize: 22, marginBottom: 4 }}>{s.icon}</div>
            <div style={{ fontWeight: 700, fontSize: 20 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {([
          { id: 'members',     label: '👥 Membros'              },
          { id: 'permissions', label: '🔒 Permissões'           },
          ...(isAdmin ? [{ id: 'manage', label: '⚙️ Gerenciar Usuários' }] : []),
        ] as { id: typeof tab; label: string }[]).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '8px 16px', border: 'none', cursor: 'pointer', background: 'transparent',
            fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? 'var(--accent)' : 'var(--text2)',
            borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -1, fontSize: 13, borderRadius: '4px 4px 0 0',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Members Tab ── */}
      {tab === 'members' && (
        <>
          <input placeholder="🔍 Buscar membro..." value={search}
            onChange={e => setSearch(e.target.value)} style={{ width: '100%', marginBottom: 16 }} />

          {members.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👤</div>
              <div className="empty-text">Nenhum membro ainda</div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowInvite(true)}>+ Convidar Membro</button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 12 }}>
              {filtered.map(m => {
                const roleOpt   = ROLE_OPTS.find(r => r.value === (m.role ?? m.user.role));
                const roleColor = ROLE_COLOR[m.role ?? m.user.role ?? ''] ?? '#64748b';
                return (
                  <div key={m.userId} className="card" style={{ position: 'relative', overflow: 'hidden', cursor: 'pointer', transition: 'transform .1s' }}
                    onClick={() => { setProfileMember(m); setEditMode(false); setEditName(m.user.name); setEditColor(m.user.color); }}
                    onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: roleColor }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 6 }}>
                      <Avatar name={m.user.name} color={m.user.color} avatarUrl={m.user.avatarUrl} size="lg" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.user.name}
                          {m.userId === me?.id && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text3)' }}>(você)</span>}
                        </div>

                        {isAdmin && m.userId !== me?.id ? (
                          <select value={m.role ?? m.user.role ?? 'DEVELOPER'}
                            onClick={e => e.stopPropagation()}
                            onChange={e => { e.stopPropagation(); changeRoleMut.mutate({ userId: m.userId, role: e.target.value }); }}
                            style={{
                              marginTop: 4, fontSize: 11, padding: '2px 6px', borderRadius: 10,
                              background: `${roleColor}22`, color: roleColor, border: `1px solid ${roleColor}55`,
                              fontWeight: 600, cursor: 'pointer',
                            }}>
                            {ROLE_HIERARCHY.map(rv => (
                              <option key={rv} value={rv}>{ROLE_OPTS.find(r => r.value === rv)?.label ?? rv}</option>
                            ))}
                          </select>
                        ) : (
                          <span style={{
                            display: 'inline-block', fontSize: 11, padding: '2px 8px', borderRadius: 10, marginTop: 4,
                            background: `${roleColor}22`, color: roleColor, fontWeight: 600,
                          }}>{roleOpt?.label ?? m.role}</span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, fontSize: 11, color: 'var(--text3)' }}>
                      <span>📅 {m.joinedAt ? new Date(m.joinedAt).toLocaleDateString('pt-BR') : '—'}</span>
                      <button onClick={e => { e.stopPropagation(); if (confirm(`Remover ${m.user.name}?`)) removeMemberMut.mutate(m.userId); }}
                        style={{ color: '#ef4444', fontSize: 12, padding: '2px 6px', borderRadius: 4, opacity: .6 }}
                        title="Remover do projeto">Remover</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {filtered.length === 0 && search && (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text3)' }}>
              Nenhum membro encontrado para "{search}".
            </div>
          )}
        </>
      )}

      {/* ── Permissions Tab ── */}
      {tab === 'permissions' && (
        <div>
          <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text2)' }}>
            Hierarquia de acesso e permissões por role. Roles mais altos incluem permissões dos abaixo.
          </div>

          <div style={{ display: 'flex', gap: 6, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            {ROLE_HIERARCHY.map((rv, i) => {
              const rc = ROLE_COLOR[rv] ?? '#64748b';
              const rl = ROLE_OPTS.find(r => r.value === rv)?.label ?? rv;
              return (
                <div key={rv} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ padding: '4px 12px', borderRadius: 20, background: `${rc}20`, color: rc, fontSize: 12, fontWeight: 600, border: `1px solid ${rc}40` }}>
                    {rl}
                  </div>
                  {i < ROLE_HIERARCHY.length - 1 && <span style={{ color: 'var(--text3)', fontSize: 12 }}>›</span>}
                </div>
              );
            })}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: 'var(--bg3)' }}>
                  <th style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 700, borderBottom: '1px solid var(--border)', minWidth: 180 }}>Ação</th>
                  {ROLE_HIERARCHY.map(rv => {
                    const rc = ROLE_COLOR[rv] ?? '#64748b';
                    return (
                      <th key={rv} style={{ padding: '10px 10px', textAlign: 'center', fontWeight: 700, borderBottom: '1px solid var(--border)', color: rc, whiteSpace: 'nowrap', fontSize: 11 }}>
                        {ROLE_OPTS.find(r => r.value === rv)?.label ?? rv}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {PERMISSIONS.map((p, i) => (
                  <tr key={p.action} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg3)' }}>
                    <td style={{ padding: '9px 14px', borderBottom: '1px solid var(--border)', fontWeight: 500 }}>{p.action}</td>
                    {(['ADMIN','PM','SCRUM_MASTER','DEVELOPER','QA','UX','STAKEHOLDER','VIEWER'] as const).map(rv => (
                      <td key={rv} style={{ padding: '9px 10px', textAlign: 'center', borderBottom: '1px solid var(--border)' }}>
                        {(p as any)[rv]
                          ? <span style={{ color: '#22c55e', fontSize: 15 }}>✓</span>
                          : <span style={{ color: 'var(--border)', fontSize: 15 }}>—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 16 }}>
            {ROLE_OPTS.map(r => {
              const rc = ROLE_COLOR[r.value] ?? '#64748b';
              return (
                <div key={r.value} style={{ padding: '12px 14px', borderRadius: 10, background: `${rc}10`, border: `1px solid ${rc}30` }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: rc, marginBottom: 4 }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{r.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Manage Users Tab (Admin) ── */}
      {tab === 'manage' && isAdmin && (
        <div>
          <div style={{ marginBottom: 14, fontSize: 13, color: 'var(--text2)' }}>
            Gerencie todos os usuários da plataforma. Altere roles globais ou desative contas.
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {(allUsers as any[]).map((u, i) => {
              const rc = ROLE_COLOR[u.role] ?? '#64748b';
              return (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                  borderBottom: i < (allUsers as any[]).length - 1 ? '1px solid var(--border)' : 'none',
                  opacity: u.isActive === false ? .5 : 1,
                }}>
                  <Avatar name={u.name} color={u.color} avatarUrl={u.avatarUrl} size="md" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>
                      {u.name}
                      {u.id === me?.id && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--text3)' }}>(você)</span>}
                      {u.isActive === false && <span style={{ fontSize: 10, marginLeft: 6, color: '#ef4444', fontWeight: 700 }}>INATIVO</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{u.email}</div>
                  </div>

                  <select value={u.role} disabled={u.id === me?.id}
                    onChange={e => { if (confirm(`Mudar role de ${u.name} para ${e.target.value}?`)) changeGlobalRoleMut.mutate({ id: u.id, role: e.target.value }); }}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 10, background: `${rc}18`, color: rc, border: `1px solid ${rc}40`, fontWeight: 600, cursor: u.id === me?.id ? 'default' : 'pointer' }}>
                    {ROLE_HIERARCHY.map(rv => (
                      <option key={rv} value={rv}>{ROLE_OPTS.find(r => r.value === rv)?.label ?? rv}</option>
                    ))}
                  </select>

                  {u.id !== me?.id && (
                    <button onClick={() => { const s = u.isActive !== false; if (confirm(`${s ? 'Desativar' : 'Reativar'} conta de ${u.name}?`)) toggleActiveMut.mutate({ id: u.id, isActive: !s }); }}
                      style={{
                        fontSize: 11, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', fontWeight: 600,
                        background: u.isActive !== false ? '#ef444420' : '#22c55e20',
                        color: u.isActive !== false ? '#ef4444' : '#22c55e',
                        border: u.isActive !== false ? '1px solid #ef444440' : '1px solid #22c55e40',
                      }}>
                      {u.isActive !== false ? 'Desativar' : 'Reativar'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Invite Modal ── */}
      {showInvite && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowInvite(false)}>
          <div className="modal" style={{ width: 440, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Convidar Membro</div>

            <div className="input-group">
              <label className="input-label">Usuário</label>
              <select value={inviteUserId} onChange={e => setInviteUserId(e.target.value)} style={{ width: '100%' }}>
                <option value="">— Selecione um usuário —</option>
                {availableUsers.map((u: any) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              {availableUsers.length === 0 && (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>Todos os usuários já são membros.</div>
              )}
            </div>

            <div className="input-group">
              <label className="input-label">Role no Projeto</label>
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ width: '100%' }}>
                {ROLE_OPTS.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
              </select>
            </div>

            {inviteRole && (
              <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 8, background: `${ROLE_COLOR[inviteRole]}12`, border: `1px solid ${ROLE_COLOR[inviteRole]}30` }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: ROLE_COLOR[inviteRole] }}>{ROLE_OPTS.find(r => r.value === inviteRole)?.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{ROLE_OPTS.find(r => r.value === inviteRole)?.desc}</div>
              </div>
            )}

            {inviteError && (
              <div style={{ background: '#ef444420', border: '1px solid #ef4444', borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#f87171', marginBottom: 12 }}>
                {inviteError}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => { setShowInvite(false); setInviteError(''); }}>Cancelar</button>
              <button className="btn btn-primary"
                onClick={() => addMemberMut.mutate({ userId: inviteUserId, role: inviteRole })}
                disabled={!inviteUserId || addMemberMut.isPending}>
                {addMemberMut.isPending ? 'Adicionando...' : 'Adicionar ao Projeto'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Profile Modal ── */}
      {profileMember && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setProfileMember(null)}>
          <div className="modal" style={{ width: 440, padding: 0, overflow: 'hidden' }}>
            <div style={{
              height: 72, position: 'relative',
              background: `linear-gradient(135deg, ${ROLE_COLOR[profileMember.role ?? profileMember.user.role ?? 'DEVELOPER']}50, ${ROLE_COLOR[profileMember.role ?? profileMember.user.role ?? 'DEVELOPER']}18)`,
            }}>
              <button onClick={() => setProfileMember(null)}
                style={{ position: 'absolute', top: 12, right: 12, color: 'var(--text1)', fontSize: 18, padding: 4 }}>✕</button>
            </div>

            <div style={{ padding: '0 24px 24px' }}>
              <div style={{ marginTop: -30, marginBottom: 12 }}>
                <Avatar name={profileMember.user.name} color={editMode ? editColor : profileMember.user.color}
                  avatarUrl={profileMember.user.avatarUrl} size="xl" />
              </div>

              {editMode ? (
                <div>
                  <div className="input-group">
                    <label className="input-label">Nome</label>
                    <input value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label className="input-label">Cor do Avatar</label>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {AVATAR_COLORS.map(c => (
                        <div key={c} onClick={() => setEditColor(c)} style={{
                          width: 26, height: 26, borderRadius: '50%', background: c, cursor: 'pointer',
                          boxShadow: editColor === c ? `0 0 0 2px var(--bg1), 0 0 0 4px ${c}` : 'none',
                          transition: 'box-shadow .15s',
                        }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                    <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditMode(false)}>Cancelar</button>
                    <button className="btn btn-primary" style={{ flex: 1 }}
                      onClick={() => updateProfileMut.mutate({ id: profileMember.userId, name: editName, color: editColor })}
                      disabled={!editName.trim() || updateProfileMut.isPending}>
                      {updateProfileMut.isPending ? 'Salvando...' : 'Salvar'}
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 18 }}>{profileMember.user.name}</div>
                      <div style={{ marginTop: 6 }}>
                        {(() => {
                          const rc = ROLE_COLOR[profileMember.role ?? profileMember.user.role ?? ''] ?? '#64748b';
                          const rl = ROLE_OPTS.find(r => r.value === (profileMember.role ?? profileMember.user.role))?.label;
                          return (
                            <span style={{ padding: '3px 12px', borderRadius: 12, background: `${rc}20`, color: rc, fontWeight: 600, fontSize: 12 }}>
                              {rl}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                    {(profileMember.userId === me?.id || isAdmin) && (
                      <button className="btn btn-ghost btn-sm" onClick={() => setEditMode(true)}>✏️ Editar</button>
                    )}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, marginBottom: 16 }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--text3)', minWidth: 90 }}>Membro desde</span>
                      <span>{profileMember.joinedAt ? new Date(profileMember.joinedAt).toLocaleDateString('pt-BR') : '—'}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: 'var(--text3)', minWidth: 90 }}>Role global</span>
                      <span style={{ fontWeight: 600 }}>{ROLE_OPTS.find(r => r.value === profileMember.user.role)?.label ?? profileMember.user.role}</span>
                    </div>
                  </div>

                  <div style={{
                    padding: '12px 14px', borderRadius: 8, marginBottom: 16,
                    background: `${ROLE_COLOR[profileMember.role ?? 'DEVELOPER']}10`,
                    border: `1px solid ${ROLE_COLOR[profileMember.role ?? 'DEVELOPER']}25`,
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: ROLE_COLOR[profileMember.role ?? 'DEVELOPER'], marginBottom: 3 }}>
                      {ROLE_OPTS.find(r => r.value === profileMember.role)?.label}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {ROLE_OPTS.find(r => r.value === profileMember.role)?.desc}
                    </div>
                  </div>

                  {isAdmin && profileMember.userId !== me?.id && (
                    <button
                      onClick={() => { if (confirm(`Remover ${profileMember.user.name} do projeto?`)) removeMemberMut.mutate(profileMember.userId); }}
                      style={{ width: '100%', padding: '8px 0', borderRadius: 8, cursor: 'pointer', background: '#ef444415', color: '#ef4444', border: '1px solid #ef444430', fontWeight: 600, fontSize: 13 }}>
                      Remover do projeto
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
