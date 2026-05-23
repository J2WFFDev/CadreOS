# FieldOps Developer Setup

This document describes how to set up and validate the FieldOps module locally.

---

## Prerequisites

- Node.js 20+
- A PostgreSQL database reachable via `DATABASE_URL`
- `.env` with `DATABASE_URL` set (copy from `.env.example`)

---

## 1. Install dependencies

```bash
npm install
```

The `postinstall` script runs `prisma generate` automatically. If you need to
regenerate the Prisma client manually at any time:

```bash
npm run prisma:generate
# or directly:
./node_modules/.bin/prisma generate
```

> **Note:** Use `./node_modules/.bin/prisma` (not `npx prisma`) to avoid pulling
> a newer Prisma version that may be incompatible with the pinned `^6.19.3`
> package.

---

## 2. Apply the schema to your local database

```bash
DATABASE_URL="<your-db-url>" ./node_modules/.bin/prisma db push
```

This pushes the current `prisma/schema.prisma` to your database without
creating migration files (suitable for local development and demo environments).

To use the full migration workflow instead:

```bash
DATABASE_URL="<your-db-url>" npm run prisma:migrate
```

---

## 3. Validate the Prisma schema

```bash
DATABASE_URL="<your-db-url>" ./node_modules/.bin/prisma validate
```

A successful run exits with no output and exit code 0.

---

## 4. Seed FieldOps demo data

The seed script is idempotent — it uses `upsert` throughout and is safe to
run multiple times.

```bash
DATABASE_URL="<your-db-url>" npm run prisma:seed
```

### What the seed creates

| Entity | ID | Description |
|---|---|---|
| Organization | `cadreos-demo-organization` | CadreOS Demo Organization |
| Program | (auto) | Demo Sports Program |
| Team | (auto) | Demo Team |
| Facility | `cadreos-demo-facility` | Demo Range Complex — Demo City, TX |
| Resource | `cadreos-demo-resource-bay-a` | Bay A — 25 yard range bay (ACTIVE) |
| Resource | `cadreos-demo-resource-bay-b` | Bay B — 50 yard range bay (ACTIVE) |
| Event | `cadreos-demo-event-range-block` | Demo Team Range Block — 2026-06-15 14:00–16:00 UTC |
| Booking | `cadreos-demo-booking-bay-a-range-block` | Bay A booked, status APPROVED, linked to seeded event |
| Booking | `cadreos-demo-booking-bay-b-open-session` | Bay B open session, status REQUESTED / approval PENDING |

> **Note:** The seed script must **not** run automatically during Vercel
> deploy, build, startup, or CI. It is a manual operator step.

---

## 5. Verify seeded data in the UI

After seeding, start the dev server:

```bash
npm run dev
```

Navigate to the following routes to confirm data is present:

| Route | Expected |
|---|---|
| `/field-ops` | Dashboard shows counts: 2 total requests, 1 pending approval, 1 approved, 1 upcoming approved |
| `/field-ops/facilities` | "Demo Range Complex" listed as ACTIVE |
| `/field-ops/facilities/<id>` | Facility detail shows city, state, and resource list |
| `/field-ops/resources` | Bay A and Bay B listed as ACTIVE |
| `/field-ops/resources/<id>` | Resource detail shows type, capacity, and facility link |
| `/field-ops/bookings` | Two seeded bookings listed |
| `/field-ops/bookings/<bay-a-booking-id>` | Booking detail shows APPROVED status, no pending approval actions |
| `/field-ops/bookings/<bay-b-booking-id>` | Booking detail shows REQUESTED status, PENDING approval, approve/deny actions visible |

---

## 6. Typecheck and lint

```bash
npm run typecheck
npm run lint
```

> There are pre-existing typecheck errors in `lib/workflows/index.ts` and
> `middleware.ts` (implicit `any` types from Zod v4 and Clerk type resolution)
> that are not introduced by FieldOps changes. These are tracked separately.

---

## 7. Build

```bash
npm run build
```

---

## Organization scoping

All FieldOps queries are scoped by `organizationId` derived from
`getOrganizationScope()` in `lib/organization-context.ts`. No FieldOps data
is ever accessible across organization boundaries.

---

## Key source files

| File | Purpose |
|---|---|
| `prisma/schema.prisma` | `Facility`, `FacilityResource`, `ResourceBooking`, `BookingConflict` models and enums |
| `prisma/seed.mjs` | Demo data seeding for FieldOps facilities, resources, and bookings |
| `lib/field-ops-booking-precheck.ts` | Stateless precheck evaluation logic |
| `lib/field-ops.ts` | Shared formatting helpers |
| `lib/workflows/index.ts` | `bookingRequestWorkflowSchema` — Zod validation for booking create form |
| `lib/permissions/index.ts` | `booking.create`, `booking.approve`, `booking.deny` permission rules |
| `app/(dashboard)/field-ops/` | All FieldOps UI routes |
| `app/(dashboard)/field-ops/bookings/create/route.ts` | Booking create server action |
| `app/(dashboard)/field-ops/bookings/[bookingId]/decision/route.ts` | Approval/denial server action |
