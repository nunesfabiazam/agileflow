/**
 * AgileFlow — Import Module
 *
 * Suporte para importação de:
 * ─ Jira    : CSV export (issues), JSON (Jira Cloud export)
 * ─ Confluence: HTML export (page dump), XML (space export)
 * ─ Markdown (.md)
 * ─ Word    (.docx)  via mammoth
 * ─ PDF              via pdf-parse
 * ─ Excel   (.xlsx)  via xlsx
 * ─ HTML    (.html)
 */

import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate as any);

// ── Multer setup ──────────────────────────────────────────────────────────────
const upload = multer({
  dest: '/tmp/agileflow-imports/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.json', '.md', '.markdown', '.docx', '.pdf', '.xlsx', '.xls', '.html', '.htm', '.xml', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Formato não suportado: ${ext}. Formatos aceitos: CSV, JSON, MD, DOCX, PDF, XLSX, HTML, XML, ZIP`));
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

async function parseMarkdown(filePath: string): Promise<{ title: string; content: string }> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const firstLine = raw.split('\n')[0].replace(/^#+\s*/, '').trim();
  return { title: firstLine || 'Documento importado', content: raw };
}

async function parseHtml(filePath: string): Promise<{ title: string; content: string }> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const titleMatch = raw.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Match = raw.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const title = (titleMatch?.[1] || h1Match?.[1] || 'Documento HTML importado').trim();
  // Strip scripts and styles, keep readable content
  const clean = raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  return { title, content: clean };
}

async function parseDocx(filePath: string): Promise<{ title: string; content: string }> {
  try {
    // Dynamic import to avoid hard dependency at startup
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ path: filePath });
    const h1Match = result.value.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    return {
      title: (h1Match?.[1] || path.basename(filePath, '.docx')).trim(),
      content: result.value,
    };
  } catch {
    throw new Error('Não foi possível processar o arquivo .docx. Certifique-se de que o pacote "mammoth" está instalado.');
  }
}

async function parsePdf(filePath: string): Promise<{ title: string; content: string }> {
  try {
    const pdfParse = await import('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse.default(dataBuffer);
    const firstLine = data.text.split('\n').find((l: string) => l.trim())?.trim() || 'PDF Importado';
    return { title: firstLine, content: `<pre>${data.text}</pre>` };
  } catch {
    throw new Error('Não foi possível processar o PDF. Certifique-se de que o pacote "pdf-parse" está instalado.');
  }
}

async function parseExcel(filePath: string): Promise<{ sheets: Array<{ name: string; rows: Record<string, unknown>[] }> }> {
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.readFile(filePath);
    const sheets = wb.SheetNames.map(name => ({
      name,
      rows: XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]),
    }));
    return { sheets };
  } catch {
    throw new Error('Não foi possível processar o Excel. Certifique-se de que o pacote "xlsx" está instalado.');
  }
}

// Jira CSV format: Summary,Issue Type,Priority,Status,Story Points,Epic Link,Assignee,Reporter,Description
function parseJiraCsv(rows: Record<string, string>[], projectId: string, creatorId: string, columnMap: Record<string, string>) {
  return rows.map(row => {
    const status = row['Status'] || row['status'] || '';
    const colId = columnMap[status.toLowerCase()] ?? null;
    return {
      title:       (row['Summary'] || row['summary'] || '').substring(0, 500),
      description: row['Description'] || row['description'] || null,
      type:        mapJiraType(row['Issue Type'] || row['issue type'] || ''),
      priority:    mapJiraPriority(row['Priority'] || row['priority'] || ''),
      storyPoints: parseInt(row['Story Points'] || row['story_points'] || '0') || null,
      columnId:    colId,
      projectId,
      creatorId,
      taskKey:     row['Issue key'] || row['issue_key'] || '',
    };
  });
}

function mapJiraType(t: string): 'STORY' | 'BUG' | 'TASK' | 'SPIKE' | 'EPIC' | 'SUBTASK' {
  const m: Record<string, 'STORY' | 'BUG' | 'TASK' | 'SPIKE' | 'EPIC' | 'SUBTASK'> = {
    'story': 'STORY', 'bug': 'BUG', 'task': 'TASK', 'sub-task': 'SUBTASK',
    'epic': 'EPIC', 'spike': 'SPIKE', 'improvement': 'TASK', 'new feature': 'STORY',
  };
  return m[t.toLowerCase()] ?? 'TASK';
}

function mapJiraPriority(p: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const m: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = {
    'blocker': 'CRITICAL', 'critical': 'CRITICAL', 'major': 'HIGH', 'high': 'HIGH',
    'medium': 'MEDIUM', 'minor': 'LOW', 'low': 'LOW', 'trivial': 'LOW',
  };
  return m[p.toLowerCase()] ?? 'MEDIUM';
}

// ── Routes ────────────────────────────────────────────────────────────────────

/**
 * POST /api/import/document
 * Import a single document file (MD, HTML, DOCX, PDF) → creates a Document record
 */
router.post('/document', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId, spaceId } = req.body;
  if (!projectId) { res.status(400).json({ success: false, error: 'projectId é obrigatório.' }); return; }

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let result: { title: string; content: string };

    switch (ext) {
      case '.md':
      case '.markdown': result = await parseMarkdown(req.file.path); break;
      case '.html':
      case '.htm':      result = await parseHtml(req.file.path); break;
      case '.docx':     result = await parseDocx(req.file.path); break;
      case '.pdf':      result = await parsePdf(req.file.path); break;
      default: res.status(400).json({ success: false, error: `Formato ${ext} não suportado para importação de documentos.` }); return;
    }

    const doc = await prisma.document.create({
      data: {
        title: result.title,
        content: result.content,
        type: 'OTHER',
        projectId,
        spaceId: spaceId || undefined,
        authorId: req.user!.userId,
      },
    });
    fs.unlinkSync(req.file.path);
    res.status(201).json({ success: true, data: doc, message: `Documento "${result.title}" importado com sucesso.` });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    const msg = err instanceof Error ? err.message : 'Erro ao processar arquivo.';
    res.status(500).json({ success: false, error: msg });
  }
});

/**
 * POST /api/import/jira-csv
 * Import Jira issues from CSV export
 * Expected CSV columns: Summary, Issue Type, Priority, Status, Story Points, Description, Issue key
 */
router.post('/jira-csv', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId } = req.body;
  if (!projectId) { res.status(400).json({ success: false, error: 'projectId é obrigatório.' }); return; }

  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.readFile(req.file.path, { raw: false });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]]);

    // Build status → column mapping from existing project columns
    const cols = await prisma.kanbanColumn.findMany({ where: { projectId } });
    const colMap: Record<string, string> = {};
    cols.forEach(c => { colMap[c.name.toLowerCase()] = c.id; });

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) { res.status(404).json({ success: false, error: 'Projeto não encontrado.' }); return; }

    const taskCount = await prisma.task.count({ where: { projectId } });
    const tasks = parseJiraCsv(rows, projectId, req.user!.userId, colMap);

    let created = 0;
    let skipped = 0;
    for (const [i, t] of tasks.entries()) {
      if (!t.title) { skipped++; continue; }
      await prisma.task.create({
        data: {
          taskKey:     t.taskKey || `${project.key}-${taskCount + i + 1}`,
          title:       t.title,
          description: t.description,
          type:        t.type,
          priority:    t.priority,
          storyPoints: t.storyPoints,
          columnId:    t.columnId,
          projectId,
          creatorId:   req.user!.userId,
        },
      });
      created++;
    }
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `Importação concluída: ${created} tasks criadas, ${skipped} ignoradas.`, data: { created, skipped } });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Erro ao processar CSV.' });
  }
});

/**
 * POST /api/import/jira-json
 * Import from Jira Cloud JSON export (issues array)
 */
router.post('/jira-json', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId } = req.body;

  try {
    const raw = fs.readFileSync(req.file.path, 'utf-8');
    const json = JSON.parse(raw);
    const issues: unknown[] = Array.isArray(json) ? json : (json.issues ?? json.data ?? []);

    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) { res.status(404).json({ success: false, error: 'Projeto não encontrado.' }); return; }
    const cols = await prisma.kanbanColumn.findMany({ where: { projectId } });
    const colMap: Record<string, string> = {};
    cols.forEach(c => { colMap[c.name.toLowerCase()] = c.id; });
    const taskCount = await prisma.task.count({ where: { projectId } });

    let created = 0;
    for (const [i, issue] of (issues as Record<string, unknown>[]).entries()) {
      const fields = (issue.fields as Record<string, unknown>) ?? issue;
      const summary = ((fields.summary ?? issue.summary) as string | undefined) ?? '';
      if (!summary) continue;
      const statusName = ((fields.status as Record<string, unknown> | undefined)?.name as string | undefined) ?? '';
      await prisma.task.create({
        data: {
          taskKey:     (issue.key as string | undefined) || `${project.key}-${taskCount + i + 1}`,
          title:       summary.substring(0, 500),
          description: (fields.description as string | undefined) ?? null,
          type:        mapJiraType((fields.issuetype as Record<string, string> | undefined)?.name ?? ''),
          priority:    mapJiraPriority((fields.priority as Record<string, string> | undefined)?.name ?? ''),
          storyPoints: (fields.story_points as number | undefined) ?? (fields.customfield_10016 as number | undefined) ?? null,
          columnId:    colMap[statusName.toLowerCase()] ?? null,
          projectId,
          creatorId:   req.user!.userId,
        },
      });
      created++;
    }
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `${created} issues importadas do Jira JSON.`, data: { created } });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Erro ao processar JSON.' });
  }
});

/**
 * POST /api/import/confluence-html
 * Import Confluence HTML export (single page or space dump ZIP)
 */
router.post('/confluence-html', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId, spaceId } = req.body;

  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const docs: Array<{ title: string; content: string }> = [];

    if (ext === '.zip') {
      // Extract and process all HTML files in the ZIP
      const AdmZip = await import('adm-zip');
      const zip = new AdmZip.default(req.file.path);
      const entries = zip.getEntries().filter(e => ['.html', '.htm'].includes(path.extname(e.entryName).toLowerCase()));
      for (const entry of entries) {
        const content = entry.getData().toString('utf-8');
        const tmp = `/tmp/cf-${Date.now()}-${Math.random()}.html`;
        fs.writeFileSync(tmp, content);
        docs.push(await parseHtml(tmp));
        fs.unlinkSync(tmp);
      }
    } else {
      docs.push(await parseHtml(req.file.path));
    }

    let created = 0;
    for (const d of docs) {
      await prisma.document.create({
        data: {
          title: d.title, content: d.content, type: 'OTHER',
          projectId, spaceId: spaceId || undefined,
          authorId: req.user!.userId,
        },
      });
      created++;
    }
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `${created} documento(s) importado(s) do Confluence.`, data: { created } });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Erro ao processar arquivo Confluence.' });
  }
});

/**
 * POST /api/import/excel-tasks
 * Import tasks from Excel spreadsheet
 * Expected columns: Title, Type, Priority, Status, Story Points, Epic, Description, Assignee
 */
router.post('/excel-tasks', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId } = req.body;

  try {
    const { sheets } = await parseExcel(req.file.path);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) { res.status(404).json({ success: false, error: 'Projeto não encontrado.' }); return; }
    const cols = await prisma.kanbanColumn.findMany({ where: { projectId } });
    const colMap: Record<string, string> = {};
    cols.forEach(c => { colMap[c.name.toLowerCase()] = c.id; });
    const taskCount = await prisma.task.count({ where: { projectId } });

    const rows = sheets[0]?.rows ?? [];
    let created = 0;
    for (const [i, row] of rows.entries()) {
      const r = row as Record<string, unknown>;
      const title = String(r['Title'] ?? r['title'] ?? r['Título'] ?? r['titulo'] ?? '').trim();
      if (!title) continue;
      const status = String(r['Status'] ?? r['status'] ?? '').toLowerCase();
      await prisma.task.create({
        data: {
          taskKey:     `${project.key}-${taskCount + i + 1}`,
          title:       title.substring(0, 500),
          description: String(r['Description'] ?? r['Descrição'] ?? r['descricao'] ?? '').trim() || null,
          type:        mapJiraType(String(r['Type'] ?? r['Tipo'] ?? r['type'] ?? 'Task')),
          priority:    mapJiraPriority(String(r['Priority'] ?? r['Prioridade'] ?? r['priority'] ?? 'Medium')),
          storyPoints: parseInt(String(r['Story Points'] ?? r['Pontos'] ?? '0')) || null,
          columnId:    colMap[status] ?? null,
          projectId,
          creatorId:   req.user!.userId,
        },
      });
      created++;
    }
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `${created} tasks importadas da planilha Excel.`, data: { created } });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Erro ao processar Excel.' });
  }
});

/**
 * GET /api/import/template/jira-csv
 * Download a template CSV for Jira-compatible import
 */
router.get('/template/jira-csv', (_req, res: Response) => {
  const header = 'Issue key,Summary,Issue Type,Priority,Status,Story Points,Epic Link,Assignee,Description\n';
  const example = ',Implementar tela de login,Story,High,To Do,5,,dev@empresa.com,Criar a tela de login com OAuth2\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="agileflow-jira-import-template.csv"');
  res.send(header + example);
});

/**
 * GET /api/import/template/excel
 * Download a template Excel for task import
 */
router.get('/template/excel', async (_req, res: Response) => {
  try {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Title', 'Type', 'Priority', 'Status', 'Story Points', 'Description'],
      ['Implementar tela de login', 'Story', 'High', 'To Do', '5', 'Criar a tela de login com OAuth2'],
      ['Corrigir bug no carrinho', 'Bug', 'Critical', 'In Progress', '2', 'Itens desaparecem ao recarregar'],
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="agileflow-import-template.xlsx"');
    res.send(buf);
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao gerar template.' });
  }
});

export default router;
