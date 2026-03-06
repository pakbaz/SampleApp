import request from 'supertest';
import { app } from '../index';
import { getInMemoryTasks } from '../utils/database';
import { createMockTask, createMockTaskInput } from '../tests/factories';
import { randomUUID } from 'crypto';

// Ensure in-memory store is used (no Cosmos env vars)
beforeAll(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
});

afterEach(() => {
  getInMemoryTasks().clear();
});

const AUTH_HEADERS = {
  'x-user-id': 'test-user-1',
  'x-user-name': 'Test User',
  'x-user-email': 'test@example.com',
  'x-user-role': 'admin',
};

describe('POST /api/v1/tasks', () => {
  it('should create a task and return 201 when given valid input', async () => {
    const teamId = randomUUID();
    const input = createMockTaskInput({ teamId });

    const res = await request(app)
      .post('/api/v1/tasks')
      .set(AUTH_HEADERS)
      .send(input);

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({
      title: input.title,
      teamId,
      status: 'todo',
      priority: 'medium',
    });
    expect(res.body.data.id).toBeDefined();
    expect(res.body.data.createdAt).toBeDefined();
  });

  it('should return 400 when title is missing', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set(AUTH_HEADERS)
      .send({ teamId: randomUUID() });

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when teamId is not a valid UUID', async () => {
    const res = await request(app)
      .post('/api/v1/tasks')
      .set(AUTH_HEADERS)
      .send({ title: 'Test', teamId: 'not-a-uuid' });

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should return 401 when not authenticated', async () => {
    const input = createMockTaskInput();

    const res = await request(app)
      .post('/api/v1/tasks')
      .send(input);

    expect(res.status).toBe(401);
    expect(res.body.errorCode).toBe('AUTH_REQUIRED');
  });
});

describe('GET /api/v1/tasks', () => {
  it('should return an empty list when no tasks exist', async () => {
    const res = await request(app)
      .get('/api/v1/tasks')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('should return tasks with pagination metadata', async () => {
    const teamId = randomUUID();
    const task = createMockTask({ teamId });
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .get('/api/v1/tasks')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
    expect(res.body.pagination.page).toBe(1);
  });

  it('should filter tasks by status', async () => {
    const teamId = randomUUID();
    const todo = createMockTask({ teamId, status: 'todo' });
    const done = createMockTask({ teamId, status: 'done' });
    getInMemoryTasks().set(todo.id, todo as unknown as Record<string, unknown>);
    getInMemoryTasks().set(done.id, done as unknown as Record<string, unknown>);

    const res = await request(app)
      .get('/api/v1/tasks?status=todo')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].status).toBe('todo');
  });
});

describe('GET /api/v1/tasks/:id', () => {
  it('should return a task by ID', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .get(`/api/v1/tasks/${task.id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(task.id);
  });

  it('should return 404 when task does not exist', async () => {
    const res = await request(app)
      .get(`/api/v1/tasks/${randomUUID()}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('TASK_NOT_FOUND');
  });
});

describe('PATCH /api/v1/tasks/:id', () => {
  it('should update task fields and return the updated task', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .patch(`/api/v1/tasks/${task.id}`)
      .set(AUTH_HEADERS)
      .send({ status: 'in-progress', priority: 'high' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in-progress');
    expect(res.body.data.priority).toBe('high');
  });

  it('should return 404 when updating a non-existent task', async () => {
    const res = await request(app)
      .patch(`/api/v1/tasks/${randomUUID()}`)
      .set(AUTH_HEADERS)
      .send({ title: 'Updated' });

    expect(res.status).toBe(404);
  });
});

describe('DELETE /api/v1/tasks/:id', () => {
  it('should delete a task and return success', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    expect(getInMemoryTasks().has(task.id)).toBe(false);
  });

  it('should return 403 when user role is member', async () => {
    const task = createMockTask();
    getInMemoryTasks().set(task.id, task as unknown as Record<string, unknown>);

    const res = await request(app)
      .delete(`/api/v1/tasks/${task.id}`)
      .set({ ...AUTH_HEADERS, 'x-user-role': 'member' });

    expect(res.status).toBe(403);
    expect(res.body.errorCode).toBe('AUTH_FORBIDDEN');
  });

  it('should return 404 when deleting a non-existent task', async () => {
    const res = await request(app)
      .delete(`/api/v1/tasks/${randomUUID()}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(404);
  });
});
