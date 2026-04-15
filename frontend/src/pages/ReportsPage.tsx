import { useAppStore } from '../store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, sprintsApi } from '../api';
import { useState } from 'react';

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

  if (!activeProjectId) return <div className="empty-state"><div className="empty-icon">📈</div><div className="empty-text">Selecione um projeto.</div></div>;

  const summary = sprintReport?.summary;
  const team = sprintReport?.team ?? [];

  return (
    <div>
      <div className="page-header">
        <h2>Relatórios</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          <select style={{ fontSize: 12, padding: '4px 10px' }} value={activeSprint} onChange={e => setActiveSprint(e.target.value)}>
            <option value="">Selecionar Sprint...</option>
            {(sprints as any[]).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm">⬇ Exportar PDF</button>
        </div>
      </div>

      {!activeSprint && <div className="empty-state"><div className="empty-icon">🔍</div><div className="empty-text">Selecione uma sprint para gerar o relatório.</div></div>}

      {sprintReport && summary && (
        <>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, padding: 20, marginBottom: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{sprintReport.sprint.name}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {sprintReport.sprint.startDate ? new Date(sprintReport.sprint.startDate).toLocaleDateString('pt-BR') : '—'} → {sprintReport.sprint.endDate ? new Date(sprintReport.sprint.endDate).toLocaleDateString('pt-BR') : '—'}
            </div>
          </div>

          <div className="grid-4" style={{ marginBottom: 20 }}>
            {[
              { l: 'Tasks Totais',    v: summary.totalTasks,       c: 'var(--text)' },
              { l: 'Concluídas',      v: summary.completedTasks,   c: 'var(--green)' },
              { l: 'Story Points',    v: `${summary.completedPoints}/${summary.totalPoints}`, c: 'var(--accent)' },
              { l: 'Taxa Conclusão',  v: `${summary.completionRate}%`, c: summary.completionRate >= 80 ? 'var(--green)' : 'var(--yellow)' },
            ].map(m => (
              <div className="metric-card" key={m.l}>
                <div className="metric-label">{m.l}</div>
                <div className="metric-value" style={{ color: m.c }}>{m.v}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Produtividade por Membro</div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                {['Membro', 'Tasks', 'Concluídas', 'Pts Entregues', 'Taxa'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 11, textTransform: 'uppercase', color: 'var(--text3)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{h}</th>
                ))}
              </tr></thead>
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
                    <td style={{ padding: '10px 12px' }}>{m.tasks}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--green)', fontWeight: 700 }}>{m.completed}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--accent)' }}>{m.points}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div className="progress-bar" style={{ width: 80 }}>
                          <div className="progress-fill" style={{ width: `${m.rate}%`, background: m.rate >= 80 ? 'var(--green)' : 'var(--yellow)' }} />
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{m.rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
