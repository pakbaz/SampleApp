import { CosmosClient, Container, Database } from '@azure/cosmos';
import { logger } from './logger';

let client: CosmosClient;
let database: Database;
let tasksContainer: Container;
let teamsContainer: Container;

/**
 * Initialise the Azure Cosmos DB connection and ensure database/containers exist.
 */
export async function initDatabase(): Promise<void> {
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE ?? 'teamtasktracker';

  if (!endpoint || !key) {
    logger.warn('Cosmos DB credentials not configured — using in-memory store');
    return;
  }

  client = new CosmosClient({ endpoint, key });

  const { database: db } = await client.databases.createIfNotExists({ id: databaseId });
  database = db;

  const { container: tasks } = await database.containers.createIfNotExists({
    id: 'tasks',
    partitionKey: { paths: ['/teamId'] },
  });
  tasksContainer = tasks;

  const { container: teams } = await database.containers.createIfNotExists({
    id: 'teams',
    partitionKey: { paths: ['/id'] },
  });
  teamsContainer = teams;

  logger.info({ databaseId }, 'Connected to Azure Cosmos DB');
}

export function getTasksContainer(): Container {
  return tasksContainer;
}

export function getTeamsContainer(): Container {
  return teamsContainer;
}

// ---------- In-Memory Fallback Store ----------
// Used when Cosmos DB is not configured (local dev / demos)

const inMemoryTasks: Map<string, Record<string, unknown>> = new Map();
const inMemoryTeams: Map<string, Record<string, unknown>> = new Map();

export function getInMemoryTasks(): Map<string, Record<string, unknown>> {
  return inMemoryTasks;
}

export function getInMemoryTeams(): Map<string, Record<string, unknown>> {
  return inMemoryTeams;
}

/**
 * Returns true when a real Cosmos DB connection is available.
 */
export function isCosmosConfigured(): boolean {
  return Boolean(process.env.COSMOS_ENDPOINT && process.env.COSMOS_KEY);
}
