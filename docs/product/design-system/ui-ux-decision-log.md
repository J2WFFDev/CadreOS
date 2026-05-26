# UI/UX Decision Log

This document records significant design decisions made for CadreOS, the rationale behind them, and alternatives considered.

---

## Decision Format

Each entry follows this structure:

- **Decision:** What was decided
- **Date:** Approximate date or phase
- **Rationale:** Why this was chosen
- **Alternatives considered:** What else was evaluated
- **Impact:** What this affects going forward

---

## DEC-001 — Preserve Admin/Operator Visibility

**Decision:** The current admin/operator UI — which exposes raw IDs, relationship tables, audit logs, workflow state, and system mechanics — will be preserved as a permanent first-class mode. It will not be replaced by a simplified guided UI.

**Date:** Design System Readiness, Pre-Arc 21

**Rationale:** CadreOS is an operational platform used by administrators and operators who need visibility into underlying system state for validation, debugging, troubleshooting, and auditing. Hiding this information would reduce operational capability. The platform was built for operators first.

**Alternatives considered:** Hiding raw details behind settings toggles or developer mode flags. Rejected because it would reduce accessibility of critical operational context during active use.

**Impact:** All future UI modes must coexist with admin visibility. Guided/Field Mode is additive, not a replacement. The Admin/Operator Mode remains the primary mode for desktop web.

---

## DEC-002 — Dual-Layer UI Model

**Decision:** CadreOS will eventually support two distinct UI modes: Admin/Operator Mode and Guided/Field Mode. Both will be surfaced in the same application codebase rather than as separate applications.

**Date:** Design System Readiness, Pre-Arc 21

**Rationale:** Different user roles have fundamentally different needs. Coaches, staff, and system admins need full operational context. Field users, athletes, and guardians need simplified, action-oriented surfaces. Maintaining both in one codebase reduces maintenance burden.

**Alternatives considered:** Separate apps per role type. Rejected due to code duplication, deployment complexity, and synchronization risk.

**Impact:** Component patterns, navigation models, and layout decisions must all accommodate both modes. Role context must be available at layout time.

---

## DEC-003 — GearOps as Design System Pilot

**Decision:** GearOps will be the first module piloted under the future design system.

**Date:** Design System Readiness, Pre-Arc 21

**Rationale:** GearOps is the richest intersection of platform concerns: custody tracking, location, mobile field use, scan actions, readiness state, maintenance logging, and future offline sync. It represents the widest surface area for design system validation.

**Alternatives considered:** Attendance workflows (simpler, less mobile complexity); Events (less scan/field dependency). Both are valid future candidates but lack the depth of GearOps.

**Impact:** GearOps UI pilot documentation defines three layout models (desktop admin, mobile web guided, offline mobile conceptual) as reference points for future arcs.

---

## DEC-004 — Offline Support is a Roadmap Capability, Not an Immediate Requirement

**Decision:** Offline-capable workflows will be planned and classified now, but implementation is deferred to a future arc.

**Date:** Design System Readiness, Pre-Arc 21

**Rationale:** Implementing offline sync prematurely adds significant architectural complexity (conflict resolution, sync queues, local storage management) before the platform data model is stable. Classifying workflows now ensures the architecture can accommodate it when ready.

**Alternatives considered:** Implementing offline sync as part of Arc 20E (Rapid/Mobile Inventory Operations). Deferred to avoid scope expansion during a stabilization phase.

**Impact:** All future workflow designs should consider offline suitability. Append-only event capture patterns are preferred where practical. See `offline-workflow-classification.md` and `sync-and-conflict-model.md`.

---

## DEC-005 — Append-Only Operational Events as Preferred Sync Pattern

**Decision:** Where practical, offline-capable workflows should capture operations as append-only events (e.g., `AttendanceMarked`, `AssetCheckedOut`) rather than direct record mutations.

**Date:** Design System Readiness, Pre-Arc 21

**Rationale:** Append-only events are naturally mergeable. They reduce conflict risk during sync. They also provide an implicit audit trail. Server-side state derivation from event streams is well-understood and reliable.

**Alternatives considered:** Last-write-wins record sync; client-side optimistic mutation with rollback. Both create unresolvable conflicts in concurrent offline scenarios.

**Impact:** Future sync model and offline workflow designs should prefer event capture over direct entity updates. See `sync-and-conflict-model.md`.

---

## DEC-006 — Platform Expansion Order

**Decision:** Platform expansion will follow this sequence: desktop web (current) → mobile web → PWA (optional bridge) → offline-capable mobile app (future).

**Date:** Design System Readiness, Pre-Arc 21

**Rationale:** This order allows incremental investment. Mobile web is achievable through responsive design and does not require a native app. PWA packaging is low-cost if the web app is already responsive. Offline-capable mobile requires significant architectural investment and is deferred.

**Alternatives considered:** React Native app in parallel with web. Rejected due to codebase split and premature investment before workflows are stable.

**Impact:** All future component designs must be mobile-web-ready. Offline-specific UI elements (OfflineBanner, SyncQueueIndicator) are designed now but implemented later.

---

## DEC-007 — Status Language is Shared Across Modules

**Decision:** A shared status vocabulary (Ready, Pending, Blocked, Needs Review, Checked Out, etc.) will be defined once and reused across all modules.

**Date:** Design System Readiness, Pre-Arc 21

**Rationale:** Consistent status language reduces cognitive load for operators working across multiple modules. Inconsistent status labels are a common source of operator confusion in multi-module platforms.

**Alternatives considered:** Module-specific status vocabularies. Rejected due to fragmentation and training burden.

**Impact:** All future module UI implementations should use the canonical status vocabulary defined in `status-language.md`. Module-specific extensions are allowed but must document their relationship to shared statuses.
