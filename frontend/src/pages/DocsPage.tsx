import { useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api';
import type { Document, DocType } from '../types';
import { Avatar } from '../components/Shared/Avatar';

const DOC_ICON: Record<string, string> = {
  SPEC:'📋', DIAGRAM:'🗺️', DESIGN:'🎨', REFERENCE:'📚',
  TEMPLATE:'📄', TEST_PLAN:'🧪', WIREFRAME:'✏️', RUNBOOK:'🔧', OTHER:'📝',
};
const DOC_LABEL: Record<string, string> = {
  SPEC:'Spec', DIAGRAM:'Diagrama', DESIGN:'Design', REFERENCE:'Referência',
  TEMPLATE:'Template', TEST_PLAN:'Plano de Testes', WIREFRAME:'Wireframe', RUNBOOK:'Runbook', OTHER:'Outro',
};

export function DocsPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const qc = useQueryClient();
  const [activeSpaceId, setActiveSpaceId] = useState<string | 'all'>('all');
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newDoc, setNewDoc] = useState<{ title: string; type: DocType; content: string }>({ title: '', type: 'SPEC', content: '' });

  const { data: spaces = [] } = useQuery({
    queryKey: ['spaces', activeProjectId],
    queryFn: () => documentsApi.listSpaces(activeProjectId!).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const { data: docs = [] } = useQuery({
    queryKey: ['docs', activeProjectId, activeSpaceId],
    queryFn: () => documentsApi.list({ projectId: activeProjectId!, ...(activeSpaceId !== 'all' ? { spaceId: activeSpaceId } : {}) }).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const createMut = useMutation({
    mutationFn: () => documentsApi.create({ ...newDoc, projectId: activeProjectId!, ...(activeSpaceId !== 'all' ? { spaceId: activeSpaceId } : {}) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docs', activeProjectId] }); setShowCreate(false); setNewDoc({ title: '', type: 'SPEC', content: '' }); },
  });

  const removeMut = useMutation({
    mutationFn: documentsApi.remove,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['docs', activeProjectId] }); setSelectedDoc(null); },
  });

  if (!activeProjectId) return <div className="empty-state"><div className="empty-icon">📄</div><div className="empty-text">Selecione um projeto para ver a documentação.</div></div>;

  const filtered = docs as Document[];

  return (
    <div style={{ display: 'flex', gap: 20, height: 'calc(100vh - 96px)' }}>
      {/* Spaces sidebar */}
      <div style={{ width: 200, flexShrink: 0 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--text3)', fontWeight: 600, marginBottom: 8 }}>Espaços</div>
        <div className={`nav-item ${activeSpaceId === 'all' ? 'active' : ''}`} onClick={() => setActiveSpaceId('all')}>
          <span>📁</span><span>Todos</span>
        </div>
        {(spaces as any[]).map(sp => (
          <div key={sp.id} className={`nav-item ${activeSpaceId === sp.id ? 'active' : ''}`} onClick={() => setActiveSpaceId(sp.id)}>
            <span>{sp.icon}</span><span>{sp.name}</span>
          </div>
        ))}
      </div>

      {/* Docs list */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div className="page-header">
          <h2>Documentação</h2>
          <div style={{ marginLeft: 'auto' }}>
            <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Novo Documento</button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="empty-state"><div className="empty-icon">📝</div><div className="empty-text">Nenhum documento ainda.</div><div className="empty-sub">Crie o primeiro documento deste projeto.</div></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {filtered.map(doc => (
              <div key={doc.id} className="card" style={{ cursor: 'pointer', transition: 'all .15s' }}
                onClick={() => setSelectedDoc(doc)}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.transform = ''; }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <span style={{ fontSize: 24 }}>{DOC_ICON[doc.type] ?? '📄'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{doc.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{DOC_LABEL[doc.type]} · {new Date(doc.updatedAt!).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Avatar name={doc.author?.name ?? '?'} color={doc.author?.color ?? '#6366f1'} size="sm" />
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{doc.author?.name}</span>
                  {(doc.linkedTasks as any[])?.length > 0 && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--accent2)' }}>🔗 {(doc.linkedTasks as any[]).length} tasks</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowCreate(false)}>
          <div className="modal" style={{ width: 560, padding: 28 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Novo Documento</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="input-group">
                <label className="input-label">Título</label>
                <input style={{ width: '100%' }} placeholder="Ex: Spec de Autenticação" value={newDoc.title} onChange={e => setNewDoc(d => ({ ...d, title: e.target.value }))} />
              </div>
              <div className="input-group">
                <label className="input-label">Tipo</label>
                <select style={{ width: '100%' }} value={newDoc.type} onChange={e => setNewDoc(d => ({ ...d, type: e.target.value as DocType }))}>
                  {Object.entries(DOC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Conteúdo (Markdown)</label>
                <textarea rows={8} style={{ width: '100%', resize: 'vertical', fontFamily: 'monospace', fontSize: 12 }} placeholder="# Título&#10;&#10;Escreva aqui o conteúdo do documento..." value={newDoc.content} onChange={e => setNewDoc(d => ({ ...d, content: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={() => createMut.mutate()} disabled={!newDoc.title.trim()}>Criar Documento</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Doc detail modal */}
      {selectedDoc && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setSelectedDoc(null)}>
          <div className="modal" style={{ width: 720, padding: 28, overflow: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20 }}>
              <span style={{ fontSize: 28 }}>{DOC_ICON[selectedDoc.type] ?? '📄'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 18 }}>{selectedDoc.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{DOC_LABEL[selectedDoc.type]} · v{selectedDoc.version} · Atualizado {new Date(selectedDoc.updatedAt!).toLocaleDateString('pt-BR')}</div>
              </div>
              <button style={{ color: 'var(--text3)', fontSize: 20, padding: 4 }} onClick={() => setSelectedDoc(null)}>✕</button>
            </div>
            <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: 16, minHeight: 200, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
              {selectedDoc.content ?? '(sem conteúdo)'}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn btn-danger btn-sm" onClick={() => removeMut.mutate(selectedDoc.id)}>🗑 Excluir</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
