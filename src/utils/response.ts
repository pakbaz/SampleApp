import { z, ZodError } from 'zod';

/**
 * Standard API response wrapper.
 * All endpoints return this shape for consistency.
 */
export interface ApiResponse<T> {
  data: T;
  error?: string;
  errorCode?: string;
}

/**
 * Paginated list response.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  error?: string;
}

/**
 * Build a success response.
 */
export function success<T>(data: T): ApiResponse<T> {
  return { data };
}

/**
 * Build a paginated success response.
 */
export function paginated<T>(
  data: T[],
  page: number,
  limit: number,
  total: number,
): PaginatedResponse<T> {
  return {
    data,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Build an error response.
 */
export function error(message: string, errorCode?: string): ApiResponse<null> {
  return { data: null, error: message, errorCode };
}

/**
 * Format a ZodError into a user-readable message.
 */
export function formatZodError(err: ZodError): string {
  return err.errors
    .map((e) => {
      const path = e.path.join('.');
      return path ? `${path}: ${e.message}` : e.message;
    })
    .join('; ');
}
