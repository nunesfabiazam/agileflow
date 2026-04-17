import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi, documentsApi } from '../../api';
import type { Task, KanbanColumn, Document } from '../../types';
import { Badge } from '../Shared/Badge';
import { Avatar } from '../Shared/Avatar';
import { TaskFormModal } from './TaskFormModal';
import { useNavigate } from 'react-router-dom';

const DOC_ICON: Record<string, string> = {
  SPEC:'📋', DIAGRAM:'🗺️', DESIGN:'🎨', REFERENCE:'📚',
  TEMPLATE:'📄', TEST_PLAN:'🧪', WIREFRAME:'✏️', RUNBOOK:'🔧', OTHER:'📝',
};

interface Props { task: Task; projectId: string; onClose: () => void; columns?: KanbanColumn[]; onUpdated?: () => void; }

export function TaskDetailModal({ task, projectId, onClose }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [newCriterion, setNewCriterion] = useState('');
  const [showLinkDoc, setShowLinkDoc] = useState(false);
  const [docSearch, setDocSearch] = useState('');

  const { data: freshTask } = useQuery<Task>({
    queryKey: ['task-detail', task.id],
    queryFn: () => tasksApi.get(task.id).then(r => r.data.data!),
    initialData: task,
  });

  const { data: projectDocs = [] } = useQuery<Document[]>({
    queryKey: ['docs', projectId],
    queryFn: () => documentsApi.list({ projectId }).then(r => r.data.data ?? []),
    enabled: showLinkDoc,
  });

  const linkedDocIds = new Set(
    ((freshTask?.documents ?? []) as any[]).map((td: any) => td.document?.id ?? td.documentId)
  );

  const criterionMut = useMutation({
    mutationFn: ({ cid, isDone }: { cid: string; isDone: boolean }) => tasksApi.updateCriteria(task.id, cid, isDone),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['task-detail', task.id] });
    },
  });

  const addCriterionMut = useMutation({
    mutationFn: () => tasksApi.update(task.id, {
      criteria: [...((freshTask?.criteria ?? []).map(c => ({ text: c.text, isDone: c.isDone }))), { text: newCriterion.trim(), isDone: false }] as any
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['task-detail', task.id] });
      setNewCriterion('');
    },
  });

  const commentMut = useMutation({
    mutationFn: () => tasksApi.addComment(task.id, comment),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['task-detail', task.id] });
      setComment('');
    },
  });

  const linkDocMut = useMutation({
    mutationFn: (documentId: string) => tasksApi.linkDoc(task.id, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-detail', task.id] }),
  });

  const unlinkDocMut = useMutation({
    mutationFn: (documentId: string) => tasksApi.unlinkDoc(task.id, documentId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['task-detail', task.id] }),
  });

  const displayTask   = freshTask ?? task;
  const criteria      = displayTask.criteria ?? [];
  const comments      = (displayTask.comments ?? []) as any[];
  const linkedDocs    = (displayTask.documents ?? []) as any[];
  const doneCriteria  = criteria.filter(c => c.isDone).length;
  const totalCriteria = criteria.length;

  const filteredDocs = (projectDocs as Document[]).filter(d =>
    !docSearch || d.title.toLowerCase().includes(docSearch.toLowerCase())
  );

  if (showEdit) return (
    <TaskFormModal projectId={projectId} task={task} onClose={() => setShowEdit(false)}
      onSaved={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['tasks', projectId] }); qc.invalidateQueries({ queryKey: ['task-detail', task.id] }); }} />
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 860 }}>
        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
            <code style={{ fontSize: 11, color: 'var(--text3)' }}>{task.taskKey}</code>
            <Badge type="type" value={task.type} />
            {task.column && <span className="badge" style={{ background: 'var(--bg4)', color: 'var(--text2)' }}>{task.column.name}</span>}
            <Badge type="priority" value={task.priority} />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 18, flex: 1, lineHeight: 1.3 }}>{task.title}</div>
            <button onClick={onClose} style={{ width: 32, height: 32, background: 'var(--bg3)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 18, flexShrink: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, padding: '20px 24px', overflow: 'auto', maxHeight: 'calc(90vh - 100px)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            <div style={{ marginBottom: 20 }}>
              <div className="section-title">Descrição</div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, minHeight: 60 }}>
                {task.description ?? <span style={{ color: 'var(--text3)' }}>Sem descrição.</span>}
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div className="section-title">
                Critérios de Aceite {totalCriteria > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>({doneCriteria}/{totalCriteria})</span>}
              </div>
              <div className="card-sm">
                {criteria.map(c => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
                    <div onClick={() => criterionMut.mutate({ cid: c.id, isDone: !c.isDone })}
                      style={{ width: 16, height: 16, borderRadius: 3, border: c.isDone ? 'none' : '1px solid var(--border)', background: c.isDone ? 'var(--green)' : 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 10, color: '#fff' }}>
                      {c.isDone ? '✓' : ''}
                    </div>
                    <span style={{ textDecoration: c.isDone ? 'line-through' : 'none', color: c.isDone ? 'var(--text3)' : 'var(--text2)' }}>{c.text}</span>
                  </div>
                ))}
                {totalCriteria === 0 && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhum critério adicionado.</div>}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input value={newCriterion} onChange={e => setNewCriterion(e.target.value)}
                  placeholder="Adicionar critério..." style={{ flex: 1, fontSize: 12 }}
                  onKeyDown={e => e.key === 'Enter' && newCriterion.trim() && addCriterionMut.mutate()} />
                <button className="btn btn-ghost btn-sm" onClick={() => addCriterionMut.mutate()} disabled={!newCriterion.trim()}>+</button>
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>
                  Documentação Vinculada {linkedDocs.length > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>({linkedDocs.length})</span>}
                </div>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                  onClick={() => { setShowLinkDoc(true); setDocSearch(''); }}>
                  + Vincular Doc
                </button>
              </div>
              {linkedDocs.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>Nenhum documento vinculado.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {linkedDocs.map((td: any) => {
                    const doc = td.document ?? td;
                    return (
                      <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6, fontSize: 13 }}>
                        <span>{DOC_ICON[doc.type] ?? '📄'}</span>
                        <span style={{ flex: 1, color: 'var(--accent)', cursor: 'pointer' }}
                          onClick={() => { onClose(); navigate(`/documents/${doc.id}`); }}>{doc.title}</span>
                        <button onClick={() => unlinkDocMut.mutate(doc.id)}
                          style={{ fontSize: 12, color: 'var(--text3)', padding: '1px 5px', borderRadius: 3, background: 'var(--bg4)' }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div className="section-title">Comentários ({comments.length})</div>
              {comments.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <Avatar name={c.author?.name ?? '?'} color={c.author?.color ?? '#6366f1'} />
                  <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, fontSize: 12, color: c.author?.color, marginBottom: 4 }}>{c.author?.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>{c.content}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{new Date(c.createdAt).toLocaleDateString('pt-BR')}</div>
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input style={{ flex: 1 }} placeholder="Adicionar comentário..." value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && comment.trim() && commentMut.mutate()} />
                <button className="btn btn-primary btn-sm" onClick={() => commentMut.mutate()} disabled={!comment.trim()}>Enviar</button>
              </div>
            </div>
          </div>

          <div style={{ width: 220, flexShrink: 0 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Detalhes</div>
            {[
              { k: 'Épico',      v: task.epic ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: task.epic.color, display: 'inline-block' }} />{task.epic.title}</span> : '—' },
              { k: 'Estimativa', v: task.storyPoints != null ? `🎯 ${task.storyPoints} pts` : '—' },
              { k: 'Sprint',     v: task.sprint?.name ?? '—' },
              { k: 'Prioridade', v: <Badge type="priority" value={task.priority} /> },
              { k: 'Criado em',  v: task.createdAt ? new Date(task.createdAt).toLocaleDateString('pt-BR') : '—' },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(45,55,72,.3)', fontSize: 13 }}>
                <span style={{ color: 'var(--text3)' }}>{row.k}</span>
                <span style={{ fontWeight: 500 }}>{row.v}</span>
              </div>
            ))}
            <div style={{ marginTop: 12, borderBottom: '1px solid rgba(45,55,72,.3)', paddingBottom: 12 }}>
              <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 8 }}>Responsáveis</div>
              <div className="avatar-stack">
                {(task.assignees ?? []).map((a: any) => <Avatar key={a.user?.id ?? a.userId} name={a.user?.name ?? '?'} color={a.user?.color ?? '#6366f1'} />)}
              </div>
            </div>
            {totalCriteria > 0 && (
              <div style={{ marginTop: 16 }}>
                <div className="section-title">Progresso</div>
                <div className="progress-bar" style={{ height: 8 }}>
                  <div className="progress-fill" style={{ width: `${Math.round((doneCriteria / totalCriteria) * 100)}%`, background: 'var(--green)' }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>{Math.round((doneCriteria / totalCriteria) * 100)}% concluído</div>
              </div>
            )}
            <div style={{ marginTop: 20 }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowEdit(true)}>
                ✏️ Editar Task
              </button>
            </div>
          </div>
        </div>
      </div>

      {showLinkDoc && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setShowLinkDoc(false)}>
          <div className="modal" style={{ width: 500, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📄 Vincular Documento</div>
              <button onClick={() => setShowLinkDoc(false)} style={{ color: 'var(--text3)', fontSize: 18 }}>✕</button>
            </div>
            <input autoFocus placeholder="🔍 Buscar documentos..." value={docSearch}
              onChange={e => setDocSearch(e.target.value)}
              style={{ width: '100%', marginBottom: 14, fontSize: 13 }} />

            {linkedDocs.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: 6 }}>Vinculados</div>
                {linkedDocs.map((td: any) => {
                  const doc = td.document ?? td;
                  if (docSearch && !doc.title.toLowerCase().includes(docSearch.toLowerCase())) return null;
                  return (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'rgba(99,102,241,.08)', border: '1px solid rgba(99,102,241,.2)', borderRadius: 6, marginBottom: 5 }}>
                      <span>{DOC_ICON[doc.type] ?? '📄'}</span>
                      <span style={{ flex: 1, fontSize: 13 }}>{doc.title}</span>
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--red)' }}
                        onClick={() => unlinkDocMut.mutate(doc.id)} disabled={unlinkDocMut.isPending}>
                        Desvincular
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: 6 }}>Disponíveis</div>
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredDocs.filter(d => !linkedDocIds.has(d.id)).length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>
                    {docSearch ? 'Nenhum resultado.' : 'Todos os documentos já estão vinculados ou não há docs no projeto.'}
                  </div>
                ) : (
                  filteredDocs.filter(d => !linkedDocIds.has(d.id)).map(doc => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span>{DOC_ICON[doc.type] ?? '📄'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{doc.title}</div>
                        {doc.space && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{(doc as any).space.name}</div>}
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }}
                        onClick={() => linkDocMut.mutate(doc.id)} disabled={linkDocMut.isPending}>
                        + Vincular
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button className="btn btn-ghost" onClick={() => setShowLinkDoc(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
