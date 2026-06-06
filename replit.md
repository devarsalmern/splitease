# SplitEase

A full-stack Splitwise-style expense splitting mobile app. Split bills with friends across groups, track balances, and settle up easily.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `JWT_SECRET` — JWT signing secret

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 (port 8080 in dev)
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Mobile: Expo 54 + Expo Router + React Query

## Where things live

- `lib/api-spec/openapi.yaml` — single source of truth for all API contracts
- `lib/db/src/schema/` — Drizzle schema files (users, groups, expenses, settlements, activity)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/` — auth (JWT/bcrypt), email (nodemailer), balances (debt simplification)
- `artifacts/mobile/app/` — Expo Router screens
- `artifacts/mobile/constants/colors.ts` — design tokens (purple/indigo brand)
- `artifacts/mobile/context/AuthContext.tsx` — JWT token management

## Architecture decisions

- Contract-first API design: OpenAPI spec → Orval codegen → typed React Query hooks + Zod schemas
- JWT auth stored in AsyncStorage on mobile; passed as Bearer token via `setAuthTokenGetter`
- Debt simplification algorithm in `lib/balances.ts` minimizes settlement transactions
- All API routes validated server-side with Orval-generated Zod schemas (`*Body` suffix, not `*Input`)
- Mobile API base URL set at module level via `setBaseUrl` (outside components) using `EXPO_PUBLIC_DOMAIN`

## Product

- Register/login with JWT auth
- Create groups and invite members by email
- Add expenses with equal, exact, or percentage splits
- View simplified debts and settle up within groups
- Activity feed per group
- Dashboard with total balance overview

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Orval-generated Zod schemas use `*Body` suffix (e.g. `RegisterBody`, not `RegisterInput`)
- After changing `lib/*` packages, always run `pnpm run typecheck:libs` before leaf artifact checks
- Mobile Expo dev server accessed via `$REPLIT_EXPO_DEV_DOMAIN`, not through `localhost:80`
- `GetGroupBalancesResponse` has `simplifiedDebts` (not `balances`) and `memberBalances`
- `CreateSettlementBody` uses `paidTo` (not `toUserId`) for the recipient field
- `GetDashboardResponse` uses `totalOwe` (you owe others) and `totalOwed` (others owe you)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
