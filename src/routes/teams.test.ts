import request from 'supertest';
import { app } from '../index';
import { getInMemoryTeams } from '../utils/database';
import { createMockTeam, createMockTeamInput, createMockMember } from '../tests/factories';
import { randomUUID } from 'crypto';

beforeAll(() => {
  delete process.env.COSMOS_ENDPOINT;
  delete process.env.COSMOS_KEY;
});

afterEach(() => {
  getInMemoryTeams().clear();
});

const AUTH_HEADERS = {
  'x-user-id': 'test-user-1',
  'x-user-name': 'Test User',
  'x-user-email': 'test@example.com',
  'x-user-role': 'admin',
};

describe('POST /api/v1/teams', () => {
  it('should create a team and return 201 with the creator as team-lead', async () => {
    const input = createMockTeamInput();

    const res = await request(app)
      .post('/api/v1/teams')
      .set(AUTH_HEADERS)
      .send(input);

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe(input.name);
    expect(res.body.data.members).toHaveLength(1);
    expect(res.body.data.members[0].role).toBe('team-lead');
    expect(res.body.data.members[0].userId).toBe('test-user-1');
  });

  it('should return 400 when name is missing', async () => {
    const res = await request(app)
      .post('/api/v1/teams')
      .set(AUTH_HEADERS)
      .send({ description: 'No name' });

    expect(res.status).toBe(400);
    expect(res.body.errorCode).toBe('VALIDATION_ERROR');
  });

  it('should return 401 when not authenticated', async () => {
    const res = await request(app)
      .post('/api/v1/teams')
      .send(createMockTeamInput());

    expect(res.status).toBe(401);
  });
});

describe('GET /api/v1/teams', () => {
  it('should return an empty list when no teams exist', async () => {
    const res = await request(app)
      .get('/api/v1/teams')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
    expect(res.body.pagination.total).toBe(0);
  });

  it('should return teams with pagination', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const res = await request(app)
      .get('/api/v1/teams')
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.pagination.total).toBe(1);
  });
});

describe('GET /api/v1/teams/:id', () => {
  it('should return a team by ID', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const res = await request(app)
      .get(`/api/v1/teams/${team.id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(team.id);
  });

  it('should return 404 when team does not exist', async () => {
    const res = await request(app)
      .get(`/api/v1/teams/${randomUUID()}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(404);
    expect(res.body.errorCode).toBe('TEAM_NOT_FOUND');
  });
});

describe('PATCH /api/v1/teams/:id', () => {
  it('should update team name', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const res = await request(app)
      .patch(`/api/v1/teams/${team.id}`)
      .set(AUTH_HEADERS)
      .send({ name: 'Updated Name' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('Updated Name');
  });

  it('should return 403 when user role is member', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const res = await request(app)
      .patch(`/api/v1/teams/${team.id}`)
      .set({ ...AUTH_HEADERS, 'x-user-role': 'member' })
      .send({ name: 'Updated' });

    expect(res.status).toBe(403);
  });
});

describe('POST /api/v1/teams/:id/members', () => {
  it('should add a new member to the team', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const newMember = createMockMember({ userId: 'new-user' });

    const res = await request(app)
      .post(`/api/v1/teams/${team.id}/members`)
      .set(AUTH_HEADERS)
      .send(newMember);

    expect(res.status).toBe(201);
    expect(res.body.data.members).toHaveLength(2);
  });

  it('should return 409 when member already exists', async () => {
    const member = createMockMember({ userId: 'existing-user' });
    const team = createMockTeam({ members: [member] });
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const res = await request(app)
      .post(`/api/v1/teams/${team.id}/members`)
      .set(AUTH_HEADERS)
      .send(member);

    expect(res.status).toBe(409);
    expect(res.body.errorCode).toBe('MEMBER_DUPLICATE');
  });

  it('should return 403 when user role is member', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const res = await request(app)
      .post(`/api/v1/teams/${team.id}/members`)
      .set({ ...AUTH_HEADERS, 'x-user-role': 'member' })
      .send(createMockMember());

    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/v1/teams/:id', () => {
  it('should delete a team when user is admin', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const res = await request(app)
      .delete(`/api/v1/teams/${team.id}`)
      .set(AUTH_HEADERS);

    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
  });

  it('should return 403 when user is team-lead (not admin)', async () => {
    const team = createMockTeam();
    getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);

    const res = await request(app)
      .delete(`/api/v1/teams/${team.id}`)
      .set({ ...AUTH_HEADERS, 'x-user-role': 'team-lead' });

    expect(res.status).toBe(403);
  });
});
