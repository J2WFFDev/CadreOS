# CadreOS Product Decisions

This document records explicit product decisions that have been made and must be honored in design, modeling, and implementation going forward. Decisions here supersede any ambiguous or conflicting guidance in earlier planning documents.

---

## 1. Role and Access Model

- A `Person` can have multiple `RoleAssignment` records.
- Roles are not fixed identities — they are assignments that can change over time.
- `RoleAssignment` records can be added or removed by authorized admin users.
- Access is determined by the intersection of **Person + RoleAssignment + Scope**.
- A person may simultaneously hold staff roles and a parent/guardian role.
- Parent/guardian access must remain relationship-scoped and must **not** automatically inherit staff access or any team-wide access grants.

---

## 2. Parent/Guardian Model

- Parents/guardians may exist as `Person` records without a linked `UserAccount` (no login required).
- A parent/guardian may optionally be linked to a `UserAccount` at a later time.
- Parent/guardian access is gated by `AthleteGuardianRelationship` rows — access to an athlete's data is tied to that relationship, not to role alone.
- Parent/guardian-linked users must not see `STAFF_ONLY` notes by default.

---

## 3. Entry / Inbox Model

- The future unified `Entry` model is the preferred long-term direction.
- The default captured `Entry` type is **Task**.
- The default container for new entries is **Inbox**.
- Entries can include optional links, due dates, status, and tags.
- An Entry lives in one primary container and can link to many related entities.
- Public/private visibility must be made obvious in the UI.
- Entries may later route into feed, DM, group chat, private note, task list, event schedule, or other communication surfaces.

---

## 4. Communication Routing Concept

- FYP feed, DM, group chat, and private note behavior are future concepts — not current scope.
- Messaging must not be implemented yet.
- The design must preserve the idea that Entries can be routed based on **audience, visibility, type, and role-based access**.

---

## 5. FieldOps Direction

- FieldOps should support **pre-checks and recommendations** before a final human approval step.
- FieldOps MVP can begin with basic resource booking and conflict detection.
- Future FieldOps phases should add approval status and conflict rules.

---

## 6. Pilot Feedback

- The desired pilot scope is the **whole organization**.
- The first validation event can be a **one-day scripted scenario test**.
- Feedback captured during or after a pilot must be categorized as one of:
  - Observation
  - Friction
  - Bug
  - Missing Feature
  - Decision Needed
  - Follow-up Task
