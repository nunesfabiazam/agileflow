import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from '../../api';
import type { Task, KanbanColumn } from '../../types';
import { Badge } from '../Shared/Badge';
import { Avatar } from '../Shared/Avatar';

interface Props { task: Task; projectId: string; onClose: () => void; columns?: KanbanColumn[]; onUpdated?: () => void; }

const TYPE_LABEL:     Record<string, string> = { STORY:'História', BUG:'Bug', TASK:'Task', SPIKE:'Spike', EPIC:'Épico', SUBTASK:'Subtask' };
const PRIORITY_LABEL: Record<string, string> = { CRITICAL:'Crítica', HIGH:'Alta', MEDIUM:'Média', LOW:'Baixa' };

export function TaskDetailModal({ task, projectId, onClose }: Props) {
  const qc = useQueryClient();
  const [comment, setComment] = useState('');

  const criterionMut = useMutation({
    mutationFn: ({ cid, isDone }: { cid: string; isDone: boolean }) => tasksApi.updateCriteria(task.id, cid, isDone),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', projectId] }),
  });

  const commentMut = useMutation({
    mutationFn: () => tasksApi.addComment(task.id, comment),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); setComment(''); },
  });

  const doneCriteria = (task.criteria ?? []).filter(c => c.isDone).length;
  const totalCriteria = (task.criteria ?? []).length;

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 860 }}>
        {/* Header */}
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

        {/* Body */}
        <div style={{ display: 'flex', gap: 24, padding: '20px 24px', overflow: 'auto', maxHeight: 'calc(90vh - 100px)' }}>
          {/* Left */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Description */}
            <div style={{ marginBottom: 20 }}>
              <div className="section-title">Descrição</div>
              <div style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: 8, padding: 14, fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, minHeight: 60 }}>
                {task.description ?? <span style={{ color: 'var(--text3)' }}>Sem descrição.</span>}
              </div>
            </div>

            {/* Criteria */}
            {(task.criteria ?? []).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="section-title">Critérios de Aceite</div>
                <div className="card-sm">
                  {(task.criteria ?? []).map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13 }}>
                      <div onClick={() => criterionMut.mutate({ cid: c.id, isDone: !c.isDone })}
                        style={{ width: 16, height: 16, borderRadius: 3, border: c.isDone ? 'none' : '1px solid var(--border)', background: c.isDone ? 'var(--green)' : 'var(--bg4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, fontSize: 10, color: '#fff' }}>
                        {c.isDone ? '✓' : ''}
                      </div>
                      <span style={{ color: c.isDone ? 'var(--text)' : 'var(--text2)', textDecoration: c.isDone ? 'none' : 'none' }}>{c.text}</span>
                    </div>
                  ))}
                  {totalCriteria > 0 && (
                    <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)' }}>{doneCriteria}/{totalCriteria} critérios atendidos</div>
                  )}
                </div>
              </div>
            )}

            {/* Docs */}
            {(task.documents ?? []).length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div className="section-title">Documentação Vinculada</div>
                {(task.documents as any[]).map((td: any) => (
                  <div key={td.documentId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'var(--bg3)', borderRadius: 6, marginBottom: 6, fontSize: 13 }}>
                    <span style={{ color: 'var(--accent)' }}>📄</span>
                    <span>{td.document?.title ?? 'Documento'}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Comments */}
            <div>
              <div className="section-title">Comentários ({(task.comments ?? []).length})</div>
              {(task.comments ?? []).map((c: any) => (
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
                <input style={{ flex: 1 }} placeholder="Adicionar comentário..." value={comment} onChange={e => setComment(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && comment.trim() && commentMut.mutate()} />
                <button className="btn btn-primary btn-sm" onClick={() => commentMut.mutate()} disabled={!comment.trim()}>Enviar</button>
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div style={{ width: 220, flexShrink: 0 }}>
            <div className="section-title" style={{ marginBottom: 12 }}>Detalhes</div>
            {[
              { k: 'Épico',       v: task.epic ? <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: task.epic.color, display: 'inline-block' }} />{task.epic.title}</span> : '—' },
              { k: 'Estimativa',  v: task.storyPoints != null ? `🎯 ${task.storyPoints} pts` : '—' },
              { k: 'Sprint',      v: task.sprint?.name ?? '—' },
              { k: 'Prioridade',  v: <Badge type="priority" value={task.priority} /> },
              { k: 'Criado em',   v: task.createdAt ? new Date(task.createdAt).toLocaleDateString('pt-BR') : '—' },
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

            <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>✏️ Editar Task</button>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center' }}>📄 Vincular Doc</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
