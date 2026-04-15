import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { columnsApi } from '../../api';

const COLORS = ['#64748b','#3b82f6','#a855f7','#22c55e','#f97316','#eab308','#ef4444','#06b6d4','#ec4899'];

interface Props { projectId: string; onClose: () => void; onCreated: () => void; }

export function AddColumnModal({ projectId, onClose, onCreated }: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState('#3b82f6');

  const mut = useMutation({
    mutationFn: () => columnsApi.create({ name: name.trim(), color, projectId }),
    onSuccess: onCreated,
  });

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 360, padding: 28 }}>
        <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 20 }}>Nova Coluna</div>

        <div style={{ marginBottom: 14 }}>
          <div className="section-title" style={{ marginBottom: 6 }}>Nome</div>
          <input
            autoFocus
            placeholder="Ex: Homologação, Blocked, Em Deploy..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && name.trim() && mut.mutate()}
            style={{ width: '100%' }}
          />
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="section-title" style={{ marginBottom: 8 }}>Cor</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {COLORS.map(c => (
              <div key={c} onClick={() => setColor(c)} style={{
                width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                border: color === c ? '3px solid #fff' : '3px solid transparent',
                boxShadow: color === c ? '0 0 0 2px var(--accent)' : 'none', transition: 'all .15s',
              }} />
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={() => mut.mutate()} disabled={!name.trim() || mut.isPending}>
            {mut.isPending ? 'Criando...' : 'Criar Coluna'}
          </button>
        </div>
      </div>
    </div>
  );
}
