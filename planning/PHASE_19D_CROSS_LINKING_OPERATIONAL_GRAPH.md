# Arc 19D — Cross-Linking & Operational Graph

## Summary
Arc 19D establishes foundational operational graph support so CadreOS records can link across modules through one reusable relationship system.

Implemented in this phase:
- generic organization-scoped relationship table (`OperationalRelationship`)
- reusable node and relationship enums (`OperationalGraphNodeType`, `OperationalRelationshipType`)
- graph service layer for link, unlink, and related-record traversal
- generic graph API routes for create/delete/list related links
- lightweight “related operational items” UI on entry detail
- quick-capture context links mirrored into graph relationships
- entry activity integration for graph link add/remove events

## Architecture Decisions

### 1) Generic polymorphic edges instead of module-specific joins
`OperationalRelationship` stores:
- `fromNodeType` + `fromNodeId`
- `toNodeType` + `toNodeId`
- typed `relationshipType`

This keeps relationships reusable across current and future modules without adding bespoke tables for each pair of domains.

### 2) Organization-scoped graph authorization and traversal
All graph reads/writes are scoped by `organizationId`. Link/unlink routes require write permission (`entry.update`) and actor membership in the organization before mutation.

### 3) Reusable service layer as canonical graph access
`lib/operational-graph/service.ts` provides:
- `linkOperationalRecords`
- `unlinkOperationalRecords`
- `listRelatedOperationalRecords`

This centralizes validation, existence checks, entry activity integration, and traversal behavior for future feed/reporting/automation reuse.

### 4) Lightweight related-items projection
The service resolves graph neighbors into compact UI-ready node views (`title`, `subtitle`, `href`) to support related-item surfaces now without committing to advanced graph visualization.

## Relationship Model

### Node types
Arc 19D node coverage includes:
- Entry, Person, Team, Program, Season, Event, Attendance
- Facility, Resource, Reservation
- Gear item, assignment, checkout, maintenance, inventory transaction
- Follow-up task, observation note
- Roster/lifecycle relationship records

### Relationship types
Arc 19D includes:
- `RELATED_TO`
- `BLOCKED_BY`
- `FOLLOW_UP_TO`
- `CREATED_FROM`
- `IMPACTS`
- `ASSIGNED_FOR`
- `OBSERVED_DURING`
- `READINESS_FOR`

## Activity, Feed, and Reporting Compatibility
- Graph link mutations write entry activity actions when entries participate:
  - `entry.graph_link_added`
  - `entry.graph_link_removed`
- Existing entry/feed architecture remains intact.
- Graph APIs expose related neighbors in a shape suitable for future timeline/feed/report queries.

## Deferred Scope (Intentionally Out of Arc 19D)
- graph visualization canvases
- dependency scheduling/planning engines
- automation engines / workflow orchestration
- recommendation/AI relationship inference
- real-time collaboration graph editing
- multi-hop ranking/scoring analytics

## Arc 19E Recommended Next Steps
1. Add graph-aware feed cards that inline related-node summaries.
2. Add timeline query helpers for “show relationship changes over time.”
3. Add reporting query packs for relationship density, blockers, and readiness chains.
4. Add notification trigger points for selected relationship transitions.
5. Add safe two-hop traversal APIs with strict org and limit guards.
