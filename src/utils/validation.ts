import { z } from 'zod';

// Core application state schema
export const AppStateSchema = z.object({
  allCrates: z.array(z.string()).default([]),
  config: z
    .object({
      wins: z.number().int().min(0).default(0),
      gpWins: z.number().int().min(0).default(0),
    })
    .default({ wins: 0, gpWins: 0 }),
});

// User data import/export schema (with additional metadata)
export const UserDataExportSchema = z.object({
  allCrates: z.array(z.string()).default([]),
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

// Email validation with Gmail-specific checks
export const GmailAddressSchema = z
  .string()
  .email()
  .toLowerCase()
  .refine(email => email.endsWith('@gmail.com'), { message: 'Only Gmail addresses are allowed' })
  .refine(email => !email.includes('+'), {
    message: 'Gmail aliases (+ addresses) are not allowed',
  });

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
export type UserDataExport = z.infer<typeof UserDataExportSchema>;
export type AuthorizedUser = z.infer<typeof AuthorizedUserSchema>;
export type UserInvitation = z.infer<typeof UserInvitationSchema>;
export type FastForwardInput = z.infer<typeof FastForwardInputSchema>;
export type AdminRoleChange = z.infer<typeof AdminRoleChangeSchema>;

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

export function validateGmailAddress(email: unknown): string {
  return GmailAddressSchema.parse(email);
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
