import { prisma } from '../lib/prisma';
import { Router, Request, Response } from 'express';

const router = Router();

// ── GET /api/sprints/:sprintId/burndown ───────────────────────────────────────
router.get('/:sprintId/burndown', async (req: Request, res: Response) => {
  const { sprintId } = req.params;

  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: {
      tasks: {
        select: {
          id: true, storyPoints: true, columnId: true, updatedAt: true,
          column: { select: { name: true } },
        },
      },
    },
  });

  if (!sprint) return res.status(404).json({ error: 'Sprint não encontrado.' });

  const startDate = sprint.startDate ? new Date(sprint.startDate) : new Date();
  const endDate   = sprint.endDate   ? new Date(sprint.endDate)   : new Date(Date.now() + 14 * 86400000);
  const tasks     = sprint.tasks;

  // Total story points
  const totalPoints = tasks.reduce((s: number, t: any) => s + (t.storyPoints ?? 0), 0);

  // Build day-by-day ideal burndown
  const days: string[] = [];
  const cur = new Date(startDate);
  cur.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0]);
    cur.setDate(cur.getDate() + 1);
  }

  const totalDays = Math.max(days.length - 1, 1);
  const ideal = days.map((_, i) => Math.round(totalPoints * (1 - i / totalDays)));

  // Build actual burndown — for each day, how many points were still open
  // A task is "done" if its column name contains Done/Concluído/Feito/Pronto
  const doneKeywords = ['done', 'conclu', 'feito', 'pronto', 'finish', 'deploy'];
  const isDone = (t: any) =>
    doneKeywords.some(k => (t.column?.name ?? '').toLowerCase().includes(k));

  const actual = days.map(day => {
    const dayEnd = new Date(day + 'T23:59:59Z');
    // Points remaining = points of tasks that were NOT done by this day
    const remaining = tasks.reduce((sum: number, t: any) => {
      const taskDone = isDone(t) && t.updatedAt && new Date(t.updatedAt) <= dayEnd;
      return sum + (taskDone ? 0 : (t.storyPoints ?? 0));
    }, 0);
    return remaining;
  });

  // Scope creep: mark days where total exceeded previous
  const scope = days.map((_: string, i: number) => {
    if (i === 0) return totalPoints;
    const prevTotal = tasks.filter((t: any) => {
      const created = new Date(days[i - 1] + 'T23:59:59Z');
      return true; // All tasks included at start for simplicity
    }).reduce((s: number, t: any) => s + (t.storyPoints ?? 0), 0);
    return prevTotal;
  });

  return res.json({
    success: true,
    data: {
      sprint: { id: sprint.id, name: sprint.name, startDate, endDate },
      totalPoints,
      days,
      ideal,
      actual,
      completedPoints: totalPoints - (actual[actual.length - 1] ?? totalPoints),
    },
  });
});

// ── GET /api/sprints/velocity/:projectId ──────────────────────────────────────
router.get('/velocity/:projectId', async (req: Request, res: Response) => {
  const { projectId } = req.params;

  const sprints = await prisma.sprint.findMany({
    where: { projectId, status: { in: ['COMPLETED', 'ACTIVE'] } },
    include: {
      tasks: {
        select: { storyPoints: true, column: { select: { name: true } } },
      },
    },
    orderBy: { startDate: 'asc' },
    take: 10,
  });

  const doneKeywords = ['done', 'conclu', 'feito', 'pronto', 'finish', 'deploy'];
  const isDone = (t: any) =>
    doneKeywords.some(k => (t.column?.name ?? '').toLowerCase().includes(k));

  const velocity = sprints.map((s: any) => ({
    id:         s.id,
    name:       s.name,
    committed:  s.tasks.reduce((sum: number, t: any) => sum + (t.storyPoints ?? 0), 0),
    completed:  s.tasks.filter(isDone).reduce((sum: number, t: any) => sum + (t.storyPoints ?? 0), 0),
    startDate:  s.startDate,
    endDate:    s.endDate,
  }));

  const avg = velocity.length > 0
    ? Math.round(velocity.reduce((s: number, v: any) => s + v.completed, 0) / velocity.length)
    : 0;

  return res.json({ success: true, data: { velocity, avgVelocity: avg } });
});

export default router;
