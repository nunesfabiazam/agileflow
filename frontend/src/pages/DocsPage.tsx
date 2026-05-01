import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi, importApi } from '../api';
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
const SPACE_ICONS = ['📁', '🚀', '💡', '🛠️', '🧪', '📊', '🎨', '🔒', '📋', '🌐', '⚡', '🎯', '📌', '🗂️', '🏔️', '💎', '🔥', '⭐'];

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
  const [showImport, setShowImport]       = useState(false);
  const [newDoc, setNewDoc]               = useState({ title: '', type: 'SPEC' as DocType });
  const [newSpace, setNewSpace]           = useState({ name: '', icon: '📁' });
  const [filterType, setFilterType]       = useState<string>('');
  const [importState, setImportState]     = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [importMsg, setImportMsg]         = useState('');
  const importFileRef                     = useRef<HTMLInputElement>(null);

  // Space inline editing
  const [editingSpaceId,   setEditingSpaceId]   = useState<string | null>(null);
  const [editingSpaceName, setEditingSpaceName] = useState('');
  const [editingSpaceIcon, setEditingSpaceIcon] = useState('📁');
  const [showIconPicker,   setShowIconPicker]   = useState(false);

  // ── Queries (global — no projectId filter) ────────────────────────────────
  const { data: spaces = [] } = useQuery<DocSpace[]>({
    queryKey: ['spaces'],
    queryFn:  () => documentsApi.listSpaces().then(r => r.data.data ?? []),
  });

  const { data: docs = [] } = useQuery<Document[]>({
    queryKey: ['docs', activeSpaceId],
    queryFn:  () => documentsApi.list({
      ...(activeSpaceId !== 'all' ? { spaceId: activeSpaceId } : {}),
    }).then(r => r.data.data ?? []),
  });

  // ── Mutations ─────────────────────────────────────────────────────────────
  const createDocMut = useMutation({
    mutationFn: () => documentsApi.create({
      title: newDoc.title.trim(), type: newDoc.type, content: '', projectId: activeProjectId!,
      ...(activeSpaceId !== 'all' ? { spaceId: activeSpaceId } : {}),
    }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['docs'] });
      setShowCreate(false); setNewDoc({ title: '', type: 'SPEC' });
      const created = res.data.data;
      if (created?.id) navigate(`/documents/${created.id}`);
    },
  });

  const createSpaceMut = useMutation({
    mutationFn: () => documentsApi.createSpace({ name: newSpace.name.trim(), icon: newSpace.icon, projectId: activeProjectId! }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
      setShowNewSpace(false); setNewSpace({ name: '', icon: '📁' });
    },
  });

  const updateSpaceMut = useMutation({
    mutationFn: (vars: { id: string; name: string; icon: string }) =>
      documentsApi.updateSpace(vars.id, { name: vars.name, icon: vars.icon }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
      setEditingSpaceId(null);
      setShowIconPicker(false);
    },
  });

  const removeSpaceMut = useMutation({
    mutationFn: (id: string) => documentsApi.removeSpace(id),
    onSuccess: (_data, deletedId) => {
      qc.invalidateQueries({ queryKey: ['spaces'] });
      qc.invalidateQueries({ queryKey: ['docs'] });
      if (activeSpaceId === deletedId) setActiveSpaceId('all');
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => documentsApi.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['docs'] }),
  });

  const cloneMut = useMutation({
    mutationFn: (id: string) => documentsApi.clone(id),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['docs'] });
      if (res.data.data?.id) navigate(`/documents/${res.data.data.id}`);
    },
  });

  const handleImportFile = async (file: File) => {
    if (!activeProjectId) return;
    setImportState('loading');
    setImportMsg('');
    try {
      const spaceId = activeSpaceId !== 'all' ? activeSpaceId : undefined;
      const res = await importApi.document(file, activeProjectId, spaceId);
      qc.invalidateQueries({ queryKey: ['docs'] });
      setImportState('done');
      const docId = (res.data as any).data?.id;
      setImportMsg(`✅ "${file.name}" importado com sucesso!`);
      if (docId) setTimeout(() => { setShowImport(false); setImportState('idle'); navigate(`/documents/${docId}`); }, 1500);
    } catch (e: any) {
      setImportState('error');
      setImportMsg(e?.response?.data?.error ?? 'Erro ao importar arquivo.');
    }
  };

  const startEditSpace = (sp: DocSpace, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSpaceId(sp.id);
    setEditingSpaceName(sp.name);
    setEditingSpaceIcon(sp.icon ?? '📁');
    setShowIconPicker(false);
  };

  const saveEditSpace = () => {
    if (!editingSpaceId || !editingSpaceName.trim()) return;
    updateSpaceMut.mutate({ id: editingSpaceId, name: editingSpaceName.trim(), icon: editingSpaceIcon });
  };

  const allDocs = docs as Document[];
  const filtered = allDocs
    .filter(d => !search || d.title.toLowerCase().includes(search.toLowerCase()))
    .filter(d => !filterType || d.type === filterType);

  const recent       = [...allDocs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 5);
  const activeSpace  = (spaces as DocSpace[]).find(s => s.id === activeSpaceId);
  const canCreate    = !!activeProjectId; // still need a project to create

  return (
    <div style={{ display: 'flex', gap: 0, height: 'calc(100vh - 96px)', margin: -24 }}>

      {/* ── Spaces sidebar ──────────────────────────────────────────────── */}
      <div style={{ width: 240, flexShrink: 0, borderRight: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', flexDirection: 'column', padding: '16px 10px', overflow: 'auto' }}>

        <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', marginBottom: 8, padding: '0 6px' }}>Espaços</div>

        {/* All docs */}
        <div
          className={`nav-item ${activeSpaceId === 'all' ? 'active' : ''}`}
          onClick={() => setActiveSpaceId('all')}
        >
          <span>📄</span><span style={{ flex: 1 }}>Todos os Documentos</span>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{allDocs.length}</span>
        </div>

        {/* Space list with inline edit */}
        {(spaces as DocSpace[]).map(sp => (
          <div key={sp.id} style={{ position: 'relative' }}>
            {editingSpaceId === sp.id ? (
              /* ── Inline edit mode ── */
              <div style={{ padding: '6px 8px', background: 'var(--bg3)', borderRadius: 8, border: '1px solid var(--accent)', marginBottom: 2 }}>
                {/* Icon picker toggle */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <button
                    onClick={() => setShowIconPicker(v => !v)}
                    style={{ fontSize: 18, background: 'none', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', cursor: 'pointer', lineHeight: 1 }}
                  >{editingSpaceIcon}</button>
                  <input
                    autoFocus
                    value={editingSpaceName}
                    onChange={e => setEditingSpaceName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveEditSpace(); if (e.key === 'Escape') setEditingSpaceId(null); }}
                    style={{ flex: 1, fontSize: 13, padding: '3px 6px' }}
                  />
                </div>
                {/* Icon grid */}
                {showIconPicker && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                    {SPACE_ICONS.map(ic => (
                      <div key={ic}
                        onClick={() => { setEditingSpaceIcon(ic); setShowIconPicker(false); }}
                        style={{
                          width: 28, height: 28, fontSize: 16, borderRadius: 5, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: editingSpaceIcon === ic ? 'var(--accent)' : 'var(--bg4)',
                        }}
                      >{ic}</div>
                    ))}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => setEditingSpaceId(null)}
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text3)' }}
                  >Cancelar</button>
                  <button
                    onClick={saveEditSpace}
                    disabled={!editingSpaceName.trim() || updateSpaceMut.isPending}
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, background: 'var(--accent)', border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 600 }}
                  >Salvar</button>
                </div>
              </div>
            ) : (
              /* ── Normal mode ── */
              <div
                className={`nav-item ${activeSpaceId === sp.id ? 'active' : ''}`}
                onClick={() => setActiveSpaceId(sp.id)}
                style={{ paddingRight: 4 }}
              >
                <span>{sp.icon ?? '📁'}</span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sp.name}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{sp._count?.documents ?? 0}</span>
                {/* Edit + delete buttons (show on hover) */}
                <div
                  className="space-actions"
                  style={{ display: 'flex', gap: 2, marginLeft: 2, opacity: 0, transition: 'opacity .15s' }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                >
                  <button
                    onClick={e => startEditSpace(sp, e)}
                    title="Editar espaço"
                    style={{ fontSize: 11, padding: '1px 4px', borderRadius: 4, background: 'var(--bg4)', border: 'none', cursor: 'pointer', color: 'var(--text3)', lineHeight: 1.4 }}
                  >✏️</button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      if (confirm(`Remover espaço "${sp.name}"? Os documentos dentro serão desvinculados do espaço, não excluídos.`))
                        removeSpaceMut.mutate(sp.id);
                    }}
                    title="Remover espaço"
                    style={{ fontSize: 11, padding: '1px 4px', borderRadius: 4, background: 'var(--bg4)', border: 'none', cursor: 'pointer', color: 'var(--text3)', lineHeight: 1.4 }}
                  >✕</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Hover reveal for space actions via CSS */}
        <style>{`.nav-item:hover .space-actions { opacity: 1 !important; }`}</style>

        <div style={{ marginTop: 'auto', paddingTop: 12, borderTop: '1px solid var(--border)' }}>
          {canCreate ? (
            <button
              className="btn btn-ghost btn-sm"
              style={{ width: '100%', fontSize: 12, justifyContent: 'center' }}
              onClick={() => setShowNewSpace(true)}
            >+ Novo Espaço</button>
          ) : (
            <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '4px 0' }}>
              Selecione um projeto para criar espaços
            </div>
          )}
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
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{filtered.length} documento{filtered.length !== 1 ? 's' : ''} · todos os projetos</div>
          </div>

          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              placeholder="🔍 Buscar..."
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: 190, fontSize: 13 }}
            />
            <select
              value={filterType} onChange={e => setFilterType(e.target.value)}
              style={{ fontSize: 12, padding: '5px 8px', background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text2)' }}
            >
              <option value="">Todos os tipos</option>
              {DOC_TYPES.map(k => <option key={k} value={k}>{DOC_ICON[k]} {DOC_LABEL[k]}</option>)}
            </select>
            <div style={{ display: 'flex', border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <button onClick={() => setViewMode('list')} style={{ padding: '5px 10px', fontSize: 13, border: 'none', cursor: 'pointer', background: viewMode === 'list' ? 'var(--accent)' : 'var(--bg3)', color: viewMode === 'list' ? '#fff' : 'var(--text2)' }} title="Lista">☰</button>
              <button onClick={() => setViewMode('grid')} style={{ padding: '5px 10px', fontSize: 13, border: 'none', cursor: 'pointer', background: viewMode === 'grid' ? 'var(--accent)' : 'var(--bg3)', color: viewMode === 'grid' ? '#fff' : 'var(--text2)' }} title="Grade">⊞</button>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => { if (!canCreate) { alert('Selecione um projeto para importar documentos.'); return; } setShowImport(true); setImportState('idle'); setImportMsg(''); }}
              style={{ border: '1px solid var(--border)', opacity: canCreate ? 1 : 0.5 }}
              title={canCreate ? 'Importar documento' : 'Selecione um projeto primeiro'}
            >⬆ Importar</button>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { if (!canCreate) { alert('Selecione um projeto para criar documentos.'); return; } setShowCreate(true); }}
              title={canCreate ? 'Novo documento' : 'Selecione um projeto primeiro'}
              style={{ opacity: canCreate ? 1 : 0.6 }}
            >+ Novo Documento</button>
          </div>
        </div>

        {/* No project banner (soft, non-blocking) */}
        {!canCreate && (
          <div style={{
            background: 'rgba(99,102,241,.06)', borderBottom: '1px solid rgba(99,102,241,.15)',
            padding: '8px 24px', fontSize: 12, color: 'var(--text3)',
          }}>
            💡 Você está vendo documentos de <strong>todos os projetos</strong>. Selecione um projeto no menu para criar ou importar novos documentos.
          </div>
        )}

        <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>

          {/* Recently updated */}
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
                      cursor: 'pointer', transition: 'all .15s', maxWidth: 280,
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
                  >
                    <span style={{ fontSize: 18 }}>{DOC_ICON[doc.type] ?? '📄'}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{doc.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span>{timeAgo(doc.updatedAt)}</span>
                        {doc.project && (
                          <span style={{ background: doc.project.color + '22', color: doc.project.color, padding: '1px 5px', borderRadius: 4, fontWeight: 600 }}>
                            {doc.project.key}
                          </span>
                        )}
                      </div>
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
              {!search && !filterType && canCreate && (
                <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => setShowCreate(true)}>Criar Primeiro Documento</button>
              )}
            </div>
          ) : viewMode === 'list' ? (
            /* ── List view ── */
            <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 80px 44px', gap: 0, padding: '8px 16px', background: 'var(--bg3)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: 'var(--text3)', letterSpacing: '.06em' }}>
                <div>Título</div><div>Autor</div><div>Espaço</div><div>Projeto</div><div>Modificado</div><div></div>
              </div>
              {filtered.map((doc, idx) => (
                <div
                  key={doc.id}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 110px 110px 90px 80px 44px',
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
                    {doc.space && <span style={{ fontSize: 11, color: 'var(--accent2)', background: 'rgba(99,102,241,.1)', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap' }}>{doc.space.name}</span>}
                  </div>
                  {/* Project badge */}
                  <div>
                    {doc.project && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 8,
                        background: (doc.project.color ?? '#6366f1') + '22',
                        color: doc.project.color ?? '#6366f1',
                        whiteSpace: 'nowrap',
                      }}>{doc.project.key}</span>
                    )}
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
                    {doc.project && (
                      <span style={{
                        fontSize: 11, fontWeight: 700, padding: '1px 7px', borderRadius: 8,
                        background: (doc.project.color ?? '#6366f1') + '22',
                        color: doc.project.color ?? '#6366f1',
                      }}>{doc.project.key}</span>
                    )}
                    {doc.space && <span style={{ fontSize: 11, color: 'var(--accent2)', background: 'rgba(99,102,241,.1)', padding: '1px 8px', borderRadius: 10 }}>{doc.space.name}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Import document modal ────────────────────────────────────────────── */}
      {showImport && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowImport(false)}>
          <div className="modal" style={{ width: 520, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>⬆ Importar Documento</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 24 }}>
              Importe um arquivo para criar um novo documento no projeto <strong>{activeProjectId}</strong>.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
              {[
                { ext: '.md',   icon: '📝', label: 'Markdown',     desc: 'Arquivos .md com texto e código' },
                { ext: '.docx', icon: '📄', label: 'Word',         desc: 'Documentos Microsoft Word' },
                { ext: '.pdf',  icon: '🔴', label: 'PDF',          desc: 'Converte texto do PDF em doc' },
                { ext: '.html', icon: '🌐', label: 'HTML',         desc: 'Páginas HTML / Confluence export' },
              ].map(f => (
                <div
                  key={f.ext}
                  onClick={() => { if (importState !== 'loading') { if (importFileRef.current) { importFileRef.current.accept = f.ext; importFileRef.current.click(); } } }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '14px 16px', borderRadius: 10,
                    border: '1px solid var(--border)', cursor: importState === 'loading' ? 'wait' : 'pointer',
                    background: 'var(--bg3)', transition: 'all .15s',
                  }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(99,102,241,.06)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.background = 'var(--bg3)'; }}
                >
                  <span style={{ fontSize: 28 }}>{f.icon}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text1)' }}>{f.label}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{f.desc}</div>
                    <code style={{ fontSize: 10, color: 'var(--accent)', marginTop: 2, display: 'block' }}>{f.ext}</code>
                  </div>
                </div>
              ))}
            </div>

            <div
              onDragOver={e => { e.preventDefault(); (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; }}
              onDragLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
              onDrop={e => {
                e.preventDefault();
                (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
                const file = e.dataTransfer.files[0];
                if (file) handleImportFile(file);
              }}
              onClick={() => importFileRef.current?.click()}
              style={{
                border: '2px dashed var(--border)', borderRadius: 10, padding: '20px 0',
                textAlign: 'center', cursor: importState === 'loading' ? 'wait' : 'pointer',
                marginBottom: 16, transition: 'border-color .15s', background: 'var(--bg1)',
              }}
            >
              {importState === 'loading' ? (
                <div style={{ color: 'var(--text2)', fontSize: 13 }}>⏳ Importando...</div>
              ) : (
                <>
                  <div style={{ fontSize: 28, marginBottom: 6 }}>📂</div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600 }}>Arraste um arquivo aqui</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>ou clique para selecionar · md, docx, pdf, html</div>
                </>
              )}
            </div>

            <input
              ref={importFileRef}
              type="file"
              accept=".md,.markdown,.docx,.pdf,.html,.htm"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImportFile(f); e.target.value = ''; }}
            />

            {importMsg && (
              <div style={{
                padding: '10px 14px', borderRadius: 8, marginBottom: 12, fontSize: 13, fontWeight: 600,
                background: importState === 'done' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                color: importState === 'done' ? '#16a34a' : '#ef4444',
                border: `1px solid ${importState === 'done' ? 'rgba(34,197,94,.3)' : 'rgba(239,68,68,.3)'}`,
              }}>
                {importMsg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowImport(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}

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
