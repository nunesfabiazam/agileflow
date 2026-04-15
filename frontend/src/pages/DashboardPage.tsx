import { useAppStore } from '../store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { reportsApi } from '../api';

export function DashboardPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);
  const { data: report } = useQuery({
    queryKey: ['report-project', activeProjectId],
    queryFn: () => reportsApi.project(activeProjectId!).then(r => r.data.data),
    enabled: !!activeProjectId,
  });

  if (!activeProjectId) return <div className="empty-state"><div className="empty-icon">📊</div><div className="empty-text">Selecione um projeto.</div></div>;

  const velocity = report?.velocity ?? [];
  const epics = report?.epicProgress ?? [];
  const team = report?.team ?? [];
  const overview = report?.overview ?? {};

  const metricCards = [
    { label: 'Story Points — Sprint Atual', value: overview.currentSprintPoints ?? '—', color: 'var(--accent)' },
    { label: 'Taxa de Conclusão', value: overview.completionRate != null ? `${overview.completionRate}%` : '—', color: 'var(--green)' },
    { label: 'Bugs Abertos', value: overview.openBugs ?? '—', color: 'var(--red)' },
    { label: 'Velocidade Média', value: overview.avgVelocity != null ? `${overview.avgVelocity}pts` : '—', color: 'var(--yellow)' },
  ];

  const maxV = Math.max(...velocity.map((v: any) => v.planned), 1);

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard — Visão Executiva</h2>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm">⬇ Exportar</button>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid-4" style={{ marginBottom: 20 }}>
        {metricCards.map(m => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        {/* Velocity chart */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Velocidade por Sprint</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Story points planejados vs entregues</div>
          {velocity.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum sprint concluído ainda.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 80 }}>
              {velocity.map((v: any, i: number) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 64 }}>
                    <div style={{ flex: 1, background: 'var(--bg4)', borderRadius: '3px 3px 0 0', height: `${(v.planned / maxV) * 100}%` }} />
                    <div style={{ flex: 1, background: 'var(--accent)', borderRadius: '3px 3px 0 0', opacity: .8, height: `${(v.delivered / maxV) * 100}%` }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 50 }}>{v.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Epics progress */}
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Progresso dos Épicos</div>
          {epics.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum épico cadastrado.</div>
          ) : (
            epics.map((ep: any) => (
              <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0', borderBottom: '1px solid rgba(45,55,72,.3)' }}>
                <div style={{ width: 160, flexShrink: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{ep.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{ep.done}/{ep.total} tasks</div>
                </div>
                <div style={{ flex: 1, height: 8, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', borderRadius: 4, background: ep.color, width: `${ep.pct}%` }} />
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, width: 36, textAlign: 'right' }}>{ep.pct}%</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Team table */}
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>Desempenho do Time</div>
        {team.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Dados de produtividade aparecerão aqui após o primeiro sprint.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>{['Membro', 'Tasks', 'Pts Entregues', 'Bugs', 'Taxa'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '6px 12px', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', borderBottom: '1px solid var(--border)', fontWeight: 600 }}>{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {team.map((m: any) => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(45,55,72,.2)' }}>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff' }}>
                        {m.name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{m.name}</div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 12px', fontWeight: 700, color: 'var(--accent)' }}>{m.tasks}</td>
                  <td style={{ padding: '10px 12px', fontWeight: 700 }}>{m.points}</td>
                  <td style={{ padding: '10px 12px', color: m.bugs > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>{m.bugs ?? 0}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-bar" style={{ width: 80 }}>
                        <div className="progress-fill" style={{ width: `${m.rate}%`, background: m.rate > 80 ? 'var(--green)' : m.rate > 50 ? 'var(--yellow)' : 'var(--red)' }} />
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
    </div>
  );
}
