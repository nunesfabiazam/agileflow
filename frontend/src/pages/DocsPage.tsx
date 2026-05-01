import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api';
import { Avatar } from '../components/Shared/Avatar';
import type { Document, DocType, DocSpace } from '../types';

const DOC_ICON: Record<string, string> = {
  SPEC: '📋', DIAGRAM: '🗺️', DESIGN: '🎨', REFERENCE: '📚',
  TEMPLATE: '📄', TEST_PLAN: '🧪', WIREFRAME: '✏️', RUNBOOK: '🔧', OTHER: '📝',
};
const DOC_LABEL: Record<string, string> = {
  SPEC: 'Spec', DIAGRAM: 'Diagrama', DESIGN: 'Design', REFERENCE: 'Referência',
  TEMPLATE: 'Template', TEST_PLAN: 'Plano de Testes', WIREFRAME: 'Wireframe', RUNBOOK: 'Runbook', OTHER: 'Outro',
};
const DOC_TYPES = Object.keys(DOC_LABEL) as DocType[];
const SPACE_ICONS = ['📁', '🚀', '💡', '🛠️', '🧪', '📊', '🎨', '🔒', '📋', '🌐', '⚡', '🎯'];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'agora';
  if (m < 60) return `${m}min atrás`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h atrás`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d atrás`;
  return new Date(iso).toLocaleDateString('pt-BR');
}

export function DocsPage() {
  const navigate = useNavigate();
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const qc = useQueryClient();

  const [activeSpaceId, setActiveSpaceId] = useState<string | 'all'>('all');
  const [search, setSearch]               = useState('');
  const [viewMode, setViewMode]           = useState<'grid' | 'list'>('list');
  const [showCreate, setShowCreate]       = useState(false);
  const [showNewSpace, setShowNewSpace]   = useState(false);
  const [newDoc, setNewDoc]               = useState({ title: '', type: 'SPEC' as DocType });
  const [newSpace, setNewSpace]           = useState({ name: '', icon: '📁' });
  const [filterType, setFilterType]       = useState<string>('');

  const { data: spaces = [] } = useQuery<DocSpace[]>({
    queryKey: ['spaces', activeProjectId],
    queryFn:  () => documentsApi.listSpaces(activeProjectId!).then(r => r.data.data ?? []),
    enabled:  !!activeProjectId,
  });

  const { data: docs = [] } = useQuery<Document[]>({
    queryKey: ['docs', activeProjectId, activeSpaceId],
    queryFn:  () => documentsApi.list({
      projectId: activeProjectId!,
      ...(activeSpaceId !== 'all' ? { spaceId: activeSpaceId } : {}),
    }).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const createDocMut = useMutation({
    mutationFn: () => documentsApi.create({
      title: newDoc.title.trim(), type: newDoc.type, content: '', projectId: activeProjectId!,
      ...(activeSpaceId !== 'all' ? { spaceId: activeSpaceId } : {}),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['docs', activeProjectId] });
      setShowCreate(false); setNewDoc({ title: '', type: 'SPEC' });
      const created = res.data.data;
      if (created?.id) navigate(`/documents/${created.id}`);
    },
  });

  const createSpaceMut = useMutation({
    mutationFn: () => documentsApi.createSpace({ name: newSpace.name.trim(), icon: newSpace.icon, projectId: activeProjectId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces', activeProjectId] });
      setShowNewSpace(false); setNewSpace({ name: '', icon: '📁' });
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs', activeProjectId] }),
  });

  const cloneMut = useMutation({
    mutationFn: (id: string) => documentsApi.clone(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['docs', activeProjectId] });
      // Navigate to cloned doc for editing
      if (res.data.data?.id) navigate(`/documents/${res.data.data.id}`);
    },
  });

  if (!activeProjectId) return (
    <div className="empty-state">
      <div className="empty-icon">📄</div>
      <div className="empty-text">Selecione um projeto para acessar a documentação.</div>
    </div>
  );

  const allDocs = docs as Document[];
  const filtered = allDocs
    .filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()))
    .filter(d => !filterType || d.type === filterType);

  const recent  = [...allDocs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  const activeSpace = (spaces as DocSpace[]).find(s => s.id === activeSpaceId);

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 96px)', margin: -24 }}>

      {/* ── Spaces sidebar ──────────────────────────────────────────────── */}
      <div style={{ width: 230, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', flexDirection: 'column', padding: '16px 10px', overflow: 'auto' }}>

        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 8, padding: '0 6px' }}>Espaços</div>

        <div
          className={`nav-item ${activeSpaceId === 'all' ? 'active' : ''}`}
          onClick={() => setActiveSpaceId('all')}
        >
          <span>📁</span><span style={{ flex: 1 }}>Todos os Docs</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{allDocs.length}</span>
        </div>

        {(spaces as DocSpace[]).map(sp => (
          <div
            key={sp.id}
            className={`nav-item ${activeSpaceId === sp.id ? 'active' : ''}`}
            onClick={() => setActiveSpaceId(sp.id)}
          >
            <span>{sp.icon ?? '📁'}</span>
            <span style={{ flex: 1 }}>{sp.name}</span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{sp._count?.documents ?? 0}</span>
          </div>
        ))}

        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', fontSize: 12, justifyContent: 'center' }}
            onClick={() => setShowNewSpace(true)}
          >+ Novo Espaço</button>
        </div>
      </div>

      {/* ── Main area ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, flexWrap: 'wrap' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {activeSpaceId === 'all' ? '📄 Documentação' : `${activeSpace?.icon ?? '📁'} ${activeSpace?.name}`}
            </h2>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{filtered.length} documento{filtered.length !== 1 ? 's' : ''}</div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search */}
            <input
              placeholder="🔍 Buscar..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: 190, fontSize: 13 }}
            />
            {/* Type filter */}
            <select
              value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ fontSize: 12, padding: '5px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}
            >
              <option value="">Todos os tipos</option>
              {DOC_TYPES.map(k => <option key={k} value={k}>{DOC_ICON[k]} {DOC_LABEL[k]}</option>)}
            </select>
            {/* View toggle */}
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <button onClick={() => setViewMode('list')} style={{ padding: '5px 10px', fontSize: 13, border: 'none', cursor: 'pointer', background: viewMode === 'list' ? 'var(--accent)' : 'var(--bg3)', color: viewMode === 'list' ? '#fff' : 'var(--text2)' }} title="Lista">☰</button>
              <button onClick={() => setViewMode('grid')} style={{ padding: '5px 10px', fontSize: 13, border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? 'var(--accent)' : 'var(--bg3)', color: viewMode === 'grid' ? '#fff' : 'var(--text2)' }} title="Grade">⊞</button>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Novo Documento</button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* Recently updated (only when showing "all" and no search) */}
          {activeSpaceId === 'all' && !search && !filterType && recent.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', marginBottom: 10 }}>⏱ Atualizados recentemente</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {recent.map(doc => (
                  <div
                    key={doc.id}
                    onClick={() => navigate(`/documents/${doc.id}`)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                      background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8,
                      cursor: 'pointer', transition: 'all .15s', maxWidth: 260,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                  >
                    <span style={{ fontSize: 18 }}>{DOC_ICON[doc.type] ?? '📄'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(doc.updatedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Document list/grid */}
          {filtered.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📝</div>
              <div className="empty-text">{search ? `Nenhum resultado para "${search}".` : 'Nenhum documento ainda.'}</div>
              {!search && !filterType && <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>Criar Primeiro Documento</button>}
            </div>
          ) : viewMode === 'list' ? (
            /* ── List view ── */
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 110px 80px 40px', gap: 0, padding: '8px 16px', background: 'var(--bg3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '.06em' }}>
                <div>Título</div><div>Autor</div><div>Espaço</div><div>Modificado</div><div></div>
              </div>
              {filtered.map((doc, idx) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 120px 110px 80px 40px',
                    gap: 0, padding: '10px 16px', cursor: 'pointer',
                    borderTop: idx > 0 ? '1px solid var(--border)' : 'none',
                    background: 'transparent', transition: 'background .1s', alignItems: 'center',
                  }}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'}
                  onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = 'transparent'}
                >
                  {/* Title */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>{DOC_ICON[doc.type] ?? '📄'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{DOC_LABEL[doc.type]} · v{doc.version}</div>
                    </div>
                  </div>
                  {/* Author */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {doc.author && <><Avatar name={doc.author.name} color={doc.author.color} size="sm" /><span style={{ fontSize: 12, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.author.name}</span></>}
                  </div>
                  {/* Space */}
                  <div>
                    {doc.space && <span style={{ fontSize: 11, color: 'var(--accent2)', background: 'rgba(99,102,241,.1)', padding: '2px 8px', borderRadius: 10 }}>{doc.space.name}</span>}
                  </div>
                  {/* Modified */}
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{timeAgo(doc.updatedAt)}</div>
                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                    <button
                      onClick={e => { e.stopPropagation(); cloneMut.mutate(doc.id); }}
                      title="Duplicar documento"
                      style={{ color: 'var(--text3)', fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--bg3)', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}
                    >📋</button>
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm(`Excluir "${doc.title}"?`)) removeMut.mutate(doc.id); }}
                      style={{ color: 'var(--text3)', fontSize: 13, padding: '2px 6px', borderRadius: 4, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.5 }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '1'; (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.5'; (e.currentTarget as HTMLButtonElement).style.color = 'var(--text3)'; }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* ── Grid view ── */
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
              {filtered.map(doc => (
                <div
                  key={doc.id}
                  className="card"
                  style={{ cursor: 'pointer', transition: 'all .15s', position: 'relative' }}
                  onClick={() => navigate(`/documents/${doc.id}`)}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = ''; }}
                >
                  <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
                    <button
                      onClick={e => { e.stopPropagation(); cloneMut.mutate(doc.id); }}
                      title="Duplicar"
                      style={{ color: 'var(--text3)', fontSize: 11, padding: '2px 7px', borderRadius: 4, background: 'var(--bg4)', opacity: 0, transition: 'opacity .15s', border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600 }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0'}
                    >📋</button>
                    <button
                      onClick={e => { e.stopPropagation(); if (confirm(`Excluir "${doc.title}"?`)) removeMut.mutate(doc.id); }}
                      style={{ color: 'var(--text3)', fontSize: 13, padding: '2px 6px', borderRadius: 4, background: 'var(--bg4)', opacity: 0, transition: 'opacity .15s', border: 'none', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.opacity = '1'}
                      onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.opacity = '0'}
                    >✕</button>
                  </div>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                    <span style={{ fontSize: 26 }}>{DOC_ICON[doc.type] ?? '📄'}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{DOC_LABEL[doc.type]} · v{doc.version} · {timeAgo(doc.updatedAt)}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
                    <Avatar name={doc.author?.name ?? '?'} color={doc.author?.color ?? '#6366f1'} size="sm" />
                    <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1 }}>{doc.author?.name}</span>
                    {doc.space && <span style={{ fontSize: 11, color: 'var(--accent2)', background: 'rgba(99,102,241,.1)', padding: '1px 8px', borderRadius: 10 }}>{doc.space.name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Create document modal ─────────────────────────────────────────── */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ width: 480, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>📝 Novo Documento</div>
            <div className="input-group">
              <label className="input-label">Título</label>
              <input autoFocus style={{ width: '100%' }} placeholder="Ex: Spec de Autenticação" value={newDoc.title}
                onChange={e => setNewDoc(d => ({ ...d, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && newDoc.title.trim() && createDocMut.mutate()} />
            </div>
            <div className="input-group">
              <label className="input-label">Tipo</label>
              <select style={{ width: '100%' }} value={newDoc.type} onChange={e => setNewDoc(d => ({ ...d, type: e.target.value as DocType }))}>
                {DOC_TYPES.map(k => <option key={k} value={k}>{DOC_ICON[k]} {DOC_LABEL[k]}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => createDocMut.mutate()} disabled={!newDoc.title.trim() || createDocMut.isPending}>
                {createDocMut.isPending ? 'Criando...' : 'Criar e Abrir Editor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create space modal ────────────────────────────────────────────── */}
      {showNewSpace && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowNewSpace(false)}>
          <div className="modal" style={{ width: 380, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>📁 Novo Espaço</div>
            <div className="input-group">
              <label className="input-label">Nome</label>
              <input autoFocus style={{ width: '100%' }} placeholder="Ex: Engenharia, Produto..." value={newSpace.name}
                onChange={e => setNewSpace(s => ({ ...s, name: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && newSpace.name.trim() && createSpaceMut.mutate()} />
            </div>
            <div className="input-group">
              <label className="input-label">Ícone</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {SPACE_ICONS.map(ic => (
                  <div key={ic} onClick={() => setNewSpace(s => ({ ...s, icon: ic }))} style={{
                    width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: newSpace.icon === ic ? 'var(--accent)' : 'var(--bg3)',
                    boxShadow: newSpace.icon === ic ? '0 0 0 2px var(--accent)' : 'none',
                  }}>{ic}</div>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn btn-ghost" onClick={() => setShowNewSpace(false)}>Cancelar</button>
              <button className="btn btn-primary" onClick={() => createSpaceMut.mutate()} disabled={!newSpace.name.trim() || createSpaceMut.isPending}>
                {createSpaceMut.isPending ? 'Criando...' : 'Criar Espaço'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
