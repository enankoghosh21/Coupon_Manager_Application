import { z } from 'zod';
import { ApprovalStatus, CouponStatus, UserRole } from '../types.js';

export const isoDateString = () =>
  z
    .string()
    .transform((value) => new Date(value).toISOString());

export const couponInputSchema = z.object({
  promoId: z.string().min(1),
  promoName: z.string().min(1),
  code: z.string().min(1),
  status: z.nativeEnum(CouponStatus).default(CouponStatus.AVAILABLE),
  type: z.string().min(1),
  value: z.coerce.number().nonnegative(),
  beginsAt: z.coerce.date().transform((date) => date.toISOString()),
  expiresAt: z
    .union([z.coerce.date().transform((date) => date.toISOString()), z.null(), z.undefined()])
    .optional(),
});

export const generationRecordSchema = z.object({
  caseId: z.string().min(1),
  userId: z.string().min(1),
  agentId: z.string().optional(),
  agentName: z.string().min(1),
  orderNumber: z.string().optional(),
  reason: z.string().min(1),
  generatedAt: z.coerce.date().optional(),
});

export const approvalRequestSchema = z.object({
  id: z.string().optional(),
  caseId: z.string().min(1),
  userId: z.string().min(1),
  agentId: z.string().min(1),
  agentName: z.string().min(1),
  orderNumber: z.string().optional(),
  reason: z.string().min(1),
  couponType: z.string().min(1),
  promoName: z.string().min(1),
  requestedAt: z.coerce.date().optional(),
  status: z.nativeEnum(ApprovalStatus).optional(),
});

export const userInputSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  workId: z.string().min(1),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean().default(true),
  accessibleCouponTypes: z.array(z.string()).default([]),
  managerIds: z.array(z.string()).default([]),
});

export const auditLogSchema = z.object({
  id: z.string().min(1),
  timestamp: z.coerce.date().optional(),
  userId: z.string().min(1),
  userName: z.string().min(1),
  userRole: z.nativeEnum(UserRole),
  action: z.string().min(1),
});
