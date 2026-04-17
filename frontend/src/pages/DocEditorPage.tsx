import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { documentsApi } from '../api';
import { useAppStore } from '../store/useAppStore';
import { TiptapEditor } from '../components/docs/TiptapEditor';
import { Avatar } from '../components/Shared/Avatar';
import type { Document, DocType, DocSpace } from '../types';

const DOC_TYPE_OPTS: { value: DocType; label: string; icon: string }[] = [
  { value: 'SPEC',      label: 'Spec',            icon: '📋' },
  { value: 'DIAGRAM',   label: 'Diagrama',         icon: '🗺️' },
  { value: 'DESIGN',    label: 'Design',           icon: '🎨' },
  { value: 'REFERENCE', label: 'Referência',       icon: '📚' },
  { value: 'TEMPLATE',  label: 'Template',         icon: '📄' },
  { value: 'TEST_PLAN', label: 'Plano de Testes',  icon: '🧪' },
  { value: 'WIREFRAME', label: 'Wireframe',        icon: '✏️' },
  { value: 'RUNBOOK',   label: 'Runbook',          icon: '🔧' },
  { value: 'OTHER',     label: 'Outro',            icon: '📝' },
];

export function DocEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const activeProjectId = useAppStore(s => s.activeProjectId);

  const [title, setTitle]     = useState('');
  const [content, setContent] = useState('');
  const [docType, setDocType] = useState<DocType>('OTHER');
  const [spaceId, setSpaceId] = useState<string | undefined>();
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [ready, setReady]     = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: doc } = useQuery<Document | undefined>({
    queryKey: ['doc', id],
    queryFn:  () => documentsApi.get(id!).then(r => r.data.data),
    enabled:  !!id,
  });

  const { data: spaces = [] } = useQuery<DocSpace[]>({
    queryKey: ['spaces', activeProjectId],
    queryFn:  () => documentsApi.listSpaces(activeProjectId!).then(r => r.data.data ?? []),
    enabled:  !!activeProjectId,
  });

  useEffect(() => {
    if (doc && !ready) {
      setTitle(doc.title);
      setContent(doc.content ?? '');
      setDocType(doc.type);
      setSpaceId(doc.space?.id);
      setReady(true);
    }
  }, [doc, ready]);

  const saveMut = useMutation({
    mutationFn: (vars: { t: string; c: string; dt: DocType; si?: string }) =>
      documentsApi.update(id!, { title: vars.t, content: vars.c, type: vars.dt, spaceId: vars.si }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['doc', id] });
      qc.invalidateQueries({ queryKey: ['docs', activeProjectId] });
      setSaveState('saved');
      setTimeout(() => setSaveState('idle'), 2500);
    },
  });

  const scheduleSave = useCallback(
    (t: string, c: string, dt: DocType, si?: string) => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
      setSaveState('saving');
      saveTimer.current = setTimeout(() => saveMut.mutate({ t, c, dt, si }), 1500);
    },
    [saveMut],
  );

  const handleTitleChange   = (v: string) => { setTitle(v);   scheduleSave(v,     content, docType, spaceId); };
  const handleContentChange = (v: string) => { setContent(v); scheduleSave(title, v,       docType, spaceId); };
  const handleTypeChange    = (v: DocType) => { setDocType(v); scheduleSave(title, content, v,       spaceId); };
  const handleSpaceChange   = (v: string) => { const s = v || undefined; setSpaceId(s); scheduleSave(title, content, docType, s); };

  if (!doc || !ready) return (
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', height:'100%' }}>
      <div className="spinner" />
    </div>
  );

  const typeInfo  = DOC_TYPE_OPTS.find(t => t.value === docType) ?? DOC_TYPE_OPTS[8];
  const curSpace  = spaces.find(s => s.id === spaceId);

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%', background:'var(--bg1)' }}>

      {/* Top bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 20px', borderBottom:'1px solid var(--border)', background:'var(--bg2)', flexWrap:'wrap' }}>
        <button onClick={() => navigate('/documents')}
          style={{ color:'var(--text3)', padding:'4px 10px', borderRadius:6, background:'var(--bg4)', fontSize:13, flexShrink:0 }}>
          ← Docs
        </button>
        <span style={{ fontSize:12, color:'var(--text3)', flexShrink:0 }}>
          {curSpace ? `${curSpace.icon ?? '📁'} ${curSpace.name}` : '📁 Sem espaço'} /
        </span>
        <input value={title} onChange={e => handleTitleChange(e.target.value)}
          style={{ flex:1, minWidth:200, fontSize:15, fontWeight:700, background:'transparent', border:'none', outline:'none', color:'var(--text1)', padding:'4px 0' }}
          placeholder="Título do documento..." />
        <select value={docType} onChange={e => handleTypeChange(e.target.value as DocType)}
          style={{ fontSize:12, padding:'5px 8px', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text2)', flexShrink:0 }}>
          {DOC_TYPE_OPTS.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
        </select>
        <select value={spaceId ?? ''} onChange={e => handleSpaceChange(e.target.value)}
          style={{ fontSize:12, padding:'5px 8px', background:'var(--bg4)', border:'1px solid var(--border)', borderRadius:6, color:'var(--text2)', flexShrink:0 }}>
          <option value="">📁 Sem espaço</option>
          {spaces.map(s => <option key={s.id} value={s.id}>{s.icon ?? '📁'} {s.name}</option>)}
        </select>
        <span style={{ fontSize:12, flexShrink:0, minWidth:90, textAlign:'right', color: saveState==='saved' ? '#22c55e' : 'var(--text3)' }}>
          {saveState==='saving' && '⏳ Salvando...'}
          {saveState==='saved'  && '✅ Salvo'}
          {saveState==='idle'   && `v${doc.version}`}
        </span>
      </div>

      {/* Body */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>
        <div style={{ flex:1, overflow:'auto', padding:'32px 64px' }}>
          <TiptapEditor content={content} onChange={handleContentChange}
            placeholder="Comece a escrever aqui... Use a barra de ferramentas para formatar." />
        </div>
        <div style={{ width:220, borderLeft:'1px solid var(--border)', padding:'16px 14px', overflow:'auto', background:'var(--bg2)', flexShrink:0 }}>
          <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', letterSpacing:'.08em', color:'var(--text3)', marginBottom:12 }}>Detalhes</div>
          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10, padding:'8px 10px', background:'var(--bg3)', borderRadius:8 }}>
            <span style={{ fontSize:20 }}>{typeInfo.icon}</span>
            <div><div style={{ fontSize:12, fontWeight:600 }}>{typeInfo.label}</div><div style={{ fontSize:11, color:'var(--text3)' }}>Tipo</div></div>
          </div>
          {doc.author && (
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:10, padding:'8px 10px', background:'var(--bg3)', borderRadius:8 }}>
              <Avatar name={doc.author.name} color={doc.author.color} size="sm" />
              <div><div style={{ fontSize:12, fontWeight:600 }}>{doc.author.name}</div><div style={{ fontSize:11, color:'var(--text3)' }}>Autor</div></div>
            </div>
          )}
          <div style={{ fontSize:12, color:'var(--text3)', lineHeight:2, padding:'8px 10px', background:'var(--bg3)', borderRadius:8, marginBottom:10 }}>
            📅 {new Date(doc.createdAt).toLocaleDateString('pt-BR')}<br />
            ✏️ {new Date(doc.updatedAt).toLocaleDateString('pt-BR')}<br />
            🔢 Versão {doc.version}
          </div>
          {(doc.linkedTasks?.length ?? 0) > 0 && (
            <div>
              <div style={{ fontSize:11, fontWeight:700, textTransform:'uppercase', color:'var(--text3)', marginBottom:8 }}>🔗 Tasks</div>
              {doc.linkedTasks!.map(lt => (
                <div key={lt.task.id} style={{ padding:'6px 10px', background:'var(--bg3)', borderRadius:6, marginBottom:4 }}>
                  <code style={{ color:'var(--text3)', fontSize:10 }}>{lt.task.taskKey}</code>
                  <div style={{ fontSize:12, color:'var(--text2)', marginTop:2 }}>{lt.task.title}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
