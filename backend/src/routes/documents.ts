import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate as any);

const DocSchema = z.object({
  title:     z.string().min(1).max(300),
  content:   z.string().optional(),
  type:      z.enum(['SPEC','DIAGRAM','DESIGN','REFERENCE','TEMPLATE','TEST_PLAN','WIREFRAME','RUNBOOK','OTHER']).default('OTHER'),
  projectId: z.string().uuid(),
  spaceId:   z.string().uuid().optional(),
  taskIds:   z.array(z.string().uuid()).optional(),
});

const SpaceSchema = z.object({
  name:      z.string().min(1).max(100),
  icon:      z.string().optional(),
  projectId: z.string().uuid(),
});

// ── Spaces ────────────────────────────────────────────────────────────────────
router.get('/spaces', async (req: AuthRequest, res: Response) => {
  const { projectId } = req.query as { projectId: string };
  const spaces = await prisma.docSpace.findMany({
    where: { projectId },
    orderBy: { order: 'asc' },
    include: { _count: { select: { documents: true } } },
  });
  res.json({ success: true, data: spaces });
});

router.post('/spaces', async (req: AuthRequest, res: Response) => {
  try {
    const body = SpaceSchema.parse(req.body);
    const last = await prisma.docSpace.findFirst({ where: { projectId: body.projectId }, orderBy: { order: 'desc' } });
    const space = await prisma.docSpace.create({ data: { ...body, order: (last?.order ?? -1) + 1 } });
    res.status(201).json({ success: true, data: space });
  } catch (err) {
    if (err instanceof z.ZodError) res.status(400).json({ success: false, error: err.errors });
    else res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

// ── Documents ─────────────────────────────────────────────────────────────────
router.get('/', async (req: AuthRequest, res: Response) => {
  const { projectId, spaceId, search } = req.query as Record<string, string>;
  const docs = await prisma.document.findMany({
    where: {
      ...(projectId && { projectId }),
      ...(spaceId   && { spaceId }),
      ...(search    && { title: { contains: search, mode: 'insensitive' } }),
    },
    orderBy: { updatedAt: 'desc' },
    include: {
      author: { select: { id: true, name: true, color: true } },
      space:  { select: { id: true, name: true } },
      linkedTasks: { include: { task: { select: { id: true, taskKey: true, title: true } } } },
    },
  });
  res.json({ success: true, data: docs });
});

router.get('/:id', async (req: AuthRequest, res: Response) => {
  const doc = await prisma.document.findUnique({
    where: { id: req.params.id },
    include: {
      author: { select: { id: true, name: true, color: true } },
      space:  true,
      linkedTasks: { include: { task: { select: { id: true, taskKey: true, title: true, type: true } } } },
    },
  });
  if (!doc) { res.status(404).json({ success: false, error: 'Documento não encontrado.' }); return; }
  res.json({ success: true, data: doc });
});

router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = DocSchema.parse(req.body);
    const doc = await prisma.document.create({
      data: {
        title: body.title, content: body.content, type: body.type,
        projectId: body.projectId, spaceId: body.spaceId,
        authorId: req.user!.userId,
        ...(body.taskIds && {
          linkedTasks: { create: body.taskIds.map(tid => ({ taskId: tid })) },
        }),
      },
      include: { author: { select: { id: true, name: true, color: true } }, space: true },
    });
    res.status(201).json({ success: true, data: doc });
  } catch (err) {
    if (err instanceof z.ZodError) res.status(400).json({ success: false, error: err.errors });
    else res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { title, content, type, spaceId, status, coverIdx, docEmoji, taskIds } = req.body;
  const doc = await prisma.document.update({
    where: { id: req.params.id },
    data: {
      ...(title    !== undefined && { title }),
      ...(content  !== undefined && { content }),
      ...(type     !== undefined && { type }),
      ...(spaceId  !== undefined && { spaceId }),
      ...(status   !== undefined && { status }),
      // coverIdx can be null (remove cover) or a number
      ...(coverIdx !== undefined && { coverIdx: coverIdx === null ? null : Number(coverIdx) }),
      ...(docEmoji !== undefined && { docEmoji }),
      // Increment version only when content/title changes, not on status/cover/emoji-only updates
      ...((title !== undefined || content !== undefined) && { version: { increment: 1 } }),
      ...(taskIds !== undefined && {
        linkedTasks: { deleteMany: {}, create: taskIds.map((tid: string) => ({ taskId: tid })) },
      }),
    },
    include: { author: { select: { id: true, name: true, color: true } }, space: true },
  });
  res.json({ success: true, data: doc });
});

router.delete('/:id', async (req: AuthRequest, res: Response) => {
  await prisma.document.delete({ where: { id: req.params.id } });
  res.json({ success: true });
});

// POST /api/documents/:id/clone — duplicate document (new draft copy)
router.post('/:id/clone', async (req: AuthRequest, res: Response) => {
  try {
    const source = await prisma.document.findUnique({ where: { id: req.params.id } });
    if (!source) { res.status(404).json({ success: false, error: 'Documento não encontrado.' }); return; }

    const cloned = await prisma.document.create({
      data: {
        title:     `Cópia de ${source.title}`,
        content:   source.content ?? undefined,
        type:      source.type,
        status:    'DRAFT',
        projectId: req.body.projectId ?? source.projectId,
        spaceId:   source.spaceId ?? undefined,
        authorId:  req.user!.userId,
      },
      include: { author: { select: { id: true, name: true, color: true } }, space: true },
    });
    res.status(201).json({ success: true, data: cloned });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message ?? 'Erro interno.' });
  }
});

export default router;
