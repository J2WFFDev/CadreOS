# GearOps Release-Candidate Usage Notes

Applies to GearOps release-candidate scope delivered through Arc 20A–20Y, with Arc 20Z retrospective closeout.

## RC Coverage

Validated RC workflows include:
- inventory lifecycle and item/category operations
- checkout/check-in and assignment custody flows
- location workflows and movement context
- maintenance/readiness operations
- event planning, assignment, staging, deployment, recovery
- reporting and exception visibility
- admin settings and category template controls
- mobile/offline pending-state behavior

## Practical RC Usage Guidance

- Use scan-first flows for field speed.
- Use item detail pages for complete custody/readiness/maintenance history.
- Use event gear workspace as the event source of planning truth.
- Use reports for exception-driven follow-up, not just totals.

## RC Cautions

- pending/offline actions are not final until server-confirmed
- online-required actions must wait for connection
- guardian approval and cross-module communication UX remain bounded

## Recommended Operational Habits During RC

- verify confirmation before handing off custody
- run post-event recovery checklist before closing event gear work
- review low-stock and overdue exceptions at shift end
- document damage/maintenance findings immediately on return

## Arc 20Z Closeout Reference

- Arc 20 retrospective, capability inventory, known gaps, deferred scope confirmation, and next-path candidate planning:  
  `planning/PHASE_20Z_GEAROPS_RELEASE_RETROSPECTIVE_AND_ROADMAP_RESET.md`

## Arc 20P+ Forward Recommendations

1. expand route/API integration tests for custody and event mutation paths
2. complete guardian approval UX and approval audit capture
3. strengthen offline conflict-review and retry-path coverage
4. deepen reporting drill-down verification against live datasets
5. run staged onboarding with these docs and collect operator feedback
