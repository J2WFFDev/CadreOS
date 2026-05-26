# CadreOS Design System Readiness

This directory contains the UI/UX and design system readiness documentation for CadreOS.

These documents define future-state design intent, platform strategy, and reusable component vocabulary. They are **planning artifacts only** — they do not replace or reorder any current roadmap arc, and they do not require immediate UI changes.

---

## Purpose

CadreOS currently operates as a desktop web admin/operator tool. This design system readiness set prepares the platform for:

- Expansion to mobile web
- Potential PWA (Progressive Web App) packaging
- A future offline-capable mobile app
- A dual-layer UI model (Admin/Operator Mode + Guided/Field Mode)

The current admin visibility — raw IDs, audit logs, relationship tables, workflow state — is preserved and explicitly valued. These documents define a future layer alongside it, not a replacement.

---

## Document Index

| Document | Purpose |
|---|---|
| [ui-ux-decision-log.md](./ui-ux-decision-log.md) | Recorded design decisions and rationale |
| [platform-targets.md](./platform-targets.md) | Target platforms, capabilities, and deployment phases |
| [design-principles.md](./design-principles.md) | Core principles guiding all future UI/UX work |
| [role-and-density-modes.md](./role-and-density-modes.md) | Admin/Operator Mode vs Guided/Field Mode definitions |
| [navigation-model.md](./navigation-model.md) | Navigation structure per platform and mode |
| [status-language.md](./status-language.md) | Shared status vocabulary for all modules |
| [component-patterns.md](./component-patterns.md) | Reusable future component catalog |
| [offline-workflow-classification.md](./offline-workflow-classification.md) | Workflow offline suitability matrix |
| [sync-and-conflict-model.md](./sync-and-conflict-model.md) | Preferred append-only sync and conflict resolution model |
| [gearops-ui-pilot.md](./gearops-ui-pilot.md) | GearOps as the first future design system pilot |

---

## Relationship to Roadmap

These documents are design readiness artifacts. They inform future arcs but do not create new arcs or reorder existing ones.

Current roadmap arcs (Phases 16–20 and beyond) proceed as planned. When a future arc is ready to adopt design system patterns, it should reference the relevant documents here.

---

## Guiding Constraint

> Do not remove admin/operator visibility. Do not disrupt the current roadmap order. These documents prepare for the future without blocking the present.
