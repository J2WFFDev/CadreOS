# Phase 4B: Clerk Provider Setup

## Goal
- Add the minimum Clerk wiring needed to protect dashboard routes and establish real authenticated identity.
- Keep current dashboard workflows functional while broader authorization and account-linking work remains deferred.

## Implemented Scope
- Added `@clerk/nextjs`.
- Wrapped the root app tree with `ClerkProvider`.
- Added Clerk App Router routes:
  - `/sign-in/[[...sign-in]]`
  - `/sign-up/[[...sign-up]]`
- Added Clerk middleware protection for dashboard route families:
  - `/dashboard`
  - `/teams`
  - `/events`
  - `/tasks`
  - `/programs`
  - `/notes`
  - `/people`
- Updated `lib/auth` so authenticated requests return the real Clerk `userId` and active Clerk `orgId` when present.
- Kept app business-context fallbacks conservative by leaving existing organization and actor-person fallback resolution in place.

## Required Environment Variables

### Local and Vercel
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`

## Manual Clerk Setup Steps
1. Create or open the CadreOS Clerk application.
2. Copy the publishable key into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
3. Copy the secret key into `CLERK_SECRET_KEY`.
4. In Clerk, configure the application URLs for local and Vercel environments.
5. Set the sign-in URL to `/sign-in`.
6. Set the sign-up URL to `/sign-up`.
7. Set the post-sign-in redirect URL to `/dashboard`.
8. Set the post-sign-up redirect URL to `/dashboard`.
9. Add the same values to the Vercel project environment variables for Preview and Production.
10. Redeploy after Vercel environment variables are saved.

## Current Behavior
- The marketing landing page remains public.
- Dashboard route families now require an authenticated Clerk session.
- Unauthenticated dashboard access is redirected to sign-in.
- Existing mutation flows continue to rely on current workflow permission placeholders and person-attribution fallbacks.

## Explicit Non-Scope
- No role-based authorization enforcement yet.
- No `UserAccount` linking or upsert flow yet.
- No Prisma schema changes.
- No new product workflows.

## Known Limitations
- Organization selection still falls back to existing app-side logic when a Clerk organization is not yet mapped to CadreOS data.
- Authenticated users without a linked `UserAccount.personId` still rely on existing fallback actor attribution.
- Authorization remains permissive beyond the new authentication gate until later Phase 4 work lands.
