# Phase 5B — Bootstrap Organization Admin Setup

## Why Bootstrap Exists

During MVP pilot setup, a signed-in and linked user can reach protected CadreOS pages but still be unable to perform role-management actions because no `ORGANIZATION_ADMIN` assignment exists yet. This creates a setup deadlock: only an Organization Admin can assign roles, but no Organization Admin exists.

Phase 5B adds a one-time bootstrap path so the first Organization Admin can be established safely for an organization.

## Eligibility Rules

Bootstrap is allowed only when **all** of the following are true:

1. User is signed in.
2. A `UserAccount` row exists for the signed-in user.
3. The `UserAccount` is linked to a `Person`.
4. An active organization context exists.
5. The active organization has zero `RoleAssignment` rows with:
   - `roleType = ORGANIZATION_ADMIN`
   - `scopeType = ORGANIZATION`
6. The linked `Person` belongs to the active organization.

If any rule fails, bootstrap is denied.

## Bootstrap Behavior

When eligible, `/account/bootstrap-admin` shows:

- Setup-only warning and context.
- Explicit user action button: **Make me Organization Admin**.

On submit, CadreOS creates exactly this role assignment shape:

- `personId = linked Person`
- `roleType = ORGANIZATION_ADMIN`
- `scopeType = ORGANIZATION`
- `organizationId = active organization`
- `programId = null`
- `teamId = null`

The create step re-checks admin existence and person membership in a serializable transaction to reduce race-condition risk during concurrent setup attempts.

## Ineligible Behavior

- If an Organization Admin already exists, bootstrap is blocked and the user is told to contact an existing Organization Admin for role assignment.
- If the signed-in account is unlinked, the user is directed to `/account/link-person`.
- If organization context or database availability is missing, bootstrap remains unavailable and no role is created.

## Security Limitations and Constraints

- Bootstrap does **not** replace normal authorization checks and does not grant broad bypass access.
- Bootstrap can run only while organization admin count is zero.
- Parent/guardian users do not receive special-case bypass behavior; eligibility is strictly based on linked person + zero-admin setup state.
- Clerk Organizations are not used for authorization decisions.
- No automatic seeding is triggered.

## MVP-Only / Setup-Only Scope

This is intentionally a narrow setup path for MVP onboarding and pilot unblock, not a full admin-management surface.

After the first Organization Admin exists, bootstrap should remain denied permanently for that organization, and all future role changes should flow through standard role assignment workflows.

## Future Evolution

Later phases should evolve this into a stronger onboarding/admin-establishment model, for example:

- Invitation-based first-admin approval with auditable claims.
- Out-of-band owner verification for production orgs.
- Explicit onboarding states and admin setup completion markers.
- Improved observability/audit events around privileged bootstrap attempts.
