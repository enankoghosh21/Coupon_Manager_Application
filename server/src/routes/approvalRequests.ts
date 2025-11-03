import { Router } from 'express';
import { z } from 'zod';
import { db, withTransaction } from '../db.js';
import { ApprovalStatus, CouponStatus } from '../types.js';
import { mapApprovalRequestRow, mapCouponRow } from '../utils/mappers.js';
import { approvalRequestSchema } from '../utils/validation.js';

const router = Router();

const findMatchingCoupon = db.prepare(`
  SELECT * FROM coupons
  WHERE status = @status
    AND type = @couponType
    AND promo_name = @promoName
    AND datetime(begins_at) <= datetime(@now)
    AND (expires_at IS NULL OR datetime(expires_at) >= datetime(@now))
  ORDER BY begins_at ASC, id ASC
  LIMIT 1
`);

router.get('/', (req, res) => {
  const { status } = req.query as Record<string, string | undefined>;
  let query = 'SELECT * FROM approval_requests';
  const params: Record<string, unknown> = {};
  if (status) {
    query += ' WHERE status = @status';
    params.status = status;
  }
  query += ' ORDER BY datetime(requested_at) DESC';
  const rows = db.prepare(query).all(params);
  res.json(rows.map(mapApprovalRequestRow));
});

router.get('/:id', (req, res) => {
  const request = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(req.params.id);
  if (!request) {
    return res.status(404).json({ message: 'Approval request not found' });
  }
  res.json(mapApprovalRequestRow(request));
});

router.post('/', (req, res, next) => {
  try {
    const parsed = approvalRequestSchema.parse(req.body);
    const id = parsed.id ?? `req_${Date.now()}`;
    const requestedAt = (parsed.requestedAt ?? new Date()).toISOString();

    db.prepare(`
      INSERT INTO approval_requests (
        id, status, requested_at, case_id, user_id, agent_id, agent_name, order_number, reason, coupon_type, promo_name
      ) VALUES (@id, @status, @requestedAt, @caseId, @userId, @agentId, @agentName, @orderNumber, @reason, @couponType, @promoName)
    `).run({
      id,
      status: parsed.status ?? ApprovalStatus.PENDING,
      requestedAt,
      caseId: parsed.caseId,
      userId: parsed.userId,
      agentId: parsed.agentId,
      agentName: parsed.agentName,
      orderNumber: parsed.orderNumber ?? null,
      reason: parsed.reason,
      couponType: parsed.couponType,
      promoName: parsed.promoName,
    });

    const stored = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id);
    res.status(201).json(mapApprovalRequestRow(stored));
  } catch (error) {
    next(error);
  }
});

const resolveSchema = z.object({
  resolvedBy: z.string().min(1),
});

router.post('/:id/approve', (req, res, next) => {
  try {
    const { resolvedBy } = resolveSchema.parse(req.body);
    const id = req.params.id;

    const request = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id);
    if (!request) {
      return res.status(404).json({ message: 'Approval request not found' });
    }
    if (request.status !== ApprovalStatus.PENDING) {
      return res.status(409).json({ message: 'Request has already been resolved.' });
    }

    const now = new Date().toISOString();

    const coupon = findMatchingCoupon.get({
      status: CouponStatus.AVAILABLE,
      couponType: request.coupon_type,
      promoName: request.promo_name,
      now,
    });

    if (!coupon) {
      return res.status(409).json({ message: 'No available coupons match this request.' });
    }

    withTransaction(() => {
      db.prepare(`
        UPDATE coupons SET
          status = @status,
          generation_case_id = @caseId,
          generation_user_id = @userId,
          generation_agent_id = @agentId,
          generation_agent_name = @agentName,
          generation_order_number = @orderNumber,
          generation_reason = @reason,
          generation_generated_at = @generatedAt
        WHERE id = @id
      `).run({
        id: coupon.id,
        status: CouponStatus.USED,
        caseId: request.case_id,
        userId: request.user_id,
        agentId: request.agent_id,
        agentName: request.agent_name,
        orderNumber: request.order_number ?? null,
        reason: request.reason,
        generatedAt: now,
      });

      db.prepare(`
        UPDATE approval_requests SET
          status = @status,
          resolved_by = @resolvedBy,
          resolved_at = @resolvedAt
        WHERE id = @id
      `).run({
        id,
        status: ApprovalStatus.APPROVED,
        resolvedBy,
        resolvedAt: now,
      });
    });

    const updatedRequest = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id);
    const updatedCoupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(coupon.id);

    res.json({
      request: mapApprovalRequestRow(updatedRequest),
      coupon: mapCouponRow(updatedCoupon),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/deny', (req, res, next) => {
  try {
    const { resolvedBy } = resolveSchema.parse(req.body);
    const id = req.params.id;

    const request = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id);
    if (!request) {
      return res.status(404).json({ message: 'Approval request not found' });
    }
    if (request.status !== ApprovalStatus.PENDING) {
      return res.status(409).json({ message: 'Request has already been resolved.' });
    }

    const now = new Date().toISOString();

    db.prepare(`
      UPDATE approval_requests SET
        status = @status,
        resolved_by = @resolvedBy,
        resolved_at = @resolvedAt
      WHERE id = @id
    `).run({
      id,
      status: ApprovalStatus.DENIED,
      resolvedBy,
      resolvedAt: now,
    });

    const updatedRequest = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id);
    res.json({ request: mapApprovalRequestRow(updatedRequest) });
  } catch (error) {
    next(error);
  }
});

const bulkSchema = z.object({
  action: z.enum(['approve', 'deny']),
  requestIds: z.array(z.string().min(1)),
  resolvedBy: z.string().min(1),
});

router.post('/bulk/actions', (req, res, next) => {
  try {
    const { action, requestIds, resolvedBy } = bulkSchema.parse(req.body);
    const now = new Date().toISOString();

    const approved: { requestId: string; couponId: number }[] = [];
    const failed: { requestId: string; reason: string }[] = [];
    const denied: string[] = [];

    withTransaction(() => {
      for (const requestId of requestIds) {
        const request = db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(requestId);
        if (!request || request.status !== ApprovalStatus.PENDING) {
          failed.push({ requestId, reason: 'Request not found or already resolved' });
          continue;
        }

        if (action === 'deny') {
          db.prepare(`
            UPDATE approval_requests SET
              status = @status,
              resolved_by = @resolvedBy,
              resolved_at = @resolvedAt
            WHERE id = @id
          `).run({
            id: requestId,
            status: ApprovalStatus.DENIED,
            resolvedBy,
            resolvedAt: now,
          });
          denied.push(requestId);
          continue;
        }

        const coupon = findMatchingCoupon.get({
          status: CouponStatus.AVAILABLE,
          couponType: request.coupon_type,
          promoName: request.promo_name,
          now,
        });

        if (!coupon) {
          failed.push({ requestId, reason: 'No available coupons match this request' });
          continue;
        }

        db.prepare(`
          UPDATE coupons SET
            status = @status,
            generation_case_id = @caseId,
            generation_user_id = @userId,
            generation_agent_id = @agentId,
            generation_agent_name = @agentName,
            generation_order_number = @orderNumber,
            generation_reason = @reason,
            generation_generated_at = @generatedAt
          WHERE id = @id
        `).run({
          id: coupon.id,
          status: CouponStatus.USED,
          caseId: request.case_id,
          userId: request.user_id,
          agentId: request.agent_id,
          agentName: request.agent_name,
          orderNumber: request.order_number ?? null,
          reason: request.reason,
          generatedAt: now,
        });

        db.prepare(`
          UPDATE approval_requests SET
            status = @status,
            resolved_by = @resolvedBy,
            resolved_at = @resolvedAt
          WHERE id = @id
        `).run({
          id: requestId,
          status: ApprovalStatus.APPROVED,
          resolvedBy,
          resolvedAt: now,
        });

        approved.push({ requestId, couponId: coupon.id });
      }
    });

    const updatedRequests = requestIds
      .map((id) => db.prepare('SELECT * FROM approval_requests WHERE id = ?').get(id))
      .filter(Boolean)
      .map(mapApprovalRequestRow);

    const updatedCoupons = approved
      .map(({ couponId }) => db.prepare('SELECT * FROM coupons WHERE id = ?').get(couponId))
      .filter(Boolean)
      .map(mapCouponRow);

    res.json({
      approved,
      denied,
      failed,
      requests: updatedRequests,
      coupons: updatedCoupons,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
