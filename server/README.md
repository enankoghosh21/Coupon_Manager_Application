# Coupon Manager Backend

This directory contains an Express + TypeScript REST API that powers the Coupon Manager front-end. The service exposes endpoints for managing coupons, approval requests, users, coupon types, and audit log entries. Data is persisted in a local SQLite database (created automatically on first run).

## Getting Started

1. Copy the sample environment file and adjust values as needed:

   ```bash
   cp .env.example .env
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

   The API listens on `http://localhost:4000` by default.

4. Build for production:

   ```bash
   npm run build
   npm start
   ```

## Environment Variables

| Variable    | Description                                              | Default                 |
|-------------|----------------------------------------------------------|-------------------------|
| `PORT`      | Port used by the Express server                          | `4000`                  |
| `CORS_ORIGIN` | Comma-separated list of origins allowed by CORS middleware | `http://localhost:5173` |
| `DB_FILE`   | Path to the SQLite database file                         | `server/data/coupons.db`|

## API Overview

All endpoints are prefixed with `/api` (except `/health`). Responses use ISO-8601 timestamps.

### Health Check

- `GET /health` – Returns `{ "status": "ok" }`.

### Coupons

- `GET /api/coupons` – List coupons. Supports `status`, `type`, `promoName`, and `search` query params.
- `GET /api/coupons/:id` – Retrieve a single coupon.
- `POST /api/coupons` – Create a coupon.
- `POST /api/coupons/bulk` – Bulk insert coupons. Returns inserted coupons and any skipped duplicates.
- `POST /api/coupons/:id/generate` – Mark a coupon as used and attach a generation record.
- `POST /api/coupons/:id/reset` – Reset a coupon back to the available state.
- `PATCH /api/coupons/:id` – Update coupon fields.
- `DELETE /api/coupons/:id` – Remove a coupon.

### Approval Requests

- `GET /api/approval-requests` – List approval requests (filterable by `status`).
- `POST /api/approval-requests` – Create a new approval request.
- `POST /api/approval-requests/:id/approve` – Resolve a request by generating a matching coupon.
- `POST /api/approval-requests/:id/deny` – Resolve a request as denied.
- `POST /api/approval-requests/bulk/actions` – Resolve multiple requests in a single call.

### Users

- `GET /api/users` – List users.
- `POST /api/users` – Create a user.
- `GET /api/users/:id` – Retrieve a user.
- `PATCH /api/users/:id` – Update a user.
- `DELETE /api/users/:id` – Remove a user.

### Coupon Types

- `GET /api/coupon-types` – List known coupon types.
- `POST /api/coupon-types` – Add a new coupon type.
- `DELETE /api/coupon-types/:name` – Remove a coupon type.

### Audit Log

- `GET /api/audit-log` – List audit log entries (supports `limit`/`offset`).
- `POST /api/audit-log` – Record a new audit log entry.

## Error Handling

Validation errors return HTTP 400 with detailed information. Conflicts (e.g., duplicate coupon codes) return HTTP 409. Unexpected errors return HTTP 500.

## Database

The SQLite database file is created automatically in `server/data/coupons.db`. Schema migrations are handled programmatically during application start-up.

