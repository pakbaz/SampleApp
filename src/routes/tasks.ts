import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { SqlParameter } from '@azure/cosmos';
import {
  Task,
  CreateTaskSchema,
  UpdateTaskSchema,
  TaskQuerySchema,
  TaskQuery,
} from '../models/task';
import { validateBody, validateQuery } from '../middleware/validation';
import { authorize } from '../middleware/auth';
import { success, paginated, error } from '../utils/response';
import {
  isCosmosConfigured,
  getTasksContainer,
  getInMemoryTasks,
} from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// ---------- Helpers ----------

async function findAllTasks(query: TaskQuery): Promise<{ items: Task[]; total: number }> {
  if (isCosmosConfigured()) {
    const container = getTasksContainer();
    const conditions: string[] = [];
    const parameters: SqlParameter[] = [];

    if (query.status) {
      conditions.push('c.status = @status');
      parameters.push({ name: '@status', value: query.status });
    }
    if (query.priority) {
      conditions.push('c.priority = @priority');
      parameters.push({ name: '@priority', value: query.priority });
    }
    if (query.assigneeId) {
      conditions.push('c.assigneeId = @assigneeId');
      parameters.push({ name: '@assigneeId', value: query.assigneeId });
    }
    if (query.teamId) {
      conditions.push('c.teamId = @teamId');
      parameters.push({ name: '@teamId', value: query.teamId });
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const [sortField, sortDir] = query.sort.split(':');
    const orderBy = `ORDER BY c.${sortField} ${sortDir.toUpperCase()}`;

    // Count
    const countQuery = `SELECT VALUE COUNT(1) FROM c ${where}`;
    const { resources: countResult } = await container.items
      .query({ query: countQuery, parameters })
      .fetchAll();
    const total = countResult[0] ?? 0;

    // Page
    const offset = (query.page - 1) * query.limit;
    const dataQuery = `SELECT * FROM c ${where} ${orderBy} OFFSET ${offset} LIMIT ${query.limit}`;
    const { resources: items } = await container.items
      .query({ query: dataQuery, parameters })
      .fetchAll();

    return { items: items as Task[], total };
  }

  // In-memory fallback
  let items = Array.from(getInMemoryTasks().values()) as unknown as Task[];

  if (query.status) items = items.filter((t) => t.status === query.status);
  if (query.priority) items = items.filter((t) => t.priority === query.priority);
  if (query.assigneeId) items = items.filter((t) => t.assigneeId === query.assigneeId);
  if (query.teamId) items = items.filter((t) => t.teamId === query.teamId);

  const [sortField, sortDir] = query.sort.split(':');
  items.sort((a, b) => {
    const aVal = String((a as Record<string, unknown>)[sortField] ?? '');
    const bVal = String((b as Record<string, unknown>)[sortField] ?? '');
    return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
  });

  const total = items.length;
  const offset = (query.page - 1) * query.limit;
  items = items.slice(offset, offset + query.limit);

  return { items, total };
}

async function findTaskById(id: string): Promise<Task | undefined> {
  if (isCosmosConfigured()) {
    const container = getTasksContainer();
    const { resources } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }],
      })
      .fetchAll();
    return resources[0] as Task | undefined;
  }

  return getInMemoryTasks().get(id) as unknown as Task | undefined;
}

// ---------- Routes ----------

/**
 * GET /api/v1/tasks
 * List tasks with optional filtering, sorting, and pagination.
 */
router.get('/', validateQuery(TaskQuerySchema), async (req: Request, res: Response) => {
  try {
    const query = res.locals.query as TaskQuery;
    const { items, total } = await findAllTasks(query);
    res.json(paginated(items, query.page, query.limit, total));
  } catch (err) {
    logger.error({ err }, 'Failed to list tasks');
    res.status(500).json(error('Unable to retrieve tasks. Please try again later.', 'TASKS_LIST_FAILED'));
  }
});

/**
 * GET /api/v1/tasks/:id
 * Get a single task by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const task = await findTaskById(String(req.params.id));
    if (!task) {
      res.status(404).json(error('Task not found.', 'TASK_NOT_FOUND'));
      return;
    }
    res.json(success(task));
  } catch (err) {
    logger.error({ err, taskId: req.params.id }, 'Failed to get task');
    res.status(500).json(error('Unable to retrieve task. Please try again later.', 'TASK_GET_FAILED'));
  }
});

/**
 * POST /api/v1/tasks
 * Create a new task.
 */
router.post('/', validateBody(CreateTaskSchema), async (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    const task: Task = {
      id: uuid(),
      ...req.body,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user?.id ?? 'unknown',
    };

    if (isCosmosConfigured()) {
      await getTasksContainer().items.create(task);
    } else {
      getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);
    }

    logger.info({ taskId: task.id, teamId: task.teamId }, 'Task created');
    res.status(201).json(success(task));
  } catch (err) {
    logger.error({ err }, 'Failed to create task');
    res.status(500).json(error('Unable to create task. Please try again later.', 'TASK_CREATE_FAILED'));
  }
});

/**
 * PATCH /api/v1/tasks/:id
 * Update an existing task. Only provided fields are changed.
 */
router.patch('/:id', validateBody(UpdateTaskSchema), async (req: Request, res: Response) => {
  try {
    const existing = await findTaskById(String(req.params.id));
    if (!existing) {
      res.status(404).json(error('Task not found.', 'TASK_NOT_FOUND'));
      return;
    }

    const updated: Task = {
      ...existing,
      ...req.body,
      updatedAt: new Date().toISOString(),
    };

    if (isCosmosConfigured()) {
      await getTasksContainer().item(updated.id, updated.teamId).replace(updated);
    } else {
      getInMemoryTasks().set(updated.id, updated as unknown as Record<string, unknown>);
    }

    logger.info({ taskId: updated.id }, 'Task updated');
    res.json(success(updated));
  } catch (err) {
    logger.error({ err, taskId: req.params.id }, 'Failed to update task');
    res.status(500).json(error('Unable to update task. Please try again later.', 'TASK_UPDATE_FAILED'));
  }
});

/**
 * DELETE /api/v1/tasks/:id
 * Delete a task. Restricted to admin and team-lead roles.
 */
router.delete('/:id', authorize('admin', 'team-lead'), async (req: Request, res: Response) => {
  try {
    const existing = await findTaskById(String(req.params.id));
    if (!existing) {
      res.status(404).json(error('Task not found.', 'TASK_NOT_FOUND'));
      return;
    }

    if (isCosmosConfigured()) {
      await getTasksContainer().item(existing.id, existing.teamId).delete();
    } else {
      getInMemoryTasks().delete(existing.id);
    }

    logger.info({ taskId: existing.id }, 'Task deleted');
    res.status(200).json(success({ deleted: true }));
  } catch (err) {
    logger.error({ err, taskId: req.params.id }, 'Failed to delete task');
    res.status(500).json(error('Unable to delete task. Please try again later.', 'TASK_DELETE_FAILED'));
  }
});

export default router;
