import request from 'supertest';
import { app } from '../index';
import { getInMemoryComments, getInMemoryTasks } from '../utils/database';
import { createMockTask, createMockComment, createMockCommentInput } from '../tests/factories';
import { randomUUID } from 'crypto';

beforeAll(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
});

afterEach(() => {
  getInMemoryTasks().clear();
  getInMemoryComments().clear();
});

const AUTH_HEADERS = {
  'x-user-id': 'test-user-1',
  'x-user-name': 'Test User',
  'x-user-email': 'test@example.com',
  'x-user-role': 'admin',
};

describe('POST /api/v1/tasks/:taskId/comments', () => {
  it('should create a comment and return 201', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const input = createMockCommentInput();
    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(AUTH_HEADERS)
      .send(input);

    expect(res.status).toBe(201);
    expect(res.body.data.content).toBe(input.content);
    expect(res.body.data.taskId).toBe(task.id);
    expect(res.body.data.createdBy).toBe('test-user-1');
    expect(res.body.data.authorName).toBe('Test User');
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
  });

  it('should return 404 when task does not exist', async () => {
    const res = await request(app)
      .post(`/api/v1/tasks/${randomUUID()}/comments`)
      .set(AUTH_HEADERS)
      .send(createMockCommentInput());

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('TASK_NOT_FOUND');
  });

  it('should return 400 when content is missing', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(AUTH_HEADERS)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when content is empty', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .set(AUTH_HEADERS)
      .send({ content: '' });

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should return 401 when not authenticated', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .post(`/api/v1/tasks/${task.id}/comments`)
      .send(createMockCommentInput());

    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('AUTH_REQUIRED');
  });
});

describe('GET /api/v1/tasks/:taskId/comments', () => {
  it('should return an empty list when no comments exist', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('should return comments for the task with pagination metadata', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const comment = createMockComment({ taskId: task.id });
    getInMemoryComments().set(comment.id, comment as unknown as Record<string, unknown>);

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(comment.id);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.pagination.page).toBe(1);
  });

  it('should only return comments belonging to the given task', async () => {
    const task1 = createMockTask();
    const task2 = createMockTask();
    getInMemoryTasks().set(task1.id, task1 as unknown as Record<string, unknown>);
    getInMemoryTasks().set(task2.id, task2 as unknown as Record<string, unknown>);

    const comment1 = createMockComment({ taskId: task1.id });
    const comment2 = createMockComment({ taskId: task2.id });
    getInMemoryComments().set(comment1.id, comment1 as unknown as Record<string, unknown>);
    getInMemoryComments().set(comment2.id, comment2 as unknown as Record<string, unknown>);

    const res = await request(app)
      .get(`/api/v1/tasks/${task1.id}/comments`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].taskId).toBe(task1.id);
  });

  it('should return 404 when task does not exist', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${randomUUID()}/comments`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('TASK_NOT_FOUND');
  });

  it('should return 401 when not authenticated', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}/comments`);

    expect(res.status).toBe(401);
  });
});

describe('PATCH /api/v1/tasks/:taskId/comments/:commentId', () => {
  it('should update a comment when user is the author', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const comment = createMockComment({ taskId: task.id, createdBy: 'test-user-1' });
    getInMemoryComments().set(comment.id, comment as unknown as Record<string, unknown>);

    const res = await request(app)
      .patch(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set(AUTH_HEADERS)
      .send({ content: 'Updated comment content' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Updated comment content');
    expect(res.body.data.id).toBe(comment.id);
  });

  it('should allow admin to update any comment', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const comment = createMockComment({ taskId: task.id, createdBy: 'other-user' });
    getInMemoryComments().set(comment.id, comment as unknown as Record<string, unknown>);

    const res = await request(app)
      .patch(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set(AUTH_HEADERS)
      .send({ content: 'Admin updated content' });

    expect(res.status).toBe(200);
    expect(res.body.data.content).toBe('Admin updated content');
  });

  it('should return 403 when non-admin tries to update another user\'s comment', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const comment = createMockComment({ taskId: task.id, createdBy: 'other-user' });
    getInMemoryComments().set(comment.id, comment as unknown as Record<string, unknown>);

    const res = await request(app)
      .patch(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set({ ...AUTH_HEADERS, 'x-user-id': 'test-user-1', 'x-user-role': 'member' })
      .send({ content: 'Unauthorized update' });

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('AUTH_FORBIDDEN');
  });

  it('should return 404 when comment does not exist', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .patch(`/api/v1/tasks/${task.id}/comments/${randomUUID()}`)
      .set(AUTH_HEADERS)
      .send({ content: 'Updated' });

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('COMMENT_NOT_FOUND');
  });
});

describe('DELETE /api/v1/tasks/:taskId/comments/:commentId', () => {
  it('should delete a comment when user is the author', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const comment = createMockComment({ taskId: task.id, createdBy: 'test-user-1' });
    getInMemoryComments().set(comment.id, comment as unknown as Record<string, unknown>);

    const res = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(getInMemoryComments().has(comment.id)).toBe(false);
  });

  it('should allow admin to delete any comment', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const comment = createMockComment({ taskId: task.id, createdBy: 'other-user' });
    getInMemoryComments().set(comment.id, comment as unknown as Record<string, unknown>);

    const res = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
  });

  it('should return 403 when non-admin tries to delete another user\'s comment', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const comment = createMockComment({ taskId: task.id, createdBy: 'other-user' });
    getInMemoryComments().set(comment.id, comment as unknown as Record<string, unknown>);

    const res = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`)
      .set({ ...AUTH_HEADERS, 'x-user-id': 'test-user-1', 'x-user-role': 'member' });

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('AUTH_FORBIDDEN');
  });

  it('should return 404 when comment does not exist', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${randomUUID()}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('COMMENT_NOT_FOUND');
  });

  it('should return 401 when not authenticated', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const comment = createMockComment({ taskId: task.id, createdBy: 'test-user-1' });
    getInMemoryComments().set(comment.id, comment as unknown as Record<string, unknown>);

    const res = await request(app)
      .delete(`/api/v1/tasks/${task.id}/comments/${comment.id}`);

    expect(res.status).toBe(401);
  });
});
