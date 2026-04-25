import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAppStore } from '../store/useAppStore';
import { timeLogsApi } from '../api';

interface LogEntry {
  id: string; minutes: number; note?: string; date: string;
  task: { id: string; title: string };
}
interface UserSummary {
  user: { id: string; name: string; color: string };
  totalMinutes: number;
  logs: LogEntry[];
}

function formatMinutes(m: number) {
  const h = Math.floor(m / 60);
  const rem = m % 60;
  if (h === 0) return `${rem}min`;
  return rem > 0 ? `${h}h ${rem}min` : `${h}h`;
}

function BarChart({ data }: { data: UserSummary[] }) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map(d => d.totalMinutes), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map(d => (
        <div key={d.user.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 80, fontSize: 12, color: 'var(--text2)', textAlign: 'right', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {d.user.name}
          </div>
          <div style={{ flex: 1, background: 'var(--bg3)', borderRadius: 4, height: 20, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${(d.totalMinutes / max) * 100}%`,
              background: d.user.color,
              transition: 'width 0.4s ease',
              minWidth: d.totalMinutes > 0 ? 4 : 0,
            }} />
          </div>
          <div style={{ width: 60, fontSize: 12, color: 'var(--text2)', flexShrink: 0, fontWeight: 600 }}>
            {formatMinutes(d.totalMinutes)}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function TimeReportPage() {
  const { activeProjectId } = useAppStore();
  const today = new Date().toISOString().split('T')[0];
  const monthStart = today.slice(0, 7) + '-01';

  const [from, setFrom] = useState(monthStart);
  const [to, setTo]     = useState(today);
  const [expanded, setExpanded] = useState<string | null>(null);

  const params: Record<string, string> = { from, to };
  if (activeProjectId) params.projectId = activeProjectId;

  const { data, isLoading } = useQuery({
    queryKey: ['time-report', params],
    queryFn: () => timeLogsApi.report(params).then((r: any) => r.data.data as {
      byUser: UserSummary[];
      totalMinutes: number;
    }),
    enabled: !!from && !!to,
  });

  const byUser = data?.byUser ?? [];
  const totalMinutes = data?.totalMinutes ?? 0;

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>
          ⏱️ Relatório de Horas
        </h1>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Tempo registrado por membro no período selecionado
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>De</label>
          <input type="date" className="input" value={from} onChange={e => setFrom(e.target.value)} />
        </div>
        <div>
          <label style={{ fontSize: 11, color: 'var(--text3)', display: 'block', marginBottom: 4 }}>Até</label>
          <input type="date" className="input" value={to} onChange={e => setTo(e.target.value)} />
        </div>
        <div style={{ alignSelf: 'flex-end' }}>
          <button className="btn btn-ghost btn-sm"
            onClick={() => { setFrom(monthStart); setTo(today); }}>
            Este mês
          </button>
        </div>
        {totalMinutes > 0 && (
          <div style={{ marginLeft: 'auto', alignSelf: 'flex-end' }}>
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>
              Total: <span style={{ fontWeight: 700, color: 'var(--accent)', fontSize: 16 }}>{formatMinutes(totalMinutes)}</span>
            </div>
          </div>
        )}
      </div>

      {isLoading && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Carregando...</div>
      )}

      {!isLoading && byUser.length === 0 && (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⏳</div>
          <p>Nenhum registro de tempo no período.</p>
        </div>
      )}

      {byUser.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Bar chart overview */}
          <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 20, border: '1px solid var(--border)' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 14 }}>
              Distribuição por membro
            </div>
            <BarChart data={byUser} />
          </div>

          {/* Per-user detail cards */}
          {byUser.map((summary: UserSummary) => (
            <div key={summary.user.id} style={{ background: 'var(--bg2)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
              {/* User header */}
              <div
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 20px', cursor: 'pointer',
                  borderBottom: expanded === summary.user.id ? '1px solid var(--border)' : 'none',
                }}
                onClick={() => setExpanded(expanded === summary.user.id ? null : summary.user.id)}
              >
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', background: summary.user.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 700, color: '#fff',
                }}>
                  {summary.user.name.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text1)' }}>{summary.user.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)' }}>{summary.logs.length} registro{summary.logs.length !== 1 ? 's' : ''}</div>
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)' }}>
                  {formatMinutes(summary.totalMinutes)}
                </div>
                <div style={{ fontSize: 14, color: 'var(--text3)' }}>
                  {expanded === summary.user.id ? '▲' : '▼'}
                </div>
              </div>

              {/* Log details */}
              {expanded === summary.user.id && (
                <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {summary.logs.map((log: LogEntry) => (
                    <div key={log.id} style={{
                      display: 'grid', gridTemplateColumns: '1fr 80px 60px',
                      padding: '6px 0', borderBottom: '1px solid var(--border)',
                      fontSize: 12, alignItems: 'center', gap: 8,
                    }}>
                      <div>
                        <div style={{ color: 'var(--text1)', fontWeight: 500 }}>{log.task.title}</div>
                        {log.note && <div style={{ color: 'var(--text3)', fontSize: 11 }}>{log.note}</div>}
                      </div>
                      <div style={{ color: 'var(--text3)', fontSize: 11, textAlign: 'right' }}>
                        {new Date(log.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
                      </div>
                      <div style={{ fontWeight: 600, color: 'var(--accent)', textAlign: 'right' }}>
                        {formatMinutes(log.minutes)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
