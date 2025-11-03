import { Router } from 'express';
import { db } from '../db.js';
import { mapUserRow } from '../utils/mappers.js';
import { userInputSchema } from '../utils/validation.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT * FROM users ORDER BY last_name ASC, first_name ASC').all();
  res.json(rows.map(mapUserRow));
});

router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.json(mapUserRow(row));
});

router.post('/', (req, res, next) => {
  try {
    const parsed = userInputSchema.parse(req.body);

    db.prepare(`
      INSERT INTO users (
        id, first_name, last_name, work_id, email, role, is_active, accessible_coupon_types, manager_ids
      ) VALUES (@id, @firstName, @lastName, @workId, @email, @role, @isActive, @accessibleCouponTypes, @managerIds)
    `).run({
      id: parsed.id,
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      workId: parsed.workId,
      email: parsed.email,
      role: parsed.role,
      isActive: parsed.isActive ? 1 : 0,
      accessibleCouponTypes: JSON.stringify(parsed.accessibleCouponTypes ?? []),
      managerIds: JSON.stringify(parsed.managerIds ?? []),
    });

    const stored = db.prepare('SELECT * FROM users WHERE id = ?').get(parsed.id);
    res.status(201).json(mapUserRow(stored));
  } catch (error) {
    if ((error as any)?.code === 'SQLITE_CONSTRAINT_PRIMARYKEY') {
      return res.status(409).json({ message: 'User with this ID already exists.' });
    }
    next(error);
  }
});

const updateSchema = userInputSchema.partial();

router.patch('/:id', (req, res, next) => {
  try {
    const id = req.params.id;
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    if (!existing) {
      return res.status(404).json({ message: 'User not found' });
    }

    const parsed = updateSchema.parse(req.body);

    const merged = {
      id,
      firstName: parsed.firstName ?? existing.first_name,
      lastName: parsed.lastName ?? existing.last_name,
      workId: parsed.workId ?? existing.work_id,
      email: parsed.email ?? existing.email,
      role: parsed.role ?? existing.role,
      isActive: parsed.isActive ?? Boolean(existing.is_active),
      accessibleCouponTypes: parsed.accessibleCouponTypes ?? JSON.parse(existing.accessible_coupon_types ?? '[]'),
      managerIds: parsed.managerIds ?? JSON.parse(existing.manager_ids ?? '[]'),
    };

    db.prepare(`
      UPDATE users SET
        first_name = @firstName,
        last_name = @lastName,
        work_id = @workId,
        email = @email,
        role = @role,
        is_active = @isActive,
        accessible_coupon_types = @accessibleCouponTypes,
        manager_ids = @managerIds
      WHERE id = @id
    `).run({
      id,
      firstName: merged.firstName,
      lastName: merged.lastName,
      workId: merged.workId,
      email: merged.email,
      role: merged.role,
      isActive: merged.isActive ? 1 : 0,
      accessibleCouponTypes: JSON.stringify(merged.accessibleCouponTypes ?? []),
      managerIds: JSON.stringify(merged.managerIds ?? []),
    });

    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    res.json(mapUserRow(row));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res) => {
  const result = db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'User not found' });
  }
  res.status(204).send();
});

export default router;
