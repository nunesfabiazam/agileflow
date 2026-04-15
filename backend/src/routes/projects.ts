import { Router, Response } from 'express';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate as any);

const ProjectSchema = z.object({
  name:        z.string().min(1).max(100),
  description: z.string().optional(),
  key:         z.string().min(2).max(6).toUpperCase(),
  color:       z.string().default('#6366f1'),
  iconEmoji:   z.string().optional(),
});

const DEFAULT_COLUMNS = [
  { name: 'A Fazer',       color: '#64748b', order: 0, isDefault: false },
  { name: 'Em Progresso',  color: '#3b82f6', order: 1, isDefault: false },
  { name: 'Em Revisão',    color: '#a855f7', order: 2, isDefault: false },
  { name: 'Concluído',     color: '#22c55e', order: 3, isDefault: true  },
];

const DEFAULT_SPACES = ['Engenharia', 'Produto', 'UX & Design', 'QA'];

// GET /api/projects
router.get('/', async (req: AuthRequest, res: Response) => {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { ownerId: req.user!.userId },
        { members: { some: { userId: req.user!.userId } } },
      ],
      isArchived: false,
    },
    include: {
      owner: { select: { id: true, name: true, color: true } },
      _count: { select: { tasks: true, members: true, sprints: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.json({ success: true, data: projects });
});

// GET /api/projects/:id
router.get('/:id', async (req: AuthRequest, res: Response) => {
  const project = await prisma.project.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true, color: true } },
      members: { include: { user: { select: { id: true, name: true, color: true, role: true, avatarUrl: true } } } },
      kanbanColumns: { orderBy: { order: 'asc' } },
      _count: { select: { tasks: true, sprints: true, epics: true, documents: true } },
    },
  });
  if (!project) { res.status(404).json({ success: false, error: 'Projeto não encontrado.' }); return; }
  res.json({ success: true, data: project });
});

// POST /api/projects
router.post('/', async (req: AuthRequest, res: Response) => {
  try {
    const body = ProjectSchema.parse(req.body);
    const exists = await prisma.project.findUnique({ where: { key: body.key } });
    if (exists) { res.status(409).json({ success: false, error: `Chave "${body.key}" já existe.` }); return; }

    const project = await prisma.project.create({
      data: {
        ...body,
        ownerId: req.user!.userId,
        // Create default kanban columns
        kanbanColumns: { create: DEFAULT_COLUMNS },
        // Add owner as member
        members: { create: { userId: req.user!.userId, role: req.user!.role } },
        // Create default doc spaces
        spaces: { create: DEFAULT_SPACES.map((name, i) => ({ name, order: i })) },
      },
      include: { kanbanColumns: true, members: true },
    });
    res.status(201).json({ success: true, data: project });
  } catch (err) {
    if (err instanceof z.ZodError) res.status(400).json({ success: false, error: err.errors });
    else res.status(500).json({ success: false, error: 'Erro interno.' });
  }
});

// PATCH /api/projects/:id
router.patch('/:id', async (req: AuthRequest, res: Response) => {
  const { name, description, color, iconEmoji, isArchived } = req.body;
  const project = await prisma.project.update({
    where: { id: req.params.id },
    data: {
      ...(name        !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(color       !== undefined && { color }),
      ...(iconEmoji   !== undefined && { iconEmoji }),
      ...(isArchived  !== undefined && { isArchived }),
    },
  });
  res.json({ success: true, data: project });
});

// POST /api/projects/:id/members
router.post('/:id/members', async (req: AuthRequest, res: Response) => {
  const { userId, role } = req.body;
  const member = await prisma.projectMember.upsert({
    where: { projectId_userId: { projectId: req.params.id, userId } },
    create: { projectId: req.params.id, userId, role },
    update: { role },
    include: { user: { select: { id: true, name: true, color: true, role: true } } },
  });
  res.status(201).json({ success: true, data: member });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response) => {
  await prisma.projectMember.delete({
    where: { projectId_userId: { projectId: req.params.id, userId: req.params.userId } },
  });
  res.json({ success: true });
});

export default router;
