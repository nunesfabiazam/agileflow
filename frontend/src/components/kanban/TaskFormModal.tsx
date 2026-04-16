import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi, sprintsApi, epicsApi, usersApi, columnsApi } from '../../api';
import type { Task, TaskType, TaskPriority } from '../../types';

interface Props {
  projectId: string;
  task?: Task;
  defaultColumnId?: string;
  onClose: () => void;
  onSaved: () => void;
}

const TYPE_OPTS: { value: TaskType; label: string; emoji: string }[] = [
  { value: 'STORY',   label: 'História',  emoji: '📖' },
  { value: 'BUG',     label: 'Bug',       emoji: '🐛' },
  { value: 'TASK',    label: 'Task',      emoji: '✅' },
  { value: 'SPIKE',   label: 'Spike',     emoji: '⚡' },
  { value: 'EPIC',    label: 'Épico',     emoji: '🏔️' },
  { value: 'SUBTASK', label: 'Subtask',   emoji: '🔹' },
];

const PRIO_OPTS: { value: TaskPriority; label: string }[] = [
  { value: 'CRITICAL', label: 'Crítica' },
  { value: 'HIGH',     label: 'Alta'    },
  { value: 'MEDIUM',   label: 'Média'   },
  { value: 'LOW',      label: 'Baixa'   },
];

export function TaskFormModal({ projectId, task, defaultColumnId, onClose, onSaved }: Props) {
  const qc = useQueryClient();
  const isEdit = !!task;

  const [title, setTitle]             = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [type, setType]               = useState<TaskType>(task?.type ?? 'TASK');
  const [priority, setPriority]       = useState<TaskPriority>(task?.priority ?? 'MEDIUM');
  const [points, setPoints]           = useState(task?.storyPoints?.toString() ?? '');
  const [columnId, setColumnId]       = useState(task?.column?.id ?? defaultColumnId ?? '');
  const [sprintId, setSprintId]       = useState(task?.sprint?.id ?? '');
  const [epicId, setEpicId]           = useState(task?.epic?.id ?? '');
  const [assigneeIds, setAssigneeIds] = useState<string[]>(task?.assignees?.map(a => a.user.id) ?? []);
  const [dueDate, setDueDate]         = useState(task?.dueDate ? task.dueDate.slice(0, 10) : '');
  const [criteria, setCriteria]       = useState<Array<{ text: string; isDone: boolean }>>(
    task?.criteria?.map(c => ({ text: c.text, isDone: c.isDone })) ?? []
  );
  const [newCriterion, setNewCriterion] = useState('');

  const { data: cols = [] }    = useQuery({ queryKey: ['columns', projectId], queryFn: () => columnsApi.list(projectId).then(r => r.data.data ?? []) });
  const { data: sprints = [] } = useQuery({ queryKey: ['sprints', projectId], queryFn: () => sprintsApi.list(projectId).then(r => r.data.data ?? []) });
  const { data: epics = [] }   = useQuery({ queryKey: ['epics', projectId], queryFn: () => epicsApi.list(projectId).then(r => r.data.data ?? []) });
  const { data: users = [] }   = useQuery({ queryKey: ['users'], queryFn: () => usersApi.list().then(r => r.data.data ?? []) });

  useEffect(() => { if (!columnId && cols.length > 0) setColumnId(cols[0].id); }, [cols, columnId]);

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {
        title: title.trim(), description: description.trim() || undefined,
        type, priority,
        storyPoints: points ? parseInt(points) : undefined,
        columnId: columnId || undefined, sprintId: sprintId || undefined,
        epicId: epicId || undefined, assigneeIds,
        dueDate: dueDate || undefined, criteria: criteria as any,
      };
      return isEdit ? tasksApi.update(task!.id, payload) : tasksApi.create({ ...payload, projectId });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['tasks', projectId] }); onSaved(); onClose(); },
  });

  const addCriterion = () => {
    if (!newCriterion.trim()) return;
    setCriteria(c => [...c, { text: newCriterion.trim(), isDone: false }]);
    setNewCriterion('');
  };

  const toggleAssignee = (uid: string) =>
    setAssigneeIds(ids => ids.includes(uid) ? ids.filter(i => i !== uid) : [...ids, uid]);

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 780, maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{isEdit ? '✏️ Editar Task' : '➕ Nova Task'}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, background: 'var(--bg3)', borderRadius: 6, color: 'var(--text3)', fontSize: 18 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="input-group">
              <label className="input-label">Título *</label>
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Ex: Implementar tela de login" style={{ width: '100%', fontSize: 15 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div className="input-group">
                <label className="input-label">Tipo</label>
                <select value={type} onChange={e => setType(e.target.value as TaskType)} style={{ width: '100%' }}>
                  {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.emoji} {o.label}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Prioridade</label>
                <select value={priority} onChange={e => setPriority(e.target.value as TaskPriority)} style={{ width: '100%' }}>
                  {PRIO_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
            <div className="input-group">
              <label className="input-label">Descrição</label>
              <textarea rows={4} value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Descreva o que precisa ser feito..."
                style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13 }} />
            </div>
            <div className="input-group">
              <label className="input-label">Critérios de Aceite</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                {criteria.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg3)', borderRadius: 6, padding: '6px 10px' }}>
                    <span style={{ fontSize: 12, color: 'var(--green)' }}>✓</span>
                    <span style={{ flex: 1, fontSize: 13 }}>{c.text}</span>
                    <button onClick={() => setCriteria(cr => cr.filter((_, j) => j !== i))} style={{ color: 'var(--text3)', fontSize: 16 }}>✕</button>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input value={newCriterion} onChange={e => setNewCriterion(e.target.value)}
                  placeholder="Ex: Deve validar o formato do e-mail"
                  onKeyDown={e => e.key === 'Enter' && addCriterion()} style={{ flex: 1, fontSize: 13 }} />
                <button className="btn btn-ghost btn-sm" onClick={addCriterion}>+ Adicionar</button>
              </div>
            </div>
          </div>
          <div style={{ width: 220, borderLeft: '1px solid var(--border)', padding: '20px 16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="input-group">
              <label className="input-label">Coluna</label>
              <select value={columnId} onChange={e => setColumnId(e.target.value)} style={{ width: '100%' }}>
                {cols.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Sprint</label>
              <select value={sprintId} onChange={e => setSprintId(e.target.value)} style={{ width: '100%' }}>
                <option value="">— Backlog —</option>
                {sprints.filter(s => s.status !== 'COMPLETED').map(s => (
                  <option key={s.id} value={s.id}>{s.status === 'ACTIVE' ? '▶ ' : ''}{s.name}</option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Épico</label>
              <select value={epicId} onChange={e => setEpicId(e.target.value)} style={{ width: '100%' }}>
                <option value="">— Nenhum —</option>
                {epics.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">Story Points</label>
              <input type="number" min="0" max="100" value={points} onChange={e => setPoints(e.target.value)} placeholder="0" style={{ width: '100%' }} />
            </div>
            <div className="input-group">
              <label className="input-label">Data limite</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="input-group">
              <label className="input-label">Responsáveis</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {users.map(u => (
                  <div key={u.id} onClick={() => toggleAssignee(u.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px', borderRadius: 6,
                      background: assigneeIds.includes(u.id) ? 'rgba(99,102,241,.15)' : 'var(--bg3)',
                      border: assigneeIds.includes(u.id) ? '1px solid var(--accent)' : '1px solid transparent',
                      cursor: 'pointer', fontSize: 12 }}>
                    <div style={{ width: 18, height: 18, borderRadius: '50%', background: u.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                      {u.name[0].toUpperCase()}
                    </div>
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</span>
                    {assigneeIds.includes(u.id) && <span style={{ color: 'var(--accent)', fontSize: 14 }}>✓</span>}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => saveMut.mutate()} disabled={!title.trim() || saveMut.isPending}>
            {saveMut.isPending ? 'Salvando...' : isEdit ? 'Salvar alterações' : 'Criar task'}
          </button>
        </div>
      </div>
    </div>
  );
}
