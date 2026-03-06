import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import {
  Team,
  CreateTeamSchema,
  UpdateTeamSchema,
  AddMemberSchema,
  TeamQuerySchema,
  TeamQuery,
} from '../models/team';
import { validateBody, validateQuery } from '../middleware/validation';
import { authorize } from '../middleware/auth';
import { success, paginated, error } from '../utils/response';
import {
  isCosmosConfigured,
  getTeamsContainer,
  getInMemoryTeams,
} from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// ---------- Helpers ----------

async function findAllTeams(query: TeamQuery): Promise<{ items: Team[]; total: number }> {
  if (isCosmosConfigured()) {
    const container = getTeamsContainer();

    const { resources: countResult } = await container.items
      .query({ query: 'SELECT VALUE COUNT(1) FROM c' })
      .fetchAll();
    const total = countResult[0] ?? 0;

    const offset = (query.page - 1) * query.limit;
    const { resources: items } = await container.items
      .query({
        query: `SELECT * FROM c ORDER BY c.name ASC OFFSET ${offset} LIMIT ${query.limit}`,
      })
      .fetchAll();

    return { items: items as Team[], total };
  }

  const all = Array.from(getInMemoryTeams().values()) as unknown as Team[];
  const total = all.length;
  const offset = (query.page - 1) * query.limit;
  const items = all.slice(offset, offset + query.limit);
  return { items, total };
}

async function findTeamById(id: string): Promise<Team | undefined> {
  if (isCosmosConfigured()) {
    const container = getTeamsContainer();
    const { resources } = await container.items
      .query({
        query: 'SELECT * FROM c WHERE c.id = @id',
        parameters: [{ name: '@id', value: id }],
      })
      .fetchAll();
    return resources[0] as Team | undefined;
  }

  return getInMemoryTeams().get(id) as unknown as Team | undefined;
}

// ---------- Routes ----------

/**
 * GET /api/v1/teams
 * List all teams with pagination.
 */
router.get('/', validateQuery(TeamQuerySchema), async (req: Request, res: Response) => {
  try {
    const query = res.locals.query as TeamQuery;
    const { items, total } = await findAllTeams(query);
    res.json(paginated(items, query.page, query.limit, total));
  } catch (err) {
    logger.error({ err }, 'Failed to list teams');
    res.status(500).json(error('Unable to retrieve teams. Please try again later.', 'TEAMS_LIST_FAILED'));
  }
});

/**
 * GET /api/v1/teams/:id
 * Get a single team by ID.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const team = await findTeamById(String(req.params.id));
    if (!team) {
      res.status(404).json(error('Team not found.', 'TEAM_NOT_FOUND'));
      return;
    }
    res.json(success(team));
  } catch (err) {
    logger.error({ err, teamId: req.params.id }, 'Failed to get team');
    res.status(500).json(error('Unable to retrieve team. Please try again later.', 'TEAM_GET_FAILED'));
  }
});

/**
 * POST /api/v1/teams
 * Create a new team. The creating user is added as team-lead.
 */
router.post('/', validateBody(CreateTeamSchema), async (req: Request, res: Response) => {
  try {
    const now = new Date().toISOString();
    const team: Team = {
      id: uuid(),
      ...req.body,
      members: [
        {
          userId: req.user?.id ?? 'unknown',
          displayName: req.user?.displayName ?? 'Unknown',
          email: req.user?.email ?? 'unknown@example.com',
          role: 'team-lead',
        },
      ],
      createdAt: now,
      updatedAt: now,
      createdBy: req.user?.id ?? 'unknown',
    };

    if (isCosmosConfigured()) {
      await getTeamsContainer().items.create(team);
    } else {
      getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);
    }

    logger.info({ teamId: team.id }, 'Team created');
    res.status(201).json(success(team));
  } catch (err) {
    logger.error({ err }, 'Failed to create team');
    res.status(500).json(error('Unable to create team. Please try again later.', 'TEAM_CREATE_FAILED'));
  }
});

/**
 * PATCH /api/v1/teams/:id
 * Update team details. Restricted to admin and team-lead.
 */
router.patch(
  '/:id',
  authorize('admin', 'team-lead'),
  validateBody(UpdateTeamSchema),
  async (req: Request, res: Response) => {
    try {
      const existing = await findTeamById(String(req.params.id));
      if (!existing) {
        res.status(404).json(error('Team not found.', 'TEAM_NOT_FOUND'));
        return;
      }

      const updated: Team = {
        ...existing,
        ...req.body,
        updatedAt: new Date().toISOString(),
      };

      if (isCosmosConfigured()) {
        await getTeamsContainer().item(updated.id, updated.id).replace(updated);
      } else {
        getInMemoryTeams().set(updated.id, updated as unknown as Record<string, unknown>);
      }

      logger.info({ teamId: updated.id }, 'Team updated');
      res.json(success(updated));
    } catch (err) {
      logger.error({ err, teamId: req.params.id }, 'Failed to update team');
      res.status(500).json(error('Unable to update team. Please try again later.', 'TEAM_UPDATE_FAILED'));
    }
  },
);

/**
 * POST /api/v1/teams/:id/members
 * Add a member to a team. Restricted to admin and team-lead.
 */
router.post(
  '/:id/members',
  authorize('admin', 'team-lead'),
  validateBody(AddMemberSchema),
  async (req: Request, res: Response) => {
    try {
      const team = await findTeamById(String(req.params.id));
      if (!team) {
        res.status(404).json(error('Team not found.', 'TEAM_NOT_FOUND'));
        return;
      }

      const duplicate = team.members.find((m) => m.userId === req.body.userId);
      if (duplicate) {
        res.status(409).json(error('User is already a member of this team.', 'MEMBER_DUPLICATE'));
        return;
      }

      team.members.push(req.body);
      team.updatedAt = new Date().toISOString();

      if (isCosmosConfigured()) {
        await getTeamsContainer().item(team.id, team.id).replace(team);
      } else {
        getInMemoryTeams().set(team.id, team as unknown as Record<string, unknown>);
      }

      logger.info({ teamId: team.id, newMember: req.body.userId }, 'Member added');
      res.status(201).json(success(team));
    } catch (err) {
      logger.error({ err, teamId: req.params.id }, 'Failed to add member');
      res.status(500).json(error('Unable to add member. Please try again later.', 'MEMBER_ADD_FAILED'));
    }
  },
);

/**
 * DELETE /api/v1/teams/:id
 * Delete a team. Restricted to admin.
 */
router.delete('/:id', authorize('admin'), async (req: Request, res: Response) => {
  try {
    const existing = await findTeamById(String(req.params.id));
    if (!existing) {
      res.status(404).json(error('Team not found.', 'TEAM_NOT_FOUND'));
      return;
    }

    if (isCosmosConfigured()) {
      await getTeamsContainer().item(existing.id, existing.id).delete();
    } else {
      getInMemoryTeams().delete(existing.id);
    }

    logger.info({ teamId: existing.id }, 'Team deleted');
    res.status(200).json(success({ deleted: true }));
  } catch (err) {
    logger.error({ err, teamId: req.params.id }, 'Failed to delete team');
    res.status(500).json(error('Unable to delete team. Please try again later.', 'TEAM_DELETE_FAILED'));
  }
});

export default router;
