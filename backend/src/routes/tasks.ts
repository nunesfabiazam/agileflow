import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();

router.use(authenticate as any);

const TaskSchema = z.object({
  title:        z.string().min(1).max(500),
  description:  z.string().optional(),
  type:         z.enum(['STORY','BUG','TASK','SPIKE','EPIC','SUBTASK']).default('TASK'),
  priority:     z.enum(['CRITICAL','HIGH','MEDIUM','LOW']).default('MEDIUM'),
  storyPoints:  z.number().int().min(0).max(100).optional(),
  columnId:     z.string().uuid().optional(),
  sprintId:     z.string().uuid().optional(),
  epicId:       z.string().uuid().optional(),
  parentId:     z.string().uuid().optional(),
  assigneeIds:  z.array(z.string().uuid()).optional(),
  dueDate:      z.string().datetime().optional(),
  projectId:    z.string().uuid(),
  criteria:     z.array(z.object({ text: z.string(), isDone: z.boolean().optional() })).optional(),
});

const taskSelect = {
  id: true, taskKey: true, title: true, description: true,
  type: true, priority: true, storyPoints: true, dueDate: true,
  isClosed: true, order: true, createdAt: true, updatedAt: true,
  column: { select: { id: true, name: true, color: true } },
  sprint: { select: { id: true, name: true } },
  epic:   { select: { id: true, title: true, color: true } },
  creator:{ select: { id: true, name: true, color: true } },
  assignees: { select: { user: { select: { id: true, name: true, color: true, avatarUrl: true } } } },
  criteria: { select: { id: true, text: true, isDone: true, order: true }, orderBy: { order: 'asc' as const } },
  _count: { select: { comments: true, subtasks: true, documents: true, blockedBy: true } },
};

// GET /api/tasks?projectId=&sprintId=&columnId=&type=&priority=
router.get('/', async (req: AuthRequest, res: Response) => {
  const { projectId, sprintId, columnId, type, priority, epicId, search, page = '1', limit = '50' } = req.query as Record<string, string>;
  const where: Record<string, unknown> = {};
  if (projectId)  where.projectId = projectId;
  if (sprintId)   where.sprintId  = sprintId === 'null' ? null : sprintId;
  if (columnId)   where.columnId  = columnId;
  if (type)       where.type      = type;
  if (priority)   where.priority  = priority;
  if (epicId)     where.epicId    = epicId;
  if (search)     where.title     = { contains: search, mode: 'insensitive' };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [tasks, total] = await Promise.all([
    prisma.task.findMany({ where, select: taskSelect, orderBy: [{ order: 'asc' }, { createdAt: 'desc' }], skip, take: parseInt(limit) }),
    prisma.task.count({ where }),
  ]);
  res.json({ success: true, data: tasks, pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) } });
});

// GET /api/tasks/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const task = await prisma.task.findUnique({
    where: { id: req.params.id },
    include: {
      column: true, sprint: true, epic: true,
      creator: { select: { id: true, name: true, color: true } },
      assignees: { include: { user: { select: { id: true, name: true, color: true, avatarUrl: true, role: true } } } },
      criteria: { orderBy: { order: 'asc' } },
      comments: { include: { author: { select: { id: true, name: true, color: true, avatarUrl: true } } }, orderBy: { createdAt: 'asc' } },
      documents: { include: { document: { select: { id: true, title: true, type: true } } } },
      subtasks: { select: { id: true, taskKey: true, title: true, type: true, priority: true, column: { select: { name: true } } } },
      blocks: { select: { id: true, blocked: { select: { id: true, taskKey: true, title: true, type: true, priority: true, isClosed: true, column: { select: { name: true } } } } } },
      blockedBy: { select: { id: true, blocker: { select: { id: true, taskKey: true, title: true, type: true, priority: true, isClosed: true, column: { select: { name: true } } } } } },
    },
  });
  if (!task) { res.status(404).json({ success: false, error: 'Task não encontrada.' }); return; }
  res.json({ success: true, data: task });
});

// POST /api/tasks
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = TaskSchema.parse(req.body);
    // Generate task key: PROJECT_KEY + sequential number
    const project = await prisma.project.findUnique({ where: { id: body.projectId } });
    if (!project) { res.status(404).json({ success: false, error: 'Projeto não encontrado.' }); return; }
    const count = await prisma.task.count({ where: { projectId: body.projectId } });
    const taskKey = `${project.key}-${count + 1}`;

    const task = await prisma.task.create({
      data: {
        taskKey,
        title:       body.title,
        description: body.description,
        type:        body.type,
        priority:    body.priority,
        storyPoints: body.storyPoints,
        columnId:    body.columnId,
        sprintId:    body.sprintId,
        epicId:      body.epicId,
        parentId:    body.parentId,
        projectId:   body.projectId,
        dueDate:     body.dueDate ? new Date(body.dueDate) : undefined,
        creatorId:   req.user!.userId,
        assignees: body.assigneeIds ? {
          create: body.assigneeIds.map(uid => ({ userId: uid })),
        } : undefined,
        criteria: body.criteria ? {
          create: body.criteria.map((c, i) => ({ text: c.text, isDone: c.isDone ?? false, order: i })),
        } : undefined,
      },
      select: taskSelect,
    });
    res.status(201).json({ success: true, data: task });
  } catch (err) {
    if (err instanceof z.ZodError) res.status(400).json({ success: false, error: err.errors });
    else res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

// PATCH /api/tasks/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  try {
    const { assigneeIds, criteria, ...rest } = req.body;
    const data: Record<string, unknown> = { ...rest };
    if (rest.dueDate) data.dueDate = new Date(rest.dueDate);

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        ...data,
        ...(assigneeIds !== undefined && {
          assignees: { deleteMany: {}, create: assigneeIds.map((uid: string) => ({ userId: uid })) },
        }),
        ...(criteria !== undefined && {
          criteria: { deleteMany: {}, create: criteria.map((c: { text: string; isDone?: boolean }, i: number) => ({ text: c.text, isDone: c.isDone ?? false, order: i })) },
        }),
      },
      select: taskSelect,
    });
    res.json({ success: true, data: task });
  } catch {
    res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

// DELETE /api/tasks/:id
router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.json({ success: true, message: 'Task removida.' });
});

// POST /api/tasks/:id/comments
router.post('/:id/comments', async (req: AuthRequest, res: Response) => {
  const { content } = req.body;
  if (!content?.trim()) { res.status(400).json({ success: false, error: 'Comentário não pode ser vazio.' }); return; }
  const comment = await prisma.comment.create({
    data: { content, taskId: req.params.id, authorId: req.user!.userId },
    include: { author: { select: { id: true, name: true, color: true, avatarUrl: true } } },
  });
  res.status(201).json({ success: true, data: comment });
});

// PATCH /api/tasks/:id/criteria/:criterionId
router.patch('/:id/criteria/:criterionId', async (req: AuthRequest, res: Response) => {
  const { isDone } = req.body;
  const criterion = await prisma.acceptanceCriteria.update({
    where: { id: req.params.criterionId },
    data: { isDone },
  });
  res.json({ success: true, data: criterion });
});

// POST /api/tasks/:id/documents — link a document to a task
router.post('/:id/documents', async (req: AuthRequest, res: Response) => {
  const { documentId } = req.body;
  if (!documentId) { res.status(400).json({ success: false, error: 'documentId obrigatório.' }); return; }
  try {
    await prisma.taskDocument.create({ data: { taskId: req.params.id, documentId } });
    res.status(201).json({ success: true });
  } catch {
    res.status(409).json({ success: false, error: 'Documento já vinculado a esta task.' });
  }
});

// DELETE /api/tasks/:id/documents/:documentId — unlink a document from a task
router.delete('/:id/documents/:documentId', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.taskDocument.delete({
      where: { taskId_documentId: { taskId: req.params.id, documentId: req.params.documentId } },
    });
    res.json({ success: true });
  } catch {
    res.status(404).json({ success: false, error: 'Vínculo não encontrado.' });
  }
});

// POST /api/tasks/reorder — update column + order for multiple tasks (kanban drag)
router.post('/reorder', async (req: AuthRequest, res: Response) => {
  const { updates } = req.body as { updates: Array<{ id: string; columnId: string; order: number }> };
  await Promise.all(updates.map(u => prisma.task.update({ where: { id: u.id }, data: { columnId: u.columnId, order: u.order } })));
  res.json({ success: true });
});


// POST /api/tasks/:id/dependencies — esta task bloqueia outra
router.post('/:id/dependencies', async (req: AuthRequest, res: Response) => {
  const { blockedId } = req.body;
  if (!blockedId) { res.status(400).json({ success: false, error: 'blockedId obrigatório.' }); return; }
  if (blockedId === req.params.id) { res.status(400).json({ success: false, error: 'Uma task não pode bloquear a si mesma.' }); return; }

  // Verifica dependência circular direta
  const circular = await prisma.taskDependency.findFirst({
    where: { blockerId: blockedId, blockedId: req.params.id },
  });
  if (circular) { res.status(409).json({ success: false, error: 'Dependência circular detectada: a task destino já bloqueia esta.' }); return; }

  try {
    const dep = await prisma.taskDependency.create({
      data: { blockerId: req.params.id, blockedId },
    });
    res.status(201).json({ success: true, data: dep });
  } catch {
    res.status(409).json({ success: false, error: 'Dependência já existe.' });
  }
});

// DELETE /api/tasks/:id/dependencies/:depId — remove dependência
router.delete('/:id/dependencies/:depId', async (req: AuthRequest, res: Response) => {
  try {
    await prisma.taskDependency.delete({ where: { id: req.params.depId } });
    res.json({ success: true });
  } catch {
    res.status(404).json({ success: false, error: 'Dependência não encontrada.' });
  }
});

export default router;
