import { z } from 'zod';

// ---------- Enums ----------

export const UserRole = z.enum(['admin', 'team-lead', 'member']);
export type UserRole = z.infer<typeof UserRole>;

// ---------- Core Schema ----------

export const TeamSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  members: z.array(z.object({
    userId: z.string(),
    displayName: z.string(),
    email: z.string().email(),
    role: UserRole,
  })),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  createdBy: z.string(),
});

export type Team = z.infer<typeof TeamSchema>;

export const TeamMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  email: z.string().email(),
  role: UserRole,
});

export type TeamMember = z.infer<typeof TeamMemberSchema>;

// ---------- Request Schemas ----------

export const CreateTeamSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
});

export type CreateTeamInput = z.infer<typeof CreateTeamSchema>;

export const UpdateTeamSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

export type UpdateTeamInput = z.infer<typeof UpdateTeamSchema>;

export const AddMemberSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  email: z.string().email(),
  role: UserRole.default('member'),
});

export type AddMemberInput = z.infer<typeof AddMemberSchema>;

// ---------- Query Schema ----------

export const TeamQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type TeamQuery = z.infer<typeof TeamQuerySchema>;
