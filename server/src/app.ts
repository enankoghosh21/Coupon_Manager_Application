import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';

import couponsRouter from './routes/coupons.js';
import approvalRequestsRouter from './routes/approvalRequests.js';
import usersRouter from './routes/users.js';
import auditLogRouter from './routes/auditLog.js';
import couponTypesRouter from './routes/couponTypes.js';

const app = express();

app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN?.split(',') ?? '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(morgan('dev'));

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/coupons', couponsRouter);
app.use('/api/approval-requests', approvalRequestsRouter);
app.use('/api/users', usersRouter);
app.use('/api/audit-log', auditLogRouter);
app.use('/api/coupon-types', couponTypesRouter);

app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  if (err?.name === 'ZodError') {
    return res.status(400).json({ message: 'Validation failed', issues: err.issues });
  }

  console.error(err);
  res.status(err?.status || 500).json({ message: err?.message || 'Internal server error' });
});

export default app;
