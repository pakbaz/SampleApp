import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { Task } from '../models/task';
import { Team } from '../models/team';
import { validateQuery } from '../middleware/validation';
import { success, error } from '../utils/response';
import {
  isCosmosConfigured,
  getTasksContainer,
  getTeamsContainer,
  getInMemoryTasks,
  getInMemoryTeams,
} from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// ---------- Query Schema ----------

const DashboardQuerySchema = z.object({
  teamId: z.string().uuid(),
});

// ---------- Types ----------

interface DashboardData {
  team: {
    id: string;
    name: string;
    memberCount: number;
  };
  taskSummary: {
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
  };
  recentTasks: Task[];
  overdueTasks: Task[];
}

// ---------- Helpers ----------

async function getTeamDashboardData(teamId: string): Promise<DashboardData | null> {
  let team: Team | undefined;
  let tasks: Task[];

  if (isCosmosConfigured()) {
    const teamsContainer = getTeamsContainer();
    const tasksContainer = getTasksContainer();

    const { resources: teamResults } = await teamsContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: teamId }],
      })
      .fetchAll();
    team = teamResults[0] as Team | undefined;

    const { resources: taskResults } = await tasksContainer.items
      .query({
        query: 'SELECT * FROM c WHERE c.teamId = @teamId',
        parameters: [{ name: '@teamId', value: teamId }],
      })
      .fetchAll();
    tasks = taskResults as Task[];
  } else {
    team = Array.from(getInMemoryTeams().values()).find(
      (t) => (t as unknown as Team).id === teamId,
    ) as unknown as Team | undefined;

    tasks = Array.from(getInMemoryTasks().values()).filter(
      (t) => (t as unknown as Task).teamId === teamId,
    ) as unknown as Task[];
  }

  if (!team) return null;

  // Aggregate by status
  const byStatus: Record<string, number> = {};
  const byPriority: Record<string, number> = {};
  for (const task of tasks) {
    byStatus[task.status] = (byStatus[task.status] ?? 0) + 1;
    byPriority[task.priority] = (byPriority[task.priority] ?? 0) + 1;
  }

  // Recent tasks (last 5, sorted by createdAt desc)
  const recentTasks = [...tasks]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  // Overdue tasks (due date in the past and not done)
  const now = new Date().toISOString();
  const overdueTasks = tasks.filter(
    (t) => t.dueDate && t.dueDate < now && t.status !== 'done',
  );

  return {
    team: {
      id: team.id,
      name: team.name,
      memberCount: team.members.length,
    },
    taskSummary: {
      total: tasks.length,
      byStatus,
      byPriority,
    },
    recentTasks,
    overdueTasks,
  };
}

// ---------- Routes ----------

/**
 * GET /api/v1/dashboard?teamId=<uuid>
 * Returns an aggregated dashboard view for a specific team.
 */
router.get('/', validateQuery(DashboardQuerySchema), async (req: Request, res: Response) => {
  try {
    const { teamId } = res.locals.query as z.infer<typeof DashboardQuerySchema>;
    const data = await getTeamDashboardData(teamId);

    if (!data) {
      res.status(404).json(error('Team not found.', 'TEAM_NOT_FOUND'));
      return;
    }

    res.json(success(data));
  } catch (err) {
    logger.error({ err }, 'Failed to build dashboard');
    res.status(500).json(error('Unable to build dashboard. Please try again later.', 'DASHBOARD_FAILED'));
  }
});

export default router;
