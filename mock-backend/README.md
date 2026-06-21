# NEXUS Mock Backend

Standalone Go backend using **SQLite** for development and end-to-end testing of the NEXUS Exchange frontend without needing PostgreSQL or Redis.

## Quick Start

```bash
# Build
go build -o nexus-mock-backend .

# Run
PORT=3000 \
JWT_SECRET="your-dev-secret-here-at-least-32-chars" \
ADMIN_PASSWORD="Admin@123456" \
./nexus-mock-backend
```

The server starts on `:3000` and creates a SQLite database at `./data.db`.

## Default Credentials

| Role  | Email                  | Password       |
|-------|------------------------|----------------|
| Admin | admin@eg-money.com     | Admin@123456   |

New users registered via the API get a **10,000 USDT welcome bonus** for testing.

## Environment Variables

| Variable        | Default                  | Description                          |
|-----------------|--------------------------|--------------------------------------|
| PORT            | 3000                     | HTTP port                            |
| JWT_SECRET      | (hardcoded dev default)  | JWT signing secret (≥32 chars)       |
| ADMIN_PASSWORD  | Admin@123456             | Initial admin password               |
| SQLITE_PATH     | ./data.db                | SQLite database file location        |

## API Endpoints

### Auth (public)
- `POST /api/v1/auth/register` — create account `{email, username, password}`
- `POST /api/v1/auth/login` — login `{email, password}` → returns `access_token`, `refresh_token`, `user`
- `POST /api/v1/auth/refresh` — refresh access token `{refresh_token}`
- `GET /api/v1/auth/verify-email?token=X` — auto-verifies (mock)
- `POST /api/v1/auth/forgot-password` — always returns success (mock)
- `POST /api/v1/auth/reset-password` — always returns success (mock)

### Authenticated
- `POST /api/v1/auth/logout` — revoke refresh token
- `GET /api/v1/auth/sessions` — list sessions (empty in mock)
- `GET /api/v1/user/info` — current user profile
- `PUT /api/v1/user/profile` — update profile
- `POST /api/v1/user/change-password` — change password (mock)
- `GET /api/v1/wallet/balances` — list wallet balances
- `POST /api/v1/wallet/deposit` — deposit `{currency, amount}`
- `POST /api/v1/wallet/withdraw` — withdraw `{currency, amount, address}`
- `GET /api/v1/wallet/transactions` — list transactions
- `GET /api/v1/notifications` — list notifications
- `PUT /api/v1/notifications/read-all` — mark all as read
- `PUT /api/v1/notifications/:id/read` — mark one as read
- `POST /api/v1/kyc/submit` — submit KYC
- `GET /api/v1/kyc/status` — check KYC status
- `POST /api/v1/exchange/order` — place order (auto-fills)
- `GET /api/v1/exchange/orders` — list orders
- `POST /api/v1/exchange/order/:id/cancel` — cancel pending order

### Public
- `GET /api/v1/fees` — fee schedules
- `GET /api/v1/ads` — active ads
- `GET /api/v1/market/prices` — static mock prices
- `GET /api/health` — health check

### Admin (requires ADMIN role)
- `GET /api/v1/admin/stats` — dashboard stats
- `GET /api/v1/admin/users` — list all users
- `GET /api/v1/admin/kyc` — list all KYC requests
- `PUT /api/v1/admin/kyc/:id/review` — approve/reject KYC
- `GET /api/v1/admin/transactions` — list all transactions

## CORS

All origins allowed (`*`). Designed for local development with the SvelteKit frontend on port 3001.

## Reset Database

Just delete `data.db` and restart — the admin user and fee schedules will be re-seeded automatically.

```bash
rm data.db && ./nexus-mock-backend
```

## Production Use

This mock backend is **NOT for production**. It:
- Auto-verifies all emails
- Auto-fills all orders at the requested price (no real matching engine)
- Uses SQLite (single-writer, no concurrent scaling)
- Has a hardcoded JWT secret default
- Allows deposits without real payment verification

Use the real Go backend in `../backend/` (requires PostgreSQL + Redis) for production.
