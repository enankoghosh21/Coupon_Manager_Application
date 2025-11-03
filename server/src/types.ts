export enum CouponStatus {
  AVAILABLE = 'Available',
  USED = 'Used'
}

export enum ApprovalStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  DENIED = 'Denied'
}

export enum UserRole {
  SUPER_ADMIN = 'Super Admin',
  MANAGER = 'Manager',
  L2_AGENT = 'L2 Agent',
  L1_AGENT = 'L1 Agent',
  CMT = 'CMT',
  L4 = 'L4'
}

export interface GenerationRecord {
  caseId: string;
  userId: string;
  agentId?: string;
  agentName: string;
  orderNumber?: string | null;
  reason: string;
  generatedAt: string;
}

export interface Coupon {
  id: number;
  promoId: string;
  promoName: string;
  code: string;
  status: CouponStatus;
  type: string;
  value: number;
  beginsAt: string;
  expiresAt?: string | null;
  generationRecord?: GenerationRecord | null;
}

export interface ApprovalRequest {
  id: string;
  status: ApprovalStatus;
  requestedAt: string;
  caseId: string;
  userId: string;
  agentId: string;
  agentName: string;
  orderNumber?: string | null;
  reason: string;
  couponType: string;
  promoName: string;
  resolvedBy?: string | null;
  resolvedAt?: string | null;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  workId: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  accessibleCouponTypes: string[];
  managerIds: string[];
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
}

export interface SkippedCoupon {
  code: string;
  reason: string;
}
