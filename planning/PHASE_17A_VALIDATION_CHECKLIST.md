# Phase 17A — Roster and Member Lifecycle Architecture Boundaries: Validation Checklist

## Purpose

This checklist documents the validation state of the Arc 17A architecture and boundaries phase. Because Phase 17A is documentation-only, the checklist focuses on scope compliance, documentation completeness, deferred-boundary confirmation, and automated build health.

Legend:
- ✅ Confirmed
- ⚠️ Confirmed with known limitation (see notes)
- 🔲 Deferred — not in 17A scope

---

## Automated Validation

| Check | Status | Notes |
|-------|--------|-------|
| `npm run lint` | ✅ | No errors; documentation-only change |
| `npm run typecheck` | ✅ | No errors; no runtime code changed |
| `npm run build` | ✅ | Build passes; no new routes or modules introduced |
| `DATABASE_URL=... ./node_modules/.bin/prisma validate` | ✅ | Schema unchanged; validation passes |

---

## Scope Compliance

| Item | Status | Notes |
|------|--------|-------|
| No runtime code changed | ✅ | |
| No Prisma schema changed | ✅ | |
| No lifecycle workflows added | ✅ | All lifecycle work deferred to 17B+ |
| No reporting pages added | ✅ | |
| No messaging or notification behavior introduced | ✅ | |
| No communications implementation started | ✅ | |
| FieldOps behavior unchanged | ✅ | No FieldOps files modified |
| GearOps behavior unchanged | ✅ | No GearOps files modified |
| Core MVP runtime behavior unchanged | ✅ | No Core runtime files modified |

---

## Documentation Completeness

| Item | Status | Notes |
|------|--------|-------|
| Arc 17 purpose defined | ✅ | Join/activate/move/inactive/archive/rollover workflows named |
| In-scope lifecycle areas defined (9 areas) | ✅ | |
| Out-of-scope boundaries defined | ✅ | Table with 11 deferred areas |
| Current model fit and gaps documented for Person | ✅ | |
| Current model fit and gaps documented for UserAccount | ✅ | |
| Current model fit and gaps documented for RoleAssignment | ✅ | |
| Current model fit and gaps documented for Program | ✅ | |
| Current model fit and gaps documented for Team | ✅ | |
| Current model fit and gaps documented for Season | ✅ | |
| Current model fit and gaps documented for RosterMembership | ✅ | |
| Current model fit and gaps documented for AthleteGuardianRelationship | ✅ | |
| Current model fit and gaps documented for AttendanceRecord | ✅ | |
| Current model fit and gaps documented for ObservationNote | ✅ | |
| Current model fit and gaps documented for FollowUpTask | ✅ | |
| GearAssignment / GearCheckout cross-domain dependency documented | ✅ | |
| Arc 17 phase sequence defined (17A–17I) | ✅ | |
| Authorization expectations documented (role/scope matrix) | ✅ | |
| Privacy expectations documented | ✅ | Staff-only, no guardian runtime exposure |
| Rollback and continuity boundaries defined | ✅ | |
| Source references listed | ✅ | |
| Phase 17A output summary included | ✅ | |

---

## Deferred Boundary Confirmation

| Area | Status | Notes |
|------|--------|-------|
| Parent-facing portal or guardian self-service | 🔲 Deferred | Explicitly excluded from Arc 17 |
| Messaging / notifications / automated communications | 🔲 Deferred | Explicitly excluded from Arc 17 |
| Payment / dues / billing workflows | 🔲 Deferred | Explicitly excluded from Arc 17 |
| Advanced reporting runtime | 🔲 Deferred | Explicitly excluded from Arc 17 |
| Bulk import / bulk migration tooling | 🔲 Deferred | Explicitly excluded from Arc 17 |
| External integrations | 🔲 Deferred | Explicitly excluded from Arc 17 |
| AI-driven automation or autonomous lifecycle decisions | 🔲 Deferred | Explicitly excluded from Arc 17 |
| Consent policy / opt-out infrastructure | 🔲 Deferred | Explicitly excluded from Arc 17 |
| FieldOps booking or facility behavior | 🔲 Deferred | FieldOps-owned; not modified |
| GearOps inventory or assignment behavior | 🔲 Deferred | GearOps-owned; not modified |

---

## Authorization and Privacy Boundaries

| Item | Status | Notes |
|------|--------|-------|
| All lifecycle writes require staff role | ✅ | Documented in authorization matrix |
| ASSISTANT_COACH excluded from lifecycle write access | ✅ | Documented in authorization matrix |
| ATHLETE excluded from lifecycle write access | ✅ | Documented in authorization matrix |
| PARENT_GUARDIAN excluded from all lifecycle access | ✅ | Documented in authorization matrix |
| Organization-scoped lifecycle changes confirmed | ✅ | getOrganizationScope() required |
| Staff notes visibility unchanged by lifecycle transitions | ✅ | STAFF_ONLY NoteVisibility preserved |
| Guardian relationship diagnostics remain staff-only | ✅ | Phases 7E/8A behaviors preserved |

---

## Planning Index Update

| Item | Status | Notes |
|------|--------|-------|
| planning/README.md updated with Arc 17A phase doc | ✅ | |
| planning/README.md updated with Arc 17A validation checklist | ✅ | |
| Arc 17 phase sequence section added to README | ✅ | |

---

## Known Risks (Documented)

| Risk | Status | Notes |
|------|--------|-------|
| RosterMembership has no status field today | ⚠️ | Schema gap identified; design deferred to Arc 17B |
| Person has no lifecycle status field today | ⚠️ | Schema gap identified; design deferred to Arc 17B |
| RoleAssignment has no soft-archive or end-date today | ⚠️ | Schema gap identified; design deferred to Arc 17B |
| Season has no explicit lifecycle status today | ⚠️ | Schema gap identified; design deferred to Arc 17B |
| Archive semantics for GearAssignment/GearCheckout not yet defined | ⚠️ | Must be resolved before Arc 17E archive workflow |
| Open FollowUpTask reassignment policy on archive not yet defined | ⚠️ | Must be resolved before Arc 17E archive workflow |

---

## Arc 17A Closeout Sign-Off

| Area | Status |
|------|--------|
| Documentation-only phase confirmed | ✅ |
| No runtime code changed | ✅ |
| No schema changed | ✅ |
| Automated validation passes | ✅ |
| Scope compliance confirmed | ✅ |
| Documentation completeness confirmed | ✅ |
| Deferred boundaries confirmed | ✅ |
| Authorization and privacy expectations documented | ✅ |
| Phase sequence locked for 17B+ work | ✅ |
| Known risks documented | ✅ |
| README updated | ✅ |

**Arc 17A status: CLOSED. Architecture and boundary foundation is established. Arc 17B (Member Status and Lifecycle Model) may proceed.**
