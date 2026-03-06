import request from 'supertest';
import { app } from '../index';
import { getInMemoryTasks, getInMemoryTeams } from '../utils/database';
import { createMockTask, createMockTeam } from '../tests/factories';
import { randomUUID } from 'crypto';

beforeAll(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
});

afterEach(() => {
  getInMemoryTasks().clear();
  getInMemoryTeams().clear();
});

const AUTH_HEADERS = {
  'x-user-id': 'test-user-1',
  'x-user-name': 'Test User',
  'x-user-email': 'test@example.com',
  'x-user-role': 'admin',
};

describe('GET /api/v1/dashboard', () => {
  it('should return dashboard data for a team', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const task1 = createMockTask({ teamId: team.id, status: 'todo' });
    const task2 = createMockTask({ teamId: team.id, status: 'done', priority: 'high' });
    getInMemoryTasks().set(task1.id, task1 as unknown as Record<string, unknown>);
    getInMemoryTasks().set(task2.id, task2 as unknown as Record<string, unknown>);

    const res = await request(app)
      .get(`/api/v1/dashboard?teamId=${team.id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data.team.id).toBe(team.id);
    expect(res.body.data.taskSummary.total).toBe(2);
    expect(res.body.data.taskSummary.byStatus.todo).toBe(1);
    expect(res.body.data.taskSummary.byStatus.done).toBe(1);
    expect(res.body.data.recentTasks).toHaveLength(2);
  });

  it('should return 404 when team does not exist', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard?teamId=${randomUUID()}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('TEAM_NOT_FOUND');
  });

  it('should return 400 when teamId is missing', async () => {
    const res = await request(app)
      .get('/api/v1/dashboard')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should identify overdue tasks', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const overdueTask = createMockTask({
      teamId: team.id,
      status: 'in-progress',
      dueDate: '2020-01-01T00:00:00.000Z', // in the past
    });
    const futureTask = createMockTask({
      teamId: team.id,
      status: 'todo',
      dueDate: '2099-12-31T23:59:59.000Z',
    });
    getInMemoryTasks().set(overdueTask.id, overdueTask as unknown as Record<string, unknown>);
    getInMemoryTasks().set(futureTask.id, futureTask as unknown as Record<string, unknown>);

    const res = await request(app)
      .get(`/api/v1/dashboard?teamId=${team.id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data.overdueTasks).toHaveLength(1);
    expect(res.body.data.overdueTasks[0].id).toBe(overdueTask.id);
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .get(`/api/v1/dashboard?teamId=${randomUUID()}`);

    expect(res.status).toBe(401);
  });
});

describe('GET /health', () => {
  it('should return healthy status without authentication', async () => {
    const res = await request(app).get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
  });
});

describe('GET /api/v1/status', () => {
  it('should return service status without authentication', async () => {
    const res = await request(app).get('/api/v1/status');

    expect(res.status).toBe(200);
    expect(res.body.service).toBe('team-task-tracker');
    expect(res.body.version).toBe('1.0.0');
  });
});
