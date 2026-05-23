# Phase 4B: Clerk Provider Setup

## Goal
- Establish Clerk as the authentication provider foundation for App Router.
- Protect dashboard routes with authentication redirects.
- Keep current business workflows and mock-dependent attribution behavior stable.

## Scope Delivered in 4B
- Add `@clerk/nextjs` dependency.
- Add Clerk environment variable placeholders to `.env.example`.
- Wrap app root with `ClerkProvider`.
- Add Clerk hosted route entry points:
  - `/sign-in/[[...sign-in]]`
  - `/sign-up/[[...sign-up]]`
- Protect dashboard route families in middleware:
  - `/dashboard`
  - `/programs`
  - `/people`
  - `/teams`
  - `/events`
  - `/notes`
  - `/tasks`
- Update auth context helpers to return real Clerk `userId` when available, with conservative fallback when Clerk is not configured.

## Explicit Non-Scope
- Full role authorization enforcement.
- UserAccount linking automation and linking UX.
- Prisma schema changes.
- New product workflows.

## Required Environment Variables (Vercel + Local)
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`

## Manual Clerk Setup Steps
1. Create or open a Clerk application for CadreOS.
2. In Clerk dashboard, configure allowed redirect URLs for local and production domains.
3. Copy the publishable key and secret key into local `.env.local` and Vercel project environment variables.
4. Configure sign-in and sign-up paths in Clerk to match:
   - Sign in: `/sign-in`
   - Sign up: `/sign-up`
5. Configure post-auth redirects:
   - After sign-in: `/dashboard`
   - After sign-up: `/dashboard`
6. In Vercel, redeploy after setting env vars so middleware and server auth contexts use live Clerk configuration.

## Notes for Next Phase
- Phase 4C should implement first-login `UserAccount` upsert/linking and reduce fallback identity assumptions.
- Phase 4D+ should tighten unauthenticated handling in route handlers and enforce authorization checks in permission helpers.
