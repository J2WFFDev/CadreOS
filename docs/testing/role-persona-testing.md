# Role Persona Testing

## Purpose

CadreOS supports a dev-only persona override so developers can test role-based navigation and app-level access quickly without creating or switching Clerk accounts.

Clerk remains the production authentication source. This feature is only for local/dev and explicitly guarded.

## Enable dev personas

Set these values in `.env.local`:

```bash
NEXT_PUBLIC_ENABLE_DEV_PERSONAS=true
ENABLE_DEV_PERSONAS_IN_PRODUCTION=false
```

Guard behavior:

- `NEXT_PUBLIC_ENABLE_DEV_PERSONAS` must be `true`
- Production defaults to disabled
- Production only enables if `ENABLE_DEV_PERSONAS_IN_PRODUCTION=true` is explicitly set

### Enabling on a Vercel production deployment

Both variables are required. A redeploy is needed after changing either one:

```bash
NEXT_PUBLIC_ENABLE_DEV_PERSONAS=true
ENABLE_DEV_PERSONAS_IN_PRODUCTION=true
```

With only `NEXT_PUBLIC_ENABLE_DEV_PERSONAS=true` set, the switcher will not appear.
The dashboard header will show a **Dev Persona: blocked** badge as a diagnostic indicator.
Call `getDevPersonaFeatureStatus()` (from `lib/auth/devPersonas.ts`) to get a structured
status object with `nextPublicEnabled`, `productionOverrideEnabled`, `nodeEnv`, `enabled`,
and `reason` fields.

> **Warning:** Only enable `ENABLE_DEV_PERSONAS_IN_PRODUCTION=true` while the app is private
> or in a controlled testing deployment. This feature bypasses real Clerk authentication and
> must never be left enabled on a public-facing production instance.

## How to switch personas

1. Start the app in development mode.
2. Sign in normally with Clerk (or use your current local auth flow).
3. In the dashboard header, open **Dev Persona**.
4. Pick one persona:
   - Admin
   - Program Manager
   - Coach
   - Assistant Coach
   - Guardian
   - Athlete
   - Limited Viewer
5. The selection is stored in a cookie and applied on refresh.

## Current user resolution order

`getCurrentUser()` resolves in this order:

1. Selected dev persona (when dev personas are enabled)
2. Clerk-authenticated user mapped into normalized `CurrentUser`
3. `null` when unauthenticated

## Authorization scope

This feature is for app-level role simulation and fast QA.

- Navigation visibility uses normalized role checks.
- Key dashboard modules use server layout guards to block direct URL access.
- Existing Clerk-based auth and server permission checks still run when dev personas are disabled.

## NAV-006

Run `docs/testing/role-navigation-tests.md` for the NAV-006 role navigation matrix.

## Security warning

Dev personas are not a production authorization mechanism. Keep production disabled by default and do not treat persona selection as a replacement for real server-side authorization.
