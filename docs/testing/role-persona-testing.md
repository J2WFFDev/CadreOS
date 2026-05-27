# Role Persona Testing

## Purpose

This document describes the dev-only role/persona testing approach for CadreOS.
It enables developers and QA to exercise role-specific experiences without replacing
Clerk authentication or bypassing server-side permission checks.

---

## Design Constraints

1. **No bypass of server-side checks.** Persona testing works by seeding real
   `UserAccount`, `Person`, and `RoleAssignment` rows. Permission helpers always
   run against real database state. There is no mock injection into `requirePermission()`.

2. **Production disabled.** Both feature flags are blocked in production environments
   (see the guard in `lib/auth/index.ts`).

3. **Clerk stays active.** Persona testing does not replace Clerk. It provides seeded
   users that can be signed into via Clerk test credentials.

4. **No passwords stored.** Seeded personas use Clerk-managed test accounts, not
   local credentials.

---

## Environment Variables

Add to `.env.local` for local development only. **Never set these in production.**

```bash
# Enables persona seed validation and debug endpoints (dev only)
ENABLE_TEST_PERSONAS=true

# Logs role resolution decisions to console in server components and route handlers (dev only)
ENABLE_ROLE_DEBUG=true
```

Both variables are read via `isTestPersonasEnabled()` and `isRoleDebugEnabled()` in
`lib/auth/index.ts`. When `NODE_ENV=production`, both functions return `false` regardless
of the variable value.

---

## Persona Definitions

Each persona maps to a seeded `Person` + `RoleAssignment` set. Seed these via the
existing Prisma seed script (`prisma/seed.ts`) under a `seedTestPersonas()` block.

| Persona key | RoleType | ScopeType | Description |
|---|---|---|---|
| `org-admin` | `ORGANIZATION_ADMIN` | `ORGANIZATION` | Full access across all modules |
| `program-director` | `PROGRAM_DIRECTOR` | `PROGRAM` | Program-scoped staff access |
| `head-coach` | `COACH` | `TEAM` | Team-scoped; can create events, notes, tasks |
| `assistant-coach` | `ASSISTANT_COACH` | `TEAM` | Limited: attendance, notes, tasks |
| `guardian` | `PARENT_GUARDIAN` | — | No write access; read path deferred |
| `athlete` | `ATHLETE` | — | No access beyond own profile (deferred) |

---

## Usage Pattern

### Step 1 — Seed test personas

Run the seed script with the `TEST_PERSONAS` flag (when it is implemented):

```bash
SEED_TEST_PERSONAS=true npx tsx prisma/seed.ts
```

This creates `Person` rows and `RoleAssignment` rows for each persona.
Clerk test user accounts (from Clerk's test environment) are linked via `UserAccount.clerkUserId`.

### Step 2 — Sign in as a test persona

Use the Clerk test credentials for each persona. The `UserAccount` upsert in
`getOrganizationScope()` will link the Clerk session to the seeded `Person`
automatically on first sign-in.

### Step 3 — Enable debug output

With `ENABLE_ROLE_DEBUG=true`, server-component and route handler logs will include
role resolution decisions. Look for `[role-debug]` prefixed log lines.

---

## Role Debug Output

When `ENABLE_ROLE_DEBUG=true` is active, `getCurrentCadreUser()` emits a structured
console log on each call:

```
[role-debug] getCurrentCadreUser {
  clerkUserId: "user_abc123",
  userAccountId: "cma...",
  personId: "cmb...",
  organizationId: "cmc...",
  isLinked: true
}
```

This is server-side only and never reaches the browser.

---

## What is not bypassed

Even with test personas active, the following always run against real DB state:

- `requirePermission()` in `lib/permissions/index.ts`
- `resolveActorRoleContext()` in `lib/authorization/index.ts`
- All domain-specific authorization helpers (entry, workflow, guardian, gear)
- Organization isolation via `organizationId` filters

Persona testing validates that the **full permission stack** works correctly for each role,
not a mocked or simplified version.

---

## Extending Personas

To add a new persona:

1. Add an entry to the `TEST_PERSONAS` constant in `prisma/seed.ts`.
2. Assign a Clerk test user `userId` to the persona.
3. Re-run the seed script.

No code changes to `lib/auth/index.ts` are needed unless you want to add new
module-specific `canAccessModule()` checks for the role.

---

## Gaps and Next Steps

- [ ] Implement `seedTestPersonas()` in `prisma/seed.ts`
- [ ] Assign Clerk test user IDs to each persona (requires Clerk dev environment setup)
- [ ] Add a dev-only `/api/debug/role-context` endpoint gated by `ENABLE_ROLE_DEBUG`
- [ ] Guard all persona seed paths behind `NODE_ENV !== 'production'`
