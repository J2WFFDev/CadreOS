# GearOps User Guide

GearOps helps staff manage gear inventory, custody, readiness, maintenance, and event deployment from one workspace.

## What GearOps Is

Use GearOps when you need to:
- find and identify gear quickly
- check gear out or check gear in
- assign gear to people, teams, or events
- track readiness, condition, and maintenance
- plan event gear and recover it after the event
- monitor exceptions (overdue, low stock, maintenance-needed, event gaps)

GearOps is **not**:
- a procurement/accounting system
- a warehouse optimization platform
- a predictive maintenance engine
- a full native mobile app with full offline sync

## Roles and Responsibilities

- **Operator / Coach / Volunteer:** scan, lookup, check out/check in, assignment follow-through, condition notes.
- **Equipment Cage / Vault Operator:** stage, issue, receive, recover, location verification, discrepancy follow-up.
- **Event Staff:** build event gear plan, define requirements, assign items, stage/deploy/recover, close event review.
- **Administrator:** category templates/rules, organization settings, location conventions, event template setup.
- **Power User / Program Manager:** reporting, exception drill-down, custody/history review, cross-module context review.
- **Guardian boundary:** guardians are read-only for dependent gear context and approval-response boundaries where category rules require guardian approval.

## Core Concepts

- **Gear item:** one inventory record.
- **Gear category:** behavior/rule template for groups of items.
- **Durable / Consumable:** durable tracks item lifecycle; consumable tracks quantity.
- **Kit / bundle:** grouped assets managed together.
- **Custody:** who currently controls gear (checkout or assignment).
- **Assignment:** longer-term responsibility context.
- **Location:** cage, vault, room, field, trailer, etc.
- **Readiness / condition:** deployability and quality state.
- **Maintenance / inspection:** service records and readiness impacts.
- **Event gear plan:** requirement and assignment plan for one event.
- **Deployment / recovery:** issue to event, then return and post-event closeout.
- **Pending action:** local/offline-held action not yet server-confirmed.

## Everyday Workflows

1. **Find gear**: open **GearOps → Items**, search by name/barcode/serial/SKU.
2. **Scan gear**: open **GearOps → Scan**, choose context (lookup, check-out, check-in, assignment, readiness, cage/vault, audit).
3. **Check out / check in**: open item detail, use checkout/check-in actions or scan flow.
4. **Transfer custody**: close current custody first, then open new checkout/assignment.
5. **Assign gear**: use **Assign gear** on item detail for person/team/event.
6. **Move location context**: use staging/recovery and location pages to keep storage state accurate.
7. **Mark readiness and condition**: update readiness status and condition notes from item workflows.
8. **Log maintenance**: add maintenance intake/completion records.
9. **Adjust consumables**: add transactions (used/received/adjusted) on consumable items.

## Event Workflows

Use **Events → [Event] → Gear**:
1. create/update event gear plan
2. add required/optional/support requirements
3. assign specific inventory items
4. stage from vault/cage
5. issue/deploy via checkout flow
6. return/check in after event
7. recover to location, mark condition, flag maintenance
8. close review with missing/unreturned follow-up

## Dashboard and Reporting

Use:
- **GearOps** overview for quick actions + readiness concerns
- **GearOps → Reports** for readiness/custody/location/maintenance/event/consumable summaries and exceptions

## Mobile and Offline Summary

- GearOps supports bounded offline behavior with explicit statuses: **Drafted locally, Pending sync, Sync failed, Needs review, Completed, Online required**.
- Pending items are local until server confirmation.
- Confirmed activity history remains server-backed.
- Some event planning and assignment operations are online-required.

See: [Mobile and Offline Behavior Guide](./mobile-offline-guide.md)

## Where To Go Next

- Operators: [Operator Quick Start](./operator-quick-start.md)
- Cage/vault teams: [Equipment Cage / Vault Workflows](./equipment-cage-vault-workflows.md)
- Event teams: [Event Gear Operations Guide](./event-gear-operations.md)
- Admins: [Admin Configuration Overview](./admin-configuration-overview.md)
- Reporting users: [Reporting and Dashboard Guide](./reporting-dashboard-guide.md)
- Troubleshooting: [Troubleshooting Guide](./troubleshooting.md)
