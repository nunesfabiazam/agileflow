import { useAppStore } from '../store/useAppStore';
import { useQuery } from '@tanstack/react-query';
import { reportsApi, tasksApi } from '../api';

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

export function DashboardPage() {
  const activeProjectId = useAppStore(s => s.activeProjectId);

  const { data: report } = useQuery({
    queryKey: ['report-project', activeProjectId],
    queryFn: () => reportsApi.project(activeProjectId!).then(r => r.data.data),
    enabled: !!activeProjectId,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks-all', activeProjectId],
    queryFn: () => tasksApi.list({ projectId: activeProjectId! }).then(r => r.data.data ?? []),
    enabled: !!activeProjectId,
  });

  if (!activeProjectId) return (
    <div className="empty-state">
      <div className="empty-icon">📊</div>
      <div className="empty-text">Selecione um projeto.</div>
    </div>
  );

  const velocity    = (report?.velocity     ?? []) as Array<{ name: string; status: string; planned: number; delivered: number }>;
  const epics       = (report?.epicProgress ?? []) as Array<{ id: string; title: string; color: string; total: number; done: number; pct: number }>;
  const openBugs    = (report?.openBugs     ?? 0)  as number;
  const totalTasks  = (report?.totalTasks   ?? 0)  as number;

  const completedSprints = velocity.filter(v => v.status === 'COMPLETED');
  const avgVelocity = completedSprints.length
    ? Math.round(completedSprints.reduce((a, v) => a + v.delivered, 0) / completedSprints.length)
    : null;
  const lastSprint = completedSprints[completedSprints.length - 1];
  const lastCompletionRate = lastSprint && lastSprint.planned > 0
    ? Math.round((lastSprint.delivered / lastSprint.planned) * 100)
    : null;
  const activeSprint = velocity.find(v => v.status === 'ACTIVE');

  const tasks = allTasks as Array<{ type: string; priority: string }>;
  const byType: Record<string, number> = {};
  const byPrio: Record<string, number> = {};
  for (const t of tasks) {
    byType[t.type]     = (byType[t.type]     ?? 0) + 1;
    byPrio[t.priority] = (byPrio[t.priority] ?? 0) + 1;
  }
  const maxType = Math.max(...Object.values(byType), 1);
  const maxPrio = Math.max(...Object.values(byPrio), 1);
  const maxV    = Math.max(...velocity.map(v => Math.max(v.planned, v.delivered)), 1);

  return (
    <div>
      <div className="page-header">
        <h2>📊 Dashboard — Visão Executiva</h2>
        <div style={{ marginLeft: 'auto' }}>
          <button className="btn btn-ghost btn-sm">⬇ Exportar</button>
        </div>
      </div>

      <div className="grid-4" style={{ marginBottom: 20 }}>
        {[
          { label: 'Total de Tasks',    value: totalTasks || '—',                                              color: 'var(--text)'   },
          { label: 'Taxa de Conclusão', value: lastCompletionRate != null ? `${lastCompletionRate}%` : '—',    color: 'var(--green)'  },
          { label: 'Bugs Abertos',      value: openBugs,                                                       color: openBugs > 0 ? 'var(--red)' : 'var(--green)' },
          { label: 'Velocidade Média',  value: avgVelocity != null ? `${avgVelocity} pts` : '—',               color: 'var(--accent)' },
        ].map(m => (
          <div className="metric-card" key={m.label}>
            <div className="metric-label">{m.label}</div>
            <div className="metric-value" style={{ color: m.color }}>{m.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginBottom: 20 }}>
        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Velocidade por Sprint</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14, display: 'flex', gap: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, background: 'var(--bg4)', borderRadius: 2, display: 'inline-block' }} /> Planejado
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 10, height: 10, background: 'var(--accent)', borderRadius: 2, display: 'inline-block' }} /> Entregue
            </span>
          </div>
          {velocity.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum sprint criado ainda.</div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 90 }}>
              {velocity.map((v, i) => (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', display: 'flex', gap: 2, alignItems: 'flex-end', height: 70 }}>
                    <div title={`Planejado: ${v.planned}pts`} style={{ flex: 1, background: 'var(--bg4)', borderRadius: '3px 3px 0 0', height: `${(v.planned / maxV) * 100}%`, minHeight: v.planned > 0 ? 3 : 0 }} />
                    <div title={`Entregue: ${v.delivered}pts`} style={{ flex: 1, background: v.status === 'ACTIVE' ? 'var(--yellow)' : 'var(--accent)', borderRadius: '3px 3px 0 0', opacity: .85, height: `${(v.delivered / maxV) * 100}%`, minHeight: v.delivered > 0 ? 3 : 0 }} />
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text3)', textAlign: 'center', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 54 }}>{v.name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Progresso dos Épicos</div>
          {epics.length === 0 ? (
            <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum épico cadastrado.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {epics.map(ep => (
                <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid rgba(45,55,72,.2)' }}>
                  <div style={{ width: 148, flexShrink: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ep.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>{ep.done}/{ep.total} tasks</div>
                  </div>
                  <div style={{ flex: 1, height: 7, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 4, background: ep.color, width: `${ep.pct}%`, transition: 'width .4s' }} />
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, width: 34, textAlign: 'right', color: ep.pct === 100 ? 'var(--green)' : 'var(--text)' }}>{ep.pct}%</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {tasks.length > 0 && (
        <div className="grid-2" style={{ marginBottom: 20 }}>
          <div className="card">
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Distribuição por Tipo</div>
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
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Distribuição por Prioridade</div>
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

      {activeSprint && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '3px solid var(--accent)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: 'var(--accent)', fontWeight: 700, marginBottom: 2 }}>🏃 Sprint Ativa</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{activeSprint.name}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>Story Points</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{activeSprint.delivered} / {activeSprint.planned}</div>
            </div>
          </div>
          <div style={{ marginTop: 12, height: 8, background: 'var(--bg4)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, background: 'var(--accent)', width: `${activeSprint.planned > 0 ? Math.round((activeSprint.delivered / activeSprint.planned) * 100) : 0}%`, transition: 'width .4s' }} />
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 5 }}>
            {activeSprint.planned > 0 ? Math.round((activeSprint.delivered / activeSprint.planned) * 100) : 0}% dos pontos entregues
          </div>
        </div>
      )}
    </div>
  );
}
