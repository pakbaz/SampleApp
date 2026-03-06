import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { error } from '../utils/response';

/**
 * Authenticated user attached to the request by the auth middleware.
 */
export interface AuthUser {
  id: string;
  displayName: string;
  email: string;
  role: 'admin' | 'team-lead' | 'member';
}

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Authentication middleware.
 *
 * In production this validates a Microsoft Entra ID (Azure AD) bearer token.
 * For demo/dev purposes it accepts a simple `x-user-id` header and creates
 * a mock user, so demos work without a real identity provider.
 */
export function authenticate(req: Request, res: Response, next: NextFunction): void {
  // Allow health and status endpoints without auth
  if (req.path === '/health' || req.path === '/api/v1/status') {
    next();
    return;
  }

  // --- Demo mode: accept x-user-* headers ---
  const userId = req.headers['x-user-id'] as string | undefined;
  if (userId) {
    req.user = {
      id: userId,
      displayName: (req.headers['x-user-name'] as string) ?? 'Demo User',
      email: (req.headers['x-user-email'] as string) ?? 'demo@example.com',
      role: (req.headers['x-user-role'] as AuthUser['role']) ?? 'member',
    };
    next();
    return;
  }

  // --- Production: validate Bearer token (placeholder) ---
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json(error('Authentication required. Provide a valid bearer token or x-user-id header.', 'AUTH_REQUIRED'));
    return;
  }

  // TODO: Validate token with passport-azure-ad in production
  // For now, accept any bearer token in dev mode
  if (process.env.NODE_ENV === 'development') {
    req.user = {
      id: 'dev-user',
      displayName: 'Development User',
      email: 'dev@example.com',
      role: 'admin',
    };
    next();
    return;
  }

  logger.warn('Bearer token validation not implemented for production');
  res.status(401).json(error('Invalid or expired token.', 'AUTH_INVALID_TOKEN'));
}

/**
 * Role-based access control middleware.
 * Restricts access to users with one of the specified roles.
 */
export function authorize(...allowedRoles: AuthUser['role'][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json(error('Authentication required.', 'AUTH_REQUIRED'));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json(
        error(
          `Access denied. This action requires one of the following roles: ${allowedRoles.join(', ')}.`,
          'AUTH_FORBIDDEN',
        ),
      );
      return;
    }

    next();
  };
}
