import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { sprintAnalyticsApi, sprintsApi } from '../api';

interface Sprint { id: string; name: string; status: string; startDate?: string; endDate?: string; }
interface BurndownData {
  sprint: { name: string; startDate: string; endDate: string };
  totalPoints: number;
  days: string[];
  ideal: number[];
  actual: number[];
  completedPoints: number;
}
interface VelocityItem {
  id: string; name: string; committed: number; completed: number;
  startDate?: string; endDate?: string;
}

function BurndownChart({ data }: { data: BurndownData }) {
  const { days, ideal, actual, totalPoints } = data;
  if (days.length < 2) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Dados insuficientes para o gráfico.</div>;

  const W = 600, H = 260, PAD = { top: 16, right: 16, bottom: 40, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxY = Math.max(totalPoints, 1);
  const today = new Date().toISOString().split('T')[0];

  const xScale = (i: number) => PAD.left + (i / (days.length - 1)) * chartW;
  const yScale = (v: number) => PAD.top + (1 - v / maxY) * chartH;

  const idealPath = ideal.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`).join(' ');
  const actualPath = actual.map((v, i) => `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(v)}`).join(' ');

  // Today line
  const todayIdx = days.findIndex(d => d >= today);
  const showToday = todayIdx > 0 && todayIdx < days.length;

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxY * f));

  // X-axis labels (show every ~3 days)
  const xStep = Math.max(1, Math.floor(days.length / 6));
  const xLabels = days.filter((_, i) => i % xStep === 0 || i === days.length - 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
      {/* Grid lines */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)}
            stroke="var(--border)" strokeDasharray="3 3" strokeWidth={0.5} />
          <text x={PAD.left - 6} y={yScale(v) + 4} textAnchor="end"
            fontSize={10} fill="var(--text3)">{v}</text>
        </g>
      ))}

      {/* Today vertical line */}
      {showToday && (
        <line x1={xScale(todayIdx)} y1={PAD.top} x2={xScale(todayIdx)} y2={PAD.top + chartH}
          stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />
      )}

      {/* Ideal line */}
      <path d={idealPath} fill="none" stroke="#6366f1" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.7} />

      {/* Actual line */}
      <path d={actualPath} fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />

      {/* Actual dots */}
      {actual.map((v, i) => (
        <circle key={i} cx={xScale(i)} cy={yScale(v)} r={3}
          fill={v <= ideal[i] ? '#10b981' : '#ef4444'} />
      ))}

      {/* X-axis labels */}
      {xLabels.map(d => {
        const i = days.indexOf(d);
        return (
          <text key={d} x={xScale(i)} y={H - 6} textAnchor="middle" fontSize={9} fill="var(--text3)">
            {d.slice(5)} {/* MM-DD */}
          </text>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PAD.left + 8}, ${PAD.top + 8})`}>
        <line x1={0} y1={6} x2={18} y2={6} stroke="#6366f1" strokeDasharray="4 3" strokeWidth={1.5} />
        <text x={22} y={10} fontSize={10} fill="var(--text3)">Ideal</text>
        <line x1={60} y1={6} x2={78} y2={6} stroke="#10b981" strokeWidth={2} />
        <text x={82} y={10} fontSize={10} fill="var(--text3)">Real</text>
        {showToday && <>
          <line x1={116} y1={6} x2={134} y2={6} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />
          <text x={138} y={10} fontSize={10} fill="var(--text3)">Hoje</text>
        </>}
      </g>
    </svg>
  );
}

function VelocityChart({ data }: { data: { velocity: VelocityItem[]; avgVelocity: number } }) {
  const { velocity, avgVelocity } = data;
  if (velocity.length === 0) return <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nenhum sprint concluído ainda.</div>;

  const W = 600, H = 240, PAD = { top: 16, right: 16, bottom: 48, left: 44 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;
  const maxY  = Math.max(...velocity.map(v => v.committed), avgVelocity, 1);
  const barW  = chartW / velocity.length;
  const barPad = Math.max(4, barW * 0.15);

  const yScale = (v: number) => PAD.top + (1 - v / maxY) * chartH;
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxY * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: W, display: 'block' }}>
      {/* Grid */}
      {yTicks.map(v => (
        <g key={v}>
          <line x1={PAD.left} y1={yScale(v)} x2={W - PAD.right} y2={yScale(v)}
            stroke="var(--border)" strokeDasharray="3 3" strokeWidth={0.5} />
          <text x={PAD.left - 6} y={yScale(v) + 4} textAnchor="end" fontSize={10} fill="var(--text3)">{v}</text>
        </g>
      ))}

      {/* Avg velocity line */}
      <line x1={PAD.left} y1={yScale(avgVelocity)} x2={W - PAD.right} y2={yScale(avgVelocity)}
        stroke="#f59e0b" strokeDasharray="5 3" strokeWidth={1.5} />
      <text x={W - PAD.right + 3} y={yScale(avgVelocity) + 4} fontSize={9} fill="#f59e0b">média</text>

      {/* Bars */}
      {velocity.map((v, i) => {
        const x       = PAD.left + i * barW + barPad;
        const w       = barW - barPad * 2;
        const halfW   = w / 2;
        const yComm   = yScale(v.committed);
        const yComp   = yScale(v.completed);
        const hComm   = PAD.top + chartH - yComm;
        const hComp   = PAD.top + chartH - yComp;

        return (
          <g key={v.id}>
            {/* Committed (background) */}
            <rect x={x} y={yComm} width={w} height={hComm}
              fill="#6366f1" opacity={0.25} rx={2} />
            {/* Completed (foreground) */}
            <rect x={x + halfW - halfW * 0.6} y={yComp} width={w * 0.6} height={hComp}
              fill={v.completed >= v.committed ? '#10b981' : '#6366f1'} opacity={0.9} rx={2} />
            {/* Label */}
            <text x={x + halfW} y={H - 30} textAnchor="middle" fontSize={9} fill="var(--text3)">
              {v.name.length > 8 ? v.name.slice(0, 8) + '…' : v.name}
            </text>
            <text x={x + halfW} y={H - 18} textAnchor="middle" fontSize={9} fill="var(--text2)">
              {v.completed}/{v.committed}
            </text>
          </g>
        );
      })}

      {/* Legend */}
      <g transform={`translate(${PAD.left + 8}, ${PAD.top + 8})`}>
        <rect x={0} y={0} width={12} height={12} fill="#6366f1" opacity={0.25} rx={2} />
        <text x={16} y={10} fontSize={10} fill="var(--text3)">Comprometido</text>
        <rect x={100} y={0} width={12} height={12} fill="#10b981" opacity={0.9} rx={2} />
        <text x={116} y={10} fontSize={10} fill="var(--text3)">Concluído</text>
        <line x1={190} y1={6} x2={208} y2={6} stroke="#f59e0b" strokeDasharray="4 3" strokeWidth={1.5} />
        <text x={212} y={10} fontSize={10} fill="var(--text3)">Média ({avgVelocity} pts)</text>
      </g>
    </svg>
  );
}

export default function SprintAnalyticsPage() {
  const { activeProjectId } = useAppStore();
  const navigate = useNavigate();
  const [selectedSprint, setSelectedSprint] = useState<string>('');
  const [tab, setTab] = useState<'burndown' | 'velocity'>('burndown');

  const { data: sprints = [] } = useQuery({
    queryKey: ['sprints', activeProjectId],
    queryFn: () => sprintsApi.list(activeProjectId!).then((r: any) => r.data.data as Sprint[]),
    enabled: !!activeProjectId,
  });

  const activeSprint = sprints.find((s: Sprint) => s.status === 'ACTIVE');
  const sprintId = selectedSprint || activeSprint?.id || '';

  const { data: burndown, isLoading: bdLoading } = useQuery({
    queryKey: ['burndown', sprintId],
    queryFn: () => sprintAnalyticsApi.burndown(sprintId).then((r: any) => r.data.data as BurndownData),
    enabled: !!sprintId && tab === 'burndown',
  });

  const { data: velocityData, isLoading: velLoading } = useQuery({
    queryKey: ['velocity', activeProjectId],
    queryFn: () => sprintAnalyticsApi.velocity(activeProjectId!).then((r: any) => r.data.data),
    enabled: !!activeProjectId && tab === 'velocity',
  });

  if (!activeProjectId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text3)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p>Selecione um projeto para ver os gráficos.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px 32px', maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 24 }}>
        <button onClick={() => navigate(-1)} style={{ color: 'var(--text3)', fontSize: 18, padding: '4px 8px', borderRadius: 6, background: 'var(--bg3)', border: 'none', cursor: 'pointer', marginRight: 8 }}>←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: 'var(--text1)' }}>
            📉 Analytics de Sprint
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            Burndown chart e velocity histórico do projeto
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'var(--bg3)', borderRadius: 8, padding: 4 }}>
        {(['burndown', 'velocity'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: 13,
              background: tab === t ? 'var(--bg2)' : 'transparent',
              color: tab === t ? 'var(--text1)' : 'var(--text3)',
              boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.15)' : 'none',
              transition: 'all 0.15s',
            }}>
            {t === 'burndown' ? '📉 Burndown' : '⚡ Velocity'}
          </button>
        ))}
      </div>

      {/* Burndown Tab */}
      {tab === 'burndown' && (
        <div>
          {/* Sprint selector */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: 'var(--text3)' }}>Sprint:</label>
            <select className="input" value={sprintId}
              onChange={e => setSelectedSprint(e.target.value)}
              style={{ minWidth: 200 }}>
              {sprints.map((s: Sprint) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.status === 'ACTIVE' ? '● ativo' : ''}
                </option>
              ))}
            </select>
          </div>

          {bdLoading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Carregando...</div>}
          {burndown && (
            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
              {/* Summary cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Total de Pontos', value: burndown.totalPoints, color: '#6366f1' },
                  { label: 'Pontos Concluídos', value: burndown.completedPoints, color: '#10b981' },
                  { label: 'Pontos Restantes', value: burndown.totalPoints - burndown.completedPoints, color: '#f59e0b' },
                ].map(card => (
                  <div key={card.label} style={{
                    background: 'var(--bg3)', borderRadius: 8, padding: '12px 16px',
                    borderLeft: `3px solid ${card.color}`,
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{card.label}</div>
                  </div>
                ))}
              </div>

              <BurndownChart data={burndown} />
            </div>
          )}
          {!burndown && !bdLoading && sprintId && (
            <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
              <p>Nenhum dado disponível para este sprint.</p>
            </div>
          )}
        </div>
      )}

      {/* Velocity Tab */}
      {tab === 'velocity' && (
        <div>
          {velLoading && <div style={{ textAlign: 'center', padding: 48, color: 'var(--text3)' }}>Carregando...</div>}
          {velocityData && (
            <div style={{ background: 'var(--bg2)', borderRadius: 12, padding: 24, border: '1px solid var(--border)' }}>
              {/* Summary */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                {[
                  { label: 'Velocity Média', value: `${velocityData.avgVelocity} pts`, color: '#f59e0b' },
                  { label: 'Sprints Analisados', value: velocityData.velocity.length, color: '#6366f1' },
                  {
                    label: 'Último Sprint',
                    value: velocityData.velocity.length > 0
                      ? `${velocityData.velocity[velocityData.velocity.length - 1].completed} pts`
                      : '—',
                    color: '#10b981',
                  },
                ].map(card => (
                  <div key={card.label} style={{
                    background: 'var(--bg3)', borderRadius: 8, padding: '12px 16px',
                    borderLeft: `3px solid ${card.color}`,
                  }}>
                    <div style={{ fontSize: 22, fontWeight: 700, color: card.color }}>{card.value}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{card.label}</div>
                  </div>
                ))}
              </div>

              <VelocityChart data={velocityData} />

              {/* Table */}
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                  Histórico
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {velocityData.velocity.map((v: VelocityItem) => (
                    <div key={v.id} style={{
                      display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr',
                      padding: '8px 12px', background: 'var(--bg3)',
                      borderRadius: 6, fontSize: 12, alignItems: 'center',
                    }}>
                      <span style={{ color: 'var(--text1)', fontWeight: 500 }}>{v.name}</span>
                      <span style={{ color: 'var(--text3)', textAlign: 'right' }}>
                        Comp: <b style={{ color: '#6366f1' }}>{v.committed}</b>
                      </span>
                      <span style={{ color: 'var(--text3)', textAlign: 'right' }}>
                        Conc: <b style={{ color: '#10b981' }}>{v.completed}</b>
                      </span>
                      <span style={{ textAlign: 'right' }}>
                        <span style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 10,
                          background: v.completed >= v.committed ? '#10b98120' : '#ef444420',
                          color: v.completed >= v.committed ? '#10b981' : '#ef4444',
                        }}>
                          {v.committed > 0 ? Math.round(v.completed / v.committed * 100) : 0}%
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
