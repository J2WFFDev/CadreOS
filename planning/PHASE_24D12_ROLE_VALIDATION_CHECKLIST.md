# Arc 24D.12 — Manual Role Validation Checklist

## Athlete
- [ ] ROLE-001 Athlete can access Dashboard without staff-only diagnostics.
- [ ] ROLE-002 Athlete sees EntryOps group in sidebar.
- [ ] ROLE-003 Athlete sees My Work/Today/Upcoming/Activity Feed/Habits/Journals links.
- [ ] ROLE-004 Athlete does **not** see EntryOps Inbox link.
- [ ] ROLE-005 Athlete does **not** see EntryOps Review link.
- [ ] ROLE-006 Athlete does **not** see EntryOps Lists/All links.
- [ ] ROLE-007 Athlete can open assigned work and complete allowed items.
- [ ] ROLE-008 Athlete can view Today schedule slice from assigned work.
- [ ] ROLE-009 Athlete can view Upcoming schedule slice from assigned work.
- [ ] ROLE-010 Athlete feed shows limited-scope content only.

## Guardian
- [ ] ROLE-011 Guardian can access Dashboard and linked-athlete context.
- [ ] ROLE-012 Guardian sees EntryOps group in sidebar.
- [ ] ROLE-013 Guardian sees My Work/Today/Upcoming/Activity Feed/Habits/Journals links.
- [ ] ROLE-014 Guardian does **not** see EntryOps Inbox link.
- [ ] ROLE-015 Guardian does **not** see EntryOps Review link.
- [ ] ROLE-016 Guardian does **not** see EntryOps Lists/All links.
- [ ] ROLE-017 Guardian can view linked-athlete journals per visibility policy.
- [ ] ROLE-018 Guardian can view linked-athlete habit summaries/check-ins per policy.
- [ ] ROLE-019 Guardian can view schedule slices (Today/Upcoming) without broad org leakage.
- [ ] ROLE-020 Guardian feed shows limited-scope content only.

## Coach
- [ ] ROLE-021 Coach can access MemberOps, EntryOps, GearOps, FieldOps/ResourceOps navigation.
- [ ] ROLE-022 Coach can view EntryOps Inbox and Review links.
- [ ] ROLE-023 Coach can assign work and review team-scoped activity.
- [ ] ROLE-024 Coach can access team visibility surfaces (members/entries/tasks).
- [ ] ROLE-025 Coach feed reflects team/scoped operational activity.
- [ ] ROLE-026 Coach relationship views do not expose disallowed private metadata outside scope.

## Program Admin
- [ ] ROLE-027 Program Admin can access program operations in MemberOps.
- [ ] ROLE-028 Program Admin can access full staff EntryOps navigation.
- [ ] ROLE-029 Program Admin can review and assign within authorized program scope.
- [ ] ROLE-030 Program Admin can access GearOps and FieldOps/ResourceOps staff routes.
- [ ] ROLE-031 Program Admin feed aligns with program-level operational scope.
- [ ] ROLE-032 Program Admin can manage role-related administration routes allowed for PROGRAM_MANAGER.

## Organization Admin
- [ ] ROLE-033 Organization Admin can access all navigation groups.
- [ ] ROLE-034 Organization Admin can perform full administration (roles/settings/audit).
- [ ] ROLE-035 Organization Admin can manage program/member/entry/gear/field operations.
- [ ] ROLE-036 Organization Admin feed includes organization-level operational visibility.
- [ ] ROLE-037 Organization Admin relationship and metadata visibility is complete and expected.

## Volunteer (if supported)
- [ ] ROLE-038 Volunteer-equivalent (`LIMITED_VIEWER`) sees only Home navigation group.
- [ ] ROLE-039 Volunteer-equivalent cannot access staff operation routes directly by URL.
- [ ] ROLE-040 Volunteer-equivalent sees no admin-only metadata leakage.
