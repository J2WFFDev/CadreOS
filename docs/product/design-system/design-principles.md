# Design Principles

These principles guide all future UI/UX decisions in CadreOS. They are not visual style rules — they are operational and structural principles that should inform component design, interaction patterns, navigation, and information architecture.

---

## 1. Operational Clarity Over Visual Simplicity

CadreOS is an operational platform. The primary job of the UI is to give operators and administrators clear, accurate, complete information about the state of their program, athletes, gear, events, and staff.

When there is tension between visual minimalism and operational clarity, operational clarity wins on admin/operator surfaces.

Visual simplicity is appropriate for guided and field surfaces, where reducing friction for specific actions is the goal.

---

## 2. Preserve the Audit Trail

Every significant action in CadreOS has a record: who did it, when, what changed, and why (where captured). The UI must never obscure this trail. Admin surfaces should always provide access to audit context. Guided surfaces may summarize audit state without hiding the path to full detail.

---

## 3. Role-Aware Surfaces, Not Role-Locked Screens

UI surfaces adapt to role context (admin, coach, field user, guardian, athlete), but the underlying data model remains accessible through appropriate admin access. A screen that shows a simplified card for a field user should have a corresponding inspector view for an admin, not a separate screen implementation.

---

## 4. Mode-Additive, Not Mode-Replacing

Admin/Operator Mode is not replaced by Guided/Field Mode. Guided/Field Mode is a layer added on top of the existing operational surface. When implementing Guided Mode, the Admin Mode equivalent must continue to function. This is a hard constraint, not a preference.

---

## 5. Progressive Disclosure

Show the minimum necessary information for the current action. Provide clear paths to more detail. Never hide critical state without a visible indicator that more context exists.

Examples:
- A status badge indicating "Overdue" should link to the detail view showing why.
- A simplified checkout flow should show a confirmation summary linking to the full custody record.
- A readiness card should surface the most critical blocking item, not all items simultaneously.

---

## 6. Status-First Communication

Operators and field users often need to know the status of something before they need to interact with it. Design surfaces should lead with status clarity: what state is this entity in, and what action (if any) is required?

Use the canonical status vocabulary defined in `status-language.md` consistently.

---

## 7. Touch-First on Mobile, Not Touch-Only

Mobile web and field layouts must be touch-optimized (large targets, clear tap zones, minimal precision requirements). Desktop layouts may use hover states, compact density, and keyboard-accessible patterns. Do not assume touch on desktop or mouse precision on mobile.

Minimum touch target size: 44×44px (following WCAG 2.5.5 and Apple HIG guidance).

---

## 8. Offline-Aware Design

Even before offline capability is implemented, design components and interaction patterns as if offline is possible. This means:

- Surfaces should display connectivity state clearly when relevant.
- Actions that cannot complete offline should indicate their connectivity requirement.
- Forms that will eventually support offline capture should be designed for serializable, append-safe submission.

Do not implement offline sync until the designated arc. Do design UI patterns that will accommodate it.

---

## 9. Scan-Compatible Workflows

Any workflow involving physical assets (gear, equipment, ID) should be designed with scan-first interaction in mind. This means:

- Scan or search as the entry point, not form-first.
- Confirmation steps that show the scanned entity clearly before committing an action.
- Error states for failed scans that are immediately recoverable.

---

## 10. Consistent Component Vocabulary

Use the component catalog defined in `component-patterns.md` for all new UI surfaces. Introduce new components only when an existing pattern genuinely does not fit. When introducing a new component, document it in the catalog.

---

## 11. No Dead Ends

Every surface should have a clear next step or exit path. Empty states explain what's missing and how to fill it. Error states explain what failed and how to recover. Loading states communicate that work is in progress.

---

## 12. Separation of System State and Action Affordance

System state (what the data says) and action affordance (what the user can do) are distinct. A surface should always show true system state, even if the current user cannot take action on it. Unavailable actions may be disabled or hidden, but current state must remain visible.

---

## Applying These Principles

When designing a new screen or component:

1. Identify the user's primary goal on this surface.
2. Identify the role/mode context (admin, guided, field).
3. Identify the relevant system state to surface.
4. Identify the available actions and their dependencies.
5. Apply the most relevant principles to resolve any design tension.
6. Document decisions that trade off one principle against another in `ui-ux-decision-log.md`.
