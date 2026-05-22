# Phase 1A: Database Proof and Demo Seed Data

Phase 1A validates the CadreOS database foundation by proving the deployed app can:

- connect to Neon Postgres using Prisma
- seed a small demo dataset
- query and display real database-backed counts on the dashboard
- expose a safe DB health check endpoint at `/api/health/db`

## Required Environment Variable

- `DATABASE_URL` (set in Vercel Project Settings → Environment Variables)

## Validation Commands

- `npm run prisma:validate`
- `npm run prisma:generate`
- `npm run prisma:migrate`
- `npm run prisma:seed`
- `npm run typecheck`
- `npm run lint`
- `npx prisma validate`
