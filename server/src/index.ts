import dotenv from 'dotenv';
import path from 'path';

const envPath = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(process.cwd(), 'server', envPath) });

dotenv.config();

import app from './app.js';

const port = Number(process.env.PORT ?? 4000);

app.listen(port, () => {
  console.log(`Coupon Manager API listening on port ${port}`);
});
