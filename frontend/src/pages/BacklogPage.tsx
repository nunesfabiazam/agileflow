import { useAppStore } from '../store/useAppStore';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, sprintsApi, epicsApi } from '../api';
import type { Task } from '../types';
import { Badge } from '../components/Shared/Badge';
import { Avatar } from '../components/Shared/Avatar';
import { useState } from 'react';
import { TaskDetailModal } from '../components/Kanban/TaskDetailModal';

const TYPE_LABEL: Record<string, string>     = { STORY:'História', BUG:'Bug', TASK:'Task', SPIKE:'Spike', EPIC:'Épico', SUBTASK:'Subtask' };
const PRIORITY_LABEL: Record<string, string> = { CRITICAL:'Crítica', HIGH:'Alta', MEDIUM:'Média', LOW:'Baixa' };
const STATUS_LABEL: Record<string, string>   = { PLANNING:'Planejado', ACTIVE:'Ativo', COMPLETED:'Concluído', CANCELLED:'Cancelado' };

export function BacklogPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const qc = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', activeProjectId],
    queryFn: () => sprintsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ['tasks', activeProjectId],
    queryFn: () => tasksApi.list({ projectId: activeProjectId! }).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const startSprintMut = useMutation({
    mutationFn: sprintsApi.start,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', activeProjectId] }),
  });

  if (!activeProjectId) {
    return <div className="empty-state"><div className="empty-icon">📋</div><div className="empty-text">Selecione um projeto para ver o backlog.</div></div>;
  }

  const backlogTasks = tasks.filter(t => !t.sprint);

  return (
    <div>
      <div className="page-header">
        <h2>Backlog do Produto</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-primary btn-sm">+ Criar Item</button>
        </div>
      </div>

      {sprints.map(sprint => {
        const sprintTasks = tasks.filter(t => t.sprint?.id === sprint.id);
        const pts = sprintTasks.reduce((a, t) => a + (t.storyPoints ?? 0), 0);
        const done = sprintTasks.filter(t => t.column?.isDefault).length;
        return (
          <div key={sprint.id} style={{ marginBottom: 28 }}>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{sprint.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {sprint.startDate ? new Date(sprint.startDate).toLocaleDateString('pt-BR') : '—'} → {sprint.endDate ? new Date(sprint.endDate).toLocaleDateString('pt-BR') : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 20 }}>
                {[{ v: pts, l: 'Story Points' }, { v: sprintTasks.length, l: 'Itens' }, { v: done, l: 'Concluídos' }].map(s => (
                  <div key={s.l} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{s.v}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.l}</div>
                  </div>
                ))}
              </div>
              <span className={`badge badge-${sprint.status.toLowerCase()}`}>{STATUS_LABEL[sprint.status]}</span>
              {sprint.status === 'PLANNING' && (
                <button className="btn btn-primary btn-sm" onClick={() => startSprintMut.mutate(sprint.id)}>▶ Iniciar</button>
              )}
            </div>
            <TaskTable tasks={sprintTasks} onSelect={setSelectedTask} />
          </div>
        );
      })}

      {backlogTasks.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12, color: 'var(--text3)' }}>📋 Backlog (sem sprint)</div>
          <TaskTable tasks={backlogTasks} onSelect={setSelectedTask} />
        </div>
      )}

      {selectedTask && <TaskDetailModal task={selectedTask} projectId={activeProjectId} onClose={() => setSelectedTask(null)} />}
    </div>
  );
}

function TaskTable({ tasks, onSelect }: { tasks: Task[]; onSelect: (t: Task) => void }) {
  if (!tasks.length) return <div style={{ padding: '12px 0', color: 'var(--text3)', fontSize: 13 }}>Nenhum item nesta sprint.</div>;
  return (
    <table className="backlog-table">
      <thead><tr>
        <th>ID</th><th>Tipo</th><th>Título</th><th>Épico</th><th>Prioridade</th><th>Status</th><th>Pts</th><th>Responsáveis</th>
      </tr></thead>
      <tbody>
        {tasks.map(t => (
          <tr className="backlog-row" key={t.id} onClick={() => onSelect(t)}>
            <td><code style={{ fontSize: 11, color: 'var(--text3)' }}>{t.taskKey}</code></td>
            <td><Badge type="type" value={t.type} /></td>
            <td style={{ maxWidth: 340, fontSize: 13 }}>{t.title}</td>
            <td>{t.epic && <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: t.epic.color, display: 'inline-block' }} />{t.epic.title}</span>}</td>
            <td><Badge type="priority" value={t.priority} /></td>
            <td>{t.column && <span style={{ fontSize: 12, color: 'var(--text2)' }}>{t.column.name}</span>}</td>
            <td><span style={{ fontSize: 12, background: 'var(--bg4)', padding: '1px 6px', borderRadius: 4, color: 'var(--text3)' }}>🎯 {t.storyPoints ?? '—'}</span></td>
            <td>
              <div className="avatar-stack">
                {t.assignees?.map(a => <Avatar key={a.user.id} name={a.user.name} color={a.user.color} size="sm" />)}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
