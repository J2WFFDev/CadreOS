# Phase 4D: Route Protection and Auth Cleanup

## Goal

Make authentication, redirects, linked-account handling, and route protection consistent before
implementing full authorization. No role-based authorization is enforced in this phase.

---

## Scope Delivered

### 1. Clerk Route Protection Review

**`middleware.ts`** uses `clerkMiddleware` with `createRouteMatcher` to protect the full
dashboard route family:

| Route pattern | Protected? |
|---|---|
| `/dashboard(.*)` | ✓ |
| `/programs(.*)` | ✓ |
| `/people(.*)` | ✓ |
| `/teams(.*)` | ✓ |
| `/events(.*)` | ✓ |
| `/notes(.*)` | ✓ |
| `/tasks(.*)` | ✓ |
| `/account(.*)` | ✓ |

**Public routes** are not matched by the dashboard route matcher and remain open:

| Route | Public? |
|---|---|
| `/` | ✓ |
| `/sign-in` | ✓ |
| `/sign-up` | ✓ |

Unauthenticated access to any protected route triggers `auth.protect()`, which redirects to
the Clerk-hosted or custom sign-in page at `NEXT_PUBLIC_CLERK_SIGN_IN_URL`.

---

### 2. Redirect Behavior

#### Env var update

`.env.example` has been updated to use the current Clerk v5+ redirect env var names:

| Old (deprecated) | New (Clerk v5+) |
|---|---|
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL` | `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` |
| `NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL` | `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` |

Both are set to `/dashboard` in `.env.example`.

#### Confirmed behavior

- Signed-out access to protected routes → Clerk redirects to `/sign-in`.
- Successful sign-in → Clerk redirects to `/dashboard` (via `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`).
- Successful sign-up → Clerk redirects to `/dashboard` (via `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL`).

#### Remaining Clerk redirect limitations

- `auth.protect()` uses `NEXT_PUBLIC_CLERK_SIGN_IN_URL` for the unauthenticated redirect target.
  If that env var is not set in the deployed environment, Clerk falls back to its hosted sign-in page.
- Post-sign-in redirect destination is `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL`, not
  `NEXT_PUBLIC_CLERK_SIGN_IN_FORCE_REDIRECT_URL`. Deep-link return-to-URL preservation is not
  yet implemented; users always land on `/dashboard` after sign-in.
- Clerk's `auth.protect()` redirect does not preserve the originally-requested URL as a
  `redirect_url` query param. If deep-link return is needed, the middleware must be updated to
  pass `{ returnBackUrl: request.url }` to `auth.protect()`.

---

### 3. Unlinked Account Handling

- Dashboard layout (`app/(dashboard)/layout.tsx`) calls `getOrganizationScope()` and checks
  `scope.auth.unresolvedPersonLink`.
- If `true`, an amber warning banner is shown on every dashboard page directing the user to
  `/account/link-person`.
- The header now includes a direct **Account** link alongside `UserButton` for quick access.
- `/account` shows: Clerk user id, email, UserAccount id, linked person (if resolved), active
  organization, and a fallback-org warning when applicable.
- `/account/link-person` allows the signed-in user to select a Person from the active
  organization and save the link to `UserAccount.personId`.
- No page is blocked for unlinked users in this phase. The unresolved state is visible but
  not enforced.

---

### 4. Mutation Route Auth Hardening

All POST route handlers in `app/(dashboard)/**/route.ts` call `getOrganizationScope()` and
guard against:

- `!scope.databaseReady` → redirect with error message (no silent 500)
- `!scope.organizationId` → redirect with error message

Routes that perform actor attribution (`events/create`, `notes/create`, `events/[eventId]/attendance`)
use `resolveActorPersonId()` from `lib/user-account.ts` and return a redirect error if no
actor person can be resolved.

All create/update mutations also call `requirePhase1CMutationPermission()`, which is a
centralized stub for future policy enforcement. It currently calls `requireAuthContext()` but
defers all enforcement to a later phase.

---

### 5. Fallback Behavior (Documented)

#### Organization context fallback (`lib/organization-context.ts`)

When no explicit Clerk org context is available (Clerk Organizations not in use), the app
falls back to the first organization in the database by creation date. This is marked with a
clear comment and surfaced as `scope.auth.usesFallbackOrganization = true`.

The `/account` page shows `"Fallback to first organization"` when this path is taken.

#### Actor attribution fallback (`lib/user-account.ts`)

`resolveActorPersonId()` resolves actor person in this order:

1. `preferredPersonId` (from `scope.auth.personId` via linked `UserAccount.personId`)
2. First `ORGANIZATION_ADMIN` role assignment in the organization
3. First person in the organization by creation date ← MVP fallback, documented with comment

Both fallback steps are labeled with comments noting they should be removed once
user-account linking is required for mutations.

---

### 6. Account Routes

`/account` displays:

- Clerk user id
- Email address (from `currentUser()`)
- UserAccount id
- Linked Person (name, id, email) — or prompt to link
- Active organization name and id
- Organization resolution mode (explicit or fallback)

`/account/link-person` allows:

- Viewing currently linked person
- Selecting a new Person from a dropdown scoped to the active organization
- Submitting to `/account/link-person/update` (POST route) which updates `UserAccount.personId`
- Error feedback via `?error=` search param redirect on failure

---

### 7. Dashboard/Header

- Header now shows a direct **Account** link next to `UserButton`.
- Unresolved-link amber banner appears in the main content area on all dashboard pages.
- Nav sidebar retains `Account` as a named link.

---

## Remaining Conservative Fallbacks

| Fallback | Location | When to Remove |
|---|---|---|
| First-org fallback | `lib/organization-context.ts` | When Clerk Organizations context is enforced |
| Admin role attribution fallback | `lib/user-account.ts` | When UserAccount linking is required for mutations |
| First-person attribution fallback | `lib/user-account.ts` | Same as above |
| No blocking on unlinked users | `app/(dashboard)/layout.tsx` | When Phase 5 authorization is introduced |

---

## Known Limitations

1. **No deep-link return after sign-in.** Users always land on `/dashboard` after authenticating,
   regardless of the page they originally tried to access.
2. **No Clerk Organizations context.** Organization resolution always uses the first-org fallback.
   Multi-org support requires Clerk Organizations enablement and passing `orgId` from `auth()`.
3. **No role-based authorization.** `requirePhase1CMutationPermission()` is a stub. Any
   authenticated user can perform any mutation.
4. **Unlinked users are not blocked.** Unlinked users can still create records; attribution
   falls back through admin/first-person. This is intentional for MVP continuity.
5. **Parent/guardian access is not scoped.** `PARENT_GUARDIAN`-role users have the same app
   access as any other signed-in user. Scoping is deferred to the authorization phase.

---

## Next Phase Authorization Work (Phase 5)

- Enforce `requirePhase1CMutationPermission()` based on `UserAccount.personId` and linked role assignments.
- Block unlinked users from mutations or redirect them to `/account/link-person`.
- Scope parent/guardian users to their linked athletes only.
- Filter `ObservationNote` records with `visibility: STAFF_ONLY` from guardian-role sessions.
- Consider Clerk Organizations for explicit multi-org routing.
- Add deep-link return-to-URL support in the sign-in redirect flow.
