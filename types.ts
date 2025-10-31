// FIX: Removed a self-import of 'GenerationRecord' which was causing a declaration conflict.
export enum CouponStatus {
  AVAILABLE = 'Available',
  USED = 'Used',
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

export interface SkippedCoupon {
  rowData: Record<string, string | number>;
  rowNumber: number;
  reason: string;
}