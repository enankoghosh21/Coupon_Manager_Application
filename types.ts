// FIX: Removed a self-import of 'GenerationRecord' which was causing a declaration conflict.
export enum CouponStatus {
  AVAILABLE = 'Available',
  USED = 'Used',
}

export enum ApprovalStatus {
  PENDING = 'Pending',
  APPROVED = 'Approved',
  DENIED = 'Denied',
}

export enum UserRole {
  SUPER_ADMIN = 'Super Admin',
  MANAGER = 'Manager',
  L2_AGENT = 'L2 Agent',
  L1_AGENT = 'L1 Agent',
  CMT = 'CMT',
  L4 = 'L4',
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  workId: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  accessibleCouponTypes?: string[];
  managerIds?: string[];
}

export interface GenerationRecord {
  caseId: string;
  userId: string;
  agentName: string;
  orderNumber?: string;
  reason: string;
  generatedAt: Date;
}

export interface Coupon {
  id: number;
  promoId: string;
  promoName: string;
  code: string;
  status: CouponStatus;
  type: string;
  value: number;
  generationRecord?: GenerationRecord;
  beginsAt: Date;
  expiresAt?: Date;
}

export interface ApprovalRequest {
  id: string;
  status: ApprovalStatus;
  requestedAt: Date;
  // Details from the generation form
  caseId: string;
  userId: string;
  agentName: string;
  orderNumber?: string;
  reason: string;
  // The coupon type requested
  couponType: string;
  promoName: string;
  // Details for resolution
  resolvedBy?: string; // Admin name
  resolvedAt?: Date;
}


export interface SkippedCoupon {
  rowData: Record<string, string | number>;
  rowNumber: number;
  reason: string;
}