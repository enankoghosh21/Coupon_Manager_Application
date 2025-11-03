import { Router } from 'express';
import { z } from 'zod';
import { db, withTransaction } from '../db.js';
import { CouponStatus, SkippedCoupon } from '../types.js';
import { mapCouponRow } from '../utils/mappers.js';
import { couponInputSchema, generationRecordSchema } from '../utils/validation.js';

const router = Router();

const ensureCouponType = db.prepare('INSERT OR IGNORE INTO coupon_types(name) VALUES (?)');

router.get('/', (req, res) => {
  const { status, type, promoName, search } = req.query as Record<string, string | undefined>;

  const filters: string[] = [];
  const params: Record<string, unknown> = {};

  if (status) {
    filters.push('status = @status');
    params.status = status;
  }
  if (type) {
    filters.push('type = @type');
    params.type = type;
  }
  if (promoName) {
    filters.push('promo_name = @promoName');
    params.promoName = promoName;
  }
  if (search) {
    filters.push('(code LIKE @search OR promo_name LIKE @search OR promo_id LIKE @search)');
    params.search = `%${search}%`;
  }

  let query = 'SELECT * FROM coupons';
  if (filters.length > 0) {
    query += ' WHERE ' + filters.join(' AND ');
  }
  query += ' ORDER BY begins_at DESC, code ASC';

  const rows = db.prepare(query).all(params);
  res.json(rows.map(mapCouponRow));
});

router.get('/:id', (req, res) => {
  const id = Number(req.params.id);
  const row = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ message: 'Coupon not found' });
  }
  res.json(mapCouponRow(row));
});

router.post('/', (req, res, next) => {
  try {
    const parsed = couponInputSchema.parse(req.body);

    const insert = db.prepare(`
      INSERT INTO coupons (
        promo_id, promo_name, code, status, type, value, begins_at, expires_at
      ) VALUES (@promoId, @promoName, @code, @status, @type, @value, @beginsAt, @expiresAt)
    `);

    const result = insert.run({
      ...parsed,
      status: parsed.status ?? CouponStatus.AVAILABLE,
      expiresAt: parsed.expiresAt ?? null,
    });

    ensureCouponType.run(parsed.type);

    const row = db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(mapCouponRow(row));
  } catch (error) {
    if ((error as any)?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'A coupon with this code already exists.' });
    }
    next(error);
  }
});

const bulkSchema = z.object({
  coupons: z.array(couponInputSchema),
  skipDuplicates: z.boolean().default(true),
});

router.post('/bulk', (req, res, next) => {
  try {
    const parsed = bulkSchema.parse(req.body);
    const inserted: any[] = [];
    const skipped: SkippedCoupon[] = [];

    const insert = db.prepare(`
      INSERT INTO coupons (
        promo_id, promo_name, code, status, type, value, begins_at, expires_at
      ) VALUES (@promoId, @promoName, @code, @status, @type, @value, @beginsAt, @expiresAt)
    `);

    withTransaction(() => {
      for (const coupon of parsed.coupons) {
        try {
          const result = insert.run({
            ...coupon,
            status: coupon.status ?? CouponStatus.AVAILABLE,
            expiresAt: coupon.expiresAt ?? null,
          });
          const row = db.prepare('SELECT * FROM coupons WHERE id = ?').get(result.lastInsertRowid);
          inserted.push(row);
          ensureCouponType.run(coupon.type);
        } catch (err) {
          if ((err as any)?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            skipped.push({ code: coupon.code, reason: 'Duplicate coupon code' });
            if (!parsed.skipDuplicates) {
              throw err;
            }
          } else {
            throw err;
          }
        }
      }
    });

    res.status(201).json({
      inserted: inserted.map(mapCouponRow),
      skipped,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/:id/generate', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const generation = generationRecordSchema.parse(req.body);
    const nowIso = (generation.generatedAt ?? new Date()).toISOString();

    const coupon = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
    if (!coupon) {
      return res.status(404).json({ message: 'Coupon not found' });
    }
    if (coupon.status !== CouponStatus.AVAILABLE) {
      return res.status(409).json({ message: 'Coupon has already been used.' });
    }

    const update = db.prepare(`
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
    `);

    update.run({
      id,
      status: CouponStatus.USED,
      caseId: generation.caseId,
      userId: generation.userId,
      agentId: generation.agentId ?? null,
      agentName: generation.agentName,
      orderNumber: generation.orderNumber ?? null,
      reason: generation.reason,
      generatedAt: nowIso,
    });

    const row = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
    res.json(mapCouponRow(row));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/reset', (req, res) => {
  const id = Number(req.params.id);
  const exists = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
  if (!exists) {
    return res.status(404).json({ message: 'Coupon not found' });
  }

  db.prepare(`
    UPDATE coupons SET
      status = @status,
      generation_case_id = NULL,
      generation_user_id = NULL,
      generation_agent_id = NULL,
      generation_agent_name = NULL,
      generation_order_number = NULL,
      generation_reason = NULL,
      generation_generated_at = NULL
    WHERE id = @id
  `).run({ id, status: CouponStatus.AVAILABLE });

  const row = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
  res.json(mapCouponRow(row));
});

const updateSchema = couponInputSchema.partial();

router.patch('/:id', (req, res, next) => {
  try {
    const id = Number(req.params.id);
    const updates = updateSchema.parse(req.body);

    const existing = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ message: 'Coupon not found' });
    }

    const merged = {
      promoId: updates.promoId ?? existing.promo_id,
      promoName: updates.promoName ?? existing.promo_name,
      code: updates.code ?? existing.code,
      status: updates.status ?? existing.status,
      type: updates.type ?? existing.type,
      value: updates.value ?? existing.value,
      beginsAt: updates.beginsAt ?? existing.begins_at,
      expiresAt: updates.expiresAt ?? existing.expires_at,
    };

    const result = db.prepare(`
      UPDATE coupons SET
        promo_id = @promoId,
        promo_name = @promoName,
        code = @code,
        status = @status,
        type = @type,
        value = @value,
        begins_at = @beginsAt,
        expires_at = @expiresAt
      WHERE id = @id
    `).run({ ...merged, id });

    if (result.changes === 0) {
      return res.status(500).json({ message: 'Failed to update coupon' });
    }

    ensureCouponType.run(merged.type);

    const row = db.prepare('SELECT * FROM coupons WHERE id = ?').get(id);
    res.json(mapCouponRow(row));
  } catch (error) {
    if ((error as any)?.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'A coupon with this code already exists.' });
    }
    next(error);
  }
});

router.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  const result = db.prepare('DELETE FROM coupons WHERE id = ?').run(id);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Coupon not found' });
  }
  res.status(204).send();
});

export default router;
