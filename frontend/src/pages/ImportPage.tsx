import { useState, useRef } from 'react';
import { importApi } from '../api';
import { useAppStore } from '../store/useAppStore';

type ImportType = 'jira-csv' | 'jira-json' | 'jira-xml' | 'confluence-html' | 'excel-tasks' | 'document';

const IMPORT_OPTIONS: Array<{ id: ImportType; icon: string; label: string; desc: string; formats: string; task: boolean }> = [
  { id: 'jira-csv',        icon: '🟦', label: 'Jira — CSV Export',        desc: 'Importe issues do Jira via CSV. Suporta tipo, prioridade, status, descrição, épicos e responsáveis.',           formats: '.csv',                    task: true  },
  { id: 'jira-xml',        icon: '🟦', label: 'Jira — XML Export',        desc: 'Importe issues do Jira via exportação XML (RSS). Inclui descrições completas, épicos, story points e assignees.', formats: '.xml',                    task: true  },
  { id: 'jira-json',       icon: '🟦', label: 'Jira — JSON Export',        desc: 'Importe issues do Jira Cloud via exportação JSON (Issues Export).',                                            formats: '.json',                   task: true  },
  { id: 'confluence-html', icon: '🟩', label: 'Confluence — HTML/ZIP',     desc: 'Importe páginas do Confluence exportadas como HTML ou como um arquivo ZIP de um espaço inteiro.',              formats: '.html, .htm, .zip',       task: false },
  { id: 'excel-tasks',     icon: '📗', label: 'Excel — Planilha de Tasks', desc: 'Importe tasks de uma planilha Excel. Colunas: Título, Tipo, Prioridade, Status, Story Points, Descrição.',     formats: '.xlsx, .xls',             task: true  },
  { id: 'document',        icon: '📄', label: 'Documento Único',           desc: 'Importe um documento avulso: Markdown (.md), HTML, Word (.docx) ou PDF como página de documentação.',          formats: '.md, .html, .docx, .pdf', task: false },
];

export function ImportPage() {
  const { activeProjectId } = useAppStore();
  const [selected, setSelected] = useState<ImportType | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const option = IMPORT_OPTIONS.find(o => o.id === selected);

  const handleImport = async () => {
    if (!file || !selected || !activeProjectId) return;
    setLoading(true);
    setResult(null);
    try {
      let res;
      switch (selected) {
        case 'jira-csv':        res = await importApi.jiraCsv(file, activeProjectId);        break;
        case 'jira-json':       res = await importApi.jiraJson(file, activeProjectId);       break;
        case 'jira-xml':        res = await importApi.jiraXml(file, activeProjectId);        break;
        case 'confluence-html': res = await importApi.confluenceHtml(file, activeProjectId); break;
        case 'excel-tasks':     res = await importApi.excelTasks(file, activeProjectId);     break;
        case 'document':        res = await importApi.document(file, activeProjectId);        break;
      }
      setResult({ success: true, message: res.data.message ?? 'Importação concluída com sucesso!' });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } }).response?.data?.error ?? 'Erro ao importar arquivo.';
      setResult({ success: false, message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Importar Dados</h2>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost btn-sm" onClick={() => importApi.templateJiraCsv()}>⬇ Template Jira CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => importApi.templateExcel()}>⬇ Template Excel</button>
        </div>
      </div>

      <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 20 }}>
        Importe tasks, documentação e relatórios de Jira, Confluence e outros formatos. Os dados serão importados para o projeto ativo.
      </p>

      {/* Format selector */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 24 }}>
        {IMPORT_OPTIONS.map(opt => (
          <div
            key={opt.id}
            onClick={() => { setSelected(opt.id); setFile(null); setResult(null); }}
            style={{
              padding: 16, borderRadius: 10, cursor: 'pointer', transition: 'all .15s',
              background: selected === opt.id ? 'var(--bg3)' : 'var(--bg2)',
              border: `2px solid ${selected === opt.id ? 'var(--accent)' : 'var(--border)'}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 22 }}>{opt.icon}</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>{opt.formats}</div>
              </div>
              {opt.task && <span style={{ marginLeft: 'auto', fontSize: 10, background: 'var(--accent)20', color: 'var(--accent2)', padding: '2px 6px', borderRadius: 4, fontWeight: 600 }}>TASKS</span>}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{opt.desc}</div>
          </div>
        ))}
      </div>

      {/* Upload area */}
      {selected && (
        <div className="card" style={{ maxWidth: 560 }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 16 }}>
            {option?.icon} {option?.label}
          </div>

          <div
            onClick={() => fileRef.current?.click()}
            onDragOver={e => e.preventDefault()}
            onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
            style={{
              border: '2px dashed var(--border)', borderRadius: 8, padding: '32px 20px', textAlign: 'center',
              cursor: 'pointer', transition: 'all .15s', marginBottom: 16,
              background: file ? 'var(--bg3)' : 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
          >
            <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
            {file ? (
              <>
                <div style={{ fontWeight: 600, color: 'var(--green)' }}>✓ {file.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>{(file.size / 1024).toFixed(1)} KB</div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 500, marginBottom: 4 }}>Clique ou arraste o arquivo aqui</div>
                <div style={{ fontSize: 12, color: 'var(--text3)' }}>Formatos aceitos: {option?.formats}</div>
              </>
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept={option?.formats.split(', ').join(',')}
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) setFile(f); }}
          />

          {result && (
            <div style={{
              padding: '12px 14px', borderRadius: 8, marginBottom: 16, fontSize: 13,
              background: result.success ? 'var(--green)15' : 'var(--red)15',
              border: `1px solid ${result.success ? 'var(--green)40' : 'var(--red)40'}`,
              color: result.success ? 'var(--green)' : 'var(--red)',
            }}>
              {result.success ? '✅' : '❌'} {result.message}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={handleImport} disabled={!file || loading || !activeProjectId}>
              {loading ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Importando...</> : '⬆ Importar'}
            </button>
            <button className="btn btn-ghost" onClick={() => { setFile(null); setResult(null); }}>Limpar</button>
          </div>

          {!activeProjectId && (
            <div style={{ marginTop: 10, fontSize: 12, color: 'var(--yellow)' }}>⚠️ Selecione um projeto ativo antes de importar.</div>
          )}
        </div>
      )}
    </div>
  );
}
