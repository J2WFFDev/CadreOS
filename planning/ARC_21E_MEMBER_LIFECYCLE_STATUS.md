# Arc 21E — Member Lifecycle Status

## Purpose

Arc 21E formalizes lifecycle status handling for MemberOps so CadreOS can safely distinguish:

- Active
- Pending
- Inactive
- Archived
- Graduated
- Transferred
- Incomplete

This arc remains additive and compatibility-first. It does not introduce destructive schema rewrites, route renames, or broad onboarding/offboarding automation.

## Arc 21A–21D Baseline Confirmed

- Arc 21A inventory confirmed lifecycle state exists on `Person.lifecycleStatus`.
- Arc 21B locked MemberOps boundaries: Person identity vs membership (`RosterMembership`) vs role (`RoleAssignment`).
- Arc 21C established guardian readiness and relationship diagnostics.
- Arc 21D established season/team assignment readiness and roster completeness filtering.

## Lifecycle Status Model (Arc 21E Canonical)

### Person status (identity lifecycle)

`Person.lifecycleStatus` remains the canonical persisted lifecycle field:

- `PROSPECT` → **Pending**
- `ACTIVE` → **Active**
- `INACTIVE` → **Inactive**
- `ARCHIVED` → **Archived**
- `ALUMNI` → **Graduated**

### Member status (business-language lifecycle)

Member status is a business label over person + participation context:

- **Pending**: person exists but setup/participation is not fully complete yet.
- **Active**: currently participating.
- **Inactive**: retained but not currently participating.
- **Archived**: retained and hidden from default operational roster views.
- **Graduated**: completed participation eligibility.
- **Transferred**: represented operationally as inactive/non-current assignment context today (explicit transfer workflow deferred).
- **Incomplete**: readiness signals indicate missing data (for example missing matching role assignment, pending guardian support, or pending lifecycle setup).

### Membership / assignment status

Assignment status remains derived from `RosterMembership` + matching team `RoleAssignment`:

- **Complete assignment**: roster role has matching team role assignment.
- **Incomplete assignment**: roster role is missing matching team role assignment.

### Role/profile readiness

Readiness remains additive and non-destructive:

- guardian relationship readiness (Arc 21C)
- assignment completeness (Arc 21D)
- pending lifecycle + missing readiness indicators (Arc 21E filtering)

### Roster visibility

Roster is an operational view over memberships:

- default roster visibility now emphasizes active operations (Active + Pending)
- inactive/archived/graduated rows remain available through explicit filters
- historical records remain preserved

## Arc 21E Implementation Summary

1. Lifecycle labels aligned to MemberOps language:
   - Prospect → Pending
   - Alumni → Graduated
2. Added shared default roster visibility helper:
   - default visible lifecycle statuses = Active + Pending
3. Program roster view hardened:
   - default participation filter now excludes inactive/archived/graduated
   - explicit Participation status filter supports:
     - default operational view
     - all statuses
     - individual lifecycle statuses
4. Team roster view hardened:
   - added lifecycle status filter lane with:
     - default operational view (Active + Pending)
     - all statuses
     - per-status filters
     - incomplete/missing readiness filter
   - default roster list excludes inactive/archived/graduated rows
5. Low-risk UI copy alignment:
   - lifecycle labels on people/program/team/person surfaces now use Pending/Graduated terminology
   - lifecycle transition route messaging updated to Pending/Graduated wording

## Safety and Compatibility Notes

- No Prisma schema enum changes in Arc 21E.
- No destructive migration introduced.
- Existing member, guardian, roster, team, program, season, and auth flows remain in place.
- Guardian-athlete links remain intact across lifecycle transitions.
- Roster/role changes remain non-destructive to historical references.

## Manual QA Checklist (Arc 21E)

- [ ] Create or identify an Active member and verify they appear in default roster views.
- [ ] Identify a Pending member and verify they appear in default roster views.
- [ ] Identify an Incomplete member using team “Incomplete / missing readiness data” filter.
- [ ] Change a member to Inactive (where supported) and verify status change succeeds.
- [ ] Verify Inactive member is hidden from default roster view.
- [ ] Verify Archived member is hidden from default roster view.
- [ ] Verify Inactive/Archived member remains historically available via explicit filters.
- [ ] Verify program roster Participation status filter supports default, all, and specific statuses.
- [ ] Verify team roster lifecycle filter supports default, all, specific statuses, and incomplete view.
- [ ] Verify guardian links are preserved when athlete lifecycle changes.
- [ ] Verify coach/staff role access and scoped visibility still function.
- [ ] Run `npm run lint && npm run typecheck && npm run test && npm run build`.
- [ ] Run `DATABASE_URL=... ./node_modules/.bin/prisma validate`.

## Deferred Scope (Intentional)

- full onboarding workflow
- offboarding workflow
- graduation workflow automation
- transfer workflow automation
- season rollover automation
- guardian invitation portal
- bulk roster import
- communications triggered by lifecycle changes

## Recommended Arc 21F — Roster Views, Filters, and Readiness Dashboard

Arc 21F should build on Arc 21E by:

1. unifying roster/member filter UX across people, team, and program surfaces
2. adding readiness dashboard tiles for pending/incomplete/transferred-focused operational follow-up
3. adding explicit transferred-state workflow semantics and reporting
4. adding lifecycle/status trend reporting across seasons and teams
5. adding focused regression coverage for lifecycle filters across roster views
