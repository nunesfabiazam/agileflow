import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sprintsApi } from '../../api';
import type { Sprint } from '../../types';

interface Props { projectId: string; }

export function SprintPanel({ projectId }: Props) {
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [name, setName]       = useState('');
  const [goal, setGoal]       = useState('');
  const [startDate, setStart] = useState('');
  const [endDate, setEnd]     = useState('');

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', projectId],
    queryFn: () => sprintsApi.list(projectId).then(r => r.data.data ?? []),
  });

  const createMut = useMutation({
    mutationFn: () => sprintsApi.create({
      name:      name.trim(),
      goal:      goal.trim() || undefined,
      // FIX: Zod exige ISO datetime completo, não só "YYYY-MM-DD"
      startDate: startDate ? new Date(startDate).toISOString() : undefined,
      endDate:   endDate   ? new Date(endDate).toISOString()   : undefined,
      projectId,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      setShowForm(false); setName(''); setGoal(''); setStart(''); setEnd('');
    },
  });

  const startMut = useMutation({
    mutationFn: (id: string) => sprintsApi.start(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', projectId] }),
  });

  const completeMut = useMutation({
    mutationFn: (id: string) => sprintsApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => sprintsApi.remove(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sprints', projectId] });
      qc.invalidateQueries({ queryKey: ['tasks', projectId] });
    },
  });

  const cloneMut = useMutation({
    mutationFn: (id: string) => sprintsApi.clone(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sprints', projectId] }),
  });

  const activeSprint   = sprints.find(s => s.status === 'ACTIVE');
  const plannedSprints = sprints.filter(s => s.status === 'PLANNING');
  const doneSprints    = sprints.filter(s => s.status === 'COMPLETED').slice(0, 3);

  const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';
  const pct = (s: Sprint) => (s as any).totalPoints
    ? Math.round(((s as any).completedPoints ?? 0) / (s as any).totalPoints * 100)
    : 0;

  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>🏃 Sprints</div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(v => !v)}>
          {showForm ? '✕ Cancelar' : '+ Nova Sprint'}
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Nome *</label>
              <input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Sprint 1" style={{ width: '100%' }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Objetivo</label>
              <input value={goal} onChange={e => setGoal(e.target.value)} placeholder="Meta principal..." style={{ width: '100%' }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Início</label>
              <input type="date" value={startDate} onChange={e => setStart(e.target.value)} style={{ width: '100%' }} />
            </div>
            <div className="input-group" style={{ marginBottom: 0 }}>
              <label className="input-label">Fim</label>
              <input type="date" value={endDate} onChange={e => setEnd(e.target.value)} style={{ width: '100%' }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowForm(false)}>Cancelar</button>
            <button className="btn btn-primary btn-sm" onClick={() => createMut.mutate()} disabled={!name.trim() || createMut.isPending}>
              {createMut.isPending ? 'Criando...' : 'Criar Sprint'}
            </button>
          </div>
        </div>
      )}

      {/* Active sprint */}
      {activeSprint && (
        <div style={{ background: 'rgba(99,102,241,.1)', border: '1px solid rgba(99,102,241,.3)', borderRadius: 10, padding: 14, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div>
              <span style={{ fontSize: 11, background: 'var(--accent)', color: '#fff', padding: '2px 8px', borderRadius: 10, marginRight: 8 }}>▶ ATIVA</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>{activeSprint.name}</span>
            </div>
            <button className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
              onClick={() => { if (confirm('Encerrar a sprint ativa? Tasks incompletas voltam ao backlog.')) completeMut.mutate(activeSprint.id); }}
              disabled={completeMut.isPending}>
              {completeMut.isPending ? '...' : '✅ Encerrar'}
            </button>
          </div>
          {activeSprint.goal && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 6 }}>🎯 {activeSprint.goal}</div>}
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
            {fmtDate(activeSprint.startDate)} → {fmtDate(activeSprint.endDate)}
          </div>
          {((activeSprint as any).totalPoints ?? 0) > 0 && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                <span>Progresso</span>
                <span>{(activeSprint as any).completedPoints ?? 0}/{(activeSprint as any).totalPoints} pts ({pct(activeSprint)}%)</span>
              </div>
              <div style={{ height: 6, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--accent)', width: `${pct(activeSprint)}%`, borderRadius: 3, transition: 'width .3s' }} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Planned sprints */}
      {plannedSprints.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Planejadas</div>
          {plannedSprints.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg3)', borderRadius: 8, marginBottom: 6 }}>
              <div>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
                {s.goal && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.goal}</div>}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{fmtDate(s.startDate)} → {fmtDate(s.endDate)}</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" onClick={() => startMut.mutate(s.id)}
                  disabled={!!activeSprint || startMut.isPending}>
                  {startMut.isPending ? '...' : '▶ Iniciar'}
                </button>
                <button className="btn btn-ghost btn-sm" title="Clonar sprint"
                  onClick={() => cloneMut.mutate(s.id)} disabled={cloneMut.isPending}>
                  🔀
                </button>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--red)', opacity: .7 }}
                  onClick={() => { if (confirm(`Excluir "${s.name}"?`)) deleteMut.mutate(s.id); }}>
                  🗑
                </button>
              </div>
            </div>
          ))}
          {activeSprint && <div style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', padding: '4px 0' }}>Encerre a sprint ativa antes de iniciar outra</div>}
        </div>
      )}

      {/* Recent completed */}
      {doneSprints.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '.05em' }}>Concluídas recentes</div>
          {doneSprints.map(s => (
            <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg3)', borderRadius: 8, marginBottom: 4, opacity: .7 }}>
              <div style={{ fontWeight: 500, fontSize: 13 }}>{s.name}</div>
              <div style={{ fontSize: 11, color: 'var(--green)' }}>{pct(s)}% ✓</div>
            </div>
          ))}
        </div>
      )}

      {sprints.length === 0 && !showForm && (
        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--text3)', fontSize: 13 }}>
          Nenhuma sprint criada. Clique em <strong>+ Nova Sprint</strong> para começar!
        </div>
      )}
    </div>
  );
}
