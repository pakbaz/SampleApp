import { z } from 'zod';

// ---------- Core Schema ----------

export const CommentSchema = z.object({
  id: z.string().uuid(),
  taskId: z.string().uuid(),
  content: z.string().min(1).max(2000),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string(),
  authorName: z.string(),
});

export type Comment = z.infer<typeof CommentSchema>;

// ---------- Request Schemas ----------

export const CreateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type CreateCommentInput = z.infer<typeof CreateCommentSchema>;

export const UpdateCommentSchema = z.object({
  content: z.string().min(1).max(2000),
});

export type UpdateCommentInput = z.infer<typeof UpdateCommentSchema>;

// ---------- Query Schema ----------

export const CommentQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type CommentQuery = z.infer<typeof CommentQuerySchema>;
