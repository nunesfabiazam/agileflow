import { useAppStore } from '../store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, sprintsApi } from '../api';
import { useState } from 'react';

const TYPE_LABEL: Record<string, string> = {
  STORY: '📖 Story', BUG: '🐛 Bug', TASK: '✅ Task',
  SPIKE: '⚡ Spike', EPIC: '🏔 Epic', SUBTASK: '🔹 Subtask',
};
const PRIO_LABEL: Record<string, string> = {
  CRITICAL: '🔴 Crítica', HIGH: '🟠 Alta', MEDIUM: '🟡 Média', LOW: '🟢 Baixa',
};
const PRIO_COLOR: Record<string, string> = {
  CRITICAL: 'var(--red)', HIGH: '#f97316', MEDIUM: 'var(--yellow)', LOW: 'var(--green)',
};
const TYPE_COLOR: Record<string, string> = {
  STORY: 'var(--accent)', BUG: 'var(--red)', TASK: 'var(--green)',
  SPIKE: '#a78bfa', EPIC: '#f59e0b', SUBTASK: 'var(--text3)',
};
const PRIO_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export function ReportsPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const [activeSprint, setActiveSprint] = useState<string>('');

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', activeProjectId],
    queryFn: () => sprintsApi.list(activeProjectId!).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  const { data: sprintReport } = useQuery({
    queryKey: ['report-sprint', activeSprint],
    queryFn: () => reportsApi.sprint(activeSprint).then(r => r.data.data),
    enabled: !!activeSprint,
  });

  if (!activeProjectId) return (
    <div className="empty-state">
      <div className="empty-icon">📈</div>
      <div className="empty-text">Selecione um projeto.</div>
    </div>
  );

  const summary = sprintReport?.summary;
  const team    = (sprintReport?.team    ?? []) as any[];
  const byType  = (sprintReport?.byType  ?? {}) as Record<string, number>;
  const byPrio  = (sprintReport?.byPrio  ?? {}) as Record<string, number>;

  const maxType = Math.max(...Object.values(byType), 1);
  const maxPrio = Math.max(...Object.values(byPrio), 1);

  return (
    <div>
      <div className="page-header">
        <h2>📈 Relatórios de Sprint</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ fontSize: 12, padding: '4px 10px' }} value={activeSprint} onChange={e => setActiveSprint(e.target.value)}>
            <option value="">Selecionar Sprint...</option>
            {(sprints as any[]).map(s => (
              <option key={s.id} value={s.id}>{s.name} {s.status === 'ACTIVE' ? '🟢' : s.status === 'COMPLETED' ? '✅' : ''}</option>
            ))}
          </select>
          <button className="btn btn-ghost btn-sm">⬇ Exportar PDF</button>
        </div>
      </div>

      {!activeSprint && (
        <div className="empty-state">
          <div className="empty-icon">🔍</div>
          <div className="empty-text">Selecione uma sprint para gerar o relatório.</div>
        </div>
      )}

      {sprintReport && summary && (
        <>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{sprintReport.sprint.name}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {sprintReport.sprint.startDate ? new Date(sprintReport.sprint.startDate).toLocaleDateString('pt-BR') : '—'}
                {' → '}
                {sprintReport.sprint.endDate ? new Date(sprintReport.sprint.endDate).toLocaleDateString('pt-BR') : '—'}
              </div>
            </div>
            <span style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
              padding: '3px 10px', borderRadius: 20,
              background: sprintReport.sprint.status === 'COMPLETED' ? 'rgba(34,197,94,.15)' : sprintReport.sprint.status === 'ACTIVE' ? 'rgba(99,102,241,.15)' : 'var(--bg4)',
              color: sprintReport.sprint.status === 'COMPLETED' ? 'var(--green)' : sprintReport.sprint.status === 'ACTIVE' ? 'var(--accent)' : 'var(--text3)',
            }}>
              {sprintReport.sprint.status === 'COMPLETED' ? '✅ Concluída' : sprintReport.sprint.status === 'ACTIVE' ? '🟢 Ativa' : sprintReport.sprint.status}
            </span>
          </div>

          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[
              { l: 'Tasks Totais',   v: summary.totalTasks,   c: 'var(--text)' },
              { l: 'Concluídas',     v: summary.completedTasks, c: 'var(--green)' },
              { l: 'Story Points',   v: `${summary.completedPoints}/${summary.totalPoints}`, c: 'var(--accent)' },
              { l: 'Taxa Conclusão', v: `${summary.completionRate}%`, c: summary.completionRate >= 80 ? 'var(--green)' : summary.completionRate >= 50 ? 'var(--yellow)' : 'var(--red)' },
            ].map(m => (
              <div className="metric-card" key={m.l}>
                <div className="metric-label">{m.l}</div>
                <div className="metric-value" style={{ color: m.c }}>{m.v}</div>
              </div>
            ))}
          </div>

          {(Object.keys(byType).length > 0 || Object.keys(byPrio).length > 0) && (
            <div className="grid-2" style={{ marginBottom: 20 }}>
              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Tasks por Tipo</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                    <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 88, fontSize: 12, flexShrink: 0 }}>{TYPE_LABEL[type] ?? type}</div>
                      <div style={{ flex: 1, height: 14, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: TYPE_COLOR[type] ?? 'var(--accent)', width: `${(count / maxType) * 100}%`, transition: 'width .4s' }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, width: 26, textAlign: 'right' }}>{count}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Tasks por Prioridade</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {PRIO_ORDER.filter(p => byPrio[p]).map(prio => (
                    <div key={prio} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 88, fontSize: 12, flexShrink: 0 }}>{PRIO_LABEL[prio]}</div>
                      <div style={{ flex: 1, height: 14, background: 'var(--bg4)', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ height: '100%', borderRadius: 3, background: PRIO_COLOR[prio], width: `${(byPrio[prio] / maxPrio) * 100}%`, transition: 'width .4s' }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, width: 26, textAlign: 'right' }}>{byPrio[prio]}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>👥 Produtividade por Membro</div>
            {team.length === 0 ? (
              <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum membro atribuído nesta sprint.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Membro', 'Tasks', 'Concluídas', 'Pts Entregues', 'Taxa'].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {team.map((m: any) => (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(45,55,72,.2)' }}>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                            {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                          </div>
                          <span style={{ fontSize: 13 }}>{m.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{m.tasks}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--green)', fontWeight: 700 }}>{m.completed}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--accent)' }}>{m.points}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div className="progress-bar" style={{ width: 80 }}>
                            <div className="progress-fill" style={{ width: `${m.rate}%`, background: m.rate >= 80 ? 'var(--green)' : m.rate >= 50 ? 'var(--yellow)' : 'var(--red)' }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{m.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
