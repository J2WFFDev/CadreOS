# CadreOS Authentication and Authorization Architecture

## Overview

CadreOS uses a clean two-layer model: **Clerk owns authentication** and **CadreOS owns authorization**.
Neither layer duplicates the other, and no passwords are stored.

---

## Layer 1 — Clerk (Authentication)

Clerk is the sole identity provider.

| Responsibility | Owner | Notes |
|---|---|---|
| Login / logout / session | Clerk | `clerkMiddleware` in `middleware.ts` |
| Identity (`userId`) | Clerk | Opaque string, sourced via `auth()` |
| External user ID | Clerk | Used as `clerkUserId` throughout |
| Email / display name sync | Clerk | Not stored in CadreOS DB |
| Session validity | Clerk | Validated on every dashboard route |

### Where Clerk userId is read

1. **`lib/auth/index.ts` — `getClerkAuthContext()`**
   `const { userId, orgId } = await auth()` — the entry point for every server-side auth call.

2. **`lib/organization-context.ts` — `getOrganizationScope()`**
   Uses `authContext.clerkUserId` to upsert a `UserAccount` row and resolve the active organization.

3. **`lib/permissions/index.ts` — `resolvePermissionDecision()`**
   Queries `UserAccount` by `clerkUserId` to find `personId` before evaluating role assignments.

4. **`lib/user-account.ts` — `resolveActorPersonId()`**
   Looks up `UserAccount.personId` by `clerkUserId` to attribute actions to a person.

5. **`app/(dashboard)/account/**` routes**
   Bootstrap admin and link-person flows consume `clerkUserId` from `requireAuthContext()`.

### Middleware protection

`middleware.ts` uses `createRouteMatcher` to protect all dashboard-family routes:
`/dashboard`, `/programs`, `/people`, `/teams`, `/events`, `/notes`, `/tasks`, `/account`.
Routes not in this list (e.g., `/field-ops`, `/gear-ops`, module API routes) rely on
route-handler-level auth checks instead of middleware.

---

## Layer 2 — CadreOS (Authorization)

CadreOS owns every post-authentication access decision.

### Local data model

| Model | Role |
|---|---|
| `UserAccount` | Maps `clerkUserId` → organization + optional `personId` |
| `Person` | The canonical CadreOS member record |
| `RoleAssignment` | `personId` + `roleType` + `scopeType` + optional `programId`/`teamId` |
| `AthleteGuardianRelationship` | Links guardian persons to athlete persons |
| `RosterMembership` | Team membership for roster-level scoping |

### Clerk userId → CadreOS person mapping

```
Clerk session
  └─ clerkUserId (via auth())
       └─ UserAccount.clerkUserId (unique)
            └─ UserAccount.personId (nullable — unlinked until /account/link-person)
                 └─ Person record (firstName, lastName, email, lifecycle)
                      └─ RoleAssignment[] (roleType, scopeType, programId?, teamId?)
```

A `UserAccount` is upserted automatically on every page load via `getOrganizationScope()`.
A user without a linked `personId` can authenticate but cannot perform any write action.

### RoleType hierarchy

| RoleType | Scope | Staff? | Write access |
|---|---|---|---|
| `ORGANIZATION_ADMIN` | ORG | ✓ | Full |
| `PROGRAM_DIRECTOR` | ORG / PROGRAM | ✓ | Program-wide |
| `COACH` | ORG / PROGRAM / TEAM | ✓ | Team-wide |
| `ASSISTANT_COACH` | TEAM | ✓ | Limited (notes, tasks, attendance) |
| `PARENT_GUARDIAN` | — | ✗ | None (read path deferred) |
| `ATHLETE` | — | ✗ | None (read path deferred) |

`ScopeType`: `ORGANIZATION` | `PROGRAM` | `TEAM`

### Authorization enforcement layers

| Layer | Mechanism | Files | Coverage |
|---|---|---|---|
| **Middleware** | `clerkMiddleware` + `auth.protect()` | `middleware.ts` | Dashboard route families only |
| **Route handler** | `requirePermission()` / `canPerformAction()` | `lib/permissions/index.ts` | Mutating API routes (entries, events, notes, tasks, bookings, gear, etc.) |
| **Server component** | `getOrganizationScope()` → `auth.unresolvedPersonLink` | `lib/organization-context.ts` + page components | UI gating for unlinked accounts |
| **Read path helper** | `resolveActorRoleContext()` + `canRead*()` helpers | `lib/authorization/index.ts` | Note/task/entry visibility, team-scoped reads |
| **Domain helper** | `resolveEntryAccess()`, `resolveWorkflowAccess()` | `lib/operational-entry/authorization.ts`, `lib/operational-workflow/authorization.ts` | Entry and workflow module access |
| **Guardian helper** | `resolveGuardianRelationshipAccess()` | `lib/guardian-relationship-access.ts` | Staff-only guardian diagnostics |
| **Database** | Prisma `organizationId` filters on every query | All route handlers | Implicit data isolation by org |

### Key helpers

| Helper | Location | Purpose |
|---|---|---|
| `requireAuthContext()` | `lib/auth/index.ts` | Returns `clerkUserId` + `orgId`; throws if unauthenticated |
| `requireOrganizationContext()` | `lib/auth/index.ts` | Alias of `requireAuthContext()` |
| `getOrganizationScope()` | `lib/organization-context.ts` | Full org + auth state; upserts UserAccount |
| `requirePermission(input)` | `lib/permissions/index.ts` | Server-side permission gate; throws `PermissionDeniedError` |
| `canPerformAction(input)` | `lib/permissions/index.ts` | Returns boolean permission check |
| `resolveActorPersonId()` | `lib/user-account.ts` | Resolves personId for action attribution |
| `resolveActorRoleContext()` | `lib/authorization/index.ts` | Single-query role context for read-path helpers |
| `getCurrentCadreUser()` | `lib/auth/index.ts` | Full CadreOS user context (Clerk + UserAccount + personId) |
| `requireMembership()` | `lib/auth/index.ts` | Throws if account not linked to a person |
| `canAccessModule()` | `lib/auth/index.ts` | Boolean module-level access check by role |

---

## Gaps and Observations

### Middleware coverage gap
`/field-ops`, `/gear-ops`, and several module API routes under `/api/` are **not** in the
`isDashboardRoute` matcher. They are protected only at the route-handler level.
This is acceptable now but should be reviewed as the route surface grows.

### Guardian / athlete read path deferred
`PARENT_GUARDIAN` and `ATHLETE` role types have no write permissions and no implemented
read access gates. `AthleteGuardianRelationship` is modeled but not yet enforced in read
queries. The planning doc `PHASE_9D_ENTRY_VISIBILITY_ACCESS_POLICY.md` tracks this.

### Authorization is server-enforced, not UI-only
All write paths call `requirePermission()` or domain-specific authorization helpers before
touching the database. UI-level gating (e.g., hiding buttons based on `canPerformAction`)
is additive UX, not the sole gate.

### No custom auth / no password storage
CadreOS does not store passwords, issue tokens, or implement session management.
Clerk handles all of this. The `LOCAL_UNCONFIGURED_AUTH_CONTEXT` fallback in `lib/auth/index.ts`
is a development-only zero-access default, not a bypass.

---

## Next implementation arc

1. **Extend middleware** to cover `/field-ops`, `/gear-ops`, and `/api/` route families.
2. **Guardian read path** — implement `PARENT_GUARDIAN` read gates using `AthleteGuardianRelationship`.
3. **`canAccessModule()`** — use to gate entire module sections per role (see `lib/auth/index.ts`).
4. **Role persona testing** — see `docs/testing/role-persona-testing.md`.
