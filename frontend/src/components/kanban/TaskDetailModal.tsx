import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { tasksApi, documentsApi } from '../../api';
import type { Task, KanbanColumn, Document } from '../../types';
import { Badge } from '../Shared/Badge';
import { Avatar } from '../Shared/Avatar';
import { TaskFormModal } from './TaskFormModal';
import { useNavigate } from 'react-router-dom';
import { CommentsSection } from './CommentsSection';
import { TimeTrackingSection } from './TimeTrackingSection';

const DOC_ICON: Record<string, string> = {
  SPEC:'📋', DIAGRAM:'🗺️', DESIGN:'🎨', REFERENCE:'📚',
  TEMPLATE:'📄', TEST_PLAN:'🧪', WIREFRAME:'✏️', RUNBOOK:'🔧', OTHER:'📝',
};
const TYPE_COLORS: Record<string, string> = {
  STORY: '#6366f1', BUG: '#ef4444', TASK: '#3b82f6',
  SPIKE: '#f97316', EPIC: '#a855f7', SUBTASK: '#64748b',
};

interface Props {
  task: Task;
  projectId: string;
  onClose: () => void;
  columns?: KanbanColumn[];
  onUpdated?: () => void;
}

export function TaskDetailModal({ task, projectId, onClose }: Props) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [newCriterion, setNewCriterion] = useState('');
  const [showLinkDoc, setShowLinkDoc] = useState(false);
  const [docSearch, setDocSearch] = useState('');
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depPickerMode, setDepPickerMode] = useState<'blocker' | 'blocking'>('blocker');
  const [depSearch, setDepSearch] = useState('');

  const { data: freshTask } = useQuery<Task>({
    queryKey: ['task-detail', task.id],
    queryFn: () => tasksApi.get(task.id).then(r => r.data.data!),
    placeholderData: task,  // mostra o prop enquanto carrega, mas sempre busca dados frescos
    staleTime: 0,           // considera os dados sempre desatualizados → refetch ao invalidar
  });

  const { data: projectDocs = [] } = useQuery<Document[]>({
    queryKey: ['docs', projectId],
    queryFn: () => documentsApi.list({ projectId }).then(r => r.data.data ?? []),
    enabled: showLinkDoc,
  });

  const { data: projectTasksData = [] } = useQuery<Task[]>({
    queryKey: ['tasks-picker', projectId],
    queryFn: () => tasksApi.list({ projectId, limit: '200' }).then(r => r.data.data ?? []),
    enabled: showDepPicker,
  });

  const linkedDocIds = new Set(
    ((freshTask?.documents ?? []) as any[]).map((td: any) => td.document?.id ?? td.documentId)
  );

  const criterionMut = useMutation({
    mutationFn: ({ cid, isDone }: { cid: string; isDone: boolean }) => tasksApi.updateCriteria(task.id, cid, isDone),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); qc.invalidateQueries({ queryKey: ['task-detail', task.id] }); },
  });

  const addCriterionMut = useMutation({
    mutationFn: () => tasksApi.update(task.id, { criteria: [...((freshTask?.criteria ?? []).map(c => ({ text: c.text, isDone: c.isDone }))), { text: newCriterion.trim(), isDone: false }] as any }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); qc.invalidateQueries({ queryKey: ['task-detail', task.id] }); setNewCriterion(''); },
  });

  const commentMut = useMutation({
    mutationFn: () => tasksApi.addComment(task.id, comment),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); qc.invalidateQueries({ queryKey: ['task-detail', task.id] }); setComment(''); },
  });

  const linkDocMut   = useMutation({ mutationFn: (documentId: string) => tasksApi.linkDoc(task.id, documentId), onSuccess: () => qc.invalidateQueries({ queryKey: ['task-detail', task.id] }) });
  const unlinkDocMut = useMutation({ mutationFn: (documentId: string) => tasksApi.unlinkDoc(task.id, documentId), onSuccess: () => qc.invalidateQueries({ queryKey: ['task-detail', task.id] }) });

  const addDependencyMut = useMutation({
    mutationFn: ({ blockerId, blockedId }: { blockerId: string; blockedId: string }) => tasksApi.addDependency(blockerId, blockedId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-detail', task.id] }); qc.invalidateQueries({ queryKey: ['tasks', projectId] }); setShowDepPicker(false); },
    onError: (err: any) => { alert(err?.response?.data?.error ?? 'Erro ao adicionar dependência.'); },
  });

  const removeDependencyMut = useMutation({
    mutationFn: (depId: string) => tasksApi.removeDependency(task.id, depId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['task-detail', task.id] }); qc.invalidateQueries({ queryKey: ['tasks', projectId] }); },
  });

  const cloneTaskMut = useMutation({
    mutationFn: () => tasksApi.clone(task.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); onClose(); },
  });

  const displayTask   = freshTask ?? task;
  const criteria      = displayTask.criteria ?? [];
  const comments      = (displayTask.comments ?? []) as any[];
  const linkedDocs    = (displayTask.documents ?? []) as any[];
  const blockedBy     = (displayTask.blockedBy ?? []) as any[];
  const blocks        = (displayTask.blocks ?? []) as any[];
  const doneCriteria  = criteria.filter(c => c.isDone).length;
  const totalCriteria = criteria.length;

  const filteredDocs = (projectDocs as Document[]).filter(d => !docSearch || d.title.toLowerCase().includes(docSearch.toLowerCase()));

  const filteredPickerTasks = (projectTasksData as Task[]).filter(t => {
    if (t.id === task.id) return false;
    if (blocks.some((d: any) => d.blocked?.id === t.id)) return false;
    if (blockedBy.some((d: any) => d.blocker?.id === t.id)) return false;
    if (!depSearch) return true;
    const q = depSearch.toLowerCase();
    return t.title.toLowerCase().includes(q) || (t.taskKey ?? '').toLowerCase().includes(q);
  });

  const DepRow = ({ dep, t, color }: { dep: any; t: any; color: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, fontSize: 13, background: `${color}0d`, border: `1px solid ${color}33` }}>
      <span style={{ fontSize: 10, background: TYPE_COLORS[t?.type] ?? '#64748b', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700 }}>{t?.type}</span>
      <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)', flexShrink: 0 }}>{t?.taskKey}</span>
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t?.title}</span>
      {t?.column?.name && <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{t.column.name}</span>}
      {t?.isClosed && <span style={{ fontSize: 10, color: 'var(--green)', flexShrink: 0 }}>✓ Feita</span>}
      <button onClick={() => removeDependencyMut.mutate(dep.id)} disabled={removeDependencyMut.isPending}
        style={{ fontSize: 11, color: 'var(--text3)', padding: '1px 5px', borderRadius: 3, background: 'var(--bg4)', flexShrink: 0 }}>✕</button>
    </div>
  );

  if (showEdit) return (
    <TaskFormModal projectId={projectId} task={displayTask} onClose={() => setShowEdit(false)}
      onSaved={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['tasks', projectId] }); qc.invalidateQueries({ queryKey: ['task-detail', task.id] }); }} />
  );

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 880 }}>

        <div style={{ padding: '20px 24px 0' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
            <code style={{ fontSize: 11, color: 'var(--text3)' }}>{displayTask.taskKey}</code>
            <Badge type="type" value={displayTask.type} />
            {displayTask.column && <span className="badge" style={{ background: 'var(--bg4)', color: 'var(--text2)' }}>{displayTask.column.name}</span>}
            <Badge type="priority" value={displayTask.priority} />
            {blockedBy.length > 0 && <span style={{ fontSize: 10, background: '#ef4444', color: '#fff', borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>⛔ Bloqueada ({blockedBy.length})</span>}
            {blocks.length > 0 && <span style={{ fontSize: 10, background: '#f97316', color: '#fff', borderRadius: 4, padding: '2px 7px', fontWeight: 700 }}>🔗 Bloqueia ({blocks.length})</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontWeight: 700, fontSize: 18, flex: 1, lineHeight: 1.3 }}>{displayTask.title}</div>
            <button
              onClick={() => cloneTaskMut.mutate()}
              disabled={cloneTaskMut.isPending}
              title="Duplicar task"
              style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg3)', cursor: 'pointer', fontSize: 12, color: 'var(--text2)', fontWeight: 600, flexShrink: 0 }}
            >📋 Duplicar</button>
            <button onClick={onClose} style={{ width: 32, height: 32, background: 'var(--bg3)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 18, flexShrink: 0 }}>✕</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 24, padding: '20px 24px', overflow: 'auto', maxHeight: 'calc(90vh - 100px)' }}>
          <div style={{ flex: 1, minWidth: 0 }}>

            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 6 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Descrição</div>
              </div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, minHeight: 60 }}>
                {displayTask.description ?? <span style={{ color: 'var(--text3)' }}>Sem descrição.</span>}
              </div>
            </div>

            {/* Criteria */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ marginBottom: 8 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>
                  Critérios de Aceite {totalCriteria > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>({doneCriteria}/{totalCriteria})</span>}
                </div>
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
                <input value={newCriterion} onChange={e => setNewCriterion(e.target.value)} placeholder="Adicionar critério..." style={{ flex: 1, fontSize: 12 }}
                  onKeyDown={e => e.key === 'Enter' && newCriterion.trim() && addCriterionMut.mutate()} />
                <button className="btn btn-ghost btn-sm" onClick={() => addCriterionMut.mutate()} disabled={!newCriterion.trim()}>+</button>
              </div>
            </div>

            {/* Dependencies */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">Dependências</div>

              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#ef4444' }}>⛔ Bloqueada por ({blockedBy.length})</span>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                    onClick={() => { setDepPickerMode('blocker'); setShowDepPicker(true); setDepSearch(''); }}>+ Adicionar</button>
                </div>
                {blockedBy.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhuma dependência bloqueante.</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {blockedBy.map((dep: any) => <DepRow key={dep.id} dep={dep} t={dep.blocker} color="#ef4444" />)}
                    </div>
                }
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#f97316' }}>🔗 Esta task bloqueia ({blocks.length})</span>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }}
                    onClick={() => { setDepPickerMode('blocking'); setShowDepPicker(true); setDepSearch(''); }}>+ Adicionar</button>
                </div>
                {blocks.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--text3)' }}>Não está bloqueando nenhuma outra task.</div>
                  : <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {blocks.map((dep: any) => <DepRow key={dep.id} dep={dep} t={dep.blocked} color="#f97316" />)}
                    </div>
                }
              </div>
            </div>

            {/* Linked Docs */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div className="section-title" style={{ marginBottom: 0 }}>Documentação Vinculada {linkedDocs.length > 0 && <span style={{ fontSize: 11, color: 'var(--text3)' }}>({linkedDocs.length})</span>}</div>
                <button className="btn btn-ghost btn-sm" style={{ fontSize: 11 }} onClick={() => { setShowLinkDoc(true); setDocSearch(''); }}>+ Vincular Doc</button>
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
                        <span style={{ flex: 1, color: 'var(--accent)', cursor: 'pointer' }} onClick={() => { onClose(); navigate(`/documents/${doc.id}`); }}>{doc.title}</span>
                        <button onClick={() => unlinkDocMut.mutate(doc.id)} style={{ fontSize: 12, color: 'var(--text3)', padding: '1px 5px', borderRadius: 3, background: 'var(--bg4)' }}>✕</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Comments */}
            <div>
              <div className="section-title">Comentários ({comments.length})</div>
              {comments.map((c: any) => (
                <div key={c.id} style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                  <Avatar name={c.author?.name ?? '?'} color={c.author?.color ?? '#6366f1'} avatarUrl={c.author?.avatarUrl} />
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

          {/* Right sidebar */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Detalhes</div>
            {[
              { k: 'Épico', v: displayTask.epic ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: displayTask.epic.color, display: 'inline-block' }} />{displayTask.epic.title}</span> : '—' },
              { k: 'Estimativa', v: displayTask.storyPoints != null ? `🎯 ${displayTask.storyPoints} pts` : '—' },
              { k: 'Sprint', v: displayTask.sprint?.name ?? '—' },
              { k: 'Prioridade', v: <Badge type="priority" value={displayTask.priority} /> },
              { k: 'Criado em', v: displayTask.createdAt ? new Date(displayTask.createdAt).toLocaleDateString('pt-BR') : '—' },
            ].map(row => (
              <div key={row.k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid rgba(45,55,72,.3)', fontSize: 13 }}>
                <span style={{ color: 'var(--text3)' }}>{row.k}</span>
                <span style={{ fontWeight: 500 }}>{row.v}</span>
              </div>
            ))}

            <div style={{ marginTop: 12, borderBottom: '1px solid rgba(45,55,72,.3)', paddingBottom: 12 }}>
              <div style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 8 }}>Responsáveis</div>
              <div className="avatar-stack">
                {(displayTask.assignees ?? []).map((a: any) => <Avatar key={a.user?.id ?? a.userId} name={a.user?.name ?? '?'} color={a.user?.color ?? '#6366f1'} avatarUrl={a.user?.avatarUrl} />)}
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

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => setShowEdit(true)}>✏️ Editar Task</button>
            </div>
          </div>
        </div>
      </div>

      {/* Doc Picker */}
      {showLinkDoc && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setShowLinkDoc(false)}>
          <div className="modal" style={{ width: 500, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>📄 Vincular Documento</div>
              <button onClick={() => setShowLinkDoc(false)} style={{ color: 'var(--text3)', fontSize: 18 }}>✕</button>
            </div>
            <input autoFocus placeholder="🔍 Buscar documentos..." value={docSearch} onChange={e => setDocSearch(e.target.value)} style={{ width: '100%', marginBottom: 14, fontSize: 13 }} />
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
                      <button className="btn btn-ghost btn-sm" style={{ fontSize: 11, color: 'var(--red)' }} onClick={() => unlinkDocMut.mutate(doc.id)} disabled={unlinkDocMut.isPending}>Desvincular</button>
                    </div>
                  );
                })}
              </div>
            )}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: 6 }}>Disponíveis</div>
              <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {filteredDocs.filter(d => !linkedDocIds.has(d.id)).length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--text3)', padding: '8px 0' }}>{docSearch ? 'Nenhum resultado.' : 'Todos os documentos já estão vinculados.'}</div>
                ) : (
                  filteredDocs.filter(d => !linkedDocIds.has(d.id)).map(doc => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 6, border: '1px solid var(--border)' }}>
                      <span>{DOC_ICON[doc.type] ?? '📄'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{doc.title}</div>
                        {(doc as any).space && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{(doc as any).space.name}</div>}
                      </div>
                      <button className="btn btn-primary btn-sm" style={{ fontSize: 11 }} onClick={() => linkDocMut.mutate(doc.id)} disabled={linkDocMut.isPending}>+ Vincular</button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div style={{ marginTop: 16, textAlign: 'right' }}><button className="btn btn-ghost" onClick={() => setShowLinkDoc(false)}>Fechar</button></div>
          </div>
        </div>
      )}

      {/* Dependency Picker */}
      {showDepPicker && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onClick={e => e.target === e.currentTarget && setShowDepPicker(false)}>
          <div className="modal" style={{ width: 540, padding: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>
                {depPickerMode === 'blocker' ? '⛔ Adicionar bloqueante' : '🔗 Selecionar task bloqueada'}
              </div>
              <button onClick={() => setShowDepPicker(false)} style={{ color: 'var(--text3)', fontSize: 18 }}>✕</button>
            </div>

            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 14, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6, lineHeight: 1.5, borderLeft: `3px solid ${depPickerMode === 'blocker' ? '#ef4444' : '#f97316'}` }}>
              {depPickerMode === 'blocker'
                ? '🔒 A task selecionada precisará ser concluída antes de iniciar esta.'
                : '⏳ Esta task precisará ser concluída antes da task selecionada.'}
            </div>

            <input autoFocus placeholder="🔍 Buscar por título ou chave (ex: AF-42)..." value={depSearch}
              onChange={e => setDepSearch(e.target.value)} style={{ width: '100%', marginBottom: 12, fontSize: 13 }} />

            <div style={{ maxHeight: 340, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {filteredPickerTasks.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>
                  {depSearch ? 'Nenhuma task encontrada.' : 'Nenhuma task disponível para vincular.'}
                </div>
              ) : (
                filteredPickerTasks.map(t => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: 'var(--bg3)', borderRadius: 6, border: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 10, background: TYPE_COLORS[t.type] ?? '#64748b', color: '#fff', borderRadius: 3, padding: '1px 5px', fontWeight: 700, flexShrink: 0 }}>{t.type}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--text3)', flexShrink: 0 }}>{t.taskKey}</span>
                    <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                    {t.column && <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>{t.column.name}</span>}
                    <button className="btn btn-primary btn-sm" style={{ fontSize: 11, flexShrink: 0 }}
                      onClick={() => { depPickerMode === 'blocker' ? addDependencyMut.mutate({ blockerId: t.id, blockedId: task.id }) : addDependencyMut.mutate({ blockerId: task.id, blockedId: t.id }); }}
                      disabled={addDependencyMut.isPending}>+ Vincular</button>
                  </div>
                ))
              )}
            </div>

            <div style={{ marginTop: 16, textAlign: 'right' }}><button className="btn btn-ghost" onClick={() => setShowDepPicker(false)}>Fechar</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
