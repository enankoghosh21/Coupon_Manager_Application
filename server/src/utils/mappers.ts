import { ApprovalRequest, ApprovalStatus, AuditLogEntry, Coupon, CouponStatus, GenerationRecord, User, UserRole } from '../types.js';

const parseDate = (value: string | null | undefined): string | null => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return date.toISOString();
};

export const mapCouponRow = (row: any): Coupon => {
  const generation: GenerationRecord | null = row.generation_case_id
    ? {
        caseId: row.generation_case_id,
        userId: row.generation_user_id,
        agentId: row.generation_agent_id ?? undefined,
        agentName: row.generation_agent_name,
        orderNumber: row.generation_order_number ?? undefined,
        reason: row.generation_reason,
        generatedAt: parseDate(row.generation_generated_at) ?? new Date().toISOString()
      }
    : null;

  return {
    id: row.id,
    promoId: row.promo_id,
    promoName: row.promo_name,
    code: row.code,
    status: row.status as CouponStatus,
    type: row.type,
    value: Number(row.value),
    beginsAt: parseDate(row.begins_at) ?? new Date(row.begins_at).toISOString(),
    expiresAt: parseDate(row.expires_at),
    generationRecord: generation ?? undefined
  };
};

export const mapApprovalRequestRow = (row: any): ApprovalRequest => ({
  id: row.id,
  status: row.status as ApprovalStatus,
  requestedAt: parseDate(row.requested_at) ?? new Date(row.requested_at).toISOString(),
  caseId: row.case_id,
  userId: row.user_id,
  agentId: row.agent_id,
  agentName: row.agent_name,
  orderNumber: row.order_number ?? undefined,
  reason: row.reason,
  couponType: row.coupon_type,
  promoName: row.promo_name,
  resolvedBy: row.resolved_by ?? undefined,
  resolvedAt: parseDate(row.resolved_at) ?? undefined
});

export const mapUserRow = (row: any): User => ({
  id: row.id,
  firstName: row.first_name,
  lastName: row.last_name,
  workId: row.work_id,
  email: row.email,
  role: row.role as UserRole,
  isActive: Boolean(row.is_active),
  accessibleCouponTypes: JSON.parse(row.accessible_coupon_types ?? '[]'),
  managerIds: JSON.parse(row.manager_ids ?? '[]')
});

export const mapAuditLogRow = (row: any): AuditLogEntry => ({
  id: row.id,
  timestamp: parseDate(row.timestamp) ?? new Date(row.timestamp).toISOString(),
  userId: row.user_id,
  userName: row.user_name,
  userRole: row.user_role as UserRole,
  action: row.action
});
