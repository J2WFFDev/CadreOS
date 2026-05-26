# GearOps Known Limitations and Deferred Scope (RC)

This document captures current release-candidate boundaries so administrators and operators do not assume unsupported functionality.

## Not Included in Current RC Scope

- full custom schema designer
- enterprise rules engine
- workflow automation engine for configuration orchestration
- procurement/accounting workflows
- predictive maintenance
- AI recommendations
- full native mobile app
- full offline sync/replication engine
- enterprise warehouse/logistics optimization

## Configuration and Policy Boundaries

- Organization-level GearOps settings are available in admin UI, but they are not a full global policy engine.
- Category configuration remains the primary operational configuration surface.
- Category custom fields support typed metadata only; they are not a dynamic schema platform.

## Offline Boundary

GearOps uses bounded pending-action behavior.

- Some actions can queue or draft locally.
- Custody-sensitive and event-sensitive actions still require review/confirmation or live connection.
- Final operational truth remains server-confirmed activity.

## Integration Boundary Notes

- GearOps uses reference-first links to adjacent modules.
- GearOps does not replace source-of-truth models in people, team, event, task, or notes modules.
- Missing adjacent module data is handled with fallback/unavailable context messaging.

## Guardian Approval Boundary

- Guardian boundaries are category-driven and integration-aware.
- Complete guardian approval workflow UX and full approval audit capture remain bounded/deferred.

## Event Template Boundary

- Event requirement templates are reusable requirement definitions.
- Full one-click event plan auto-population from templates is not currently in scope.

## Reporting Boundary

Current reporting focuses on operational summaries and exception drill-downs.

Deferred:
- enterprise BI/warehouse analytics
- advanced forecasting/predictive recommendation layers

## Why This Matters

These boundaries prevent unsafe operational assumptions and keep field teams aligned with what is actually supported now.
