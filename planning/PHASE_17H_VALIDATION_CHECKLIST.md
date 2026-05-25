# Phase 17H Validation Checklist

## Purpose

Confirm Arc 17H roster lifecycle/readiness visibility is implemented as staff-scoped, read-only integration across existing operational surfaces, while preserving existing workflows and boundaries.

---

## 1. Scope Compliance

- [x] Dashboard includes roster lifecycle readiness context.
- [x] People list includes lifecycle/readiness summary cues.
- [x] Person detail includes lifecycle/roster readiness cues.
- [x] Team detail includes selected-season lifecycle/readiness summary cues.
- [x] Program detail includes selected-season lifecycle/readiness summary cues.
- [x] Existing lifecycle mutation workflows are unchanged.
- [x] Existing guardian maintenance workflows are unchanged.
- [x] No reporting pages added.
- [x] No messaging/notification behavior added.
- [x] No parent portal behavior added.
- [x] No payments/dues/billing behavior added.
- [x] No external integrations added.
- [x] No Prisma schema expansion required.

---

## 2. Authorization and Privacy

- [x] Uses existing organization scoping patterns (`getOrganizationScope` + scoped queries).
- [x] Uses existing staff-only visibility patterns (no new auth model).
- [x] Guardian readiness context remains staff-only.
- [x] No guardian/parent-facing lifecycle visibility added.
- [x] No exposure of private staff notes to guardians.

---

## 3. Readiness Signal Coverage

- [x] Lifecycle status counts (Active/Prospect/Inactive/Archived/Alumni) shown where useful.
- [x] Team selected-season roster lifecycle mix shown.
- [x] Program selected/current-season roster lifecycle mix shown.
- [x] Guardian readiness gaps shown where practical (existing + integrated summaries).
- [x] Active members with no roster membership shown where practical.
- [x] Safe empty states shown for zero-gap/zero-data scenarios.
- [x] Safe links point to existing people/team/program/guardian workflows.

---

## 4. Workflow Preservation

- [x] Join/activate workflows preserved.
- [x] Move workflows preserved.
- [x] Inactive/archive workflows preserved.
- [x] Season rollover workflows preserved.
- [x] Guardian relationship maintenance workflows preserved.
- [x] FieldOps behavior preserved.
- [x] GearOps behavior preserved.

---

## 5. Automated Validation

### Lint
```bash
npm run lint
```
Expected: No lint errors.

### Typecheck
```bash
npm run typecheck
```
Expected: No TypeScript errors.

### Build
```bash
npm run build
```
Expected: Build succeeds with Arc 17H surface updates.

### Prisma Validate
```bash
DATABASE_URL=<connection_string> ./node_modules/.bin/prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

---

## 6. Manual Verification

### Dashboard
- [ ] Open `/dashboard`.
- [ ] Confirm “Roster lifecycle readiness” section renders lifecycle mix counts.
- [ ] Confirm active-without-roster count renders.
- [ ] Confirm safe links to `/people`, `/teams`, and `/programs`.

### People list
- [ ] Open `/people`.
- [ ] Confirm readiness summary card renders lifecycle mix and active-without-roster count.
- [ ] Confirm table still shows per-person lifecycle status.

### Person detail
- [ ] Open `/people/[personId]` for an ACTIVE member without roster membership.
- [ ] Confirm readiness gap cue is shown.
- [ ] Open `/people/[personId]` for non-ACTIVE member with roster membership.
- [ ] Confirm lifecycle note is shown.
- [ ] Confirm roster empty state has safe link to move workflow.

### Team detail
- [ ] Open `/teams/[teamId]`.
- [ ] Confirm selected-season lifecycle mix summary renders.
- [ ] Confirm non-ACTIVE selected-season count renders.
- [ ] Confirm roster table “Member status” reflects actual lifecycle status.

### Program detail
- [ ] Open `/programs/[programId]`.
- [ ] Confirm readiness section shows selected/current season context, lifecycle mix, roster count, guardian gap count.

---

## 7. Arc 17H Closeout Sign-off

- [ ] Automated validation passes (`lint`, `typecheck`, `build`, `prisma validate`).
- [ ] Arc 17H scope constraints are met.
- [ ] Planning docs added:
  - [ ] `PHASE_17H_ROSTER_LIFECYCLE_READINESS_DASHBOARD.md`
  - [ ] `PHASE_17H_VALIDATION_CHECKLIST.md`
- [ ] `planning/README.md` updated with Arc 17H entries.
- [ ] PR submitted for review.
