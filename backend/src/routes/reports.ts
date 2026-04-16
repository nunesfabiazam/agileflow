import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticate } from '../middleware/auth';
import { AuthRequest } from '../types';

const router = Router();
const prisma = new PrismaClient();
router.use(authenticate as any);

// GET /api/reports/sprint/:sprintId — Burndown + velocity + team productivity
router.get('/sprint/:sprintId', async (req: AuthRequest, res: Response) => {
  const sprint = await prisma.sprint.findUnique({
    where: { id: req.params.sprintId },
    include: {
      tasks: {
        include: {
          assignees: { include: { user: { select: { id: true, name: true, color: true } } } },
          column: { select: { isDefault: true, name: true } },
        },
      },
    },
  });
  if (!sprint) { res.status(404).json({ success: false, error: 'Sprint não encontrada.' }); return; }

  const total   = sprint.tasks.reduce((a, t) => a + (t.storyPoints ?? 0), 0);
  const done    = sprint.tasks.filter(t => t.column?.isDefault).reduce((a, t) => a + (t.storyPoints ?? 0), 0);
  const byType  = groupBy(sprint.tasks, (t: any) => t.type as string);
  const byPrio  = groupBy(sprint.tasks, (t: any) => t.priority as string);

  // Team productivity
  const teamMap: Record<string, { name: string; color: string; tasks: number; points: number; completed: number }> = {};
  for (const task of sprint.tasks) {
    for (const a of task.assignees) {
      const uid = a.user.id;
      if (!teamMap[uid]) teamMap[uid] = { name: a.user.name, color: a.user.color, tasks: 0, points: 0, completed: 0 };
      teamMap[uid].tasks++;
      teamMap[uid].points += task.storyPoints ?? 0;
      if (task.column?.isDefault) teamMap[uid].completed++;
    }
  }

  res.json({
    success: true,
    data: {
      sprint: { id: sprint.id, name: sprint.name, status: sprint.status, startDate: sprint.startDate, endDate: sprint.endDate },
      summary: { totalTasks: sprint.tasks.length, completedTasks: sprint.tasks.filter(t => t.column?.isDefault).length, totalPoints: total, completedPoints: done, completionRate: total ? Math.round((done / total) * 100) : 0 },
      byType, byPrio,
      team: Object.entries(teamMap).map(([id, v]) => ({ id, ...v, rate: v.tasks ? Math.round((v.completed / v.tasks) * 100) : 0 })),
    },
  });
});

// GET /api/reports/project/:projectId — Velocity history + epics progress + open bugs
router.get('/project/:projectId', async (req: AuthRequest, res: Response) => {
  const [sprints, epics, openBugs, totalTasks] = await Promise.all([
    prisma.sprint.findMany({
      where: { projectId: req.params.projectId },
      orderBy: { createdAt: 'asc' },
      include: { tasks: { select: { storyPoints: true, column: { select: { isDefault: true } } } } },
    }),
    prisma.epic.findMany({
      where: { projectId: req.params.projectId },
      include: { tasks: { select: { column: { select: { isDefault: true } } } } },
    }),
    prisma.task.count({ where: { projectId: req.params.projectId, type: 'BUG', isClosed: false } }),
    prisma.task.count({ where: { projectId: req.params.projectId } }),
  ]);

  const velocity = sprints.map(s => ({
    name: s.name,
    status: s.status,
    planned: s.tasks.reduce((a, t) => a + (t.storyPoints ?? 0), 0),
    delivered: s.tasks.filter(t => t.column?.isDefault).reduce((a, t) => a + (t.storyPoints ?? 0), 0),
  }));

  const epicProgress = epics.map(e => ({
    id: e.id, title: e.title, color: e.color,
    total: e.tasks.length,
    done:  e.tasks.filter(t => t.column?.isDefault).length,
    pct:   e.tasks.length ? Math.round((e.tasks.filter(t => t.column?.isDefault).length / e.tasks.length) * 100) : 0,
  }));

  res.json({ success: true, data: { velocity, epicProgress, openBugs, totalTasks } });
});

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

export default router;
