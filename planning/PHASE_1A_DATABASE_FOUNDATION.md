# Phase 1A: Database Proof and Demo Seed Data

Phase 1A validates the CadreOS database foundation by proving the deployed app can:

- connect to Neon Postgres using Prisma
- seed a small demo dataset
- query and display real database-backed counts on the dashboard
- expose a safe DB health check endpoint at `/api/health/db`

## Seed Strategy (Controlled / Manual)

- Prisma seed is provided for **manual, controlled** proof/demo setup.
- Seed is **not** wired to run automatically during Vercel build or every deployment.
- Seed is **idempotent** and safe to re-run without creating duplicate demo organization, program, season,
  team, people, role assignments, guardian relationship, or athlete roster membership.

## Required Environment Variable

- `DATABASE_URL` (set in Vercel Project Settings → Environment Variables)

## Demo Seed Hierarchy and Role Mapping

- Organization: **CadreOS Demo Organization**
- Program: **Demo Sports Program**
- Program leadership:
  - Sonny Weaver → `ORGANIZATION_ADMIN` at organization scope
  - Richard East → `PROGRAM_DIRECTOR` at program scope
  - Ed Davis → `COACH` at program scope
- Season: **2026 Season**
- Team: **Demo Team**
- Team participants:
  - Casey Coach → `COACH` at team scope
  - Avery Athlete → `ATHLETE` at team scope
  - Morgan Guardian → `PARENT_GUARDIAN` at organization scope
  - Vicky Vol → `ASSISTANT_COACH` at team scope (placeholder until a future dedicated Volunteer role exists)
- Relationship:
  - Morgan Guardian linked to Avery Athlete as `GUARDIAN`
- Roster:
  - Avery Athlete added to Demo Team for 2026 Season with roster role `ATHLETE`

## Validation Commands

- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:seed`
- `npm run typecheck`
- `npm run lint`
- `npx prisma validate`
