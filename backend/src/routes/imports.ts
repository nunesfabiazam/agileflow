/**
 * AgileFlow — Import Module
 *
 * Suporte para importação de:
 * ─ Jira CSV  : export PT-BR e EN (Resumo/Summary, Tipo de Item/Issue Type...)
 * ─ Jira JSON : Jira Cloud export
 * ─ Confluence: HTML export (page dump), ZIP (space export)
 * ─ Markdown  (.md)
 * ─ Word      (.docx)  via mammoth
 * ─ PDF                via pdf-parse
 * ─ Excel     (.xlsx)  via xlsx
 * ─ HTML      (.html)
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

const upload = multer({
  dest: '/tmp/agileflow-imports/',
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.json', '.md', '.markdown', '.docx', '.pdf', '.xlsx', '.xls', '.html', '.htm', '.xml', '.zip'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error(`Formato não suportado: ${ext}. Aceitos: CSV, JSON, MD, DOCX, PDF, XLSX, HTML, XML, ZIP`));
  },
});

// ── Templates PÚBLICOS (sem autenticação) ─────────────────────────────────────

router.get('/template/jira-csv', (_req, res: Response) => {
  const header = 'Resumo,Chave do item,Tipo de Item,Situação,Prioridade,Descrição,Sprint,Campo personalizado (Pontos de História)\n';
  const rows = [
    'Implementar tela de login,PROJ-1,História,A Fazer,Alta,Criar a tela de login com OAuth2,Sprint 1,5',
    'Corrigir bug no carrinho,PROJ-2,Problema,Em Progresso,Crítica,Itens desaparecem ao recarregar,Sprint 1,2',
    'Refatorar módulo de pagamento,PROJ-3,Tarefa,Backlog,Média,Melhorar performance e legibilidade,,3',
    'Pesquisar bibliotecas de gráficos,PROJ-4,Épico,Concluída,Baixa,Avaliar opções para dashboard,,8',
  ].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="agileflow-jira-template.csv"');
  res.send('\uFEFF' + header + rows);
});

router.get('/template/excel', async (_req, res: Response) => {
  try {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.aoa_to_sheet([
      ['Título', 'Tipo', 'Prioridade', 'Status', 'Pontos de História', 'Descrição'],
      ['Implementar tela de login', 'Story', 'High', 'To Do', 5, 'Criar a tela de login com OAuth2'],
      ['Corrigir bug no carrinho', 'Bug', 'Critical', 'In Progress', 2, 'Itens desaparecem ao recarregar'],
      ['Refatorar módulo de pagamento', 'Task', 'Medium', 'Backlog', 3, 'Melhorar performance e legibilidade'],
    ]);
    ws['!cols'] = [{ wch: 40 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 50 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tarefas');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="agileflow-import-template.xlsx"');
    res.send(buf);
  } catch {
    res.status(500).json({ success: false, error: 'Erro ao gerar template.' });
  }
});

// ── Autenticação para rotas de importação ─────────────────────────────────────
router.use(authenticate as any);

// ── Helpers ───────────────────────────────────────────────────────────────────

function norm(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
}

function getField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const val = row[key];
    if (val !== undefined && val !== null && String(val).trim() !== '') return String(val).trim();
  }
  return '';
}

function findColumnId(columnMap: Record<string, string>, status: string): string | null {
  if (!status) return null;
  const n = norm(status);

  for (const [key, id] of Object.entries(columnMap)) {
    if (norm(key) === n) return id;
  }

  const groups: Array<{ patterns: string[]; colFragments: string[] }> = [
    {
      patterns: ['concluida', 'concluido', 'done', 'closed', 'resolved', 'finalizado', 'complete'],
      colFragments: ['conclu', 'done', 'finish', 'final'],
    },
    {
      patterns: ['em progresso', 'in progress', 'em andamento', 'doing', 'wip', 'desenvolvimento'],
      colFragments: ['progresso', 'progress', 'andamento', 'doing'],
    },
    {
      patterns: ['em revisao', 'em revisão', 'review', 'in review', 'code review'],
      colFragments: ['revis', 'review'],
    },
    {
      patterns: ['a fazer', 'to do', 'todo', 'para fazer', 'open', 'new', 'aberto', 'backlog'],
      colFragments: ['fazer', 'to do', 'todo', 'backlog', 'aberto', 'open'],
    },
  ];

  for (const group of groups) {
    if (group.patterns.some(p => n.includes(p) || p.includes(n))) {
      for (const [key, id] of Object.entries(columnMap)) {
        const kn = norm(key);
        if (group.colFragments.some(f => kn.includes(f))) return id;
      }
    }
  }
  return null;
}

function mapJiraType(t: string): 'STORY' | 'BUG' | 'TASK' | 'SPIKE' | 'EPIC' | 'SUBTASK' {
  const n = norm(t);
  const map: Record<string, 'STORY' | 'BUG' | 'TASK' | 'SPIKE' | 'EPIC' | 'SUBTASK'> = {
    'historia': 'STORY', 'história': 'STORY', 'story': 'STORY', 'user story': 'STORY',
    'problema': 'BUG', 'bug': 'BUG', 'defect': 'BUG',
    'tarefa': 'TASK', 'task': 'TASK',
    'epico': 'EPIC', 'épico': 'EPIC', 'epic': 'EPIC',
    'subtarefa': 'SUBTASK', 'sub-tarefa': 'SUBTASK', 'sub-task': 'SUBTASK', 'subtask': 'SUBTASK',
    'melhoria': 'TASK', 'improvement': 'TASK',
    'nova funcionalidade': 'STORY', 'new feature': 'STORY', 'feature': 'STORY',
    'pesquisa': 'SPIKE', 'spike': 'SPIKE', 'research': 'SPIKE',
  };
  return map[n] ?? 'TASK';
}

function mapJiraPriority(p: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const n = norm(p);
  const map: Record<string, 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = {
    'critica': 'CRITICAL', 'crítica': 'CRITICAL', 'bloqueante': 'CRITICAL', 'blocker': 'CRITICAL', 'critical': 'CRITICAL',
    'alta': 'HIGH', 'maior': 'HIGH', 'major': 'HIGH', 'high': 'HIGH',
    'media': 'MEDIUM', 'média': 'MEDIUM', 'medium': 'MEDIUM', 'normal': 'MEDIUM',
    'baixa': 'LOW', 'menor': 'LOW', 'minima': 'LOW', 'mínima': 'LOW', 'trivial': 'LOW', 'minor': 'LOW', 'low': 'LOW',
  };
  return map[n] ?? 'MEDIUM';
}

function parseJiraCsvRows(rows: Record<string, string>[], columnMap: Record<string, string>) {
  return rows.map(row => ({
    title:       getField(row, 'Resumo', 'Summary', 'summary', 'título', 'Título').substring(0, 500),
    description: getField(row, 'Descrição', 'Description', 'description') || null,
    type:        mapJiraType(getField(row, 'Tipo de Item', 'Issue Type', 'issue type', 'type', 'Type')),
    priority:    mapJiraPriority(getField(row, 'Prioridade', 'Priority', 'priority')),
    storyPoints: parseInt(getField(row, 'Campo personalizado (Pontos de História)', 'Campo personalizado (${field_Story_Points})', 'Story Points', 'story_points', 'Pontos')) || null,
    columnId:    findColumnId(columnMap, getField(row, 'Situação', 'Status', 'status')),
    issueKey:    getField(row, 'Chave do item', 'Issue key', 'Issue Key', 'issue_key'),
    // Epic: key from "Épico Link" / "Epic Link" OR title from "Épico" / "Epic Name"
    epicLink:    getField(row, 'Épico Link', 'Epic Link', 'epic_link', 'epicLink', 'Épico', 'Epic Name', 'Epic'),
    // Assignee: Jira username from "Responsável" / "Assignee"
    assigneeRaw: getField(row, 'Responsável', 'Assignee', 'assignee', 'responsável'),
  }));
}

async function parseMarkdown(filePath: string): Promise<{ title: string; content: string }> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  return { title: raw.split('\n')[0].replace(/^#+\s*/, '').trim() || 'Documento importado', content: raw };
}

async function parseHtml(filePath: string): Promise<{ title: string; content: string }> {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const t = raw.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || raw.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || 'Documento HTML importado';
  return { title: t.trim(), content: raw.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '') };
}

async function parseDocx(filePath: string): Promise<{ title: string; content: string }> {
  try {
    const mammoth = await import('mammoth');
    const result = await mammoth.convertToHtml({ path: filePath });
    return { title: (result.value.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1] || path.basename(filePath, '.docx')).trim(), content: result.value };
  } catch { throw new Error('Não foi possível processar o .docx.'); }
}

async function parsePdf(filePath: string): Promise<{ title: string; content: string }> {
  try {
    const pdfParse = await import('pdf-parse');
    const data = await pdfParse.default(fs.readFileSync(filePath));
    return { title: data.text.split('\n').find((l: string) => l.trim())?.trim() || 'PDF Importado', content: `<pre>${data.text}</pre>` };
  } catch { throw new Error('Não foi possível processar o PDF.'); }
}

async function parseExcel(filePath: string) {
  const XLSX = await import('xlsx');
  const wb = XLSX.readFile(filePath);
  return { sheets: wb.SheetNames.map(name => ({ name, rows: XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[name]) })) };
}

// ── Routes autenticadas ───────────────────────────────────────────────────────

router.post('/document', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId, spaceId } = req.body;
  if (!projectId) { res.status(400).json({ success: false, error: 'projectId é obrigatório.' }); return; }
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    let result: { title: string; content: string };
    switch (ext) {
      case '.md': case '.markdown': result = await parseMarkdown(req.file.path); break;
      case '.html': case '.htm':    result = await parseHtml(req.file.path); break;
      case '.docx':                 result = await parseDocx(req.file.path); break;
      case '.pdf':                  result = await parsePdf(req.file.path); break;
      default: res.status(400).json({ success: false, error: `Formato ${ext} não suportado.` }); return;
    }
    const doc = await prisma.document.create({
      data: { title: result.title, content: result.content, type: 'OTHER', projectId, spaceId: spaceId || undefined, authorId: req.user!.userId },
    });
    fs.unlinkSync(req.file.path);
    res.status(201).json({ success: true, data: doc, message: `Documento "${result.title}" importado.` });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Erro ao processar arquivo.' });
  }
});

router.post('/jira-csv', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId } = req.body;
  if (!projectId) { res.status(400).json({ success: false, error: 'projectId é obrigatório.' }); return; }
  try {
    const XLSX = await import('xlsx');
    const wb = XLSX.readFile(req.file.path, { raw: false, codepage: 65001 });
    const rows = XLSX.utils.sheet_to_json<Record<string, string>>(wb.Sheets[wb.SheetNames[0]], { defval: '' });

    if (rows.length === 0) {
      res.json({ success: true, message: 'Arquivo vazio.', data: { created: 0, skipped: 0 } }); return;
    }

    const detectedCols = Object.keys(rows[0] ?? {});
    console.log('[import/jira-csv] Colunas detectadas:', detectedCols);

    const [cols, project, allUsers] = await Promise.all([
      prisma.kanbanColumn.findMany({ where: { projectId } }),
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.user.findMany({ select: { id: true, email: true, name: true } }),
    ]);
    if (!project) { res.status(404).json({ success: false, error: 'Projeto não encontrado.' }); return; }

    const colMap: Record<string, string> = {};
    cols.forEach(c => { colMap[norm(c.name)] = c.id; });

    // Helper: match Jira username/display-name to a user in the system
    function findUserId(raw: string): string | null {
      if (!raw) return null;
      const n = raw.toLowerCase().trim();
      // try email prefix match (e.g. "fabio.morimoto" → "fabio.morimoto@fgv.br")
      const byEmail = allUsers.find(u => u.email.toLowerCase().startsWith(n) || u.email.toLowerCase().split('@')[0] === n);
      if (byEmail) return byEmail.id;
      // try name match (normalized)
      const byName = allUsers.find(u => norm(u.name).includes(n) || n.includes(norm(u.name)));
      return byName?.id ?? null;
    }

    const parsed = parseJiraCsvRows(rows, colMap);
    const taskCount = await prisma.task.count({ where: { projectId } });

    // ── PASS 1: create Epics (rows where type === EPIC) ──────────────────────
    // epicKey (issueKey or title) → AgileFlow epicId
    const epicKeyMap: Record<string, string> = {};
    const epicTitleMap: Record<string, string> = {};

    for (const t of parsed) {
      if (t.type !== 'EPIC' || !t.title) continue;
      // Check if epic already exists by title in this project
      const existing = await prisma.epic.findFirst({ where: { projectId, title: t.title } });
      if (existing) {
        if (t.issueKey) epicKeyMap[t.issueKey] = existing.id;
        epicTitleMap[norm(t.title)] = existing.id;
        continue;
      }
      const epic = await prisma.epic.create({
        data: { title: t.title, description: t.description, projectId, creatorId: req.user!.userId },
      });
      if (t.issueKey) epicKeyMap[t.issueKey] = epic.id;
      epicTitleMap[norm(t.title)] = epic.id;
    }

    // ── PASS 2: create Tasks (skip rows that are pure Epics) ─────────────────
    let created = 0, skipped = 0;
    const force = req.body.force === 'true';

    for (const [i, t] of parsed.entries()) {
      if (!t.title) { skipped++; continue; }

      // Resolve epicId: try issueKey match first, then title match
      let epicId: string | null = null;
      if (t.epicLink) {
        const linkNorm = t.epicLink.trim();
        epicId = epicKeyMap[linkNorm]            // exact key match (e.g. PROJ-5)
          ?? epicTitleMap[norm(linkNorm)]        // title match
          ?? null;
        // If not found yet, try creating the epic on the fly from the link string
        if (!epicId && linkNorm) {
          const existing = await prisma.epic.findFirst({ where: { projectId, title: linkNorm } });
          if (existing) {
            epicId = existing.id;
          } else {
            const newEpic = await prisma.epic.create({
              data: { title: linkNorm, projectId, creatorId: req.user!.userId },
            });
            epicId = newEpic.id;
            epicTitleMap[norm(linkNorm)] = epicId;
          }
        }
      }

      // Skip or overwrite existing tasks
      if (t.issueKey) {
        const exists = await prisma.task.findFirst({ where: { taskKey: t.issueKey, projectId } });
        if (exists) {
          if (!force) { skipped++; continue; }
          // force=true: delete existing task (assignees cascade) then recreate
          await prisma.task.delete({ where: { id: exists.id } });
        }
      }

      // Resolve assignee
      const assigneeId = findUserId(t.assigneeRaw);

      const task = await prisma.task.create({
        data: {
          taskKey:     t.issueKey || `${project.key}-${taskCount + created + 1}`,
          title:       t.title,
          description: t.description,
          type:        t.type === 'EPIC' ? 'TASK' : t.type, // epics already created above
          priority:    t.priority,
          storyPoints: t.storyPoints,
          columnId:    t.columnId,
          epicId:      epicId,
          projectId,
          creatorId:   req.user!.userId,
          ...(assigneeId ? {
            assignees: { create: [{ userId: assigneeId }] },
          } : {}),
        },
      });
      created++;
      void task;
    }

    fs.unlinkSync(req.file.path);

    const epicsCreated = Object.keys(epicKeyMap).length + Object.keys(epicTitleMap).length;
    res.json({
      success: true,
      message: `Importação concluída: ${created} tasks e ${Object.keys(epicTitleMap).length} épicos criados, ${skipped} ignorados.`,
      data: { created, skipped, epicsCreated: Object.keys(epicTitleMap).length },
    });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    console.error('[import/jira-csv]', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Erro ao processar CSV.' });
  }
});

router.post('/jira-json', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId } = req.body;
  try {
    const json = JSON.parse(fs.readFileSync(req.file.path, 'utf-8'));
    const issues: Record<string, unknown>[] = Array.isArray(json) ? json : (json.issues ?? json.data ?? []);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) { res.status(404).json({ success: false, error: 'Projeto não encontrado.' }); return; }
    const cols = await prisma.kanbanColumn.findMany({ where: { projectId } });
    const colMap: Record<string, string> = {};
    cols.forEach(c => { colMap[norm(c.name)] = c.id; });
    const taskCount = await prisma.task.count({ where: { projectId } });
    let created = 0;
    for (const [i, issue] of issues.entries()) {
      const fields = (issue.fields as Record<string, unknown>) ?? issue;
      const summary = String((fields.summary ?? issue.summary) ?? '');
      if (!summary) continue;
      await prisma.task.create({
        data: {
          taskKey:     String(issue.key ?? `${project.key}-${taskCount + i + 1}`),
          title:       summary.substring(0, 500),
          description: String(fields.description ?? '') || null,
          type:        mapJiraType(String((fields.issuetype as Record<string,string> | undefined)?.name ?? '')),
          priority:    mapJiraPriority(String((fields.priority as Record<string,string> | undefined)?.name ?? '')),
          storyPoints: Number(fields.story_points ?? fields.customfield_10016) || null,
          columnId:    findColumnId(colMap, String((fields.status as Record<string,string> | undefined)?.name ?? '')),
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

// ── Jira XML parser ───────────────────────────────────────────────────────────

function xmlText(xml: string, tag: string): string {
  // Matches <tag ...>content</tag> or <tag ...><![CDATA[content]]></tag>
  const re = new RegExp(`<${tag}(?:[^>]*)>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const m = xml.match(re);
  if (!m) return '';
  const raw = m[1].trim();
  // unwrap CDATA
  const cdata = raw.match(/^<!\[CDATA\[([\s\S]*?)]]>$/);
  return (cdata ? cdata[1] : raw).trim();
}

function xmlAttr(xml: string, tag: string, attr: string): string {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`, 'i');
  return xml.match(re)?.[1]?.trim() ?? '';
}

function xmlCustomField(xml: string, nameFragment: string): string {
  // Find customfield block where customfieldname contains nameFragment
  const blocks = [...xml.matchAll(/<customfield[\s\S]*?<\/customfield>/gi)];
  for (const b of blocks) {
    const block = b[0];
    const name = xmlText(block, 'customfieldname');
    if (norm(name).includes(norm(nameFragment))) {
      return xmlText(block, 'customfieldvalue');
    }
  }
  return '';
}

function parseJiraXml(xmlContent: string) {
  // Extract all <item> blocks
  const items: string[] = [];
  const re = /<item>([\s\S]*?)<\/item>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xmlContent)) !== null) items.push(m[1]);

  return items.map(item => ({
    issueKey:    xmlText(item, 'key'),
    title:       xmlText(item, 'summary').substring(0, 500),
    description: xmlText(item, 'description') || null,
    type:        xmlText(item, 'type'),
    priority:    xmlText(item, 'priority'),
    status:      xmlText(item, 'status'),
    assigneeRaw: xmlText(item, 'assignee') || xmlAttr(item, 'assignee', 'username') || xmlAttr(item, 'assignee', 'accountid'),
    epicLink:    xmlCustomField(item, 'Epic Link') || xmlCustomField(item, 'Épico Link') || xmlCustomField(item, 'epic link'),
    storyPoints: parseInt(xmlCustomField(item, 'Story Points') || xmlCustomField(item, 'Pontos de História') || '0') || null,
  }));
}

// POST /api/import/jira-xml
router.post('/jira-xml', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId } = req.body;
  if (!projectId) { res.status(400).json({ success: false, error: 'projectId é obrigatório.' }); return; }
  try {
    const xmlContent = fs.readFileSync(req.file.path, 'utf-8');
    const parsed = parseJiraXml(xmlContent);

    if (parsed.length === 0) {
      res.json({ success: true, message: 'Nenhuma issue encontrada no XML.', data: { created: 0, skipped: 0 } }); return;
    }
    console.log(`[import/jira-xml] ${parsed.length} issues encontradas`);

    const [cols, project, allUsers] = await Promise.all([
      prisma.kanbanColumn.findMany({ where: { projectId } }),
      prisma.project.findUnique({ where: { id: projectId } }),
      prisma.user.findMany({ select: { id: true, email: true, name: true } }),
    ]);
    if (!project) { res.status(404).json({ success: false, error: 'Projeto não encontrado.' }); return; }

    const colMap: Record<string, string> = {};
    cols.forEach(c => { colMap[norm(c.name)] = c.id; });

    function findUserId(raw: string): string | null {
      if (!raw) return null;
      const n = raw.toLowerCase().trim();
      const byEmail = allUsers.find(u => u.email.toLowerCase().split('@')[0] === n || u.email.toLowerCase().startsWith(n));
      if (byEmail) return byEmail.id;
      const byName = allUsers.find(u => norm(u.name).includes(n) || n.includes(norm(u.name)));
      return byName?.id ?? null;
    }

    const taskCount = await prisma.task.count({ where: { projectId } });
    const epicTitleMap: Record<string, string> = {};
    const epicKeyMap:   Record<string, string> = {};

    // ── Pass 1: create Epics ────────────────────────────────────────────────
    for (const t of parsed) {
      if (mapJiraType(t.type) !== 'EPIC' || !t.title) continue;
      const existing = await prisma.epic.findFirst({ where: { projectId, title: t.title } });
      if (existing) {
        if (t.issueKey) epicKeyMap[t.issueKey] = existing.id;
        epicTitleMap[norm(t.title)] = existing.id;
        continue;
      }
      const epic = await prisma.epic.create({
        data: { title: t.title, description: t.description, projectId, creatorId: req.user!.userId },
      });
      if (t.issueKey) epicKeyMap[t.issueKey] = epic.id;
      epicTitleMap[norm(t.title)] = epic.id;
    }

    // ── Pass 2: create Tasks ────────────────────────────────────────────────
    let created = 0, skipped = 0;
    const force = req.body.force === 'true';
    for (const [i, t] of parsed.entries()) {
      if (!t.title) { skipped++; continue; }

      // Resolve epicId
      let epicId: string | null = null;
      if (t.epicLink) {
        const linkNorm = t.epicLink.trim();
        epicId = epicKeyMap[linkNorm] ?? epicTitleMap[norm(linkNorm)] ?? null;
        if (!epicId) {
          const existing = await prisma.epic.findFirst({ where: { projectId, title: linkNorm } });
          if (existing) { epicId = existing.id; }
          else {
            const newEpic = await prisma.epic.create({ data: { title: linkNorm, projectId, creatorId: req.user!.userId } });
            epicId = newEpic.id;
            epicTitleMap[norm(linkNorm)] = epicId;
          }
        }
      }

      // Skip or overwrite duplicates
      if (t.issueKey) {
        const exists = await prisma.task.findFirst({ where: { taskKey: t.issueKey, projectId } });
        if (exists) {
          if (!force) { skipped++; continue; }
          await prisma.task.delete({ where: { id: exists.id } });
        }
      }

      const assigneeId = findUserId(t.assigneeRaw);
      const type = mapJiraType(t.type);

      await prisma.task.create({
        data: {
          taskKey:     t.issueKey || `${project.key}-${taskCount + created + 1}`,
          title:       t.title,
          description: t.description,
          type:        type === 'EPIC' ? 'TASK' : type,
          priority:    mapJiraPriority(t.priority),
          storyPoints: t.storyPoints,
          columnId:    findColumnId(colMap, t.status),
          epicId,
          projectId,
          creatorId:   req.user!.userId,
          ...(assigneeId ? { assignees: { create: [{ userId: assigneeId }] } } : {}),
        },
      });
      created++;
    }

    fs.unlinkSync(req.file.path);
    res.json({
      success: true,
      message: `Importação XML concluída: ${created} tasks e ${Object.keys(epicTitleMap).length} épicos criados, ${skipped} ignorados.`,
      data: { created, skipped, epicsCreated: Object.keys(epicTitleMap).length },
    });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    console.error('[import/jira-xml]', err);
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Erro ao processar XML.' });
  }
});

router.post('/confluence-html', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId, spaceId } = req.body;
  try {
    const ext = path.extname(req.file.originalname).toLowerCase();
    const docs: Array<{ title: string; content: string }> = [];
    if (ext === '.zip') {
      const AdmZip = await import('adm-zip');
      const zip = new AdmZip.default(req.file.path);
      for (const entry of zip.getEntries().filter(e => ['.html','.htm'].includes(path.extname(e.entryName).toLowerCase()))) {
        const tmp = `/tmp/cf-${Date.now()}.html`;
        fs.writeFileSync(tmp, entry.getData().toString('utf-8'));
        docs.push(await parseHtml(tmp));
        fs.unlinkSync(tmp);
      }
    } else { docs.push(await parseHtml(req.file.path)); }
    let created = 0;
    for (const d of docs) {
      await prisma.document.create({ data: { title: d.title, content: d.content, type: 'OTHER', projectId, spaceId: spaceId || undefined, authorId: req.user!.userId } });
      created++;
    }
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `${created} documento(s) importado(s).`, data: { created } });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Erro ao processar Confluence.' });
  }
});

router.post('/excel-tasks', upload.single('file'), async (req: AuthRequest, res: Response) => {
  if (!req.file) { res.status(400).json({ success: false, error: 'Nenhum arquivo enviado.' }); return; }
  const { projectId } = req.body;
  try {
    const { sheets } = await parseExcel(req.file.path);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    if (!project) { res.status(404).json({ success: false, error: 'Projeto não encontrado.' }); return; }
    const cols = await prisma.kanbanColumn.findMany({ where: { projectId } });
    const colMap: Record<string, string> = {};
    cols.forEach(c => { colMap[norm(c.name)] = c.id; });
    const taskCount = await prisma.task.count({ where: { projectId } });
    const rows = sheets[0]?.rows ?? [];
    let created = 0;
    for (const [i, row] of rows.entries()) {
      const r = row as Record<string, unknown>;
      const title = String(r['Título'] ?? r['Title'] ?? r['título'] ?? r['title'] ?? '').trim();
      if (!title) continue;
      await prisma.task.create({
        data: {
          taskKey:     `${project.key}-${taskCount + i + 1}`,
          title:       title.substring(0, 500),
          description: String(r['Descrição'] ?? r['Description'] ?? '').trim() || null,
          type:        mapJiraType(String(r['Tipo'] ?? r['Type'] ?? r['type'] ?? 'Task')),
          priority:    mapJiraPriority(String(r['Prioridade'] ?? r['Priority'] ?? 'Medium')),
          storyPoints: parseInt(String(r['Pontos de História'] ?? r['Story Points'] ?? '0')) || null,
          columnId:    findColumnId(colMap, String(r['Status'] ?? r['Situação'] ?? '')),
          projectId,
          creatorId:   req.user!.userId,
        },
      });
      created++;
    }
    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `${created} tasks importadas.`, data: { created } });
  } catch (err) {
    if (req.file?.path) try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err instanceof Error ? err.message : 'Erro ao processar Excel.' });
  }
});

export default router;
