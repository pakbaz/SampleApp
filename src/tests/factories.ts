import { randomUUID } from 'crypto';
import { Task, CreateTaskInput } from '../models/task';
import { Team, CreateTeamInput, TeamMember } from '../models/team';

/**
 * Factory helpers for creating test data.
 * Use overrides to customise specific fields per test case.
 */

export function createMockTask(overrides?: Partial<Task>): Task {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    title: 'Test Task',
    description: 'A test task for unit testing',
    status: 'todo',
    priority: 'medium',
    assigneeId: 'user-1',
    teamId: randomUUID(),
    tags: ['test'],
    createdAt: now,
    updatedAt: now,
    createdBy: 'user-1',
    ...overrides,
  };
}

export function createMockTaskInput(overrides?: Partial<CreateTaskInput>): CreateTaskInput {
  return {
    title: 'New Test Task',
    description: 'Created by test factory',
    status: 'todo',
    teamId: randomUUID(),
    priority: 'medium',
    tags: [],
    ...overrides,
  };
}

export function createMockMember(overrides?: Partial<TeamMember>): TeamMember {
  return {
    userId: randomUUID(),
    displayName: 'Test User',
    email: 'test@example.com',
    role: 'member',
    ...overrides,
  };
}

export function createMockTeam(overrides?: Partial<Team>): Team {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: 'Test Team',
    description: 'A test team',
    members: [createMockMember({ role: 'team-lead' })],
    createdAt: now,
    updatedAt: now,
    createdBy: 'user-1',
    ...overrides,
  };
}

export function createMockTeamInput(overrides?: Partial<CreateTeamInput>): CreateTeamInput {
  return {
    name: 'New Test Team',
    description: 'Created by test factory',
    ...overrides,
  };
}
