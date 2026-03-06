import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http';
import { logger } from './utils/logger';
import { initDatabase } from './utils/database';
import { authenticate } from './middleware/auth';
import { error } from './utils/response';
import taskRoutes from './routes/tasks';
import teamRoutes from './routes/teams';
import dashboardRoutes from './routes/dashboard';

const app = express();

// ---------- Global Middleware ----------

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));

// ---------- Public Endpoints ----------

app.get('/health', (_req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

app.get('/api/v1/status', (_req, res) => {
  res.json({
    service: 'team-task-tracker',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// ---------- Auth ----------

app.use(authenticate);

// ---------- API Routes ----------

app.use('/api/v1/tasks', taskRoutes);
app.use('/api/v1/teams', teamRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);

// ---------- 404 handler ----------

app.use((_req, res) => {
  res.status(404).json(error('The requested endpoint does not exist.', 'NOT_FOUND'));
});

// ---------- Global Error Handler ----------

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled error');
  const message =
    process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred. Please try again later.'
      : err.message;
  res.status(500).json(error(message, 'INTERNAL_ERROR'));
});

// ---------- Start ----------

const PORT = parseInt(process.env.PORT ?? '3000', 10);

async function start(): Promise<void> {
  await initDatabase();
  app.listen(PORT, () => {
    logger.info({ port: PORT }, 'Team Task Tracker API is running');
  });
}

// Only start the server when this file is executed directly (not imported in tests)
if (require.main === module) {
  start().catch((err) => {
    logger.fatal({ err }, 'Failed to start server');
    process.exit(1);
  });
}

export { app };
