# CadreOS Roadmap Placement — Deferred GearOps-Related Capabilities

## Purpose

Arc 16 GearOps MVP is complete and closed. This document places deferred GearOps-related capabilities into future roadmap areas so they are tracked intentionally, sequenced safely, and not pulled into the wrong arc.

This is a planning-only artifact:
- no runtime feature additions
- no Prisma schema changes
- no report-page implementation
- no communications implementation
- no GearOps enhancement implementation

---

## Future Roadmap Areas for Deferred Capability Placement

1. Ops Reporting & Operational Review
2. Roster / Member Lifecycle
3. Communications Toolset
4. GearOps Enhancement / Inventory Operations
5. Guardian / Compliance / Agreements
6. FinanceOps / Asset Accounting
7. Automation / Replenishment
8. Offline / Mobile-Native Runtime

---

## Recommended Dependency Order (Implementation Sequencing)

1. Ops Reporting & Operational Review
2. Roster / Member Lifecycle
3. Communications Toolset
4. GearOps Enhancement / Barcode / Inventory Audit
5. Guardian / Compliance / Agreements
6. FinanceOps / Asset Accounting
7. Automation / Replenishment
8. Offline / Mobile-Native Runtime

---

## Capability Ownership Clarification (Not GearOps-Only)

- **Barcode / QR scanning** belongs to **GearOps Enhancement**.
- **Purchasing / depreciation** belongs to **FinanceOps / Asset Accounting**.
- **Automated replenishment** belongs to **Automation / Replenishment**.
- **Parent-facing gear agreements** belong to **Guardian / Compliance / Agreements**.
- **Messaging / notifications** belong to **Communications Toolset**.
- **Offline inventory** belongs to **Offline / Mobile-Native Runtime**.
- **Bulk export** belongs with **Ops Reporting/admin tooling**; **bulk import** is delayed due to data-integrity risk.
- **Advanced reporting** belongs to **Ops Reporting & Operational Review**.

---

## Deferred Capability Placement Matrix

| Deferred capability | Best-fit future arc | Why it belongs there | Dependencies | Must remain out of scope until arc | Risk level | Notes for future implementation |
| --- | --- | --- | --- | --- | --- | --- |
| Barcode / QR scanning | GearOps Enhancement / Barcode / Inventory Audit | Adds inventory speed and auditability to existing GearOps custody workflows. | Ops Reporting baseline for audit metrics; Roster identity attribution stability; communications policy boundaries for any alerting side-effects. | No scanning surfaces, scan-to-checkout flows, or barcode label generation in pre-enhancement arcs. | Medium | Start with staff-only scan assist for lookup/audit; defer broad device integration until offline runtime arc. |
| Purchasing / finance / depreciation | FinanceOps / Asset Accounting | Procurement, capitalization, depreciation, and financial lifecycle are accounting concerns, not core GearOps custody workflows. | Roster attribution quality; reporting semantics for asset state; compliance guardrails for financial history. | No purchase orders, vendor lifecycle, depreciation schedules, or finance-ledger integration before FinanceOps arc. | High | Keep GearOps quantity/lifecycle operational; add finance link objects only when accounting policy is finalized. |
| Automated replenishment | Automation / Replenishment | Replenishment decisions require rule engines and threshold automation beyond manual MVP inventory management. | FinanceOps cost model readiness; reporting thresholds; communications delivery governance for alerts. | No auto-generated purchase/replenishment actions, no automatic low-stock triggers, no autonomous restock workflows. | High | Start with recommendations + approval gates before any auto-execute behavior. |
| Parent-facing gear agreements | Guardian / Compliance / Agreements | Guardian workflows, consent, and agreement enforceability sit in compliance + relationship policy scope. | Guardian identity/relationship policy maturity; communications policy controls; roster-person relationship integrity. | No guardian-signable gear forms, no parent portal agreement flows, no compliance enforcement automation. | High | Implement as policy-first workflows with explicit audit trails and role-safe access boundaries. |
| Messaging / notifications | Communications Toolset | Message routing, notification delivery, and audience controls are communications-domain runtime capabilities. | Consent/audience policy hardening; roster/guardian boundary correctness; reporting signals for notification candidates. | No in-app/outbound notifications, no reminder delivery channels, no broadcast messaging tied to GearOps events. | High | Roll out internal/staff-scoped delivery first; keep guardian delivery deferred until consent model is proven. |
| Offline / mobile-native inventory | Offline / Mobile-Native Runtime | Offline-first sync, device state, and conflict reconciliation are platform/runtime concerns, not base GearOps workflows. | Barcode workflow definitions; operational audit metrics; communications policy for sync/error alerts. | No offline queueing, no local-first inventory edits, no mobile-native custody updates before offline arc. | High | Require conflict-resolution policy and deterministic reconciliation before enabling write-capable offline paths. |
| Bulk import / export | Ops Reporting & Operational Review (export first); gated later import in GearOps Enhancement | Export aligns with reporting/admin review workflows; import materially changes data integrity risk profile. | Export: reporting metric definitions and role-scoped admin controls. Import: roster identity quality, finance/accounting mapping, and validation governance. | No bulk import pipelines in early arcs; no mass inventory mutation from CSV/spreadsheet uploads. | High | Phase 1: read-only bulk export for review/admin. Phase 2 (later): guarded import with dry-run validation, strict templates, and rollback safeguards. |
| Advanced reporting | Ops Reporting & Operational Review | Cross-module operational review and trend visibility are direct reporting-domain outcomes. | Consistent roster/member lifecycle state quality; GearOps and FieldOps summary definitions; role-safe scoping. | No advanced GearOps analytics pages, trend scoring, or predictive reporting before Ops Reporting arc. | Medium | Begin with operational review summaries, then drilldowns; keep predictive/BI expansion deferred. |

---

## Sequencing Notes

- Deferred GearOps items are distributed across multiple roadmap domains and should not be treated as a single GearOps follow-on arc.
- Dependencies are intentionally cross-domain: reporting and people-data quality gates should land before higher-risk finance, automation, and offline execution layers.
- Bulk import is intentionally delayed relative to bulk export due to higher corruption and ownership-attribution risk.

---

## Source References

- `planning/PHASE_16I_GEAROPS_MVP_CLOSEOUT.md`
- `planning/ROADMAP_POST_15A_GEAROPS_NEXT.md`
- `planning/MODULE_ROADMAP_FIELDOPS_GEAROPS.md`
- `planning/ROADMAP_POST_GEAROPS_DECISION.md`
- `planning/README.md`
- `planning/ROADMAP.md`
