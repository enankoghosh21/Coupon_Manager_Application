import { Router } from 'express';
import { db } from '../db.js';
import { mapAuditLogRow } from '../utils/mappers.js';
import { auditLogSchema } from '../utils/validation.js';

const router = Router();

router.get('/', (req, res) => {
  const limit = Number(req.query.limit ?? 100);
  const offset = Number(req.query.offset ?? 0);

  const rows = db
    .prepare('SELECT * FROM audit_log ORDER BY datetime(timestamp) DESC LIMIT @limit OFFSET @offset')
    .all({ limit, offset });
  res.json(rows.map(mapAuditLogRow));
});

router.post('/', (req, res, next) => {
  try {
    const parsed = auditLogSchema.parse(req.body);
    const timestamp = (parsed.timestamp ?? new Date()).toISOString();
    db.prepare(
      `INSERT INTO audit_log (id, timestamp, user_id, user_name, user_role, action)
       VALUES (@id, @timestamp, @userId, @userName, @userRole, @action)`
    ).run({
      id: parsed.id,
      timestamp,
      userId: parsed.userId,
      userName: parsed.userName,
      userRole: parsed.userRole,
      action: parsed.action,
    });

    const stored = db.prepare('SELECT * FROM audit_log WHERE id = ?').get(parsed.id);
    res.status(201).json(mapAuditLogRow(stored));
  } catch (error) {
    next(error);
  }
});

export default router;
