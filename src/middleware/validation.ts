import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import { error, formatZodError } from '../utils/response';

/**
 * Express middleware factory that validates `req.body` against a Zod schema.
 * On success the parsed (and coerced) value replaces `req.body`.
 * On failure a 400 response with a human-readable message is returned.
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json(error(formatZodError(err), 'VALIDATION_ERROR'));
        return;
      }
      next(err);
    }
  };
}

/**
 * Express middleware factory that validates `req.query` against a Zod schema.
 * On success the parsed value is attached to `res.locals.query`.
 */
export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      res.locals.query = schema.parse(req.query);
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        res.status(400).json(error(formatZodError(err), 'VALIDATION_ERROR'));
        return;
      }
      next(err);
    }
  };
}
