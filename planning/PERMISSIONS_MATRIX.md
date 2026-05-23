CadreOS lives or dies on role-aware visibility. The docs mention role-based access and relationship-aware visibility, but they do not define it deeply enough yet.

Example:

Action	Admin	Program Director	Coach	Parent	Athlete
Create team	Yes	Yes	No	No	No
View athlete notes	Yes	Yes	Team only	Own child only, limited	Own only, limited
Create attendance	Yes	Yes	Team only	No	No
RSVP to event	Yes	Yes	Yes	Own child	Self
Assign task	Yes	Yes	Team only	No	No

Without this, the app will become messy fast.

---

## Decided Access Model Rules

The following rules have been explicitly decided and must be honored in all future design and implementation work.

- A `Person` can hold multiple `RoleAssignment` records simultaneously.
- Roles are not fixed identities — they are assignments that can be added or removed by authorized admin users.
- Access is determined by the combination of **Person + RoleAssignment + Scope**.
- A person may simultaneously hold staff roles and a parent/guardian role.
- Parent/guardian access must remain relationship-scoped and must **not** automatically inherit staff access or team-wide access.
- Parent/guardian access is enforced through `AthleteGuardianRelationship` rows — not through role alone.
- Parent/guardian-linked users must not see `STAFF_ONLY` notes by default.
