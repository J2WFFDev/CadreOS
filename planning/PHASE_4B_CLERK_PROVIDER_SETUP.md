# Phase 4B: Clerk Provider Setup

## Goal
- Add Clerk as the MVP authentication provider.
- Protect dashboard routes and existing mutation handlers behind authenticated sessions.
- Keep current business workflows intact while account-linking and authorization remain deferred.

## Scope
- Add `@clerk/nextjs`.
- Wrap the App Router root layout with `ClerkProvider`.
- Add embedded Clerk sign-in and sign-up routes.
- Protect non-public routes with Clerk middleware.
- Return real Clerk `userId` from app auth context when available.
- Keep organization resolution conservative until UserAccount linking is implemented.

## Environment Variables
- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL`

## Vercel Setup
1. Add all Clerk environment variables above to the Vercel project for Production, Preview, and Development.
2. Keep `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in`.
3. Keep `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up`.
4. Set `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard`.
5. Set `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard`.
6. Keep `DATABASE_URL` pointed at the active Postgres database.

## Manual Clerk Setup
1. Create or open the CadreOS application in Clerk.
2. Enable the Next.js App Router integration for the application.
3. Copy the publishable key into `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`.
4. Copy the secret key into `CLERK_SECRET_KEY`.
5. Configure the allowed redirect URLs for local development and deployed Vercel domains.
6. Confirm the application uses `/sign-in` and `/sign-up` for embedded auth pages.
7. Confirm post-auth redirects land on `/dashboard`.

## Behavior in Phase 4B
- `/` remains public.
- `/sign-in/[[...sign-in]]` and `/sign-up/[[...sign-up]]` render Clerk embedded pages.
- Dashboard pages and existing non-public route handlers require an authenticated Clerk session.
- `requireAuthContext()` now returns the live Clerk user id.
- Organization selection still depends on existing app data until Phase 4C/4D account-linking work is complete.

## Explicit Non-Scope
- No role authorization enforcement yet.
- No `UserAccount` upsert or person-linking flow yet.
- No Prisma schema changes.
- No new product workflows.

## Follow-on Work
- Phase 4C: first-login `UserAccount` upsert and person-link resolution.
- Phase 4D: tighten route protection and remove remaining mock-era fallback messaging.
- Phase 4E: add real permission checks in centralized workflow enforcement.
