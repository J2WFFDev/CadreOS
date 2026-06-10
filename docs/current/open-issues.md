# Current Open Issues

Only issues explicitly documented in repository docs are listed here. This is
not a claim that every issue is reproducible in current code.

## EntryOps

- Generic Entry archive/restore policy is not settled; generic restore remains
  deferred, and owner/assignee archive rights need a product decision.
- Inbox routing cleanup for stale or unavailable routing rows remains deferred.
- Dependent-athlete Quick Capture assignment for guardians remains deferred.
- Owner/Creator/Author/Assignee terminology is not yet normalized across
  EntryOps and Journal surfaces.
- Relationship semantics can duplicate or drift across `EntryLink`,
  `EntryObjectLink`, `OperationalRelationship`, parent links, and follow-up
  relationships.
- Relationship direction labels and generic graph read visibility need
  normalization and stronger test coverage.
Sources: [`Arc 24D.8X-N`](../planning/arc-24d-8x-n-owner-assignee-lifecycle-controls.md),
[`Arc 24D.8X-O`](../planning/arc-24d-8x-o-fix-inbox-lists-owner-visibility.md),
and [`Arc 24D.9A`](../planning/arc-24d-9a-entry-relationships-foundation-audit.md).

## EntryOps Policy Boundaries To Preserve

- Program/Team list placement must not grant Entry visibility or assignment.
- Guardian-related Athlete list visibility must not expose unrelated members.
- Habit check-ins and Habit activity remain history/activity unless explicitly
  modeled as Entries or work objects.
- Additional Today redesign/integration is future roadmap work, not an implied
  part of current All Entries behavior.

## MemberOps

- Arc 24C documents role taxonomy, athlete-role hard-block, scope-driven role
  picker, guardian-derived visibility, duplicate athlete/program control, and
  model-aligned view gaps.
- Arc 26A documents partial or missing applicant/member naming, household and
  emergency-contact handling, volunteer/program-admin naming, qualifications,
  and dedicated lifecycle/report routes.
- Later Arc 26E claims validation/delivery for several of these areas, so the
  remaining MemberOps issue list **needs product-owner confirmation**.

Sources: [`Arc 24C.1`](../planning/arc-24c-memberops-scoped-assignment-model.md),
[`Arc 26A`](../../planning/ARC_26A_MEMBEROPS_RC1_GAP_ASSESSMENT_AND_CAPABILITY_AUDIT.md),
and [`Arc 26E`](../../planning/ARC_26E_MEMBEROPS_ROLE_EXPERIENCE_PERMISSIONS_AND_OPERATIONAL_VALIDATION.md).

## GearOps And Platform Limits

- Full guardian approval workflow UX/audit capture is bounded or deferred.
- Full native mobile, full offline replication, procurement/accounting,
  predictive maintenance, enterprise rules/schema engines, and advanced BI are
  outside the current GearOps RC scope.
- Offline pending actions remain server-confirmed rather than authoritative
  local state.

Source: [`GearOps Known Limitations`](../product/gear-ops/known-limitations-and-deferred-scope.md).

## Tooling / Build Cleanup

- Prisma `package.json` config deprecation before Prisma 7.
- Two moderate npm audit vulnerabilities.
- npm minor update available.
- Next.js middleware convention deprecated in favor of proxy.

Source: [`Local Agent Validation Baseline`](../dev/local-agent-validation-baseline.md).

## Newly Captured Testing Issues

Add newly reproduced issues here with:

- date and environment
- affected role/workflow
- reproduction steps
- expected and actual behavior
- source issue/PR link
- confirmation status
