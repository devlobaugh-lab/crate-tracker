import { z } from 'zod';

// Per-series state schema
export const SeriesStateSchema = z.object({
  allCrates: z.array(z.string()).default([]),
});

// Core application state schema
export const AppStateSchema = z.object({
  series: z
    .array(SeriesStateSchema)
    .min(12)
    .max(12)
    .default(() => Array.from({ length: 12 }, () => ({ allCrates: [] }))),
  config: z
    .object({
      wins: z.number().int().min(0).default(0),
      gpWins: z.number().int().min(0).default(0),
    })
    .default({ wins: 0, gpWins: 0 }),
});

// User data import/export schema (accepts both v1 legacy and v2 multi-series)
export const UserDataExportSchema = z.object({
  version: z.number().optional(),
  series: z.array(SeriesStateSchema).optional(),
  allCrates: z.array(z.string()).optional(), // legacy
  config: z
    .object({
      wins: z.number().int().min(0).default(0),
      gpWins: z.number().int().min(0).default(0),
    })
    .default({ wins: 0, gpWins: 0 }),
  exportedAt: z.string().datetime().optional(),
});

// Authorized user schema
export const AuthorizedUserSchema = z.object({
  id: z.string().optional(),
  email: z.string().email().toLowerCase(),
  role: z.enum(['admin', 'normal']).default('normal'),
  status: z.enum(['active', 'inactive']).default('active'),
  invitedBy: z.string().email().optional(),
  invitedAt: z.date().optional(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

// User invitation schema
export const UserInvitationSchema = z.object({
  email: z.string().email().toLowerCase(),
  role: z.enum(['admin', 'normal']).default('normal'),
  invitedBy: z.string().email(),
});

// Input validation schemas
export const FastForwardInputSchema = z
  .object({
    additionalGP: z.number().int().min(0).default(0),
    newTotal: z.number().int().min(0),
  })
  .refine(data => data.newTotal >= data.additionalGP, {
    message: 'New total wins must be greater than or equal to additional GP wins',
    path: ['newTotal'],
  });

// File upload validation
export const FileUploadSchema = z
  .instanceof(File)
  .refine(
    file => file.size <= 10 * 1024 * 1024, // 10MB limit
    { message: 'File size must be less than 10MB' }
  )
  .refine(file => file.type === 'application/json' || file.name.endsWith('.json'), {
    message: 'File must be a JSON file',
  });

// Email validation for Google Account emails (any valid email address)
export const GoogleAccountEmailSchema = z.string().email().toLowerCase();

// Admin role change validation
export const AdminRoleChangeSchema = z
  .object({
    targetUserId: z.string(),
    newRole: z.enum(['admin', 'normal']),
    currentUserId: z.string(),
    totalAdminCount: z.number().int().min(1),
  })
  .refine(
    data =>
      !(
        data.newRole === 'normal' &&
        data.targetUserId === data.currentUserId &&
        data.totalAdminCount === 1
      ),
    {
      message: 'Cannot demote the last remaining admin',
      path: ['newRole'],
    }
  );

// Type exports
export type AppState = z.infer<typeof AppStateSchema>;
export type SeriesState = z.infer<typeof SeriesStateSchema>;
export type UserDataExport = z.infer<typeof UserDataExportSchema>;
export type AuthorizedUser = z.infer<typeof AuthorizedUserSchema>;
export type UserInvitation = z.infer<typeof UserInvitationSchema>;
export type FastForwardInput = z.infer<typeof FastForwardInputSchema>;
export type AdminRoleChange = z.infer<typeof AdminRoleChangeSchema>;

// Import result union type
export type ImportResult =
  | { type: 'full'; data: { series: SeriesState[]; config: { wins: number; gpWins: number } } }
  | { type: 'single'; allCrates: string[] };

/**
 * Migrates raw Firestore/localStorage data to the 12-series AppState format.
 * - New format (series array of length 12): parsed and returned as-is.
 * - Legacy format (allCrates array): placed at series[11], other series empty.
 * - Unknown/empty: returns default empty 12-series state.
 */
export function migrateToMultiSeries(rawData: unknown): { migrated: boolean; data: AppState } {
  const data = rawData as any;

  // Already in new multi-series format
  if (data?.series && Array.isArray(data.series) && data.series.length === 12) {
    try {
      return { migrated: false, data: AppStateSchema.parse(data) };
    } catch {
      return { migrated: false, data: AppStateSchema.parse({}) };
    }
  }

  // Legacy single-series format: migrate allCrates → series[11]
  if (data?.allCrates && Array.isArray(data.allCrates)) {
    const series = Array.from({ length: 12 }, (_, i) => ({
      allCrates: i === 11 ? (data.allCrates as string[]) : [],
    }));
    try {
      const migrated = AppStateSchema.parse({
        series,
        config: data.config || { wins: 0, gpWins: 0 },
      });
      return { migrated: true, data: migrated };
    } catch {
      return { migrated: false, data: AppStateSchema.parse({}) };
    }
  }

  // No recognizable data: return defaults
  return { migrated: false, data: AppStateSchema.parse({}) };
}

// Validation helper functions
export function validateAppState(data: unknown): AppState {
  return AppStateSchema.parse(data);
}

export function validateUserDataExport(data: unknown): UserDataExport {
  return UserDataExportSchema.parse(data);
}

export function validateAuthorizedUser(data: unknown): AuthorizedUser {
  return AuthorizedUserSchema.parse(data);
}

export function validateUserInvitation(data: unknown): UserInvitation {
  return UserInvitationSchema.parse(data);
}

export function validateFastForwardInput(data: unknown): FastForwardInput {
  return FastForwardInputSchema.parse(data);
}

export function validateFileUpload(file: unknown): File {
  return FileUploadSchema.parse(file);
}

export function validateGoogleAccountEmail(email: unknown): string {
  return GoogleAccountEmailSchema.parse(email);
}

export function validateAdminRoleChange(data: unknown): AdminRoleChange {
  return AdminRoleChangeSchema.parse(data);
}

// Safe validation functions that return errors instead of throwing
export function safeValidateAppState(
  data: unknown
): { success: true; data: AppState } | { success: false; error: string } {
  try {
    const result = AppStateSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Validation failed' };
  }
}

export function safeValidateUserDataExport(
  data: unknown
): { success: true; data: UserDataExport } | { success: false; error: string } {
  try {
    const result = UserDataExportSchema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Validation failed' };
  }
}
