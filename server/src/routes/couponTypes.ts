import { Router } from 'express';
import { z } from 'zod';
import { db } from '../db.js';

const router = Router();

router.get('/', (_req, res) => {
  const rows = db.prepare('SELECT name FROM coupon_types ORDER BY name ASC').all();
  res.json(rows.map((row) => row.name));
});

const createSchema = z.object({
  name: z.string().min(1),
});

router.post('/', (req, res, next) => {
  try {
    const { name } = createSchema.parse(req.body);
    db.prepare('INSERT OR IGNORE INTO coupon_types(name) VALUES (?)').run(name);
    res.status(201).json({ name });
  } catch (error) {
    next(error);
  }
});

router.delete('/:name', (req, res) => {
  const result = db.prepare('DELETE FROM coupon_types WHERE name = ?').run(req.params.name);
  if (result.changes === 0) {
    return res.status(404).json({ message: 'Coupon type not found' });
  }
  res.status(204).send();
});

export default router;
