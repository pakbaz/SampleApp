import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { SqlParameter } from '@azure/cosmos';
import {
  Comment,
  CreateCommentSchema,
  UpdateCommentSchema,
  CommentQuerySchema,
  CommentQuery,
} from '../models/comment';
import { validateBody, validateQuery } from '../middleware/validation';
import { success, paginated, error } from '../utils/response';
import {
  isCosmosConfigured,
  getCommentsContainer,
  getTasksContainer,
  getInMemoryComments,
  getInMemoryTasks,
} from '../utils/database';
import { logger } from '../utils/logger';

// Router is merged with tasks router at /:taskId/comments
const router = Router({ mergeParams: true });

// ---------- Helpers ----------

async function taskExists(taskId: string): Promise<boolean> {
  if (isCosmosConfigured()) {
    const { resources } = await getTasksContainer().items
      .query({
        query: 'SELECT VALUE COUNT(1) FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: taskId }],
      })
      .fetchAll();
    return (resources[0] ?? 0) > 0;
  }
  return getInMemoryTasks().has(taskId);
}

async function findCommentsByTask(
  taskId: string,
  query: CommentQuery,
): Promise<{ items: Comment[]; total: number }> {
  if (isCosmosConfigured()) {
    const container = getCommentsContainer();
    const parameters: SqlParameter[] = [{ name: '@taskId', value: taskId }];

    const countQuery = 'SELECT VALUE COUNT(1) FROM c WHERE c.taskId = @taskId';
    const { resources: countResult } = await container.items
      .query({ query: countQuery, parameters })
      .fetchAll();
    const total = countResult[0] ?? 0;

    const offset = (query.page - 1) * query.limit;
    const dataQuery = `SELECT * FROM c WHERE c.taskId = @taskId ORDER BY c.createdAt DESC OFFSET ${offset} LIMIT ${query.limit}`;
    const { resources: items } = await container.items
      .query({ query: dataQuery, parameters })
      .fetchAll();

    return { items: items as Comment[], total };
  }

  // In-memory fallback
  let items = Array.from(getInMemoryComments().values()).filter(
    (c) => (c as unknown as Comment).taskId === taskId,
  ) as unknown as Comment[];

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const total = items.length;
  const offset = (query.page - 1) * query.limit;
  items = items.slice(offset, offset + query.limit);

  return { items, total };
}

async function findCommentById(id: string, taskId: string): Promise<Comment | undefined> {
  if (isCosmosConfigured()) {
    const { resources } = await getCommentsContainer().items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id AND c.taskId = @taskId',
        parameters: [
          { name: '@id', value: id },
          { name: '@taskId', value: taskId },
        ],
      })
      .fetchAll();
    return resources[0] as Comment | undefined;
  }

  const comment = getInMemoryComments().get(id) as unknown as Comment | undefined;
  if (comment && comment.taskId !== taskId) return undefined;
  return comment;
}

// ---------- Routes ----------

/**
 * GET /api/v1/tasks/:taskId/comments
 * List all comments for a task with pagination.
 */
router.get('/', validateQuery(CommentQuerySchema), async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params as { taskId: string };

    if (!(await taskExists(taskId))) {
      res.status(404).json(error('Task not found.', 'TASK_NOT_FOUND'));
      return;
    }

    const query = res.locals.query as CommentQuery;
    const { items, total } = await findCommentsByTask(taskId, query);
    res.json(paginated(items, query.page, query.limit, total));
  } catch (err) {
    logger.error({ err, taskId: req.params.taskId }, 'Failed to list comments');
    res.status(500).json(error('Unable to retrieve comments. Please try again later.', 'COMMENTS_LIST_FAILED'));
  }
});

/**
 * POST /api/v1/tasks/:taskId/comments
 * Add a comment to a task.
 */
router.post('/', validateBody(CreateCommentSchema), async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params as { taskId: string };

    if (!(await taskExists(taskId))) {
      res.status(404).json(error('Task not found.', 'TASK_NOT_FOUND'));
      return;
    }

    const now = new Date().toISOString();
    const comment: Comment = {
      id: uuid(),
      taskId,
      content: req.body.content,
      createdAt: now,
      updatedAt: now,
      createdBy: req.user?.id ?? 'unknown',
      authorName: req.user?.displayName ?? 'Unknown',
    };

    if (isCosmosConfigured()) {
      await getCommentsContainer().items.create(comment);
    } else {
      getInMemoryComments().set(comment.id, comment as unknown as Record<string, unknown>);
    }

    logger.info({ commentId: comment.id, taskId }, 'Comment created');
    res.status(201).json(success(comment));
  } catch (err) {
    logger.error({ err, taskId: req.params.taskId }, 'Failed to create comment');
    res.status(500).json(error('Unable to create comment. Please try again later.', 'COMMENT_CREATE_FAILED'));
  }
});

/**
 * PATCH /api/v1/tasks/:taskId/comments/:commentId
 * Update a comment. Only the comment author can update their comment.
 */
router.patch('/:commentId', validateBody(UpdateCommentSchema), async (req: Request, res: Response) => {
  try {
    const { taskId, commentId } = req.params as { taskId: string; commentId: string };

    const existing = await findCommentById(commentId, taskId);
    if (!existing) {
      res.status(404).json(error('Comment not found.', 'COMMENT_NOT_FOUND'));
      return;
    }

    // Only the author or an admin can update a comment
    if (existing.createdBy !== req.user?.id && req.user?.role !== 'admin') {
      res.status(403).json(error('You can only edit your own comments.', 'AUTH_FORBIDDEN'));
      return;
    }

    const updated: Comment = {
      ...existing,
      content: req.body.content,
      updatedAt: new Date().toISOString(),
    };

    if (isCosmosConfigured()) {
      await getCommentsContainer().item(updated.id, updated.taskId).replace(updated);
    } else {
      getInMemoryComments().set(updated.id, updated as unknown as Record<string, unknown>);
    }

    logger.info({ commentId: updated.id, taskId }, 'Comment updated');
    res.json(success(updated));
  } catch (err) {
    logger.error({ err, taskId: req.params.taskId, commentId: req.params.commentId }, 'Failed to update comment');
    res.status(500).json(error('Unable to update comment. Please try again later.', 'COMMENT_UPDATE_FAILED'));
  }
});

/**
 * DELETE /api/v1/tasks/:taskId/comments/:commentId
 * Delete a comment. Authors can delete their own; admins can delete any.
 */
router.delete('/:commentId', async (req: Request, res: Response) => {
  try {
    const { taskId, commentId } = req.params as { taskId: string; commentId: string };

    const existing = await findCommentById(commentId, taskId);
    if (!existing) {
      res.status(404).json(error('Comment not found.', 'COMMENT_NOT_FOUND'));
      return;
    }

    // Only the author or an admin can delete a comment
    if (existing.createdBy !== req.user?.id && req.user?.role !== 'admin') {
      res.status(403).json(error('You can only delete your own comments.', 'AUTH_FORBIDDEN'));
      return;
    }

    if (isCosmosConfigured()) {
      await getCommentsContainer().item(existing.id, existing.taskId).delete();
    } else {
      getInMemoryComments().delete(existing.id);
    }

    logger.info({ commentId: existing.id, taskId }, 'Comment deleted');
    res.status(200).json(success({ deleted: true }));
  } catch (err) {
    logger.error({ err, taskId: req.params.taskId, commentId: req.params.commentId }, 'Failed to delete comment');
    res.status(500).json(error('Unable to delete comment. Please try again later.', 'COMMENT_DELETE_FAILED'));
  }
});

export default router;

