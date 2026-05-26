# GearOps Known Limitations and Deferred Scope (RC)

This document captures current release-candidate boundaries so teams do not assume unsupported functionality.

## Not Included in Current RC Scope

- full native mobile app
- full offline sync/replication engine
- enterprise warehouse/logistics optimization
- procurement/accounting workflows
- predictive maintenance and AI recommendations
- full communications automation
- heavy real-time collaboration for planning

## Current Offline Boundary

GearOps uses bounded pending-action behavior. Some actions can queue locally, but final truth is server confirmation.

## Integration Boundary Notes

- GearOps uses reference-first links to adjacent modules.
- It does not replace source-of-truth models in people, team, event, task, or notes modules.
- Some guardian and communication paths remain intentionally deferred.

## Guardian Approval Boundary

Guardian approval behavior is category-driven and currently bounded. Full approval UX/audit completion remains a follow-up area.

## Reporting Boundary

Current reporting focuses on operational summaries and exception drill-downs. Full BI/warehouse-style analytics are deferred.

## Why This Matters

These boundaries prevent unsafe operational assumptions and keep field teams aligned with what is actually supported now.
