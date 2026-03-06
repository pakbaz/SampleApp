import { z } from 'zod';

// ---------- Enums ----------

export const TaskStatus = z.enum(['todo', 'in-progress', 'in-review', 'done', 'blocked']);
export type TaskStatus = z.infer<typeof TaskStatus>;

export const TaskPriority = z.enum(['critical', 'high', 'medium', 'low']);
export type TaskPriority = z.infer<typeof TaskPriority>;

// ---------- Core Schema ----------

export const TaskSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus.default('todo'),
  priority: TaskPriority.default('medium'),
  assigneeId: z.string().optional(),
  teamId: z.string().uuid(),
  tags: z.array(z.string().max(50)).max(10).default([]),
  dueDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string(),
});

export type Task = z.infer<typeof TaskSchema>;

// ---------- Request Schemas ----------

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: TaskStatus.optional().default('todo'),
  priority: TaskPriority.optional().default('medium'),
  assigneeId: z.string().optional(),
  teamId: z.string().uuid(),
  tags: z.array(z.string().max(50)).max(10).optional().default([]),
  dueDate: z.string().datetime().optional(),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional(),
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  assigneeId: z.string().nullable().optional(),
  tags: z.array(z.string().max(50)).max(10).optional(),
  dueDate: z.string().datetime().nullable().optional(),
});

export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

// ---------- Query Schema ----------

export const TaskQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: TaskStatus.optional(),
  priority: TaskPriority.optional(),
  assigneeId: z.string().optional(),
  teamId: z.string().uuid().optional(),
  sort: z.enum(['createdAt:asc', 'createdAt:desc', 'dueDate:asc', 'dueDate:desc', 'priority:asc', 'priority:desc']).default('createdAt:desc'),
});

export type TaskQuery = z.infer<typeof TaskQuerySchema>;
